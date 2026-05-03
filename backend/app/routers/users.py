import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.courier import Courier
from app.models.manager import Manager
from app.models.order import Order, OrderStatus
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.config import settings as cfg

router = APIRouter(prefix="/users", tags=["users"])

_ROLE_PRIORITY = ["admin", "manager", "courier", "client"]


def _build_full_user(telegram_id: int, user, courier, manager) -> dict:
    """Return user dict with role/roles — same shape as /auth/login response."""
    all_roles: list[str] = []
    if telegram_id in cfg.ADMIN_IDS:
        all_roles.append("admin")
    if manager:
        all_roles.append("manager")
    if courier:
        all_roles.append("courier")
    if user:
        all_roles.append("client")
    if not all_roles:
        all_roles = ["client"]
    primary = next((r for r in _ROLE_PRIORITY if r in all_roles), "client")
    return {
        "id": (user.id if user else None) or (courier.id if courier else None) or (manager.id if manager else None),
        "telegram_id": telegram_id,
        "name": (user.name if user else None) or (manager.name if manager else None) or (courier.name if courier else None) or "",
        "phone": (user.phone if user else None) or (courier.phone if courier else None) or (manager.phone if manager else None) or "",
        "role": primary,
        "roles": all_roles,
        "balance": float(user.balance) if user else 0.0,
        "bonus_points": float(user.bonus_points) if user else 0.0,
        "is_registered": user.is_registered if user else True,
        "saved_addresses": json.loads(user.saved_addresses) if user and user.saved_addresses else [],
    }


@router.get("/lookup", response_model=UserOut)
async def lookup_user(phone: str | None = None, telegram_id: int | None = None, db: AsyncSession = Depends(get_db)):
    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
    elif telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    else:
        raise HTTPException(status_code=400, detail="Provide phone or telegram_id")
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/by_telegram/{telegram_id}")
async def get_user_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    courier = (await db.execute(select(Courier).where(Courier.telegram_id == telegram_id))).scalar_one_or_none()
    manager = (await db.execute(select(Manager).where(Manager.telegram_id == telegram_id, Manager.is_active == True))).scalar_one_or_none()
    if not user and not courier and not manager:
        raise HTTPException(status_code=404, detail="User not found")
    result = _build_full_user(telegram_id, user, courier, manager)
    if user:
        count_row = await db.execute(
            select(func.count(Order.id)).where(Order.user_id == user.id, Order.status == OrderStatus.DELIVERED)
        )
        result["order_count"] = count_row.scalar() or 0
    else:
        result["order_count"] = 0
    return result


@router.post("/", response_model=UserOut)
async def create_or_get_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.telegram_id == data.telegram_id))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(**data.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{telegram_id}", response_model=UserOut)
async def update_user(telegram_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    if user.name and user.phone:
        user.is_registered = True
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/unregistered/remind", response_model=list[UserOut])
async def get_users_to_remind(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.is_registered == False, User.is_blocked == False)
    )
    return result.scalars().all()


class AddressesPayload(BaseModel):
    addresses: list[dict]


@router.get("/{user_id}/addresses")
async def get_user_addresses(user_id: int, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return json.loads(user.saved_addresses) if user.saved_addresses else []


@router.post("/{user_id}/addresses")
async def save_user_addresses(user_id: int, payload: AddressesPayload, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Keep at most 10 addresses
    addresses = payload.addresses[-10:]
    user.saved_addresses = json.dumps(addresses, ensure_ascii=False)
    await db.commit()
    return {"ok": True, "count": len(addresses)}
