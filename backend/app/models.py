import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ── Enums ──────────────────────────────────────────────────────────────────
class MembershipCategory(str, enum.Enum):
    youth = "youth"
    adult = "adult"


class RuleType(str, enum.Enum):
    day_of_week = "day_of_week"
    specific_date = "specific_date"
    membership_category = "membership_category"


class AttendanceType(str, enum.Enum):
    present = "present"
    absent = "absent"
    long_absence = "long_absence"


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
    cell_reports: Mapped[list["CellReport"]] = relationship(back_populates="leader")
    cell_report_entries: Mapped[list["CellReportMemberEntry"]] = relationship(back_populates="member")


# ── User (account with password) ───────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id:                   Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id:            Mapped[int] = mapped_column(ForeignKey("members.id"), unique=True, nullable=False)
    password_hash:        Mapped[str] = mapped_column(String(255), nullable=False)
    membership_category:  Mapped[MembershipCategory] = mapped_column(Enum(MembershipCategory), default=MembershipCategory.youth, nullable=False)
    created_at:           Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

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


# ── Cell Group Report ─────────────────────────────────────────────────────
class CellReport(Base):
    __tablename__ = "cell_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    leader_member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    cell_group: Mapped[str] = mapped_column(String(20), nullable=False)
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    meeting_time: Mapped[str] = mapped_column(String(20), default="")
    meeting_place: Mapped[str] = mapped_column(String(255), default="")
    overall_prayer: Mapped[str] = mapped_column(Text, default="")
    leader_comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    leader: Mapped["Member"] = relationship(back_populates="cell_reports")
    entries: Mapped[list["CellReportMemberEntry"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
    )


class CellReportMemberEntry(Base):
    __tablename__ = "cell_report_member_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("cell_reports.id"), nullable=False)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    attended: Mapped[bool] = mapped_column(Boolean, default=False)
    attendance_type: Mapped[AttendanceType] = mapped_column(Enum(AttendanceType), default=AttendanceType.absent)
    prayer: Mapped[str] = mapped_column(Text, default="")
    remarks: Mapped[str] = mapped_column(Text, default="")

    report: Mapped["CellReport"] = relationship(back_populates="entries")
    member: Mapped["Member"] = relationship(back_populates="cell_report_entries")


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
    location: Mapped[Optional["RoomLocation"]] = relationship(back_populates="room", uselist=False)
    rules: Mapped[list["ReservationRule"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class RoomLocation(Base):
    __tablename__ = "room_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), unique=True, nullable=False)
    
    # Coordinates in SVG viewBox (0-320 for x, 0-210 for y)
    x1: Mapped[float] = mapped_column(nullable=False)
    y1: Mapped[float] = mapped_column(nullable=False)
    x2: Mapped[float] = mapped_column(nullable=False)
    y2: Mapped[float] = mapped_column(nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    room: Mapped["Room"] = relationship(back_populates="location")


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

    # Repeat settings (for admin recurring reservations)
    repeat_type: Mapped[str] = mapped_column(String(20), default="none")  # "none", "weekly", "monthly"
    repeat_count: Mapped[int] = mapped_column(Integer, default=1)  # number of times to repeat
    parent_reservation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("reservations.id"), nullable=True)  # for grouping repeat instances

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    room: Mapped[Room] = relationship(back_populates="reservations")


class ReservationRule(Base):
    __tablename__ = "reservation_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    rule_type: Mapped[RuleType] = mapped_column(Enum(RuleType), nullable=False)
    
    # For day_of_week rule: 0=Sunday, 1=Monday, ..., 6=Saturday
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # For specific_date rule
    specific_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    # For membership_category rule
    membership_category: Mapped[Optional[MembershipCategory]] = mapped_column(Enum(MembershipCategory), nullable=True)
    
    # Whether the rule allows (True) or denies (False) access
    is_allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    room: Mapped[Room] = relationship(back_populates="rules")


class ReservationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    changed = "changed"
    rejected = "rejected"

