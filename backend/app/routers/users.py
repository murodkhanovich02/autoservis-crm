from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.core.deps import DB, AdminUser, CurrentUser, get_or_404
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Role, User
from app.schemas.users import PasswordChange, TokenOut, UserCreate, UserOut, UserUpdate

auth_router = APIRouter(prefix="/auth", tags=["auth"])
router = APIRouter(prefix="/users", tags=["users"])


@auth_router.post("/login", response_model=TokenOut)
def login(db: DB, form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = db.scalar(select(User).where(User.username == form.username.strip()))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "Login yoki parol noto'g'ri")
    if not user.is_active:
        raise HTTPException(403, "Foydalanuvchi bloklangan")
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@auth_router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@auth_router.post("/change-password", status_code=204)
def change_password(data: PasswordChange, user: CurrentUser, db: DB):
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(400, "Eski parol noto'g'ri")
    user.password_hash = hash_password(data.new_password)
    db.commit()


@router.get("", response_model=list[UserOut])
def list_users(db: DB, _: CurrentUser, role: Role | None = None, active: bool | None = None):
    q = select(User).order_by(User.full_name)
    if role:
        q = q.where(User.role == role)
    if active is not None:
        q = q.where(User.is_active == active)
    return db.scalars(q).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: DB, _: AdminUser):
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(409, "Bunday login mavjud")
    user = User(**data.model_dump(exclude={"password"}), password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: DB, admin: AdminUser):
    user = get_or_404(db, User, user_id, "Foydalanuvchi")
    values = data.model_dump(exclude_unset=True)
    if user.id == admin.id and (values.get("is_active") is False or values.get("role", Role.admin) != Role.admin):
        raise HTTPException(400, "O'zingizni bloklay yoki rolingizni o'zgartira olmaysiz")
    if password := values.pop("password", None):
        user.password_hash = hash_password(password)
    for key, value in values.items():
        setattr(user, key, value)
    db.commit()
    return user
