from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.models import Role
from app.schemas.common import ORM, Num, OptPhone

Percent = Annotated[Num, Field(ge=0, le=100)]


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.]+$")
    phone: OptPhone = None
    role: Role = Role.manager
    commission_percent: Percent = Decimal(0)
    is_active: bool = True
    password: str = Field(min_length=6, max_length=100)


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=120)
    phone: OptPhone = None
    role: Role | None = None
    commission_percent: Percent | None = None
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6, max_length=100)


class UserOut(ORM):
    id: int
    full_name: str
    username: str
    phone: str | None
    role: Role
    commission_percent: Num
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=100)
