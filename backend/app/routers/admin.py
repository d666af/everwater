from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.courier import Courier
from app.models.manager import Manager
from app.models.support import SupportChat, SupportMessage
from app.models.client_data import SavedAddress, Subscription, BottleDebt, TopupRequest
from app.schemas.order import CourierCreate, CourierOut
import aiohttp

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

    by_status_q = await db.execute(
        select(Order.status, func.count(Order.id).label("cnt"))
        .where(Order.created_at >= since)
        .group_by(Order.status)
    )
    by_status = {str(row[0]).replace("OrderStatus.", "").lower(): row[1]
                 for row in by_status_q.fetchall()}

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

@router.get("/couriers/by_telegram/{telegram_id}")
async def get_courier_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.telegram_id == telegram_id, Courier.is_active == True))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    return {"id": courier.id, "telegram_id": courier.telegram_id, "name": courier.name,
            "phone": courier.phone, "is_active": courier.is_active, "total_deliveries": courier.total_deliveries}


@router.get("/managers/by_telegram/{telegram_id}")
async def get_manager_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Manager).where(Manager.telegram_id == telegram_id, Manager.is_active == True))
    mgr = result.scalar_one_or_none()
    if not mgr:
        raise HTTPException(status_code=404, detail="Manager not found")
    return {"id": mgr.id, "telegram_id": mgr.telegram_id, "name": mgr.name,
            "phone": mgr.phone, "is_active": mgr.is_active}


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


@router.get("/users/{user_id}/details")
async def get_user_details(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    addrs_q = await db.execute(
        select(SavedAddress).where(SavedAddress.user_id == user_id).order_by(SavedAddress.created_at.desc())
    )
    addresses = [
        {"id": a.id, "label": a.label, "address": a.address,
         "lat": a.latitude, "lng": a.longitude}
        for a in addrs_q.scalars().all()
    ]

    subs_q = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at.desc())
    )
    subscriptions = [
        {"id": s.id, "plan": s.plan, "water_summary": s.water_summary,
         "qty": s.qty, "address": s.address, "day": s.day,
         "status": s.status, "created_at": s.created_at}
        for s in subs_q.scalars().all()
    ]

    bottles_q = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user_id))
    bottle_row = bottles_q.scalar_one_or_none()
    bottles_owed = bottle_row.count if bottle_row else 0

    orders_q = await db.execute(
        select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc()).limit(20)
    )
    orders = [
        {"id": o.id, "status": o.status, "total": o.total,
         "created_at": o.created_at, "address": o.address}
        for o in orders_q.scalars().all()
    ]

    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "name": user.name,
        "phone": user.phone,
        "balance": user.balance,
        "bonus_points": user.bonus_points,
        "is_registered": user.is_registered,
        "created_at": user.created_at,
        "addresses": addresses,
        "subscriptions": subscriptions,
        "bottles_owed": bottles_owed,
        "recent_orders": orders,
        "coolers": [],
    }


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


class TopupRequestBody(BaseModel):
    amount: float
    telegram_id: int | None = None


@router.post("/users/{user_id}/topup_request")
async def create_topup_request(user_id: int, data: TopupRequestBody, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    user_q = await db.execute(select(User).where(User.id == user_id))
    user = user_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    req = TopupRequest(user_id=user_id, amount=data.amount)
    db.add(req)
    await db.commit()
    await db.refresh(req)

    tg_id = data.telegram_id or user.telegram_id
    client_name = user.name or str(tg_id)
    fmt_amt = f"{int(data.amount):,}".replace(",", " ")

    text = (
        f"💰 Запрос на пополнение баланса!\n"
        f"Клиент: {client_name}\n"
        f"Сумма: {fmt_amt} сум"
    )
    kb = {"inline_keyboard": [[
        {"text": f"✅ Подтвердить {fmt_amt} сум",
         "callback_data": f"admin_topup_confirm:{user_id}:{int(data.amount)}:{tg_id}"},
        {"text": "❌ Отклонить",
         "callback_data": f"admin_topup_reject:{user_id}:{int(data.amount)}:{tg_id}"},
    ]]}

    async def _tg_send_admin(chat_id, msg_text, reply_markup):
        url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(url, json={"chat_id": chat_id, "text": msg_text, "reply_markup": reply_markup},
                             timeout=aiohttp.ClientTimeout(total=5))
        except Exception:
            pass

    for aid in cfg.ADMIN_IDS:
        await _tg_send_admin(aid, text, kb)
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
    for m in mgrs:
        await _tg_send_admin(m.telegram_id, text, kb)

    return {"ok": True, "id": req.id}


@router.get("/topup_requests")
async def list_topup_requests(status: str = "pending", db: AsyncSession = Depends(get_db)):
    q = select(TopupRequest, User).join(User, User.id == TopupRequest.user_id)
    if status != "all":
        q = q.where(TopupRequest.status == status)
    q = q.order_by(TopupRequest.created_at.desc())
    rows = (await db.execute(q)).all()
    result = []
    for req, user in rows:
        result.append({
            "id": req.id,
            "type": "topup",
            "user_id": req.user_id,
            "client_name": user.name or "",
            "amount": req.amount,
            "total": req.amount,
            "status": req.status,
            "payment_confirmed": req.status == "confirmed",
            "payment_method": "card",
            "created_at": req.created_at.isoformat(),
        })
    return result


@router.post("/topup_requests/{req_id}/confirm")
async def confirm_topup_request(req_id: int, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    req_q = await db.execute(select(TopupRequest).where(TopupRequest.id == req_id))
    req = req_q.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Topup request not found")

    user_q = await db.execute(select(User).where(User.id == req.user_id))
    user = user_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.balance = (user.balance or 0) + req.amount
    req.status = "confirmed"
    await db.commit()

    fmt_amt = f"{int(req.amount):,}".replace(",", " ")
    if user.telegram_id:
        url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(url, json={
                    "chat_id": user.telegram_id,
                    "text": f"✅ Ваш баланс пополнен на {fmt_amt} сум!\nТекущий баланс: {int(user.balance):,} сум",
                }, timeout=aiohttp.ClientTimeout(total=5))
        except Exception:
            pass

    return {"ok": True, "new_balance": user.balance}


@router.post("/topup_requests/{req_id}/reject")
async def reject_topup_request(req_id: int, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    req_q = await db.execute(select(TopupRequest).where(TopupRequest.id == req_id))
    req = req_q.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Topup request not found")

    user_q = await db.execute(select(User).where(User.id == req.user_id))
    user = user_q.scalar_one_or_none()

    req.status = "rejected"
    await db.commit()

    fmt_amt = f"{int(req.amount):,}".replace(",", " ")
    if user and user.telegram_id:
        url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(url, json={
                    "chat_id": user.telegram_id,
                    "text": f"❌ Ваш запрос на пополнение {fmt_amt} сум отклонён.",
                }, timeout=aiohttp.ClientTimeout(total=5))
        except Exception:
            pass

    return {"ok": True}


# ─── Subscriptions (admin view) ───────────────────────────────────────────────

@router.get("/subscriptions")
async def list_all_subscriptions(status: str = "all", db: AsyncSession = Depends(get_db)):
    q = select(Subscription, User).join(User, User.id == Subscription.user_id)
    if status == "pending":
        q = q.where(Subscription.payment_confirmed == False)
    elif status != "all":
        q = q.where(Subscription.status == status)
    q = q.order_by(Subscription.created_at.desc())
    rows = (await db.execute(q)).all()
    result = []
    for sub, user in rows:
        result.append({
            "id": sub.id,
            "type": "subscription",
            "user_id": sub.user_id,
            "client_name": user.name or "",
            "water_summary": sub.water_summary,
            "address": sub.address,
            "payment_method": sub.payment_method,
            "payment_confirmed": sub.payment_confirmed,
            "total": sub.total,
            "status": sub.status,
            "plan": sub.plan,
            "created_at": sub.created_at.isoformat(),
        })
    return result


@router.post("/subscriptions/{sub_id}/confirm")
async def confirm_subscription(sub_id: int, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    sub_q = await db.execute(select(Subscription).where(Subscription.id == sub_id))
    sub = sub_q.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.payment_confirmed = True
    sub.status = "active"
    await db.commit()

    user_q = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_q.scalar_one_or_none()
    if user and user.telegram_id:
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(
                    f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage",
                    json={"chat_id": user.telegram_id, "text": f"✅ Ваша подписка #{sub_id} подтверждена и активирована!"},
                    timeout=aiohttp.ClientTimeout(total=5),
                )
        except Exception:
            pass

    return {"ok": True}


@router.post("/subscriptions/{sub_id}/reject")
async def reject_subscription(sub_id: int, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    sub_q = await db.execute(select(Subscription).where(Subscription.id == sub_id))
    sub = sub_q.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "cancelled"
    sub.payment_confirmed = False
    await db.commit()

    user_q = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_q.scalar_one_or_none()
    if user and user.telegram_id:
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(
                    f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage",
                    json={"chat_id": user.telegram_id, "text": f"❌ Ваша подписка #{sub_id} отклонена. Обратитесь в поддержку."},
                    timeout=aiohttp.ClientTimeout(total=5),
                )
        except Exception:
            pass

    return {"ok": True}


# ─── Managers (DB-backed) ─────────────────────────────────────────────────────

class ManagerCreate(BaseModel):
    name: str
    phone: str = ""
    telegram_id: int


@router.get("/managers")
async def get_managers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Manager).order_by(Manager.created_at.desc()))
    mgrs = result.scalars().all()
    return [
        {"id": m.id, "name": m.name, "phone": m.phone,
         "telegram_id": m.telegram_id, "is_active": m.is_active,
         "created_at": m.created_at.isoformat()}
        for m in mgrs
    ]


@router.post("/managers")
async def create_manager(data: ManagerCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Manager).where(Manager.telegram_id == data.telegram_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Manager with this telegram_id already exists")
    mgr = Manager(name=data.name, phone=data.phone or None, telegram_id=data.telegram_id)
    db.add(mgr)
    await db.commit()
    await db.refresh(mgr)
    return {"id": mgr.id, "name": mgr.name, "phone": mgr.phone,
            "telegram_id": mgr.telegram_id, "is_active": mgr.is_active,
            "created_at": mgr.created_at.isoformat()}


@router.delete("/managers/{manager_id}")
async def deactivate_manager(manager_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Manager).where(Manager.id == manager_id))
    mgr = result.scalar_one_or_none()
    if mgr:
        mgr.is_active = False
        await db.commit()
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


# ─── Broadcast (sends real Telegram messages) ─────────────────────────────────

class BroadcastData(BaseModel):
    message: str
    target: str = "all"  # "all" | "managers" | "couriers"


@router.post("/broadcast")
async def broadcast_message(data: BroadcastData, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg

    telegram_ids: list[int] = []

    if data.target in ("all", "clients"):
        users_q = await db.execute(
            select(User.telegram_id).where(User.is_registered == True, User.telegram_id.isnot(None))
        )
        telegram_ids.extend(r[0] for r in users_q.all())

    if data.target in ("all", "couriers"):
        couriers_q = await db.execute(
            select(Courier.telegram_id).where(Courier.is_active == True)
        )
        telegram_ids.extend(r[0] for r in couriers_q.all())

    if data.target in ("all", "managers"):
        mgrs_q = await db.execute(
            select(Manager.telegram_id).where(Manager.is_active == True)
        )
        telegram_ids.extend(r[0] for r in mgrs_q.all())

    telegram_ids = list(set(telegram_ids))
    sent, failed = 0, 0
    tg_url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"

    async with aiohttp.ClientSession() as session:
        for tg_id in telegram_ids:
            try:
                async with session.post(tg_url, json={"chat_id": tg_id, "text": data.message}) as resp:
                    if resp.status == 200:
                        sent += 1
                    else:
                        failed += 1
            except Exception:
                failed += 1

    return {"ok": True, "sent": sent, "failed": failed, "total": len(telegram_ids)}


# ─── Notifications (in-memory cache; events are pushed by order actions) ─────

_notifications: list[dict] = []
_id_counter = 1


def push_notification(title: str, body: str, ntype: str = "info"):
    global _notifications, _id_counter
    _notifications.append({
        "id": _id_counter,
        "type": ntype,
        "title": title,
        "body": body,
        "read": False,
        "time": datetime.utcnow().isoformat(),
    })
    _id_counter += 1
    if len(_notifications) > 200:
        _notifications = _notifications[-200:]


@router.get("/notifications")
async def get_notifications():
    return list(reversed(_notifications))


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int):
    global _notifications
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
