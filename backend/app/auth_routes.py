"""
Auth routes: member lookup, OTP send/verify, account create, login.
"""
import logging
import os
import random
import smtplib
import string
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .database import get_db
from .models import Member, OtpCode, User, MemberChangeLog
from .schemas import UserOut, ChangePasswordRequest, AdminUpdateUserRequest, ResetPasswordRequest

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-for-jwt")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Pydantic schemas ────────────────────────────────────────────────────────

class FindMemberRequest(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None

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
    address: str | None = None

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


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
def find_member(body: FindMemberRequest, db: Session = Depends(get_db)):
    """Find a member by name + phone OR name + email."""
    if not body.phone and not body.email:
        raise HTTPException(400, "Provide phone or email")

    stmt = select(Member).where(Member.name == body.name.strip())
    if body.phone:
        stmt = stmt.where(Member.phone == body.phone.strip())
    else:
        stmt = stmt.where(Member.email == body.email.strip().lower())

    member = db.execute(stmt).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found. Please check your name and contact info.")

    # Check if account already exists
    user = db.execute(select(User).where(User.member_id == member.id)).scalar_one_or_none()
    return {
        "member_id":      member.id,
        "name":           member.name,
        "email_masked":   _mask(member.email, is_email=True),
        "phone_masked":   _mask(member.phone, is_email=False),
        "has_account":    user is not None,
    }


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
    member = db.get(Member, body.member_id)
    if not member:
        raise HTTPException(404, "Member not found")

    if body.contact_type == "email":
        contact = member.email
        if not contact:
            raise HTTPException(400, "No email on file")
    elif body.contact_type == "phone":
        contact = member.phone
        if not contact:
            raise HTTPException(400, "No phone on file")
    else:
        raise HTTPException(400, "contact_type must be 'email' or 'phone'")

    code = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    otp = OtpCode(
        member_id=member.id,
        code=code,
        contact=contact,
        expires_at=expires_at,
    )
    db.add(otp)
    db.commit()

    message = f"[Milal Community] Your verification code is: {code}\nValid for 10 minutes."
    sent = False

    if body.contact_type == "email":
        sent = _send_email(contact, "[Milal Community] Verification Code", message)
    else:
        sent = _send_sms(contact, message)

    response: dict = {"sent": sent, "expires_minutes": 10}

    # In dev mode (not actually sent), return the code so the flow can be tested
    if not sent:
        response["dev_code"] = code
        response["dev_note"] = (
            "SMTP/SMS not configured – code returned for development only. "
            "Set SMTP_HOST / SMTP_USER / SMTP_PASSWORD env vars to enable email."
        )

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

    # Sync admin status from member.permission to user.is_admin
    if member.permission == "admin":
        if not user.is_admin:
            user.is_admin = True
            db.commit()

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
        "title": member.title,
        "cell_group": member.cell_group,
        "email": member.email,
        "phone": member.phone,
    }


@router.get("/me")
async def read_users_me(current_user: Member = Depends(get_current_user)):
    return current_user

@router.patch("/me")
async def update_users_me(body: MyAccountUpdateRequest, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    changes = []
    update_data = body.dict(exclude_unset=True)

    for field, new_value in update_data.items():
        old_value = getattr(current_user, field)
        if old_value != new_value:
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
    
    if changes:
        db.add_all(changes)
        db.commit()
        db.refresh(current_user)

    return current_user


@router.get("/cell-group-members")
async def get_cell_group_members(current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all members in the same cell group as current user."""
    members = db.execute(
        select(Member).where(Member.cell_group == current_user.cell_group)
    ).scalars().all()
    return members


@router.get("/member/{member_id}")
async def get_member(member_id: int, db: Session = Depends(get_db)):
    """Get member details by ID."""
    member = db.execute(
        select(Member).where(Member.id == member_id)
    ).scalar_one_or_none()
    
    if not member:
        raise HTTPException(404, "Member not found")
    
    return member


@router.patch("/member/{member_id}")
async def update_member(member_id: int, body: MyAccountUpdateRequest, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update another member's information (must be 순장 of the same cell group)."""
    target_member = db.execute(
        select(Member).where(Member.id == member_id)
    ).scalar_one_or_none()
    
    if not target_member:
        raise HTTPException(404, "Member not found")
    
    # Check if current user is 순장 and in the same cell group
    if current_user.title != "순장" or current_user.cell_group != target_member.cell_group:
        raise HTTPException(403, "Permission denied")
    
    changes = []
    update_data = body.dict(exclude_unset=True)
    
    for field, new_value in update_data.items():
        old_value = getattr(target_member, field)
        if old_value != new_value:
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
    
    if changes:
        db.add_all(changes)
        db.commit()
        db.refresh(target_member)
    
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
    user = db.execute(
        select(User).where(User.member_id == current_user.id)
    ).scalar_one_or_none()
    return user and user.is_admin


def _get_admin_or_403(current_user: Member, db: Session) -> Member:
    """Verify current user is admin, raise 403 if not."""
    if not _is_admin(current_user, db):
        raise HTTPException(403, "Permission denied - admin access required")
    return current_user


@router.get("/admin/users")
async def list_users(
    skip: int = 0,
    limit: int = 20,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all users with pagination (admin only)."""
    _get_admin_or_403(current_user, db)
    
    # Get all users joined with members
    users = db.execute(
        select(User, Member)
        .join(Member, User.member_id == Member.id)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    
    result = []
    for user, member in users:
        result.append({
            "id": user.id,
            "member_id": member.id,
            "member_name": member.name,
            "member_email": member.email,
            "member_phone": member.phone,
            "user_id": member.user_id,
            "is_admin": user.is_admin,
            "created_at": user.created_at,
        })
    
    return result


@router.get("/admin/users/total")
async def count_users(
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total user count (admin only)."""
    _get_admin_or_403(current_user, db)
    total = db.scalar(select(func.count()).select_from(User))
    return {"total": total}


@router.get("/admin/users/{user_id}")
async def get_user_detail(
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
        "user_id": member.user_id,
        "is_admin": user.is_admin,
        "created_at": user.created_at,
    }


@router.patch("/admin/users/{user_id}/admin")
async def update_user_admin_status(
    user_id: int,
    body: AdminUpdateUserRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user admin status (admin only)."""
    _get_admin_or_403(current_user, db)
    
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    
    if not user:
        raise HTTPException(404, "User not found")
    
    user.is_admin = body.is_admin
    db.commit()
    db.refresh(user)
    
    member = user.member
    return {
        "id": user.id,
        "member_id": member.id,
        "member_name": member.name,
        "is_admin": user.is_admin,
    }


@router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(
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
async def change_password(
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
