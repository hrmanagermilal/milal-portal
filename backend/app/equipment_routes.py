import base64
import binascii
import os
import re
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from .auth_routes import get_current_user
from .database import get_db
from .email_queue import queue_email
from .models import Equipment, EquipmentReservation, Member, ReservationStatus
from .schemas import (
    EquipmentCreate,
    EquipmentReservationAdminUpdate,
    EquipmentReservationCreate,
    EquipmentReservationReview,
    EquipmentUpdate,
)
from .sms_queue import queue_sms

router = APIRouter(prefix="/api/equipment", tags=["equipment"])
PROJECT_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_DIR = Path(os.getenv("EQUIPMENT_UPLOAD_DIR", PROJECT_ROOT / "uploads" / "equipment"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_PATTERN = re.compile(r"^data:(image/jpeg|image/png|image/webp);base64,([A-Za-z0-9+/=\s]+)$")
IMAGE_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ACTIVE_STATUSES = (ReservationStatus.pending, ReservationStatus.approved, ReservationStatus.changed)

def _require_admin(user: Member) -> None:
    if user.permission != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")

def _reserved_quantity(
    db: Session,
    equipment_id: int,
    start_date: date,
    end_date: date,
    exclude_reservation_id: int | None = None,
) -> int:
    statement = select(func.coalesce(func.sum(EquipmentReservation.quantity), 0)).where(
            EquipmentReservation.equipment_id == equipment_id,
            EquipmentReservation.start_date <= end_date,
            or_(
                and_(
                    EquipmentReservation.status.in_((ReservationStatus.pending, ReservationStatus.changed)),
                    EquipmentReservation.end_date >= start_date,
                ),
                and_(
                    EquipmentReservation.status == ReservationStatus.approved,
                    EquipmentReservation.returned_at.is_(None),
                ),
            ),
        )
    if exclude_reservation_id is not None:
        statement = statement.where(EquipmentReservation.id != exclude_reservation_id)
    return db.scalar(statement) or 0

def _save_image(data_url: str) -> str:
    match = IMAGE_PATTERN.fullmatch(data_url)
    if not match:
        raise HTTPException(status_code=422, detail="사진은 JPEG, PNG 또는 WebP 형식이어야 합니다.")
    mime_type, encoded = match.groups()
    try:
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise HTTPException(status_code=422, detail="사진 데이터가 올바르지 않습니다.") from error
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="사진은 5MB 이하여야 합니다.")
    filename = f"{uuid4().hex}{IMAGE_EXTENSIONS[mime_type]}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return f"/uploads/equipment/{filename}"

def _equipment_dict(item: Equipment, available_quantity: int | None = None) -> dict:
    result = {
        "id": item.id,
        "name": item.name,
        "storage_location": item.storage_location,
        "total_quantity": item.total_quantity,
        "image_url": item.image_url,
        "is_active": item.is_active,
    }
    if available_quantity is not None:
        result["available_quantity"] = available_quantity
    return result

def _reservation_dict(item: EquipmentReservation) -> dict:
    return {
        "id": item.id,
        "equipment_id": item.equipment_id,
        "equipment_name": item.equipment.name if item.equipment else "",
        "requester_name": item.requester_name,
        "quantity": item.quantity,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "purpose": item.purpose,
        "status": item.status.value,
        "admin_comment": item.admin_comment,
        "returned_at": item.returned_at,
        "returned_by_member_id": item.returned_by_member_id,
        "created_at": item.created_at,
    }

def _build_review_notifications(item: EquipmentReservation, action: str) -> tuple[str, str, str]:
    status = "승인되었습니다" if action == "approve" else "거절되었습니다"
    equipment_name = item.equipment.name if item.equipment else "물품"
    subject = f"[밀알교회] 물품 예약 {status} - {equipment_name}"
    email_body = f"""안녕하세요, {item.requester_name}님.

물품 예약 신청이 {status}.

【 예약 정보 】
- 예약 ID: #{item.id}
- 물품: {equipment_name}
- 수량: {item.quantity}개
- 사용 기간: {item.start_date.isoformat()} ~ {item.end_date.isoformat()}
- 용도: {item.purpose}

【 처리 결과 】
- 상태: {status}
- 관리자 메모: {item.admin_comment or '없음'}

자세한 내용은 밀알 커뮤니티에서 확인하실 수 있습니다.

밀알교회"""
    sms_body = (
        f"[Milal Church] 물품 예약이 {status}. "
        f"{equipment_name} {item.quantity}개, "
        f"{item.start_date.isoformat()}~{item.end_date.isoformat()}. "
        f"예약 ID #{item.id}"
    )
    return subject, email_body, sms_body

@router.get("")
def list_equipment(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
) -> list[dict]:
    del current_user
    items = db.scalars(select(Equipment).where(Equipment.is_active.is_(True)).order_by(Equipment.name)).all()
    if start_date and end_date:
        if end_date < start_date:
            raise HTTPException(status_code=422, detail="종료일은 시작일 이후여야 합니다.")
        return [_equipment_dict(item, item.total_quantity - _reserved_quantity(db, item.id, start_date, end_date)) for item in items]
    return [_equipment_dict(item) for item in items]

@router.get("/reservations")
def list_reservations(
    equipment_id: int | None = None,
    pending_only: bool = False,
    return_pending_only: bool = False,
    approved_only: bool = False,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
) -> list[dict]:
    statement = select(EquipmentReservation).options(joinedload(EquipmentReservation.equipment)).order_by(EquipmentReservation.start_date, EquipmentReservation.id)
    if equipment_id:
        statement = statement.where(EquipmentReservation.equipment_id == equipment_id)
    if pending_only or return_pending_only or approved_only:
        _require_admin(current_user)
    if pending_only:
        statement = statement.where(EquipmentReservation.status == ReservationStatus.pending)
    elif return_pending_only:
        statement = statement.where(
            EquipmentReservation.status == ReservationStatus.approved,
            EquipmentReservation.end_date <= date.today(),
            EquipmentReservation.returned_at.is_(None),
        )
    elif approved_only:
        statement = statement.where(
            EquipmentReservation.status == ReservationStatus.approved,
            EquipmentReservation.returned_at.is_(None),
        )
    else:
        statement = statement.where(
            EquipmentReservation.status.in_(ACTIVE_STATUSES),
            or_(
                EquipmentReservation.end_date >= date.today(),
                and_(
                    EquipmentReservation.status == ReservationStatus.approved,
                    EquipmentReservation.returned_at.is_(None),
                ),
            ),
        )
    return [_reservation_dict(item) for item in db.scalars(statement).all()]

@router.post("/reservations", status_code=201)
def create_reservation(
    payload: EquipmentReservationCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
) -> dict:
    if payload.start_date < date.today():
        raise HTTPException(status_code=422, detail="오늘 이전 날짜는 예약할 수 없습니다.")
    equipment = db.get(Equipment, payload.equipment_id)
    if not equipment or not equipment.is_active:
        raise HTTPException(status_code=404, detail="물품을 찾을 수 없습니다.")
    available = equipment.total_quantity - _reserved_quantity(db, equipment.id, payload.start_date, payload.end_date)
    if payload.quantity > available:
        raise HTTPException(status_code=409, detail=f"해당 기간에는 최대 {available}개까지 예약할 수 있습니다.")
    item = EquipmentReservation(
        equipment_id=equipment.id,
        requester_member_id=current_user.id,
        requester_name=current_user.name,
        quantity=payload.quantity,
        start_date=payload.start_date,
        end_date=payload.end_date,
        purpose=payload.purpose,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item.equipment = equipment
    return _reservation_dict(item)

@router.patch("/reservations/{reservation_id}")
def review_reservation(
    reservation_id: int,
    payload: EquipmentReservationReview,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
) -> dict:
    _require_admin(current_user)
    item = db.scalar(select(EquipmentReservation).options(joinedload(EquipmentReservation.equipment)).where(EquipmentReservation.id == reservation_id))
    if not item:
        raise HTTPException(status_code=404, detail="예약 신청을 찾을 수 없습니다.")
    item.status = ReservationStatus.approved if payload.action == "approve" else ReservationStatus.rejected
    item.admin_comment = payload.admin_comment
    db.commit()
    db.refresh(item)

    requester = db.get(Member, item.requester_member_id)
    if requester:
        subject, email_body, sms_body = _build_review_notifications(item, payload.action)
        if requester.email:
            queue_email(db, requester.email, subject, email_body)
        if requester.phone:
            queue_sms(db, requester.phone, sms_body)

    return _reservation_dict(item)


@router.patch("/reservations/{reservation_id}/details")
def update_approved_reservation(
    reservation_id: int,
    payload: EquipmentReservationAdminUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
) -> dict:
    _require_admin(current_user)
    item = db.scalar(
        select(EquipmentReservation)
        .options(joinedload(EquipmentReservation.equipment))
        .where(EquipmentReservation.id == reservation_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="예약 신청을 찾을 수 없습니다.")
    if item.status != ReservationStatus.approved:
        raise HTTPException(status_code=409, detail="승인된 예약만 수정할 수 있습니다.")
    if item.returned_at is not None:
        raise HTTPException(status_code=409, detail="반납 확인된 예약은 수정할 수 없습니다.")

    equipment = db.get(Equipment, payload.equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="물품을 찾을 수 없습니다.")
    available = equipment.total_quantity - _reserved_quantity(
        db,
        equipment.id,
        payload.start_date,
        payload.end_date,
        exclude_reservation_id=item.id,
    )
    if payload.quantity > available:
        raise HTTPException(status_code=409, detail=f"해당 기간에는 최대 {available}개까지 예약할 수 있습니다.")

    item.equipment_id = equipment.id
    item.quantity = payload.quantity
    item.start_date = payload.start_date
    item.end_date = payload.end_date
    item.purpose = payload.purpose.strip()
    item.admin_comment = payload.admin_comment
    db.commit()
    db.refresh(item)
    item.equipment = equipment
    return _reservation_dict(item)


@router.patch("/reservations/{reservation_id}/return")
def confirm_reservation_return(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
) -> dict:
    _require_admin(current_user)
    item = db.scalar(
        select(EquipmentReservation)
        .options(joinedload(EquipmentReservation.equipment))
        .where(EquipmentReservation.id == reservation_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="예약 신청을 찾을 수 없습니다.")
    if item.status != ReservationStatus.approved:
        raise HTTPException(status_code=409, detail="승인된 예약만 반납 확인할 수 있습니다.")
    if item.end_date > date.today():
        raise HTTPException(status_code=409, detail="사용 종료일 이후에 반납 확인할 수 있습니다.")
    if item.returned_at is not None:
        raise HTTPException(status_code=409, detail="이미 반납 확인된 예약입니다.")

    item.returned_at = datetime.utcnow()
    item.returned_by_member_id = current_user.id
    db.commit()
    db.refresh(item)
    return _reservation_dict(item)

@router.get("/admin/items")
def admin_list_equipment(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)) -> list[dict]:
    _require_admin(current_user)
    return [_equipment_dict(item) for item in db.scalars(select(Equipment).order_by(Equipment.name)).all()]

@router.post("/admin/items", status_code=201)
def create_equipment(payload: EquipmentCreate, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    item = Equipment(name=payload.name.strip(), storage_location=payload.storage_location.strip(), total_quantity=payload.total_quantity, is_active=payload.is_active)
    if payload.image_data_url:
        item.image_url = _save_image(payload.image_data_url)
    db.add(item)
    try:
        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="같은 이름의 물품이 이미 있습니다.") from error
    db.refresh(item)
    return _equipment_dict(item)

@router.patch("/admin/items/{equipment_id}")
def update_equipment(equipment_id: int, payload: EquipmentUpdate, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    item = db.get(Equipment, equipment_id)
    if not item:
        raise HTTPException(status_code=404, detail="물품을 찾을 수 없습니다.")
    changes = payload.model_dump(exclude_unset=True)
    image_data_url = changes.pop("image_data_url", None)
    for field, value in changes.items():
        setattr(item, field, value.strip() if isinstance(value, str) else value)
    if image_data_url:
        item.image_url = _save_image(image_data_url)
    db.commit()
    db.refresh(item)
    return _equipment_dict(item)