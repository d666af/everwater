"""Authentication: Telegram Mini App initData + phone-based login for web panel."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import upsert_user, verify_init_data
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.courier import Courier
from app.models.manager import Manager
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Phone prefixes reserved for warehouse staff (configurable via env)
WAREHOUSE_PHONES: list[str] = []


class InitDataBody(BaseModel):
    init_data: str | None = None
    telegram_id: int | None = None
    name: str | None = None
    phone: str | None = None


@router.post("/telegram", response_model=UserOut)
async def telegram_auth(body: InitDataBody, db: AsyncSession = Depends(get_db)):
    if body.init_data:
        tg_user = verify_init_data(body.init_data)
        return await upsert_user(db, tg_user)

    if settings.ALLOW_DEV_AUTH and body.telegram_id:
        tg_user = {"id": body.telegram_id}
        if body.name:
            tg_user["first_name"] = body.name
        user = await upsert_user(db, tg_user)
        if body.phone and not user.phone:
            user.phone = body.phone
            await db.commit()
            await db.refresh(user)
        return user

    raise HTTPException(status_code=401, detail="initData required")


class PhoneLoginBody(BaseModel):
    phone: str


@router.post("/login")
async def login_by_phone(body: PhoneLoginBody, db: AsyncSession = Depends(get_db)):
    normalized = body.phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Check couriers first (they have their own Courier table with phone)
    courier_q = await db.execute(select(Courier).where(
        Courier.phone.contains(normalized[-9:])
    ))
    courier = courier_q.scalar_one_or_none()
    if courier:
        # Find or create a matching User record for the courier
        user_q = await db.execute(select(User).where(User.telegram_id == courier.telegram_id))
        user = user_q.scalar_one_or_none()
        return {
            "id": user.id if user else courier.id,
            "telegram_id": courier.telegram_id,
            "name": courier.name,
            "phone": courier.phone,
            "role": "courier",
            "balance": 0.0,
            "bonus_points": 0.0,
            "is_registered": True,
        }

    # Check managers (DB-backed)
    mgr_q = await db.execute(select(Manager).where(
        Manager.phone.contains(normalized[-9:]),
        Manager.is_active == True,
    ))
    manager = mgr_q.scalar_one_or_none()
    if manager:
        user_q = await db.execute(select(User).where(User.telegram_id == manager.telegram_id))
        user = user_q.scalar_one_or_none()
        return {
            "id": user.id if user else manager.id,
            "telegram_id": manager.telegram_id,
            "name": manager.name,
            "phone": manager.phone,
            "role": "manager",
            "balance": 0.0,
            "bonus_points": 0.0,
            "is_registered": True,
        }

    # Regular users
    result = await db.execute(select(User).where(User.phone == normalized))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.phone.contains(normalized[-9:])))
        user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден. Обратитесь к администратору.")

    role = "client"
    if user.telegram_id in settings.ADMIN_IDS:
        role = "admin"

    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "name": user.name,
        "phone": user.phone,
        "role": role,
        "balance": user.balance,
        "bonus_points": user.bonus_points,
        "is_registered": user.is_registered,
    }
