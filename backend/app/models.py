import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ── Member (church directory) ──────────────────────────────────────────────
class Member(Base):
    __tablename__ = "members"

    id:           Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name:         Mapped[str] = mapped_column(String(100), nullable=False)
    car_plate: Mapped[str] = mapped_column(String(50),  default="")
    phone:        Mapped[str] = mapped_column(String(30),  default="")
    address:      Mapped[str] = mapped_column(String(255), default="")
    email:        Mapped[str] = mapped_column(String(255), default="")
    title:        Mapped[str] = mapped_column(String(12), default="")
    cell_group:   Mapped[str] = mapped_column(String(20), default="")
    user_id:      Mapped[str] = mapped_column(String(30), default="")
    permission:   Mapped[str] = mapped_column(String(20), default="")
    user:      Mapped[Optional["User"]]      = relationship(back_populates="member", uselist=False)
    otp_codes: Mapped[list["OtpCode"]]       = relationship(back_populates="member")
    change_logs: Mapped[list["MemberChangeLog"]] = relationship(back_populates="member")


# ── User (account with password) ───────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id:            Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id:     Mapped[int] = mapped_column(ForeignKey("members.id"), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin:      Mapped[bool] = mapped_column(Boolean, default=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member: Mapped["Member"] = relationship(back_populates="user")


# ── OTP codes ──────────────────────────────────────────────────────────────
class OtpCode(Base):
    __tablename__ = "otp_codes"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    member_id:  Mapped[int]      = mapped_column(ForeignKey("members.id"), nullable=False)
    code:       Mapped[str]      = mapped_column(String(4),   nullable=False)
    contact:    Mapped[str]      = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime,    nullable=False)
    used:       Mapped[bool]     = mapped_column(Boolean,     default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)

    member: Mapped["Member"] = relationship(back_populates="otp_codes")


# ── Member Change Log ──────────────────────────────────────────────────────
class MemberChangeLog(Base):
    __tablename__ = "member_change_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    changed_by: Mapped[str] = mapped_column(String(100)) # Could be member name or 'self'
    field_name: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[str] = mapped_column(Text)
    new_value: Mapped[str] = mapped_column(Text)

    member: Mapped["Member"] = relationship(back_populates="change_logs")


# ── Reservation status ──────────────────────────────────────────────────────
class ReservationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    changed = "changed"
    rejected = "rejected"


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")
    floor: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="room")


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)

    requester_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    purpose: Mapped[str] = mapped_column(String(255), nullable=False)
    attendees: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str] = mapped_column(Text, default="")

    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus),
        default=ReservationStatus.pending,
        nullable=False,
    )
    admin_comment: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    room: Mapped[Room] = relationship(back_populates="reservations")



class ReservationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    changed = "changed"
    rejected = "rejected"

