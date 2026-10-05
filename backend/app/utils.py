import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

TZ = ZoneInfo(settings.timezone)


def now() -> datetime:
    """Joriy mahalliy vaqt (Toshkent), bazada timezone'siz saqlanadi."""
    return datetime.now(TZ).replace(tzinfo=None, microsecond=0)


def normalize_phone(phone: str | None) -> str | None:
    """'+998 (90) 123-45-67' -> '998901234567'. 9 xonali raqamga 998 qo'shiladi."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 9:
        digits = "998" + digits
    return digits or None


def normalize_plate(plate: str | None) -> str | None:
    """'01 a 123 bc' -> '01A123BC'"""
    if not plate:
        return None
    return re.sub(r"[\s\-]", "", plate).upper() or None


def fmt_money(value) -> str:
    return f"{int(round(float(value or 0))):,}".replace(",", " ")
