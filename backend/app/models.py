import enum
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# ── Enums ──────────────────────────────────────────────────────────────────
class MembershipCategory(str, enum.Enum):
    youth = "youth"
    adult = "adult"


class RuleType(str, enum.Enum):
    day_of_week = "day_of_week"
    specific_date = "specific_date"


class AttendanceType(str, enum.Enum):
    present = "present"
    absent = "absent"
    long_absence = "long_absence"


# ── Member (church directory) ──────────────────────────────────────────────
class Member(Base):
    __tablename__ = "members"

    # 기본 식별 정보
    id:           Mapped[int] = mapped_column(Integer, primary_key=True, index=True)  # member_id (OHJIC)
    name:         Mapped[str] = mapped_column(String(100), nullable=False)  # member_name
    email:        Mapped[str] = mapped_column(String(255), default="")
    phone:        Mapped[str] = mapped_column(String(30),  default="")  # mobile_phone
    
    # 세대/가족 정보
    family_id:    Mapped[int] = mapped_column(Integer, nullable=True)  # 세대(가족) 식별자
    family_relation: Mapped[str] = mapped_column(String(50), default="")  # 세대 내 관계
    family_head_name: Mapped[str] = mapped_column(String(100), default="")  # 세대주 이름
    
    # 개인 정보
    gender:       Mapped[str] = mapped_column(String(1), default="")  # M=남, F=여
    birth_year:   Mapped[int] = mapped_column(Integer, nullable=True)  # 출생연도
    birth_date:   Mapped[date] = mapped_column(Date, nullable=True)  # 생년월일
    
    # 교회 역할 및 지위
    title:        Mapped[str] = mapped_column(String(50), default="")  # position_name (직분명)
    position_code: Mapped[int] = mapped_column(Integer, nullable=True)  # 직분 코드
    position_order: Mapped[int] = mapped_column(Integer, nullable=True)  # 직분 정렬순서
    
    # 신급(세례/입교 등)
    church_level_name: Mapped[str] = mapped_column(String(50), default="")  # 신급명
    church_level_code: Mapped[int] = mapped_column(Integer, nullable=True)  # 신급 코드
    church_level_order: Mapped[int] = mapped_column(Integer, nullable=True)  # 신급 정렬순서
    church_level_date: Mapped[date] = mapped_column(Date, nullable=True)  # 집례(세례)일
    church_level_church: Mapped[str] = mapped_column(String(100), default="")  # 집례 교회
    
    # 교인 구분
    member_category1_code: Mapped[int] = mapped_column(Integer, nullable=True)  # 교인구분1 코드
    member_category1_name: Mapped[str] = mapped_column(String(50), default="")  # 교인구분1 명칭
    member_category2_code: Mapped[int] = mapped_column(Integer, nullable=True)  # 교인구분2 코드
    member_category2_name: Mapped[str] = mapped_column(String(50), default="")  # 교인구분2 명칭
    member_category_updated_at: Mapped[date] = mapped_column(Date, nullable=True)  # 교인구분 변경일
    membership_status: Mapped[str] = mapped_column(String(20), default="")  # member/unclassified/non_member
    
    # 소속 그룹
    group_category_name: Mapped[str] = mapped_column(String(100), default="")  # 소속 분류명(교구 등)
    cell_group:   Mapped[str] = mapped_column(String(100), default="")  # group_names[-1] (마지막 항목)
    
    # 주소 정보
    postal_code_jibun: Mapped[str] = mapped_column(String(20), default="")  # 우편번호(지번)
    postal_code_road: Mapped[str] = mapped_column(String(20), default="")  # 우편번호(도로명)
    address:      Mapped[str] = mapped_column(String(255), default="")  # address_jibun (지번주소)
    address_detail: Mapped[str] = mapped_column(String(255), default="")  # 상세주소
    address_road: Mapped[str] = mapped_column(String(255), default="")  # 도로명주소
    
    # 추가 정보
    photo_url:    Mapped[str] = mapped_column(String(500), default="")  # 프로필 사진 URL
    
    # 시스템 필드 (Milal Portal specific)
    user_id:      Mapped[str] = mapped_column(String(30), default="")  # 로그인 계정
    permission:   Mapped[str] = mapped_column(String(20), default="")  # admin/manager/member
    accessible:   Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 포털 접근 여부
    
    # 타임스탬프
    created_at:   Mapped[datetime] = mapped_column(DateTime, nullable=True)  # 교회 등록일시
    welcomed_at:  Mapped[date] = mapped_column(Date, nullable=True)  # 교회 환영일
    updated_at:   Mapped[datetime] = mapped_column(DateTime, nullable=True)  # 최종 수정일시
    
    # 자유항목 (member_custom_1 ~ member_custom_9)
    custom_1:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_1
    custom_2:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_2
    custom_3:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_3
    custom_4:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_4
    custom_5:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_5
    custom_6:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_6
    custom_7:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_7
    custom_8:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_8
    custom_9:     Mapped[str] = mapped_column(String(255), default="")  # member_custom_9
    
    # 관계
    user:      Mapped[Optional["User"]]      = relationship(back_populates="member", uselist=False)
    otp_codes: Mapped[list["OtpCode"]]       = relationship(back_populates="member")
    change_logs: Mapped[list["MemberChangeLog"]] = relationship(back_populates="member")
    cell_reports: Mapped[list["CellReport"]] = relationship(back_populates="leader")
    cell_report_entries: Mapped[list["CellReportMemberEntry"]] = relationship(back_populates="member")

    @property
    def computed_membership_category(self) -> str:
        """
        Compute membership_category based on group_category_name.
        '장년부' -> 'adult', others -> 'youth'
        """
        if self.group_category_name.strip() == "장년부":
            return "adult"
        return "youth"


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


# ── Expense request ────────────────────────────────────────────────────────
class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    requester_member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False, index=True)
    account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("expense_accounts.id"), nullable=True, index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("expense_account_categories.id"), nullable=True, index=True)
    request_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    memo: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="reviewing", nullable=False, index=True)
    hst_amount: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    items: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    attachments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    approvals: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class ExpenseAccount(Base):
    __tablename__ = "expense_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_code: Mapped[str] = mapped_column(String(100), nullable=False, default="", index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    budget_amount: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExpenseAccountCategory(Base):
    __tablename__ = "expense_account_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("expense_accounts.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False, default=lambda: datetime.utcnow().year, index=True)
    budget_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExpenseApprovalRoute(Base):
    __tablename__ = "expense_approval_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("expense_accounts.id"), nullable=False, unique=True, index=True)
    chairperson_member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    finance_elder_member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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

    # 15-minute reminder delivery tracking
    start_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    start_reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    end_reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

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

    # Optional target: null=all, otherwise youth/adult only
    membership_category: Mapped[Optional[MembershipCategory]] = mapped_column(Enum(MembershipCategory), nullable=True)

    # Time scope: all day or specific time range
    applies_all_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    
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

