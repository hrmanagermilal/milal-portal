"""Read-only Google Calendar integration (hr.manager.milal@gmail.com), via a
service account. Used to check/display conflicts with the staff calendar.

Fails soft: if the key file / calendar id / API call is unavailable, callers
get an empty list back and the reservation flow continues unaffected.
"""
import os
from datetime import datetime, timezone

_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
_service = None
_service_init_attempted = False


def _get_service():
    global _service, _service_init_attempted
    if _service is not None:
        return _service
    if _service_init_attempted:
        return None
    _service_init_attempted = True

    key_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")
    if not key_path:
        print("[google_calendar] GOOGLE_SERVICE_ACCOUNT_FILE is not set; integration disabled")
        return None
    if not os.path.exists(key_path):
        print(f"[google_calendar] key file not found at {key_path}; integration disabled")
        return None

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        credentials = service_account.Credentials.from_service_account_file(key_path, scopes=_SCOPES)
        _service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
        # print(f"[google_calendar] service initialized ok (key={key_path}, account={credentials.service_account_email})")
    except Exception as exc:  # pragma: no cover - defensive against missing/invalid key
        # print(f"[google_calendar] failed to init service: {exc}")
        _service = None

    return _service


def _rfc3339_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_event_time(value: dict) -> tuple[datetime | None, bool]:
    """Returns (datetime in UTC, is_all_day)."""
    if "dateTime" in value:
        dt = datetime.fromisoformat(value["dateTime"].replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc), False
    if "date" in value:
        dt = datetime.strptime(value["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return dt, True
    return None, False


def _parse_room_and_requester(title: str) -> tuple[str, str] | None:
    """Parse a '장소-신청자' formatted title into (room_name, requester_name).

    Returns None if the title doesn't match this format.
    """
    if not title or "-" not in title:
        return None
    room_name, _, requester_name = title.partition("-")
    room_name = room_name.strip()
    requester_name = requester_name.strip()
    if not room_name or not requester_name:
        return None
    return room_name, requester_name


def _get_calendar_ids() -> list[str]:
    """Comma-separated list of calendars to read (GOOGLE_CALENDAR_IDS), falling
    back to the single-calendar GOOGLE_CALENDAR_ID for backward compatibility.
    """
    raw = os.getenv("GOOGLE_CALENDAR_IDS") or os.getenv("GOOGLE_CALENDAR_ID") or ""
    return [cid.strip() for cid in raw.split(",") if cid.strip()]


def _list_events_for_calendar(
    service, calendar_id: str, start_time: datetime, end_time: datetime, valid_room_names: set[str]
) -> list[dict]:
    # print(
    #     f"[google_calendar] querying calendar_id={calendar_id!r} "
    #     f"range=[{_rfc3339_utc(start_time)} ~ {_rfc3339_utc(end_time)}] "
    #     f"valid_room_names={sorted(valid_room_names)}"
    # )

    try:
        response = service.events().list(
            calendarId=calendar_id,
            timeMin=_rfc3339_utc(start_time),
            timeMax=_rfc3339_utc(end_time),
            singleEvents=True,
            orderBy="startTime",
        ).execute()
    except Exception as exc:
        print(f"[google_calendar] list events failed for calendar_id={calendar_id!r}: {exc}")
        return []

    raw_items = response.get("items", [])
    # print(f"[google_calendar] calendar_id={calendar_id!r} returned {len(raw_items)} raw item(s)")

    events = []
    for item in raw_items:
        print(f"[google_calendar] RAW item ({calendar_id}): {item}")
        summary = item.get("summary") or ""
        if item.get("status") == "cancelled":
            print(f"[google_calendar] SKIP (cancelled): {summary!r}")
            continue
        if "summary" not in item and item.get("visibility") == "private":
            # print(
            #     f"[google_calendar] SKIP (event id={item.get('id')} is marked 'private' in Google Calendar, "
            #     "so the API hides its title from this service account — change the event's visibility "
            #     "to 'Default'/'Public' to fix)"
            # )
            continue
        parsed = _parse_room_and_requester(summary)
        if not parsed:
            print(f"[google_calendar] SKIP (title not '장소-신청자' format): {summary!r}")
            continue
        room_name, requester_name = parsed
        if room_name not in valid_room_names:
            print(
                f"[google_calendar] SKIP (unknown room {room_name!r} not in {sorted(valid_room_names)}): {summary!r}"
            )
            continue
        start, is_all_day = _parse_event_time(item.get("start", {}))
        end, _ = _parse_event_time(item.get("end", {}))
        if not start or not end:
            print(f"[google_calendar] SKIP (missing start/end): {summary!r}")
            continue
        # The event's description ("비고") field holds the purpose/details.
        purpose = (item.get("description") or "").strip()
        # print(
        #     f"[google_calendar] MATCH id={item.get('id')} room={room_name!r} requester={requester_name!r} "
        #     f"purpose={purpose!r} start={start} end={end} all_day={is_all_day}"
        # )
        events.append({
            "id": f"{calendar_id}:{item.get('id')}",
            "room_name": room_name,
            "requester_name": requester_name,
            "purpose": purpose,
            "start": start,
            "end": end,
            "all_day": is_all_day,
        })
   # print(f"[google_calendar] calendar_id={calendar_id!r}: {len(events)}/{len(raw_items)} event(s) matched")
    return events


def list_external_events(
    start_time: datetime, end_time: datetime, valid_room_names: set[str]
) -> list[dict]:
    """List '장소-신청자'-titled events across all configured staff calendars
    (GOOGLE_CALENDAR_IDS, comma-separated) that overlap [start_time, end_time]
    and whose room name is in `valid_room_names`.

    Events with any other title format, or an unrecognized room name, are
    silently skipped. Returns a list of {id, room_name, requester_name,
    purpose, start, end, all_day} dicts (UTC datetimes), where `purpose`
    comes from the event's description field. Empty list if the integration
    isn't configured or every calendar call fails.
    """
    service = _get_service()
    calendar_ids = _get_calendar_ids()
    if not service or not calendar_ids:
        # print(
        #     f"[google_calendar] list_external_events skipped: service={'ok' if service else 'None'}, "
        #     f"calendar_ids={calendar_ids}"
        # )
        return []

    events = []
    for calendar_id in calendar_ids:
        events.extend(_list_events_for_calendar(service, calendar_id, start_time, end_time, valid_room_names))
    # print(f"[google_calendar] {len(events)} total event(s) matched across {len(calendar_ids)} calendar(s)")
    return events
