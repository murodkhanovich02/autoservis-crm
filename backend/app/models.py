import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.utils import now

Money = Numeric(14, 2)
Qty = Numeric(12, 3)


def _enum(cls):
    return Enum(cls, native_enum=False, length=20, validate_strings=True)


class Role(enum.StrEnum):
    admin = "admin"        # rahbar: hamma narsa
    manager = "manager"    # administrator / qabulxona
    mechanic = "mechanic"  # usta


class OrderStatus(enum.StrEnum):
    new = "new"                      # qabul qilindi
    in_progress = "in_progress"      # jarayonda
    waiting_parts = "waiting_parts"  # zapchast kutilmoqda
    ready = "ready"                  # tayyor (mijozga SMS)
    closed = "closed"                # topshirildi
    cancelled = "cancelled"          # bekor qilindi


class AppointmentStatus(enum.StrEnum):
    new = "new"
    confirmed = "confirmed"
    arrived = "arrived"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class PaymentMethod(enum.StrEnum):
    cash = "cash"
    card = "card"
    transfer = "transfer"
    click = "click"
    payme = "payme"


class MovementKind(enum.StrEnum):
    incoming = "in"        # kirim (yetkazib beruvchidan)
    order = "order"        # buyurtmaga sarflandi
    returned = "return"    # buyurtmadan qaytarildi
    adjust = "adjust"      # inventarizatsiya / tuzatish


class SmsStatus(enum.StrEnum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class ReminderStatus(enum.StrEnum):
    pending = "pending"
    sent = "sent"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(_enum(Role), default=Role.manager)
    # usta ish haqi: bajargan xizmatlar summasidan foiz
    commission_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    phone2: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="customer", order_by="Vehicle.id")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    plate_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    brand: Mapped[str | None] = mapped_column(String(50))
    model: Mapped[str | None] = mapped_column(String(50))
    year: Mapped[int | None] = mapped_column(Integer)
    vin: Mapped[str | None] = mapped_column(String(30))
    color: Mapped[str | None] = mapped_column(String(30))
    mileage: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    customer: Mapped[Customer] = relationship(back_populates="vehicles")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str | None] = mapped_column(String(60), index=True)
    price: Mapped[Decimal] = mapped_column(Money, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    description: Mapped[str | None] = mapped_column(Text)
    # masalan moy almashtirish: 6 oy yoki 8000 km dan keyin eslatma
    reminder_months: Mapped[int | None] = mapped_column(Integer)
    reminder_km: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str | None] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    brand: Mapped[str | None] = mapped_column(String(60))
    unit: Mapped[str] = mapped_column(String(15), default="dona")
    quantity: Mapped[Decimal] = mapped_column(Qty, default=0)
    min_quantity: Mapped[Decimal] = mapped_column(Qty, default=0)
    purchase_price: Mapped[Decimal] = mapped_column(Money, default=0)
    sale_price: Mapped[Decimal] = mapped_column(Money, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    kind: Mapped[MovementKind] = mapped_column(_enum(MovementKind))
    quantity: Mapped[Decimal] = mapped_column(Qty)  # ishorali: +kirim, -chiqim
    unit_price: Mapped[Decimal] = mapped_column(Money, default=0)
    supplier: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(String(255))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)

    part: Mapped[Part] = relationship()
    user: Mapped[User | None] = relationship()


class Order(Base):
    """Zakaz-naryad: avtomobil bo'yicha bajariladigan ishlar."""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    mechanic_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[OrderStatus] = mapped_column(_enum(OrderStatus), default=OrderStatus.new, index=True)
    mileage: Mapped[int | None] = mapped_column(Integer)
    complaint: Mapped[str | None] = mapped_column(Text)   # mijoz shikoyati
    diagnosis: Mapped[str | None] = mapped_column(Text)   # usta xulosasi
    discount: Mapped[Decimal] = mapped_column(Money, default=0)
    services_total: Mapped[Decimal] = mapped_column(Money, default=0)
    parts_total: Mapped[Decimal] = mapped_column(Money, default=0)
    total: Mapped[Decimal] = mapped_column(Money, default=0)
    paid: Mapped[Decimal] = mapped_column(Money, default=0)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    ready_at: Mapped[datetime | None] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    customer: Mapped[Customer] = relationship()
    vehicle: Mapped[Vehicle] = relationship()
    mechanic: Mapped[User | None] = relationship(foreign_keys=[mechanic_id])
    services: Mapped[list["OrderService"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderService.id"
    )
    parts: Mapped[list["OrderPart"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderPart.id"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="Payment.id"
    )

    @property
    def number(self) -> str:
        return f"{self.id:06d}"

    @property
    def debt(self) -> Decimal:
        return max(Decimal(self.total or 0) - Decimal(self.paid or 0), Decimal(0))


class OrderService(Base):
    __tablename__ = "order_services"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"))
    name: Mapped[str] = mapped_column(String(150))
    price: Mapped[Decimal] = mapped_column(Money)
    quantity: Mapped[Decimal] = mapped_column(Qty, default=1)
    mechanic_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    order: Mapped[Order] = relationship(back_populates="services")
    mechanic: Mapped[User | None] = relationship()

    @property
    def amount(self) -> Decimal:
        return Decimal(self.price) * Decimal(self.quantity)


class OrderPart(Base):
    __tablename__ = "order_parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"))
    name: Mapped[str] = mapped_column(String(150))
    quantity: Mapped[Decimal] = mapped_column(Qty)
    price: Mapped[Decimal] = mapped_column(Money)  # sotuv narxi
    cost: Mapped[Decimal] = mapped_column(Money, default=0)  # tannarx (foyda hisobi uchun)

    order: Mapped[Order] = relationship(back_populates="parts")
    part: Mapped[Part] = relationship()

    @property
    def amount(self) -> Decimal:
        return Decimal(self.price) * Decimal(self.quantity)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Money)
    method: Mapped[PaymentMethod] = mapped_column(_enum(PaymentMethod), default=PaymentMethod.cash)
    note: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)

    order: Mapped[Order] = relationship(back_populates="payments")
    user: Mapped[User | None] = relationship()


class Appointment(Base):
    """Navbat / onlayn yozilish."""

    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    plate_number: Mapped[str | None] = mapped_column(String(20))
    car_info: Mapped[str | None] = mapped_column(String(120))
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        _enum(AppointmentStatus), default=AppointmentStatus.new, index=True
    )
    source: Mapped[str] = mapped_column(String(20), default="phone")  # online | phone | walk_in
    note: Mapped[str | None] = mapped_column(Text)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    service: Mapped[Service | None] = relationship()
    customer: Mapped[Customer | None] = relationship()


class Expense(Base):
    """Xarajatlar: ijara, kommunal, ish haqi va h.k."""

    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(60), index=True)
    amount: Mapped[Decimal] = mapped_column(Money)
    note: Mapped[str | None] = mapped_column(String(255))
    spent_on: Mapped[date] = mapped_column(Date, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Reminder(Base):
    """Keyingi xizmat eslatmasi (masalan, moy almashtirish)."""

    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    due_date: Mapped[date] = mapped_column(Date, index=True)
    due_mileage: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[ReminderStatus] = mapped_column(
        _enum(ReminderStatus), default=ReminderStatus.pending, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    customer: Mapped[Customer] = relationship()
    vehicle: Mapped[Vehicle] = relationship()
    service: Mapped[Service] = relationship()


class SmsMessage(Base):
    __tablename__ = "sms_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    text: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30), default="manual")  # appointment | order_ready | reminder | manual
    status: Mapped[SmsStatus] = mapped_column(_enum(SmsStatus), default=SmsStatus.pending, index=True)
    provider_id: Mapped[str | None] = mapped_column(String(60))
    error: Mapped[str | None] = mapped_column(String(255))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
