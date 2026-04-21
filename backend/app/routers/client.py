"""Client-specific endpoints: saved addresses, subscriptions, bottle debts, support."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client_data import BottleDebt, SavedAddress, Subscription
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
    sub = Subscription(user_id=user_id, **body.model_dump(by_alias=False))
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
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
    return {"count": row.count if row else 0}


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
