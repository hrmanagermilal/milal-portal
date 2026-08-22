import os
from calendar import monthrange
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ReservationRule


def _add_months(dt: datetime, months: int) -> datetime:
    month_index = (dt.month - 1) + months
    year = dt.year + month_index // 12
    month = (month_index % 12) + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _matches_rule_selector(rule: ReservationRule, target_start: datetime) -> bool:
    if rule.rule_type.value == "specific_date":
        return bool(rule.specific_date and rule.specific_date == target_start.date())
    if rule.rule_type.value == "day_of_week":
        return rule.day_of_week is not None and rule.day_of_week == target_start.weekday()
    return False


def _time_ranges_overlap(start_a, end_a, start_b, end_b) -> bool:
    return start_a < end_b and end_a > start_b


def _matches_rule_time_scope(rule: ReservationRule, reservation_start: datetime, reservation_end: datetime) -> bool:
    if rule.applies_all_day:
        return True

    if not rule.start_time or not rule.end_time:
        return False

    return _time_ranges_overlap(
        reservation_start.time(),
        reservation_end.time(),
        rule.start_time,
        rule.end_time,
    )


def _matches_rule_target(rule: ReservationRule, membership_category: str) -> bool:
    if rule.membership_category is None:
        return True
    return rule.membership_category.value == membership_category


def assess_reservation_eligibility(
    db: Session,
    room_id: int,
    start_time: datetime,
    end_time: datetime,
    membership_category: str = "adult",
    months_ahead_limit: int = 1,
) -> tuple[bool, str]:
    """Central eligibility check for reservations.

    Enforces in this order:
    1) end_time must be after start_time
    2) no past reservations
    3) no reservations beyond `months_ahead_limit` months from now
    4) reservation_rules deny logic by room/day/date/time/membership target
    """
    if end_time <= start_time:
        return False, "종료 시간은 시작 시간 이후여야 합니다."

    app_tz = ZoneInfo(os.getenv("APP_TIMEZONE", "America/Toronto"))
    now_local = datetime.now(app_tz)
    
    # Ensure start_time and end_time are timezone-aware
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=app_tz)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=app_tz)

    if start_time < now_local:
        return False, "과거 시간은 예약할 수 없습니다."

    # Calculate cutoff as naive datetime first, then localize to same timezone
    now_local_naive = now_local.replace(tzinfo=None)
    cutoff_naive = _add_months(now_local_naive, months_ahead_limit)
    cutoff = cutoff_naive.replace(tzinfo=app_tz)
    
    if start_time > cutoff:
        return False, "현재 시각 기준 1개월 이후 일정은 예약할 수 없습니다."

    rules = db.scalars(select(ReservationRule).where(ReservationRule.room_id == room_id)).all()
    matched_rules = [
        rule
        for rule in rules
        if _matches_rule_selector(rule, start_time)
        and _matches_rule_time_scope(rule, start_time, end_time)
        and _matches_rule_target(rule, membership_category)
    ]

    denied_rules = [rule for rule in matched_rules if not rule.is_allowed]
    if denied_rules:
        denied = denied_rules[0]
        target_label = denied.specific_date.isoformat() if denied.rule_type.value == "specific_date" else "해당 요일"
        if denied.applies_all_day:
            return False, f"{target_label}은(는) 종일 예약이 금지되어 있습니다."
        if not denied.start_time or not denied.end_time:
            return False, f"{target_label} 시간대는 예약이 금지되어 있습니다."
        return False, (
            f"{target_label} {denied.start_time.strftime('%H:%M')}~"
            f"{denied.end_time.strftime('%H:%M')} 시간대는 예약이 금지되어 있습니다."
        )

    return True, ""
