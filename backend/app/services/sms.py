"""SMS yuborish: provayderlar, shablonlar va xabarnomalar."""

import logging
from functools import cache
from typing import Protocol

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import SessionLocal
from app.models import Appointment, Customer, Order, SmsMessage, SmsStatus
from app.services import settings_store
from app.utils import fmt_money, now

log = logging.getLogger("sms")


class SmsError(Exception):
    pass


class SmsProvider(Protocol):
    def send(self, phone: str, text: str) -> str | None: ...


class ConsoleProvider:
    """Ishlab chiqish uchun: SMS yubormaydi, faqat logga yozadi."""

    def send(self, phone: str, text: str) -> str | None:
        log.warning("[SMS console] %s: %s", phone, text)
        return None


class EskizProvider:
    """notify.eskiz.uz API. Diqqat: Eskiz SMS matnlarini oldindan moderatsiyadan o'tkazadi."""

    def __init__(self, email: str, password: str, sender: str, base_url: str):
        self.email = email
        self.password = password
        self.sender = sender
        self.base_url = base_url.rstrip("/")
        self._token: str | None = None

    def _login(self, client: httpx.Client) -> None:
        r = client.post(f"{self.base_url}/auth/login", data={"email": self.email, "password": self.password})
        if r.status_code >= 400:
            raise SmsError(f"Eskiz login xatosi: {r.status_code}")
        self._token = r.json()["data"]["token"]

    def send(self, phone: str, text: str) -> str | None:
        with httpx.Client(timeout=15) as client:
            if not self._token:
                self._login(client)
            for attempt in range(2):
                r = client.post(
                    f"{self.base_url}/message/sms/send",
                    headers={"Authorization": f"Bearer {self._token}"},
                    data={"mobile_phone": phone, "message": text, "from": self.sender},
                )
                if r.status_code == 401 and attempt == 0:
                    self._login(client)  # token muddati tugagan
                    continue
                if r.status_code >= 400:
                    raise SmsError(f"Eskiz {r.status_code}: {r.text[:200]}")
                return str(r.json().get("id") or "")
        return None


@cache
def get_provider() -> SmsProvider:
    if settings.sms_provider == "eskiz":
        return EskizProvider(settings.eskiz_email, settings.eskiz_password, settings.eskiz_from, settings.eskiz_base_url)
    return ConsoleProvider()


class _SafeDict(dict):
    def __missing__(self, key):
        return ""


def render(template: str, **ctx) -> str:
    try:
        return template.format_map(_SafeDict(ctx)).strip()
    except (ValueError, IndexError, AttributeError):  # shablonda noto'g'ri { } bo'lsa
        log.warning("SMS shablonida xato: %s", template)
        return template.strip()


def queue_sms(
    db: Session, phone: str, text: str, kind: str = "manual", customer_id: int | None = None
) -> SmsMessage:
    msg = SmsMessage(phone=phone, text=text, kind=kind, customer_id=customer_id)
    db.add(msg)
    db.flush()
    return msg


def deliver(message_ids: list[int]) -> None:
    """Navbatdagi SMS'larni yuboradi. BackgroundTasks orqali, commit'dan keyin chaqiriladi."""
    if not message_ids:
        return
    provider = get_provider()
    with SessionLocal() as db:
        for msg_id in message_ids:
            msg = db.get(SmsMessage, msg_id)
            if not msg or msg.status != SmsStatus.pending:
                continue
            try:
                msg.provider_id = provider.send(msg.phone, msg.text)
                msg.status = SmsStatus.sent
                msg.sent_at = now()
            except Exception as exc:  # tarmoq xatosi va h.k. — logga yozib, davom etamiz
                log.exception("SMS yuborilmadi: %s", msg.phone)
                msg.status = SmsStatus.failed
                msg.error = str(exc)[:255]
            db.commit()


def _base_ctx(db: Session) -> dict:
    cfg = settings_store.get_all(db)
    return {"company": cfg["company_name"], "company_phone": cfg["company_phone"], "_cfg": cfg}


def notify_appointment(db: Session, appt: Appointment) -> SmsMessage | None:
    ctx = _base_ctx(db)
    cfg = ctx.pop("_cfg")
    if cfg["sms_appointment_enabled"] != "1":
        return None
    if appt.customer_id:
        customer = db.get(Customer, appt.customer_id)
        if customer and not customer.sms_enabled:
            return None
    text = render(
        cfg["sms_appointment"],
        name=appt.customer_name,
        date=appt.scheduled_at.strftime("%d.%m.%Y"),
        time=appt.scheduled_at.strftime("%H:%M"),
        service=appt.service.name if appt.service else "",
        plate=appt.plate_number or "",
        **ctx,
    )
    return queue_sms(db, appt.phone, text, "appointment", appt.customer_id)


def notify_order_ready(db: Session, order: Order) -> SmsMessage | None:
    ctx = _base_ctx(db)
    cfg = ctx.pop("_cfg")
    if cfg["sms_order_ready_enabled"] != "1" or not order.customer.sms_enabled:
        return None
    text = render(
        cfg["sms_order_ready"],
        name=order.customer.full_name,
        plate=order.vehicle.plate_number,
        total=fmt_money(order.total),
        debt=fmt_money(order.debt),
        number=order.number,
        **ctx,
    )
    return queue_sms(db, order.customer.phone, text, "order_ready", order.customer_id)
