import json
import os
import random
from datetime import date, datetime
from typing import Callable
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .models import (
    CellReport,
    CellReportMemberEntry,
    Member,
    Reservation,
    ReservationStatus,
    Room,
)
from .schemas import ChatRequest


AnalyzeCellReportsFn = Callable[[Session, str, int], dict]
AnalyzeCellReportByDateFn = Callable[[Session, str, date], dict]
AnalyzeMemberPrayerTrendFn = Callable[[Session, str, str, int], dict]


def create_ai_chat_router(
    analyze_cell_reports: AnalyzeCellReportsFn,
    analyze_cell_report_by_date: AnalyzeCellReportByDateFn,
    analyze_member_prayer_trend: AnalyzeMemberPrayerTrendFn,
) -> APIRouter:
    router = APIRouter()

    def _get_gemini_client() -> tuple[object | None, dict | None]:
        try:
            from openai import OpenAI
        except ImportError:
            return None, {"message": "openai 패키지가 설치되지 않았습니다. requirements.txt를 확인하세요.", "error": True}

        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            return None, {
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
        return client, None

    chat_tools = [
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
        {
            "type": "function",
            "function": {
                "name": "get_cell_report_analysis",
                "description": "Analyze yearly cell report summaries for the current user's cell group. Returns attendance and prayer-sharing overview.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "year": {
                            "type": "integer",
                            "description": "Target year (e.g. 2026). If omitted, current year is used.",
                        }
                    },
                    "required": [],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_cell_report_date_analysis",
                "description": "Analyze one cell report on a specific meeting date in the current cell group.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "meeting_date": {
                            "type": "string",
                            "description": "Target meeting date in YYYY-MM-DD format",
                        }
                    },
                    "required": ["meeting_date"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_member_prayer_trend",
                "description": "Analyze how one member's prayer topics changed over recent months in the current cell group.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "member_name": {
                            "type": "string",
                            "description": "Member name to analyze (e.g., 홍길동)",
                        },
                        "months": {
                            "type": "integer",
                            "description": "How many recent months to analyze (default 5, max 24)",
                        },
                    },
                    "required": ["member_name"],
                },
            },
        },
    ]

    @router.get("/api/chat/encouraging-verse")
    def get_encouraging_verse(language: str = Query(default="ko")) -> dict:
        ko_fallback = [
            "두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라. (이사야 41:10)",
            "수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라. (마태복음 11:28)",
            "아무 것도 염려하지 말고 오직 모든 일에 기도와 간구로 너희 구할 것을 하나님께 아뢰라. (빌립보서 4:6)",
        ]
        en_fallback = [
            "Do not fear, for I am with you; do not be dismayed, for I am your God. (Isaiah 41:10)",
            "Come to me, all you who are weary and burdened, and I will give you rest. (Matthew 11:28)",
            "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God. (Philippians 4:6)",
        ]

        is_ko = (language or "ko").lower().startswith("ko")
        fallback = ko_fallback if is_ko else en_fallback

        client, error_payload = _get_gemini_client()
        if error_payload:
            return {"verse": random.choice(fallback), "source": "fallback"}

        try:
            model_name = os.getenv("OPENAI_MODEL", "gemini-2.5-flash")
            lang_instruction = "Korean" if is_ko else "English"
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You provide one short encouraging Bible verse for church users. "
                            "Return plain text only, including verse reference in parentheses."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Please give exactly one comforting Bible verse in {lang_instruction}. "
                            "No bullet points, no extra explanation."
                        ),
                    },
                ],
            )
            content = (response.choices[0].message.content or "").strip()
            if content:
                return {"verse": content, "source": "gemini"}
        except Exception:
            pass

        return {"verse": random.choice(fallback), "source": "fallback"}

    @router.post("/api/chat")
    def chat_with_ai(
        payload: ChatRequest,
        db: Session = Depends(get_db),
    ) -> dict:
        """AI-powered natural language chat endpoint (Gemini)"""
        client, error_payload = _get_gemini_client()
        if error_payload:
            return error_payload
        default_model = "gemini-2.5-flash"

        rooms = db.scalars(select(Room).where(Room.is_active.is_(True)).order_by(Room.id)).all()
        rooms_info = "\n".join(
            [f"  - ID {r.id}: {r.name} (수용: {r.capacity}명, {r.floor}층, {r.description})" for r in rooms]
        )
        now_eastern = datetime.now(ZoneInfo("America/New_York"))
        utc_offset_hours = int(now_eastern.utcoffset().total_seconds() / 3600)
        tz_label = f"EDT (UTC{utc_offset_hours:+d})" if utc_offset_hours == -4 else f"EST (UTC{utc_offset_hours:+d})"
        lang_hint = "Please respond in Korean (한국어로 응답하세요)." if payload.language == "ko" else "Please respond in English."

        user_ctx = ""
        if payload.user_name:
            user_ctx = f"\nCurrently logged-in user: name={payload.user_name}"
            if payload.user_title:
                user_ctx += f", title={payload.user_title}"
            if payload.user_cell_group:
                user_ctx += f", cell_group={payload.user_cell_group}"

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
6. If the user asks for insights: analyze yearly cell report data (attendance and prayer-sharing patterns)
7. If the user asks for a specific date: analyze that day's cell report in detail
8. If the user asks about one person: analyze changes in that member's prayer topics over recent months

Important rules:
- The server stores times as-is without timezone conversion. Pass times EXACTLY as the user specifies them (do NOT add or subtract hours for UTC conversion).
- For example, if the user says "6pm tomorrow", pass "YYYY-MM-DDT18:00:00" as-is.
- Always call check_availability before create_reservation.
- For create_reservation, use the logged-in user's name/phone/email from the context. If the user is not logged in (no user info), inform them they must log in first.
- After creating a reservation, the status is 'pending' and requires admin approval.
- For cell group tools (get_cell_group_members, update_cell_group_member): only available when user title is '순장'.
- For create_cell_report: only available when user title is '순장'. Gather meeting date/time/place, attendance, member prayer topics, and overall prayer topics before saving.
- For get_cell_report_analysis: only available when user title is '순장' (or admin). Use it when user asks questions like "who had the lowest attendance this year".
- For get_cell_report_date_analysis: use when user asks about one meeting date, such as "2026-06-10 순모임 보고 분석해줘".
- For get_member_prayer_trend: use when user asks questions like "OOO의 기도제목이 지난 5개월간 어떻게 변했나요?".
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
                    "requester_name": i.requester_name,
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
                return {"error": "순 정보가 없습니다. 로그인 상태를 확인해주세요."}
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
                return {"error": "같은 순 멤버만 수정할 수 있습니다."}
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
                return {"error": "순 정보가 없습니다. 로그인 상태를 확인해주세요."}

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
                    return {"error": "같은 순 멤버만 순보고에 포함할 수 있습니다."}
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

        def _exec_get_cell_report_analysis(year: int | None = None) -> dict:
            if not payload.user_cell_group:
                return {"error": "순 정보가 없습니다. 로그인 상태를 확인해주세요."}

            me = db.scalar(
                select(Member)
                .where(Member.name == payload.user_name, Member.cell_group == payload.user_cell_group)
                .limit(1)
            )
            if not me or (me.title != "순장" and me.permission != "admin"):
                return {"error": "순장(또는 관리자) 권한이 있는 사용자만 순보고 분석에 접근할 수 있습니다."}

            target_year = year or datetime.now().year
            if target_year < 2000 or target_year > 2100:
                return {"error": "year 값이 올바르지 않습니다."}

            return analyze_cell_reports(db=db, cell_group=payload.user_cell_group, year=target_year)

        def _exec_get_cell_report_date_analysis(meeting_date: str) -> dict:
            if not payload.user_cell_group:
                return {"error": "순 정보가 없습니다. 로그인 상태를 확인해주세요."}

            me = db.scalar(
                select(Member)
                .where(Member.name == payload.user_name, Member.cell_group == payload.user_cell_group)
                .limit(1)
            )
            if not me or (me.title != "순장" and me.permission != "admin"):
                return {"error": "순장(또는 관리자) 권한이 있는 사용자만 순보고 분석에 접근할 수 있습니다."}

            try:
                target_date = date.fromisoformat(meeting_date)
            except ValueError:
                return {"error": "meeting_date 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요."}

            return analyze_cell_report_by_date(
                db=db,
                cell_group=payload.user_cell_group,
                meeting_date=target_date,
            )

        def _exec_get_member_prayer_trend(member_name: str, months: int = 5) -> dict:
            if not payload.user_cell_group:
                return {"error": "순 정보가 없습니다. 로그인 상태를 확인해주세요."}

            me = db.scalar(
                select(Member)
                .where(Member.name == payload.user_name, Member.cell_group == payload.user_cell_group)
                .limit(1)
            )
            if not me or (me.title != "순장" and me.permission != "admin"):
                return {"error": "순장(또는 관리자) 권한이 있는 사용자만 개인 기도제목 분석에 접근할 수 있습니다."}

            return analyze_member_prayer_trend(
                db=db,
                cell_group=payload.user_cell_group,
                member_name=member_name,
                months=months,
            )

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
            if name == "get_cell_report_analysis":
                return _exec_get_cell_report_analysis(**args)
            if name == "get_cell_report_date_analysis":
                return _exec_get_cell_report_date_analysis(**args)
            if name == "get_member_prayer_trend":
                return _exec_get_member_prayer_trend(**args)
            return {"error": f"Unknown tool: {name}"}

        model_name = os.getenv("OPENAI_MODEL", default_model)
        try:
            for _ in range(6):
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    tools=chat_tools,
                    tool_choice="auto",
                )
                choice = response.choices[0]
                msg = choice.message

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

    return router
