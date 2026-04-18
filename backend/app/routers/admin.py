from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.courier import Courier
from app.models.support import SupportChat, SupportMessage
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


# ─── Support Chats (DB-backed) ───────────────────────────────────────────────

def _chat_out(chat: SupportChat) -> dict:
    return {
        "id": chat.id,
        "name": chat.user_name or str(chat.id),
        "last_message": chat.last_message,
        "last_time": chat.last_time.isoformat() if chat.last_time else None,
        "unread": chat.unread_count,
    }


def _msg_out(msg: SupportMessage) -> dict:
    return {
        "id": msg.id,
        "from": "support" if msg.from_admin else "user",
        "text": msg.text,
        "time": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.get("/support/chats")
async def get_support_chats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupportChat).order_by(SupportChat.last_time.desc())
    )
    return [_chat_out(c) for c in result.scalars().all()]


@router.get("/support/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.chat_id == chat_id)
        .order_by(SupportMessage.created_at)
    )
    return [_msg_out(m) for m in result.scalars().all()]


class MessageData(BaseModel):
    text: str


@router.post("/support/chats/{chat_id}/messages")
async def send_admin_message(chat_id: int, data: MessageData, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportChat).where(SupportChat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    now = datetime.utcnow()
    msg = SupportMessage(
        chat_id=chat_id,
        text=data.text,
        from_admin=True,
        delivered=False,
        created_at=now,
    )
    db.add(msg)
    chat.last_message = data.text
    chat.last_time = now
    await db.commit()
    await db.refresh(msg)
    return _msg_out(msg)


@router.patch("/support/chats/{chat_id}/read")
async def mark_chat_read(chat_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportChat).where(SupportChat.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat:
        chat.unread_count = 0
        await db.commit()
    return {"ok": True}


# Endpoint used by bot to post incoming user messages
class UserMessageData(BaseModel):
    telegram_id: int
    user_name: str = ""
    text: str


@router.post("/support/user_message")
async def receive_user_message(data: UserMessageData, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportChat).where(SupportChat.id == data.telegram_id))
    chat = result.scalar_one_or_none()
    now = datetime.utcnow()
    if not chat:
        chat = SupportChat(
            id=data.telegram_id,
            user_name=data.user_name,
            unread_count=0,
            last_message="",
            last_time=now,
        )
        db.add(chat)
        await db.flush()
    chat.unread_count = (chat.unread_count or 0) + 1
    chat.last_message = data.text
    chat.last_time = now
    if data.user_name:
        chat.user_name = data.user_name
    msg = SupportMessage(
        chat_id=data.telegram_id,
        text=data.text,
        from_admin=False,
        delivered=True,
        created_at=now,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return _msg_out(msg)


# Endpoint used by bot scheduler to fetch undelivered admin messages
@router.get("/support/undelivered")
async def get_undelivered_messages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.from_admin == True, SupportMessage.delivered == False)
        .order_by(SupportMessage.created_at)
    )
    return [_msg_out(m) | {"chat_id": m.chat_id} for m in result.scalars().all()]


@router.patch("/support/messages/{msg_id}/delivered")
async def mark_message_delivered(msg_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportMessage).where(SupportMessage.id == msg_id))
    msg = result.scalar_one_or_none()
    if msg:
        msg.delivered = True
        await db.commit()
    return {"ok": True}
