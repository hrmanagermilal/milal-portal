import os
from datetime import date, datetime, timedelta
from pathlib import Path
import re

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
from .ai_chat import create_ai_chat_router

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
