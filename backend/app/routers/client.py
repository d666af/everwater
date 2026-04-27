"""Client-specific endpoints: saved addresses, subscriptions, bottle debts, support."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client_data import BottleDebt, SavedAddress, Subscription
from app.models.user import User
from app.models.support import SupportChat, SupportMessage

router = APIRouter(prefix="/client", tags=["client"])


# ─── Saved addresses ─────────────────────────────────────────────────────────
class AddressBody(BaseModel):
    label: str | None = None
    address: str
    extra_info: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class AddressOut(AddressBody):
    id: int
    model_config = {"from_attributes": True}


@router.get("/{user_id}/addresses", response_model=list[AddressOut])
async def list_addresses(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedAddress).where(SavedAddress.user_id == user_id).order_by(SavedAddress.created_at.desc()))
    return result.scalars().all()


@router.post("/{user_id}/addresses", response_model=AddressOut)
async def add_address(user_id: int, body: AddressBody, db: AsyncSession = Depends(get_db)):
    addr = SavedAddress(user_id=user_id, **body.model_dump())
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.delete("/{user_id}/addresses/{addr_id}")
async def remove_address(user_id: int, addr_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedAddress).where(SavedAddress.id == addr_id, SavedAddress.user_id == user_id))
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)
    await db.commit()
    return {"ok": True}


# ─── Subscriptions ───────────────────────────────────────────────────────────
class SubscriptionBody(BaseModel):
    plan: str  # weekly | monthly
    water_summary: str
    qty: int = 1
    total: float = 0.0
    address: str
    landmark: str | None = None
    phone: str | None = None
    day: str | None = None
    time_slot: str | None = Field(default=None, alias="time")
    payment_method: str = "balance"
    latitude: float | None = None
    longitude: float | None = None

    model_config = {"populate_by_name": True}


class SubscriptionOut(BaseModel):
    id: int
    plan: str
    water_summary: str
    qty: int
    total: float
    address: str
    landmark: str | None
    phone: str | None
    day: str | None
    time_slot: str | None
    payment_method: str
    payment_confirmed: bool
    latitude: float | None
    longitude: float | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/{user_id}/subscriptions", response_model=list[SubscriptionOut])
async def list_subs(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at.desc()))
    return result.scalars().all()


@router.post("/{user_id}/subscriptions", response_model=SubscriptionOut)
async def add_sub(user_id: int, body: SubscriptionBody, db: AsyncSession = Depends(get_db)):
    import aiohttp
    from app.config import settings as cfg
    from app.models.manager import Manager

    payment_confirmed = body.payment_method != "card"
    sub = Subscription(user_id=user_id, payment_confirmed=payment_confirmed, **body.model_dump(by_alias=False))
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    user_q = await db.execute(select(User).where(User.id == user_id))
    u = user_q.scalar_one_or_none()
    client_name = u.name if u else str(user_id)
    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    pay_label = {"cash": "Наличные", "card": "Карта", "balance": "Баланс"}
    plan_name = plan_label.get(body.plan, body.plan)
    total_str = f"\nСумма: {int(body.total):,} сум" if body.total > 0 else ""
    text = (
        f"📋 {plan_name} подписка | {body.water_summary}\n"
        f"Клиент: {client_name}\n"
        f"Адрес: {body.address}\n"
        f"Оплата: {pay_label.get(body.payment_method, body.payment_method)}{total_str}"
    )
    if body.payment_method == "card":
        text += "\n⏳ Ожидает подтверждения оплаты"
    kb = {"inline_keyboard": [[
        {"text": "✅ Подтвердить", "callback_data": f"admin_sub_confirm:{sub.id}"},
        {"text": "❌ Отклонить", "callback_data": f"admin_sub_reject:{sub.id}"},
    ]]} if body.payment_method == "card" else None

    async def _tg_send(chat_id, msg, markup=None):
        url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": msg}
        if markup:
            payload["reply_markup"] = markup
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5))
        except Exception:
            pass

    for aid in cfg.ADMIN_IDS:
        await _tg_send(aid, text, kb)
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
    for m in mgrs:
        await _tg_send(m.telegram_id, text, kb)

    return sub


@router.delete("/{user_id}/subscriptions/{sub_id}")
async def cancel_sub(user_id: int, sub_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subscription).where(Subscription.id == sub_id, Subscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "cancelled"
    await db.commit()
    return {"ok": True}


# ─── Bottle debts (20L bottles owed) ─────────────────────────────────────────
class BottleDeltaBody(BaseModel):
    delta: int  # positive = more bottles owed, negative = returned


@router.get("/{user_id}/bottles_owed")
async def get_debt(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user_id))
    row = result.scalar_one_or_none()
    return {"count": row.count if row else 0, "survey_done": row.survey_done if row else False}


@router.post("/{user_id}/bottles_owed")
async def change_debt(user_id: int, body: BottleDeltaBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        row = BottleDebt(user_id=user_id, count=max(0, body.delta))
        db.add(row)
    else:
        row.count = max(0, row.count + body.delta)
    await db.commit()
    return {"count": row.count}


class BottleSurveyBody(BaseModel):
    count: int | None = None
    survey_msg_id: int | None = None
    survey_done: bool | None = None


@router.put("/{user_id}/bottle_survey")
async def update_bottle_survey(user_id: int, body: BottleSurveyBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        row = BottleDebt(user_id=user_id, count=0)
        db.add(row)

    old_msg_id = row.survey_msg_id

    if body.survey_msg_id is not None:
        row.survey_msg_id = body.survey_msg_id

    if body.count is not None:
        row.count = body.count
        row.survey_done = True
        row.survey_msg_id = None  # clear after answered

    if body.survey_done is not None and body.count is None:
        row.survey_done = body.survey_done

    await db.commit()

    # Edit the bot survey message when answered via mini app
    if body.count is not None and old_msg_id:
        user_q = await db.execute(select(User).where(User.id == user_id))
        u = user_q.scalar_one_or_none()
        if u and u.telegram_id:
            label = f"{body.count} бут." if body.count > 0 else "нет бутылок"
            await _edit_tg_msg(u.telegram_id, old_msg_id, f"✅ Бутылки к возврату: {label} (указано в приложении)")

    return {"ok": True, "count": row.count, "survey_done": row.survey_done}


async def _edit_tg_msg(telegram_id: int, msg_id: int, text: str):
    from app.config import settings as cfg
    import aiohttp
    url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/editMessageText"
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(url, json={"chat_id": telegram_id, "message_id": msg_id, "text": text},
                         timeout=aiohttp.ClientTimeout(total=5))
    except Exception:
        pass


# ─── Client support chat ──────────────────────────────────────────────────────

class ClientMessageBody(BaseModel):
    telegram_id: int
    user_name: str = ""
    text: str


@router.post("/support/send")
async def client_send_support(body: ClientMessageBody, db: AsyncSession = Depends(get_db)):
    """Client sends a support message (same as bot's user_message, called from Mini App)."""
    result = await db.execute(select(SupportChat).where(SupportChat.id == body.telegram_id))
    chat = result.scalar_one_or_none()
    now = datetime.utcnow()
    if not chat:
        chat = SupportChat(
            id=body.telegram_id,
            user_name=body.user_name,
            unread_count=0,
            last_message="",
            last_time=now,
        )
        db.add(chat)
        await db.flush()
    chat.unread_count = (chat.unread_count or 0) + 1
    chat.last_message = body.text
    chat.last_time = now
    if body.user_name:
        chat.user_name = body.user_name
    msg = SupportMessage(
        chat_id=body.telegram_id,
        text=body.text,
        from_admin=False,
        delivered=True,
        created_at=now,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {"ok": True, "id": msg.id}


@router.get("/support/messages")
async def client_get_messages(telegram_id: int, db: AsyncSession = Depends(get_db)):
    """Returns all messages for the client's support chat."""
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.chat_id == telegram_id)
        .order_by(SupportMessage.created_at)
    )
    return [
        {
            "id": m.id,
            "from": "support" if m.from_admin else "user",
            "text": m.text,
            "time": m.created_at.isoformat() if m.created_at else None,
        }
        for m in result.scalars().all()
    ]
