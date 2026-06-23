import os
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import and_, select, text
from sqlalchemy.orm import Session, joinedload

from .database import Base, engine, get_db
from .models import Reservation, ReservationStatus, Room
from .schemas import (
    AdminUpdateReservation,
    ReservationCreate,
    ReservationOut,
    RoomCreate,
    RoomOut,
    RoomUpdate,
)

app = FastAPI(title="Milal Room Reservation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "milal-admin-key")
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


def require_admin_key(x_admin_key: str | None) -> None:
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="invalid admin key")


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
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> list[Room]:
    require_admin_key(x_admin_key)
    rooms = db.scalars(select(Room).order_by(Room.id)).all()
    return list(rooms)


@app.post("/api/admin/rooms", response_model=RoomOut)
def create_room_admin(
    payload: RoomCreate,
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Room:
    require_admin_key(x_admin_key)

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
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Room:
    require_admin_key(x_admin_key)

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
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    require_admin_key(x_admin_key)

    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    room.is_active = False
    db.commit()
    return {"message": "room deactivated"}


@app.post("/api/reservations", response_model=ReservationOut)
def create_reservation(payload: ReservationCreate, db: Session = Depends(get_db)) -> ReservationOut:
    validate_reservation_times(payload.start_time, payload.end_time)

    room = db.get(Room, payload.room_id)
    if not room or not room.is_active:
        raise HTTPException(status_code=404, detail="room not found")

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
                Reservation.start_time < payload.end_time,
                Reservation.end_time > payload.start_time,
            )
        )
        .limit(1)
    )
    if overlapping:
        raise HTTPException(status_code=409, detail="time slot conflicts with an existing reservation")

    new_item = Reservation(
        room_id=payload.room_id,
        requester_name=payload.requester_name,
        phone=payload.phone,
        email=payload.email,
        purpose=payload.purpose,
        attendees=payload.attendees,
        notes=payload.notes,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=ReservationStatus.pending,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return ReservationOut(
        id=new_item.id,
        room_id=new_item.room_id,
        room_name=room.name,
        requester_name=new_item.requester_name,
        phone=new_item.phone,
        email=new_item.email,
        purpose=new_item.purpose,
        attendees=new_item.attendees,
        notes=new_item.notes,
        start_time=new_item.start_time,
        end_time=new_item.end_time,
        status=new_item.status.value,
        admin_comment=new_item.admin_comment,
        created_at=new_item.created_at,
        updated_at=new_item.updated_at,
    )


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
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@app.patch("/api/admin/reservations/{reservation_id}", response_model=ReservationOut)
def update_reservation_by_admin(
    reservation_id: int,
    payload: AdminUpdateReservation,
    x_admin_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ReservationOut:
    require_admin_key(x_admin_key)

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
        created_at=item.created_at,
        updated_at=item.updated_at,
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
