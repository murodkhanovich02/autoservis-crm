from datetime import datetime
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, PlainSerializer

from app.models import Role
from app.utils import TZ, normalize_phone, normalize_plate

T = TypeVar("T")

# Pul va miqdorlar: kirishda Decimal, JSON'da son (float)
Num = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


def _empty_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


def _phone(v):
    p = normalize_phone(str(v))
    if not p or not 9 <= len(p) <= 15:
        raise ValueError("Telefon raqami noto'g'ri")
    return p


def _opt_phone(v):
    v = _empty_to_none(v)
    return None if v is None else _phone(v)


def _plate(v):
    p = normalize_plate(str(v))
    if not p or len(p) < 4:
        raise ValueError("Davlat raqami noto'g'ri")
    return p


def _opt_plate(v):
    v = _empty_to_none(v)
    return None if v is None else _plate(v)


def _local_naive(v: datetime) -> datetime:
    """Vaqt zonasi bilan kelgan sanani Toshkent vaqtiga o'tkazib, zonasiz saqlaymiz."""
    if v.tzinfo is not None:
        v = v.astimezone(TZ).replace(tzinfo=None)
    return v.replace(second=0, microsecond=0)


LocalDT = Annotated[datetime, AfterValidator(_local_naive)]
Phone = Annotated[str, BeforeValidator(_phone)]
OptPhone = Annotated[str | None, BeforeValidator(_opt_phone)]
Plate = Annotated[str, BeforeValidator(_plate)]
OptPlate = Annotated[str | None, BeforeValidator(_opt_plate)]
OptStr = Annotated[str | None, BeforeValidator(_empty_to_none)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int


class UserBrief(ORM):
    id: int
    full_name: str
    role: Role


class CustomerBrief(ORM):
    id: int
    full_name: str
    phone: str


class VehicleBrief(ORM):
    id: int
    plate_number: str
    brand: str | None
    model: str | None
    year: int | None
    mileage: int | None


class ServiceBrief(ORM):
    id: int
    name: str
    price: Num
    duration_minutes: int


class PartBrief(ORM):
    id: int
    name: str
    code: str | None
    unit: str


class Message(BaseModel):
    detail: str


class Timestamped(ORM):
    created_at: datetime
