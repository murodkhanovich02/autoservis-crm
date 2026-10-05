from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORM, CustomerBrief, Num, OptPhone, OptStr, Phone, Plate, VehicleBrief


class CustomerIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: Phone
    phone2: OptPhone = None
    notes: OptStr = None
    sms_enabled: bool = True


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=120)
    phone: Phone | None = None
    phone2: OptPhone = None
    notes: OptStr = None
    sms_enabled: bool | None = None


class CustomerOut(ORM):
    id: int
    full_name: str
    phone: str
    phone2: str | None
    notes: str | None
    sms_enabled: bool
    created_at: datetime
    vehicles: list[VehicleBrief] = []


class CustomerStats(BaseModel):
    orders_count: int
    total_spent: Num
    debt: Num
    last_visit: datetime | None


class CustomerDetail(CustomerOut):
    stats: CustomerStats


class VehicleIn(BaseModel):
    customer_id: int
    plate_number: Plate
    brand: OptStr = Field(None, max_length=50)
    model: OptStr = Field(None, max_length=50)
    year: int | None = Field(None, ge=1950, le=2100)
    vin: OptStr = Field(None, max_length=30)
    color: OptStr = Field(None, max_length=30)
    mileage: int | None = Field(None, ge=0)


class VehicleUpdate(BaseModel):
    customer_id: int | None = None
    plate_number: Plate | None = None
    brand: OptStr = Field(None, max_length=50)
    model: OptStr = Field(None, max_length=50)
    year: int | None = Field(None, ge=1950, le=2100)
    vin: OptStr = Field(None, max_length=30)
    color: OptStr = Field(None, max_length=30)
    mileage: int | None = Field(None, ge=0)


class VehicleOut(ORM):
    id: int
    plate_number: str
    brand: str | None
    model: str | None
    year: int | None
    vin: str | None
    color: str | None
    mileage: int | None
    created_at: datetime
    customer: CustomerBrief
