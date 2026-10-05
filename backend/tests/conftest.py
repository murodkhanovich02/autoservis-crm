import os
import tempfile

_db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_db_file}")
os.environ["REMINDERS_AUTORUN"] = "false"
os.environ["SMS_PROVIDER"] = "console"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Part, Role, Service, User  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all([
            User(full_name="Admin", username="admin", role=Role.admin, password_hash=hash_password("admin123")),
            User(full_name="Usta Ali", username="ali", role=Role.mechanic, commission_percent=40,
                 password_hash=hash_password("usta123")),
            Service(name="Motor moyini almashtirish", category="Moy", price=50000, reminder_months=6, reminder_km=8000),
            Service(name="Diagnostika", category="Diagnostika", price=100000),
            Part(code="OIL4", name="Motor moyi 4L", quantity=10, min_quantity=2, purchase_price=280000, sale_price=340000),
            Part(code="FLT", name="Moy filtri", quantity=1, min_quantity=2, purchase_price=35000, sale_price=50000),
        ])
        db.commit()
    yield


def _client(username: str, password: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/api/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return c


@pytest.fixture
def admin():
    return _client("admin", "admin123")


@pytest.fixture
def mechanic():
    return _client("ali", "usta123")


@pytest.fixture
def anon():
    return TestClient(app)
