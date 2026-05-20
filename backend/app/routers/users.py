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
        "bonus_points": float(user.bonus_points) if user else 0.0,
        "is_registered": user.is_registered if user else True,
        "saved_addresses": json.loads(user.saved_addresses) if user and user.saved_addresses else [],
        "created_at": user.created_at.isoformat() if user and user.created_at else None,
    }


@router.get("/lookup")
async def lookup_user(phone: str | None = None, telegram_id: int | None = None, db: AsyncSession = Depends(get_db)):
    user = None
    if phone:
        # Exact match first
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        if not user:
            # Fuzzy: match last 9 digits (handles +998/8/0 prefix differences)
            digits = ''.join(c for c in phone if c.isdigit())
            if len(digits) >= 9:
                result = await db.execute(
                    select(User).where(User.phone.contains(digits[-9:])).limit(1)
                )
                user = result.scalars().first()
    elif telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Provide phone or telegram_id")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enrich with bottle debt and order stats
    import json as _json
    from app.models.client_data import BottleDebt
    from sqlalchemy import func as sqlfunc
    from app.models.order import Order, OrderStatus

    debt_row = (await db.execute(select(BottleDebt).where(BottleDebt.user_id == user.id))).scalar_one_or_none()
    bottles_owed = debt_row.count if debt_row else 0

    pending_return = int((await db.execute(
        select(sqlfunc.sum(Order.return_bottles_count)).where(
            Order.user_id == user.id,
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.IN_DELIVERY]),
            Order.return_bottles_count > 0,
        )
    )).scalar() or 0)

    order_count = (await db.execute(
        select(sqlfunc.count(Order.id)).where(
            Order.user_id == user.id, Order.status == OrderStatus.DELIVERED
        )
    )).scalar() or 0

    addresses = _json.loads(user.saved_addresses) if user.saved_addresses else []

    # All unique past order addresses
    past_orders_q = await db.execute(
        select(Order.address, Order.extra_info, Order.latitude, Order.longitude)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    seen_addr: set[str] = set()
    order_addresses = []
    for row in past_orders_q.all():
        key = (row[0] or '').strip()
        if key and key not in seen_addr:
            seen_addr.add(key)
            order_addresses.append({
                "address": row[0] or '',
                "extra_info": row[1] or '',
                "lat": float(row[2]) if row[2] else None,
                "lng": float(row[3]) if row[3] else None,
            })

    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "name": user.name or "",
        "phone": user.phone or "",
        "bonus_points": float(user.bonus_points or 0),
        "is_registered": user.is_registered,
        "order_count": order_count,
        "bottles_owed": bottles_owed,
        "pending_return": pending_return,
        "available_bottles": max(0, bottles_owed - pending_return),
        "addresses": [
            {"id": i, "address": a.get("address", ""), "label": a.get("label", "")}
            for i, a in enumerate(addresses)
        ],
        "saved_addresses": user.saved_addresses,
        "order_addresses": order_addresses,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/by_telegram/{telegram_id}")
async def get_user_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    courier = (await db.execute(select(Courier).where(Courier.telegram_id == telegram_id))).scalar_one_or_none()
    manager = (await db.execute(select(Manager).where(Manager.telegram_id == telegram_id, Manager.is_active == True))).scalar_one_or_none()
    if not user and not courier and not manager:
        raise HTTPException(status_code=404, detail="User not found")
    # Courier/manager without a users-table record can't place orders — auto-create one.
    if not user and (courier or manager):
        entity = courier or manager
        user = User(
            telegram_id=telegram_id,
            name=entity.name or "",
            phone=entity.phone or None,
            is_registered=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
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
    # Link past orders created for this phone but without a registered user_id
    if user.phone and user.is_registered:
        from app.models.order import Order
        from sqlalchemy import update as sa_update
        digits = ''.join(c for c in user.phone if c.isdigit())
        if len(digits) >= 9:
            await db.execute(
                sa_update(Order)
                .where(Order.user_id.is_(None))
                .where(Order.recipient_phone.contains(digits[-9:]))
                .values(user_id=user.id)
            )
            await db.commit()
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
