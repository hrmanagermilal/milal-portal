"""Background email delivery queue.

Non-time-critical emails are queued (queue_email) into the `email_queue`
table instead of being sent inline. A background worker (email_queue_worker)
polls the table and delivers pending emails, retrying each up to
MAX_ATTEMPTS times before permanently marking it 'failed' (never retried
again). The worker idles quietly when the queue is empty and picks back up
as soon as something new is queued (within one poll interval).

Time-critical sends (OTP codes, password resets) should keep using
_send_email directly so their result can drive the HTTP response.
"""
import asyncio
import logging
import mimetypes
import os
import smtplib
from datetime import datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import EmailQueueItem, EmailStatus

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
POLL_INTERVAL_SECONDS = 5


def _send_email(to_addr: str, subject: str, body: str, content_type: str = "plain", attachments: list[dict] | None = None) -> bool:
    """Send email via SMTP right now. Returns True on success."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_pass:
        logger.warning(
            "[email – not configured] SMTP_HOST=%s, SMTP_USER=%s, SMTP_PASS=%s | To: %s",
            "✓" if smtp_host else "✗",
            "✓" if smtp_user else "✗",
            "✓" if smtp_pass else "✗",
            to_addr,
        )
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_from
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.attach(MIMEText(body, content_type if content_type in ("plain", "html") else "plain", "utf-8"))
        for attachment in attachments or []:
            file_path = attachment.get("path", "")
            filename = attachment.get("name", "")
            if not file_path or not filename or not os.path.isfile(file_path):
                logger.warning("[email-queue] skipping unavailable attachment: %s", filename or file_path)
                continue
            mime_type, _ = mimetypes.guess_type(filename)
            main_type, sub_type = (mime_type or "application/octet-stream").split("/", 1)
            with open(file_path, "rb") as file:
                part = MIMEBase(main_type, sub_type)
                part.set_payload(file.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)

        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_addr, msg.as_string())
            logger.info("✓ Email sent successfully to %s", to_addr)
        return True
    except Exception as exc:
        logger.error("✗ Email send failed: %s | type: %s", exc, type(exc).__name__)
        return False


def queue_email(db: Session, to_addr: str, subject: str, body: str, content_type: str = "plain", attachments: list[dict] | None = None) -> bool:
    """Queue an email for background delivery. Returns True once it's queued."""
    try:
        db.add(EmailQueueItem(to_email=to_addr, subject=subject, body=body, content_type=content_type, attachments=attachments or []))
        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        logger.error(f"[email-queue] failed to queue email to {to_addr}: {exc}")
        return False


def process_email_queue_once() -> int:
    """Attempt delivery of every currently-pending queued email once.
    Returns the number successfully sent this pass.
    """
    db = SessionLocal()
    sent_count = 0
    try:
        pending = db.scalars(
            select(EmailQueueItem)
            .where(EmailQueueItem.status == EmailStatus.pending)
            .order_by(EmailQueueItem.created_at.asc())
        ).all()

        for item in pending:
            ok = _send_email(item.to_email, item.subject, item.body, item.content_type, item.attachments)
            item.attempts += 1
            if ok:
                item.status = EmailStatus.sent
                item.sent_at = datetime.utcnow()
                item.last_error = ""
                sent_count += 1
            elif item.attempts >= MAX_ATTEMPTS:
                item.status = EmailStatus.failed
                item.last_error = "delivery failed after max attempts"
                logger.error(
                    f"[email-queue] giving up on email #{item.id} to {item.to_email} "
                    f"after {item.attempts} attempts"
                )
            db.commit()
    finally:
        db.close()
    return sent_count


async def email_queue_worker() -> None:
    """Poll the queue and deliver pending emails, picking up new ones within
    one poll interval of being queued.
    """
    while True:
        try:
            # process_email_queue_once() does blocking DB + SMTP I/O (SMTP
            # calls can take up to its 30s timeout), so it must run on a
            # worker thread rather than the shared asyncio event loop.
            sent = await asyncio.to_thread(process_email_queue_once)
            if sent:
                logger.info(f"[email-queue] sent {sent} email(s)")
        except Exception as exc:
            logger.error(f"[email-queue] worker error: {exc}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
