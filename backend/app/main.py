import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import appointments, catalog, customers, misc, orders, reports, users
from app.services.reminders import reminder_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(reminder_loop()) if settings.reminders_autorun else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for r in (
    users.auth_router,
    users.router,
    customers.router,
    catalog.router,
    orders.router,
    appointments.router,
    appointments.public_router,
    reports.router,
    misc.router,
):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
