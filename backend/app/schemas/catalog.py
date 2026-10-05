from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.models import MovementKind
from app.schemas.common import ORM, Num, OptStr, PartBrief, UserBrief

NonNeg = Annotated[Num, Field(ge=0)]
Positive = Annotated[Num, Field(gt=0)]


# ---------- Xizmatlar ----------
class ServiceIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    category: OptStr = Field(None, max_length=60)
    price: NonNeg = Decimal(0)
    duration_minutes: int = Field(60, ge=5, le=60 * 24)
    description: OptStr = None
    reminder_months: int | None = Field(None, ge=1, le=60)
    reminder_km: int | None = Field(None, ge=100)
    is_active: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    category: OptStr = Field(None, max_length=60)
    price: NonNeg | None = None
    duration_minutes: int | None = Field(None, ge=5, le=60 * 24)
    description: OptStr = None
    reminder_months: int | None = Field(None, ge=1, le=60)
    reminder_km: int | None = Field(None, ge=100)
    is_active: bool | None = None


class ServiceOut(ORM):
    id: int
    name: str
    category: str | None
    price: Num
    duration_minutes: int
    description: str | None
    reminder_months: int | None
    reminder_km: int | None
    is_active: bool


# ---------- Ehtiyot qismlar ----------
class PartIn(BaseModel):
    code: OptStr = Field(None, max_length=60)
    name: str = Field(min_length=2, max_length=150)
    brand: OptStr = Field(None, max_length=60)
    unit: str = Field("dona", max_length=15)
    min_quantity: NonNeg = Decimal(0)
    purchase_price: NonNeg = Decimal(0)
    sale_price: NonNeg = Decimal(0)
    is_active: bool = True
    quantity: NonNeg = Decimal(0)  # boshlang'ich qoldiq (kirim sifatida yoziladi)


class PartUpdate(BaseModel):
    code: OptStr = Field(None, max_length=60)
    name: str | None = Field(None, min_length=2, max_length=150)
    brand: OptStr = Field(None, max_length=60)
    unit: str | None = Field(None, max_length=15)
    min_quantity: NonNeg | None = None
    purchase_price: NonNeg | None = None
    sale_price: NonNeg | None = None
    is_active: bool | None = None


class PartOut(ORM):
    id: int
    code: str | None
    name: str
    brand: str | None
    unit: str
    quantity: Num
    min_quantity: Num
    purchase_price: Num
    sale_price: Num
    is_active: bool
    is_low: bool = False


class StockIn(BaseModel):
    quantity: Positive
    unit_price: NonNeg | None = None
    supplier: OptStr = Field(None, max_length=120)
    note: OptStr = Field(None, max_length=255)
    update_purchase_price: bool = True


class StockAdjust(BaseModel):
    quantity: NonNeg  # haqiqiy qoldiq (inventarizatsiyadan keyin)
    note: OptStr = Field(None, max_length=255)


class MovementOut(ORM):
    id: int
    kind: MovementKind
    quantity: Num
    unit_price: Num
    supplier: str | None
    note: str | None
    order_id: int | None
    created_at: datetime
    part: PartBrief
    user: UserBrief | None
