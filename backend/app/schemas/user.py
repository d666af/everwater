from pydantic import BaseModel
from datetime import datetime


class UserCreate(BaseModel):
    telegram_id: int
    name: str | None = None
    phone: str | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    balance: float | None = None
    bonus_points: float | None = None
    site_password: str | None = None


class UserOut(BaseModel):
    id: int
    telegram_id: int
    name: str | None
    phone: str | None
    is_registered: bool
    balance: float
    bonus_points: float
    created_at: datetime

    model_config = {"from_attributes": True}
