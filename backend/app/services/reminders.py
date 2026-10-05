"""Keyingi xizmat eslatmalari (moy almashtirish va h.k.)."""

import asyncio
import calendar
import logging
from datetime import date

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import SessionLocal
from app.models import Order, Reminder, ReminderStatus, Service
from app.services import settings_store
from app.services.sms import deliver, queue_sms, render
from app.utils import now

log = logging.getLogger("reminders")

AVG_KM_PER_MONTH = 1500  # faqat km berilgan bo'lsa, sanani taxminlash uchun


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def create_for_order(db: Session, order: Order) -> list[Reminder]:
    """Buyurtma yopilganda: eslatma talab qiladigan xizmatlar uchun keyingi sana/probegni yozadi."""
    created = []
    base_date = (order.closed_at or now()).date()
    seen: set[int] = set()
    for line in order.services:
        if not line.service_id or line.service_id in seen:
            continue
        service = db.get(Service, line.service_id)
        if not service or not (service.reminder_months or service.reminder_km):
            continue
        seen.add(service.id)
        months = service.reminder_months or max(1, round(service.reminder_km / AVG_KM_PER_MONTH))
        due_mileage = order.mileage + service.reminder_km if (order.mileage and service.reminder_km) else None
        # shu mashina + xizmat uchun eski eslatmalar endi kerak emas
        db.execute(
            update(Reminder)
            .where(
                Reminder.vehicle_id == order.vehicle_id,
                Reminder.service_id == service.id,
                Reminder.status == ReminderStatus.pending,
            )
            .values(status=ReminderStatus.cancelled)
        )
        reminder = Reminder(
            customer_id=order.customer_id,
            vehicle_id=order.vehicle_id,
            service_id=service.id,
            order_id=order.id,
            due_date=add_months(base_date, months),
            due_mileage=due_mileage,
        )
        db.add(reminder)
        created.append(reminder)
    db.flush()
    return created


def queue_due(db: Session, today: date | None = None) -> list[int]:
    """Muddati kelgan eslatmalar uchun SMS navbatga qo'yadi. SMS id'larini qaytaradi."""
    today = today or now().date()
    cfg = settings_store.get_all(db)
    enabled = cfg["sms_reminder_enabled"] == "1"
    # skip_locked: bir nechta jarayon bir vaqtda ishlasa ham bitta eslatma ikki marta yuborilmaydi
    due = db.scalars(
        select(Reminder)
        .where(Reminder.status == ReminderStatus.pending, Reminder.due_date <= today)
        .with_for_update(skip_locked=True)
    ).all()
    ids = []
    for r in due:
        if enabled and r.customer.sms_enabled:
            text = render(
                cfg["sms_reminder"],
                name=r.customer.full_name,
                plate=r.vehicle.plate_number,
                service=r.service.name,
                mileage=r.due_mileage or "",
                company=cfg["company_name"],
                company_phone=cfg["company_phone"],
            )
            ids.append(queue_sms(db, r.customer.phone, text, "reminder", r.customer_id).id)
            r.status = ReminderStatus.sent
            r.sent_at = now()
        else:
            r.status = ReminderStatus.cancelled
    db.commit()
    return ids


def run_once() -> int:
    with SessionLocal() as db:
        ids = queue_due(db)
    deliver(ids)
    return len(ids)


async def reminder_loop() -> None:
    """Ilova ichida fon jarayoni: ish vaqtida har N daqiqada eslatmalarni yuboradi."""
    while True:
        try:
            hour = now().hour
            if settings.reminders_hour_from <= hour < settings.reminders_hour_to:
                sent = await asyncio.to_thread(run_once)
                if sent:
                    log.info("Eslatma SMS yuborildi: %s ta", sent)
        except Exception:
            log.exception("Eslatmalarni yuborishda xato")
        await asyncio.sleep(settings.reminders_interval_minutes * 60)
