from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, model_validator

from app.models import OrderStatus, PaymentMethod, ReminderStatus
from app.schemas.common import (
    ORM,
    CustomerBrief,
    Num,
    OptStr,
    ServiceBrief,
    UserBrief,
    VehicleBrief,
)

NonNeg = Annotated[Num, Field(ge=0)]
Positive = Annotated[Num, Field(gt=0)]


class OrderServiceIn(BaseModel):
    service_id: int | None = None
    name: OptStr = Field(None, max_length=150)  # katalogda yo'q ish uchun
    price: NonNeg | None = None  # bo'sh bo'lsa katalog narxi
    quantity: Positive = Decimal(1)
    mechanic_id: int | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.service_id is None and not self.name:
            raise ValueError("Xizmat tanlang yoki nomini kiriting")
        if self.service_id is None and self.price is None:
            raise ValueError("Katalogda yo'q xizmat uchun narx kiriting")
        return self


class OrderPartIn(BaseModel):
    part_id: int
    quantity: Positive
    price: NonNeg | None = None  # bo'sh bo'lsa ombordagi sotuv narxi


class OrderCreate(BaseModel):
    customer_id: int
    vehicle_id: int
    mechanic_id: int | None = None
    mileage: int | None = Field(None, ge=0)
    complaint: OptStr = None
    appointment_id: int | None = None
    services: list[OrderServiceIn] = []
    parts: list[OrderPartIn] = []


class OrderUpdate(BaseModel):
    mechanic_id: int | None = None
    mileage: int | None = Field(None, ge=0)
    complaint: OptStr = None
    diagnosis: OptStr = None
    discount: NonNeg | None = None


class StatusIn(BaseModel):
    status: OrderStatus
    notify: bool = True  # "tayyor" bo'lganda mijozga SMS


class PaymentIn(BaseModel):
    amount: Positive
    method: PaymentMethod = PaymentMethod.cash
    note: OptStr = Field(None, max_length=255)


class OrderServiceOut(ORM):
    id: int
    service_id: int | None
    name: str
    price: Num
    quantity: Num
    amount: Num
    mechanic: UserBrief | None


class OrderPartOut(ORM):
    id: int
    part_id: int
    name: str
    quantity: Num
    price: Num
    amount: Num


class PaymentOut(ORM):
    id: int
    amount: Num
    method: PaymentMethod
    note: str | None
    created_at: datetime
    user: UserBrief | None


class ReminderBrief(ORM):
    id: int
    due_date: date
    due_mileage: int | None
    status: ReminderStatus
    service: ServiceBrief


class OrderListOut(ORM):
    id: int
    number: str
    status: OrderStatus
    customer: CustomerBrief
    vehicle: VehicleBrief
    mechanic: UserBrief | None
    total: Num
    paid: Num
    debt: Num
    created_at: datetime
    closed_at: datetime | None


class OrderOut(OrderListOut):
    mileage: int | None
    complaint: str | None
    diagnosis: str | None
    discount: Num
    services_total: Num
    parts_total: Num
    ready_at: datetime | None
    services: list[OrderServiceOut]
    parts: list[OrderPartOut]
    payments: list[PaymentOut]
    reminders: list[ReminderBrief] = []
