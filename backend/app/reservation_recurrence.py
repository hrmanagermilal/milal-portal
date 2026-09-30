import os
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def _add_calendar_months(value: datetime, months: int) -> datetime:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def calculate_recurrence_time(
    value: datetime,
    repeat_type: str,
    occurrence_index: int,
    timezone_name: str | None = None,
) -> datetime:
    """Advance a recurrence in local wall-clock time and return UTC."""
    if occurrence_index < 0:
        raise ValueError("occurrence_index must be non-negative")

    app_timezone = ZoneInfo(timezone_name or os.getenv("APP_TIMEZONE", "America/Toronto"))
    source_utc = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    local_value = source_utc.astimezone(app_timezone)

    if repeat_type == "weekly":
        recurring_value = local_value + timedelta(weeks=occurrence_index)
    elif repeat_type == "monthly":
        recurring_value = _add_calendar_months(local_value, occurrence_index)
    else:
        recurring_value = local_value

    return recurring_value.astimezone(timezone.utc)