import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import and_, select, text
from sqlalchemy.orm import Session, joinedload, selectinload

# Load environment variables from .env file
load_dotenv()

from .database import Base, engine, get_db
from .models import (
    CellReport,
    CellReportMemberEntry,
    Member,
    OtpCode,
    Reservation,
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
    ChatRequest,
    ReservationCreate,
    ReservationOut,
    RoomCreate,
    RoomOut,
    RoomUpdate,
    RoomLocationOut,
    RoomLocationCreate,
    RoomLocationUpdate,
)
from .auth_routes import router as auth_router, _send_email, get_current_user, oauth2_scheme

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


@app.on_event("startup")
def startup() -> None:
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
    
    db = next(get_db())
    try:
        seed_rooms(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/rooms", response_model=list[RoomOut])
def get_rooms(db: Session = Depends(get_db)) -> list[Room]:
    rooms = db.scalars(select(Room).where(Room.is_active.is_(True)).order_by(Room.id)).all()
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


@app.post("/api/reservations", response_model=dict)
def create_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    token: str | None = None,
) -> dict:
    """
    Create reservation(s). 
    - Regular users: create pending reservation
    - Admin users: create auto-approved reservation(s) with optional repeat
    """
    validate_reservation_times(payload.start_time, payload.end_time)

    room = db.get(Room, payload.room_id)
    if not room or not room.is_active:
        raise HTTPException(status_code=404, detail="room not found")
    
    # Check if requester is admin
    is_admin = payload.permission == "admin"

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
    예약 시간: {reservations[0].start_time} - {reservations[0].end_time}
    메모: {payload.notes}
    """
    
    if payload.repeat_count > 1:
        repeat_type_kr = "매주" if payload.repeat_type == "weekly" else "매달"
        email_body += f"\n반복 예약: {repeat_type_kr} {payload.repeat_count}회\n"
        for idx, res in enumerate(reservations, 1):
            email_body += f"  {idx}. {res.start_time} - {res.end_time}\n"
    
    if is_admin:
        email_body += "\n[자동승인] 관리자 예약으로 자동승인되었습니다."
    else:
        email_body += "\n[대기중] 예약이 승인 대기 중입니다."

    _send_email(payload.email, email_subject, email_body)

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
            start_time=item.start_time,
            end_time=item.end_time,
            status=item.status.value,
            admin_comment=item.admin_comment,
            repeat_type=item.repeat_type,
            repeat_count=item.repeat_count,
            parent_reservation_id=item.parent_reservation_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@app.patch("/api/admin/reservations/{reservation_id}", response_model=ReservationOut)
def update_reservation_by_admin(
    reservation_id: int,
    payload: AdminUpdateReservation,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> ReservationOut:
    get_current_user(token, db)  # Verify JWT token

    item = db.scalar(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(joinedload(Reservation.room))
    )
    if not item:
        raise HTTPException(status_code=404, detail="reservation not found")

    if payload.action == "approve":
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
        item.status = ReservationStatus.changed

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
        # Korean email
        subject_ko = f"[밀알교회] 예약 {status_ko} - {item.room.name if item.room else 'N/A'}"
        body_ko = f"""안녕하세요,

귀하의 장소 예약 신청이 {status_ko}.

【 예약 정보 】
- 예약 ID: #{item.id}
- 장소: {item.room.name if item.room else 'N/A'}
- 신청자: {item.requester_name}
- 시작 시간: {item.start_time.strftime('%Y-%m-%d %H:%M') if item.start_time else 'N/A'}
- 종료 시간: {item.end_time.strftime('%Y-%m-%d %H:%M') if item.end_time else 'N/A'}
- 목적: {item.purpose or 'N/A'}
- 참석자 수: {item.attendees}

【 처리 결과 】
- 상태: {status_ko}
- 관리자 메모: {item.admin_comment or '없음'}

자세한 내용은 포털에서 확인하실 수 있습니다.

밀알교회 포털팀"""

        _send_email(item.email, subject_ko, body_ko)
    
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
        start_time=item.start_time,
        end_time=item.end_time,
        status=item.status.value,
        admin_comment=item.admin_comment,
        repeat_type=item.repeat_type,
        repeat_count=item.repeat_count,
        parent_reservation_id=item.parent_reservation_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


# ── Cell Report ───────────────────────────────────────────────────────────
def _ensure_cell_group_access(current_user: Member, report_cell_group: str) -> None:
    if current_user.permission == "admin":
        return
    if not current_user.cell_group or current_user.cell_group != report_cell_group:
        raise HTTPException(status_code=403, detail="Permission denied")


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
    )
    db.add(report)
    db.flush()

    for entry in payload.members:
        db.add(
            CellReportMemberEntry(
                report_id=report.id,
                member_id=entry.member_id,
                attended=entry.attended,
                prayer=entry.prayer,
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
        entries=[
            {
                "member_id": e.member_id,
                "member_name": e.member.name if e.member else "",
                "member_title": e.member.title if e.member else "",
                "attended": e.attended,
                "prayer": e.prayer,
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
            attendee_count=sum(1 for e in r.entries if e.attended),
            total_count=len(r.entries),
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
        entries=[
            {
                "member_id": e.member_id,
                "member_name": e.member.name if e.member else "",
                "member_title": e.member.title if e.member else "",
                "attended": e.attended,
                "prayer": e.prayer,
            }
            for e in report.entries
        ],
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


# ── AI Chat ───────────────────────────────────────────────────────────────

_CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_rooms",
            "description": "Get list of all active rooms with their details (id, name, capacity, description, floor)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_reservations",
            "description": "Get reservations for an optional date range. Dates are in UTC ISO format.",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_date": {"type": "string", "description": "Start date (UTC ISO format, e.g. 2024-06-10T00:00:00)"},
                    "to_date": {"type": "string", "description": "End date (UTC ISO format)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check if a room is available for a given time slot. Returns available=true/false and any conflicts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "room_id": {"type": "integer", "description": "Room ID"},
                    "start_time": {"type": "string", "description": "Start time in UTC ISO format"},
                    "end_time": {"type": "string", "description": "End time in UTC ISO format"},
                },
                "required": ["room_id", "start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reservation",
            "description": "Create a new room reservation for the current user. Always check availability first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "room_id": {"type": "integer", "description": "Room ID"},
                    "purpose": {"type": "string", "description": "Purpose/reason for the reservation"},
                    "attendees": {"type": "integer", "description": "Number of attendees", "default": 1},
                    "start_time": {"type": "string", "description": "Start time in ISO format (no timezone conversion needed)"},
                    "end_time": {"type": "string", "description": "End time in ISO format (no timezone conversion needed)"},
                    "notes": {"type": "string", "description": "Additional notes", "default": ""},
                },
                "required": ["room_id", "purpose", "start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cell_group_members",
            "description": "Get members of the current user's cell group (순). Supports search by name, phone, email, address, and car plate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional search keyword (name, title, phone, email, address, car plate)",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_cell_group_member",
            "description": "Update contact info (email, phone, address) of a cell group member. Only available for 순장. Confirm with user before updating.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_id": {"type": "integer", "description": "Member ID to update"},
                    "email": {"type": "string", "description": "New email address (omit if not changing)"},
                    "phone": {"type": "string", "description": "New phone number (omit if not changing)"},
                    "address": {"type": "string", "description": "New address (omit if not changing)"},
                },
                "required": ["member_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_cell_report",
            "description": "Create a new cell group report for the current user's cell group. Only available for 순장. Confirm with the user before saving.",
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_date": {"type": "string", "description": "Meeting date in YYYY-MM-DD format"},
                    "meeting_time": {"type": "string", "description": "Meeting time text, e.g. 19:30", "default": ""},
                    "meeting_place": {"type": "string", "description": "Meeting place", "default": ""},
                    "overall_prayer": {"type": "string", "description": "Overall prayer topics for the meeting", "default": ""},
                    "members": {
                        "type": "array",
                        "description": "Per-member attendance and prayer data",
                        "items": {
                            "type": "object",
                            "properties": {
                                "member_id": {"type": "integer", "description": "Member ID"},
                                "attended": {"type": "boolean", "description": "Whether this member attended"},
                                "prayer": {"type": "string", "description": "Prayer topic for this member", "default": ""}
                            },
                            "required": ["member_id", "attended"]
                        }
                    }
                },
                "required": ["meeting_date", "members"],
            },
        },
    },
]


@app.post("/api/chat")
def chat_with_ai(
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> dict:
    """AI-powered natural language chat endpoint (Gemini)"""
    try:
        from openai import OpenAI
    except ImportError:
        return {"message": "openai 패키지가 설치되지 않았습니다. requirements.txt를 확인하세요.", "error": True}

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return {
            "message": (
                "AI 채팅 기능을 사용하려면 .env 파일에 GEMINI_API_KEY를 설정해야 합니다.\n"
                "무료 발급: https://aistudio.google.com/apikey"
            ),
            "error": True,
        }

    client = OpenAI(
        api_key=gemini_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    default_model = "gemini-2.5-flash"

    # Gather rooms for context
    rooms = db.scalars(select(Room).where(Room.is_active.is_(True)).order_by(Room.id)).all()
    rooms_info = "\n".join(
        [f"  - ID {r.id}: {r.name} (수용: {r.capacity}명, {r.floor}층, {r.description})" for r in rooms]
    )
    now_utc = datetime.utcnow()
    _eastern = ZoneInfo("America/New_York")
    now_eastern = datetime.now(_eastern)
    utc_offset_hours = int(now_eastern.utcoffset().total_seconds() / 3600)  # -5 (EST) or -4 (EDT)
    tz_label = f"EDT (UTC{utc_offset_hours:+d})" if utc_offset_hours == -4 else f"EST (UTC{utc_offset_hours:+d})"
    lang_hint = "Please respond in Korean (한국어로 응답하세요)." if payload.language == "ko" else "Please respond in English."

    # Only send non-sensitive identity info to the AI; phone/email stay server-side only
    user_ctx = ""
    if payload.user_name:
        user_ctx = f"\nCurrently logged-in user: name={payload.user_name}"
        if payload.user_title:
            user_ctx += f", title={payload.user_title}"
        if payload.user_cell_group:
            user_ctx += f", cell_group={payload.user_cell_group}"
        # phone/email intentionally omitted — used internally by tools only

    system_prompt = f"""You are a helpful AI assistant for the Milal Church community room reservation portal.
{lang_hint}

Current local date/time (Eastern Time, {tz_label}): {now_eastern.strftime('%Y-%m-%d %H:%M')}
{user_ctx}

Available rooms:
{rooms_info}

You can help users:
1. Browse rooms and check availability
2. View existing reservations
3. Create new reservations
4. If the user is 순장 (cell group leader): view and update cell group member information
5. If the user is 순장 (cell group leader): create a cell report for a meeting

Important rules:
- The server stores times as-is without timezone conversion. Pass times EXACTLY as the user specifies them (do NOT add or subtract hours for UTC conversion).
- For example, if the user says "6pm tomorrow", pass "YYYY-MM-DDT18:00:00" as-is.
- Always call check_availability before create_reservation.
- For create_reservation, use the logged-in user's name/phone/email from the context. If the user is not logged in (no user info), inform them they must log in first.
- After creating a reservation, the status is 'pending' and requires admin approval.
- For cell group tools (get_cell_group_members, update_cell_group_member): only available when user title is '순장'.
- For create_cell_report: only available when user title is '순장'. Gather meeting date/time/place, attendance, member prayer topics, and overall prayer topics before saving.
- For get_cell_group_members, when the user asks about a car number/plate, pass it in query and include car_plate in your answer.
- Always confirm with the user before calling update_cell_group_member.
- Always confirm with the user before calling create_cell_report.
- update_cell_group_member requires member_id. If unknown, call get_cell_group_members first to find the correct ID.
- create_cell_report requires member_id values for each attendee/member entry. If unknown, call get_cell_group_members first.
- Be concise, friendly, and helpful."""

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in payload.history[-12:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": payload.message})

    # ── Tool execution helpers ─────────────────────────────────────────────
    def _exec_get_rooms() -> list[dict]:
        return [
            {"id": r.id, "name": r.name, "capacity": r.capacity, "description": r.description, "floor": r.floor}
            for r in db.scalars(select(Room).where(Room.is_active.is_(True)).order_by(Room.id)).all()
        ]

    def _exec_get_reservations(from_date: str | None = None, to_date: str | None = None) -> list[dict]:
        stmt = select(Reservation).options(joinedload(Reservation.room)).order_by(Reservation.start_time.asc())
        if from_date:
            stmt = stmt.where(Reservation.end_time >= datetime.fromisoformat(from_date))
        if to_date:
            stmt = stmt.where(Reservation.start_time <= datetime.fromisoformat(to_date))
        items = db.scalars(stmt).all()
        return [
            {
                "id": i.id,
                "room_name": i.room.name if i.room else "Unknown",
                "requester_name": i.requester_name,  # name only, no contact info
                "purpose": i.purpose,
                "start_time": i.start_time.isoformat(),
                "end_time": i.end_time.isoformat(),
                "status": i.status.value,
            }
            for i in items
        ]

    def _parse_dt(s: str) -> datetime:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)

    def _exec_check_availability(room_id: int, start_time: str, end_time: str) -> dict:
        start = _parse_dt(start_time)
        end = _parse_dt(end_time)
        conflicts = db.scalars(
            select(Reservation)
            .options(joinedload(Reservation.room))
            .where(
                and_(
                    Reservation.room_id == room_id,
                    Reservation.status.in_([ReservationStatus.pending, ReservationStatus.approved, ReservationStatus.changed]),
                    Reservation.start_time < end,
                    Reservation.end_time > start,
                )
            )
        ).all()
        return {
            "available": len(conflicts) == 0,
            "conflicts": [
                {
                    "requester_name": c.requester_name,
                    "purpose": c.purpose,
                    "start_time": c.start_time.isoformat(),
                    "end_time": c.end_time.isoformat(),
                    "status": c.status.value,
                }
                for c in conflicts
            ],
        }

    def _exec_create_reservation(
        room_id: int,
        purpose: str,
        start_time: str,
        end_time: str,
        attendees: int = 1,
        notes: str = "",
    ) -> dict:
        if not payload.user_name:
            return {"error": "예약을 생성하려면 먼저 로그인해주세요."}

        phone = payload.user_phone or "000-0000-0000"
        email = payload.user_email or "noreply@milal.org"
        start = _parse_dt(start_time)
        end = _parse_dt(end_time)

        if end <= start:
            return {"error": "종료 시간은 시작 시간 이후여야 합니다."}

        room = db.get(Room, room_id)
        if not room or not room.is_active:
            return {"error": f"Room ID {room_id}를 찾을 수 없습니다."}

        conflict = db.scalar(
            select(Reservation).where(
                and_(
                    Reservation.room_id == room_id,
                    Reservation.status.in_([ReservationStatus.pending, ReservationStatus.approved, ReservationStatus.changed]),
                    Reservation.start_time < end,
                    Reservation.end_time > start,
                )
            ).limit(1)
        )
        if conflict:
            return {"error": "선택한 시간에 이미 예약이 있습니다."}

        new_item = Reservation(
            room_id=room_id,
            requester_name=payload.user_name,
            phone=phone,
            email=email,
            purpose=purpose,
            attendees=attendees,
            notes=notes,
            start_time=start,
            end_time=end,
            status=ReservationStatus.pending,
            repeat_type="none",
            repeat_count=1,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        return {
            "success": True,
            "reservation_id": new_item.id,
            "room_name": room.name,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "status": "pending",
        }

    def _exec_get_cell_group_members(query: str | None = None) -> list[dict] | dict:
        if payload.user_title != "순장":
            return {"error": "순장 권한이 있는 사용자만 순 정보에 접근할 수 있습니다."}
        if not payload.user_cell_group:
            return {"error": "셀 그룹 정보가 없습니다. 로그인 상태를 확인해주세요."}
        members = db.scalars(select(Member).where(Member.cell_group == payload.user_cell_group)).all()

        if query:
            needle = query.strip().lower()
            members = [
                m for m in members
                if needle in (m.name or "").lower()
                or needle in (m.title or "").lower()
                or needle in (m.phone or "").lower()
                or needle in (m.email or "").lower()
                or needle in (m.address or "").lower()
                or needle in (m.car_plate or "").lower()
            ]

        return [
            {
                "id": m.id,
                "name": m.name,
                "title": m.title,
                "phone": m.phone,
                "email": m.email,
                "address": m.address,
                "cell_group": m.cell_group,
                "car_plate": m.car_plate,
            }
            for m in members
        ]

    def _exec_update_cell_group_member(
        member_id: int,
        email: str | None = None,
        phone: str | None = None,
        address: str | None = None,
    ) -> dict:
        if payload.user_title != "순장":
            return {"error": "순장 권한이 있는 사용자만 순원 정보를 수정할 수 있습니다."}
        target = db.get(Member, member_id)
        if not target:
            return {"error": f"멤버 ID {member_id}를 찾을 수 없습니다."}
        if target.cell_group != payload.user_cell_group:
            return {"error": "같은 셀 그룹 멤버만 수정할 수 있습니다."}
        updated_fields = []
        if email is not None and email != target.email:
            target.email = email
            updated_fields.append("email")
        if phone is not None and phone != target.phone:
            target.phone = phone
            updated_fields.append("phone")
        if address is not None and address != target.address:
            target.address = address
            updated_fields.append("address")
        if updated_fields:
            db.commit()
            db.refresh(target)
        return {
            "success": True,
            "member_id": target.id,
            "name": target.name,
            "updated_fields": updated_fields,
        }

    def _exec_create_cell_report(
        meeting_date: str,
        members: list[dict],
        meeting_time: str = "",
        meeting_place: str = "",
        overall_prayer: str = "",
    ) -> dict:
        if payload.user_title != "순장":
            return {"error": "순장 권한이 있는 사용자만 순보고서를 작성할 수 있습니다."}
        if not payload.user_cell_group:
            return {"error": "셀 그룹 정보가 없습니다. 로그인 상태를 확인해주세요."}

        try:
            report_date = date.fromisoformat(meeting_date)
        except ValueError:
            return {"error": "meeting_date는 YYYY-MM-DD 형식이어야 합니다."}

        if not isinstance(members, list) or len(members) == 0:
            return {"error": "최소 1명 이상의 순원 정보가 필요합니다."}

        leader = db.scalar(
            select(Member)
            .where(Member.name == payload.user_name, Member.cell_group == payload.user_cell_group)
            .limit(1)
        )
        if not leader:
            return {"error": "순장 사용자 정보를 찾을 수 없습니다."}

        member_ids = [entry.get("member_id") for entry in members if entry.get("member_id") is not None]
        if not member_ids:
            return {"error": "member_id가 포함된 순원 정보가 필요합니다."}

        member_rows = db.scalars(select(Member).where(Member.id.in_(member_ids))).all()
        member_map = {member.id: member for member in member_rows}

        normalized_members: list[dict] = []
        for entry in members:
            member_id = entry.get("member_id")
            target = member_map.get(member_id)
            if not target:
                return {"error": f"멤버 ID {member_id}를 찾을 수 없습니다."}
            if target.cell_group != payload.user_cell_group:
                return {"error": "같은 셀 그룹 멤버만 순보고에 포함할 수 있습니다."}
            normalized_members.append(
                {
                    "member": target,
                    "attended": bool(entry.get("attended", False)),
                    "prayer": str(entry.get("prayer") or ""),
                }
            )

        report = CellReport(
            leader_member_id=leader.id,
            cell_group=payload.user_cell_group,
            meeting_date=report_date,
            meeting_time=meeting_time,
            meeting_place=meeting_place,
            overall_prayer=overall_prayer,
        )

        db.add(report)
        db.flush()

        for entry in normalized_members:
            db.add(
                CellReportMemberEntry(
                    report_id=report.id,
                    member_id=entry["member"].id,
                    attended=entry["attended"],
                    prayer=entry["prayer"],
                )
            )

        db.commit()
        return {
            "success": True,
            "report_id": report.id,
            "meeting_date": meeting_date,
            "meeting_time": meeting_time,
            "meeting_place": meeting_place,
            "member_count": len(normalized_members),
            "attended_count": sum(1 for entry in normalized_members if entry["attended"]),
        }

    def _dispatch(name: str, args: dict):
        if name == "get_rooms":
            return _exec_get_rooms()
        if name == "get_reservations":
            return _exec_get_reservations(**args)
        if name == "check_availability":
            return _exec_check_availability(**args)
        if name == "create_reservation":
            return _exec_create_reservation(**args)
        if name == "get_cell_group_members":
            return _exec_get_cell_group_members(**args)
        if name == "update_cell_group_member":
            return _exec_update_cell_group_member(**args)
        if name == "create_cell_report":
            return _exec_create_cell_report(**args)
        return {"error": f"Unknown tool: {name}"}

    # ── AI tool-call loop ─────────────────────────────────────────────────
    model_name = os.getenv("OPENAI_MODEL", default_model)
    try:
        for _ in range(6):  # max 6 iterations
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=_CHAT_TOOLS,
                tool_choice="auto",
            )
            choice = response.choices[0]
            msg = choice.message

            # Append assistant message
            assistant_msg: dict = {"role": "assistant"}
            if msg.content:
                assistant_msg["content"] = msg.content
            if msg.tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ]
            messages.append(assistant_msg)

            if choice.finish_reason == "tool_calls" and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_args = json.loads(tc.function.arguments)
                    result = _dispatch(tc.function.name, tool_args)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps(result, ensure_ascii=False, default=str),
                        }
                    )
            else:
                return {"message": msg.content or ""}

        return {"message": "처리 시간이 초과되었습니다. 다시 시도해주세요."}
    except Exception as exc:
        print(f"[chat] Gemini error: {exc}")
        exc_str = str(exc)
        if "429" in exc_str or "quota" in exc_str.lower():
            return {"message": "Gemini API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.", "error": True}
        if "401" in exc_str or "invalid" in exc_str.lower():
            return {"message": "GEMINI_API_KEY가 유효하지 않습니다. .env 파일을 확인해주세요.", "error": True}
        return {"message": f"AI 처리 중 오류가 발생했습니다: {exc}", "error": True}


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


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
