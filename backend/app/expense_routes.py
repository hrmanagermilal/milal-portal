"""Expense management routes and helpers"""
import base64
import html
import json
import logging
import os
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from zoneinfo import ZoneInfo

from .database import get_db
from .models import Expense, ExpenseAccount, ExpenseAgreement, ExpenseApprovalRoute, Member, User
from .schemas import (
    ExpenseCreate, ExpenseApprovalDecision, ExpenseAccountCreate, ExpenseAccountDetailOut,
    ExpenseAccountOut, ExpenseAccountUpdate, ExpenseApprovalRouteOut, ExpenseApprovalRouteUpdate,
    ExpenseAgreementOut, ExpenseAgreementUpdate, ExpenseOut, ExpenseUpdate,
    ReceiptExtractionOut, ReceiptExtractionRequest,
)
from .auth_routes import get_current_user, oauth2_scheme
from .ai_chat import get_gemini_client
from .email_queue import queue_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["expenses"])

# Configuration
EXPENSE_APPROVER_POSITION_CODES = (566, 567, 568)
EASTERN_TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "America/Toronto"))
EXPENSE_UPLOAD_DIR = os.getenv("EXPENSE_UPLOAD_DIR", "uploads/expenses")
PORTAL_BASE_URL = os.getenv("PORTAL_BASE_URL", "https://www.milalchurch.ca:83").rstrip("/")
PROJECT_ROOT = os.getenv("PROJECT_ROOT", "/app")

EXPENSE_DATA_URL_PATTERN = None  # Will be compiled in main
EXPENSE_FILE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".jpg",
    "image/heif": ".jpg",
    "application/pdf": ".pdf",
}


# ────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ────────────────────────────────────────────────────────────────────────────

def build_approvals_from_columns(expense: Expense, requester_name: str, requester_member_id: int, db: Session | None = None) -> list:
    """Build approvals array from normalized database columns."""
    # Collect all approver member IDs
    approver_ids = {
        expense.first_approval_member_id,
        expense.second_approval_member_id,
        expense.review_member_id,
        expense.first_agreement_member_id,
        expense.second_agreement_member_id,
    }
    approver_ids.discard(None)
    
    # Load member names from database if db is provided
    member_names = {}
    if db and approver_ids:
        from sqlalchemy import select
        members = db.scalars(select(Member).where(Member.id.in_(approver_ids))).all()
        member_names = {member.id: member.name for member in members}
    
    approvals = [
        {
            "role": "Requester",
            "roleKo": "요청자",
            "member_id": requester_member_id,
            "name": requester_name,
            "date": expense.created_at.isoformat() if expense.created_at else "",
            "state": "done",
            "comment": "",
        }
    ]
    
    if expense.first_approval_member_id:
        approvals.append({
            "role": "First Approver",
            "roleKo": "1차 결재자",
            "member_id": expense.first_approval_member_id,
            "name": member_names.get(expense.first_approval_member_id, ""),
            "date": expense.first_approval_date.isoformat() if expense.first_approval_date else "",
            "state": expense.first_approval_state,
            "comment": expense.first_approval_comment,
        })
    
    if expense.second_approval_member_id:
        approvals.append({
            "role": "Second Approver",
            "roleKo": "2차 결재자",
            "member_id": expense.second_approval_member_id,
            "name": member_names.get(expense.second_approval_member_id, ""),
            "date": expense.second_approval_date.isoformat() if expense.second_approval_date else "",
            "state": expense.second_approval_state,
            "comment": expense.second_approval_comment,
        })
    
    if expense.review_member_id:
        approvals.append({
            "role": "Expense Reviewer",
            "roleKo": "지출 검토",
            "member_id": expense.review_member_id,
            "name": member_names.get(expense.review_member_id, ""),
            "date": expense.review_date.isoformat() if expense.review_date else "",
            "state": expense.review_state,
            "comment": expense.review_comment,
        })
    
    if expense.first_agreement_member_id:
        approvals.append({
            "role": "First Agreement",
            "roleKo": "1차 합의",
            "member_id": expense.first_agreement_member_id,
            "name": member_names.get(expense.first_agreement_member_id, ""),
            "date": expense.first_agreement_date.isoformat() if expense.first_agreement_date else "",
            "state": expense.first_agreement_state,
            "comment": expense.first_agreement_comment,
        })
    
    if expense.second_agreement_member_id:
        approvals.append({
            "role": "Second Agreement",
            "roleKo": "2차 합의",
            "member_id": expense.second_agreement_member_id,
            "name": member_names.get(expense.second_agreement_member_id, ""),
            "date": expense.second_agreement_date.isoformat() if expense.second_agreement_date else "",
            "state": expense.second_agreement_state,
            "comment": expense.second_agreement_comment,
        })
    
    return approvals


def serialize_expense(expense: Expense, requester_name: str, db: Session | None = None) -> dict:
    """Serialize expense to JSON response"""
    account = expense.account
    approvals = build_approvals_from_columns(expense, requester_name, expense.requester_member_id, db)
    return {
        "id": expense.id,
        "request_date": expense.request_date,
        "title": expense.title,
        "memo": expense.memo,
        "status": expense.status,
        "hst_amount": expense.hst_amount,
        "total_amount": expense.total_amount,
        "requester_name": requester_name,
        "account_id": expense.account_id,
        "account_code": account.account_code if account else "",
        "account_name": account.name if account else "",
        "items": expense.items,
        "attachments": expense.attachments,
        "approvals": approvals,
        "created_at": expense.created_at.replace(tzinfo=None).isoformat(),
        "updated_at": expense.updated_at.replace(tzinfo=None).isoformat(),
    }


def get_expense_account_or_422(account_id: int | None, db: Session) -> ExpenseAccount:
    account = db.get(ExpenseAccount, account_id) if account_id else None
    if not account:
        raise HTTPException(status_code=422, detail="A valid expense account must be selected.")
    return account


def get_current_expense_approval(expense: Expense) -> tuple[int, dict] | None:
    for index, approval in enumerate(expense.approvals):
        if approval.get("state") == "current":
            return index, approval
    return None


def can_approve_expense(expense: Expense, member_id: int) -> bool:
    current_approval = get_current_expense_approval(expense)
    return bool(current_approval and current_approval[1].get("member_id") == member_id)


def can_view_expense_approval(expense: Expense, member_id: int) -> bool:
    if (
        expense.requester_member_id == member_id
        or expense.first_approval_member_id == member_id
        or expense.second_approval_member_id == member_id
        or expense.review_member_id == member_id
        or expense.first_agreement_member_id == member_id
        or expense.second_agreement_member_id == member_id
    ):
        return True
    
    return any(approval.get("member_id") == member_id for approval in expense.approvals)


def require_expense_approver(member: Member) -> None:
    if member.permission != "admin" and member.position_code not in EXPENSE_APPROVER_POSITION_CODES:
        raise HTTPException(status_code=403, detail="Only members with position code 566, 567, or 568 can approve expense requests.")


def get_expense_account_approvers(account_id: int, db: Session) -> tuple[ExpenseAccount, Member, Member]:
    account = get_expense_account_or_422(account_id, db)
    route = db.scalar(select(ExpenseApprovalRoute).where(ExpenseApprovalRoute.account_id == account.id))
    if not route:
        raise HTTPException(status_code=422, detail="The selected expense account has no approval route.")
    approver_ids = {route.chairperson_member_id, route.finance_elder_member_id}
    approvers = db.scalars(
        select(Member).where(Member.id.in_(approver_ids), Member.position_code.in_(EXPENSE_APPROVER_POSITION_CODES))
    ).all()
    approver_map = {approver.id: approver for approver in approvers}
    if any(approver_id not in approver_map for approver_id in approver_ids):
        raise HTTPException(status_code=422, detail="Approvers must have position code 566, 567, or 568.")
    return account, approver_map[route.chairperson_member_id], approver_map[route.finance_elder_member_id]


def serialize_expense_account(account: ExpenseAccount, approved_amount: float) -> dict:
    return {
        "id": account.id,
        "account_code": account.account_code,
        "name": account.name,
        "year": account.year,
        "budget_amount": account.budget_amount,
        "approved_amount": approved_amount,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


def serialize_expense_approval_route(route: ExpenseApprovalRoute, account: ExpenseAccount, members: dict[int, Member]) -> dict:
    chairperson = members.get(route.chairperson_member_id)
    finance_elder = members.get(route.finance_elder_member_id)
    return {
        "id": route.id,
        "account_id": route.account_id,
        "account_code": account.account_code,
        "account_name": account.name,
        "department_name": account.name,
        "chairperson_member_id": route.chairperson_member_id,
        "finance_elder_member_id": route.finance_elder_member_id,
        "chairperson_name": chairperson.name if chairperson else "",
        "finance_elder_name": finance_elder.name if finance_elder else "",
        "created_at": route.created_at,
        "updated_at": route.updated_at,
    }


def serialize_expense_agreement(agreement: ExpenseAgreement, members: dict[int, Member]) -> dict:
    reviewer = members.get(agreement.reviewer_member_id)
    first_approver = members.get(agreement.first_approver_member_id)
    second_approver = members.get(agreement.second_approver_member_id)
    return {
        "id": agreement.id,
        "reviewer_member_id": agreement.reviewer_member_id,
        "first_approver_member_id": agreement.first_approver_member_id,
        "second_approver_member_id": agreement.second_approver_member_id,
        "reviewer_name": reviewer.name if reviewer else "",
        "first_approver_name": first_approver.name if first_approver else "",
        "second_approver_name": second_approver.name if second_approver else "",
        "created_at": agreement.created_at,
        "updated_at": agreement.updated_at,
    }


def send_expense_notification(
    db: Session,
    expense: Expense,
    requester: Member,
    recipients: list[Member],
    action: str,
    comment: str = "",
    attachment_recipient_ids: set[int] | None = None,
) -> None:
    if not any(member.email.strip() for member in recipients):
        logger.warning("Expense request %s has no notification recipients", expense.id)
        return

    action_label = {
        "created": "등록",
        "updated": "수정",
        "first_approve": "1차 승인",
        "second_approve": "2차 승인",
        "approved": "검토완료",
        "first_agreed": "1차 합의",
        "second_agreed": "2차 합의",
        "rejected": "반려됨",
    }[action]
    subject = f"[비용처리] 비용 요청 {action_label}: {expense.title}"
    requester_user = db.scalar(select(User).where(User.member_id == requester.id))
    requester_english_name = requester_user.english_name.strip() if requester_user else ""
    requester_display_name = f"{requester.name} ({requester_english_name})" if requester_english_name else requester.name
    
    sent_emails = set()
    for recipient in recipients:
        recipient_email = recipient.email.strip()
        if not recipient_email or recipient_email in sent_emails:
            continue
        sent_emails.add(recipient_email)
        is_requester = recipient.id == requester.id
        
        item_rows = "".join(
            f"<tr><td style=\"padding:10px;border-bottom:1px solid #e5e7eb;\">{html.escape(str(item['description']))}</td>"
            f"<td style=\"padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;\">CAD {float(item['amount']):,.2f}</td></tr>"
            for item in expense.items
        )
        completed_approval_rows = "".join(
            f"<tr><td style=\"padding:10px;border-bottom:1px solid #e5e7eb;\">{html.escape(str(approval.get('roleKo') or approval.get('role', '결재자')))}</td>"
            f"<td style=\"padding:10px;border-bottom:1px solid #e5e7eb;\">{html.escape(str(approval.get('name', '')))}</td>"
            f"<td style=\"padding:10px;border-bottom:1px solid #e5e7eb;\">{'승인' if approval.get('state') == 'done' else '반려'}</td>"
            f"<td style=\"padding:10px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;\">{html.escape(str(approval.get('comment') or '-'))}</td></tr>"
            for approval in expense.approvals
            if approval.get('role') != 'Requester' and approval.get('state') in ('done', 'rejected')
        )
        approval_history = f"""
        <h2 style=\"font-size:16px;margin:26px 0 10px;\">결재 정보</h2>
        <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;border:1px solid #e5e7eb;font-size:14px;\">
          <tr style=\"background:#f8fafc;\"><th style=\"padding:10px;text-align:left;\">단계</th><th style=\"padding:10px;text-align:left;\">결재자</th><th style=\"padding:10px;text-align:left;\">결과</th><th style=\"padding:10px;text-align:left;\">결재 의견</th></tr>
          {completed_approval_rows}
        </table>""" if completed_approval_rows else ""
        
        body = f"""<!doctype html>
<html lang=\"ko\"><body style=\"margin:0;padding:24px;background:#f4f6f8;font-family:Arial,sans-serif;color:#243044;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\"><tr><td align=\"center\">
        <table role=\"presentation\" width=\"640\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;width:100%;background:#ffffff;border:1px solid #dbe3ea;\">
            <tr><td style=\"padding:24px 28px;background:#314b2b;color:#ffffff;\"><strong style=\"font-size:20px;\">비용 요청 {html.escape(action_label)}</strong></td></tr>
            <tr><td style=\"padding:28px;\">
                <p style=\"margin:0 0 20px;\">비용 요청이 {html.escape(action_label)}되었습니다.</p>
                <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;border:1px solid #e5e7eb;font-size:14px;\">
                    <tr><th style=\"padding:10px;text-align:left;background:#f8fafc;width:120px;\">요청자</th><td style=\"padding:10px;\">{html.escape(requester_display_name)}</td></tr>
                    <tr><th style=\"padding:10px;text-align:left;background:#f8fafc;\">요청일</th><td style=\"padding:10px;\">{expense.request_date.isoformat()}</td></tr>
                    <tr><th style=\"padding:10px;text-align:left;background:#f8fafc;\">제목</th><td style=\"padding:10px;\">{html.escape(expense.title)}</td></tr>
                    <tr><th style=\"padding:10px;text-align:left;background:#f8fafc;\">결재 상태</th><td style=\"padding:10px;\">{html.escape(action_label)}</td></tr>
                </table>
                {approval_history}
                <h2 style=\"font-size:16px;margin:26px 0 10px;\">비용 항목</h2>
                <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;border:1px solid #e5e7eb;font-size:14px;\">
                    <tr style=\"background:#f8fafc;\"><th style=\"padding:10px;text-align:left;\">항목</th><th style=\"padding:10px;text-align:right;\">금액</th></tr>
                    {item_rows}
                    <tr><th style=\"padding:10px;text-align:left;\">HST</th><td style=\"padding:10px;text-align:right;\">CAD {expense.hst_amount:,.2f}</td></tr>
                    <tr style=\"background:#edf4e9;\"><th style=\"padding:12px;text-align:left;\">총 비용</th><td style=\"padding:12px;text-align:right;font-weight:bold;\">CAD {expense.total_amount:,.2f}</td></tr>
                </table>
                <h2 style=\"font-size:16px;margin:26px 0 8px;\">메모</h2><p style=\"margin:0;white-space:pre-wrap;line-height:1.6;\">{html.escape(expense.memo)}</p>
            </td></tr>
        </table>
    </td></tr></table>
</body></html>"""
        queue_email(db, recipient_email, subject, body, content_type="html", attachments=[])


# ────────────────────────────────────────────────────────────────────────────
# API Routes
# ────────────────────────────────────────────────────────────────────────────

@router.get("/expenses/requester-profile")
def get_expense_requester_profile(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    user = db.scalar(select(User).where(User.member_id == current_user.id))
    return {"english_name": user.english_name if user else ""}


@router.post("/expenses/extract-receipt", response_model=ReceiptExtractionOut)
def extract_expense_receipt(
    payload: ReceiptExtractionRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    get_current_user(token, db)
    data_url = payload.file_data_url
    if not (data_url.startswith("data:image/") or data_url.startswith("data:application/pdf")) or ";base64," not in data_url:
        raise HTTPException(status_code=422, detail="An image or PDF file is required for receipt extraction.")

    try:
        encoded_image = data_url.split(",", 1)[1]
        file_bytes = base64.b64decode(encoded_image, validate=True)
        if len(file_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Receipt files must be 8 MB or smaller.")
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="The receipt file is not valid base64 data.") from exc

    receipt_images = [data_url]
    if data_url.startswith("data:application/pdf"):
        try:
            import fitz
            document = fitz.open(stream=file_bytes, filetype="pdf")
            if document.page_count == 0:
                raise ValueError("empty PDF")
            receipt_images = [
                "data:image/png;base64," + base64.b64encode(document.load_page(page_number).get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).tobytes("png")).decode("ascii")
                for page_number in range(min(document.page_count, 5))
            ]
            document.close()
        except Exception as exc:
            logger.warning("Unable to render receipt PDF: %s", exc)
            raise HTTPException(status_code=422, detail="Unable to read this receipt PDF.") from exc

    client, error_payload = get_gemini_client()
    if error_payload:
        raise HTTPException(status_code=503, detail=error_payload["message"])

    try:
        response = client.chat.completions.create(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract expense line items from a receipt image. Return JSON only with this exact shape: "
                        "{\"items\":[{\"description\":string,\"amount\":number}],\"hst_amount\":number}. "
                        "Use the printed currency values. Exclude HST/tax from items and put its value in hst_amount. "
                        "If no tax is shown, use 0. Do not invent unreadable items or amounts."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Read this receipt and extract its expense items."},
                        *[{"type": "image_url", "image_url": {"url": image_url}} for image_url in receipt_images],
                    ],
                },
            ],
        )
        content = (response.choices[0].message.content or "").strip()
        result = json.loads(content)
        items = [
            {"description": str(item["description"]).strip(), "amount": float(item["amount"])}
            for item in result.get("items", [])
            if str(item.get("description", "")).strip() and float(item.get("amount", 0)) > 0
        ]
        return {"items": items, "hst_amount": max(0, float(result.get("hst_amount", 0)))}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Receipt extraction returned an invalid Gemini response: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to read expense items from this receipt image.") from exc
    except Exception as exc:
        if getattr(exc, "status_code", None) in (400, 401):
            logger.warning("Gemini receipt extraction authentication failed")
            raise HTTPException(status_code=503, detail="Gemini receipt extraction is not configured with a valid API key.") from exc
        logger.exception("Receipt extraction failed")
        raise HTTPException(status_code=502, detail="Receipt extraction is temporarily unavailable. Please try again.") from exc


@router.get("/expenses", response_model=list[ExpenseOut])
def get_expenses(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    current_user = get_current_user(token, db)
    stmt = select(Expense).order_by(Expense.request_date.desc(), Expense.id.desc())
    if current_user.permission != "admin":
        stmt = stmt.where(Expense.requester_member_id == current_user.id)
    expenses = db.scalars(stmt).all()
    requester_ids = {expense.requester_member_id for expense in expenses}
    requester_names = {member.id: member.name for member in db.scalars(select(Member).where(Member.id.in_(requester_ids))).all()} if requester_ids else {}
    return [serialize_expense(expense, requester_names.get(expense.requester_member_id, ""), db) for expense in expenses]


@router.get("/expenses/approvers")
def get_expense_approvers(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    get_current_user(token, db)
    approvers = db.scalars(
        select(Member)
        .where(Member.position_code.in_(EXPENSE_APPROVER_POSITION_CODES))
        .order_by(Member.name, Member.id)
    ).all()
    return [
        {"id": approver.id, "name": approver.name, "title": approver.title, "position_code": approver.position_code}
        for approver in approvers
    ]


@router.get("/expense-approvals/summary")
def get_expense_approval_summary(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    is_approver = current_user.position_code in EXPENSE_APPROVER_POSITION_CODES or current_user.permission == "admin"
    if not is_approver:
        return {"is_approver": False, "pending_count": 0}

    candidates = db.scalars(select(Expense).where(Expense.status.in_(("first_approve", "second_approve", "reviewing", "first_agreed", "second_agreed")))).all()
    return {
        "is_approver": True,
        "pending_count": sum(can_approve_expense(expense, current_user.id) for expense in candidates),
    }


@router.get("/expense-approvals", response_model=list[ExpenseOut])
def get_expense_approvals(
    status: str | None = Query(default=None),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> list[dict]:
    current_user = get_current_user(token, db)
    is_admin = current_user.permission == "admin"
    if not is_admin:
        require_expense_approver(current_user)
    candidates = db.scalars(
        select(Expense)
        .where(Expense.status.in_(("first_approve", "second_approve", "reviewing", "first_agreed", "second_agreed", "rejected", "paid")))
        .order_by(Expense.request_date.desc(), Expense.id.desc())
    ).all()
    approval_expenses = candidates if is_admin else [expense for expense in candidates if can_view_expense_approval(expense, current_user.id)]
    if status:
        approval_expenses = [expense for expense in approval_expenses if expense.status == status]

    requester_ids = {expense.requester_member_id for expense in approval_expenses}
    requesters = db.scalars(select(Member).where(Member.id.in_(requester_ids))).all() if requester_ids else []
    requester_names = {requester.id: requester.name for requester in requesters}
    return [serialize_expense(expense, requester_names.get(expense.requester_member_id, ""), db) for expense in approval_expenses]


@router.get("/expense-approvals/{expense_id}", response_model=ExpenseOut)
def get_expense_approval_detail(
    expense_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    is_admin = current_user.permission == "admin"
    if not is_admin:
        require_expense_approver(current_user)
    expense = db.get(Expense, expense_id)
    if not expense or (not is_admin and not can_view_expense_approval(expense, current_user.id)):
        raise HTTPException(status_code=404, detail="expense approval request not found")
    requester = db.get(Member, expense.requester_member_id)
    return serialize_expense(expense, requester.name if requester else "", db)


@router.post("/expense-approvals/{expense_id}/decision", response_model=ExpenseOut)
def decide_expense_approval(
    expense_id: int,
    payload: ExpenseApprovalDecision,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    require_expense_approver(current_user)
    expense = db.get(Expense, expense_id)
    current_approval = get_current_expense_approval(expense) if expense else None
    if not expense or not current_approval or current_approval[1].get("member_id") != current_user.id:
        raise HTTPException(status_code=409, detail="This expense request is not awaiting your approval.")

    approvals = [dict(approval) for approval in expense.approvals]
    approval_index = next(index for index, approval in enumerate(approvals) if approval.get("state") == "current")
    
    if payload.account_id:
        expense.account_id = get_expense_account_or_422(payload.account_id, db).id
    if approval_index == 1 and payload.action == "approve" and payload.second_approver_member_id:
        second_approver = db.get(Member, payload.second_approver_member_id)
        if not second_approver or second_approver.position_code not in EXPENSE_APPROVER_POSITION_CODES:
            raise HTTPException(status_code=422, detail="Second approver must have position code 566, 567, or 568.")
        approvals[2]["member_id"] = second_approver.id
        approvals[2]["name"] = second_approver.name
        expense.second_approval_member_id = second_approver.id
    
    approval = approvals[approval_index]
    approval["state"] = "done" if payload.action == "approve" else "rejected"
    approval["date"] = datetime.now(EASTERN_TZ).isoformat()
    approval["comment"] = payload.comment.strip()
    
    current_time = datetime.now(EASTERN_TZ)
    if approval_index == 1:
        expense.first_approval_state = "done" if payload.action == "approve" else "rejected"
        expense.first_approval_date = current_time if payload.action == "approve" else None
        expense.first_approval_comment = payload.comment.strip()
    elif approval_index == 2:
        expense.second_approval_state = "done" if payload.action == "approve" else "rejected"
        expense.second_approval_date = current_time if payload.action == "approve" else None
        expense.second_approval_comment = payload.comment.strip()
    elif approval_index == 3:
        expense.review_state = "done" if payload.action == "approve" else "rejected"
        expense.review_date = current_time if payload.action == "approve" else None
        expense.review_comment = payload.comment.strip()
    elif approval_index == 4:
        expense.first_agreement_state = "done" if payload.action == "approve" else "rejected"
        expense.first_agreement_date = current_time if payload.action == "approve" else None
        expense.first_agreement_comment = payload.comment.strip()
    elif approval_index == 5:
        expense.second_agreement_state = "done" if payload.action == "approve" else "rejected"
        expense.second_agreement_date = current_time if payload.action == "approve" else None
        expense.second_agreement_comment = payload.comment.strip()
    
    if payload.action == "reject":
        expense.status = "rejected"
    elif approval_index == len(approvals) - 1:
        expense.status = "paid"
    else:
        approvals[approval_index + 1]["state"] = "current"
        
        if approval_index + 1 == 2:
            expense.second_approval_state = "current"
        elif approval_index + 1 == 3:
            expense.review_state = "current"
        elif approval_index + 1 == 4:
            expense.first_agreement_state = "current"
        elif approval_index + 1 == 5:
            expense.second_agreement_state = "current"
        
        if approval_index == 1:
            expense.status = "second_approve"
        elif approval_index == 2:
            expense.status = "reviewing"
        elif approval_index == 3:
            expense.status = "first_agreed"
        elif approval_index == 4:
            expense.status = "second_agreed"
        elif approval_index == 5:
            expense.status = "paid"
        else:
            expense.status = "second_approve"
    
    expense.approvals = approvals
    flag_modified(expense, "approvals")
    db.commit()
    db.refresh(expense)
    requester = db.get(Member, expense.requester_member_id)
    decision_comment = payload.comment.strip()
    return serialize_expense(expense, requester.name if requester else "", db)
    
    if payload.action == "approve":
        if approval_index == 1 and requester:
            second_approver = db.get(Member, approvals[2]["member_id"])
            if second_approver:
                send_expense_notification(db, expense, requester, [requester, second_approver], "first_approve", decision_comment)
        elif approval_index == 2 and requester:
            if len(approvals) > 3:
                reviewer = db.get(Member, approvals[3]["member_id"])
                if reviewer:
                    send_expense_notification(db, expense, requester, [requester, reviewer], "second_approve", decision_comment, attachment_recipient_ids={reviewer.id})
            else:
                finance_admins = db.scalars(
                    select(Member).join(User).where(User.is_finance_admin.is_(True))
                ).all()
                send_expense_notification(
                    db, expense, requester, [requester, *finance_admins], "second_approve", decision_comment,
                    attachment_recipient_ids={admin.id for admin in finance_admins},
                )
        elif approval_index == 3:
            if len(approvals) > 4:
                first_agreement = db.get(Member, approvals[4]["member_id"])
                if first_agreement:
                    send_expense_notification(db, expense, requester, [first_agreement], "approved", decision_comment)
        elif approval_index == 4:
            if len(approvals) > 5:
                second_agreement = db.get(Member, approvals[5]["member_id"])
                if second_agreement:
                    send_expense_notification(db, expense, requester, [second_agreement], "first_agreed", decision_comment)
        elif approval_index == len(approvals) - 1 and requester:
            finance_admins = db.scalars(
                select(Member).join(User).where(User.is_finance_admin.is_(True))
            ).all()
            send_expense_notification(
                db, expense, requester, [requester, *finance_admins], "second_agreed", decision_comment,
                attachment_recipient_ids={admin.id for admin in finance_admins},
            )
    elif payload.action == "reject" and requester:
        send_expense_notification(db, expense, requester, [requester], "rejected", decision_comment)
    
    return serialize_expense(expense, requester.name if requester else "", db)


@router.get("/expense-accounts", response_model=list[ExpenseAccountOut])
def get_expense_accounts(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> list[dict]:
    require_expense_approver(get_current_user(token, db))
    accounts = db.scalars(select(ExpenseAccount).order_by(ExpenseAccount.year.desc(), ExpenseAccount.name)).all()
    totals = dict(db.execute(select(Expense.account_id, func.coalesce(func.sum(Expense.total_amount), 0)).where(Expense.status == "paid", Expense.account_id.is_not(None)).group_by(Expense.account_id)).all())
    return [serialize_expense_account(account, totals.get(account.id, 0)) for account in accounts]


@router.get("/expense-approval-routes", response_model=list[ExpenseApprovalRouteOut])
def get_expense_approval_routes(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> list[dict]:
    get_current_user(token, db)
    routes = db.scalars(select(ExpenseApprovalRoute).order_by(ExpenseApprovalRoute.account_id)).all()
    accounts = {account.id: account for account in db.scalars(select(ExpenseAccount).where(ExpenseAccount.id.in_({route.account_id for route in routes}))).all()} if routes else {}
    member_ids = {member_id for route in routes for member_id in (route.chairperson_member_id, route.finance_elder_member_id)}
    members = {member.id: member for member in db.scalars(select(Member).where(Member.id.in_(member_ids))).all()} if member_ids else {}
    return [serialize_expense_approval_route(route, accounts[route.account_id], members) for route in routes if route.account_id in accounts]


@router.put("/expense-accounts/{account_id}/approval-route", response_model=ExpenseApprovalRouteOut)
def save_expense_approval_route(account_id: int, payload: ExpenseApprovalRouteUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="department not found")
    approvers = {member.id: member for member in db.scalars(select(Member).where(Member.id.in_((payload.chairperson_member_id, payload.finance_elder_member_id)))).all()}
    if len(approvers) != 2 or any(member.position_code not in EXPENSE_APPROVER_POSITION_CODES for member in approvers.values()):
        raise HTTPException(status_code=422, detail="Chairperson and finance elder must be eligible expense approvers.")
    route = db.scalar(select(ExpenseApprovalRoute).where(ExpenseApprovalRoute.account_id == account_id))
    if route:
        route.chairperson_member_id = payload.chairperson_member_id
        route.finance_elder_member_id = payload.finance_elder_member_id
    else:
        route = ExpenseApprovalRoute(account_id=account_id, **payload.model_dump())
        db.add(route)
    db.commit()
    db.refresh(route)
    return serialize_expense_approval_route(route, account, approvers)


@router.get("/expense-agreement", response_model=ExpenseAgreementOut)
def get_expense_agreement(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    agreement = db.scalar(select(ExpenseAgreement))
    if not agreement:
        raise HTTPException(status_code=404, detail="expense agreement not found")
    members = {member.id: member for member in db.scalars(select(Member).where(Member.id.in_((agreement.reviewer_member_id, agreement.first_approver_member_id, agreement.second_approver_member_id)))).all()}
    return serialize_expense_agreement(agreement, members)


@router.put("/expense-agreement", response_model=ExpenseAgreementOut)
def save_expense_agreement(payload: ExpenseAgreementUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    all_members = {member.id: member for member in db.scalars(select(Member).where(Member.id.in_((payload.reviewer_member_id, payload.first_approver_member_id, payload.second_approver_member_id)))).all()}
    reviewer = all_members.get(payload.reviewer_member_id)
    approvers = [all_members.get(payload.first_approver_member_id), all_members.get(payload.second_approver_member_id)]
    if not reviewer or reviewer.position_code not in EXPENSE_APPROVER_POSITION_CODES:
        raise HTTPException(status_code=422, detail="Reviewer must be an eligible expense approver.")
    if len(approvers) != 2 or any(not m or m.position_code not in EXPENSE_APPROVER_POSITION_CODES for m in approvers):
        raise HTTPException(status_code=422, detail="First and second approvers must be eligible expense approvers.")
    agreement = db.scalar(select(ExpenseAgreement))
    if agreement:
        agreement.reviewer_member_id = payload.reviewer_member_id
        agreement.first_approver_member_id = payload.first_approver_member_id
        agreement.second_approver_member_id = payload.second_approver_member_id
    else:
        agreement = ExpenseAgreement(**payload.model_dump())
        db.add(agreement)
    db.commit()
    db.refresh(agreement)
    return serialize_expense_agreement(agreement, all_members)


@router.post("/expense-accounts", response_model=ExpenseAccountOut, status_code=201)
def create_expense_account(payload: ExpenseAccountCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account_code = payload.account_code.strip()
    if db.scalar(select(ExpenseAccount).where(ExpenseAccount.account_code == account_code)):
        raise HTTPException(status_code=409, detail="An expense account with this code already exists.")
    account = ExpenseAccount(**{**payload.model_dump(), "account_code": account_code})
    db.add(account)
    db.commit()
    db.refresh(account)
    return serialize_expense_account(account, 0)


@router.patch("/expense-accounts/{account_id}", response_model=ExpenseAccountOut)
def update_expense_account(account_id: int, payload: ExpenseAccountUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="expense account not found")
    account_code = payload.account_code.strip()
    duplicate = db.scalar(select(ExpenseAccount).where(ExpenseAccount.account_code == account_code, ExpenseAccount.id != account_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="An expense account with this code already exists.")
    for field, value in {**payload.model_dump(), "account_code": account_code}.items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    approved_amount = db.scalar(select(func.coalesce(func.sum(Expense.total_amount), 0)).where(Expense.status == "paid", Expense.account_id == account.id))
    return serialize_expense_account(account, approved_amount or 0)


@router.delete("/expense-accounts/{account_id}", status_code=204)
def delete_expense_account(account_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> None:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="department not found")
    if db.scalar(select(func.count()).select_from(Expense).where(Expense.account_id == account_id)):
        raise HTTPException(status_code=409, detail="Departments assigned to expense requests cannot be deleted.")
    db.delete(account)
    db.commit()


@router.get("/expense-accounts/{account_id}", response_model=ExpenseAccountDetailOut)
def get_expense_account(account_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    require_expense_approver(get_current_user(token, db))
    account = db.get(ExpenseAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="expense account not found")
    expenses = db.scalars(select(Expense).where(Expense.status == "paid", Expense.account_id == account.id).order_by(Expense.request_date.desc(), Expense.id.desc())).all()
    requesters = {member.id: member.name for member in db.scalars(select(Member).where(Member.id.in_({expense.requester_member_id for expense in expenses}))).all()} if expenses else {}
    detail = serialize_expense_account(account, sum(expense.total_amount for expense in expenses))
    detail["expenses"] = []
    for expense in expenses:
        serialized_expense = serialize_expense(expense, requesters.get(expense.requester_member_id, ""), db)
        detail["expenses"].append(serialized_expense)
    return detail


@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    expense = db.get(Expense, expense_id)
    if not expense or expense.requester_member_id != current_user.id:
        raise HTTPException(status_code=404, detail="expense request not found")
    return serialize_expense(expense, current_user.name, db)


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(
    payload: ExpenseCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    requester_user = db.scalar(select(User).where(User.member_id == current_user.id))
    if not requester_user:
        raise HTTPException(status_code=404, detail="User account not found")
    requester_user.english_name = payload.english_name.strip()
    account, first_approver, second_approver = get_expense_account_approvers(payload.account_id, db)
    agreement = db.scalar(select(ExpenseAgreement))
    total_amount = sum(item.amount for item in payload.items) + payload.hst_amount
    first_approval_is_automatic = current_user.id == first_approver.id
    approval_time = datetime.now(EASTERN_TZ).isoformat()
    requester_approval = {
        "role": "Requester",
        "roleKo": "요청자",
        "name": current_user.name,
        "date": "",
        "state": "done",
    }
    
    reviewer = None
    first_agreement_approver = None
    second_agreement_approver = None
    if agreement:
        reviewer = db.get(Member, agreement.reviewer_member_id)
        first_agreement_approver = db.get(Member, agreement.first_approver_member_id)
        second_agreement_approver = db.get(Member, agreement.second_approver_member_id)
    
    approvals = [
        requester_approval,
        {"role": "First Approver", "roleKo": "1차 결재자", "member_id": first_approver.id, "name": first_approver.name, "date": approval_time if first_approval_is_automatic else "", "state": "done" if first_approval_is_automatic else "current"},
        {"role": "Second Approver", "roleKo": "2차 결재자", "member_id": second_approver.id, "name": second_approver.name, "date": "", "state": "current" if first_approval_is_automatic else "waiting"},
    ]
    
    if reviewer:
        approvals.append({"role": "Expense Reviewer", "roleKo": "지출 검토", "member_id": reviewer.id, "name": reviewer.name, "date": "", "state": "waiting"})
    
    if first_agreement_approver:
        approvals.append({"role": "First Agreement", "roleKo": "1차 합의", "member_id": first_agreement_approver.id, "name": first_agreement_approver.name, "date": "", "state": "waiting"})
    if second_agreement_approver:
        approvals.append({"role": "Second Agreement", "roleKo": "2차 합의", "member_id": second_agreement_approver.id, "name": second_agreement_approver.name, "date": "", "state": "waiting"})
    
    expense = Expense(
        requester_member_id=current_user.id,
        account_id=account.id,
        request_date=payload.request_date,
        title=payload.title,
        memo=payload.memo,
        hst_amount=payload.hst_amount,
        total_amount=total_amount,
        items=[item.model_dump() for item in payload.items],
        attachments=[],
        approvals=approvals,
        status="approved" if first_approval_is_automatic else "first_approve",
        first_approval_member_id=first_approver.id,
        first_approval_state="done" if first_approval_is_automatic else "current",
        first_approval_date=datetime.now(EASTERN_TZ) if first_approval_is_automatic else None,
        first_approval_comment="",
        second_approval_member_id=second_approver.id,
        second_approval_state="current" if first_approval_is_automatic else "waiting",
        second_approval_date=None,
        second_approval_comment="",
        review_member_id=reviewer.id if reviewer else None,
        review_state="waiting" if reviewer else "done",
        review_date=None,
        review_comment="",
        first_agreement_member_id=first_agreement_approver.id if first_agreement_approver else None,
        first_agreement_state="waiting" if first_agreement_approver else "done",
        first_agreement_date=None,
        first_agreement_comment="",
        second_agreement_member_id=second_agreement_approver.id if second_agreement_approver else None,
        second_agreement_state="waiting" if second_agreement_approver else "done",
        second_agreement_date=None,
        second_agreement_comment="",
    )
    db.add(expense)
    db.flush()
    expense.approvals[0]["date"] = approval_time
    flag_modified(expense, "approvals")
    expense.attachments = []
    db.commit()
    db.refresh(expense)
    if first_approval_is_automatic:
        send_expense_notification(db, expense, current_user, [current_user, second_approver], "first_approve")
    else:
        send_expense_notification(db, expense, current_user, [first_approver], "created")
    return serialize_expense(expense, current_user.name, db)


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    requester_user = db.scalar(select(User).where(User.member_id == current_user.id))
    if not requester_user:
        raise HTTPException(status_code=404, detail="User account not found")
    requester_user.english_name = payload.english_name.strip()
    expense = db.get(Expense, expense_id)
    if not expense or expense.requester_member_id != current_user.id:
        raise HTTPException(status_code=404, detail="expense request not found")
    if expense.status != "first_approve":
        raise HTTPException(status_code=409, detail="Expense requests cannot be edited after chairperson approval.")
    account, first_approver, second_approver = get_expense_account_approvers(payload.account_id, db)

    expense.request_date = payload.request_date
    expense.title = payload.title
    expense.memo = payload.memo
    expense.account_id = account.id
    expense.hst_amount = payload.hst_amount
    expense.total_amount = sum(item.amount for item in payload.items) + payload.hst_amount
    expense.items = [item.model_dump() for item in payload.items]
    expense.attachments = []
    requester_approval = expense.approvals[0] if expense.approvals else {}
    requester_approval.update({"name": current_user.name, "state": "done"})
    
    agreement = db.scalar(select(ExpenseAgreement))
    reviewer = None
    first_agreement_approver = None
    second_agreement_approver = None
    if agreement:
        reviewer = db.get(Member, agreement.reviewer_member_id)
        first_agreement_approver = db.get(Member, agreement.first_approver_member_id)
        second_agreement_approver = db.get(Member, agreement.second_approver_member_id)
    
    expense.approvals = [
        requester_approval,
        {"role": "First Approver", "roleKo": "1차 결재자", "member_id": first_approver.id, "name": first_approver.name, "date": "", "state": "current"},
        {"role": "Second Approver", "roleKo": "2차 결재자", "member_id": second_approver.id, "name": second_approver.name, "date": "", "state": "waiting"},
    ]
    
    if reviewer:
        expense.approvals.append({"role": "Expense Reviewer", "roleKo": "지출 검토", "member_id": reviewer.id, "name": reviewer.name, "date": "", "state": "waiting"})
    
    if first_agreement_approver:
        expense.approvals.append({"role": "First Agreement", "roleKo": "1차 합의", "member_id": first_agreement_approver.id, "name": first_agreement_approver.name, "date": "", "state": "waiting"})
    if second_agreement_approver:
        expense.approvals.append({"role": "Second Agreement", "roleKo": "2차 합의", "member_id": second_agreement_approver.id, "name": second_agreement_approver.name, "date": "", "state": "waiting"})
    
    expense.first_approval_member_id = first_approver.id
    expense.first_approval_state = "current"
    expense.first_approval_date = None
    expense.first_approval_comment = ""
    
    expense.second_approval_member_id = second_approver.id
    expense.second_approval_state = "waiting"
    expense.second_approval_date = None
    expense.second_approval_comment = ""
    
    expense.review_member_id = reviewer.id if reviewer else None
    expense.review_state = "waiting" if reviewer else "done"
    expense.review_date = None
    expense.review_comment = ""
    
    expense.first_agreement_member_id = first_agreement_approver.id if first_agreement_approver else None
    expense.first_agreement_state = "waiting" if first_agreement_approver else "done"
    expense.first_agreement_date = None
    expense.first_agreement_comment = ""
    
    expense.second_agreement_member_id = second_agreement_approver.id if second_agreement_approver else None
    expense.second_agreement_state = "waiting" if second_agreement_approver else "done"
    expense.second_agreement_date = None
    expense.second_agreement_comment = ""
    
    flag_modified(expense, "approvals")
    db.commit()
    db.refresh(expense)
    send_expense_notification(db, expense, current_user, [first_approver], "updated")
    return serialize_expense(expense, current_user.name, db)


@router.post("/expenses/{expense_id}/cancel", response_model=ExpenseOut)
def cancel_expense(
    expense_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    current_user = get_current_user(token, db)
    expense = db.get(Expense, expense_id)
    if not expense or expense.requester_member_id != current_user.id:
        raise HTTPException(status_code=404, detail="expense request not found")
    if expense.status != "first_approve":
        raise HTTPException(status_code=409, detail="Expense requests cannot be cancelled after approval has started.")

    expense.status = "cancelled"
    db.commit()
    db.refresh(expense)
    return serialize_expense(expense, current_user.name, db)
