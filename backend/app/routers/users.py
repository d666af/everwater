import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.courier import Courier
from app.models.manager import Manager
from app.models.agent import Agent
from app.models.warehouse import WarehouseStaff
from app.models.order import Order, OrderStatus
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.config import settings as cfg
from app.services.phone import phone_digits_col

router = APIRouter(prefix="/users", tags=["users"])

_ROLE_PRIORITY = ["admin", "warehouse", "manager", "courier", "agent", "client"]
_STAFF_ROLES = {"warehouse", "manager", "courier", "agent"}


def _build_full_user(telegram_id: int, user, courier, manager, is_warehouse: bool = False, agent=None) -> dict:
    """Return user dict with role/roles — same shape as /auth/login response."""
    all_roles: list[str] = []
    if telegram_id and telegram_id in cfg.ADMIN_IDS:
        all_roles.append("admin")
    if is_warehouse:
        all_roles.append("warehouse")
    if manager:
        all_roles.append("manager")
    if courier:
        all_roles.append("courier")
    if agent:
        all_roles.append("agent")
    if user:
        all_roles.append("client")
    if not all_roles:
        all_roles = ["client"]
    # Staff roles don't grant client access; only admins can also be clients
    if any(r in _STAFF_ROLES for r in all_roles) and "admin" not in all_roles:
        all_roles = [r for r in all_roles if r != "client"]
    primary = next((r for r in _ROLE_PRIORITY if r in all_roles), "client")
    return {
        "id": (user.id if user else None) or (courier.id if courier else None) or (manager.id if manager else None) or (agent.id if agent else None),
        "telegram_id": telegram_id,
        "name": (user.name if user else None) or (manager.name if manager else None) or (courier.name if courier else None) or (agent.name if agent else None) or "",
        "phone": (user.phone if user else None) or (courier.phone if courier else None) or (manager.phone if manager else None) or (agent.phone if agent else None) or "",
        "role": primary,
        "roles": all_roles,
        "bonus_points": float(user.bonus_points) if user else 0.0,
        "is_registered": True if any(r in _STAFF_ROLES for r in all_roles) else (user.is_registered if user else True),
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
            # Fuzzy: strip non-digits from stored phone, match last 9 digits
            digits = ''.join(c for c in phone if c.isdigit())
            if len(digits) >= 9:
                result = await db.execute(
                    select(User)
                    .where(phone_digits_col(User.phone).contains(digits[-9:]))
                    .order_by(User.is_registered.desc())
                    .limit(1)
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
    agent = (await db.execute(select(Agent).where(Agent.telegram_id == telegram_id, Agent.is_active == True))).scalar_one_or_none()
    is_warehouse = telegram_id in cfg.WAREHOUSE_IDS or (await db.execute(
        select(WarehouseStaff).where(WarehouseStaff.telegram_id == telegram_id, WarehouseStaff.is_active == True)
    )).scalar_one_or_none() is not None
    if not user and not courier and not manager and not agent and not is_warehouse:
        raise HTTPException(status_code=404, detail="User not found")
    result = _build_full_user(telegram_id, user, courier, manager, is_warehouse=is_warehouse, agent=agent)
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
    # Block staff members from getting a client User record
    if data.telegram_id:
        is_courier = (await db.execute(select(Courier).where(Courier.telegram_id == data.telegram_id))).scalar_one_or_none()
        is_manager = (await db.execute(select(Manager).where(Manager.telegram_id == data.telegram_id, Manager.is_active == True))).scalar_one_or_none()
        is_agent = (await db.execute(select(Agent).where(Agent.telegram_id == data.telegram_id, Agent.is_active == True))).scalar_one_or_none()
        is_wh = data.telegram_id in cfg.WAREHOUSE_IDS or (await db.execute(
            select(WarehouseStaff).where(WarehouseStaff.telegram_id == data.telegram_id, WarehouseStaff.is_active == True)
        )).scalar_one_or_none() is not None
        if (is_courier or is_manager or is_agent or is_wh) and data.telegram_id not in cfg.ADMIN_IDS:
            raise HTTPException(status_code=403, detail="Staff members cannot register as clients")
    result = await db.execute(select(User).where(User.telegram_id == data.telegram_id))
    user = result.scalar_one_or_none()
    if user:
        return user
    # Merge with placeholder (telegram_id=None, matched by phone from staff-created orders)
    if data.phone:
        digits = ''.join(c for c in str(data.phone) if c.isdigit())
        if len(digits) >= 9:
            ph_q = await db.execute(
                select(User).where(
                    User.telegram_id.is_(None),
                    phone_digits_col(User.phone).contains(digits[-9:]),
                )
            )
            placeholder = ph_q.scalars().first()
            if placeholder:
                placeholder.telegram_id = data.telegram_id
                placeholder.name = placeholder.name or data.name or ""
                placeholder.phone = data.phone or placeholder.phone
                await db.commit()
                await db.refresh(placeholder)
                return placeholder
    user = User(**data.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{telegram_id}", response_model=UserOut)
async def update_user(telegram_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    # Block staff from completing client registration
    is_staff_courier = (await db.execute(select(Courier).where(Courier.telegram_id == telegram_id))).scalar_one_or_none()
    is_staff_manager = (await db.execute(select(Manager).where(Manager.telegram_id == telegram_id, Manager.is_active == True))).scalar_one_or_none()
    is_staff_agent = (await db.execute(select(Agent).where(Agent.telegram_id == telegram_id, Agent.is_active == True))).scalar_one_or_none()
    is_staff_wh = telegram_id in cfg.WAREHOUSE_IDS or (await db.execute(
        select(WarehouseStaff).where(WarehouseStaff.telegram_id == telegram_id, WarehouseStaff.is_active == True)
    )).scalar_one_or_none() is not None
    if (is_staff_courier or is_staff_manager or is_staff_agent or is_staff_wh) and telegram_id not in cfg.ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Staff members cannot complete client registration")
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
    # Link past orders and merge placeholder on registration
    if user.phone and user.is_registered:
        from app.models.order import Order
        from sqlalchemy import update as sa_update, delete as sa_delete
        digits = ''.join(c for c in user.phone if c.isdigit())
        if len(digits) >= 9:
            # Transfer orders with no user_id (phone-only records)
            await db.execute(
                sa_update(Order)
                .where(Order.user_id.is_(None))
                .where(phone_digits_col(Order.recipient_phone).contains(digits[-9:]))
                .values(user_id=user.id)
            )
            # Merge unregistered placeholder that was auto-created by staff
            ph_q = await db.execute(
                select(User).where(
                    User.id != user.id,
                    User.telegram_id.is_(None),
                    phone_digits_col(User.phone).contains(digits[-9:]),
                    User.is_registered == False,
                )
            )
            for placeholder in ph_q.scalars().all():
                # Re-assign placeholder's orders to the real user
                await db.execute(
                    sa_update(Order)
                    .where(Order.user_id == placeholder.id)
                    .values(user_id=user.id)
                )
                await db.delete(placeholder)
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
