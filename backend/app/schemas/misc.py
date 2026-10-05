from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models import AppointmentStatus, ReminderStatus, SmsStatus
from app.schemas.common import (
    ORM,
    CustomerBrief,
    LocalDT,
    Num,
    OptPlate,
    OptStr,
    Phone,
    ServiceBrief,
    VehicleBrief,
)

# ---------- Navbat (yozilish) ----------


class PublicAppointmentIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    phone: Phone
    plate_number: OptPlate = None
    car_info: OptStr = Field(None, max_length=120)
    service_id: int | None = None
    scheduled_at: LocalDT
    note: OptStr = Field(None, max_length=500)


class AppointmentIn(PublicAppointmentIn):
    customer_id: int | None = None
    source: Literal["phone", "walk_in", "online"] = "phone"
    status: AppointmentStatus = AppointmentStatus.confirmed
    notify: bool = True  # tasdiqlanganda SMS yuborish


class AppointmentUpdate(BaseModel):
    customer_name: str | None = Field(None, min_length=2, max_length=120)
    phone: Phone | None = None
    plate_number: OptPlate = None
    car_info: OptStr = Field(None, max_length=120)
    service_id: int | None = None
    scheduled_at: LocalDT | None = None
    status: AppointmentStatus | None = None
    note: OptStr = None
    notify: bool = True


class AppointmentOut(ORM):
    id: int
    customer_id: int | None
    customer_name: str
    phone: str
    plate_number: str | None
    car_info: str | None
    scheduled_at: datetime
    status: AppointmentStatus
    source: str
    note: str | None
    order_id: int | None
    created_at: datetime
    service: ServiceBrief | None


class Slot(BaseModel):
    time: str
    free: int


# ---------- Xarajatlar ----------


class ExpenseIn(BaseModel):
    category: str = Field(min_length=2, max_length=60)
    amount: Annotated[Num, Field(gt=0)]
    note: OptStr = Field(None, max_length=255)
    spent_on: date | None = None


class ExpenseOut(ORM):
    id: int
    category: str
    amount: Num
    note: str | None
    spent_on: date
    created_at: datetime


# ---------- SMS ----------


class SmsOut(ORM):
    id: int
    phone: str
    text: str
    kind: str
    status: SmsStatus
    error: str | None
    customer_id: int | None
    created_at: datetime
    sent_at: datetime | None


class SmsSendIn(BaseModel):
    text: str = Field(min_length=3, max_length=700)
    customer_ids: list[int] = []
    phones: list[Phone] = []
    all_customers: bool = False


class ReminderOut(ORM):
    id: int
    due_date: date
    due_mileage: int | None
    status: ReminderStatus
    sent_at: datetime | None
    order_id: int | None
    customer: CustomerBrief
    vehicle: VehicleBrief
    service: ServiceBrief
