from decimal import Decimal

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, AdminUser, CurrentUser, StaffUser, get_or_404
from app.models import Customer, Order, OrderStatus, Vehicle
from app.schemas.common import Page
from app.schemas.customers import (
    CustomerDetail,
    CustomerIn,
    CustomerOut,
    CustomerStats,
    CustomerUpdate,
    VehicleIn,
    VehicleOut,
    VehicleUpdate,
)
from app.schemas.orders import OrderListOut
from app.utils import normalize_phone, normalize_plate

router = APIRouter(tags=["customers"])


def _ensure_unique_phone(db, phone: str, exclude_id: int | None = None):
    q = select(Customer.id).where(Customer.phone == phone)
    if exclude_id:
        q = q.where(Customer.id != exclude_id)
    if db.scalar(q):
        raise HTTPException(409, "Bu telefon raqami bilan mijoz allaqachon mavjud")


def _ensure_unique_plate(db, plate: str, exclude_id: int | None = None):
    q = select(Vehicle.id).where(Vehicle.plate_number == plate)
    if exclude_id:
        q = q.where(Vehicle.id != exclude_id)
    if db.scalar(q):
        raise HTTPException(409, "Bu davlat raqamli avtomobil allaqachon mavjud")


# ---------------- Mijozlar ----------------


@router.get("/customers", response_model=Page[CustomerOut])
def list_customers(db: DB, _: CurrentUser, q: str | None = None, skip: int = 0, limit: int = 20):
    query = select(Customer)
    if q and q.strip():
        term = f"%{q.strip()}%"
        conds = [Customer.full_name.ilike(term), Customer.phone.ilike(term)]
        if digits := normalize_phone(q):
            conds.append(Customer.phone.contains(digits[-9:] if len(digits) >= 9 else digits))
        if plate := normalize_plate(q):
            conds.append(Customer.vehicles.any(Vehicle.plate_number.contains(plate)))
        query = query.where(or_(*conds))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.options(selectinload(Customer.vehicles)).order_by(Customer.id.desc()).offset(skip).limit(min(limit, 100))
    ).all()
    return Page(items=items, total=total)


@router.post("/customers", response_model=CustomerOut, status_code=201)
def create_customer(data: CustomerIn, db: DB, _: StaffUser):
    _ensure_unique_phone(db, data.phone)
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/customers/{customer_id}", response_model=CustomerDetail)
def get_customer(customer_id: int, db: DB, _: CurrentUser):
    customer = get_or_404(db, Customer, customer_id, "Mijoz")
    row = db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.paid), 0),
            func.coalesce(func.sum(Order.total - Order.paid), 0),
            func.max(Order.created_at),
        ).where(Order.customer_id == customer_id, Order.status != OrderStatus.cancelled)
    ).one()
    stats = CustomerStats(
        orders_count=row[0], total_spent=row[1], debt=max(Decimal(row[2]), Decimal(0)), last_visit=row[3]
    )
    return CustomerDetail.model_validate({**CustomerOut.model_validate(customer).model_dump(), "stats": stats})


@router.get("/customers/{customer_id}/orders", response_model=list[OrderListOut])
def customer_orders(customer_id: int, db: DB, _: CurrentUser):
    return db.scalars(select(Order).where(Order.customer_id == customer_id).order_by(Order.id.desc())).all()


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerUpdate, db: DB, _: StaffUser):
    customer = get_or_404(db, Customer, customer_id, "Mijoz")
    values = data.model_dump(exclude_unset=True)
    if values.get("phone") is None:
        values.pop("phone", None)
    else:
        _ensure_unique_phone(db, values["phone"], customer_id)
    for key, value in values.items():
        setattr(customer, key, value)
    db.commit()
    return customer


@router.delete("/customers/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: DB, _: AdminUser):
    customer = get_or_404(db, Customer, customer_id, "Mijoz")
    if db.scalar(select(Order.id).where(Order.customer_id == customer_id).limit(1)):
        raise HTTPException(400, "Buyurtmalari bor mijozni o'chirib bo'lmaydi")
    for v in customer.vehicles:
        db.delete(v)
    db.delete(customer)
    db.commit()


# ---------------- Avtomobillar ----------------


@router.get("/vehicles", response_model=Page[VehicleOut])
def list_vehicles(
    db: DB, _: CurrentUser, q: str | None = None, customer_id: int | None = None, skip: int = 0, limit: int = 20
):
    query = select(Vehicle)
    if customer_id:
        query = query.where(Vehicle.customer_id == customer_id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        conds = [Vehicle.brand.ilike(term), Vehicle.model.ilike(term), Vehicle.vin.ilike(term)]
        if plate := normalize_plate(q):
            conds.append(Vehicle.plate_number.contains(plate))
        query = query.where(or_(*conds))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.options(selectinload(Vehicle.customer)).order_by(Vehicle.id.desc()).offset(skip).limit(min(limit, 100))
    ).all()
    return Page(items=items, total=total)


@router.post("/vehicles", response_model=VehicleOut, status_code=201)
def create_vehicle(data: VehicleIn, db: DB, _: StaffUser):
    get_or_404(db, Customer, data.customer_id, "Mijoz")
    _ensure_unique_plate(db, data.plate_number)
    vehicle = Vehicle(**data.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: DB, _: CurrentUser):
    return get_or_404(db, Vehicle, vehicle_id, "Avtomobil")


@router.get("/vehicles/{vehicle_id}/orders", response_model=list[OrderListOut])
def vehicle_orders(vehicle_id: int, db: DB, _: CurrentUser):
    return db.scalars(select(Order).where(Order.vehicle_id == vehicle_id).order_by(Order.id.desc())).all()


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: int, data: VehicleUpdate, db: DB, _: StaffUser):
    vehicle = get_or_404(db, Vehicle, vehicle_id, "Avtomobil")
    values = data.model_dump(exclude_unset=True)
    for required in ("plate_number", "customer_id"):
        if values.get(required) is None:
            values.pop(required, None)
    if "plate_number" in values:
        _ensure_unique_plate(db, values["plate_number"], vehicle_id)
    if "customer_id" in values:
        get_or_404(db, Customer, values["customer_id"], "Mijoz")
    for key, value in values.items():
        setattr(vehicle, key, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, db: DB, _: AdminUser):
    vehicle = get_or_404(db, Vehicle, vehicle_id, "Avtomobil")
    if db.scalar(select(Order.id).where(Order.vehicle_id == vehicle_id).limit(1)):
        raise HTTPException(400, "Buyurtmalari bor avtomobilni o'chirib bo'lmaydi")
    db.delete(vehicle)
    db.commit()
