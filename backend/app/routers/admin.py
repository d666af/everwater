from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.courier import Courier
from app.schemas.order import CourierCreate, CourierOut

router = APIRouter(prefix="/admin", tags=["admin"])


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(period: str = "month", db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(weeks=1)
    else:
        since = now - timedelta(days=30)

    delivered_q = await db.execute(
        select(Order).where(
            and_(Order.status == OrderStatus.DELIVERED, Order.created_at >= since)
        )
    )
    orders = delivered_q.scalars().all()

    revenue = sum(o.total for o in orders)
    avg_check = revenue / len(orders) if orders else 0
    bottles_returned = sum(o.return_bottles_count for o in orders)

    cancelled_q = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.status == OrderStatus.REJECTED, Order.created_at >= since)
        )
    )
    cancelled = cancelled_q.scalar()

    repeat_q = await db.execute(
        select(Order.user_id, func.count(Order.id).label("cnt"))
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(Order.user_id)
        .having(func.count(Order.id) > 1)
    )
    repeat_customers = len(repeat_q.fetchall())

    # By status breakdown (all statuses in period, not just delivered)
    by_status_q = await db.execute(
        select(Order.status, func.count(Order.id).label("cnt"))
        .where(Order.created_at >= since)
        .group_by(Order.status)
    )
    by_status = {str(row[0]).replace("OrderStatus.", "").lower(): row[1]
                 for row in by_status_q.fetchall()}

    # Normalize status keys (enum values may include prefix)
    status_map = {}
    for k, v in by_status.items():
        clean = k.split(".")[-1] if "." in k else k
        status_map[clean] = v

    return {
        "period": period,
        "order_count": len(orders),
        "revenue": round(revenue, 2),
        "avg_check": round(avg_check, 2),
        "bottles_returned": bottles_returned,
        "cancelled": cancelled,
        "repeat_customers": repeat_customers,
        "by_status": status_map,
    }


# ─── Couriers ─────────────────────────────────────────────────────────────────

@router.get("/couriers", response_model=list[CourierOut])
async def get_couriers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier))
    return result.scalars().all()


@router.post("/couriers", response_model=CourierOut)
async def create_courier(data: CourierCreate, db: AsyncSession = Depends(get_db)):
    courier = Courier(**data.model_dump())
    db.add(courier)
    await db.commit()
    await db.refresh(courier)
    return courier


@router.delete("/couriers/{courier_id}")
async def deactivate_courier(courier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if courier:
        courier.is_active = False
        await db.commit()
    return {"ok": True}


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "phone": u.phone,
            "is_registered": u.is_registered,
            "balance": u.balance,
            "bonus_points": u.bonus_points,
            "created_at": u.created_at,
        }
        for u in users
    ]


class TopupData(BaseModel):
    amount: float


@router.post("/users/{user_id}/topup")
async def topup_user_balance(user_id: int, data: TopupData, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.balance = (user.balance or 0) + data.amount
    await db.commit()
    return {"ok": True, "new_balance": user.balance}


# ─── Managers (in-memory; real impl needs Manager model) ─────────────────────

_managers: list[dict] = []
_mgr_id_counter = 1


class ManagerCreate(BaseModel):
    name: str
    phone: str = ""
    telegram_id: int


@router.get("/managers")
async def get_managers():
    return _managers


@router.post("/managers")
async def create_manager(data: ManagerCreate):
    global _mgr_id_counter, _managers
    mgr = {"id": _mgr_id_counter, "name": data.name, "phone": data.phone,
           "telegram_id": data.telegram_id, "is_active": True,
           "created_at": datetime.utcnow().isoformat()}
    _managers.append(mgr)
    _mgr_id_counter += 1
    return mgr


@router.delete("/managers/{manager_id}")
async def deactivate_manager(manager_id: int):
    global _managers
    _managers = [
        {**m, "is_active": False} if m["id"] == manager_id else m
        for m in _managers
    ]
    return {"ok": True}


# ─── Settings (DB-backed key-value) ──────────────────────────────────────────

@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    from app.services.settings_service import get_all_settings
    return await get_all_settings(db)


@router.patch("/settings")
async def update_settings_route(data: dict, db: AsyncSession = Depends(get_db)):
    from app.services.settings_service import update_settings
    result = await update_settings(db, data)
    return {"ok": True, **result}


# ─── Broadcast / Notify ──────────────────────────────────────────────────────

class BroadcastData(BaseModel):
    message: str
    target: str = "all"  # "all" | "managers" | "couriers"


@router.post("/broadcast")
async def broadcast_message(data: BroadcastData):
    # In production: send via Telegram bot API to target users
    # For now, just add to notifications
    global _notifications, _id_counter
    notif = {
        "id": _id_counter,
        "type": "broadcast",
        "title": f"Рассылка: {data.target}",
        "body": data.message,
        "target": data.target,
        "read": False,
        "time": datetime.utcnow().isoformat(),
    }
    _notifications.append(notif)
    _id_counter += 1
    return {"ok": True, "sent_to": data.target}


# ─── Notifications (in-memory, real impl needs Notification model) ────────────

_notifications: list[dict] = []
_id_counter = 1


@router.get("/notifications")
async def get_notifications():
    return _notifications


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int):
    global _notifications, _id_counter
    _notifications = [
        {**n, "read": True} if n.get("id") == notif_id else n
        for n in _notifications
    ]
    return {"ok": True}


@router.patch("/notifications/read_all")
async def mark_all_read():
    global _notifications
    _notifications = [{**n, "read": True} for n in _notifications]
    return {"ok": True}


# ─── Support Chats (in-memory stub; real impl needs Chat/Message models) ──────

_chats: list[dict] = []


@router.get("/support/chats")
async def get_support_chats():
    return _chats


@router.get("/support/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: int):
    chat = next((c for c in _chats if c["id"] == chat_id), None)
    if not chat:
        return []
    return chat.get("messages", [])


class MessageData(BaseModel):
    text: str


@router.post("/support/chats/{chat_id}/messages")
async def send_message(chat_id: int, data: MessageData):
    global _chats
    msg = {"id": int(datetime.utcnow().timestamp() * 1000), "from": "support",
           "text": data.text, "time": datetime.utcnow().isoformat()}
    _chats = [
        {**c, "messages": c.get("messages", []) + [msg],
         "last_message": data.text, "last_time": datetime.utcnow().isoformat(), "unread": 0}
        if c["id"] == chat_id else c
        for c in _chats
    ]
    return msg


@router.patch("/support/chats/{chat_id}/read")
async def mark_chat_read(chat_id: int):
    global _chats
    _chats = [
        {**c, "unread": 0} if c["id"] == chat_id else c
        for c in _chats
    ]
    return {"ok": True}
