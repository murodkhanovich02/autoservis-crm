from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import DB, CurrentUser, StaffUser, get_or_404
from app.models import (
    Appointment,
    AppointmentStatus,
    Customer,
    Order,
    Service,
    Vehicle,
)
from app.schemas.misc import (
    AppointmentIn,
    AppointmentOut,
    AppointmentUpdate,
    PublicAppointmentIn,
    Slot,
)
from app.schemas.orders import OrderServiceIn
from app.services import orders as order_svc
from app.services import settings_store
from app.services.sms import deliver, notify_appointment
from app.utils import now

router = APIRouter(prefix="/appointments", tags=["appointments"])
public_router = APIRouter(prefix="/public", tags=["public"])

INACTIVE = (AppointmentStatus.cancelled, AppointmentStatus.no_show)


def compute_slots(db: Session, day: date) -> list[Slot]:
    cfg = settings_store.get_all(db)
    start = datetime.combine(day, time.fromisoformat(cfg["work_start"]))
    end = datetime.combine(day, time.fromisoformat(cfg["work_end"]))
    step = timedelta(minutes=max(int(cfg["slot_minutes"]), 15))
    posts = max(int(cfg["posts_count"]), 1)
    booked = db.scalars(
        select(Appointment.scheduled_at).where(
            Appointment.scheduled_at >= start,
            Appointment.scheduled_at < end,
            Appointment.status.not_in(INACTIVE),
        )
    ).all()
    current = now()
    slots = []
    t = start
    while t + step <= end:
        if t > current:
            taken = sum(1 for b in booked if t <= b < t + step)
            slots.append(Slot(time=t.strftime("%H:%M"), free=max(posts - taken, 0)))
        t += step
    return slots


def _load(db: Session, appt_id: int) -> Appointment:
    appt = db.scalar(select(Appointment).where(Appointment.id == appt_id).options(selectinload(Appointment.service)))
    if not appt:
        raise HTTPException(404, "Navbat topilmadi")
    return appt


def _check_service(db: Session, service_id: int | None) -> None:
    if service_id is not None:
        service = db.get(Service, service_id)
        if not service or not service.is_active:
            raise HTTPException(400, "Xizmat topilmadi")


# ---------------- Xodimlar uchun ----------------


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    db: DB,
    _: CurrentUser,
    day: date | None = None,
    date_to: date | None = None,
    status: AppointmentStatus | None = None,
):
    day = day or now().date()
    end = date_to or day
    query = (
        select(Appointment)
        .where(
            Appointment.scheduled_at >= datetime.combine(day, time.min),
            Appointment.scheduled_at <= datetime.combine(end, time.max),
        )
        .options(selectinload(Appointment.service))
        .order_by(Appointment.scheduled_at)
    )
    if status:
        query = query.where(Appointment.status == status)
    return db.scalars(query).all()


@router.get("/new-count")
def new_count(db: DB, _: CurrentUser):
    """Tasdiqlanmagan onlayn yozilishlar soni (menyuda belgi uchun)."""
    return {
        "count": db.scalar(
            select(func.count(Appointment.id)).where(
                Appointment.status == AppointmentStatus.new, Appointment.scheduled_at >= now() - timedelta(hours=2)
            )
        )
    }


@router.get("/slots", response_model=list[Slot])
def slots(day: date, db: DB, _: CurrentUser):
    return compute_slots(db, day)


@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(data: AppointmentIn, db: DB, _: StaffUser, bg: BackgroundTasks):
    _check_service(db, data.service_id)
    values = data.model_dump(exclude={"notify"})
    if data.customer_id:
        get_or_404(db, Customer, data.customer_id, "Mijoz")
    else:
        values["customer_id"] = db.scalar(select(Customer.id).where(Customer.phone == data.phone))
    appt = Appointment(**values)
    db.add(appt)
    db.flush()
    sms_ids = []
    if data.notify and appt.status == AppointmentStatus.confirmed:
        db.refresh(appt)
        if msg := notify_appointment(db, appt):
            sms_ids.append(msg.id)
    db.commit()
    bg.add_task(deliver, sms_ids)
    return _load(db, appt.id)


@router.patch("/{appt_id}", response_model=AppointmentOut)
def update_appointment(appt_id: int, data: AppointmentUpdate, db: DB, _: CurrentUser, bg: BackgroundTasks):
    appt = _load(db, appt_id)
    values = data.model_dump(exclude_unset=True, exclude={"notify"})
    for required in ("customer_name", "phone", "scheduled_at", "status"):
        if values.get(required) is None:
            values.pop(required, None)
    if "service_id" in values:
        _check_service(db, values["service_id"])
    became_confirmed = values.get("status") == AppointmentStatus.confirmed and appt.status != AppointmentStatus.confirmed
    time_changed = "scheduled_at" in values and values["scheduled_at"] != appt.scheduled_at
    for key, value in values.items():
        setattr(appt, key, value)
    db.flush()
    sms_ids = []
    if data.notify and appt.status == AppointmentStatus.confirmed and (became_confirmed or time_changed):
        db.refresh(appt)
        if msg := notify_appointment(db, appt):
            sms_ids.append(msg.id)
    db.commit()
    bg.add_task(deliver, sms_ids)
    return _load(db, appt_id)


@router.post("/{appt_id}/to-order")
def appointment_to_order(appt_id: int, db: DB, user: StaffUser):
    """Mijoz keldi: navbatdan buyurtma ochish (mijoz va avtomobil avtomatik topiladi yoki yaratiladi)."""
    appt = _load(db, appt_id)
    if appt.order_id:
        return {"order_id": appt.order_id}
    if not appt.plate_number:
        raise HTTPException(400, "Buyurtma ochish uchun avtomobil davlat raqamini kiriting")

    vehicle = db.scalar(select(Vehicle).where(Vehicle.plate_number == appt.plate_number))
    if vehicle:
        customer = vehicle.customer
    else:
        customer = db.scalar(select(Customer).where(Customer.phone == appt.phone))
        if not customer:
            customer = Customer(full_name=appt.customer_name, phone=appt.phone)
            db.add(customer)
            db.flush()
        brand, _, model = (appt.car_info or "").partition(" ")
        vehicle = Vehicle(
            customer_id=customer.id, plate_number=appt.plate_number, brand=brand or None, model=model or None
        )
        db.add(vehicle)
        db.flush()

    order = Order(
        customer_id=customer.id,
        vehicle_id=vehicle.id,
        complaint=appt.note,
        mileage=vehicle.mileage,
        created_by_id=user.id,
    )
    db.add(order)
    db.flush()
    if appt.service_id:
        order_svc.add_service(db, order, OrderServiceIn(service_id=appt.service_id))
    order_svc.recalc(order)
    appt.order_id = order.id
    appt.customer_id = customer.id
    appt.status = AppointmentStatus.arrived
    db.commit()
    return {"order_id": order.id}


# ---------------- Onlayn yozilish (ochiq) ----------------


@public_router.get("/info")
def public_info(db: DB):
    cfg = settings_store.get_all(db)
    return {k: cfg[k] for k in settings_store.PUBLIC_KEYS}


@public_router.get("/services")
def public_services(db: DB):
    services = db.scalars(select(Service).where(Service.is_active.is_(True)).order_by(Service.category, Service.name))
    return [
        {"id": s.id, "name": s.name, "category": s.category, "price": float(s.price), "duration_minutes": s.duration_minutes}
        for s in services
    ]


@public_router.get("/slots", response_model=list[Slot])
def public_slots(day: date, db: DB):
    if day < now().date() or day > now().date() + timedelta(days=30):
        return []
    return compute_slots(db, day)


@public_router.post("/appointments", status_code=201)
def public_book(data: PublicAppointmentIn, db: DB):
    _check_service(db, data.service_id)
    scheduled = data.scheduled_at.replace(tzinfo=None, second=0, microsecond=0)
    free = {s.time: s.free for s in compute_slots(db, scheduled.date())}
    if free.get(scheduled.strftime("%H:%M"), 0) <= 0:
        raise HTTPException(400, "Bu vaqt band yoki ish vaqtidan tashqarida. Boshqa vaqtni tanlang")
    active = db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.phone == data.phone,
            Appointment.scheduled_at >= now(),
            Appointment.status.not_in(INACTIVE),
        )
    )
    if active >= 3:
        raise HTTPException(429, "Bu raqamdan juda ko'p yozilish bor. Iltimos, qo'ng'iroq qiling")
    appt = Appointment(
        **data.model_dump(exclude={"scheduled_at"}),
        scheduled_at=scheduled,
        source="online",
        status=AppointmentStatus.new,
        customer_id=db.scalar(select(Customer.id).where(Customer.phone == data.phone)),
    )
    db.add(appt)
    db.commit()
    return {"id": appt.id, "scheduled_at": appt.scheduled_at, "status": appt.status}
