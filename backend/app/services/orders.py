"""Buyurtma (zakaz-naryad) biznes-logikasi: summalar, ombor, statuslar."""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentStatus,
    MovementKind,
    Order,
    OrderPart,
    OrderService,
    OrderStatus,
    Part,
    Role,
    Service,
    StockMovement,
    User,
)
from app.schemas.orders import OrderPartIn, OrderServiceIn
from app.services import reminders, sms
from app.utils import now

OPEN_STATUSES = {OrderStatus.new, OrderStatus.in_progress, OrderStatus.waiting_parts, OrderStatus.ready}

# qaysi statusdan qaysiga o'tish mumkin
TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.new: {OrderStatus.in_progress, OrderStatus.waiting_parts, OrderStatus.ready, OrderStatus.closed, OrderStatus.cancelled},
    OrderStatus.in_progress: {OrderStatus.waiting_parts, OrderStatus.ready, OrderStatus.closed, OrderStatus.cancelled},
    OrderStatus.waiting_parts: {OrderStatus.in_progress, OrderStatus.ready, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.in_progress, OrderStatus.closed},
    OrderStatus.closed: set(),
    OrderStatus.cancelled: set(),
}


def ensure_editable(order: Order) -> None:
    if order.status not in OPEN_STATUSES:
        raise HTTPException(400, "Yopilgan yoki bekor qilingan buyurtmani o'zgartirib bo'lmaydi")


def recalc(order: Order) -> None:
    order.services_total = sum((s.amount for s in order.services), Decimal(0))
    order.parts_total = sum((p.amount for p in order.parts), Decimal(0))
    gross = order.services_total + order.parts_total
    order.total = max(gross - Decimal(order.discount or 0), Decimal(0))
    order.paid = sum((Decimal(p.amount) for p in order.payments), Decimal(0))


def _check_mechanic(db: Session, mechanic_id: int | None) -> None:
    if mechanic_id is None:
        return
    user = db.get(User, mechanic_id)
    if not user or not user.is_active:
        raise HTTPException(400, "Usta topilmadi")


def add_service(db: Session, order: Order, data: OrderServiceIn) -> OrderService:
    _check_mechanic(db, data.mechanic_id)
    name, price = data.name, data.price
    if data.service_id is not None:
        service = db.get(Service, data.service_id)
        if not service:
            raise HTTPException(400, "Xizmat topilmadi")
        name = name or service.name
        price = service.price if price is None else price
    line = OrderService(
        service_id=data.service_id,
        name=name,
        price=price,
        quantity=data.quantity,
        mechanic_id=data.mechanic_id or order.mechanic_id,
    )
    order.services.append(line)
    return line


def add_part(db: Session, order: Order, data: OrderPartIn, user: User) -> OrderPart:
    part = db.get(Part, data.part_id, with_for_update=True)
    if not part or not part.is_active:
        raise HTTPException(400, "Ehtiyot qism topilmadi")
    qty = Decimal(data.quantity)
    if part.quantity < qty:
        raise HTTPException(400, f"Omborda yetarli emas: {part.name} (qoldiq: {part.quantity.normalize():f} {part.unit})")
    part.quantity -= qty
    line = OrderPart(
        part_id=part.id,
        name=part.name,
        quantity=qty,
        price=part.sale_price if data.price is None else data.price,
        cost=part.purchase_price,
    )
    order.parts.append(line)
    db.flush()  # order.id kerak
    db.add(StockMovement(
        part_id=part.id, kind=MovementKind.order, quantity=-qty,
        unit_price=part.purchase_price, order_id=order.id, user_id=user.id,
        note=f"Buyurtma №{order.number}",
    ))
    return line


def return_part(db: Session, order: Order, line: OrderPart, user: User) -> None:
    part = db.get(Part, line.part_id, with_for_update=True)
    part.quantity += line.quantity
    db.add(StockMovement(
        part_id=part.id, kind=MovementKind.returned, quantity=line.quantity,
        unit_price=line.cost, order_id=order.id, user_id=user.id,
        note=f"Buyurtma №{order.number} dan qaytarildi",
    ))
    order.parts.remove(line)


def change_status(db: Session, order: Order, new: OrderStatus, user: User, notify: bool = True) -> list[int]:
    """Statusni o'zgartiradi. Yuborilishi kerak bo'lgan SMS id'larini qaytaradi."""
    if new == order.status:
        return []
    if new not in TRANSITIONS[order.status]:
        raise HTTPException(400, "Bu statusga o'tkazib bo'lmaydi")
    if user.role == Role.mechanic and new in (OrderStatus.closed, OrderStatus.cancelled):
        raise HTTPException(403, "Usta buyurtmani yopa yoki bekor qila olmaydi")

    sms_ids: list[int] = []
    if new == OrderStatus.cancelled:
        if order.payments:
            raise HTTPException(400, "To'lov qilingan buyurtmani bekor qilishdan oldin to'lovlarni o'chiring")
        for line in list(order.parts):
            return_part(db, order, line, user)
        recalc(order)

    order.status = new

    if new == OrderStatus.ready:
        order.ready_at = now()
        if notify:
            msg = sms.notify_order_ready(db, order)
            if msg:
                sms_ids.append(msg.id)

    if new == OrderStatus.closed:
        order.closed_at = now()
        if order.ready_at is None:
            order.ready_at = order.closed_at
        if order.mileage and (order.vehicle.mileage or 0) < order.mileage:
            order.vehicle.mileage = order.mileage
        reminders.create_for_order(db, order)
        db.execute(
            update(Appointment)
            .where(Appointment.order_id == order.id)
            .values(status=AppointmentStatus.completed)
        )
    return sms_ids
