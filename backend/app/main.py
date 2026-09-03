import asyncio
import base64
import contextlib
import json
import logging
import os
from io import BytesIO
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
import re
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pillow_heif import register_heif_opener
from sqlalchemy import and_, or_, select, text, func
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.orm.attributes import flag_modified
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

from .database import Base, SessionLocal, engine, get_db
from .models import (
    CellReport,
    CellReportMemberEntry,
    Expense,
    ExpenseAccount,
    ExpenseApprovalRoute,
    ExternalCalendarEvent,
    Member,
    OtpCode,
    Reservation,
    ReservationRule,
    ReservationStatus,
    Room,
    RoomLocation,
    User,
)
from .schemas import (
    AdminUpdateReservation,
    CellReportCreate,
    CellReportDetailOut,
    CellReportListItem,
    ExpenseCreate,
    ExpenseApprovalDecision,
    ExpenseAccountCreate,
    ExpenseAccountDetailOut,
    ExpenseAccountOut,
    ExpenseAccountUpdate,
    ExpenseApprovalRouteOut,
    ExpenseApprovalRouteUpdate,
    ExpenseOut,
    ExpenseUpdate,
    ReceiptExtractionOut,
    ReceiptExtractionRequest,
    ReservationCreate,
    ReservationOut,
    ReservationRuleCreate,
    ReservationRuleOut,
    ReservationRuleUpdate,
    RoomCreate,
    RoomOut,
    RoomUpdate,
    RoomLocationOut,
    RoomLocationCreate,
    RoomLocationUpdate,
    UserUpdateReservation,
)
from .auth_routes import router as auth_router, get_current_user, oauth2_scheme
from .ai_chat import create_ai_chat_router, get_gemini_client
from .reservation_eligibility import assess_reservation_eligibility
from .email_queue import email_queue_worker, queue_email
from .sync_tasks import maybe_sync_external_calendar_events, sync_all_members_from_ohjic

app = FastAPI(title="Milal Community API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = Path(os.getenv("FRONTEND_DIST_DIR", PROJECT_ROOT / "frontend" / "dist"))
EXPENSE_UPLOAD_DIR = Path(os.getenv("EXPENSE_UPLOAD_DIR", PROJECT_ROOT / "uploads" / "expenses"))
EXPENSE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PORTAL_BASE_URL = os.getenv("PORTAL_BASE_URL", "https://www.milalchurch.ca:83").rstrip("/")
EXPENSE_DATA_URL_PATTERN = re.compile(
    r"^data:(image/jpeg|image/png|image/gif|image/webp|image/heic|image/heif|application/pdf);base64,([A-Za-z0-9+/=\s]+)$"
)
EXPENSE_FILE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".jpg",
    "image/heif": ".jpg",
    "application/pdf": ".pdf",
}
register_heif_opener()
REMINDER_LEAD_MINUTES = 15
REMINDER_POLL_SECONDS = 60
EXPENSE_APPROVER_POSITION_CODES = (566, 567, 568)
reminder_task: asyncio.Task | None = None
email_queue_task: asyncio.Task | None = None
EASTERN_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "America/Toronto"))
scheduler: AsyncIOScheduler | None = None


def _as_utc_naive(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _as_utc_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _to_google_calendar_utc(dt: datetime | None) -> str:
    dt_utc = _as_utc_aware(dt)
    if dt_utc is None:
        return ""
    return dt_utc.strftime("%Y%m%dT%H%M%SZ")


def _build_google_calendar_link(
    title: str,
    start_time: datetime | None,
    end_time: datetime | None,
    room_name: str,
    details: str,
) -> str:
    start_utc = _to_google_calendar_utc(start_time)
    end_utc = _to_google_calendar_utc(end_time)
    if not start_utc or not end_utc:
        return ""

    params = {
        "action": "TEMPLATE",
        "text": title,
        "dates": f"{start_utc}/{end_utc}",
        "details": details,
        "location": room_name,
        "ctz": os.getenv("APP_TIMEZONE", "America/Toronto"),
    }
    return "https://calendar.google.com/calendar/render?" + urlencode(params)


def _format_eastern_time(dt: datetime | None) -> str:
    if not dt:
        return "N/A"

    if dt.tzinfo is None:
        dt_utc = dt.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt.astimezone(timezone.utc)

    dt_et = dt_utc.astimezone(EASTERN_TZ)
    return dt_et.strftime("%Y-%m-%d %H:%M %Z")


def _build_reminder_email(
    reservation: Reservation,
    room_name: str,
    reminder_kind: str,
) -> tuple[str, str]:
    if reminder_kind == "start":
        title = "시작 15분 전"
        detail = "예약 시작 15분 전입니다."
    else:
        title = "종료 15분 전"
        detail = "예약 종료 15분 전입니다."

    subject = f"[밀알교회] 예약 {title} 안내 - {room_name}"
    calendar_link = _build_google_calendar_link(
        f"{room_name} 예약",
        reservation.start_time,
        reservation.end_time,
        room_name,
        f"예약 ID #{reservation.id} / 신청자 {reservation.requester_name}",
    )
    body = f"""안녕하세요,

{detail}

【 예약 정보 】
- 예약 ID: #{reservation.id}
- 장소: {room_name}
- 신청자: {reservation.requester_name}
- 시작 시간(ET): {_format_eastern_time(reservation.start_time)}
- 종료 시간(ET): {_format_eastern_time(reservation.end_time)}
- 목적: {reservation.purpose or 'N/A'}

Google Calendar에 추가:
{calendar_link}

감사합니다.
밀알교회 교회"""
    return subject, body


def _send_due_reservation_reminders_once() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        window_end = now + timedelta(minutes=REMINDER_LEAD_MINUTES)

        stmt = (
            select(Reservation)
            .options(joinedload(Reservation.room))
            .where(
                Reservation.status.in_([
                    ReservationStatus.approved,
                    ReservationStatus.changed,
                ]),
                Reservation.created_by_admin.is_(False),
                Reservation.email.is_not(None),
                Reservation.email != "",
                Reservation.end_time > now,
                or_(
                    and_(
                        Reservation.start_reminder_sent.is_(False),
                        Reservation.start_time > now,
                        Reservation.start_time <= window_end,
                    ),
                    and_(
                        Reservation.end_reminder_sent.is_(False),
                        Reservation.end_time > now,
                        Reservation.end_time <= window_end,
                    ),
                ),
            )
        )

        reservations = db.scalars(stmt).all()
        dirty = False

        for item in reservations:
            start_time = _as_utc_naive(item.start_time)
            end_time = _as_utc_naive(item.end_time)
            room_name = item.room.name if item.room else "N/A"

            if (not item.start_reminder_sent) and now < start_time <= window_end:
                subject, body = _build_reminder_email(item, room_name, "start")
                if queue_email(db, item.email, subject, body):
                    item.start_reminder_sent = True
                    item.start_reminder_sent_at = datetime.utcnow()
                    dirty = True

            if (not item.end_reminder_sent) and now < end_time <= window_end:
                subject, body = _build_reminder_email(item, room_name, "end")
                if queue_email(db, item.email, subject, body):
                    item.end_reminder_sent = True
                    item.end_reminder_sent_at = datetime.utcnow()
                    dirty = True

        if dirty:
            db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[reservation-reminder] worker error: {exc}")
    finally:
        db.close()


async def _reservation_reminder_worker() -> None:
    while True:
        # Runs on a worker thread: this does blocking DB I/O and must not
        # stall the shared event loop that serves all other requests.
        await asyncio.to_thread(_send_due_reservation_reminders_once)
        await asyncio.sleep(REMINDER_POLL_SECONDS)


def seed_rooms(db: Session) -> None:
    existing_count = db.scalar(select(Room).limit(1))
    if existing_count:
        return

    seed_data = [
        ("Main Conference Room", 24, "Projector, WIFI, Mic/Speaker", 2),
        ("Small Meeting Room-1", 8, "Whiteboard, WIFI", 1),
        ("Small Meeting Room-2", 6, "60-inch TV, WIFI", 1),
        ("Studio", 10, "Video recording and profile shoot", 2),
        ("Practice Room", 12, "Max 2 hours reservation", 1),
        ("Medium Conference Room", 12, "80-inch TV, WIFI", 2),
        ("Lounge", 16, "Meal and rest area", 1),
    ]

    for name, capacity, desc, floor in seed_data:
        db.add(Room(name=name, capacity=capacity, description=desc, floor=floor, is_active=True))
    db.commit()


def validate_reservation_times(start_time: datetime, end_time: datetime) -> None:
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")


def get_available_rooms_query(start_time: datetime, end_time: datetime):
    reserved_room_ids = (
        select(Reservation.room_id)
        .where(
            and_(
                Reservation.status.in_(
                    [
                        ReservationStatus.pending,
                        ReservationStatus.approved,
                        ReservationStatus.changed,
                    ]
                ),
                Reservation.start_time < end_time,
                Reservation.end_time > start_time,
            )
        )
        .distinct()
    )

    return (
        select(Room)
        .where(
            Room.is_active.is_(True),
            Room.id.not_in(reserved_room_ids),
        )
        .order_by(Room.id)
    )


def serialize_expense(expense: Expense, requester_name: str) -> dict:
    account = expense.account
    return {
        "id": expense.id,
        "request_date": expense.request_date,
        "title": expense.title,
        "memo": expense.memo,
        "status": expense.status,
        "hst_amount": expense.hst_amount,
        "total_amount": expense.total_amount,
        "requester_name": requester_name,
        "account_id": expense.account_id,
        "account_code": account.account_code if account else "",
        "account_name": account.name if account else "",
        "items": expense.items,
        "attachments": expense.attachments,
        "approvals": expense.approvals,
        "created_at": expense.created_at.replace(tzinfo=timezone.utc).isoformat(),
        "updated_at": expense.updated_at.replace(tzinfo=timezone.utc).isoformat(),
    }


def save_expense_attachments(expense_id: int, request_date: date, attachments: list) -> list[dict]:
    upload_date_dir = EXPENSE_UPLOAD_DIR / request_date.isoformat()
    stored_attachments = []

    for sequence, attachment in enumerate(attachments, start=1):
        attachment_data = attachment.model_dump()
        data_url = attachment_data.pop("data_url", "")
        if not data_url:
            if attachment_data.get("url", "").startswith("/uploads/expenses/"):
                stored_attachments.append(attachment_data)
                continue
            raise HTTPException(status_code=422, detail="Each attachment must include file data.")

        data_url_match = EXPENSE_DATA_URL_PATTERN.fullmatch(data_url)
        if not data_url_match:
            raise HTTPException(status_code=422, detail="Attachments must be JPEG, PNG, GIF, WebP, HEIC, or PDF files.")

        mime_type, encoded_content = data_url_match.groups()
        try:
            file_content = base64.b64decode(encoded_content, validate=True)
        except ValueError as error:
            raise HTTPException(status_code=422, detail="Attachment file data is invalid.") from error
        if not file_content:
            raise HTTPException(status_code=422, detail="Attachment file is empty.")

        if mime_type in ("image/heic", "image/heif"):
            try:
                converted_image = Image.open(BytesIO(file_content)).convert("RGB")
                jpeg_data = BytesIO()
                converted_image.save(jpeg_data, format="JPEG", quality=92)
                file_content = jpeg_data.getvalue()
                attachment_data["type"] = "image"
            except Exception as error:
                raise HTTPException(status_code=422, detail="Unable to process the HEIC attachment.") from error

        upload_date_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{expense_id}_{sequence}{EXPENSE_FILE_EXTENSIONS[mime_type]}"
        (upload_date_dir / filename).write_bytes(file_content)
        attachment_data["url"] = f"/uploads/expenses/{request_date.isoformat()}/{filename}"
        stored_attachments.append(attachment_data)

    return stored_attachments


def send_expense_notification(
    db: Session,
    expense: Expense,
    requester: Member,
    recipients: list[Member],
    action: str,
    comment: str = "",
) -> None:
    if not any(member.email.strip() for member in recipients):
        logger.warning("Expense request %s has no notification recipients", expense.id)
        return

    item_lines = "\n".join(f"- {item['description']}: CAD {item['amount']:.2f}" for item in expense.items)
    action_label = {
        "created": "등록",
        "updated": "수정",
        "first_approved": "1차 승인",
        "first_rejected": "1차 반려",
        "second_approved": "2차 승인",
        "second_rejected": "2차 반려",
    }[action]
    subject = f"[비용처리] 비용 요청 {action_label}: {expense.title}"
    comment_line = f"\n결재 의견: {comment}\n" if comment.strip() else ""
    body = f"""비용 요청이 {action_label}되었습니다.

요청자: {requester.name}
요청일: {expense.request_date.isoformat()}
제목: {expense.title}
비용 항목:
{item_lines}
HST: CAD {expense.hst_amount:.2f}
총 비용: CAD {expense.total_amount:.2f}
메모: {expense.memo}

결재 상태: {action_label}
{comment_line}"""
    requester_url = f"{PORTAL_BASE_URL}/?{urlencode({'tab': 'expense', 'expenseId': expense.id})}"
    approval_url = f"{PORTAL_BASE_URL}/?{urlencode({'tab': 'expense-approval', 'expenseId': expense.id})}"
    sent_emails = set()
    for recipient in recipients:
        recipient_email = recipient.email.strip()
        if not recipient_email or recipient_email in sent_emails:
            continue
        sent_emails.add(recipient_email)
        is_requester = recipient.id == requester.id
        link_label = "요청 상세 보기" if is_requester else "결재하기"
        link_url = requester_url if is_requester else approval_url
        queue_email(db, recipient_email, subject, f"{body}\n{link_label}:\n{link_url}\n")


@app.on_event("startup")
async def startup() -> None:
    Base.metadata.create_all(bind=engine)
    # Migrate: add floor column if it doesn't exist yet
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE rooms ADD COLUMN floor INTEGER NOT NULL DEFAULT 1"))
            conn.commit()
        except Exception:
            pass  # Column already exists
    
    # Migrate: add is_admin column to users if it doesn't exist yet
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        except Exception:
            pass  # Column already exists

    # Migrate: add reservation_rules time-scope columns if they don't exist yet
    with engine.connect() as conn:
        migration_sql = [
            "ALTER TABLE reservation_rules ADD COLUMN applies_all_day BOOLEAN NOT NULL DEFAULT 1",
            "ALTER TABLE reservation_rules ADD COLUMN start_time TIME NULL",
            "ALTER TABLE reservation_rules ADD COLUMN end_time TIME NULL",
            "ALTER TABLE reservation_rules ADD COLUMN membership_category VARCHAR(20) NULL",
        ]
        for sql in migration_sql:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists

    # Migrate: add reservation reminder columns if they don't exist yet
    with engine.connect() as conn:
        reminder_migration_sql = [
            "ALTER TABLE reservations ADD COLUMN start_reminder_sent BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE reservations ADD COLUMN start_reminder_sent_at DATETIME NULL",
            "ALTER TABLE reservations ADD COLUMN end_reminder_sent BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE reservations ADD COLUMN end_reminder_sent_at DATETIME NULL",
        ]
        for sql in reminder_migration_sql:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists

    # Migrate: add expense fields to existing databases
    with engine.connect() as conn:
        for sql in (
            "ALTER TABLE expenses ADD COLUMN hst_amount FLOAT NOT NULL DEFAULT 0",
            "ALTER TABLE expenses ADD COLUMN account_id INTEGER NULL",
            "ALTER TABLE expense_accounts ADD COLUMN account_code VARCHAR(100) NOT NULL DEFAULT ''",
        ):
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists or expenses has not been created yet

    # Migrate: add requester_name column to external_calendar_events if it doesn't exist yet
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE external_calendar_events ADD COLUMN requester_name VARCHAR(100) NOT NULL DEFAULT ''"))
            conn.commit()
        except Exception:
            pass  # Column already exists

    # Migrate: add created_by_admin column to reservations if it doesn't exist yet
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE reservations ADD COLUMN created_by_admin BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        except Exception:
            pass  # Column already exists


    db = next(get_db())
    try:
        seed_rooms(db)
    finally:
        db.close()

    global reminder_task, scheduler
    reminder_task = asyncio.create_task(_reservation_reminder_worker())

    global email_queue_task
    email_queue_task = asyncio.create_task(email_queue_worker())
    
    # Initialize scheduler for daily member sync
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_all_members_from_ohjic,
        CronTrigger(hour=23, minute=15, timezone=EASTERN_TZ),  # 매일 밤 11시 15분(ET)에 실행
        id='sync_all_members_daily',
        name='Daily sync all members from OHJIC API',
        misfire_grace_time=900  # 15분의 오차 허용
    )
    scheduler.start()
    logger.info("✓ Scheduler started for daily member sync (23:15 ET)")
    
    # 앱 시작 시 캐시 상태 확인 (100개 이하면 즉시 동기화)
    db = next(get_db())
    try:
        member_count = db.scalar(select(func.count()).select_from(Member))
        logger.info(f"[startup] Current member cache size: {member_count}")
        
        if member_count is None or member_count <= 100:
            logger.info(f"[startup] Cache has {member_count or 0} members (≤100) - Starting initial sync from OHJIC API...")
            try:
                await sync_all_members_from_ohjic()
                logger.info("✓ [startup] Initial member sync completed successfully")
            except Exception as e:
                logger.error(f"✗ [startup] Initial member sync failed: {type(e).__name__}: {e}", exc_info=True)
        else:
            logger.info(f"[startup] Cache has {member_count} members (>100) - Skipping initial sync, using existing cache")
    finally:
        db.close()

    # 앱 시작 시 외부 캘린더 캐시를 한 번 채워둠 (첫 10분 공백 방지)
    db = next(get_db())
    try:
        maybe_sync_external_calendar_events(db)
    except Exception as e:
        logger.error(f"✗ [startup] Initial external calendar sync failed: {type(e).__name__}: {e}", exc_info=True)
    finally:
        db.close()


@app.on_event("shutdown")
async def shutdown() -> None:
    global reminder_task, scheduler, email_queue_task
    if reminder_task:
        reminder_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reminder_task
        reminder_task = None

    if email_queue_task:
        email_queue_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await email_queue_task
        email_queue_task = None
    
    if scheduler:
        scheduler.shutdown(wait=False)
        logger.info("✓ Scheduler shut down")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/rooms", response_model=list[RoomOut])
def get_rooms(db: Session = Depends(get_db)) -> list[Room]:
    rooms = db.scalars(select(Room).where(Room.is_active.is_(True)).order_by(Room.id)).all()
    return list(rooms)


# ── Expense request endpoints ──────────────────────────────────────────────
@app.post("/api/expenses/extract-receipt", response_model=ReceiptExtractionOut)
def extract_expense_receipt(
    payload: ReceiptExtractionRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    get_current_user(token, db)
    data_url = payload.file_data_url
    if not (data_url.startswith("data:image/") or data_url.startswith("data:application/pdf")) or ";base64," not in data_url:
        raise HTTPException(status_code=422, detail="An image or PDF file is required for receipt extraction.")

    try:
        encoded_image = data_url.split(",", 1)[1]
        file_bytes = base64.b64decode(encoded_image, validate=True)
        if len(file_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Receipt files must be 8 MB or smaller.")
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="The receipt file is not valid base64 data.") from exc

    receipt_images = [data_url]
    if data_url.startswith("data:application/pdf"):
        try:
            import fitz

            document = fitz.open(stream=file_bytes, filetype="pdf")
            if document.page_count == 0:
                raise ValueError("empty PDF")
            receipt_images = [
                "data:image/png;base64," + base64.b64encode(document.load_page(page_number).get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).tobytes("png")).decode("ascii")
                for page_number in range(min(document.page_count, 5))
            ]
            document.close()
        except Exception as exc:
            logger.warning("Unable to render receipt PDF: %s", exc)
            raise HTTPException(status_code=422, detail="Unable to read this receipt PDF.") from exc

    client, error_payload = get_gemini_client()
    if error_payload:
        raise HTTPException(status_code=503, detail=error_payload["message"])

    try:
        response = client.chat.completions.create(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract expense line items from a receipt image. Return JSON only with this exact shape: "
                        "{\"items\":[{\"description\":string,\"amount\":number}],\"hst_amount\":number}. "
                        "Use the printed currency values. Exclude HST/tax from items and put its value in hst_amount. "
                        "If no tax is shown, use 0. Do not invent unreadable items or amounts."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Read this receipt and extract its expense items."},
                        *[{"type": "image_url", "image_url": {"url": image_url}} for image_url in receipt_images],
                    ],
                },
            ],
        )
        content = (response.choices[0].message.content or "").strip()
        result = json.loads(content)
        items = [
            {"description": str(item["description"]).strip(), "amount": float(item["amount"])}
            for item in result.get("items", [])
            if str(item.get("description", "")).strip() and float(item.get("amount", 0)) > 0
        ]
        return {"items": items, "hst_amount": max(0, float(result.get("hst_amount", 0)))}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Receipt extraction returned an invalid Gemini response: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to read expense items from this receipt image.") from exc
    except Exception as exc:
        if getattr(exc, "status_code", None) in (400, 401):
            logger.warning("Gemini receipt extraction authentication failed")
            raise HTTPException(
                status_code=503,
                detail="Gemini receipt extraction is not configured with a valid API key.",
            ) from exc
        logger.exception("Receipt extraction failed")
        raise HTTPException(status_code=502, detail="Receipt extraction is temporarily unavailable. Please try again.") from exc


@app.get("/api/expenses", response_model=list[ExpenseOut])
def get_expenses(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    current_user = get_current_user(token, db)
    stmt = select(Expense).order_by(Expense.request_date.desc(), Expense.id.desc())
    if current_user.permission != "admin":
        stmt = stmt.where(Expense.requester_member_id == current_user.id)
    expenses = db.scalars(stmt).all()
    requester_ids = {expense.requester_member_id for expense in expenses}
    requester_names = {member.id: member.name for member in db.scalars(select(Member).where(Member.id.in_(requester_ids))).all()} if requester_ids else {}
    return [serialize_expense(expense, requester_names.get(expense.requester_member_id, "")) for expense in expenses]


@app.get("/api/expenses/approvers")
def get_expense_approvers(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    get_current_user(token, db)
    approvers = db.scalars(
        select(Member)
        .where(Member.position_code.in_(EXPENSE_APPROVER_POSITION_CODES))
        .order_by(Member.name, Member.id)
    ).all()
    return [
        {"id": approver.id, "name": approver.name, "title": approver.title, "position_code": approver.position_code}
        for approver in approvers
    ]


def get_expense_account_approvers(account_id: int, db: Session) -> tuple[ExpenseAccount, Member, Member]:
    account = get_expense_account_or_422(account_id, db)
    route = db.scalar(select(ExpenseApprovalRoute).where(ExpenseApprovalRoute.account_id == account.id))
    if not route:
        raise HTTPException(status_code=422, detail="The selected expense account has no approval route.")
    approver_ids = {route.chairperson_member_id, route.finance_elder_member_id}
    approvers = db.scalars(
        select(Member).where(Member.id.in_(approver_ids), Member.position_code.in_(EXPENSE_APPROVER_POSITION_CODES))
    ).all()
    approver_map = {approver.id: approver for approver in approvers}
    if any(approver_id not in approver_map for approver_id in approver_ids):
        raise HTTPException(status_code=422, detail="Approvers must have position code 566, 567, or 568.")
    return account, approver_map[route.chairperson_member_id], approver_map[route.finance_elder_member_id]


def get_current_expense_approval(expense: Expense) -> tuple[int, dict] | None:
    for index, approval in enumerate(expense.approvals):
        if approval.get("state") == "current":
            return index, approval
    return None


def get_expense_account_or_422(account_id: int | None, db: Session) -> ExpenseAccount:
    account = db.get(ExpenseAccount, account_id) if account_id else None
    if not account:
        raise HTTPException(status_code=422, detail="A valid expense account must be selected.")
    return account


def serialize_expense_approval_route(route: ExpenseApprovalRoute, account: ExpenseAccount, members: dict[int, Member]) -> dict:
    chairperson = members.get(route.chairperson_member_id)
    finance_elder = members.get(route.finance_elder_member_id)
    return {
        "id": route.id,
        "account_id": route.account_id,
        "account_code": account.account_code,
        "account_name": account.name,
        "department_name": account.name,
        "chairperson_member_id": route.chairperson_member_id,
        "finance_elder_member_id": route.finance_elder_member_id,
        "chairperson_name": chairperson.name if chairperson else "",
        "finance_elder_name": finance_elder.name if finance_elder else "",
        "created_at": route.created_at,
        "updated_at": route.updated_at,
    }


def serialize_expense_account(account: ExpenseAccount, approved_amount: float) -> dict:
    return {
        "id": account.id,
        "account_code": account.account_code,
        "name": account.name,
        "year": account.year,
        "budget_amount": account.budget_amount,
        "approved_amount": approved_amount,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


def require_expense_approver(member: Member) -> None:
    if member.position_code not in EXPENSE_APPROVER_POSITION_CODES:
        raise HTTPException(status_code=403, detail="Only members with position code 566, 567, or 568 can approve expense requests.")


def can_approve_expense(expense: Expense, member_id: int) -> bool:
    current_approval = get_current_expense_approval(expense)
    return bool(current_approval and current_approval[1].get("member_id") == member_id)


def can_view_expense_approval(expense: Expense, member_id: int) -> bool:
    return any(approval.get("member_id") == member_id for approval in expense.approvals)


@app.get("/api/expense-approvals/summary")
def get_expense_approval_summary(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    is_approver = current_user.position_code in EXPENSE_APPROVER_POSITION_CODES or current_user.permission == "admin"
    if not is_approver:
        return {"is_approver": False, "pending_count": 0}

    candidates = db.scalars(select(Expense).where(Expense.status.in_(("reviewing", "approved")))).all()
    return {
        "is_approver": True,
        "pending_count": sum(can_approve_expense(expense, current_user.id) for expense in candidates),
    }


@app.get("/api/expense-approvals", response_model=list[ExpenseOut])
def get_expense_approvals(
    status: str | None = Query(default=None),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    current_user = get_current_user(token, db)
    is_admin = current_user.permission == "admin"
    if not is_admin:
        require_expense_approver(current_user)
    candidates = db.scalars(
        select(Expense)
        .where(Expense.status.in_(("reviewing", "approved", "rejected", "paid")))
        .order_by(Expense.request_date.desc(), Expense.id.desc())
    ).all()
    approval_expenses = candidates if is_admin else [expense for expense in candidates if can_view_expense_approval(expense, current_user.id)]
    if status:
        approval_expenses = [expense for expense in approval_expenses if expense.status == status]

    requester_ids = {expense.requester_member_id for expense in approval_expenses}
    requesters = db.scalars(select(Member).where(Member.id.in_(requester_ids))).all() if requester_ids else []
    requester_names = {requester.id: requester.name for requester in requesters}
    return [serialize_expense(expense, requester_names.get(expense.requester_member_id, "")) for expense in approval_expenses]


@app.get("/api/expense-approvals/{expense_id}", response_model=ExpenseOut)
def get_expense_approval_detail(
    expense_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    is_admin = current_user.permission == "admin"
    if not is_admin:
        require_expense_approver(current_user)
    expense = db.get(Expense, expense_id)
    if not expense or (not is_admin and not can_view_expense_approval(expense, current_user.id)):
        raise HTTPException(status_code=404, detail="expense approval request not found")
    requester = db.get(Member, expense.requester_member_id)
    return serialize_expense(expense, requester.name if requester else "")


@app.post("/api/expense-approvals/{expense_id}/decision", response_model=ExpenseOut)
def decide_expense_approval(
    expense_id: int,
    payload: ExpenseApprovalDecision,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    require_expense_approver(current_user)
    expense = db.get(Expense, expense_id)
    current_approval = get_current_expense_approval(expense) if expense else None
    if not expense or not current_approval or current_approval[1].get("member_id") != current_user.id:
        raise HTTPException(status_code=409, detail="This expense request is not awaiting your approval.")

    approvals = [dict(approval) for approval in expense.approvals]
    approval_index = next(index for index, approval in enumerate(approvals) if approval.get("state") == "current")
    if payload.account_id:
        expense.account_id = get_expense_account_or_422(payload.account_id, db).id
    if approval_index == 1 and payload.action == "approve" and payload.second_approver_member_id:
        second_approver = db.get(Member, payload.second_approver_member_id)
        if not second_approver or second_approver.position_code not in EXPENSE_APPROVER_POSITION_CODES:
            raise HTTPException(status_code=422, detail="Second approver must have position code 566, 567, or 568.")
        approvals[2]["member_id"] = second_approver.id
        approvals[2]["name"] = second_approver.name
    approval = approvals[approval_index]
    approval["state"] = "done" if payload.action == "approve" else "rejected"
    approval["date"] = datetime.now(EASTERN_TZ).isoformat()
    approval["comment"] = payload.comment.strip()
    if payload.action == "reject":
        expense.status = "rejected"
    elif approval_index == len(expense.approvals) - 1:
        expense.status = "paid"
    else:
        expense.status = "approved"
        approvals[approval_index + 1]["state"] = "current"
    expense.approvals = approvals
    flag_modified(expense, "approvals")
    db.commit()
    db.refresh(expense)
    requester = db.get(Member, expense.requester_member_id)
    decision_comment = payload.comment.strip()
    if approval_index == 1 and requester:
        if payload.action == "approve":
            second_approver = db.get(Member, approvals[2]["member_id"])
            if second_approver:
                send_expense_notification(db, expense, requester, [requester, second_approver], "first_approved", decision_comment)
        else:
            send_expense_notification(db, expense, requester, [requester], "first_rejected", decision_comment)
    elif approval_index == len(approvals) - 1 and requester:
        if payload.action == "approve":
            send_expense_notification(db, expense, requester, [requester], "second_approved", decision_comment)
        else:
            send_expense_notification(db, expense, requester, [requester], "second_rejected", decision_comment)
    return serialize_expense(expense, requester.name if requester else "")


@app.get("/api/expense-accounts", response_model=list[ExpenseAccountOut])
def get_expense_accounts(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> list[dict]:
    require_expense_approver(get_current_user(token, db))
    accounts = db.scalars(select(ExpenseAccount).order_by(ExpenseAccount.year.desc(), ExpenseAccount.name)).all()
    totals = dict(db.execute(select(Expense.account_id, func.coalesce(func.sum(Expense.total_amount), 0)).where(Expense.status == "paid", Expense.account_id.is_not(None)).group_by(Expense.account_id)).all())
    return [serialize_expense_account(account, totals.get(account.id, 0)) for account in accounts]


@app.get("/api/expense-approval-routes", response_model=list[ExpenseApprovalRouteOut])
def get_expense_approval_routes(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> list[dict]:
    get_current_user(token, db)
    routes = db.scalars(select(ExpenseApprovalRoute).order_by(ExpenseApprovalRoute.account_id)).all()
    accounts = {account.id: account for account in db.scalars(select(ExpenseAccount).where(ExpenseAccount.id.in_({route.account_id for route in routes}))).all()} if routes else {}
    member_ids = {member_id for route in routes for member_id in (route.chairperson_member_id, route.finance_elder_member_id)}
    members = {member.id: member for member in db.scalars(select(Member).where(Member.id.in_(member_ids))).all()} if member_ids else {}
    return [serialize_expense_approval_route(route, accounts[route.account_id], members) for route in routes if route.account_id in accounts]


@app.put("/api/expense-accounts/{account_id}/approval-route", response_model=ExpenseApprovalRouteOut)
def save_expense_approval_route(account_id: int, payload: ExpenseApprovalRouteUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="department not found")
    approvers = {member.id: member for member in db.scalars(select(Member).where(Member.id.in_((payload.chairperson_member_id, payload.finance_elder_member_id)))).all()}
    if len(approvers) != 2 or any(member.position_code not in EXPENSE_APPROVER_POSITION_CODES for member in approvers.values()):
        raise HTTPException(status_code=422, detail="Chairperson and finance elder must be eligible expense approvers.")
    route = db.scalar(select(ExpenseApprovalRoute).where(ExpenseApprovalRoute.account_id == account_id))
    if route:
        route.chairperson_member_id = payload.chairperson_member_id
        route.finance_elder_member_id = payload.finance_elder_member_id
    else:
        route = ExpenseApprovalRoute(account_id=account_id, **payload.model_dump())
        db.add(route)
    db.commit()
    db.refresh(route)
    return serialize_expense_approval_route(route, account, approvers)


@app.post("/api/expense-accounts", response_model=ExpenseAccountOut, status_code=201)
def create_expense_account(payload: ExpenseAccountCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account_code = payload.account_code.strip()
    if db.scalar(select(ExpenseAccount).where(ExpenseAccount.account_code == account_code)):
        raise HTTPException(status_code=409, detail="An expense account with this code already exists.")
    account = ExpenseAccount(**{**payload.model_dump(), "account_code": account_code})
    db.add(account)
    db.commit()
    db.refresh(account)
    return serialize_expense_account(account, 0)


@app.patch("/api/expense-accounts/{account_id}", response_model=ExpenseAccountOut)
def update_expense_account(account_id: int, payload: ExpenseAccountUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="expense account not found")
    account_code = payload.account_code.strip()
    duplicate = db.scalar(select(ExpenseAccount).where(ExpenseAccount.account_code == account_code, ExpenseAccount.id != account_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="An expense account with this code already exists.")
    for field, value in {**payload.model_dump(), "account_code": account_code}.items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    approved_amount = db.scalar(select(func.coalesce(func.sum(Expense.total_amount), 0)).where(Expense.status == "paid", Expense.account_id == account.id))
    return serialize_expense_account(account, approved_amount or 0)


@app.delete("/api/expense-accounts/{account_id}", status_code=204)
def delete_expense_account(account_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> None:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="department not found")
    if db.scalar(select(func.count()).select_from(Expense).where(Expense.account_id == account_id)):
        raise HTTPException(status_code=409, detail="Departments assigned to expense requests cannot be deleted.")
    db.delete(account)
    db.commit()


@app.get("/api/expense-accounts/{account_id}", response_model=ExpenseAccountDetailOut)
def get_expense_account(account_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="expense account not found")
    expenses = db.scalars(select(Expense).where(Expense.status == "paid", Expense.account_id == account.id).order_by(Expense.request_date.desc(), Expense.id.desc())).all()
    requesters = {member.id: member.name for member in db.scalars(select(Member).where(Member.id.in_({expense.requester_member_id for expense in expenses}))).all()} if expenses else {}
    detail = serialize_expense_account(account, sum(expense.total_amount for expense in expenses))
    detail["expenses"] = []
    for expense in expenses:
        serialized_expense = serialize_expense(expense, requesters.get(expense.requester_member_id, ""))
        detail["expenses"].append(serialized_expense)
    return detail


@app.get("/api/expenses/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    expense = db.get(Expense, expense_id)
    if not expense or expense.requester_member_id != current_user.id:
        raise HTTPException(status_code=404, detail="expense request not found")
    return serialize_expense(expense, current_user.name)


@app.post("/api/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(
    payload: ExpenseCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    account, first_approver, second_approver = get_expense_account_approvers(payload.account_id, db)
    total_amount = sum(item.amount for item in payload.items) + payload.hst_amount
    first_approval_is_automatic = current_user.id == first_approver.id
    approval_time = datetime.now(EASTERN_TZ).isoformat()
    requester_approval = {
        "role": "Requester",
        "roleKo": "요청자",
        "name": current_user.name,
        "date": "",
        "state": "done",
    }
    approvals = [
        requester_approval,
        {"role": "First Approver", "roleKo": "1차 결재자", "member_id": first_approver.id, "name": first_approver.name, "date": approval_time if first_approval_is_automatic else "", "state": "done" if first_approval_is_automatic else "current"},
        {"role": "Second Approver", "roleKo": "2차 결재자", "member_id": second_approver.id, "name": second_approver.name, "date": "", "state": "current" if first_approval_is_automatic else "waiting"},
    ]
    expense = Expense(
        requester_member_id=current_user.id,
        account_id=account.id,
        request_date=payload.request_date,
        title=payload.title,
        memo=payload.memo,
        hst_amount=payload.hst_amount,
        total_amount=total_amount,
        items=[item.model_dump() for item in payload.items],
        attachments=[],
        approvals=approvals,
        status="approved" if first_approval_is_automatic else "reviewing",
    )
    db.add(expense)
    db.flush()
    expense.approvals[0]["date"] = approval_time
    flag_modified(expense, "approvals")
    expense.attachments = save_expense_attachments(expense.id, payload.request_date, payload.attachments)
    db.commit()
    db.refresh(expense)
    if first_approval_is_automatic:
        send_expense_notification(db, expense, current_user, [current_user, second_approver], "first_approved")
    else:
        send_expense_notification(db, expense, current_user, [first_approver], "created")
    return serialize_expense(expense, current_user.name)


@app.patch("/api/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    expense = db.get(Expense, expense_id)
    if not expense or expense.requester_member_id != current_user.id:
        raise HTTPException(status_code=404, detail="expense request not found")
    if expense.status != "reviewing":
        raise HTTPException(status_code=409, detail="Expense requests cannot be edited after chairperson approval.")
    account, first_approver, second_approver = get_expense_account_approvers(payload.account_id, db)

    expense.request_date = payload.request_date
    expense.title = payload.title
    expense.memo = payload.memo
    expense.account_id = account.id
    expense.hst_amount = payload.hst_amount
    expense.total_amount = sum(item.amount for item in payload.items) + payload.hst_amount
    expense.items = [item.model_dump() for item in payload.items]
    expense.attachments = save_expense_attachments(expense.id, payload.request_date, payload.attachments)
    requester_approval = expense.approvals[0] if expense.approvals else {}
    requester_approval.update({"name": current_user.name, "state": "done"})
    expense.approvals = [
        requester_approval,
        {"role": "First Approver", "roleKo": "1차 결재자", "member_id": first_approver.id, "name": first_approver.name, "date": "", "state": "current"},
        {"role": "Second Approver", "roleKo": "2차 결재자", "member_id": second_approver.id, "name": second_approver.name, "date": "", "state": "waiting"},
    ]
    db.commit()
    db.refresh(expense)
    send_expense_notification(db, expense, current_user, [first_approver], "updated")
    return serialize_expense(expense, current_user.name)


@app.post("/api/expenses/{expense_id}/cancel", response_model=ExpenseOut)
def cancel_expense(
    expense_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    expense = db.get(Expense, expense_id)
    if not expense or expense.requester_member_id != current_user.id:
        raise HTTPException(status_code=404, detail="expense request not found")
    if expense.status != "reviewing":
        raise HTTPException(status_code=409, detail="Expense requests cannot be cancelled after approval has started.")

    expense.status = "cancelled"
    db.commit()
    db.refresh(expense)
    return serialize_expense(expense, current_user.name)


@app.get("/api/rooms/rules", response_model=list[ReservationRuleOut])
def get_public_room_rules(db: Session = Depends(get_db)) -> list[ReservationRule]:
    """Public read-only rule list for client-side calendar disabling."""
    return db.scalars(select(ReservationRule).order_by(ReservationRule.room_id, ReservationRule.id)).all()


@app.get("/api/rooms/available", response_model=list[RoomOut])
def get_available_rooms(
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    db: Session = Depends(get_db),
) -> list[Room]:
    validate_reservation_times(start_time, end_time)
    rooms = db.scalars(get_available_rooms_query(start_time, end_time)).all()
    return list(rooms)


@app.get("/api/admin/rooms", response_model=list[RoomOut])
def get_rooms_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[Room]:
    get_current_user(token, db)  # Verify JWT token
    rooms = db.scalars(select(Room).order_by(Room.id)).all()
    return list(rooms)


@app.post("/api/admin/rooms", response_model=RoomOut)
def create_room_admin(
    payload: RoomCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Room:
    get_current_user(token, db)  # Verify JWT token

    exists = db.scalar(select(Room).where(Room.name == payload.name).limit(1))
    if exists:
        raise HTTPException(status_code=409, detail="room name already exists")

    room = Room(
        name=payload.name,
        capacity=payload.capacity,
        description=payload.description,
        floor=payload.floor,
        is_active=payload.is_active,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@app.patch("/api/admin/rooms/{room_id}", response_model=RoomOut)
def update_room_admin(
    room_id: int,
    payload: RoomUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Room:
    get_current_user(token, db)  # Verify JWT token

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    if payload.name is not None and payload.name != room.name:
        duplicated = db.scalar(select(Room).where(Room.name == payload.name).limit(1))
        if duplicated:
            raise HTTPException(status_code=409, detail="room name already exists")
        room.name = payload.name

    if payload.capacity is not None:
        room.capacity = payload.capacity
    if payload.description is not None:
        room.description = payload.description
    if payload.floor is not None:
        room.floor = payload.floor
    if payload.is_active is not None:
        room.is_active = payload.is_active

    db.commit()
    db.refresh(room)
    return room


@app.delete("/api/admin/rooms/{room_id}")
def deactivate_room_admin(
    room_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    get_current_user(token, db)  # Verify JWT token

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    room.is_active = False
    db.commit()
    return {"message": "room deactivated"}


# ── Reservation Rule Endpoints ─────────────────────────────────────────────

@app.get("/api/admin/rooms/{room_id}/rules", response_model=list[ReservationRuleOut])
def get_room_rules(
    room_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[ReservationRule]:
    get_current_user(token, db)  # Verify JWT token

    rules = db.scalars(
        select(ReservationRule).where(ReservationRule.room_id == room_id)
    ).all()
    return rules


@app.post("/api/admin/rooms/{room_id}/rules", response_model=ReservationRuleOut)
def create_room_rule(
    room_id: int,
    payload: ReservationRuleCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> ReservationRule:
    get_current_user(token, db)  # Verify JWT token

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    rule = ReservationRule(
        room_id=room_id,
        rule_type=payload.rule_type,
        day_of_week=payload.day_of_week,
        specific_date=payload.specific_date,
        membership_category=payload.membership_category,
        applies_all_day=payload.applies_all_day,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_allowed=payload.is_allowed,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@app.patch("/api/admin/rooms/{room_id}/rules/{rule_id}", response_model=ReservationRuleOut)
def update_room_rule(
    room_id: int,
    rule_id: int,
    payload: ReservationRuleUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> ReservationRule:
    get_current_user(token, db)  # Verify JWT token

    rule = db.get(ReservationRule, rule_id)
    if not rule or rule.room_id != room_id:
        raise HTTPException(status_code=404, detail="rule not found")

    if payload.is_allowed is not None:
        rule.is_allowed = payload.is_allowed

    db.commit()
    db.refresh(rule)
    return rule


@app.delete("/api/admin/rooms/{room_id}/rules/{rule_id}")
def delete_room_rule(
    room_id: int,
    rule_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    get_current_user(token, db)  # Verify JWT token

    rule = db.get(ReservationRule, rule_id)
    if not rule or rule.room_id != room_id:
        raise HTTPException(status_code=404, detail="rule not found")

    db.delete(rule)
    db.commit()
    return {"message": "rule deleted"}


# ── Room Location Endpoints ────────────────────────────────────────────────

@app.post("/api/admin/rooms/{room_id}/location", response_model=RoomLocationOut)
def save_room_location(
    room_id: int,
    payload: RoomLocationUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> RoomLocation:
    """Save or update room location coordinates"""
    get_current_user(token, db)  # Verify JWT token

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    location = db.scalar(select(RoomLocation).where(RoomLocation.room_id == room_id))
    
    if location:
        location.x1 = payload.x1
        location.y1 = payload.y1
        location.x2 = payload.x2
        location.y2 = payload.y2
    else:
        location = RoomLocation(
            room_id=room_id,
            x1=payload.x1,
            y1=payload.y1,
            x2=payload.x2,
            y2=payload.y2,
        )
        db.add(location)

    db.commit()
    db.refresh(location)
    return location


@app.get("/api/admin/rooms/{room_id}/location", response_model=RoomLocationOut | None)
def get_room_location(
    room_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> RoomLocation | None:
    """Get room location coordinates"""
    get_current_user(token, db)  # Verify JWT token

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    location = db.scalar(select(RoomLocation).where(RoomLocation.room_id == room_id))
    return location


@app.get("/api/admin/rooms/locations/all")
def get_all_room_locations(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Get all room locations"""
    get_current_user(token, db)  # Verify JWT token

    locations = db.scalars(select(RoomLocation)).all()
    return [
        {
            "room_id": loc.room_id,
            "x1": loc.x1,
            "y1": loc.y1,
            "x2": loc.x2,
            "y2": loc.y2,
        }
        for loc in locations
    ]


@app.delete("/api/admin/rooms/{room_id}/location")
def delete_room_location(
    room_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete room location"""
    get_current_user(token, db)  # Verify JWT token

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    location = db.scalar(select(RoomLocation).where(RoomLocation.room_id == room_id))
    if location:
        db.delete(location)
        db.commit()

    return {"message": "room location deleted"}


# ── Reservation Rule Validation ────────────────────────────────────────────

def _matches_rule_selector(rule: ReservationRule, target_start: datetime) -> bool:
    if rule.rule_type.value == "specific_date":
        return bool(rule.specific_date and rule.specific_date == target_start.date())
    if rule.rule_type.value == "day_of_week":
        return rule.day_of_week is not None and rule.day_of_week == target_start.weekday()
    return False


def _time_ranges_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    return start_a < end_b and end_a > start_b


def _matches_rule_time_scope(rule: ReservationRule, reservation_start: datetime, reservation_end: datetime) -> bool:
    if rule.applies_all_day:
        return True

    if not rule.start_time or not rule.end_time:
        return False

    reservation_start_time = reservation_start.time()
    reservation_end_time = reservation_end.time()
    return _time_ranges_overlap(
        reservation_start_time,
        reservation_end_time,
        rule.start_time,
        rule.end_time,
    )


def _matches_rule_target(rule: ReservationRule, membership_category: str) -> bool:
    if rule.membership_category is None:
        return True
    return rule.membership_category.value == membership_category


def can_reserve_room(
    room_id: int,
    start_time: datetime,
    end_time: datetime,
    membership_category: str,
    db: Session,
) -> tuple[bool, str]:
    """
    Check if user can reserve the room based on rules.
    규칙 매칭 결과: 금지 우선, 금지 없고 허용이 있으면 허용, 매칭 규칙이 없으면 기본 허용.
    
    Returns: (can_reserve: bool, error_message: str)
    """
    print(
        f"[can_reserve_room] room_id={room_id}, start={start_time}, end={end_time}, "
        f"membership_category={membership_category}"
    )

    return assess_reservation_eligibility(
        db=db,
        room_id=room_id,
        start_time=start_time,
        end_time=end_time,
        membership_category=membership_category,
    )


@app.post("/api/reservations", response_model=dict)
def create_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(None),
) -> dict:
    """
    Create reservation(s). 
    - Regular users: create pending reservation
    - Admin users: create auto-approved reservation(s) with optional repeat
    """
    # Extract token from Authorization header
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    
    validate_reservation_times(payload.start_time, payload.end_time)

    room = db.get(Room, payload.room_id)
    if not room or not room.is_active:
        raise HTTPException(status_code=404, detail="room not found")
    
    # Check if requester is admin
    is_admin = payload.permission == "admin"

    # For all users (admin and non-admin), check reservation rules
    try:
        current_user = get_current_user(token, db) if token else None
        membership_category = "adult"  # default

        print(f"[create_reservation] is_admin={is_admin}, token: {token}, current_user: {current_user}")

        if current_user:
            user = db.scalar(select(User).where(User.member_id == current_user.id))
            if user:
                # 멤버의 group_category_name을 기준으로 membership_category 결정
                # '장년부'이면 adult, 나머지는 youth
                if current_user.group_category_name.strip() == "장년부":
                    membership_category = "adult"
                else:
                    membership_category = "youth"
            print(f"[create_reservation] user: {user}, membership_category: {membership_category}")
        else:
            print(f"[create_reservation] No current_user, using default membership_category: {membership_category}")
        
        # Check if user can reserve (applies to all users including admin)
        can_reserve, error_msg = can_reserve_room(
            payload.room_id,
            payload.start_time,
            payload.end_time,
            membership_category,
            db,
        )
        print(f"[create_reservation] can_reserve: {can_reserve}, error_msg: {error_msg}")
        if not can_reserve:
            raise HTTPException(status_code=403, detail=error_msg)
    except HTTPException:
        raise
    except Exception as e:
        # Log the error and re-raise to see what's happening
        print(f"[create_reservation] ERROR in rule checking: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
    
    # print out payload for debugging
    print("Creating reservation with payload:", payload.dict())

    # Validate repeat settings (only for admin)
    if not is_admin:
        payload.repeat_type = "none"
        payload.repeat_count = 1
    
    # Create reservation(s)
    reservations = []
    parent_reservation_id = None
    
    for i in range(payload.repeat_count):
        # Calculate time for this instance
        if payload.repeat_type == "weekly":
            current_start = payload.start_time + timedelta(weeks=i)
            current_end = payload.end_time + timedelta(weeks=i)
        elif payload.repeat_type == "monthly":
            # Add months (approximate: 30 days per month)
            current_start = payload.start_time + timedelta(days=30 * i)
            current_end = payload.end_time + timedelta(days=30 * i)
        else:
            current_start = payload.start_time
            current_end = payload.end_time

        # For repeat reservations, also check rules for each instance
        can_reserve, error_msg = can_reserve_room(
            payload.room_id,
            current_start,
            current_end,
            membership_category,
            db,
        )
        print(f"[create_reservation] repeat #{i+1} can_reserve: {can_reserve}, error_msg: {error_msg}")
        if not can_reserve:
            raise HTTPException(status_code=403, detail=f"repeat #{i+1}: {error_msg}")

        # Check for conflicts
        overlapping = db.scalar(
            select(Reservation)
            .where(
                and_(
                    Reservation.room_id == payload.room_id,
                    Reservation.status.in_([
                        ReservationStatus.pending,
                        ReservationStatus.approved,
                        ReservationStatus.changed,
                    ]),
                    Reservation.start_time < current_end,
                    Reservation.end_time > current_start,
                )
            )
            .limit(1)
        )
        if overlapping:
            raise HTTPException(status_code=409, detail=f"time slot conflicts with an existing reservation (repeat #{i+1})")

        # Create reservation
        new_item = Reservation(
            room_id=payload.room_id,
            requester_name=payload.requester_name,
            phone=payload.phone,
            email=payload.email,
            purpose=payload.purpose,
            attendees=payload.attendees,
            notes=payload.notes,
            start_time=current_start,
            end_time=current_end,
            status=ReservationStatus.approved if is_admin else ReservationStatus.pending,
            repeat_type=payload.repeat_type,
            repeat_count=payload.repeat_count,
            parent_reservation_id=parent_reservation_id,
            created_by_admin=is_admin,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)

        # Set parent_reservation_id for first instance
        if i == 0:
            parent_reservation_id = new_item.id

        reservations.append(new_item)

    # Send email with repeat info
    email_subject = f"[예약 알림] {room.name} - {payload.requester_name}"
    if payload.repeat_count > 1:
        repeat_info = f"(매{'' if payload.repeat_type == 'weekly' else '달'} {payload.repeat_count}회 반복)"
        email_subject += f" {repeat_info}"
    
    email_body = f"""
    새로운 예약이 접수되었습니다.
    
    예약자: {payload.requester_name}
    연락처: {payload.phone}
    이메일: {payload.email}
    장소: {room.name}
    목적: {payload.purpose}
    참석인원: {payload.attendees}
    예약 시간(ET): {_format_eastern_time(reservations[0].start_time)} - {_format_eastern_time(reservations[0].end_time)}
    메모: {payload.notes}
    """

    calendar_link = _build_google_calendar_link(
        f"{room.name} 예약",
        reservations[0].start_time,
        reservations[0].end_time,
        room.name,
        f"예약자: {payload.requester_name}\n예약 목적: {payload.purpose}",
    )
    
    if payload.repeat_count > 1:
        repeat_type_kr = "매주" if payload.repeat_type == "weekly" else "매달"
        email_body += f"\n반복 예약: {repeat_type_kr} {payload.repeat_count}회\n"
        for idx, res in enumerate(reservations, 1):
            email_body += f"  {idx}. {_format_eastern_time(res.start_time)} - {_format_eastern_time(res.end_time)}\n"
    
    if is_admin:
        email_body += "\n[자동승인] 관리자 예약으로 자동승인되었습니다."
    else:
        email_body += "\n[대기중] 예약이 승인 대기 중입니다."

    if calendar_link:
        email_body += f"\n\nGoogle Calendar에 추가:\n{calendar_link}\n"

    # Send email to requester (skip for admin-created reservations — no
    # completion notice needed since the admin already knows it's approved).
    if not is_admin:
        queue_email(db, payload.email, email_subject, email_body)
    
    # Send notification email to admins (skip for admin-created reservations
    # — the admin who just booked it doesn't need a notice about it).
    admins = [] if is_admin else db.scalars(
        select(Member).where(
            Member.permission == "admin",
            Member.email != "",
        )
    ).all()
    
    if admins:
        admin_email_subject = f"[관리자 알림] {room.name} - 새로운 예약 신청"
        admin_email_body = f"""
새로운 예약이 신청되었습니다.

예약자: {payload.requester_name}
연락처: {payload.phone}
이메일: {payload.email}
장소: {room.name}
목적: {payload.purpose}
참석인원: {payload.attendees}
예약 시간(ET): {_format_eastern_time(reservations[0].start_time)} - {_format_eastern_time(reservations[0].end_time)}
메모: {payload.notes}
상태: {'자동승인 (관리자 예약)' if is_admin else '승인 대기중'}
"""
        
        if payload.repeat_count > 1:
            repeat_type_kr = "매주" if payload.repeat_type == "weekly" else "매달"
            admin_email_body += f"\n반복 예약: {repeat_type_kr} {payload.repeat_count}회\n"
            for idx, res in enumerate(reservations, 1):
                admin_email_body += f"  {idx}. {_format_eastern_time(res.start_time)} - {_format_eastern_time(res.end_time)}\n"
        
        for admin in admins:
            queue_email(db, admin.email, admin_email_subject, admin_email_body)

    return {
        "message": "reservation created successfully",
        "reservation_count": len(reservations),
        "is_approved": is_admin,
        "repeat_info": {
            "type": payload.repeat_type,
            "count": payload.repeat_count,
        } if payload.repeat_count > 1 else None,
    }


@app.get("/api/reservations", response_model=list[ReservationOut])
def list_reservations(
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ReservationOut]:
    stmt = select(Reservation).options(joinedload(Reservation.room)).order_by(Reservation.start_time.asc())

    if from_date:
        stmt = stmt.where(Reservation.end_time >= from_date)
    if to_date:
        stmt = stmt.where(Reservation.start_time <= to_date)

    items = db.scalars(stmt).all()

    return [
        ReservationOut(
            id=item.id,
            room_id=item.room_id,
            room_name=item.room.name if item.room else "Unknown",
            requester_name=item.requester_name,
            phone=item.phone,
            email=item.email,
            purpose=item.purpose,
            attendees=item.attendees,
            notes=item.notes,
            start_time=_as_utc_aware(item.start_time),
            end_time=_as_utc_aware(item.end_time),
            status=item.status.value,
            admin_comment=item.admin_comment,
            repeat_type=item.repeat_type,
            repeat_count=item.repeat_count,
            parent_reservation_id=item.parent_reservation_id,
            created_at=_as_utc_aware(item.created_at),
            updated_at=_as_utc_aware(item.updated_at),
        )
        for item in items
    ]


@app.get("/api/calendar/external-events")
def get_external_calendar_events(
    background_tasks: BackgroundTasks,
    start: datetime = Query(...),
    end: datetime = Query(...),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Room bookings tagged "장소-목적" on the staff Google Calendar(s), served
    from a local cache that's refreshed at most once every 10 minutes
    (see sync_tasks.maybe_sync_external_calendar_events), regardless of how
    many logged-in users' browsers request it concurrently.
    """
    get_current_user(token, db)

    def _run_background_sync() -> None:
        bg_db = SessionLocal()
        try:
            maybe_sync_external_calendar_events(bg_db)
        finally:
            bg_db.close()

    background_tasks.add_task(_run_background_sync)

    rows = db.scalars(
        select(ExternalCalendarEvent).where(
            ExternalCalendarEvent.start_time < end,
            ExternalCalendarEvent.end_time > start,
        )
    ).all()
    return [
        {
            "id": row.id,
            "room_id": row.room_id,
            "room_name": row.room_name,
            "requester_name": row.requester_name,
            "purpose": row.purpose,
            "start_time": _as_utc_aware(row.start_time).isoformat(),
            "end_time": _as_utc_aware(row.end_time).isoformat(),
            "all_day": row.all_day,
        }
        for row in rows
    ]



@app.patch("/api/admin/reservations/{reservation_id}", response_model=ReservationOut)
def update_reservation_by_admin(
    reservation_id: int,
    payload: AdminUpdateReservation,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> ReservationOut:
    current_member = get_current_user(token, db)  # Verify JWT token
    membership_category = "adult"
    actor_user = db.scalar(select(User).where(User.member_id == current_member.id))
    if actor_user and actor_user.membership_category:
        membership_category = actor_user.membership_category.value

    item = db.scalar(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(joinedload(Reservation.room))
    )
    if not item:
        raise HTTPException(status_code=404, detail="reservation not found")

    if payload.action == "approve":
        if payload.room_id is not None:
            room = db.get(Room, payload.room_id)
            if not room:
                raise HTTPException(status_code=404, detail="target room not found")
            item.room_id = payload.room_id

        if payload.start_time is not None:
            item.start_time = payload.start_time
        if payload.end_time is not None:
            item.end_time = payload.end_time

        if payload.room_id is not None or payload.start_time is not None or payload.end_time is not None:
            validate_reservation_times(item.start_time, item.end_time)

            eligible, reason = can_reserve_room(
                item.room_id,
                item.start_time,
                item.end_time,
                membership_category,
                db,
            )
            if not eligible:
                raise HTTPException(status_code=403, detail=reason)

            # Re-arm reminders since the schedule changed during approval.
            item.start_reminder_sent = False
            item.start_reminder_sent_at = None
            item.end_reminder_sent = False
            item.end_reminder_sent_at = None

        item.status = ReservationStatus.approved
    elif payload.action == "reject":
        item.status = ReservationStatus.rejected
    elif payload.action == "change":
        if payload.room_id is not None:
            room = db.get(Room, payload.room_id)
            if not room:
                raise HTTPException(status_code=404, detail="target room not found")
            item.room_id = payload.room_id

        if payload.start_time is not None:
            item.start_time = payload.start_time
        if payload.end_time is not None:
            item.end_time = payload.end_time

        validate_reservation_times(item.start_time, item.end_time)

        eligible, reason = can_reserve_room(
            item.room_id,
            item.start_time,
            item.end_time,
            membership_category,
            db,
        )
        if not eligible:
            raise HTTPException(status_code=403, detail=reason)

        item.status = ReservationStatus.changed

        # Re-arm reminders when reservation schedule is changed by admin.
        item.start_reminder_sent = False
        item.start_reminder_sent_at = None
        item.end_reminder_sent = False
        item.end_reminder_sent_at = None

    item.admin_comment = payload.admin_comment

    db.commit()
    db.refresh(item)

    # ── Send email notification ──────────────────────────────────────────────
    status_text = {
        "approve": "승인되었습니다",
        "reject": "거절되었습니다",
        "change": "변경되었습니다",
    }
    status_text_en = {
        "approve": "Approved",
        "reject": "Rejected",
        "change": "Modified",
    }
    
    action = payload.action or "pending"
    status_ko = status_text.get(action, "처리되었습니다")
    status_en = status_text_en.get(action, "Processed")
    
    if item.email:
        calendar_link = _build_google_calendar_link(
            f"{item.room.name if item.room else '장소'} 예약",
            item.start_time,
            item.end_time,
            item.room.name if item.room else "N/A",
            f"예약 ID #{item.id} / 신청자 {item.requester_name}",
        )

        # Korean email
        subject_ko = f"[밀알교회] 예약 {status_ko} - {item.room.name if item.room else 'N/A'}"
        body_ko = f"""안녕하세요,

귀하의 장소 예약 신청이 {status_ko}.

【 예약 정보 】
- 예약 ID: #{item.id}
- 장소: {item.room.name if item.room else 'N/A'}
- 신청자: {item.requester_name}
- 시작 시간(ET): {_format_eastern_time(item.start_time)}
- 종료 시간(ET): {_format_eastern_time(item.end_time)}
- 목적: {item.purpose or 'N/A'}
- 참석자 수: {item.attendees}

Google Calendar에 추가:
{calendar_link}

【 처리 결과 】
- 상태: {status_ko}
- 관리자 메모: {item.admin_comment or '없음'}

자세한 내용은 커뮤니티에서 확인하실 수 있습니다.

밀알교회"""

        # Admin-created reservations don't need a status-change notice —
        # any action taken here (reject/change) is the admin's own doing.
        if not item.created_by_admin:
            queue_email(db, item.email, subject_ko, body_ko)
    
    room_name = item.room.name if item.room else (db.get(Room, item.room_id).name)
    return ReservationOut(
        id=item.id,
        room_id=item.room_id,
        room_name=room_name,
        requester_name=item.requester_name,
        phone=item.phone,
        email=item.email,
        purpose=item.purpose,
        attendees=item.attendees,
        notes=item.notes,
        start_time=_as_utc_aware(item.start_time),
        end_time=_as_utc_aware(item.end_time),
        status=item.status.value,
        admin_comment=item.admin_comment,
        repeat_type=item.repeat_type,
        repeat_count=item.repeat_count,
        parent_reservation_id=item.parent_reservation_id,
        created_at=_as_utc_aware(item.created_at),
        updated_at=_as_utc_aware(item.updated_at),
    )


@app.patch("/api/reservations/{reservation_id}", response_model=ReservationOut)
def update_reservation_by_user(
    reservation_id: int,
    payload: UserUpdateReservation,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> ReservationOut:
    """User self-service update for their own reservation (pending/changed status only)"""
    current_user = get_current_user(token, db)

    item = db.scalar(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(joinedload(Reservation.room))
    )
    if not item:
        raise HTTPException(status_code=404, detail="reservation not found")

    # Verify ownership: match requester identity against the logged-in member
    is_owner = item.requester_name == current_user.name
    if current_user.email and item.email == current_user.email:
        is_owner = True
    if current_user.phone and item.phone == current_user.phone:
        is_owner = True
    if not is_owner:
        raise HTTPException(status_code=403, detail="You can only update your own reservations")

    # Can only update pending or changed status
    if item.status not in [ReservationStatus.pending, ReservationStatus.changed]:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot update reservation with status '{item.status.value}'. Only pending or changed reservations can be updated."
        )

    # Update allowed fields
    if payload.purpose is not None:
        item.purpose = payload.purpose
    if payload.attendees is not None:
        item.attendees = payload.attendees
    if payload.notes is not None:
        item.notes = payload.notes
    
    # If updating time, validate and check for conflicts
    if payload.start_time is not None or payload.end_time is not None:
        new_start = payload.start_time if payload.start_time is not None else item.start_time
        new_end = payload.end_time if payload.end_time is not None else item.end_time

        validate_reservation_times(new_start, new_end)

        # Check for conflicts with other reservations (excluding this one)
        conflict = db.scalar(
            select(Reservation)
            .where(
                and_(
                    Reservation.id != reservation_id,
                    Reservation.room_id == item.room_id,
                    Reservation.status.in_([
                        ReservationStatus.pending,
                        ReservationStatus.approved,
                        ReservationStatus.changed,
                    ]),
                    Reservation.start_time < new_end,
                    Reservation.end_time > new_start,
                )
            )
            .limit(1)
        )
        if conflict:
            raise HTTPException(status_code=409, detail="time slot conflicts with another reservation")

        item.start_time = new_start
        item.end_time = new_end

    db.commit()
    db.refresh(item)

    # Send update email (skip for admin-created reservations)
    if item.email and not item.created_by_admin:
        subject = f"[예약 변경] {item.room.name if item.room else 'N/A'}"
        body = f"""안녕하세요 {item.requester_name}님,

귀하의 예약이 수정되었습니다.

【 예약 정보 】
- 예약 ID: #{item.id}
- 장소: {item.room.name if item.room else 'N/A'}
- 시작 시간(ET): {_format_eastern_time(item.start_time)}
- 종료 시간(ET): {_format_eastern_time(item.end_time)}
- 목적: {item.purpose}
- 참석자 수: {item.attendees}
- 상태: {item.status.value}

밀알교회"""
        queue_email(db, item.email, subject, body)

    room_name = item.room.name if item.room else "Unknown"
    return ReservationOut(
        id=item.id,
        room_id=item.room_id,
        room_name=room_name,
        requester_name=item.requester_name,
        phone=item.phone,
        email=item.email,
        purpose=item.purpose,
        attendees=item.attendees,
        notes=item.notes,
        start_time=_as_utc_aware(item.start_time),
        end_time=_as_utc_aware(item.end_time),
        status=item.status.value,
        admin_comment=item.admin_comment,
        repeat_type=item.repeat_type,
        repeat_count=item.repeat_count,
        parent_reservation_id=item.parent_reservation_id,
        created_at=_as_utc_aware(item.created_at),
        updated_at=_as_utc_aware(item.updated_at),
    )


@app.delete("/api/reservations/{reservation_id}")
def delete_reservation_by_user(
    reservation_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """User self-service delete for their own reservation"""
    current_user = get_current_user(token, db)

    item = db.scalar(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(joinedload(Reservation.room))
    )
    if not item:
        raise HTTPException(status_code=404, detail="reservation not found")

    # Verify ownership: match requester identity against the logged-in member
    is_owner = item.requester_name == current_user.name
    if current_user.email and item.email == current_user.email:
        is_owner = True
    if current_user.phone and item.phone == current_user.phone:
        is_owner = True
    if not is_owner:
        raise HTTPException(status_code=403, detail="You can only delete your own reservations")

    # Delete is allowed for all statuses
    room_name = item.room.name if item.room else "Unknown"
    
    # Send cancellation email (skip for admin-created reservations)
    if item.email and not item.created_by_admin:
        subject = f"[예약 취소] {room_name}"
        body = f"""안녕하세요 {item.requester_name}님,

귀하의 예약이 취소되었습니다.

【 예약 정보 】
- 예약 ID: #{item.id}
- 장소: {room_name}
- 시작 시간(ET): {_format_eastern_time(item.start_time)}
- 종료 시간(ET): {_format_eastern_time(item.end_time)}
- 목적: {item.purpose}

밀알교회"""
        queue_email(db, item.email, subject, body)

    db.delete(item)
    db.commit()

    return {
        "message": "reservation deleted successfully",
        "reservation_id": reservation_id,
    }


# ── Cell Report ───────────────────────────────────────────────────────────
def _ensure_cell_group_access(current_user: Member, report_cell_group: str) -> None:
    if current_user.permission == "admin":
        return
    if not current_user.cell_group or current_user.cell_group != report_cell_group:
        raise HTTPException(status_code=403, detail="Permission denied")


def _analyze_cell_reports(
    db: Session,
    cell_group: str,
    year: int,
) -> dict:
    start_date = date(year, 1, 1)
    end_date = date(year + 1, 1, 1)

    report_ids = db.scalars(
        select(CellReport.id)
        .where(
            CellReport.cell_group == cell_group,
            CellReport.meeting_date >= start_date,
            CellReport.meeting_date < end_date,
        )
    ).all()

    if not report_ids:
        return {
            "year": year,
            "cell_group": cell_group,
            "meeting_count": 0,
            "message": "해당 연도의 순보고 데이터가 없습니다.",
            "lowest_attendance_member": None,
            "most_shared_prayer_member": None,
            "attendance_rank": [],
            "prayer_sharing_rank": [],
        }

    entries = db.scalars(
        select(CellReportMemberEntry)
        .where(CellReportMemberEntry.report_id.in_(report_ids))
        .options(joinedload(CellReportMemberEntry.member))
    ).all()

    attendance_stats: dict[int, dict] = {}
    prayer_stats: dict[int, dict] = {}

    for entry in entries:
        if not entry.member:
            continue

        att = attendance_stats.setdefault(
            entry.member_id,
            {"member_id": entry.member_id, "member_name": entry.member.name, "total": 0, "attended": 0},
        )
        att["total"] += 1
        if entry.attended:
            att["attended"] += 1

        prayer_text = (entry.prayer or "").strip()
        if prayer_text:
            pr = prayer_stats.setdefault(
                entry.member_id,
                {
                    "member_id": entry.member_id,
                    "member_name": entry.member.name,
                    "entry_count": 0,
                    "sample": prayer_text,
                },
            )
            pr["entry_count"] += 1
            if len(prayer_text) > len(pr["sample"]):
                pr["sample"] = prayer_text

    attendance_rank = []
    for _, stat in attendance_stats.items():
        if stat["total"] <= 0:
            continue
        rate = stat["attended"] / stat["total"]
        attendance_rank.append(
            {
                "member_id": stat["member_id"],
                "member_name": stat["member_name"],
                "attended": stat["attended"],
                "total": stat["total"],
                "attendance_rate": round(rate, 4),
            }
        )

    attendance_rank.sort(key=lambda row: (row["attendance_rate"], row["member_name"]))

    prayer_sharing_rank = list(prayer_stats.values())
    prayer_sharing_rank.sort(key=lambda row: (-row["entry_count"], row["member_name"]))

    return {
        "year": year,
        "cell_group": cell_group,
        "meeting_count": len(report_ids),
        "lowest_attendance_member": attendance_rank[0] if attendance_rank else None,
        "most_shared_prayer_member": prayer_sharing_rank[0] if prayer_sharing_rank else None,
        "attendance_rank": attendance_rank[:5],
        "prayer_sharing_rank": prayer_sharing_rank[:5],
        "analysis_note": "기도 나눔 빈도와 기록 내용을 중심으로 정리한 참고 정보입니다.",
    }


def _analyze_cell_report_by_date(
    db: Session,
    cell_group: str,
    meeting_date: date,
) -> dict:
    reports = db.scalars(
        select(CellReport)
        .where(
            CellReport.cell_group == cell_group,
            CellReport.meeting_date == meeting_date,
        )
        .options(
            joinedload(CellReport.leader),
            selectinload(CellReport.entries).joinedload(CellReportMemberEntry.member),
        )
        .order_by(CellReport.created_at.desc(), CellReport.id.desc())
    ).all()

    if not reports:
        return {
            "meeting_date": meeting_date.isoformat(),
            "cell_group": cell_group,
            "report_found": False,
            "message": "해당 날짜의 순보고 데이터가 없습니다.",
            "analysis_note": "해당 날짜에 저장된 순보고가 있을 때 분석이 가능합니다.",
        }

    report = reports[0]
    entries = report.entries or []
    attended_entries = [e for e in entries if e.attended]
    absent_members = [e.member.name for e in entries if (not e.attended and e.member)]
    prayer_entries = [
        {
            "member_id": e.member_id,
            "member_name": e.member.name if e.member else "",
            "prayer": (e.prayer or "").strip(),
        }
        for e in entries
        if (e.prayer or "").strip()
    ]

    keyword_counts: dict[str, int] = {}
    for kw in _extract_keywords(report.overall_prayer or ""):
        keyword_counts[kw] = keyword_counts.get(kw, 0) + 1
    for item in prayer_entries:
        for kw in _extract_keywords(item["prayer"]):
            keyword_counts[kw] = keyword_counts.get(kw, 0) + 1
    top_keywords = sorted(keyword_counts.items(), key=lambda x: (-x[1], x[0]))[:8]

    total_members = len(entries)
    attended_count = len(attended_entries)
    attendance_rate = round((attended_count / total_members), 4) if total_members else 0.0

    return {
        "meeting_date": report.meeting_date.isoformat(),
        "cell_group": report.cell_group,
        "report_found": True,
        "report_id": report.id,
        "report_count_on_date": len(reports),
        "leader_name": report.leader.name if report.leader else "",
        "meeting_time": report.meeting_time,
        "meeting_place": report.meeting_place,
        "overall_prayer": report.overall_prayer,
        "total_members": total_members,
        "attended_count": attended_count,
        "attendance_rate": attendance_rate,
        "absent_members": absent_members,
        "prayer_sharing_members": [item["member_name"] for item in prayer_entries],
        "prayer_sharing_entries": prayer_entries,
        "top_keywords": [{"keyword": k, "count": c} for k, c in top_keywords],
        "analysis_note": "해당 날짜 순보고를 바탕으로 출석과 기도 나눔 흐름을 정리한 참고 정보입니다.",
    }


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _add_months(d: date, months: int) -> date:
    total = d.year * 12 + (d.month - 1) + months
    year = total // 12
    month = total % 12 + 1
    return date(year, month, 1)


def _extract_keywords(text_value: str) -> list[str]:
    if not text_value:
        return []
    tokens = re.findall(r"[가-힣A-Za-z0-9]{2,}", text_value.lower())
    stop = {
        "그리고", "하지만", "또한", "위한", "기도", "기도제목", "있기", "있도록",
        "the", "and", "for", "with", "that", "this", "from", "have", "been",
    }
    return [t for t in tokens if t not in stop]


def _analyze_member_prayer_trend(
    db: Session,
    cell_group: str,
    member_name: str,
    months: int,
) -> dict:
    months = max(1, min(months, 24))
    now = datetime.now().date()
    period_end = _add_months(_month_start(now), 1)
    period_start = _add_months(period_end, -months)

    candidates = db.scalars(
        select(Member)
        .where(Member.cell_group == cell_group, Member.name.contains(member_name.strip()))
        .order_by(Member.name.asc())
    ).all()

    if not candidates:
        return {
            "cell_group": cell_group,
            "member_name": member_name,
            "months": months,
            "message": "해당 이름의 순원을 찾지 못했습니다.",
            "member": None,
        }

    exact = [m for m in candidates if m.name == member_name.strip()]
    target = exact[0] if exact else candidates[0]

    rows = db.execute(
        select(CellReportMemberEntry, CellReport)
        .join(CellReport, CellReportMemberEntry.report_id == CellReport.id)
        .where(
            CellReport.cell_group == cell_group,
            CellReportMemberEntry.member_id == target.id,
            CellReport.meeting_date >= period_start,
            CellReport.meeting_date < period_end,
        )
        .order_by(CellReport.meeting_date.asc())
    ).all()

    timeline = []
    monthly: dict[str, dict] = {}
    all_keywords: dict[str, int] = {}
    attended_count = 0

    for entry, report in rows:
        prayer_text = (entry.prayer or "").strip()
        if entry.attended:
            attended_count += 1

        month_key = report.meeting_date.strftime("%Y-%m")
        item = monthly.setdefault(
            month_key,
            {
                "month": month_key,
                "meeting_count": 0,
                "attended_count": 0,
                "prayer_entry_count": 0,
            },
        )
        item["meeting_count"] += 1
        if entry.attended:
            item["attended_count"] += 1
        if prayer_text:
            item["prayer_entry_count"] += 1

        timeline.append(
            {
                "meeting_date": report.meeting_date.isoformat(),
                "attended": entry.attended,
                "prayer": prayer_text,
            }
        )

        for keyword in _extract_keywords(prayer_text):
            all_keywords[keyword] = all_keywords.get(keyword, 0) + 1

    total_meetings = len(rows)
    attendance_rate = round((attended_count / total_meetings), 4) if total_meetings else 0.0

    top_keywords = sorted(all_keywords.items(), key=lambda x: (-x[1], x[0]))[:8]
    prayer_entry_count = sum(1 for item in timeline if item["prayer"])
    months_with_prayer = sum(1 for item in monthly.values() if item["prayer_entry_count"] > 0)

    if prayer_entry_count == 0:
        prayer_journey_note = "최근 기간에 기록된 개인 기도제목이 없어, 함께 기도할 주제를 새롭게 나누어 보시는 것을 권합니다."
    else:
        prayer_journey_note = (
            f"최근 {months}개월 동안 {prayer_entry_count}회의 기도 나눔이 있었고, "
            f"{months_with_prayer}개월에 걸쳐 중보 제목이 이어졌습니다."
        )

    return {
        "cell_group": cell_group,
        "member": {"member_id": target.id, "name": target.name, "title": target.title},
        "months": months,
        "period_start": period_start.isoformat(),
        "period_end": (period_end - timedelta(days=1)).isoformat(),
        "total_meetings": total_meetings,
        "attended_count": attended_count,
        "attendance_rate": attendance_rate,
        "monthly_summary": sorted(monthly.values(), key=lambda x: x["month"]),
        "timeline": timeline,
        "top_keywords": [{"keyword": k, "count": c} for k, c in top_keywords],
        "prayer_journey_note": prayer_journey_note,
        "analysis_note": "기도제목 변화는 기록된 내용과 키워드를 바탕으로 정리한 참고 정보이며, 실제 돌봄과 목회적 분별을 함께 고려해 주세요.",
        "candidate_names": [m.name for m in candidates],
    }


@app.post("/api/cell-reports", response_model=CellReportDetailOut)
def create_cell_report(
    payload: CellReportCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CellReportDetailOut:
    current_user = get_current_user(token, db)
    if current_user.title != "순장" and current_user.permission != "admin":
        raise HTTPException(status_code=403, detail="Only cell group leaders can create reports")

    member_ids = [entry.member_id for entry in payload.members]
    members_map: dict[int, Member] = {}
    if member_ids:
        members = db.scalars(select(Member).where(Member.id.in_(member_ids))).all()
        members_map = {m.id: m for m in members}

    for entry in payload.members:
        member = members_map.get(entry.member_id)
        if not member:
            raise HTTPException(status_code=400, detail=f"member not found: {entry.member_id}")
        if member.cell_group != current_user.cell_group:
            raise HTTPException(status_code=403, detail="Cannot include members from another cell group")

    report = CellReport(
        leader_member_id=current_user.id,
        cell_group=current_user.cell_group or "",
        meeting_date=payload.meeting_date,
        meeting_time=payload.meeting_time,
        meeting_place=payload.meeting_place,
        overall_prayer=payload.overall_prayer,
        leader_comment=payload.leader_comment,
    )
    db.add(report)
    db.flush()

    for entry in payload.members:
        db.add(
            CellReportMemberEntry(
                report_id=report.id,
                member_id=entry.member_id,
                attended=entry.attended,
                attendance_type=entry.attendance_type,
                prayer=entry.prayer,
                remarks=entry.remarks,
            )
        )

    db.commit()

    saved = db.scalar(
        select(CellReport)
        .where(CellReport.id == report.id)
        .options(
            joinedload(CellReport.leader),
            selectinload(CellReport.entries).joinedload(CellReportMemberEntry.member),
        )
    )
    if not saved:
        raise HTTPException(status_code=500, detail="failed to load saved report")

    return CellReportDetailOut(
        id=saved.id,
        cell_group=saved.cell_group,
        leader_name=saved.leader.name if saved.leader else "",
        meeting_date=saved.meeting_date,
        meeting_time=saved.meeting_time,
        meeting_place=saved.meeting_place,
        overall_prayer=saved.overall_prayer,
        leader_comment=saved.leader_comment,
        entries=[
            {
                "member_id": e.member_id,
                "member_name": e.member.name if e.member else "",
                "member_title": e.member.title if e.member else "",
                "attended": e.attended,
                "attendance_type": e.attendance_type.value if e.attendance_type else "absent",
                "prayer": e.prayer,
                "remarks": e.remarks,
            }
            for e in saved.entries
        ],
        created_at=saved.created_at,
        updated_at=saved.updated_at,
    )


@app.get("/api/cell-reports", response_model=list[CellReportListItem])
def list_cell_reports(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[CellReportListItem]:
    current_user = get_current_user(token, db)
    stmt = (
        select(CellReport)
        .options(joinedload(CellReport.leader), selectinload(CellReport.entries))
        .order_by(CellReport.meeting_date.desc(), CellReport.created_at.desc())
    )

    if current_user.permission != "admin":
        stmt = stmt.where(CellReport.cell_group == (current_user.cell_group or ""))

    reports = db.scalars(stmt).all()
    return [
        CellReportListItem(
            id=r.id,
            meeting_date=r.meeting_date,
            meeting_time=r.meeting_time,
            meeting_place=r.meeting_place,
            overall_prayer=r.overall_prayer,
            leader_comment=r.leader_comment,
            attendee_count=sum(1 for e in r.entries if e.attended),
            total_count=len(r.entries),
            prayer_recorded_count=sum(1 for e in r.entries if (e.prayer or "").strip()),
            leader_name=r.leader.name if r.leader else "",
            created_at=r.created_at,
        )
        for r in reports
    ]


@app.get("/api/cell-reports/{report_id}", response_model=CellReportDetailOut)
def get_cell_report_detail(
    report_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CellReportDetailOut:
    current_user = get_current_user(token, db)
    report = db.scalar(
        select(CellReport)
        .where(CellReport.id == report_id)
        .options(
            joinedload(CellReport.leader),
            selectinload(CellReport.entries).joinedload(CellReportMemberEntry.member),
        )
    )
    if not report:
        raise HTTPException(status_code=404, detail="report not found")

    _ensure_cell_group_access(current_user, report.cell_group)

    return CellReportDetailOut(
        id=report.id,
        cell_group=report.cell_group,
        leader_name=report.leader.name if report.leader else "",
        meeting_date=report.meeting_date,
        meeting_time=report.meeting_time,
        meeting_place=report.meeting_place,
        overall_prayer=report.overall_prayer,
        leader_comment=report.leader_comment,
        entries=[
            {
                "member_id": e.member_id,
                "member_name": e.member.name if e.member else "",
                "member_title": e.member.title if e.member else "",
                "attended": e.attended,
                "attendance_type": e.attendance_type.value if e.attendance_type else "absent",
                "prayer": e.prayer,
                "remarks": e.remarks,
            }
            for e in report.entries
        ],
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@app.get("/api/cell-reports/analysis")
def analyze_cell_reports(
    year: int | None = Query(default=None),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    if current_user.permission != "admin" and current_user.title != "순장":
        raise HTTPException(status_code=403, detail="Only admins or cell leaders can analyze reports")
    if not current_user.cell_group:
        raise HTTPException(status_code=400, detail="cell group not found")

    target_year = year or datetime.now().year
    if target_year < 2000 or target_year > 2100:
        raise HTTPException(status_code=400, detail="invalid year")

    return _analyze_cell_reports(db=db, cell_group=current_user.cell_group, year=target_year)


@app.get("/api/cell-reports/date-analysis")
def analyze_cell_report_by_date(
    meeting_date: date = Query(...),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    if current_user.permission != "admin" and current_user.title != "순장":
        raise HTTPException(status_code=403, detail="Only admins or cell leaders can analyze reports")
    if not current_user.cell_group:
        raise HTTPException(status_code=400, detail="cell group not found")

    return _analyze_cell_report_by_date(
        db=db,
        cell_group=current_user.cell_group,
        meeting_date=meeting_date,
    )


@app.get("/api/cell-reports/member-prayer-trend")
def analyze_member_prayer_trend(
    member_name: str = Query(...),
    months: int = Query(default=5),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    if current_user.permission != "admin" and current_user.title != "순장":
        raise HTTPException(status_code=403, detail="Only admins or cell leaders can analyze reports")
    if not current_user.cell_group:
        raise HTTPException(status_code=400, detail="cell group not found")

    return _analyze_member_prayer_trend(
        db=db,
        cell_group=current_user.cell_group,
        member_name=member_name,
        months=months,
    )


# ── AI Chat ───────────────────────────────────────────────────────────────

app.include_router(
    create_ai_chat_router(
        analyze_cell_reports=_analyze_cell_reports,
        analyze_cell_report_by_date=_analyze_cell_report_by_date,
        analyze_member_prayer_trend=_analyze_member_prayer_trend,
    )
)

if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    app.mount("/uploads/expenses", StaticFiles(directory=str(EXPENSE_UPLOAD_DIR)), name="expense-uploads")


@app.get("/", include_in_schema=False)
def serve_frontend_root() -> FileResponse:
    index_file = FRONTEND_DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="frontend build not found")
    return FileResponse(index_file)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="not found")

    requested = FRONTEND_DIST_DIR / full_path
    if requested.exists() and requested.is_file():
        return FileResponse(requested)

    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="frontend build not found")
