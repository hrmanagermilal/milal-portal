"""
Auth routes: member lookup, OTP send/verify, account create, login.
"""
import asyncio
import logging
import os
import random
import smtplib
import string
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from tokenize import String

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from .database import get_db
from .models import Member, OtpCode, User, MemberChangeLog
from .schemas import UserOut, ChangePasswordRequest, AdminUpdateUserRequest, ResetPasswordRequest
from .ohjic_client import OhjicAPIClient

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-for-jwt")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Pydantic schemas ────────────────────────────────────────────────────────

class AdminUpdateAccessibleRequest(BaseModel):
    accessible: int  # 0 or 1

class FindMemberRequest(BaseModel):
    name: str

class SendOtpRequest(BaseModel):
    member_id: int
    contact_type: str   # "email" | "phone"

class VerifyOtpRequest(BaseModel):
    member_id: int
    code: str

class CheckUserIdRequest(BaseModel):
    user_id: str

class CreateAccountRequest(BaseModel):
    member_id: int
    code: str
    user_id: str
    password: str

class LoginRequest(BaseModel):
    user_id: str
    password: str

class MyAccountUpdateRequest(BaseModel):
    email: str | None = None
    phone: str | None = None
    address_road: str | None = None

# ── Helpers ─────────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=4))


def _send_email(to_addr: str, subject: str, body: str) -> bool:
    """Send email via SMTP. Returns True on success."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    # Check configuration
    if not smtp_host or not smtp_user or not smtp_pass:
        logger.warning(
            "[OTP EMAIL – not configured] SMTP_HOST=%s, SMTP_USER=%s, SMTP_PASS=%s | To: %s",
            "✓" if smtp_host else "✗",
            "✓" if smtp_user else "✗",
            "✓" if smtp_pass else "✗",
            to_addr
        )
        return False

    try:
        logger.info("Attempting to send email to %s via %s:%d from %s", to_addr, smtp_host, smtp_port, smtp_from)
        msg = MIMEMultipart()
        msg["From"]    = smtp_from
        msg["To"]      = to_addr
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        # Increased timeout from 10 to 30 seconds
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.ehlo()
            logger.debug("EHLO sent")
            server.starttls()
            logger.debug("STARTTLS sent")
            server.login(smtp_user, smtp_pass)
            logger.debug("Login successful")
            server.sendmail(smtp_from, to_addr, msg.as_string())
            logger.info("✓ Email sent successfully to %s", to_addr)
        return True
    except Exception as exc:
        logger.error("✗ Email send failed: %s | type: %s", exc, type(exc).__name__)
        import traceback
        logger.error("Traceback: %s", traceback.format_exc())
        return False


def _send_sms(phone: str, message: str) -> bool:
    """
    SMS stub – log the message.
    Replace this with your SMS provider (e.g. SOLAPI, Twilio) by setting:
      SMS_PROVIDER=solapi  SMS_API_KEY=...  SMS_API_SECRET=...  SMS_FROM=...
    """
    logger.warning("[OTP SMS – not configured] To: %s | %s", phone, message)
    return False  # signals dev mode; caller will return OTP in response


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    member = db.execute(select(Member).where(Member.user_id == user_id)).scalar_one_or_none()
    if member is None:
        raise credentials_exception
    return member


# ── Routes ──────────────────────────────────────────────────────────────────

@router.post("/find-member")
async def find_member(body: FindMemberRequest, db: Session = Depends(get_db)):
    """
    Find a member by name using OHJIC API (옵션A: 온디맨드).
    
    ohjic API로 먼저 조회하고, 로컬 DB와 동기화합니다.
    """
    logger.info(f"[find-member] Request received - name={body.name}")
    
    if not body.name.strip():
        logger.warning(f"[find-member] Empty name provided")
        raise HTTPException(400, "Please provide a name")

    try:
        # ohjic API로 성도 검색
        logger.info(f"[find-member] Searching OHJIC API for name={body.name.strip()}")
        ohjic_client = OhjicAPIClient()
        api_response = await ohjic_client.get_members(name=body.name.strip())
        api_members = api_response.get("data", [])
        logger.info(f"[find-member] OHJIC search result: found {len(api_members)} member(s)")

        if not api_members:
            logger.warning(f"[find-member] No members found in OHJIC for name={body.name.strip()}")
            raise HTTPException(404, "Member not found in OHJIC. Please check your name.")

        # 첫 번째 매칭 결과 사용
        api_member_list = api_members[0]
        ohjic_member_id = api_member_list.get("member_id")
        logger.info(f"[find-member] Using first match: member_id={ohjic_member_id}, name={api_member_list.get('member_name')}")
        
        # 멤버 상세 정보 조회 (member_custom_8 확인용)
        logger.info(f"[find-member] Fetching member details for member_id={ohjic_member_id}")
        ohjic_client = OhjicAPIClient()
        member_detail_response = await ohjic_client.get_member(ohjic_member_id)
        api_member = member_detail_response.get("data", {})
        logger.info(f"[find-member] Member detail fetched successfully")
        
        # member_custom_8 권한 확인 (가입 가능 여부)
        # 유효한 값: "admin", "manager", "member", "none"
        # 가입 가능: "admin", "manager", "member"
        # 가입 불가능: "none" (또는 빈값/None)
        member_custom_8_raw = api_member.get("member_custom_8")
        member_custom_8 = member_custom_8_raw.strip() if member_custom_8_raw else "none"
        
        logger.info(f"[find-member] member_custom_8 value: '{member_custom_8}' (raw: {member_custom_8_raw})")
        
        # 가입 가능 권한 확인
        allowed_roles = {"admin", "manager", "member"}
        if member_custom_8 not in allowed_roles:
            logger.warning(f"[find-member] Signup not permitted - member_custom_8: '{member_custom_8}' not in {allowed_roles}")
            raise HTTPException(403, f"Signup not permitted. Your permission is: {member_custom_8}")
        
        logger.info(f"[find-member] member_custom_8 validation passed: {member_custom_8}")
        member_name = api_member.get("member_name")
        email = api_member.get("email")
        phone = api_member.get("mobile_phone")
        # Extract cell_group from group_names (last item)
        group_names = api_member.get("group_names", [])
        cell_group = group_names[-1] if group_names else ""
        logger.info(f"[find-member] Member info extracted: name={member_name}, email={email}, phone={phone}, cell_group={cell_group}")

        # 로컬 DB에서 동기화된 멤버 확인
        logger.info(f"[find-member] Checking local DB for member_id={ohjic_member_id}")
        local_member = db.execute(
            select(Member).where(Member.id == ohjic_member_id)
        ).scalar_one_or_none()
        logger.info(f"[find-member] Local DB lookup result: found={local_member is not None}")

        if not local_member:
            # 신규 성도: 로컬 DB에 추가 (옵션A: 온디맨드)

            local_member = Member(
                id=ohjic_member_id,
                name=member_name,
                email=email,
                phone=phone,
                accessible=1,
                permission=member_custom_8,
                title=api_member.get("position_name", ""),
                cell_group=cell_group,
            )
            logger.info(f"[find-member] Member object created: permission={local_member.permission} (type: {type(local_member.permission).__name__})")
            db.add(local_member)
            db.commit()
            db.refresh(local_member)
            logger.info(f"✓ New member {ohjic_member_id} synced from OHJIC API - stored permission={local_member.permission}")
        else:
            # 기존 성도: 정보 업데이트 (동기화)
            logger.info(f"[find-member] Existing member found - member_id={ohjic_member_id}, current_permission={local_member.permission}")
            if member_name and local_member.name != member_name:
                logger.info(f"[find-member] Updating name: {local_member.name} -> {member_name}")
                local_member.name = member_name
            if email and local_member.email != email:
                logger.info(f"[find-member] Updating email: {local_member.email} -> {email}")
                local_member.email = email
            if phone and local_member.phone != phone:
                logger.info(f"[find-member] Updating phone: {local_member.phone} -> {phone}")
                local_member.phone = phone
            if cell_group and local_member.cell_group != cell_group:
                logger.info(f"[find-member] Updating cell_group: {local_member.cell_group} -> {cell_group}")
                local_member.cell_group = cell_group
            db.commit()
            db.refresh(local_member)
            logger.info(f"[find-member] Existing member updated - member_id={ohjic_member_id}, final_permission={local_member.permission}")

        # 계정 존재 여부 확인
        logger.info(f"[find-member] Checking for existing user account for member_id={local_member.id}")
        user = db.execute(
            select(User).where(User.member_id == local_member.id)
        ).scalar_one_or_none()
        logger.info(f"[find-member] User account check result: has_account={user is not None}")

        response = {
            "member_id":      local_member.id,
            "name":           local_member.name,
            "email_masked":   _mask(local_member.email, is_email=True),
            "phone_masked":   _mask(local_member.phone, is_email=False),
            "has_account":    user is not None,
        }
        logger.info(f"[find-member] Response prepared successfully for member_id={local_member.id}")
        return response

    except ValueError as e:
        logger.warning(f"[find-member] OHJIC API not configured: {e}. Falling back to local DB.")
        # Fallback: 로컬 DB에서만 검색
        logger.info(f"[find-member] Searching local DB for name={body.name.strip()}")
        stmt = select(Member).where(Member.name == body.name.strip())
        member = db.execute(stmt).scalar_one_or_none()
        if not member:
            logger.warning(f"[find-member] Member not found in local DB: name={body.name.strip()}")
            raise HTTPException(404, "Member not found. Please check your name.")

        logger.info(f"[find-member] Local DB member found: member_id={member.id}, name={member.name}")
        user = db.execute(select(User).where(User.member_id == member.id)).scalar_one_or_none()
        return {
            "member_id":      member.id,
            "name":           member.name,
            "email_masked":   _mask(member.email, is_email=True),
            "phone_masked":   _mask(member.phone, is_email=False),
            "has_account":    user is not None,
        }
    except Exception as e:
        logger.error(f"[find-member] Error occurred: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to find member: {str(e)}")


def _mask(value: str, is_email: bool) -> str:
    if not value:
        return ""
    if is_email:
        local, _, domain = value.partition("@")
        return local[:2] + "***@" + domain if len(local) > 2 else "***@" + domain
    # phone: show last 4 digits
    return "***-***-" + value[-4:] if len(value) >= 4 else "***"

@router.post("/send-otp")
def send_otp(body: SendOtpRequest, db: Session = Depends(get_db)):
    """Generate a 4-digit OTP and send it to the member's email or phone."""
    logger.info(f"[send-otp] Request received - member_id={body.member_id}, contact_type={body.contact_type}")
    
    member = db.get(Member, body.member_id)
    logger.info(f"[send-otp] Member lookup: member_id={body.member_id}, found={member is not None}")
    
    if not member:
        logger.warning(f"[send-otp] Member not found for member_id={body.member_id}")
        raise HTTPException(404, "Member not found")
    
    logger.info(f"[send-otp] Member details: name={member.name}, permission={member.permission}, accessible={member.accessible}")
    
    # Check signup eligibility
    logger.info(f"[send-otp] Signup eligibility check: permission={member.permission}")
    
    # Validate contact_type
    logger.info(f"[send-otp] Validating contact_type: {body.contact_type}")
    if body.contact_type == "email":
        contact = member.email
        logger.info(f"[send-otp] Email mode - email={contact if contact else 'NOT SET'}")
        if not contact:
            logger.warning(f"[send-otp] No email on file for member_id={body.member_id}")
            raise HTTPException(400, "No email on file")
    elif body.contact_type == "phone":
        contact = member.phone
        logger.info(f"[send-otp] Phone mode - phone={contact if contact else 'NOT SET'}")
        if not contact:
            logger.warning(f"[send-otp] No phone on file for member_id={body.member_id}")
            raise HTTPException(400, "No phone on file")
    else:
        logger.error(f"[send-otp] Invalid contact_type: {body.contact_type}")
        raise HTTPException(400, "contact_type must be 'email' or 'phone'")

    # Generate OTP
    code = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    logger.info(f"[send-otp] OTP generated: code={code}, expires_at={expires_at}")

    # Save OTP to database
    otp = OtpCode(
        member_id=member.id,
        code=code,
        contact=contact,
        expires_at=expires_at,
    )
    db.add(otp)
    db.commit()
    logger.info(f"[send-otp] OTP saved to database: member_id={member.id}, contact={contact}")

    message = f"[Milal Community] Your verification code is: {code}\nValid for 10 minutes."
    sent = False

    if body.contact_type == "email":
        logger.info(f"[send-otp] Attempting to send email to {contact}")
        sent = _send_email(contact, "[Milal Community] Verification Code", message)
        logger.info(f"[send-otp] Email send result: sent={sent}")
    else:
        logger.info(f"[send-otp] Attempting to send SMS to {contact}")
        sent = _send_sms(contact, message)
        logger.info(f"[send-otp] SMS send result: sent={sent}")

    response: dict = {"sent": sent, "expires_minutes": 10}

    # In dev mode (not actually sent), return the code so the flow can be tested
    if not sent:
        logger.warning(f"[send-otp] Delivery failed - returning dev_code for testing")
        response["dev_code"] = code
        response["dev_note"] = (
            "SMTP/SMS not configured – code returned for development only. "
            "Set SMTP_HOST / SMTP_USER / SMTP_PASSWORD env vars to enable email."
        )
    
    logger.info(f"[send-otp] Response sent: sent={sent}, member_id={body.member_id}")
    return response


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Verify OTP without consuming it (pre-check before password creation)."""
    otp = _get_valid_otp(body.member_id, body.code, db)
    return {"valid": True, "member_id": body.member_id}


@router.post("/create-account")
def create_account(body: CreateAccountRequest, db: Session = Depends(get_db)):
    """Verify OTP, set user_id, create account, and send email."""
    if len(body.user_id) < 3:
        raise HTTPException(400, "User ID must be at least 3 characters")
    
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    otp = _get_valid_otp(body.member_id, body.code, db)
    member = db.get(Member, body.member_id)

    # Check user_id not taken
    existing_user_id = db.execute(
        select(Member).where(Member.user_id == body.user_id.strip())
    ).scalar_one_or_none()
    if existing_user_id and existing_user_id.id != member.id:
        raise HTTPException(409, "User ID already taken")
    
    # Mark OTP used
    otp.used = True
    db.flush()

    # Set user_id on member
    member.user_id = body.user_id.strip()
    
    # Create or update User account
    existing = db.execute(
        select(User).where(User.member_id == body.member_id)
    ).scalar_one_or_none()

    if existing:
        existing.password_hash = body.password
    else:
        db.add(User(member_id=body.member_id, password_hash=body.password))

    db.commit()
    db.refresh(member)
    
    # Send welcome email
    email_subject = "[Milal Community] Account Created"
    email_body = f"""Hi {member.name},

Your account has been successfully created!

User ID: {member.user_id}
Name: {member.name}
Email: {member.email}

You can now log in with your User ID and password.

Best regards,
Milal Community Team
"""
    
    _send_email(member.email, email_subject, email_body)
    
    return {"success": True, "user_id": member.user_id, "name": member.name}


@router.post("/check-userid")
def check_userid(body: CheckUserIdRequest, db: Session = Depends(get_db)):
    """Check if user_id is available."""
    if len(body.user_id) < 3:
        raise HTTPException(400, "User ID must be at least 3 characters")
    
    existing = db.execute(
        select(Member).where(Member.user_id == body.user_id.strip())
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(409, "User ID already taken")
    
    return {"available": True}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login with user_id + password."""
    logger.info(f"Login attempt: user_id={body.user_id}")
    
    member = db.execute(
        select(Member).where(Member.user_id == body.user_id.strip())
    ).scalar_one_or_none()

    if not member:
        logger.warning(f"❌ Member not found: user_id={body.user_id}")
        raise HTTPException(401, "Invalid user ID or password")
    
    logger.info(f"✓ Member found: id={member.id}, name={member.name}")

    user = db.execute(
        select(User).where(User.member_id == member.id)
    ).scalar_one_or_none()

    if not user:
        logger.warning(f"❌ User not found for member_id={member.id}")
        raise HTTPException(401, "Invalid user ID or password")
    
    logger.info(f"✓ User found: id={user.id}, password_hash={user.password_hash[:20]}...")
    
    # Compare plaintext password
    if body.password != user.password_hash:
        logger.warning(f"❌ Password mismatch - provided={body.password}, stored={user.password_hash}")
        raise HTTPException(401, "Invalid user ID or password")
    
    logger.info(f"✓ Password matched for user_id={body.user_id}")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": member.user_id}, expires_delta=access_token_expires
    )

    logger.info(f"✓ Login successful: user_id={member.user_id}, token generated")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": member.user_id,
        "name": member.name,
        "member_id": member.id,
        "permission": member.permission,
        "membership_category": user.membership_category.value if user and user.membership_category else "adult",
        "title": member.title,
        "cell_group": member.cell_group,
        "email": member.email,
        "phone": member.phone,
    }


@router.get("/me")
def read_users_me(current_user: Member = Depends(get_current_user)):
    return current_user

@router.patch("/me")
async def update_users_me(body: MyAccountUpdateRequest, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Update current user's information via OHJIC API.
    Step 1: OHJIC API update
    Step 2: Local DB update
    """
    logger.info(f"[update-users-me] START - member_id={current_user.id}, name={current_user.name}")
    
    try:
        # Step 1: OHJIC API 클라이언트 초기화
        ohjic_client = OhjicAPIClient()
        logger.info(f"[update-users-me] OHJIC API client initialized")
    except ValueError as e:
        logger.warning(f"[update-users-me] OHJIC API not configured: {e}. Using local DB only.")
        ohjic_client = None

    update_data = body.dict(exclude_unset=True)
    logger.info(f"[update-users-me] Update data received: {update_data}")
    
    changes = []

    # 필드 매핑: 로컬 필드명 -> ohjic API 필드명
    # Note: OHJIC API PUT /v2/members/{id} only supports: member_name, gender, birth_date, mobile_phone, email, position_name, church_level_name
    # Address fields cannot be updated via API
    field_mapping = {
        "email": "email",
        "phone": "mobile_phone",
    }

    # Step 2: ohjic API로 업데이트 (가능한 필드만)
    ohjic_update_payload = {}
    for local_field, ohjic_field in field_mapping.items():
        if local_field in update_data:
            ohjic_update_payload[ohjic_field] = update_data[local_field]
            logger.info(f"[update-users-me] Mapping: {local_field}={update_data[local_field]} -> {ohjic_field}")

    if ohjic_update_payload:
        logger.info(f"[update-users-me] OHJIC payload prepared: {ohjic_update_payload}")
        
        if ohjic_client:
            try:
                logger.info(f"[update-users-me] Calling OHJIC API - update_member(member_id={current_user.id}, **{ohjic_update_payload})")
                response = await ohjic_client.update_member(
                    current_user.id,
                    **ohjic_update_payload
                )
                logger.info(f"[update-users-me] ✓ OHJIC API response: {response}")
                logger.info(f"[update-users-me] ✓ Member {current_user.id} updated in OHJIC API")
            except Exception as e:
                logger.error(f"[update-users-me] ✗ OHJIC API call failed - {type(e).__name__}: {e}", exc_info=True)
                raise HTTPException(400, f"OHJIC API update failed: {str(e)}")
        else:
            logger.warning(f"[update-users-me] OHJIC client is None - skipping OHJIC API update")
    else:
        logger.info(f"[update-users-me] No fields to update in OHJIC API")

    # Step 3: 로컬 DB 동기화
    logger.info(f"[update-users-me] Starting local DB sync...")
    for field, new_value in update_data.items():
        old_value = getattr(current_user, field)
        logger.info(f"[update-users-me] Field check: {field} - old={old_value} vs new={new_value}")
        
        if old_value != new_value:
            logger.info(f"[update-users-me] Field changed: {field} - {old_value} -> {new_value}")
            changes.append(
                MemberChangeLog(
                    member_id=current_user.id,
                    changed_by="self",
                    field_name=field,
                    old_value=str(old_value),
                    new_value=str(new_value),
                )
            )
            setattr(current_user, field, new_value)
        else:
            logger.info(f"[update-users-me] Field unchanged: {field}")
    
    if changes:
        logger.info(f"[update-users-me] Committing {len(changes)} changes to local DB")
        db.add_all(changes)
        db.commit()
        db.refresh(current_user)
        logger.info(f"[update-users-me] ✓ Local DB updated successfully")
    else:
        logger.info(f"[update-users-me] No changes to commit")

    logger.info(f"[update-users-me] END - returning updated member: {current_user.name}")
    return current_user


@router.get("/cell-group-members")
def get_cell_group_members(current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get all members in the same cell group as current user.
    Data is cached via daily sync from OHJIC API (see sync_tasks.py).
    """
    logger.info(f"[cell-group-members] Request received - user_id={current_user.user_id}, cell_group={current_user.cell_group}")
    
    if not current_user.cell_group:
        logger.warning(f"[cell-group-members] User has no cell_group assigned")
        return []
    
    try:
        # Query local cached DB
        members = db.execute(
            select(Member).where(Member.cell_group == current_user.cell_group).order_by(Member.name)
        ).scalars().all()
        
        logger.info(f"[cell-group-members] Returning {len(members)} members from cached local DB")
        return members
    
    except Exception as e:
        logger.error(f"[cell-group-members] Error occurred: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to get cell group members: {str(e)}")

@router.get("/cell-group-members-by-name")
def get_cell_group_members_by_name(group_name: str, db: Session = Depends(get_db)):
    """
    Get all members in a specific cell group by name.
    Data is cached via daily sync from OHJIC API (see sync_tasks.py).
    """
    logger.info(f"[cell-group-members-by-name] Request received - group_name={group_name}")
    
    if not group_name.strip():
        logger.warning(f"[cell-group-members-by-name] Empty group_name provided")
        raise HTTPException(400, "group_name is required")
    
    try:
        # Query local cached DB
        members = db.execute(
            select(Member).where(Member.cell_group == group_name).order_by(Member.name)
        ).scalars().all()
        
        logger.info(f"[cell-group-members-by-name] Returning {len(members)} members from cached local DB")
        return members
    
    except Exception as e:
        logger.error(f"[cell-group-members-by-name] Error occurred: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to get cell group members: {str(e)}")

@router.get("/member/{member_id}")
def get_member(member_id: int, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get member details (must be in the same cell group)."""
    target_member = db.execute(
        select(Member).where(Member.id == member_id)
    ).scalar_one_or_none()
    
    if not target_member:
        raise HTTPException(404, "Member not found")
    
    # Check if current user is in the same cell group
    if current_user.cell_group != target_member.cell_group:
        raise HTTPException(403, "Permission denied - must be in the same cell group")
    
    return target_member


@router.patch("/member/{member_id}")
async def update_member(member_id: int, body: MyAccountUpdateRequest, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update another member's information (must have admin or manager permission)."""
    logger.info(f"[update-member] START - admin_id={current_user.id}, target_member_id={member_id}, permission={current_user.permission}")
    
    target_member = db.execute(
        select(Member).where(Member.id == member_id)
    ).scalar_one_or_none()
    
    if not target_member:
        logger.error(f"[update-member] Member not found: {member_id}")
        raise HTTPException(404, "Member not found")
    
    # Check if current user has admin or manager permission
    if current_user.permission not in {"admin", "manager"}:
        logger.warning(f"[update-member] Permission denied - user {current_user.id} has permission={current_user.permission} (needs admin/manager)")
        raise HTTPException(403, "Permission denied - only admin or manager can edit member information")
    
    logger.info(f"[update-member] Permission check passed - user has {current_user.permission} permission")
    
    # Initialize OHJIC API client
    try:
        ohjic_client = OhjicAPIClient()
        logger.info(f"[update-member] OHJIC API client initialized")
    except ValueError as e:
        logger.warning(f"[update-member] OHJIC API not configured: {e}. Using local DB only.")
        ohjic_client = None
    
    update_data = body.dict(exclude_unset=True)
    logger.info(f"[update-member] Update data received: {update_data}")
    
    changes = []
    
    # 필드 매핑: 로컬 필드명 -> ohjic API 필드명
    # Note: OHJIC API PUT /v2/members/{id} only supports: member_name, gender, birth_date, mobile_phone, email, position_name, church_level_name
    # Address fields cannot be updated via API
    field_mapping = {
        "email": "email",
        "phone": "mobile_phone",
    }
    
    # OHJIC API로 업데이트 (가능한 필드만)
    ohjic_update_payload = {}
    for local_field, ohjic_field in field_mapping.items():
        if local_field in update_data:
            ohjic_update_payload[ohjic_field] = update_data[local_field]
            logger.info(f"[update-member] Mapping: {local_field}={update_data[local_field]} -> {ohjic_field}")

    if ohjic_update_payload:
        logger.info(f"[update-member] OHJIC payload prepared: {ohjic_update_payload}")
        
        if ohjic_client:
            try:
                logger.info(f"[update-member] Calling OHJIC API - update_member(member_id={target_member.id}, **{ohjic_update_payload})")
                response = await ohjic_client.update_member(
                    target_member.id,
                    **ohjic_update_payload
                )
                logger.info(f"[update-member] ✓ OHJIC API response: {response}")
                logger.info(f"[update-member] ✓ Member {target_member.id} updated in OHJIC API")
            except Exception as e:
                logger.error(f"[update-member] ✗ OHJIC API call failed - {type(e).__name__}: {e}", exc_info=True)
                raise HTTPException(400, f"OHJIC API update failed: {str(e)}")
        else:
            logger.warning(f"[update-member] OHJIC client is None - skipping OHJIC API update")
    else:
        logger.info(f"[update-member] No fields to update in OHJIC API")
    
    # 로컬 DB 동기화
    logger.info(f"[update-member] Starting local DB sync...")
    for field, new_value in update_data.items():
        old_value = getattr(target_member, field)
        logger.info(f"[update-member] Field check: {field} - old={old_value} vs new={new_value}")
        
        if old_value != new_value:
            logger.info(f"[update-member] Field changed: {field} - {old_value} -> {new_value}")
            changes.append(
                MemberChangeLog(
                    member_id=target_member.id,
                    changed_by=current_user.name,
                    field_name=field,
                    old_value=str(old_value),
                    new_value=str(new_value),
                )
            )
            setattr(target_member, field, new_value)
        else:
            logger.info(f"[update-member] Field unchanged: {field}")
    
    if changes:
        logger.info(f"[update-member] Committing {len(changes)} changes to local DB")
        db.add_all(changes)
        db.commit()
        db.refresh(target_member)
        logger.info(f"[update-member] ✓ Local DB updated successfully")
    else:
        logger.info(f"[update-member] No changes to commit")

    logger.info(f"[update-member] END - returning updated member: {target_member.name}")
    return target_member


# ── Internal helper ──────────────────────────────────────────────────────────

def _get_valid_otp(member_id: int, code: str, db: Session) -> OtpCode:
    otp = db.execute(
        select(OtpCode)
        .where(
            OtpCode.member_id == member_id,
            OtpCode.code      == code,
            OtpCode.used      == False,
            OtpCode.expires_at > datetime.utcnow(),
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not otp:
        raise HTTPException(400, "Invalid or expired code")
    return otp


# ── User Management (Admin only) ────────────────────────────────────────────

def _is_admin(current_user: Member, db: Session) -> bool:
    """Check if current user is admin."""
    return current_user and current_user.permission == "admin"


def _get_admin_or_403(current_user: Member, db: Session) -> Member:
    """Verify current user is admin, raise 403 if not."""
    if not _is_admin(current_user, db):
        raise HTTPException(403, "Permission denied - admin access required")
    return current_user


@router.get("/admin/users")
def list_users(
    skip: int = 0,
    limit: int = 20,
    query: str = "",
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all users with pagination and optional search (admin only)."""
    _get_admin_or_403(current_user, db)
    
    # Build query
    stmt = select(User, Member).join(Member, User.member_id == Member.id)
    
    # Apply search filter if provided
    if query.strip():
        search_term = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Member.name.like(search_term),
                Member.email.like(search_term),
                Member.phone.like(search_term),
                Member.user_id.like(search_term)
            )
        )
    
    stmt = stmt.order_by(User.created_at.desc()).offset(skip).limit(limit)
    
    users = db.execute(stmt).all()
    
    result = []
    for user, member in users:
        result.append({
            "id": user.id,
            "member_id": member.id,
            "member_name": member.name,
            "member_email": member.email,
            "member_phone": member.phone,
            "member_permission": member.permission,
            "member_title": member.title,
            "member_accessible": member.accessible,
            "user_id": member.user_id,
            "created_at": user.created_at,
            "is_admin": member.permission == "admin",
        })
    
    return result


@router.get("/admin/users/total")
def count_users(
    query: str = "",
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total user count with optional search filter (admin only)."""
    _get_admin_or_403(current_user, db)
    
    stmt = select(func.count()).select_from(User).join(Member, User.member_id == Member.id)
    
    if query.strip():
        search_term = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Member.name.like(search_term),
                Member.email.like(search_term),
                Member.phone.like(search_term),
                Member.user_id.like(search_term)
            )
        )
    
    total = db.scalar(stmt)
    return {"total": total or 0}


@router.get("/admin/users/{user_id}")
def get_user_detail(
    user_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user details (admin only)."""
    _get_admin_or_403(current_user, db)
    
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(404, "User not found")
    
    member = db.execute(
        select(Member).where(Member.id == user.member_id)
    ).scalar_one_or_none()
    
    return {
        "id": user.id,
        "member_id": member.id,
        "member_name": member.name,
        "member_email": member.email,
        "member_phone": member.phone,
        "member_permission": member.permission,
        "user_id": member.user_id,
        "created_at": user.created_at,
    }


@router.patch("/admin/users/{user_id}/admin")
def update_user_admin_status(
    user_id: int,
    body: AdminUpdateUserRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user permission status (admin only)."""
    _get_admin_or_403(current_user, db)
    
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(404, "User not found")
    
    member = user.member
    member.permission = body.permission
    db.commit()
    db.refresh(member)
    
    return {
        "id": user.id,
        "member_id": member.id,
        "member_name": member.name,
        "member_permission": member.permission,
    }


@router.patch("/admin/members/{member_id}/accessible")
def update_member_accessible(
    member_id: int,
    body: AdminUpdateAccessibleRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update member accessible status (admin only)."""
    _get_admin_or_403(current_user, db)
    
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(404, "Member not found")
    
    member.accessible = body.accessible
    db.commit()
    db.refresh(member)
    
    return {
        "id": member.id,
        "name": member.name,
        "accessible": member.accessible,
    }


@router.post("/admin/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reset user password to random temp password and send via email (admin only)."""
    _get_admin_or_403(current_user, db)
    
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(404, "User not found")
    
    member = user.member
    
    # Generate random 7-digit password
    temp_password = "".join(random.choices(string.digits, k=7))
    user.password_hash = temp_password
    db.commit()
    
    # Send email
    subject = "[Milal] Password Reset"
    body = f"""
안녕하세요,

Your account password has been reset.

User ID: {member.user_id}
Temporary Password: {temp_password}

Please log in and change your password immediately.

Best regards,
Milal Admin
    """
    
    success = _send_email(member.email, subject, body)
    
    return {
        "success": success,
        "message": "Password reset email sent" if success else "Failed to send email",
        "user_id": user_id,
    }


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password for logged-in user."""
    user = db.execute(
        select(User).where(User.member_id == current_user.id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(404, "User not found")
    
    # Verify current password
    if body.current_password != user.password_hash:
        raise HTTPException(401, "Current password is incorrect")
    
    # Hash and update new password
    user.password_hash = body.new_password
    db.commit()
    
    return {"message": "Password changed successfully"}
