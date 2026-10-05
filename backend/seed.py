"""Boshlang'ich ma'lumotlar.

    python seed.py --admin-password <parol>   # admin + xizmatlar katalogi
    python seed.py --demo                     # + namunaviy mijozlar, ombor, buyurtmalar (sinov uchun)
"""

import argparse
import random
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.core.security import hash_password
from app.db import SessionLocal
from app.models import (
    Customer,
    Expense,
    MovementKind,
    Order,
    OrderStatus,
    Part,
    Payment,
    PaymentMethod,
    Role,
    Service,
    StockMovement,
    User,
    Vehicle,
)
from app.schemas.orders import OrderPartIn, OrderServiceIn
from app.services import orders as order_svc
from app.utils import now

# (nomi, kategoriya, narx, daqiqa, eslatma_oy, eslatma_km)
SERVICES = [
    ("Motor moyini almashtirish", "Moy almashtirish", 50_000, 30, 6, 8000),
    ("Moy filtrini almashtirish", "Moy almashtirish", 20_000, 15, None, None),
    ("Havo filtrini almashtirish", "Moy almashtirish", 20_000, 15, 12, 15000),
    ("Salon filtrini almashtirish", "Moy almashtirish", 25_000, 20, 12, 15000),
    ("Uzatmalar qutisi moyini almashtirish", "Moy almashtirish", 120_000, 60, 24, 60000),
    ("Kompyuter diagnostikasi", "Diagnostika", 100_000, 30, None, None),
    ("Xodovoy qismini tekshirish", "Diagnostika", 50_000, 30, None, None),
    ("Tormoz kolodkalarini almashtirish (old)", "Tormoz tizimi", 100_000, 60, None, None),
    ("Tormoz kolodkalarini almashtirish (orqa)", "Tormoz tizimi", 120_000, 60, None, None),
    ("Tormoz suyuqligini almashtirish", "Tormoz tizimi", 80_000, 40, 24, None),
    ("Sham (svecha) almashtirish", "Dvigatel", 60_000, 30, 12, 30000),
    ("GRM tasmasini almashtirish", "Dvigatel", 500_000, 240, None, None),
    ("Antifriz almashtirish", "Sovutish tizimi", 80_000, 40, 24, 40000),
    ("Amortizator almashtirish (1 dona)", "Xodovoy", 150_000, 60, None, None),
    ("Shar opora almashtirish", "Xodovoy", 100_000, 60, None, None),
    ("Razval-shoxlash", "Xodovoy", 120_000, 45, None, None),
    ("Balansirovka (4 g'ildirak)", "Shinomontaj", 80_000, 30, None, None),
    ("Shinomontaj (4 g'ildirak)", "Shinomontaj", 100_000, 40, None, None),
    ("Konditsioner freon to'ldirish", "Konditsioner", 150_000, 60, 12, None),
    ("Akkumulyator almashtirish", "Elektrika", 30_000, 20, None, None),
]

# (kod, nomi, brend, birlik, qoldiq, min, kirim narxi, sotuv narxi)
PARTS = [
    ("MOY-5W30-4", "Motor moyi 5W-30, 4 L", "Mobil", "dona", 20, 5, 280_000, 340_000),
    ("MOY-5W40-1", "Motor moyi 5W-40, 1 L", "Shell", "litr", 40, 10, 75_000, 95_000),
    ("FLT-OIL-GM", "Moy filtri (Cobalt/Gentra)", "GM", "dona", 30, 10, 35_000, 50_000),
    ("FLT-AIR-GM", "Havo filtri (Cobalt/Gentra)", "GM", "dona", 15, 5, 45_000, 65_000),
    ("FLT-CAB-GM", "Salon filtri (Cobalt/Gentra)", "GM", "dona", 12, 5, 40_000, 60_000),
    ("BRK-PAD-F", "Tormoz kolodkasi (old)", "Brembo", "komplekt", 8, 3, 180_000, 250_000),
    ("SPK-NGK", "Sham NGK", "NGK", "dona", 24, 8, 35_000, 50_000),
    ("ANTIFRIZ-5", "Antifriz G12, 5 L", "Felix", "dona", 6, 3, 120_000, 160_000),
    ("ATF-1", "Uzatmalar qutisi moyi ATF, 1 L", "Dexron", "litr", 4, 6, 90_000, 120_000),
]


def ensure_admin(db, password: str) -> User:
    admin = db.scalar(select(User).where(User.role == Role.admin))
    if admin:
        print(f"Admin allaqachon mavjud: {admin.username}")
        return admin
    admin = User(full_name="Administrator", username="admin", role=Role.admin, password_hash=hash_password(password))
    db.add(admin)
    db.flush()
    print(f"Admin yaratildi: login=admin, parol={password}  (kirgandan keyin parolni almashtiring!)")
    return admin


def ensure_services(db) -> None:
    if db.scalar(select(func.count(Service.id))):
        return
    for name, cat, price, minutes, months, km in SERVICES:
        db.add(Service(name=name, category=cat, price=price, duration_minutes=minutes, reminder_months=months, reminder_km=km))
    print(f"Xizmatlar katalogi: {len(SERVICES)} ta")


def demo(db, admin: User) -> None:
    if db.scalar(select(func.count(Customer.id))):
        print("Demo ma'lumotlar allaqachon bor — o'tkazib yuborildi")
        return
    random.seed(42)
    mechanics = [
        User(full_name="Rustam Karimov", username="rustam", role=Role.mechanic, commission_percent=40, password_hash=hash_password("usta123")),
        User(full_name="Jasur Toshmatov", username="jasur", role=Role.mechanic, commission_percent=35, password_hash=hash_password("usta123")),
    ]
    manager = User(full_name="Dilnoza Aliyeva", username="dilnoza", role=Role.manager, password_hash=hash_password("admin123"))
    db.add_all([*mechanics, manager])

    for code, name, brand, unit, qty, min_q, buy, sell in PARTS:
        part = Part(code=code, name=name, brand=brand, unit=unit, quantity=qty, min_quantity=min_q, purchase_price=buy, sale_price=sell)
        db.add(part)
        db.flush()
        db.add(StockMovement(part_id=part.id, kind=MovementKind.incoming, quantity=qty, unit_price=buy, supplier="Demo", user_id=admin.id))

    people = [
        ("Akmal Rahimov", "901234567", "01A123BC", "Chevrolet", "Cobalt", 2019),
        ("Shaxzod Yusupov", "937654321", "01B777AA", "Chevrolet", "Gentra", 2021),
        ("Malika Saidova", "998877665", "10C555DD", "Chevrolet", "Malibu", 2020),
        ("Bekzod Ergashev", "946543210", "01D321EF", "Kia", "K5", 2022),
        ("Nodira Qodirova", "933332211", "30E808GH", "Chevrolet", "Spark", 2018),
        ("Sardor Mirzayev", "977776655", "01F909KL", "Chevrolet", "Nexia 3", 2017),
    ]
    vehicles = []
    for name, phone, plate, brand, model, year in people:
        c = Customer(full_name=name, phone="998" + phone)
        db.add(c)
        db.flush()
        v = Vehicle(customer_id=c.id, plate_number=plate, brand=brand, model=model, year=year, mileage=random.randint(30, 150) * 1000)
        db.add(v)
        vehicles.append(v)
    db.flush()

    services = db.scalars(select(Service)).all()
    parts = db.scalars(select(Part)).all()
    oil = next(s for s in services if s.name.startswith("Motor moyini"))
    current = now()
    for i in range(14):
        v = random.choice(vehicles)
        mech = random.choice(mechanics)
        created = current - timedelta(days=random.randint(0, 25), hours=random.randint(0, 6))
        order = Order(customer_id=v.customer_id, vehicle_id=v.id, mechanic_id=mech.id, mileage=(v.mileage or 0) + 500, created_by_id=admin.id, created_at=created)
        db.add(order)
        db.flush()
        order_svc.add_service(db, order, OrderServiceIn(service_id=oil.id, mechanic_id=mech.id))
        for s in random.sample(services, random.randint(0, 2)):
            order_svc.add_service(db, order, OrderServiceIn(service_id=s.id, mechanic_id=mech.id))
        for p in random.sample(parts[:5], random.randint(1, 2)):
            order_svc.add_part(db, order, OrderPartIn(part_id=p.id, quantity=Decimal(1)), admin)
        order_svc.recalc(order)
        if i < 10:  # yopilgan, to'langan
            order_svc.change_status(db, order, OrderStatus.closed, admin, notify=False)
            order.closed_at = created + timedelta(hours=3)
            amount = order.total if i < 8 else order.total / 2  # 2 tasida qarz qoladi
            order.payments.append(Payment(amount=amount, method=random.choice(list(PaymentMethod)[:3]), user_id=admin.id, created_at=order.closed_at))
            order_svc.recalc(order)
        elif i < 12:
            order.status = OrderStatus.in_progress
    for cat, amount, days in [("Ijara", 5_000_000, 20), ("Kommunal", 800_000, 10), ("Xo'jalik", 250_000, 3)]:
        db.add(Expense(category=cat, amount=amount, spent_on=(current - timedelta(days=days)).date(), user_id=admin.id))
    print("Demo: 3 xodim (rustam/jasur: usta123, dilnoza: admin123), 6 mijoz, 9 ehtiyot qism, 14 buyurtma")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--admin-password", default="admin123")
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        admin = ensure_admin(db, args.admin_password)
        ensure_services(db)
        db.flush()
        if args.demo:
            demo(db, admin)
        db.commit()


if __name__ == "__main__":
    main()
