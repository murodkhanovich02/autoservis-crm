from datetime import date, time

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, AdminUser, StaffUser, get_or_404
from app.models import Customer, Expense, Reminder, ReminderStatus, SmsMessage, SmsStatus
from app.schemas.common import Page
from app.schemas.misc import ExpenseIn, ExpenseOut, ReminderOut, SmsOut, SmsSendIn
from app.services import reminders as reminder_svc
from app.services import settings_store
from app.services.sms import deliver, queue_sms
from app.utils import now

router = APIRouter()


# ---------------- Xarajatlar ----------------


@router.get("/expenses", response_model=list[ExpenseOut], tags=["expenses"])
def list_expenses(db: DB, _: StaffUser, date_from: date | None = None, date_to: date | None = None):
    today = now().date()
    d_from = date_from or today.replace(day=1)
    d_to = date_to or today
    return db.scalars(
        select(Expense)
        .where(Expense.spent_on >= d_from, Expense.spent_on <= d_to)
        .order_by(Expense.spent_on.desc(), Expense.id.desc())
    ).all()


@router.get("/expenses/categories", response_model=list[str], tags=["expenses"])
def expense_categories(db: DB, _: StaffUser):
    defaults = ["Ijara", "Kommunal", "Ish haqi", "Soliq", "Asbob-uskunalar", "Xo'jalik", "Boshqa"]
    used = db.scalars(select(Expense.category).distinct()).all()
    return sorted(set(defaults) | set(used))


@router.post("/expenses", response_model=ExpenseOut, status_code=201, tags=["expenses"])
def create_expense(data: ExpenseIn, db: DB, user: StaffUser):
    expense = Expense(**data.model_dump(exclude={"spent_on"}), spent_on=data.spent_on or now().date(), user_id=user.id)
    db.add(expense)
    db.commit()
    return expense


@router.delete("/expenses/{expense_id}", status_code=204, tags=["expenses"])
def delete_expense(expense_id: int, db: DB, _: AdminUser):
    db.delete(get_or_404(db, Expense, expense_id, "Xarajat"))
    db.commit()


# ---------------- SMS ----------------


@router.get("/sms", response_model=Page[SmsOut], tags=["sms"])
def list_sms(
    db: DB, _: StaffUser, status: SmsStatus | None = None, kind: str | None = None, skip: int = 0, limit: int = 50
):
    query = select(SmsMessage)
    if status:
        query = query.where(SmsMessage.status == status)
    if kind:
        query = query.where(SmsMessage.kind == kind)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(SmsMessage.id.desc()).offset(skip).limit(min(limit, 200))).all()
    return Page(items=items, total=total)


@router.post("/sms/send", tags=["sms"])
def send_sms(data: SmsSendIn, db: DB, _: AdminUser, bg: BackgroundTasks):
    """Qo'lda yoki ommaviy SMS (aksiya, e'lon). Faqat SMS'ga rozi mijozlarga."""
    targets: dict[str, int | None] = {}
    if data.all_customers:
        customers = db.scalars(select(Customer).where(Customer.sms_enabled.is_(True))).all()
    else:
        customers = db.scalars(select(Customer).where(Customer.id.in_(data.customer_ids))).all() if data.customer_ids else []
    for c in customers:
        targets[c.phone] = c.id
    for phone in data.phones:
        targets.setdefault(phone, None)
    if not targets:
        raise HTTPException(400, "Qabul qiluvchilar tanlanmagan")
    ids = [queue_sms(db, phone, data.text, "manual", cid).id for phone, cid in targets.items()]
    db.commit()
    bg.add_task(deliver, ids)
    return {"queued": len(ids)}


@router.post("/sms/{sms_id}/retry", response_model=SmsOut, tags=["sms"])
def retry_sms(sms_id: int, db: DB, _: StaffUser, bg: BackgroundTasks):
    msg = get_or_404(db, SmsMessage, sms_id, "SMS")
    if msg.status != SmsStatus.failed:
        raise HTTPException(400, "Faqat yuborilmagan SMS qayta yuboriladi")
    msg.status = SmsStatus.pending
    msg.error = None
    db.commit()
    bg.add_task(deliver, [msg.id])
    return msg


@router.get("/reminders", response_model=Page[ReminderOut], tags=["sms"])
def list_reminders(db: DB, _: StaffUser, status: ReminderStatus | None = None, skip: int = 0, limit: int = 50):
    query = select(Reminder)
    if status:
        query = query.where(Reminder.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.options(selectinload(Reminder.customer), selectinload(Reminder.vehicle), selectinload(Reminder.service))
        .order_by(Reminder.due_date)
        .offset(skip)
        .limit(min(limit, 200))
    ).all()
    return Page(items=items, total=total)


@router.post("/reminders/run", tags=["sms"])
def run_reminders(db: DB, _: StaffUser, bg: BackgroundTasks):
    """Muddati kelgan eslatmalarni hozir yuborish."""
    ids = reminder_svc.queue_due(db)
    bg.add_task(deliver, ids)
    return {"queued": len(ids)}


@router.delete("/reminders/{reminder_id}", status_code=204, tags=["sms"])
def cancel_reminder(reminder_id: int, db: DB, _: StaffUser):
    reminder = get_or_404(db, Reminder, reminder_id, "Eslatma")
    reminder.status = ReminderStatus.cancelled
    db.commit()


# ---------------- Sozlamalar ----------------


@router.get("/settings", response_model=dict[str, str], tags=["settings"])
def get_settings(db: DB, _: StaffUser):
    return settings_store.get_all(db)


@router.put("/settings", response_model=dict[str, str], tags=["settings"])
def update_settings(data: dict[str, str], db: DB, _: AdminUser):
    for key in ("slot_minutes", "posts_count"):
        if key in data and not str(data[key]).isdigit():
            raise HTTPException(400, f"{key} butun son bo'lishi kerak")
    for key in ("work_start", "work_end"):
        if key in data:
            try:
                time.fromisoformat(str(data[key]))
            except ValueError:
                raise HTTPException(400, f"{key} HH:MM formatida bo'lishi kerak") from None
    settings_store.set_many(db, data)
    db.commit()
    return settings_store.get_all(db)
