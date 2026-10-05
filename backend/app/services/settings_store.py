from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Setting

DEFAULTS: dict[str, str] = {
    "company_name": "AutoServis",
    "company_phone": "+998 90 000 00 00",
    "company_address": "Toshkent sh.",
    "work_start": "09:00",
    "work_end": "19:00",
    "slot_minutes": "60",
    "posts_count": "3",  # bir vaqtda nechta mashina qabul qilinadi (ko'targichlar soni)
    "sms_appointment_enabled": "1",
    "sms_order_ready_enabled": "1",
    "sms_reminder_enabled": "1",
    "sms_appointment": (
        "Hurmatli {name}! Siz {date} kuni soat {time} da {company} ga yozildingiz. "
        "Tel: {company_phone}"
    ),
    "sms_order_ready": (
        "Hurmatli {name}! {plate} avtomobilingiz tayyor, olib ketishingiz mumkin. Jami: {total} so'm. {company}"
    ),
    "sms_reminder": (
        "Hurmatli {name}! {plate} avtomobilingiz uchun \"{service}\" vaqti keldi. "
        "Sizni kutamiz! {company}, tel: {company_phone}"
    ),
}

PUBLIC_KEYS = ("company_name", "company_phone", "company_address", "work_start", "work_end", "slot_minutes")


def get_all(db: Session) -> dict[str, str]:
    data = dict(DEFAULTS)
    data.update({s.key: s.value for s in db.scalars(select(Setting))})
    return data


def get(db: Session, key: str) -> str:
    row = db.get(Setting, key)
    return row.value if row else DEFAULTS.get(key, "")


def set_many(db: Session, values: dict[str, str]) -> None:
    for key, value in values.items():
        if key not in DEFAULTS:
            continue
        row = db.get(Setting, key)
        if row:
            row.value = str(value)
        else:
            db.add(Setting(key=key, value=str(value)))
