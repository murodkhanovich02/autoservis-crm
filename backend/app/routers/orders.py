from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, AdminUser, CurrentUser, StaffUser, get_or_404
from app.models import (
    Appointment,
    AppointmentStatus,
    Customer,
    Order,
    OrderPart,
    OrderService,
    OrderStatus,
    Payment,
    Reminder,
    Role,
    Vehicle,
)
from app.schemas.common import Page
from app.schemas.orders import (
    OrderCreate,
    OrderListOut,
    OrderOut,
    OrderPartIn,
    OrderServiceIn,
    OrderUpdate,
    PaymentIn,
    ReminderBrief,
    StatusIn,
)
from app.services import orders as svc
from app.services.sms import deliver
from app.utils import normalize_plate

router = APIRouter(prefix="/orders", tags=["orders"])


def _load(db, order_id: int) -> Order:
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.customer),
            selectinload(Order.vehicle),
            selectinload(Order.mechanic),
            selectinload(Order.services).selectinload(OrderService.mechanic),
            selectinload(Order.parts),
            selectinload(Order.payments).selectinload(Payment.user),
        )
    )
    if not order:
        raise HTTPException(404, "Buyurtma topilmadi")
    return order


def _out(db, order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    reminders = db.scalars(
        select(Reminder).where(Reminder.order_id == order.id).options(selectinload(Reminder.service))
    ).all()
    out.reminders = [ReminderBrief.model_validate(r) for r in reminders]
    return out


@router.get("", response_model=Page[OrderListOut])
def list_orders(
    db: DB,
    user: CurrentUser,
    status: Annotated[list[OrderStatus] | None, Query()] = None,
    q: str | None = None,
    mechanic_id: int | None = None,
    customer_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    debt_only: bool = False,
    skip: int = 0,
    limit: int = 20,
):
    query = select(Order).join(Order.customer).join(Order.vehicle)
    if status:
        query = query.where(Order.status.in_(status))
    if mechanic_id:
        query = query.where(Order.mechanic_id == mechanic_id)
    if customer_id:
        query = query.where(Order.customer_id == customer_id)
    if date_from:
        query = query.where(Order.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.where(Order.created_at <= datetime.combine(date_to, time.max))
    if debt_only:
        query = query.where(Order.total > Order.paid, Order.status != OrderStatus.cancelled)
    if q and q.strip():
        term = q.strip()
        conds = [Customer.full_name.ilike(f"%{term}%"), Customer.phone.contains(term)]
        if term.lstrip("#№").isdigit():
            conds.append(Order.id == int(term.lstrip("#№")))
        if plate := normalize_plate(term):
            conds.append(Vehicle.plate_number.contains(plate))
        query = query.where(or_(*conds))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.options(selectinload(Order.customer), selectinload(Order.vehicle), selectinload(Order.mechanic))
        .order_by(Order.id.desc())
        .offset(skip)
        .limit(min(limit, 100))
    ).all()
    return Page(items=items, total=total)


@router.post("", response_model=OrderOut, status_code=201)
def create_order(data: OrderCreate, db: DB, user: StaffUser):
    customer = get_or_404(db, Customer, data.customer_id, "Mijoz")
    vehicle = get_or_404(db, Vehicle, data.vehicle_id, "Avtomobil")
    if vehicle.customer_id != customer.id:
        raise HTTPException(400, "Avtomobil bu mijozga tegishli emas")
    svc._check_mechanic(db, data.mechanic_id)
    order = Order(
        customer_id=customer.id,
        vehicle_id=vehicle.id,
        mechanic_id=data.mechanic_id,
        mileage=data.mileage,
        complaint=data.complaint,
        created_by_id=user.id,
    )
    db.add(order)
    db.flush()
    for line in data.services:
        svc.add_service(db, order, line)
    for line in data.parts:
        svc.add_part(db, order, line, user)
    if data.appointment_id:
        appt = get_or_404(db, Appointment, data.appointment_id, "Navbat")
        appt.order_id = order.id
        appt.customer_id = customer.id
        appt.status = AppointmentStatus.arrived
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order.id))


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: DB, _: CurrentUser):
    return _out(db, _load(db, order_id))


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, data: OrderUpdate, db: DB, user: CurrentUser):
    order = _load(db, order_id)
    svc.ensure_editable(order)
    values = data.model_dump(exclude_unset=True)
    if user.role == Role.mechanic and set(values) - {"diagnosis", "mileage"}:
        raise HTTPException(403, "Usta faqat xulosa va probegni o'zgartira oladi")
    if "mechanic_id" in values:
        svc._check_mechanic(db, values["mechanic_id"])
    if values.get("discount") is None:
        values.pop("discount", None)
    for key, value in values.items():
        setattr(order, key, value)
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))


@router.post("/{order_id}/status", response_model=OrderOut)
def set_status(order_id: int, data: StatusIn, db: DB, user: CurrentUser, bg: BackgroundTasks):
    order = _load(db, order_id)
    sms_ids = svc.change_status(db, order, data.status, user, notify=data.notify)
    db.commit()
    bg.add_task(deliver, sms_ids)
    return _out(db, _load(db, order_id))


@router.post("/{order_id}/services", response_model=OrderOut, status_code=201)
def add_service(order_id: int, data: OrderServiceIn, db: DB, _: StaffUser):
    order = _load(db, order_id)
    svc.ensure_editable(order)
    svc.add_service(db, order, data)
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))


@router.delete("/{order_id}/services/{line_id}", response_model=OrderOut)
def remove_service(order_id: int, line_id: int, db: DB, _: StaffUser):
    order = _load(db, order_id)
    svc.ensure_editable(order)
    line = next((s for s in order.services if s.id == line_id), None)
    if not line:
        raise HTTPException(404, "Xizmat topilmadi")
    order.services.remove(line)
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))


@router.post("/{order_id}/parts", response_model=OrderOut, status_code=201)
def add_part(order_id: int, data: OrderPartIn, db: DB, user: StaffUser):
    order = _load(db, order_id)
    svc.ensure_editable(order)
    svc.add_part(db, order, data, user)
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))


@router.delete("/{order_id}/parts/{line_id}", response_model=OrderOut)
def remove_part(order_id: int, line_id: int, db: DB, user: StaffUser):
    order = _load(db, order_id)
    svc.ensure_editable(order)
    line = next((p for p in order.parts if p.id == line_id), None)
    if not line:
        raise HTTPException(404, "Ehtiyot qism topilmadi")
    svc.return_part(db, order, line, user)
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))


@router.post("/{order_id}/payments", response_model=OrderOut, status_code=201)
def add_payment(order_id: int, data: PaymentIn, db: DB, user: StaffUser):
    order = _load(db, order_id)
    if order.status == OrderStatus.cancelled:
        raise HTTPException(400, "Bekor qilingan buyurtmaga to'lov qabul qilinmaydi")
    if Decimal(data.amount) > order.debt:
        raise HTTPException(400, "To'lov summasi qarzdan ko'p")
    order.payments.append(Payment(amount=data.amount, method=data.method, note=data.note, user_id=user.id))
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))


@router.delete("/{order_id}/payments/{payment_id}", response_model=OrderOut)
def remove_payment(order_id: int, payment_id: int, db: DB, _: AdminUser):
    order = _load(db, order_id)
    payment = next((p for p in order.payments if p.id == payment_id), None)
    if not payment:
        raise HTTPException(404, "To'lov topilmadi")
    order.payments.remove(payment)
    svc.recalc(order)
    db.commit()
    return _out(db, _load(db, order_id))
