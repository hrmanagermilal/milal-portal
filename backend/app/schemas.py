from datetime import datetime
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
