from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class RoomOut(BaseModel):
    id: int
    name: str
    capacity: int
    description: str
    floor: int
    is_active: bool

    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    capacity: int = Field(ge=1)
    description: str = Field(default="", max_length=255)
    floor: int = Field(default=1, ge=1, le=2)
    is_active: bool = True


class RoomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    capacity: int | None = Field(default=None, ge=1)
    description: str | None = Field(default=None, max_length=255)
    floor: int | None = Field(default=None, ge=1, le=2)
    is_active: bool | None = None


class ReservationRuleCreate(BaseModel):
    rule_type: Literal["day_of_week", "specific_date", "membership_category"]
    day_of_week: int | None = Field(default=None, ge=0, le=6)  # 0=Sunday, 6=Saturday
    specific_date: date | None = None
    membership_category: Literal["youth", "adult"] | None = None
    is_allowed: bool = True


class ReservationRuleOut(BaseModel):
    id: int
    room_id: int
    rule_type: str
    day_of_week: int | None
    specific_date: date | None
    membership_category: str | None
    is_allowed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReservationRuleUpdate(BaseModel):
    is_allowed: bool | None = None


class ReservationCreate(BaseModel):
    room_id: int
    requester_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=30)
    email: EmailStr
    purpose: str = Field(min_length=3, max_length=255)
    attendees: int = Field(default=1, ge=1)
    notes: str = Field(default="", max_length=2000)
    start_time: datetime
    end_time: datetime
    permission: str = Field(default="member")
    # Admin repeat settings
    repeat_type: Literal["none", "weekly", "monthly"] = Field(default="none")
    repeat_count: int = Field(default=1, ge=1, le=52)  # max 52 weeks or 12 months


class ReservationOut(BaseModel):
    id: int
    room_id: int
    room_name: str
    requester_name: str
    phone: str
    email: EmailStr
    purpose: str
    attendees: int
    notes: str
    start_time: datetime
    end_time: datetime
    status: str
    admin_comment: str
    repeat_type: str
    repeat_count: int
    parent_reservation_id: int | None
    created_at: datetime
    updated_at: datetime


class AdminUpdateReservation(BaseModel):
    action: Literal["approve", "reject", "change"]
    room_id: int | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    admin_comment: str = ""

    @field_validator("room_id", "start_time", "end_time", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        if value == "":
            return None
        return value


# ── User Management schemas ────────────────────────────────────────────────
class UserOut(BaseModel):
    """User info for admin panel"""
    id: int
    member_id: int
    member_name: str
    member_email: str
    member_phone: str
    member_permission: str
    user_id: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=6)


class AdminUpdateUserRequest(BaseModel):
    permission: str = Field(default="member")  # "member" or "admin"


class ResetPasswordRequest(BaseModel):
    pass  # No body needed, just triggers password reset


class RoomLocationOut(BaseModel):
    id: int
    room_id: int
    x1: float
    y1: float
    x2: float
    y2: float
    
    model_config = {"from_attributes": True}


class RoomLocationCreate(BaseModel):
    room_id: int
    x1: float
    y1: float
    x2: float
    y2: float


class RoomLocationUpdate(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


# ── AI Chat ────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    user_name: str = ""
    user_phone: str = ""
    user_email: str = ""
    user_title: str = ""        # e.g. "순장"
    user_cell_group: str = ""   # cell group name
    language: str = "ko"


# ── Cell report ───────────────────────────────────────────────────────────
class CellReportMemberEntryCreate(BaseModel):
    member_id: int
    attended: bool = False
    attendance_type: str = "absent"  # "present", "absent", "long_absence"
    prayer: str = ""
    remarks: str = ""


class CellReportCreate(BaseModel):
    meeting_date: date
    meeting_time: str = ""
    meeting_place: str = ""
    overall_prayer: str = ""
    leader_comment: str = ""
    members: list[CellReportMemberEntryCreate] = []


class CellReportListItem(BaseModel):
    id: int
    meeting_date: date
    meeting_time: str
    meeting_place: str
    overall_prayer: str
    leader_comment: str
    attendee_count: int
    total_count: int
    prayer_recorded_count: int
    leader_name: str
    created_at: datetime


class CellReportMemberEntryOut(BaseModel):
    member_id: int
    member_name: str
    member_title: str
    attended: bool
    attendance_type: str
    prayer: str
    remarks: str


class CellReportDetailOut(BaseModel):
    id: int
    cell_group: str
    leader_name: str
    meeting_date: date
    meeting_time: str
    meeting_place: str
    overall_prayer: str
    leader_comment: str
    entries: list[CellReportMemberEntryOut]
    created_at: datetime
    updated_at: datetime
