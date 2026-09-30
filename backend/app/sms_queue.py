"""Twilio SMS delivery and persistent background queue."""
import asyncio
import logging
import os
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from .database import SessionLocal
from .models import EmailStatus, SmsQueueItem

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
POLL_INTERVAL_SECONDS = 5


def normalize_phone_number(phone: str) -> str:
    """Return a US/Canada number in E.164 format."""
    value = phone.strip()
    if value.startswith("+"):
        digits = re.sub(r"\D", "", value)
        if 8 <= len(digits) <= 15:
            return f"+{digits}"
    else:
        digits = re.sub(r"\D", "", value)
        if len(digits) == 10:
            return f"+1{digits}"
        if len(digits) == 11 and digits.startswith("1"):
            return f"+{digits}"
    raise ValueError("phone number must be a valid E.164 or 10-digit US/Canada number")


def send_sms_now(to_phone: str, body: str) -> tuple[bool, str]:
    """Send one SMS immediately and return (success, provider message ID/error)."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
    from_phone = os.getenv("TWILIO_FROM_NUMBER", "")

    if not account_sid or not auth_token or not (messaging_service_sid or from_phone):
        logger.warning("[sms] Twilio is not configured; message to %s was not sent", to_phone)
        return False, "Twilio is not configured"

    try:
        normalized_phone = normalize_phone_number(to_phone)
        create_args = {"to": normalized_phone, "body": body}
        if messaging_service_sid:
            create_args["messaging_service_sid"] = messaging_service_sid
        else:
            create_args["from_"] = normalize_phone_number(from_phone)
        message = Client(account_sid, auth_token).messages.create(**create_args)
        logger.info("[sms] queued by Twilio for %s (sid=%s)", normalized_phone, message.sid)
        return True, message.sid
    except (TwilioRestException, ValueError) as exc:
        logger.error("[sms] delivery failed for %s: %s", to_phone, exc)
        return False, str(exc)
    except Exception as exc:
        logger.error("[sms] unexpected delivery error for %s: %s", to_phone, exc)
        return False, str(exc)


def queue_sms(db: Session, to_phone: str, body: str) -> bool:
    """Queue an SMS for background delivery."""
    try:
        normalized_phone = normalize_phone_number(to_phone)
        db.add(SmsQueueItem(to_phone=normalized_phone, body=body))
        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        logger.error("[sms-queue] failed to queue SMS to %s: %s", to_phone, exc)
        return False


def process_sms_queue_once() -> int:
    db = SessionLocal()
    sent_count = 0
    try:
        pending = db.scalars(
            select(SmsQueueItem)
            .where(SmsQueueItem.status == EmailStatus.pending)
            .order_by(SmsQueueItem.created_at.asc())
        ).all()

        for item in pending:
            ok, result = send_sms_now(item.to_phone, item.body)
            item.attempts += 1
            if ok:
                item.status = EmailStatus.sent
                item.provider_message_id = result
                item.last_error = ""
                item.sent_at = datetime.utcnow()
                sent_count += 1
            else:
                item.last_error = result
                if item.attempts >= MAX_ATTEMPTS:
                    item.status = EmailStatus.failed
            db.commit()
    finally:
        db.close()
    return sent_count


async def sms_queue_worker() -> None:
    while True:
        try:
            sent = await asyncio.to_thread(process_sms_queue_once)
            if sent:
                logger.info("[sms-queue] sent %s message(s)", sent)
        except Exception as exc:
            logger.error("[sms-queue] worker error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL_SECONDS)