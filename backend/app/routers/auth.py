"""Authentication: Telegram Mini App initData + phone-based login for web panel."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_init_data
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.courier import Courier
from app.models.manager import Manager

router = APIRouter(prefix="/auth", tags=["auth"])

_PRIORITY = ["admin", "warehouse", "manager", "courier", "client"]


def _build_response(user, courier, manager, tg_id: int = None):
    tid = tg_id or (
        (user.telegram_id if user else None)
        or (courier.telegram_id if courier else None)
        or (manager.telegram_id if manager else None)
    )
    all_roles: list[str] = []
    if tid and tid in settings.ADMIN_IDS:
        all_roles.append("admin")
    if tid and tid in settings.WAREHOUSE_IDS:
        all_roles.append("warehouse")
    if manager:
        all_roles.append("manager")
    if courier:
        all_roles.append("courier")
    if user:
        all_roles.append("client")
    if not all_roles:
        all_roles = ["client"]

    primary_role = next((r for r in _PRIORITY if r in all_roles), "client")
    name = (user.name if user else None) or (manager.name if manager else None) or (courier.name if courier else None) or ""
    phone = (user.phone if user else None) or (courier.phone if courier else None) or (manager.phone if manager else None) or ""
    uid = (user.id if user else None) or (courier.id if courier else None) or (manager.id if manager else None)
    balance = float(user.balance) if user else 0.0
    bonus = float(user.bonus_points) if user else 0.0
    is_reg = user.is_registered if user else True

    return {
        "id": uid,
        "telegram_id": tid,
        "name": name,
        "phone": phone,
        "role": primary_role,
        "roles": all_roles,
        "balance": balance,
        "bonus_points": bonus,
        "is_registered": is_reg,
    }


class InitDataBody(BaseModel):
    init_data: str | None = None
    telegram_id: int | None = None


@router.post("/telegram")
async def telegram_auth(body: InitDataBody, db: AsyncSession = Depends(get_db)):
    """Verify Telegram initData signature and return enriched user profile."""
    if body.init_data:
        tg_user = verify_init_data(body.init_data)
        tg_id = tg_user["id"]
    elif settings.ALLOW_DEV_AUTH and body.telegram_id:
        tg_id = body.telegram_id
    else:
        raise HTTPException(status_code=401, detail="initData required")

    user = (await db.execute(select(User).where(User.telegram_id == tg_id))).scalar_one_or_none()
    courier = (await db.execute(select(Courier).where(Courier.telegram_id == tg_id))).scalar_one_or_none()
    manager = (await db.execute(
        select(Manager).where(Manager.telegram_id == tg_id, Manager.is_active == True)
    )).scalar_one_or_none()

    if not user and not courier and not manager:
        raise HTTPException(status_code=404, detail="User not found")

    # Block access for incomplete registrations (started bot but didn't finish)
    if user and not user.is_registered and not courier and not manager and tg_id not in settings.ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Registration incomplete")

    return _build_response(user, courier, manager, tg_id)


class PhoneLoginBody(BaseModel):
    phone: str
    password: str | None = None


async def _lookup_by_phone(phone: str, db: AsyncSession):
    """Return (user, courier, manager) records matching the phone number."""
    normalized = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    suffix = normalized[-9:]

    courier_q = await db.execute(select(Courier).where(Courier.phone.contains(suffix)))
    courier = courier_q.scalar_one_or_none()

    mgr_q = await db.execute(select(Manager).where(
        Manager.phone.contains(suffix),
        Manager.is_active == True,
    ))
    manager = mgr_q.scalar_one_or_none()

    result = await db.execute(select(User).where(User.phone == normalized))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.phone.contains(suffix)))
        user = result.scalar_one_or_none()
    if not user and courier and courier.telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == courier.telegram_id))
        user = result.scalar_one_or_none()
    if not user and manager and manager.telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == manager.telegram_id))
        user = result.scalar_one_or_none()

    return user, courier, manager


@router.post("/login")
async def login_by_phone(body: PhoneLoginBody, db: AsyncSession = Depends(get_db)):
    user, courier, manager = await _lookup_by_phone(body.phone, db)

    if not courier and not manager and not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден. Обратитесь к администратору.")

    # Password check (only if user has a site_password set)
    if user and user.site_password:
        if body.password is None:
            return {"needs_password": True}
        if body.password != user.site_password:
            raise HTTPException(status_code=401, detail="Неверный пароль")

    return _build_response(user, courier, manager)


@router.get("/roles")
async def get_roles_by_phone(phone: str, db: AsyncSession = Depends(get_db)):
    user, courier, manager = await _lookup_by_phone(phone, db)
    if not user and not courier and not manager:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return _build_response(user, courier, manager)

