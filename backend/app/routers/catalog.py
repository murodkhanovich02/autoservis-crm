from decimal import Decimal

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, CurrentUser, StaffUser, get_or_404
from app.models import MovementKind, OrderPart, OrderService, Part, Service, StockMovement
from app.schemas.catalog import (
    MovementOut,
    PartIn,
    PartOut,
    PartUpdate,
    ServiceIn,
    ServiceOut,
    ServiceUpdate,
    StockAdjust,
    StockIn,
)
from app.schemas.common import Page

router = APIRouter(tags=["catalog"])


# ---------------- Xizmatlar ----------------


@router.get("/services", response_model=list[ServiceOut])
def list_services(db: DB, _: CurrentUser, q: str | None = None, active: bool | None = None):
    query = select(Service).order_by(Service.category, Service.name)
    if q:
        query = query.where(or_(Service.name.ilike(f"%{q}%"), Service.category.ilike(f"%{q}%")))
    if active is not None:
        query = query.where(Service.is_active == active)
    return db.scalars(query).all()


@router.get("/services/categories", response_model=list[str])
def service_categories(db: DB, _: CurrentUser):
    return db.scalars(select(Service.category).where(Service.category.is_not(None)).distinct().order_by(Service.category)).all()


@router.post("/services", response_model=ServiceOut, status_code=201)
def create_service(data: ServiceIn, db: DB, _: StaffUser):
    service = Service(**data.model_dump())
    db.add(service)
    db.commit()
    return service


@router.patch("/services/{service_id}", response_model=ServiceOut)
def update_service(service_id: int, data: ServiceUpdate, db: DB, _: StaffUser):
    service = get_or_404(db, Service, service_id, "Xizmat")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key in ("name", "price", "duration_minutes", "is_active") and value is None:
            continue
        setattr(service, key, value)
    db.commit()
    return service


@router.delete("/services/{service_id}", status_code=204)
def delete_service(service_id: int, db: DB, _: StaffUser):
    service = get_or_404(db, Service, service_id, "Xizmat")
    if db.scalar(select(OrderService.id).where(OrderService.service_id == service_id).limit(1)):
        service.is_active = False  # tarixda ishlatilgan — faqat o'chirib qo'yamiz
    else:
        db.delete(service)
    db.commit()


# ---------------- Ehtiyot qismlar (ombor) ----------------


def _part_out(part: Part) -> PartOut:
    out = PartOut.model_validate(part)
    out.is_low = part.quantity <= part.min_quantity
    return out


@router.get("/parts", response_model=Page[PartOut])
def list_parts(
    db: DB,
    _: CurrentUser,
    q: str | None = None,
    low_stock: bool = False,
    active: bool | None = True,
    skip: int = 0,
    limit: int = 50,
):
    query = select(Part)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(or_(Part.name.ilike(term), Part.code.ilike(term), Part.brand.ilike(term)))
    if low_stock:
        query = query.where(Part.quantity <= Part.min_quantity)
    if active is not None:
        query = query.where(Part.is_active == active)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(Part.name).offset(skip).limit(min(limit, 200))).all()
    return Page(items=[_part_out(p) for p in items], total=total)


@router.get("/parts/stock-value")
def stock_value(db: DB, _: StaffUser):
    row = db.execute(
        select(
            func.count(Part.id),
            func.coalesce(func.sum(Part.quantity * Part.purchase_price), 0),
            func.coalesce(func.sum(Part.quantity * Part.sale_price), 0),
        ).where(Part.is_active.is_(True))
    ).one()
    return {"items": row[0], "purchase_value": float(row[1]), "sale_value": float(row[2])}


@router.post("/parts", response_model=PartOut, status_code=201)
def create_part(data: PartIn, db: DB, user: StaffUser):
    if data.code and db.scalar(select(Part.id).where(Part.code == data.code)):
        raise HTTPException(409, "Bu kodli ehtiyot qism mavjud")
    values = data.model_dump(exclude={"quantity"})
    part = Part(**values, quantity=data.quantity)
    db.add(part)
    db.flush()
    if data.quantity > 0:
        db.add(StockMovement(
            part_id=part.id, kind=MovementKind.incoming, quantity=data.quantity,
            unit_price=data.purchase_price, user_id=user.id, note="Boshlang'ich qoldiq",
        ))
    db.commit()
    return _part_out(part)


@router.get("/parts/{part_id}", response_model=PartOut)
def get_part(part_id: int, db: DB, _: CurrentUser):
    return _part_out(get_or_404(db, Part, part_id, "Ehtiyot qism"))


@router.patch("/parts/{part_id}", response_model=PartOut)
def update_part(part_id: int, data: PartUpdate, db: DB, _: StaffUser):
    part = get_or_404(db, Part, part_id, "Ehtiyot qism")
    values = data.model_dump(exclude_unset=True)
    if values.get("code") and db.scalar(select(Part.id).where(Part.code == values["code"], Part.id != part_id)):
        raise HTTPException(409, "Bu kodli ehtiyot qism mavjud")
    for key, value in values.items():
        if value is None and key not in ("code", "brand"):
            continue
        setattr(part, key, value)
    db.commit()
    return _part_out(part)


@router.delete("/parts/{part_id}", status_code=204)
def delete_part(part_id: int, db: DB, _: StaffUser):
    part = get_or_404(db, Part, part_id, "Ehtiyot qism")
    used = db.scalar(select(OrderPart.id).where(OrderPart.part_id == part_id).limit(1))
    moved = db.scalar(select(StockMovement.id).where(StockMovement.part_id == part_id).limit(1))
    if used or moved:
        part.is_active = False
    else:
        db.delete(part)
    db.commit()


@router.post("/parts/{part_id}/stock-in", response_model=PartOut)
def stock_in(part_id: int, data: StockIn, db: DB, user: StaffUser):
    """Kirim: yetkazib beruvchidan tovar keldi."""
    part = db.get(Part, part_id, with_for_update=True) or get_or_404(db, Part, part_id, "Ehtiyot qism")
    unit_price = part.purchase_price if data.unit_price is None else data.unit_price
    part.quantity += data.quantity
    if data.update_purchase_price and data.unit_price is not None:
        part.purchase_price = data.unit_price
    db.add(StockMovement(
        part_id=part.id, kind=MovementKind.incoming, quantity=data.quantity,
        unit_price=unit_price, supplier=data.supplier, note=data.note, user_id=user.id,
    ))
    db.commit()
    return _part_out(part)


@router.post("/parts/{part_id}/adjust", response_model=PartOut)
def adjust_stock(part_id: int, data: StockAdjust, db: DB, user: StaffUser):
    """Inventarizatsiya: haqiqiy qoldiqni kiritish."""
    part = db.get(Part, part_id, with_for_update=True) or get_or_404(db, Part, part_id, "Ehtiyot qism")
    diff = Decimal(data.quantity) - part.quantity
    if diff == 0:
        return _part_out(part)
    part.quantity = data.quantity
    db.add(StockMovement(
        part_id=part.id, kind=MovementKind.adjust, quantity=diff,
        unit_price=part.purchase_price, note=data.note or "Inventarizatsiya", user_id=user.id,
    ))
    db.commit()
    return _part_out(part)


@router.get("/stock-movements", response_model=Page[MovementOut])
def list_movements(
    db: DB,
    _: CurrentUser,
    part_id: int | None = None,
    kind: MovementKind | None = None,
    skip: int = 0,
    limit: int = 50,
):
    query = select(StockMovement)
    if part_id:
        query = query.where(StockMovement.part_id == part_id)
    if kind:
        query = query.where(StockMovement.kind == kind)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.options(selectinload(StockMovement.part), selectinload(StockMovement.user))
        .order_by(StockMovement.id.desc())
        .offset(skip)
        .limit(min(limit, 200))
    ).all()
    return Page(items=items, total=total)
