from datetime import timedelta

from app.db import SessionLocal
from app.models import SmsMessage, SmsStatus
from app.services import reminders, settings_store
from app.utils import now


def make_customer_with_car(c, phone="+998 (90) 123-45-67", plate="01 a 123 bc"):
    r = c.post("/api/customers", json={"full_name": "Akmal Rahimov", "phone": phone})
    assert r.status_code == 201, r.text
    customer = r.json()
    r = c.post("/api/vehicles", json={"customer_id": customer["id"], "plate_number": plate, "brand": "Chevrolet",
                                      "model": "Cobalt", "mileage": 50000})
    assert r.status_code == 201, r.text
    return customer, r.json()


def test_auth(anon, admin):
    assert anon.post("/api/auth/login", data={"username": "admin", "password": "xato"}).status_code == 401
    assert anon.get("/api/customers").status_code == 401
    assert admin.get("/api/auth/me").json()["role"] == "admin"


def test_customer_vehicle_normalization_and_search(admin):
    customer, vehicle = make_customer_with_car(admin)
    assert customer["phone"] == "998901234567"
    assert vehicle["plate_number"] == "01A123BC"
    # takroriy telefon / raqam
    assert admin.post("/api/customers", json={"full_name": "Boshqa", "phone": "901234567"}).status_code == 409
    assert admin.post("/api/vehicles", json={"customer_id": customer["id"], "plate_number": "01A123BC"}).status_code == 409
    # davlat raqami bo'yicha qidiruv
    found = admin.get("/api/customers", params={"q": "01a123"}).json()
    assert found["total"] == 1 and found["items"][0]["vehicles"][0]["plate_number"] == "01A123BC"
    # bo'sh ixtiyoriy maydonlar
    r = admin.patch(f"/api/customers/{customer['id']}", json={"phone2": "", "notes": ""})
    assert r.status_code == 200 and r.json()["phone2"] is None


def test_full_order_flow(admin):
    customer, vehicle = make_customer_with_car(admin)
    r = admin.post("/api/orders", json={
        "customer_id": customer["id"], "vehicle_id": vehicle["id"], "mechanic_id": 2, "mileage": 52000,
        "services": [{"service_id": 1}, {"name": "Yuvish", "price": 30000}],
        "parts": [{"part_id": 1, "quantity": 1}],
    })
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["services_total"] == 80000
    assert order["parts_total"] == 340000
    assert order["total"] == 420000 and order["debt"] == 420000
    assert admin.get("/api/parts/1").json()["quantity"] == 9  # ombordan chiqdi

    # chegirma
    order = admin.patch(f"/api/orders/{order['id']}", json={"discount": 20000}).json()
    assert order["total"] == 400000

    # ortiqcha to'lov rad etiladi, keyin qisman + to'liq
    assert admin.post(f"/api/orders/{order['id']}/payments", json={"amount": 500000}).status_code == 400
    admin.post(f"/api/orders/{order['id']}/payments", json={"amount": 100000, "method": "card"})
    order = admin.post(f"/api/orders/{order['id']}/payments", json={"amount": 300000}).json()
    assert order["paid"] == 400000 and order["debt"] == 0

    # tayyor -> SMS
    order = admin.post(f"/api/orders/{order['id']}/status", json={"status": "ready"}).json()
    assert order["status"] == "ready"
    with SessionLocal() as db:
        sms = db.query(SmsMessage).filter_by(kind="order_ready").one()
        assert sms.status == SmsStatus.sent and "01A123BC" in sms.text

    # yopish -> eslatma (6 oy / +8000 km), probeg yangilanadi
    order = admin.post(f"/api/orders/{order['id']}/status", json={"status": "closed"}).json()
    assert order["status"] == "closed"
    assert len(order["reminders"]) == 1
    rem = order["reminders"][0]
    assert rem["due_mileage"] == 60000
    assert rem["due_date"] == reminders.add_months(now().date(), 6).isoformat()
    assert admin.get(f"/api/vehicles/{vehicle['id']}").json()["mileage"] == 52000

    # yopilgan buyurtmani o'zgartirib bo'lmaydi
    assert admin.post(f"/api/orders/{order['id']}/services", json={"service_id": 2}).status_code == 400

    # hisobot
    s = admin.get("/api/reports/summary").json()
    assert s["orders_closed"] == 1
    assert s["revenue"] == 400000
    assert s["parts_cost"] == 280000
    assert s["cash_in"] == 400000
    assert s["mechanic_commissions"] == 32000  # 80 000 * 40%
    mech = admin.get("/api/reports/mechanics").json()
    assert mech[0]["name"] == "Usta Ali" and mech[0]["revenue"] == 80000
    r = admin.get("/api/reports/export")
    assert r.status_code == 200 and r.content[:2] == b"PK"


def test_stock_and_cancel(admin):
    customer, vehicle = make_customer_with_car(admin)
    order = admin.post("/api/orders", json={"customer_id": customer["id"], "vehicle_id": vehicle["id"]}).json()
    r = admin.post(f"/api/orders/{order['id']}/parts", json={"part_id": 2, "quantity": 5})
    assert r.status_code == 400 and "yetarli emas" in r.json()["detail"]
    order = admin.post(f"/api/orders/{order['id']}/parts", json={"part_id": 1, "quantity": 2}).json()
    assert admin.get("/api/parts/1").json()["quantity"] == 8
    # bekor qilish -> ehtiyot qismlar omborga qaytadi
    order = admin.post(f"/api/orders/{order['id']}/status", json={"status": "cancelled"}).json()
    assert order["status"] == "cancelled" and order["parts"] == []
    assert admin.get("/api/parts/1").json()["quantity"] == 10
    kinds = [m["kind"] for m in admin.get("/api/stock-movements", params={"part_id": 1}).json()["items"]]
    assert kinds == ["return", "order"]
    # kirim va inventarizatsiya
    p = admin.post("/api/parts/2/stock-in", json={"quantity": 10, "unit_price": 36000, "supplier": "Avtozapchast"}).json()
    assert p["quantity"] == 11 and p["purchase_price"] == 36000 and p["is_low"] is False
    p = admin.post("/api/parts/2/adjust", json={"quantity": 9}).json()
    assert p["quantity"] == 9


def test_mechanic_permissions(admin, mechanic):
    customer, vehicle = make_customer_with_car(admin)
    order = admin.post("/api/orders", json={"customer_id": customer["id"], "vehicle_id": vehicle["id"]}).json()
    assert mechanic.post("/api/customers", json={"full_name": "X Y", "phone": "901112233"}).status_code == 403
    assert mechanic.get("/api/reports/summary").status_code == 403
    assert mechanic.patch(f"/api/orders/{order['id']}", json={"diagnosis": "Moy oqyapti"}).status_code == 200
    assert mechanic.patch(f"/api/orders/{order['id']}", json={"discount": 1000}).status_code == 403
    assert mechanic.post(f"/api/orders/{order['id']}/status", json={"status": "in_progress"}).status_code == 200
    assert mechanic.post(f"/api/orders/{order['id']}/status", json={"status": "closed"}).status_code == 403


def test_online_booking_and_convert(admin, anon):
    with SessionLocal() as db:
        settings_store.set_many(db, {"posts_count": "1"})
        db.commit()
    day = now().date() + timedelta(days=1)
    slots = anon.get("/api/public/slots", params={"day": day.isoformat()}).json()
    assert slots and slots[0] == {"time": "09:00", "free": 1}
    payload = {"customer_name": "Malika", "phone": "998877665", "plate_number": "10c555dd",
               "car_info": "Chevrolet Malibu", "service_id": 1, "scheduled_at": f"{day}T09:00:00"}
    r = anon.post("/api/public/appointments", json=payload)
    assert r.status_code == 201, r.text
    # slot to'ldi
    assert anon.post("/api/public/appointments", json=payload).status_code == 400
    # admin tasdiqlaydi -> SMS
    appt = admin.get("/api/appointments", params={"day": day.isoformat()}).json()[0]
    assert appt["source"] == "online" and appt["status"] == "new"
    admin.patch(f"/api/appointments/{appt['id']}", json={"status": "confirmed"})
    with SessionLocal() as db:
        assert db.query(SmsMessage).filter_by(kind="appointment").count() == 1
    # mijoz keldi -> buyurtma (mijoz va mashina avtomatik yaratiladi)
    order_id = admin.post(f"/api/appointments/{appt['id']}/to-order").json()["order_id"]
    order = admin.get(f"/api/orders/{order_id}").json()
    assert order["customer"]["phone"] == "998998877665"
    assert order["vehicle"]["plate_number"] == "10C555DD" and order["vehicle"]["brand"] == "Chevrolet"
    assert order["services"][0]["name"] == "Motor moyini almashtirish"


def test_due_reminders_send_sms(admin):
    customer, vehicle = make_customer_with_car(admin)
    order = admin.post("/api/orders", json={"customer_id": customer["id"], "vehicle_id": vehicle["id"],
                                            "services": [{"service_id": 1}]}).json()
    admin.post(f"/api/orders/{order['id']}/status", json={"status": "closed"})
    with SessionLocal() as db:
        assert reminders.queue_due(db) == []  # hali erta
        ids = reminders.queue_due(db, today=now().date() + timedelta(days=200))
        assert len(ids) == 1
        text = db.get(SmsMessage, ids[0]).text
        assert "Motor moyini almashtirish" in text and "01A123BC" in text
    assert admin.get("/api/reminders", params={"status": "sent"}).json()["total"] == 1
