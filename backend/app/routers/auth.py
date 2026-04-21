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

_PRIORITY = ["admin", "manager", "courier", "client"]


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
    suffix = normalized[-9:]

    # Check all role tables
    courier_q = await db.execute(select(Courier).where(Courier.phone.contains(suffix)))
    courier = courier_q.scalar_one_or_none()

    mgr_q = await db.execute(select(Manager).where(
        Manager.phone.contains(suffix),
        Manager.is_active == True,
    ))
    manager = mgr_q.scalar_one_or_none()

    # Find user record by phone
    result = await db.execute(select(User).where(User.phone == normalized))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.phone.contains(suffix)))
        user = result.scalar_one_or_none()
    # Fall back to user linked to courier/manager telegram_id
    if not user and courier and courier.telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == courier.telegram_id))
        user = result.scalar_one_or_none()
    if not user and manager and manager.telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == manager.telegram_id))
        user = result.scalar_one_or_none()

    if not courier and not manager and not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден. Обратитесь к администратору.")

    # Collect telegram_id from whichever record we found
    tg_id = (
        (user.telegram_id if user else None)
        or (courier.telegram_id if courier else None)
        or (manager.telegram_id if manager else None)
    )

    # Build all roles for this phone number
    all_roles: list[str] = []
    if tg_id and tg_id in settings.ADMIN_IDS:
        all_roles.append("admin")
    if manager:
        all_roles.append("manager")
    if courier:
        all_roles.append("courier")
    if user:
        all_roles.append("client")
    if not all_roles:
        all_roles = ["client"]

    primary_role = next((r for r in _PRIORITY if r in all_roles), "client")

    name = (
        (user.name if user else None)
        or (manager.name if manager else None)
        or (courier.name if courier else None)
        or ""
    )
    phone = (
        (user.phone if user else None)
        or (courier.phone if courier else None)
        or (manager.phone if manager else None)
        or ""
    )
    uid = (
        (user.id if user else None)
        or (courier.id if courier else None)
        or (manager.id if manager else None)
    )
    balance = float(user.balance) if user else 0.0
    bonus = float(user.bonus_points) if user else 0.0
    is_reg = user.is_registered if user else True

    return {
        "id": uid,
        "telegram_id": tg_id,
        "name": name,
        "phone": phone,
        "role": primary_role,
        "roles": all_roles,
        "balance": balance,
        "bonus_points": bonus,
        "is_registered": is_reg,
    }
