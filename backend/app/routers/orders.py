import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header
from pydantic import BaseModel
from sqlalchemy import update as sa_update, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from app.database import get_db
from app.models.order import Order, OrderItem, OrderStatus, Review
from app.models.product import Product
from app.models.user import User
from app.models.courier import Courier
from app.models.client_data import BottleDebt

from app.schemas.order import OrderCreate, OrderOut, ReviewCreate
from app.services.settings_service import get_all_settings
from app.services.phone import phone_digits_col

router = APIRouter(prefix="/orders", tags=["orders"])


def _order_items_text(items) -> str:
    if not items:
        return "—"
    parts = [f"{i.product.name} {i.quantity} шт." for i in items if i.product]
    return ", ".join(parts) if parts else "—"


async def _tg(chat_id: int, text: str):
    """Fire-and-forget Telegram message."""
    from app.config import settings as cfg
    import aiohttp
    if not chat_id:
        return
    url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(url, json={"chat_id": chat_id, "text": text},
                         timeout=aiohttp.ClientTimeout(total=5))
    except Exception:
        pass


async def _tg_delete_message(chat_id: int, message_id: int):
    """Delete a Telegram message silently."""
    from app.config import settings as cfg
    import aiohttp
    if not chat_id or not message_id:
        return
    url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/deleteMessage"
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(url, json={"chat_id": chat_id, "message_id": message_id},
                         timeout=aiohttp.ClientTimeout(total=5))
    except Exception:
        pass


async def _tg_send(chat_id: int, text: str, reply_markup: dict | None = None,
                   parse_mode: str | None = None) -> int | None:
    """Send Telegram message, return message_id on success."""
    from app.config import settings as cfg
    import aiohttp
    if not chat_id:
        return None
    payload: dict = {"chat_id": chat_id, "text": text}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    if parse_mode:
        payload["parse_mode"] = parse_mode
    url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
    try:
        async with aiohttp.ClientSession() as s:
            r = await s.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5))
            data = await r.json()
            return data.get("result", {}).get("message_id")
    except Exception:
        return None


async def _tg_edit_or_send(chat_id: int, text: str, msg_id: int | None) -> int | None:
    """Edit existing status message if possible, otherwise send new. Returns message_id."""
    from app.config import settings as cfg
    import aiohttp
    if not chat_id:
        return None
    if msg_id:
        url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/editMessageText"
        try:
            async with aiohttp.ClientSession() as s:
                r = await s.post(url,
                                 json={"chat_id": chat_id, "message_id": msg_id, "text": text},
                                 timeout=aiohttp.ClientTimeout(total=5))
                data = await r.json()
                if data.get("ok"):
                    return msg_id
        except Exception:
            pass
    return await _tg_send(chat_id, text)


async def _tg_edit(chat_id: int, message_id: int, text: str, reply_markup=None, parse_mode: str | None = None) -> bool:
    """Edit a Telegram message text and remove/replace its inline keyboard.
    Pass reply_markup=None to remove the keyboard (sends empty InlineKeyboardMarkup)."""
    from app.config import settings as cfg
    import aiohttp
    if not chat_id or not message_id:
        return False
    payload: dict = {"chat_id": chat_id, "message_id": message_id, "text": text,
                     "reply_markup": reply_markup if reply_markup is not None else {}}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/editMessageText"
    try:
        async with aiohttp.ClientSession() as s:
            r = await s.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5))
            data = await r.json()
            return bool(data.get("ok"))
    except Exception:
        return False


async def _save_status_msg_id(db: AsyncSession, order_id: int, msg_id: int):
    """Persist the Telegram message_id used for client status notifications."""
    await db.execute(sa_update(Order).where(Order.id == order_id).values(client_status_msg_id=msg_id))
    await db.commit()


async def _notify_admins(db: AsyncSession, text: str):
    from app.services.tg_notify import get_all_admin_ids
    seen: set[int] = set()
    for aid in await get_all_admin_ids(db):
        if aid in seen:
            continue
        seen.add(aid)
        await _tg(aid, text)
    from app.models.manager import Manager
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
    for m in mgrs:
        if not m.telegram_id or int(m.telegram_id) in seen:
            continue
        seen.add(int(m.telegram_id))
        await _tg(m.telegram_id, text)


async def _get_shortage_lines(db: AsyncSession, items_data: list) -> list[str]:
    """Return one description line per product whose warehouse stock is insufficient."""
    from app.models.warehouse import WaterStock
    lines = []
    for product, quantity in items_data:
        stock_q = await db.execute(select(WaterStock).where(WaterStock.product_id == product.id))
        stock = stock_q.scalar_one_or_none()
        available = stock.quantity if stock else 0
        if available < quantity:
            lines.append(f"• {product.name}: нужно {quantity} шт., на складе {available} шт.")
    return lines


async def _send_shortage_notification(db: AsyncSession, shortage_lines: list, order_id: int,
                                       extra_chat_ids: list[int] | None = None):
    """Send a pre-computed shortage notification to warehouse, managers, and optional extra recipients."""
    if not shortage_lines:
        return
    from app.config import settings as cfg
    from app.models.manager import Manager

    text = (
        f"⚠️ Нехватка товара на складе!\n"
        f"Заказ #{order_id}\n\n"
        + "\n".join(shortage_lines)
        + "\n\nПополните склад как можно скорее."
    )
    from app.services.tg_notify import get_all_admin_ids
    recipients: list[int] = list(await get_all_admin_ids(db)) + list(cfg.WAREHOUSE_IDS) + list(extra_chat_ids or [])
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
    for m in mgrs:
        if m.telegram_id:
            recipients.append(m.telegram_id)
    seen: set[int] = set()
    for chat_id in recipients:
        if chat_id and chat_id not in seen:
            seen.add(chat_id)
            await _tg(chat_id, text)


async def _notify_low_stock_if_needed(
    db: AsyncSession,
    items_data: list,
    order_id: int,
    extra_chat_ids: list[int] | None = None,
):
    """Check warehouse stock and notify if any product is insufficient."""
    shortage_lines = await _get_shortage_lines(db, items_data)
    await _send_shortage_notification(db, shortage_lines, order_id, extra_chat_ids)


async def _reserve_inventory(order, db: AsyncSession):
    """Move order items from courier's available quantity → reserved."""
    from app.models.warehouse import CourierWater
    if not order.courier_id or not order.items:
        return
    is_manager_order = getattr(order, 'creator_role', None) == 'manager'
    for item in order.items:
        if not item.product_id or not item.quantity:
            continue
        row_q = await db.execute(
            select(CourierWater).where(
                CourierWater.courier_id == order.courier_id,
                CourierWater.product_id == item.product_id,
            )
        )
        row = row_q.scalar_one_or_none()
        if is_manager_order:
            if not row:
                row = CourierWater(
                    courier_id=order.courier_id,
                    product_id=item.product_id,
                    quantity=0,
                    issued_today=item.quantity,
                )
                db.add(row)
            else:
                row.issued_today = (row.issued_today or 0) + item.quantity
            row.reserved = (row.reserved or 0) + item.quantity
        elif row:
            qty = min(item.quantity, max(0, row.quantity))
            row.quantity = max(0, row.quantity - qty)
            row.reserved = (row.reserved or 0) + qty


async def _release_inventory(order, db: AsyncSession, consume: bool = False):
    """Move reserved items back to available (cancel) or simply remove them (deliver)."""
    from app.models.warehouse import CourierWater
    if not order.courier_id or not order.items:
        return
    is_manager_order = getattr(order, 'creator_role', None) == 'manager'
    # For manager-created orders always consume (items were never physically with the courier before assignment)
    if is_manager_order:
        consume = True
    for item in order.items:
        if not item.product_id or not item.quantity:
            continue
        row_q = await db.execute(
            select(CourierWater).where(
                CourierWater.courier_id == order.courier_id,
                CourierWater.product_id == item.product_id,
            )
        )
        row = row_q.scalar_one_or_none()
        if row:
            qty = min(item.quantity, max(0, row.reserved or 0))
            row.reserved = max(0, (row.reserved or 0) - qty)
            if not consume:
                row.quantity = (row.quantity or 0) + qty


def calc_bottle_discount(count: int, subtotal: float, cfg: dict) -> float:
    """LEGACY: pre-surcharge discount calc, kept for compat."""
    if count <= 0:
        return 0.0
    if cfg.get("bottle_discount_type") == "percent":
        pct = float(cfg.get("bottle_discount_value") or 0)
        return min(subtotal, subtotal * pct / 100.0)
    per = float(cfg.get("bottle_discount_value") or 0)
    return count * per


def calc_bottle_surcharge(items_data: list, return_count: int, cfg: dict, bottles_lent: int = 0) -> float:
    """New model: charge an extra fee for every 19L bottle the customer
    keeps (i.e. doesn't return) in this order. Lent bottles (одолженные)
    are treated like returns for surcharge — they still go to bottle debt
    but no surcharge is charged. Per-product surcharge is used when set;
    otherwise falls back to the global setting."""
    fallback = float(cfg.get("bottle_discount_value") or 0)
    is_percent = cfg.get("bottle_discount_type") == "percent"
    returns_left = max(0, int(return_count or 0) + int(bottles_lent or 0))
    total = 0.0
    for product, qty in items_data:
        vol = float(product.volume or 0)
        if not (18 < vol < 20):
            continue
        refilled = min(qty, returns_left)
        missing = qty - refilled
        returns_left -= refilled
        if missing <= 0:
            continue
        per_unit = product.bottle_surcharge
        if per_unit is None or per_unit <= 0:
            per_unit = round(product.price * fallback / 100) if is_percent else fallback
        total += missing * float(per_unit or 0)
    return total


@router.post("/", response_model=OrderOut)
async def create_order(
    data: OrderCreate,
    from_bot: bool = False,
    db: AsyncSession = Depends(get_db),
    x_idempotency_key: str | None = Header(default=None),
):
    # Idempotency: return existing order if key already used
    if x_idempotency_key:
        from sqlalchemy import text as _text
        idem_row = (await db.execute(
            _text("SELECT order_id FROM idempotency_keys WHERE key = :k"),
            {"k": x_idempotency_key},
        )).fetchone()
        if idem_row:
            return _order_to_out(await _get_order(idem_row[0], db))

    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    subtotal = 0.0
    items_data = []
    for item in data.items:
        prod_result = await db.execute(select(Product).where(Product.id == item.product_id))
        product = prod_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        subtotal += product.price * item.quantity
        items_data.append((product, item.quantity))

    cfg = await get_all_settings(db)
    # New model: surcharge added for every non-returned 19L bottle. Discount
    # path retained for legacy clients that still send bottle_discount.
    bottle_discount = float(data.bottle_discount or 0)
    bottle_surcharge = data.bottle_surcharge if data.bottle_surcharge is not None else \
        calc_bottle_surcharge(items_data, data.return_bottles_count, cfg, data.bottles_lent)

    delivery_fee = float(data.delivery_fee or cfg.get("delivery_price") or 0) if cfg.get("delivery_enabled", True) else 0.0
    bonus_limit_pct = float(cfg.get("bonus_limit_percent") or 30) / 100
    pre_bonus_total = subtotal + bottle_surcharge - bottle_discount
    max_bonus_by_pct = (pre_bonus_total + delivery_fee) * bonus_limit_pct
    bonus_used = min(float(data.bonus_used or 0), float(user.bonus_points or 0),
                     max(0.0, pre_bonus_total), max_bonus_by_pct)
    total = max(0.0, pre_bonus_total - bonus_used + delivery_fee)

    order = Order(
        user_id=data.user_id,
        recipient_phone=data.recipient_phone,
        address=data.address,
        extra_info=data.extra_info,
        delivery_time=data.delivery_time,
        latitude=data.latitude,
        longitude=data.longitude,
        return_bottles_count=data.return_bottles_count,
        bottles_lent=data.bottles_lent,
        return_bottles_volume=data.return_bottles_volume,
        bottle_discount=bottle_discount,
        bottle_surcharge=bottle_surcharge,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total=total,
        bonus_used=bonus_used,
        payment_method=data.payment_method or "cash",
        status=OrderStatus.NEW,
    )
    db.add(order)
    await db.flush()

    for product, quantity in items_data:
        item = OrderItem(order_id=order.id, product_id=product.id, quantity=quantity, price=product.price)
        db.add(item)

    if bonus_used > 0:
        user.bonus_points = max(0.0, user.bonus_points - bonus_used)

    # Pre-claim notification_msg_ids for bot orders so the scheduler doesn't send a duplicate
    if from_bot:
        order.notification_msg_ids = "[]"

    if x_idempotency_key:
        from sqlalchemy import text as _text
        await db.execute(
            _text("INSERT INTO idempotency_keys (key, order_id, created_at) VALUES (:k, :oid, NOW()) ON CONFLICT (key) DO NOTHING"),
            {"k": x_idempotency_key, "oid": order.id},
        )

    await db.commit()
    await db.refresh(order)

    result = await db.execute(
        select(Order).where(Order.id == order.id).options(*_order_opts())
    )
    order = result.scalar_one()
    return _order_to_out(order)


def _order_opts():
    return (
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.user),
        selectinload(Order.courier),
        selectinload(Order.agent),
        selectinload(Order.review),
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(*_order_opts())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # Enrich with client bottle debt info
    bottles_owed = 0
    bottles_pending = 0
    if order.user_id:
        debt_row = (await db.execute(select(BottleDebt).where(BottleDebt.user_id == order.user_id))).scalar_one_or_none()
        bottles_owed = debt_row.count if debt_row else 0
        bottles_pending = int((await db.execute(
            select(func.sum(Order.return_bottles_count)).where(
                Order.user_id == order.user_id,
                Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.IN_DELIVERY]),
                Order.return_bottles_count > 0,
            )
        )).scalar() or 0)
    return _order_to_out(order, client_bottles_owed=bottles_owed, client_bottles_pending=bottles_pending)


@router.get("/user/{user_id}", response_model=list[OrderOut])
async def get_user_orders(user_id: int, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    conditions = [Order.user_id == user_id]
    if user and user.phone:
        digits = ''.join(c for c in user.phone if c.isdigit())
        if len(digits) >= 9:
            conditions.append(
                and_(Order.user_id.is_(None), phone_digits_col(Order.recipient_phone).contains(digits[-9:]))
            )
    result = await db.execute(
        select(Order).where(or_(*conditions))
        .options(*_order_opts())
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.get("/", response_model=list[OrderOut])
async def get_all_orders(status: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Order).options(*_order_opts()).where(Order.is_deleted == False)
    if status:
        query = query.where(Order.status == status)
    query = query.order_by(Order.created_at.desc())
    result = await db.execute(query)
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.patch("/{order_id}/confirm")
async def confirm_order(order_id: int, from_bot: bool = False, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status not in (OrderStatus.AWAITING_CONFIRMATION, OrderStatus.NEW):
        raise HTTPException(status_code=409, detail="Order already processed")

    msg_ids_json = order.notification_msg_ids
    order.status = OrderStatus.CONFIRMED
    order.payment_confirmed = True
    order.confirmed_at = datetime.utcnow()

    client_tg = order.user.telegram_id if order.user else None
    old_msg_id = order.client_status_msg_id
    items = _order_items_text(order.items)
    oid = order.id

    await db.commit()

    if not from_bot:
        from app.services.tg_notify import edit_all_notifications
        await edit_all_notifications(msg_ids_json, f"✅ Заказ #{oid} подтверждён")

    if not from_bot:
        text = f"✅ Заказ подтверждён!\n{items}\nСкоро назначим курьера."
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

    return {"ok": True, "status": order.status}


class RejectBody(BaseModel):
    reason: str = ""
    rejected_by_name: str | None = None
    rejected_by_role: str | None = None


@router.patch("/{order_id}/reject")
async def reject_order(order_id: int, body: RejectBody = RejectBody(), from_bot: bool = False,
                       db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status == OrderStatus.REJECTED:
        raise HTTPException(status_code=409, detail="Order already rejected")

    msg_ids_json = order.notification_msg_ids
    was_assigned = order.courier_id is not None
    was_delivered = order.status == OrderStatus.DELIVERED
    _bd_user_id = order.user_id
    order.status = OrderStatus.REJECTED
    order.rejection_reason = body.reason
    if body.rejected_by_name:
        order.rejected_by_name = body.rejected_by_name
    if body.rejected_by_role:
        order.rejected_by_role = body.rejected_by_role

    client_tg = order.user.telegram_id if order.user else None
    client_name = (order.user.name if order.user else None) or ""
    old_msg_id = order.client_status_msg_id
    courier_tg = order.courier.telegram_id if order.courier else None
    courier_status_msg_id = order.courier_status_msg_id
    courier_name = (order.courier.name if order.courier else None) or ""
    courier_phone = (order.courier.phone if order.courier else None) or ""
    assigner_name = order.assigner_name or ""
    assigner_role = order.assigner_role or ""
    creator_role = order.creator_role or ""
    creator_name = order.creator_name or (order.agent.name if order.creator_role == "agent" and order.agent else "") or ""
    agent_id_for_notify = order.agent_id
    order_phone = order.recipient_phone
    oid = order.id
    return_bottles = order.return_bottles_count or 0
    bottles_lent = order.bottles_lent or 0
    bottle_surcharge_val = order.bottle_surcharge or 0.0
    _bd_bottles_delivered = sum(
        i.quantity for i in order.items if i.product and i.product.has_bottle_deposit
    )

    # Build all blocks before commit (relationships expire after)
    items_lines_priced = [
        f"• {i.product.name} {i.quantity} шт. х {int(i.price):,} сум"
        for i in order.items if i.product
    ]
    items_lines_simple = [
        f"• {i.product.name} {i.quantity} шт."
        for i in order.items if i.product
    ]
    items_block_priced = "\n".join(items_lines_priced)
    items_block_simple = "\n".join(items_lines_simple)

    bottle_lines = []
    if return_bottles:
        bottle_lines.append(f"♻️ Возврат бутылок: {return_bottles} шт.")
    if bottles_lent:
        bottle_lines.append(f"📦 Одолжить: {bottles_lent} шт.")
    if bottle_surcharge_val:
        bottle_lines.append(f"💰 Надбавка за невозврат: {int(bottle_surcharge_val):,} сум")
    bottle_block = "\n".join(bottle_lines)

    if was_assigned:
        await _release_inventory(order, db, consume=False)
    await db.commit()

    # Reverse BottleDebt if order was previously delivered
    if was_delivered and _bd_user_id:
        _bd_net_change = _bd_bottles_delivered + bottles_lent - return_bottles
        if _bd_net_change != 0:
            debt_q = await db.execute(select(BottleDebt).where(BottleDebt.user_id == _bd_user_id))
            debt_row = debt_q.scalar_one_or_none()
            if debt_row:
                debt_row.count = max(0, debt_row.count - _bd_net_change)
                await db.commit()
        # Also delete the delivery_net WaterTransaction so courier debt is restored
        from app.models.warehouse import WaterTransaction as WT
        del_txs = (await db.execute(
            select(WT).where(WT.order_id == oid, WT.transaction_type == "delivery_net")
        )).scalars().all()
        for tx in del_txs:
            await db.delete(tx)
        if del_txs:
            await db.commit()

    # Build rejector title suffix
    _REJECTOR_LABELS = {
        "admin": "администратором", "manager": "менеджером",
        "courier": "курьером", "client": "клиентом", "agent": "агентом",
    }
    if body.rejected_by_role:
        role_lbl = _REJECTOR_LABELS.get(body.rejected_by_role, body.rejected_by_role)
        if body.rejected_by_name and body.rejected_by_role != "client":
            rejector_suffix = f" {role_lbl} {body.rejected_by_name}"
        else:
            rejector_suffix = f" {role_lbl}"
    else:
        rejector_suffix = ""
    title = f"❌ Заказ отменён{rejector_suffix}"

    client_line = f"Клиент: {client_name} {order_phone}".strip() if (client_name or order_phone) else ""

    # Extra lines shown only to admin/manager
    courier_line = f"🚴 Курьер: {courier_name} {courier_phone}".strip() if courier_name else ""
    _ROLE_LABELS = {"manager": "Менеджер", "admin": "Администратор", "courier": "Курьер", "agent": "Агент"}
    if assigner_name:
        _asgn_lbl = _ROLE_LABELS.get(assigner_role, "") if assigner_role else ""
        assigner_line = f"👤 Назначил курьера: {_asgn_lbl} {assigner_name}".strip()
    else:
        assigner_line = ""
    if creator_role and creator_name:
        creator_line = f"✍️ Создал заказ: {_ROLE_LABELS.get(creator_role, creator_role.capitalize())} {creator_name}"
    elif creator_role:
        creator_line = f"✍️ Создал заказ: {_ROLE_LABELS.get(creator_role, creator_role.capitalize())}"
    else:
        creator_line = ""
    staff_extra = "\n".join(filter(None, [courier_line, assigner_line, creator_line]))

    # Staff text (admins/managers) — full details with courier and creator info
    staff_text = (
        title
        + (f"\n{client_line}" if client_line else "")
        + (f"\n{items_block_priced}" if items_block_priced else "")
        + (f"\n{bottle_block}" if bottle_block else "")
        + (f"\n{staff_extra}" if staff_extra else "")
        + (f"\nПричина: {body.reason}" if body.reason else "")
    )

    # Courier text — rejector info + client/items, no courier/creator meta
    courier_reject_text = (
        title
        + (f"\n{client_line}" if client_line else "")
        + (f"\n{items_block_priced}" if items_block_priced else "")
        + (f"\n{bottle_block}" if bottle_block else "")
        + (f"\nПричина: {body.reason}" if body.reason else "")
    )

    import json as _j
    # Collect chat_ids already receiving staff notification (to deduplicate)
    notified_chat_ids: set[int] = set()
    if msg_ids_json:
        try:
            for m in _j.loads(msg_ids_json):
                notified_chat_ids.add(int(m["chat_id"]))
        except Exception:
            pass

    from app.services.tg_notify import edit_all_notifications
    await edit_all_notifications(msg_ids_json, staff_text)

    # Notify courier — edit their assignment message (removes buttons)
    if courier_tg:
        if courier_status_msg_id:
            await _tg_edit(int(courier_tg), courier_status_msg_id, courier_reject_text, reply_markup=None)
        elif int(courier_tg) not in notified_chat_ids:
            # Only send new message if courier isn't already in staff notification set
            await _tg(courier_tg, courier_reject_text)

    # Notify agent if order was created by one (skip if already in staff notifications)
    if agent_id_for_notify:
        from app.models.agent import Agent
        agent_row = (await db.execute(select(Agent).where(Agent.id == agent_id_for_notify))).scalar_one_or_none()
        if agent_row and agent_row.telegram_id:
            agent_tg = int(agent_row.telegram_id)
            if agent_tg not in notified_chat_ids and agent_tg != (courier_tg and int(courier_tg)):
                await _tg(agent_tg, courier_reject_text)

    # Client gets simple format without prices or meta
    client_reject_text = "❌ Ваш заказ отменён."
    if body.reason:
        client_reject_text += f"\nПричина: {body.reason}"
    new_msg_id = await _tg_edit_or_send(client_tg, client_reject_text, old_msg_id)
    if new_msg_id and new_msg_id != old_msg_id:
        await _save_status_msg_id(db, oid, new_msg_id)

    return {"ok": True}


class CourierMsgIdBody(BaseModel):
    msg_id: int


@router.patch("/{order_id}/courier_msg_id")
async def save_courier_msg_id_endpoint(order_id: int, body: CourierMsgIdBody,
                                       db: AsyncSession = Depends(get_db)):
    await db.execute(sa_update(Order).where(Order.id == order_id).values(courier_status_msg_id=body.msg_id))
    await db.commit()
    return {"ok": True}


class ClientMsgIdBody(BaseModel):
    msg_id: int


@router.patch("/{order_id}/client_msg_id")
async def save_client_msg_id_endpoint(order_id: int, body: ClientMsgIdBody,
                                      db: AsyncSession = Depends(get_db)):
    await db.execute(sa_update(Order).where(Order.id == order_id).values(client_status_msg_id=body.msg_id))
    await db.commit()
    return {"ok": True}


@router.patch("/{order_id}/payment_confirmed")
async def payment_confirmed(order_id: int, from_bot: bool = False, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.status = OrderStatus.AWAITING_CONFIRMATION

    oid = order.id
    client_tg = order.user.telegram_id if order.user else None
    client_name = order.user.name if order.user else "—"
    client_phone = order.recipient_phone
    order_addr = order.address
    items_text = _order_items_text(order.items)
    order_total = int(order.total)
    pay_method = order.payment_method
    pay_labels = {"cash": "Наличные", "card": "Перевод на карту"}
    pay_label = pay_labels.get(pay_method, pay_method)

    await db.commit()

    # Notify the client in Telegram when order is placed from the website
    if not from_bot and client_tg:
        new_msg_id = await _tg_send(client_tg, "✅ Заказ создан!\nОжидайте подтверждения оператора.")
        if new_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

    if not from_bot:
        from app.config import settings as cfg
        from app.models.manager import Manager
        from app.services.tg_notify import notify_all, get_all_admin_ids
        _pay_labels_pc = {"cash": "Наличными курьеру", "card": "Картой", "bonus": "Бонусами"}
        text = (
            f"🆕 Новый заказ! Создан клиентом\n"
            f"Клиент: {client_name} | {client_phone}\n"
            f"Адрес: {order_addr}\n"
            f"Заказ: {items_text}\n"
            f"Оплата: {_pay_labels_pc.get(pay_method, pay_method)}\n"
            f"Итого: {order_total:,} сум"
        )
        kb = {"inline_keyboard": [
            [{"text": "📦 Назначить курьера", "callback_data": f"order:assign:{oid}"}],
            [{"text": "❌ Отменить заказ", "callback_data": f"order:reject:{oid}"}],
        ]}
        mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
        msg_ids_json = await notify_all(list(await get_all_admin_ids(db)), mgrs, text, kb)
        await db.execute(sa_update(Order).where(Order.id == oid).values(notification_msg_ids=msg_ids_json))
        await db.commit()

    return {"ok": True}


class NotificationMsgIdsBody(BaseModel):
    msg_ids: list[dict]  # [{chat_id, message_id}]


@router.patch("/{order_id}/notification_msg_ids")
async def store_notification_msg_ids(order_id: int, body: NotificationMsgIdsBody, db: AsyncSession = Depends(get_db)):
    """Store notification message IDs for bot-sent order notifications."""
    import json
    await db.execute(sa_update(Order).where(Order.id == order_id).values(
        notification_msg_ids=json.dumps(body.msg_ids)
    ))
    await db.commit()
    return {"ok": True}


class AssignBody(BaseModel):
    courier_id: int
    manager_telegram_id: int | None = None
    assigner_name: str | None = None
    assigner_role: str | None = None


@router.patch("/{order_id}/assign_courier")
async def assign_courier(order_id: int, body: AssignBody, from_bot: bool = False,
                         db: AsyncSession = Depends(get_db)):
    courier_id = body.courier_id
    order = await _get_order(order_id, db)
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    # Capture everything needed for notifications BEFORE commit
    # (after commit SQLAlchemy expires all attributes → MissingGreenlet on lazy access)
    client_tg = order.user.telegram_id if order.user else None
    client_name = (order.user.name if order.user else None) or "—"
    old_msg_id = order.client_status_msg_id
    notification_msg_ids = order.notification_msg_ids
    _items_data_ac = [(i.product, i.quantity) for i in order.items if i.product]
    _ret_cnt = order.return_bottles_count or 0
    _lent_cnt = order.bottles_lent or 0
    _surcharge_ac = order.bottle_surcharge or 0.0
    _qty19_ac = sum(q for p, q in _items_data_ac if p.has_bottle_deposit)
    _missing_ac = max(0, _qty19_ac - _ret_cnt)
    _snum_ac = f"{int(_surcharge_ac):,}".replace(",", " ")
    _bullet_lines_ac = [f"  • {p.name} {q} шт." for p, q in _items_data_ac]
    if _surcharge_ac > 0 and _missing_ac > 0:
        _bullet_lines_ac.append(f"  • Невозвращённые бутылки {_missing_ac} шт. — +{_snum_ac} сум")
    items_bullets = "\n".join(_bullet_lines_ac) or "—"
    items = _order_items_text(order.items)
    items_data_for_stock = _items_data_ac
    order_address = order.address
    order_phone = order.recipient_phone
    order_lat = order.latitude
    order_lng = order.longitude
    order_time = order.delivery_time or "—"
    order_total = int(order.total)
    order_payment = order.payment_method or "cash"
    order_creator_role = order.creator_role
    order_creator_name = order.creator_name or (order.agent.name if order.creator_role == "agent" and order.agent else None)
    courier_tg = courier.telegram_id
    courier_name = courier.name
    courier_phone = courier.phone or ""
    oid = order.id

    cfg = await get_all_settings(db)
    eta_hours = float(cfg.get("delivery_eta_hours") or 2)

    order.courier_id = courier_id
    order.status = OrderStatus.ASSIGNED_TO_COURIER
    order.delivery_expected_at = datetime.utcnow() + timedelta(hours=eta_hours)
    order.delivery_reminder_sent = False
    order.delivery_reminder_2_sent = False

    # Store which manager/admin assigned this courier (name + role)
    if body.assigner_name:
        order.assigner_name = body.assigner_name
    if body.assigner_role:
        order.assigner_role = body.assigner_role
    if body.manager_telegram_id:
        from app.models.manager import Manager
        from app.config import settings as cfg
        mgr = (await db.execute(
            select(Manager).where(Manager.telegram_id == body.manager_telegram_id, Manager.is_active == True)
        )).scalar_one_or_none()
        if mgr:
            if mgr.phone:
                order.manager_phone = mgr.phone
            if not order.assigner_name and mgr.name:
                order.assigner_name = mgr.name
            if not order.assigner_role:
                order.assigner_role = "manager"
        else:
            from app.services.tg_notify import get_all_admin_ids as _gaa
            _all_aids = await _gaa(db)
            if body.manager_telegram_id in _all_aids:
                admin_user = (await db.execute(
                    select(User).where(User.telegram_id == body.manager_telegram_id)
                )).scalar_one_or_none()
                if admin_user:
                    if admin_user.phone:
                        order.manager_phone = admin_user.phone
                    if not order.assigner_name and admin_user.name:
                        order.assigner_name = admin_user.name
                    if not order.assigner_role:
                        order.assigner_role = "admin"

    # Return-only manager orders: record bottle return and auto-deliver on courier assignment
    is_return_only_manager = (
        not order.items
        and (order.return_bottles_count or 0) > 0
        and getattr(order, 'creator_role', None) == 'manager'
    )
    if is_return_only_manager:
        from app.models.warehouse import WaterTransaction
        db.add(WaterTransaction(
            courier_id=courier_id,
            transaction_type="bottle_return",
            quantity=order.return_bottles_count,
            order_id=order.id,
        ))
        order.status = OrderStatus.DELIVERED
        order.delivered_at = datetime.utcnow()
        await db.commit()
        await _tg(courier_tg,
                  f"♻️ Вам записан возврат бутылок!\n\n"
                  f"Клиент: {order_phone}\n"
                  f"Адрес: {order_address}\n"
                  f"Бутылки 19л: {order.return_bottles_count} шт.")
        return {"ok": True}

    await _reserve_inventory(order, db)
    order_assigner_name = order.assigner_name  # capture before commit expires it
    order_assigner_role = order.assigner_role or ""
    await db.commit()

    _pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
    pay_label_str = _pay_labels.get(order_payment, order_payment)
    c_phone_part = f"  |  {courier_phone}" if courier_phone else ""
    _ROLE_LABELS_SYNC = {"manager": "Менеджер", "admin": "Администратор", "courier": "Курьер", "agent": "Агент"}
    if order_creator_role:
        _cr_label = _ROLE_LABELS_SYNC.get(order_creator_role, order_creator_role.capitalize())
        _creator_line = f"\n✍️ Создал заказ: {_cr_label} {order_creator_name}" if order_creator_name else f"\n✍️ Создал заказ: {_cr_label}"
    else:
        _client_label = client_name if client_name and client_name != "—" else "Клиент"
        _creator_line = f"\n✍️ Создал заказ: Клиент {_client_label}"
    if order_assigner_name:
        _asgn_role_lbl = _ROLE_LABELS_SYNC.get(order_assigner_role, "") if order_assigner_role else ""
        _assigner_line = f"\n👤 Назначил курьера: {_asgn_role_lbl} {order_assigner_name}".rstrip()
    elif order_creator_role in ("manager", "admin") and order_creator_name:
        _cr_asgn_lbl = _ROLE_LABELS_SYNC.get(order_creator_role, order_creator_role.capitalize())
        _assigner_line = f"\n👤 Назначил курьера: {_cr_asgn_lbl} {order_creator_name}"
    else:
        _assigner_line = ""
    _ret_line_ac = f"\n♻️ Возврат бутылок: {_ret_cnt} шт." if _ret_cnt else ""
    _lent_line_ac = f"\n📦 Одолжить: {_lent_cnt} шт." if _lent_cnt else ""
    _surcharge_line_ac = f"\n💰 Надбавка за невозврат: {int(_surcharge_ac):,} сум" if _surcharge_ac > 0 else ""
    sync_text = (
        f"✅ Курьер {courier_name} назначен\n\n"
        f"👤 {client_name}  |  {order_phone}\n"
        f"📍 {order_address}\n\n"
        f"Товары:\n{items_bullets}\n"
        f"💰 {order_total:,} сум  |  {pay_label_str}"
        f"{_ret_line_ac}{_lent_line_ac}{_surcharge_line_ac}"
        f"{_creator_line}\n"
        f"🚴 {courier_name}{c_phone_part}"
        f"{_assigner_line}"
    )

    from app.services.tg_notify import edit_all_notifications
    _cancel_kb_ac = {"inline_keyboard": [
        [{"text": "🔁 Изменить курьера", "callback_data": f"order:reassign:{oid}"}],
        [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
        [{"text": "❌ Отменить заказ", "callback_data": f"order:cancel:{oid}"}],
    ]}
    await edit_all_notifications(notification_msg_ids, sync_text, reply_markup=_cancel_kb_ac)

    if not from_bot:

        from app.config import settings as _cfg_ac
        _site_url_ac = _cfg_ac.MINI_APP_URL.rstrip("/") + "/courier/map"
        _client_id_ac = f"{client_name}  |  {order_phone}" if client_name and client_name != "—" else order_phone
        _ret_line_c = f"\n♻️ Возврат бутылок: {_ret_cnt} шт." if _ret_cnt else ""
        _lent_line_c = f"\n📦 Одолжить: {_lent_cnt} шт." if _lent_cnt else ""
        courier_text = (
            f"🚴 <b>Вам назначен заказ!</b>\n\n"
            f"👤 {_client_id_ac}\n"
            f"📍 {order_address}\n\n"
            f"Товары:\n{items_bullets}\n"
            f"💰 {order_total:,} сум  |  {pay_label_str}"
            f"{_ret_line_c}{_lent_line_c}"
        )
        _kb_rows = [
            [{"text": "🗺 Карта заказов", "web_app": {"url": _site_url_ac}}],
            [{"text": "🚴 В пути", "callback_data": f"courier:in_delivery:{oid}"}],
            [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
        ]
        c_msg_id = await _tg_send(courier_tg, courier_text, {"inline_keyboard": _kb_rows})
        if c_msg_id:
            await db.execute(sa_update(Order).where(Order.id == oid).values(courier_status_msg_id=c_msg_id))
            await db.commit()
        _phone_line = f"\nТелефон курьера: {courier_phone}" if courier_phone else ""
        text = f"🚴 Курьер {courier_name} назначен на ваш заказ!\nОжидайте доставку.{_phone_line}"
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

    return {"ok": True}


class ChangeCourierBody(BaseModel):
    courier_id: int
    changer_name: str | None = None
    changer_role: str | None = None
    manager_telegram_id: int | None = None


async def _resolve_staff_identity(db: AsyncSession, telegram_id: int) -> tuple[str | None, str | None]:
    """Return (name, role) for a manager or admin telegram id."""
    from app.models.manager import Manager
    mgr = (await db.execute(
        select(Manager).where(Manager.telegram_id == telegram_id, Manager.is_active == True)
    )).scalar_one_or_none()
    if mgr:
        return mgr.name, "manager"
    from app.services.tg_notify import get_all_admin_ids as _gaa
    if telegram_id in await _gaa(db):
        admin_user = (await db.execute(
            select(User).where(User.telegram_id == telegram_id)
        )).scalar_one_or_none()
        return (admin_user.name if admin_user else None), "admin"
    return None, None


@router.patch("/{order_id}/change_courier")
async def change_courier(order_id: int, body: ChangeCourierBody,
                         db: AsyncSession = Depends(get_db)):
    """Reassign an already-assigned order to a different courier (admin/manager only).
    Removes the order from the old courier, notifies the new courier + client, and
    records who changed the courier for the staff order card."""
    order = await _get_order(order_id, db)
    if order.courier_id is None:
        raise HTTPException(status_code=400, detail="Order has no courier to change")
    if order.status not in (OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.IN_DELIVERY):
        raise HTTPException(status_code=400, detail="Courier can only be changed before delivery")
    new_courier = (await db.execute(
        select(Courier).where(Courier.id == body.courier_id)
    )).scalar_one_or_none()
    if not new_courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    if new_courier.id == order.courier_id:
        raise HTTPException(status_code=400, detail="Same courier already assigned")

    # Capture everything BEFORE commit (attributes expire after commit)
    old_courier_name = order.courier.name if order.courier else (order.previous_courier_name or "—")
    old_courier_tg = order.courier.telegram_id if order.courier else None
    old_courier_msg_id = order.courier_status_msg_id

    client_tg = order.user.telegram_id if order.user else None
    client_name = (order.user.name if order.user else None) or "—"
    old_client_msg_id = order.client_status_msg_id
    notification_msg_ids = order.notification_msg_ids
    _items_data = [(i.product, i.quantity) for i in order.items if i.product]
    _ret_cnt = order.return_bottles_count or 0
    _lent_cnt = order.bottles_lent or 0
    _surcharge = order.bottle_surcharge or 0.0
    _qty19 = sum(q for p, q in _items_data if p.has_bottle_deposit)
    _missing = max(0, _qty19 - _ret_cnt)
    _snum = f"{int(_surcharge):,}".replace(",", " ")
    _bullet_lines = [f"  • {p.name} {q} шт." for p, q in _items_data]
    if _surcharge > 0 and _missing > 0:
        _bullet_lines.append(f"  • Невозвращённые бутылки {_missing} шт. — +{_snum} сум")
    items_bullets = "\n".join(_bullet_lines) or "—"
    order_address = order.address
    order_phone = order.recipient_phone
    order_total = int(order.total)
    order_payment = order.payment_method or "cash"
    order_creator_role = order.creator_role
    order_creator_name = order.creator_name or (order.agent.name if order.creator_role == "agent" and order.agent else None)
    order_assigner_name = order.assigner_name
    order_assigner_role = order.assigner_role or ""
    new_courier_name = new_courier.name
    new_courier_phone = new_courier.phone or ""
    new_courier_tg = new_courier.telegram_id
    oid = order.id

    # Resolve who is making the change
    changer_name = body.changer_name
    changer_role = body.changer_role
    if body.manager_telegram_id and not changer_name:
        changer_name, changer_role = await _resolve_staff_identity(db, body.manager_telegram_id)

    cfg = await get_all_settings(db)
    eta_hours = float(cfg.get("delivery_eta_hours") or 2)

    order.previous_courier_name = old_courier_name
    order.courier_changed_by = changer_name
    order.courier_changed_by_role = changer_role
    order.courier_id = new_courier.id
    order.status = OrderStatus.ASSIGNED_TO_COURIER
    order.delivery_expected_at = datetime.utcnow() + timedelta(hours=eta_hours)
    order.delivery_reminder_sent = False
    order.delivery_reminder_2_sent = False
    await db.commit()

    # ── Old courier: delete their order card + short note ──────────────────────
    if old_courier_tg:
        if old_courier_msg_id:
            await _tg_delete_message(old_courier_tg, old_courier_msg_id)
        await _tg(old_courier_tg,
                  f"🔄 Заказ {order_address} на {order_total:,} сум переназначен другому курьеру.")

    # ── New courier: assignment notification ───────────────────────────────────
    from app.config import settings as _cfg_cc
    _site_url_cc = _cfg_cc.MINI_APP_URL.rstrip("/") + "/courier/map"
    _client_id_cc = f"{client_name}  |  {order_phone}" if client_name and client_name != "—" else order_phone
    _ret_line_c = f"\n♻️ Возврат бутылок: {_ret_cnt} шт." if _ret_cnt else ""
    _lent_line_c = f"\n📦 Одолжить: {_lent_cnt} шт." if _lent_cnt else ""
    _pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
    pay_label_str = _pay_labels.get(order_payment, order_payment)
    courier_text = (
        f"🚴 <b>Вам назначен заказ!</b>\n\n"
        f"👤 {_client_id_cc}\n"
        f"📍 {order_address}\n\n"
        f"Товары:\n{items_bullets}\n"
        f"💰 {order_total:,} сум  |  {pay_label_str}"
        f"{_ret_line_c}{_lent_line_c}"
    )
    _kb_rows = [
        [{"text": "🗺 Карта заказов", "web_app": {"url": _site_url_cc}}],
        [{"text": "🚴 В пути", "callback_data": f"courier:in_delivery:{oid}"}],
        [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
    ]
    c_msg_id = await _tg_send(new_courier_tg, courier_text, {"inline_keyboard": _kb_rows}, parse_mode="HTML")
    if c_msg_id:
        await db.execute(sa_update(Order).where(Order.id == oid).values(courier_status_msg_id=c_msg_id))
        await db.commit()

    # ── Client: delete old courier notice + send new one ───────────────────────
    if client_tg:
        if old_client_msg_id:
            await _tg_delete_message(client_tg, old_client_msg_id)
        _phone_line = f"\nТелефон курьера: {new_courier_phone}" if new_courier_phone else ""
        text = f"🚴 Вам назначен новый курьер {new_courier_name}!\nОжидайте доставку.{_phone_line}"
        new_msg_id = await _tg_send(client_tg, text)
        if new_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

    # ── Staff cards: old → new + who changed ───────────────────────────────────
    _ROLE_LABELS_SYNC = {"manager": "Менеджер", "admin": "Администратор", "courier": "Курьер", "agent": "Агент"}
    c_phone_part = f"  |  {new_courier_phone}" if new_courier_phone else ""
    if order_creator_role:
        _cr_label = _ROLE_LABELS_SYNC.get(order_creator_role, order_creator_role.capitalize())
        _creator_line = f"\n✍️ Создал заказ: {_cr_label} {order_creator_name}" if order_creator_name else f"\n✍️ Создал заказ: {_cr_label}"
    else:
        _client_label = client_name if client_name and client_name != "—" else "Клиент"
        _creator_line = f"\n✍️ Создал заказ: Клиент {_client_label}"
    if order_assigner_name:
        _asgn_role_lbl = _ROLE_LABELS_SYNC.get(order_assigner_role, "") if order_assigner_role else ""
        _assigner_line = f"\n👤 Назначил курьера: {_asgn_role_lbl} {order_assigner_name}".rstrip()
    else:
        _assigner_line = ""
    _chg_role_lbl = _ROLE_LABELS_SYNC.get(changer_role or "", "") if changer_role else ""
    _change_line = f"\n🔁 Курьер изменён: {old_courier_name} → {new_courier_name}"
    if changer_name:
        _change_line += f"\n✏️ Изменил курьера: {_chg_role_lbl} {changer_name}".rstrip()
    _ret_line = f"\n♻️ Возврат бутылок: {_ret_cnt} шт." if _ret_cnt else ""
    _lent_line = f"\n📦 Одолжить: {_lent_cnt} шт." if _lent_cnt else ""
    _surcharge_line = f"\n💰 Надбавка за невозврат: {int(_surcharge):,} сум" if _surcharge > 0 else ""
    sync_text = (
        f"✅ Курьер {new_courier_name} назначен\n\n"
        f"👤 {client_name}  |  {order_phone}\n"
        f"📍 {order_address}\n\n"
        f"Товары:\n{items_bullets}\n"
        f"💰 {order_total:,} сум  |  {pay_label_str}"
        f"{_ret_line}{_lent_line}{_surcharge_line}"
        f"{_creator_line}\n"
        f"🚴 {new_courier_name}{c_phone_part}"
        f"{_assigner_line}{_change_line}"
    )
    from app.services.tg_notify import edit_all_notifications
    _staff_kb = {"inline_keyboard": [
        [{"text": "🔁 Изменить курьера", "callback_data": f"order:reassign:{oid}"}],
        [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
        [{"text": "❌ Отменить заказ", "callback_data": f"order:cancel:{oid}"}],
    ]}
    await edit_all_notifications(notification_msg_ids, sync_text, reply_markup=_staff_kb)

    return {"ok": True}


@router.patch("/{order_id}/in_delivery")
async def start_delivery(order_id: int, from_bot: bool = False, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status == OrderStatus.IN_DELIVERY:
        return {"ok": True}
    order.status = OrderStatus.IN_DELIVERY

    client_tg = order.user.telegram_id if order.user else None
    client_name = (order.user.name if order.user else None) or "—"
    old_msg_id = order.client_status_msg_id
    notification_msg_ids = order.notification_msg_ids
    oid = order.id
    order_address = order.address
    order_phone = order.recipient_phone
    order_total = int(order.total)
    order_payment = order.payment_method or "cash"
    order_creator_role = order.creator_role
    order_creator_name = order.creator_name or (order.agent.name if order.creator_role == "agent" and order.agent else None)
    order_assigner_name = order.assigner_name
    order_assigner_role = order.assigner_role or ""
    _ret_cnt_dl = order.return_bottles_count or 0
    _lent_cnt_dl = order.bottles_lent or 0
    _surcharge_dl = order.bottle_surcharge or 0.0
    _items_data_dl = [(i.product, i.quantity) for i in order.items if i.product]
    _qty19_dl = sum(q for p, q in _items_data_dl if p.has_bottle_deposit)
    _missing_dl = max(0, _qty19_dl - _ret_cnt_dl)
    _snum_dl = f"{int(_surcharge_dl):,}".replace(",", " ")
    _bullet_lines_dl = [f"  • {p.name} {q} шт." for p, q in _items_data_dl]
    if _surcharge_dl > 0 and _missing_dl > 0:
        _bullet_lines_dl.append(f"  • Невозвращённые бутылки {_missing_dl} шт. — +{_snum_dl} сум")
    items_bullets_dl = "\n".join(_bullet_lines_dl) or "—"

    courier_name = ""
    courier_phone = ""
    if order.courier_id:
        c_q = await db.execute(select(Courier).where(Courier.id == order.courier_id))
        c = c_q.scalar_one_or_none()
        if c:
            courier_name = c.name
            courier_phone = c.phone or ""

    await db.commit()

    _pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
    pay_label_str_dl = _pay_labels.get(order_payment, order_payment)
    c_phone_part_dl = f"  |  {courier_phone}" if courier_phone else ""
    _ROLE_LABELS_DL = {"manager": "Менеджер", "admin": "Администратор", "courier": "Курьер", "agent": "Агент"}
    if order_creator_role:
        _cr_lbl_dl = _ROLE_LABELS_DL.get(order_creator_role, order_creator_role.capitalize())
        _creator_line_dl = f"\n✍️ Создал заказ: {_cr_lbl_dl} {order_creator_name}" if order_creator_name else f"\n✍️ Создал заказ: {_cr_lbl_dl}"
    else:
        _creator_line_dl = f"\n✍️ Создал заказ: Клиент {client_name}"
    if order_assigner_name:
        _asgn_role_dl = _ROLE_LABELS_DL.get(order_assigner_role, "") if order_assigner_role else ""
        _assigner_line_dl = f"\n👤 Назначил курьера: {_asgn_role_dl} {order_assigner_name}".rstrip()
    elif order_creator_role in ("manager", "admin") and order_creator_name:
        _cr_asgn_dl = _ROLE_LABELS_DL.get(order_creator_role, order_creator_role.capitalize())
        _assigner_line_dl = f"\n👤 Назначил курьера: {_cr_asgn_dl} {order_creator_name}"
    else:
        _assigner_line_dl = ""
    _ret_line_dl = f"\n♻️ Возврат бутылок: {_ret_cnt_dl} шт." if _ret_cnt_dl else ""
    _lent_line_dl = f"\n📦 Одолжить: {_lent_cnt_dl} шт." if _lent_cnt_dl else ""
    _surcharge_line_dl = f"\n💰 Надбавка за невозврат: {int(_surcharge_dl):,} сум" if _surcharge_dl > 0 else ""
    dl_staff_text = (
        f"🚴 Курьер {courier_name} в пути\n\n"
        f"👤 {client_name}  |  {order_phone}\n"
        f"📍 {order_address}\n\n"
        f"Товары:\n{items_bullets_dl}\n"
        f"💰 {order_total:,} сум  |  {pay_label_str_dl}"
        f"{_ret_line_dl}{_lent_line_dl}{_surcharge_line_dl}"
        f"{_creator_line_dl}\n"
        f"🚴 {courier_name}{c_phone_part_dl}"
        f"{_assigner_line_dl}"
    )
    _dl_kb = {"inline_keyboard": [
        [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
        [{"text": "❌ Отменить заказ", "callback_data": f"order:cancel:{oid}"}],
    ]}
    from app.services.tg_notify import edit_all_notifications
    await edit_all_notifications(notification_msg_ids, dl_staff_text, reply_markup=_dl_kb)

    if not from_bot:
        text = f"🚴 Курьер {courier_name} выехал к вам!" if courier_name else "🚴 Курьер выехал к вам!"
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

    return {"ok": True}


class DeliveredBody(BaseModel):
    cash_collected: bool = False


@router.patch("/{order_id}/delivered")
async def mark_delivered(order_id: int, body: DeliveredBody = DeliveredBody(), from_bot: bool = False,
                         db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    already_delivered = order.status == OrderStatus.DELIVERED

    client_tg = order.user.telegram_id if order.user else None
    client_name_dv = (order.user.name if order.user else None) or "—"
    old_msg_id = order.client_status_msg_id
    notification_msg_ids_dv = order.notification_msg_ids
    items = _order_items_text(order.items)
    oid = order.id
    bonus = 0.0
    order_address_dv = order.address
    order_phone_dv = order.recipient_phone
    order_total_dv = int(order.total)
    order_payment_dv = order.payment_method or "cash"
    order_creator_role_dv = order.creator_role
    order_creator_name_dv = order.creator_name or (order.agent.name if order.creator_role == "agent" and order.agent else None)
    order_assigner_name_dv = order.assigner_name
    order_assigner_role_dv = order.assigner_role or ""
    _ret_cnt_dv = order.return_bottles_count or 0
    _lent_cnt_dv = order.bottles_lent or 0
    _surcharge_dv = order.bottle_surcharge or 0.0
    _items_data_dv = [(i.product, i.quantity) for i in order.items if i.product]
    _qty19_dv = sum(q for p, q in _items_data_dv if p.has_bottle_deposit)
    _missing_dv = max(0, _qty19_dv - _ret_cnt_dv)
    _snum_dv = f"{int(_surcharge_dv):,}".replace(",", " ")
    _bullet_lines_dv = [f"  • {p.name} {q} шт." for p, q in _items_data_dv]
    if _surcharge_dv > 0 and _missing_dv > 0:
        _bullet_lines_dv.append(f"  • Невозвращённые бутылки {_missing_dv} шт. — +{_snum_dv} сум")
    items_bullets_dv = "\n".join(_bullet_lines_dv) or "—"
    courier_name_dv = ""
    courier_phone_dv = ""
    if order.courier:
        courier_name_dv = order.courier.name
        courier_phone_dv = order.courier.phone or ""

    if not already_delivered:
        order.status = OrderStatus.DELIVERED
        order.delivered_at = datetime.utcnow()
        order.cash_collected = body.cash_collected

        result = await db.execute(select(User).where(User.id == order.user_id))
        user = result.scalar_one_or_none()
        if user:
            cfg = await get_all_settings(db)
            # Per-bottle bonus (ТЗ: N сум за каждую 19л бутылку)
            bonus_per_bottle = float(cfg.get("bonus_per_bottle") or 0)
            bottles_in_order = sum(
                i.quantity for i in order.items if i.product and i.product.has_bottle_deposit
            )
            if bonus_per_bottle > 0 and bottles_in_order > 0:
                bonus = bonus_per_bottle * bottles_in_order
            else:
                # Fallback: cashback % от суммы заказа
                cashback_pct = float(cfg.get("cashback_percent") or 5)
                bonus = order.total * cashback_pct / 100.0
            user.bonus_points += bonus
            # Reset bonus expiry on award
            expiry_days = int(cfg.get("bonus_expiry_days") or 0)
            if expiry_days > 0:
                from datetime import timedelta
                user.bonus_expires_at = datetime.utcnow() + timedelta(days=expiry_days)

        # Track 19L bottle debt: delivered + lent bottles increase debt, returned reduce it.
        bottles_delivered = sum(
            i.quantity for i in order.items
            if i.product and i.product.has_bottle_deposit
        )
        returned = order.return_bottles_count or 0
        lent = order.bottles_lent or 0
        net_change = bottles_delivered + lent - returned
        if (bottles_delivered > 0 or lent > 0 or returned > 0) and user:
            debt_q = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user.id))
            debt_row = debt_q.scalar_one_or_none()
            if debt_row:
                debt_row.count = max(0, debt_row.count + net_change)
            else:
                if net_change > 0:
                    db.add(BottleDebt(user_id=user.id, count=net_change))

        if order.courier_id:
            result = await db.execute(select(Courier).where(Courier.id == order.courier_id))
            courier = result.scalar_one_or_none()
            if courier:
                courier.total_deliveries += 1

        await _release_inventory(order, db, consume=True)

        # Courier bottle debt adjustment: net bottles that stayed with client
        # positive net_change = client kept bottles → courier owes fewer to warehouse
        if order.courier_id and net_change != 0 and bottles_delivered > 0:
            from app.models.warehouse import WaterTransaction as WT
            db.add(WT(
                courier_id=order.courier_id,
                order_id=order.id,
                transaction_type="delivery_net",
                quantity=net_change,
                note=f"Доставка заказа #{order.id}: выдано {bottles_delivered}, возврат {returned}, одолжено {lent}",
            ))

        await db.commit()

    if not already_delivered:
        _pay_labels_dv = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
        pay_label_str_dv = _pay_labels_dv.get(order_payment_dv, order_payment_dv)
        c_phone_part_dv = f"  |  {courier_phone_dv}" if courier_phone_dv else ""
        _ROLE_LABELS_DV = {"manager": "Менеджер", "admin": "Администратор", "courier": "Курьер", "agent": "Агент"}
        if order_creator_role_dv:
            _cr_lbl_dv = _ROLE_LABELS_DV.get(order_creator_role_dv, order_creator_role_dv.capitalize())
            _creator_line_dv = f"\n✍️ Создал заказ: {_cr_lbl_dv} {order_creator_name_dv}" if order_creator_name_dv else f"\n✍️ Создал заказ: {_cr_lbl_dv}"
        else:
            _creator_line_dv = f"\n✍️ Создал заказ: Клиент {client_name_dv}"
        if order_assigner_name_dv:
            _asgn_role_dv = _ROLE_LABELS_DV.get(order_assigner_role_dv, "") if order_assigner_role_dv else ""
            _assigner_line_dv = f"\n👤 Назначил курьера: {_asgn_role_dv} {order_assigner_name_dv}".rstrip()
        elif order_creator_role_dv in ("manager", "admin") and order_creator_name_dv:
            _cr_asgn_dv = _ROLE_LABELS_DV.get(order_creator_role_dv, order_creator_role_dv.capitalize())
            _assigner_line_dv = f"\n👤 Назначил курьера: {_cr_asgn_dv} {order_creator_name_dv}"
        else:
            _assigner_line_dv = ""
        _ret_line_dv = f"\n♻️ Возврат бутылок: {_ret_cnt_dv} шт." if _ret_cnt_dv else ""
        _lent_line_dv = f"\n📦 Одолжить: {_lent_cnt_dv} шт." if _lent_cnt_dv else ""
        _surcharge_line_dv = f"\n💰 Надбавка за невозврат: {int(_surcharge_dv):,} сум" if _surcharge_dv > 0 else ""
        dv_staff_text = (
            f"✔️ Доставлено\n\n"
            f"👤 {client_name_dv}  |  {order_phone_dv}\n"
            f"📍 {order_address_dv}\n\n"
            f"Товары:\n{items_bullets_dv}\n"
            f"💰 {order_total_dv:,} сум  |  {pay_label_str_dv}"
            f"{_ret_line_dv}{_lent_line_dv}{_surcharge_line_dv}"
            f"{_creator_line_dv}\n"
            f"🚴 {courier_name_dv}{c_phone_part_dv}"
            f"{_assigner_line_dv}"
        )
        from app.services.tg_notify import delete_all_notifications
        await delete_all_notifications(notification_msg_ids_dv)

    if not from_bot and not already_delivered:
        bonus_txt = f"\n🎁 Начислено {int(bonus):,} сум бонусных баллов!" if bonus > 0 else ""
        text = f"✅ Ваш заказ доставлен!{bonus_txt}"
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)
        review_kb = {"inline_keyboard": [[
            {"text": f"{i}⭐", "callback_data": f"review:{oid}:{i}"} for i in range(1, 6)
        ]]}
        await _tg_send(client_tg, "Пожалуйста, оцените качество доставки:", review_kb)

    return {"ok": True, "bonus": round(bonus, 2)}


class PaymentIssueBody(BaseModel):
    reason: str = ""
    payment_method: str = "cash"
    courier_name: str = ""


@router.post("/{order_id}/payment_issue")
async def report_payment_issue(order_id: int, body: PaymentIssueBody, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    courier_name = body.courier_name or (order.courier.name if order.courier else "")
    client_phone = order.recipient_phone or (order.user.phone if order.user else "")
    client_name = order.user.name if order.user else ""
    pay_label = "наличные" if body.payment_method == "cash" else "чек оплаты по карте"
    total_fmt = f"{int(order.total):,}".replace(",", " ")
    text = (
        f"⚠️ Курьер {courier_name} не подтвердил {pay_label}\n"
        f"Клиент: {client_name + ' ' if client_name else ''}{client_phone}\n"
        f"Адрес: {order.address}\n"
        f"Сумма: {total_fmt} сум\n"
        f"Причина: {body.reason or '—'}"
    )
    await _notify_admins(db, text)
    return {"ok": True}


class PaymentCollectedBody(BaseModel):
    collected: bool = True


@router.patch("/{order_id}/payment_collected")
async def set_payment_collected(order_id: int, body: PaymentCollectedBody,
                                db: AsyncSession = Depends(get_db)):
    """Record whether courier collected payment. Deletes the pending bot payment prompt if any."""
    order = await _get_order(order_id, db)
    order.payment_collected = body.collected

    # Delete the bot payment-prompt message if we know its id
    prompt_msg_id = order.payment_prompt_msg_id
    courier_tg = order.courier.telegram_id if order.courier else None

    await db.commit()

    if prompt_msg_id and courier_tg:
        await _tg_delete_message(courier_tg, prompt_msg_id)

    return {"ok": True}


class PaymentPromptBody(BaseModel):
    message_id: int


@router.post("/{order_id}/payment_prompt")
async def store_payment_prompt(order_id: int, body: PaymentPromptBody,
                               db: AsyncSession = Depends(get_db)):
    """Store the Telegram message_id of the bot's payment prompt so it can be deleted later."""
    from sqlalchemy import update as sa_update
    await db.execute(sa_update(Order).where(Order.id == order_id)
                     .values(payment_prompt_msg_id=body.message_id))
    await db.commit()
    return {"ok": True}


@router.patch("/{order_id}/courier_accept")
async def courier_accept(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status in (OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.CONFIRMED):
        order.status = OrderStatus.IN_DELIVERY
        await db.commit()
    return {"ok": True}


@router.get("/courier/{telegram_id}", response_model=list[OrderOut])
async def get_courier_orders(telegram_id: int, db: AsyncSession = Depends(get_db)):
    courier_q = await db.execute(select(Courier).where(Courier.telegram_id == telegram_id))
    courier = courier_q.scalar_one_or_none()
    if not courier:
        return []
    result = await db.execute(
        select(Order)
        .where(Order.courier_id == courier.id)
        .options(*_order_opts())
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.post("/reviews/")
async def create_review(data: ReviewCreate, db: AsyncSession = Depends(get_db)):
    # Idempotent: update existing review if one already exists for this order.
    # Review.order_id is UNIQUE, so concurrent submits would otherwise hit
    # an IntegrityError and 500 — handle both racing paths the same way.
    if data.order_id:
        existing_q = await db.execute(select(Review).where(Review.order_id == data.order_id))
        existing = existing_q.scalar_one_or_none()
        if existing:
            existing.rating = data.rating
            existing.comment = data.comment
            await db.commit()
            return {"ok": True, "id": existing.id}

    order = None
    if data.order_id:
        order_q = await db.execute(
            select(Order).where(Order.id == data.order_id).options(*_order_opts())
        )
        order = order_q.scalar_one_or_none()

    courier_id = data.courier_id or (order.courier_id if order else None)
    review = Review(
        order_id=data.order_id,
        user_id=data.user_id or (order.user_id if order else None),
        courier_id=courier_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)

    # Update courier average rating
    if courier_id:
        courier_q = await db.execute(select(Courier).where(Courier.id == courier_id))
        courier = courier_q.scalar_one_or_none()
        if courier:
            old_count = courier.rating_count or 0
            old_avg = courier.avg_rating or 0.0
            new_count = old_count + 1
            courier.avg_rating = (old_avg * old_count + data.rating) / new_count
            courier.rating_count = new_count

    try:
        await db.commit()
    except Exception:
        # Concurrent insert won the race — fall back to the existing row.
        await db.rollback()
        existing_q = await db.execute(select(Review).where(Review.order_id == data.order_id))
        existing = existing_q.scalar_one_or_none()
        if existing:
            existing.rating = data.rating
            existing.comment = data.comment
            await db.commit()
            return {"ok": True, "id": existing.id}
        raise HTTPException(status_code=409, detail="Review conflict")
    await db.refresh(review)
    return {"ok": True, "id": review.id}


class ReviewCommentUpdate(BaseModel):
    comment: str


@router.patch("/reviews/by_order/{order_id}/comment")
async def update_review_comment(order_id: int, body: ReviewCommentUpdate,
                                db: AsyncSession = Depends(get_db)):
    """Add/update comment on an existing review without re-notifying admins."""
    result = await db.execute(select(Review).where(Review.order_id == order_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.comment = body.comment
    await db.commit()
    return {"ok": True}


_REVIEW_UPLOAD_DIR = Path("static/reviews")
_ALLOWED_IMG = {".jpg", ".jpeg", ".png", ".webp"}


@router.post("/reviews/{review_id}/upload_photo")
async def upload_review_photo(review_id: int, file: UploadFile = File(...),
                               db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    _REVIEW_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if suffix not in _ALLOWED_IMG:
        suffix = ".jpg"
    filename = f"{uuid.uuid4().hex}{suffix}"
    content = await file.read()
    (_REVIEW_UPLOAD_DIR / filename).write_bytes(content)

    review.photo_url = f"/static/reviews/{filename}"
    await db.commit()
    return {"ok": True, "photo_url": review.photo_url}


@router.get("/reviews/")
async def list_reviews(
    approved_only: bool = False,
    rating: int | None = None,
    courier_id: int | None = None,
    user_id: int | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Review)
        .options(
            selectinload(Review.user),
            selectinload(Review.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Review.order).selectinload(Order.courier),
        )
        .order_by(Review.id.desc())
    )
    if approved_only:
        q = q.where(Review.is_approved == True)
    if rating:
        q = q.where(Review.rating == rating)
    if courier_id:
        q = q.where(Review.courier_id == courier_id)
    if user_id:
        q = q.where(Review.user_id == user_id)
    if from_date:
        try:
            q = q.where(Review.created_at >= datetime.fromisoformat(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.where(Review.created_at <= datetime.fromisoformat(to_date + "T23:59:59"))
        except ValueError:
            pass
    result = await db.execute(q)
    reviews = result.scalars().all()
    out = []
    for r in reviews:
        order = r.order
        courier = order.courier if order else None
        out.append({
            "id": r.id,
            "order_id": r.order_id,
            "user_id": r.user_id,
            "courier_id": r.courier_id,
            "rating": r.rating,
            "comment": r.comment,
            "photo_url": r.photo_url,
            "is_approved": r.is_approved,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            # Enriched fields
            "client_name": r.user.name if r.user else None,
            "client_phone": r.user.phone if r.user else None,
            "courier_name": courier.name if courier else None,
            "courier_phone": courier.phone if courier else None,
            "order_total": order.total if order else None,
            "order_address": order.address if order else None,
            "order_items": _order_items_text(order.items) if order else None,
            "order_delivered_at": order.delivered_at.isoformat() if order and order.delivered_at else None,
        })
    return out


@router.patch("/reviews/{review_id}/approve")
async def approve_review(review_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = True
    await db.commit()
    return {"ok": True}


@router.patch("/reviews/{review_id}/hide")
async def hide_review(review_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = False
    await db.commit()
    return {"ok": True}


class CancelRequestBody(BaseModel):
    reason: str = ""


@router.post("/{order_id}/request_cancellation")
async def request_cancellation(order_id: int, body: CancelRequestBody = CancelRequestBody(),
                                db: AsyncSession = Depends(get_db)):
    """Client requests order cancellation. Sets status to CANCELLATION_REQUESTED."""
    order = await _get_order(order_id, db)
    if order.status in (OrderStatus.DELIVERED, OrderStatus.REJECTED):
        raise HTTPException(status_code=409, detail="Order already finalized")
    if order.status == OrderStatus.CANCELLATION_REQUESTED:
        return {"ok": True}

    order.cancellation_reason = body.reason
    order.status = OrderStatus.CANCELLATION_REQUESTED

    client_tg = order.user.telegram_id if order.user else None
    items = _order_items_text(order.items)
    oid = order.id

    await db.commit()

    reason_part = f"\nПричина: {body.reason}" if body.reason else ""
    await _notify_admins(db, f"⚠️ Клиент запросил отмену заказа #{oid}\n{items}{reason_part}")

    if client_tg:
        await _tg(client_tg,
                  f"⏳ Запрос на отмену заказа #{oid} отправлен.\n"
                  "Ожидайте подтверждения от оператора.")
    return {"ok": True}


@router.post("/{order_id}/confirm_cancellation")
async def confirm_cancellation(order_id: int, db: AsyncSession = Depends(get_db)):
    """Admin confirms the client's cancellation request. Applies penalty if courier was assigned."""
    order = await _get_order(order_id, db)
    if order.status != OrderStatus.CANCELLATION_REQUESTED:
        raise HTTPException(status_code=409, detail="No pending cancellation request")

    client_tg = order.user.telegram_id if order.user else None
    items = _order_items_text(order.items)
    oid = order.id
    penalty = 0.0

    # Penalty: if courier was already assigned, deduct % of order total from bonuses
    courier_was_assigned = order.courier_id is not None
    if courier_was_assigned:
        result = await db.execute(select(User).where(User.id == order.user_id))
        user = result.scalar_one_or_none()
        if user:
            cfg = await get_all_settings(db)
            penalty_pct = float(cfg.get("cancellation_penalty_pct") or 10)
            penalty = round(order.total * penalty_pct / 100.0, 2)
            penalty = min(penalty, float(user.bonus_points or 0))
            user.bonus_points = max(0.0, user.bonus_points - penalty)
            order.cancellation_penalty = penalty

    if courier_was_assigned:
        await _release_inventory(order, db, consume=False)
    order.status = OrderStatus.REJECTED

    await db.commit()

    bonus_line = f"\n⚠️ Штраф: {int(penalty):,} бонусов списано" if penalty > 0 else ""
    if client_tg:
        await _tg(client_tg, f"✅ Отмена заказа #{oid} подтверждена.{bonus_line}\n{items}")
    return {"ok": True, "penalty": penalty}


@router.post("/{order_id}/reject_cancellation")
async def reject_cancellation(order_id: int, db: AsyncSession = Depends(get_db)):
    """Admin rejects the cancellation request — order returns to previous active status."""
    order = await _get_order(order_id, db)
    if order.status != OrderStatus.CANCELLATION_REQUESTED:
        raise HTTPException(status_code=409, detail="No pending cancellation request")

    # Restore to last sensible active status
    order.status = (
        OrderStatus.ASSIGNED_TO_COURIER if order.courier_id else OrderStatus.CONFIRMED
    )
    client_tg = order.user.telegram_id if order.user else None
    oid = order.id
    await db.commit()

    if client_tg:
        await _tg(client_tg,
                  f"❌ Запрос на отмену заказа #{oid} отклонён.\n"
                  "Заказ продолжает выполняться. Свяжитесь с оператором при вопросах.")
    return {"ok": True}


@router.get("/{order_id}/queue_position")
async def get_queue_position(order_id: int, db: AsyncSession = Depends(get_db)):
    """Return per-stage queue count and a stage-specific message."""
    order_q = await db.execute(select(Order).where(Order.id == order_id))
    order = order_q.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    status = order.status

    # Map status → which statuses to count as "same stage"
    stage_statuses = {
        OrderStatus.AWAITING_CONFIRMATION: [OrderStatus.AWAITING_CONFIRMATION],
        OrderStatus.CONFIRMED: [OrderStatus.AWAITING_CONFIRMATION, OrderStatus.CONFIRMED],
        OrderStatus.NEW: [OrderStatus.NEW, OrderStatus.AWAITING_CONFIRMATION, OrderStatus.CONFIRMED],
        OrderStatus.ASSIGNED_TO_COURIER: [OrderStatus.ASSIGNED_TO_COURIER],
        OrderStatus.IN_DELIVERY: [OrderStatus.IN_DELIVERY],
    }
    stage_msgs = {
        OrderStatus.AWAITING_CONFIRMATION: "ожидают подтверждения",
        OrderStatus.CONFIRMED: "ожидают назначения курьера",
        OrderStatus.NEW: "заказов в очереди",
        OrderStatus.ASSIGNED_TO_COURIER: "ожидают начала доставки",
        OrderStatus.IN_DELIVERY: "ожидают завершения доставки",
    }

    count_statuses = stage_statuses.get(status)
    if not count_statuses:
        return {"order_id": order_id, "queue_position": 0, "message": None}

    count_q = await db.execute(
        select(Order.id).where(
            Order.status.in_(count_statuses),
            Order.created_at < order.created_at,
            Order.id != order_id,
        )
    )
    position = len(count_q.all())
    msg_suffix = stage_msgs.get(status, "")

    if position == 0:
        message = "Ваш заказ следующий в очереди!"
    else:
        n = position
        if n % 10 == 1 and n % 100 != 11:
            word = "заказ"
        elif 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
            word = "заказа"
        else:
            word = "заказов"
        message = f"В очереди: {n} {word} {msg_suffix} впереди вас"

    return {"order_id": order_id, "queue_position": position, "message": message}


@router.post("/{order_id}/repeat")
async def repeat_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Return items + delivery details of an existing order, ready to populate a new cart and pre-fill checkout."""
    order = await _get_order(order_id, db)
    return {
        "items": [
            {
                "product_id": i.product_id,
                "quantity": i.quantity,
                "price": i.price,
                "product_name": i.product.name if i.product else None,
                "volume": float(getattr(i.product, "volume", 0) or 0) if i.product else 0,
            }
            for i in order.items
        ],
        "address": order.address,
        "extra_info": order.extra_info,
        "recipient_phone": order.recipient_phone,
        "latitude": order.latitude,
        "longitude": order.longitude,
        "delivery_time": order.delivery_time.isoformat() if order.delivery_time else None,
        "return_bottles_count": order.return_bottles_count or 0,
        "bottles_lent": order.bottles_lent or 0,
        "return_bottles_volume": order.return_bottles_volume,
        "bottle_discount": order.bottle_discount or 0,
    }


class LocationBody(BaseModel):
    latitude: float
    longitude: float


class UpdateItemsBody(BaseModel):
    items: list[dict]  # [{product_id: int, quantity: int}]
    return_bottles_count: int = 0
    bottles_lent: int = 0
    courier_name: str | None = None


@router.patch("/{order_id}/items")
async def update_order_items(order_id: int, body: UpdateItemsBody, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete as sa_delete
    from app.services.tg_notify import edit_all_notifications

    effective_items = [it for it in body.items if int(it.get("quantity", 0)) > 0 and it.get("product_id")]
    if not effective_items:
        raise HTTPException(status_code=422, detail="items list cannot be empty")

    order = await _get_order(order_id, db)

    # Capture ALL metadata before commit expires relationships
    client_tg = order.user.telegram_id if order.user else None
    client_name = (order.user.name if order.user else None) or "—"
    old_client_msg_id = order.client_status_msg_id
    order_status = order.status
    notification_msg_ids = order.notification_msg_ids
    oid = order.id
    order_address = order.address or "—"
    order_phone = order.recipient_phone or "—"
    order_payment = order.payment_method or "cash"
    order_creator_role = order.creator_role
    order_creator_name = order.creator_name or (
        order.agent.name if order.creator_role == "agent" and order.agent else None
    )
    order_assigner_name = order.assigner_name
    order_assigner_role = order.assigner_role or ""
    _courier = order.courier
    courier_name = _courier.name if _courier else None
    courier_phone = (_courier.phone or "") if _courier else ""
    courier_tg = _courier.telegram_id if _courier else None
    courier_status_msg = order.courier_status_msg_id
    order_lat = order.latitude
    order_lng = order.longitude
    order_note = order.extra_info
    order_creator_role_raw = order.creator_role
    order_delivery_time = order.delivery_time or "—"
    order_manager_phone = order.manager_phone or ""

    # Snapshot old state for diff
    _old_items_map: dict[int, tuple[str, int]] = {
        oi.product_id: (oi.product.name if oi.product else f"Товар {oi.product_id}", oi.quantity)
        for oi in order.items
    }
    _old_return = order.return_bottles_count or 0
    _old_lent = order.bottles_lent or 0

    # Rebuild items
    await db.execute(sa_delete(OrderItem).where(OrderItem.order_id == order_id))
    await db.flush()

    subtotal = 0.0
    items_data: list = []
    for it in body.items:
        qty = int(it.get("quantity", 0))
        pid = it.get("product_id")
        if qty > 0 and pid:
            prod_q = await db.execute(select(Product).where(Product.id == pid))
            prod = prod_q.scalar_one_or_none()
            if prod:
                subtotal += prod.price * qty
                db.add(OrderItem(order_id=order_id, product_id=prod.id, quantity=qty, price=prod.price))
                items_data.append((prod, qty))

    settings_cfg = await get_all_settings(db)
    bottle_surcharge = calc_bottle_surcharge(items_data, body.return_bottles_count, settings_cfg, body.bottles_lent)

    # Compute diff between old and new composition
    import json as _json_mod
    _new_items_map: dict[int, tuple[str, int]] = {prod.id: (prod.name, qty) for prod, qty in items_data}
    _diff_entries: list[dict] = []
    for _pid in sorted(set(_old_items_map) | set(_new_items_map)):
        _oname, _oqty = _old_items_map.get(_pid, ("", 0))
        _nname, _nqty = _new_items_map.get(_pid, ("", 0))
        if _oqty != _nqty:
            _diff_entries.append({"name": _nname or _oname, "old": _oqty, "new": _nqty})
    if _old_return != body.return_bottles_count:
        _diff_entries.append({"name": "♻️ Возврат бутылок", "old": _old_return, "new": body.return_bottles_count})
    if _old_lent != body.bottles_lent:
        _diff_entries.append({"name": "📦 Одолжить бутылок", "old": _old_lent, "new": body.bottles_lent})

    order.subtotal = subtotal
    order.bottle_surcharge = bottle_surcharge
    order.total = max(0.0, subtotal + bottle_surcharge + (order.delivery_fee or 0) - (order.bonus_used or 0) - (order.balance_used or 0))
    order.return_bottles_count = body.return_bottles_count
    order.bottles_lent = body.bottles_lent
    order.is_items_edited = True
    order.items_change_log = _json_mod.dumps(_diff_entries, ensure_ascii=False) if _diff_entries else None
    if body.courier_name:
        order.items_edited_by = body.courier_name

    await db.commit()

    # Shortage notification after commit
    try:
        await _notify_low_stock_if_needed(db, items_data, order_id)
    except Exception:
        pass

    # Build full staff notification preserving all original info + change marker
    def _fmtv(n): return f"{int(n):,} сум".replace(",", " ")
    qty_with_deposit = sum(q for p, q in items_data if getattr(p, "has_bottle_deposit", False))
    missing_bottles = max(0, qty_with_deposit - body.return_bottles_count)
    surcharge_num = f"{int(bottle_surcharge):,}".replace(",", " ")
    surcharge_suffix = (
        f"\n  • Невозвращённые бутылки {missing_bottles} шт. — +{surcharge_num} сум"
        if bottle_surcharge > 0 and missing_bottles > 0 else ""
    )
    surcharge_suffix_simple = (
        f"\n• Невозвращённые бутылки {missing_bottles} шт. — +{surcharge_num} сум"
        if bottle_surcharge > 0 and missing_bottles > 0 else ""
    )
    items_bullets = ("\n".join(f"  • {p.name} {q} шт." for p, q in items_data) or "—") + surcharge_suffix
    items_simple = ("\n".join(f"• {p.name} {q} шт." for p, q in items_data) or "—") + surcharge_suffix_simple
    total_str = _fmtv(order.total)
    ret_line = f"\n♻️ Возврат: {body.return_bottles_count} шт." if body.return_bottles_count else ""
    lent_line = f"\n📦 Одолжить: {body.bottles_lent} шт." if body.bottles_lent else ""
    _editor_label = body.courier_name or "курьером"
    if _diff_entries:
        _diff_lines = []
        for _d in _diff_entries:
            if _d["new"] > _d["old"]:
                _diff_lines.append(f"  ➕ {_d['name']}: {_d['old']} → {_d['new']} шт.")
            else:
                _diff_lines.append(f"  ➖ {_d['name']}: {_d['old']} → {_d['new']} шт.")
        change_marker = f"\n✏️ Изменено {_editor_label}:\n" + "\n".join(_diff_lines)
    else:
        change_marker = f"\n✏️ Изменено {_editor_label}"

    _pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
    pay_label_str = _pay_labels.get(order_payment, order_payment)
    c_phone_part = f"  |  {courier_phone}" if courier_phone else ""
    _ROLE_LABELS = {"manager": "Менеджер", "admin": "Администратор", "courier": "Курьер", "agent": "Агент"}
    if order_creator_role:
        _cr_label = _ROLE_LABELS.get(order_creator_role, order_creator_role.capitalize())
        _creator_line = (
            f"\n✍️ Создал заказ: {_cr_label} {order_creator_name}" if order_creator_name
            else f"\n✍️ Создал заказ: {_cr_label}"
        )
    else:
        _client_label = client_name if client_name and client_name != "—" else "Клиент"
        _creator_line = f"\n✍️ Создал заказ: Клиент {_client_label}"
    _auto_assigned = order_creator_role_raw == "courier" and order_assigner_role == "courier"
    if _auto_assigned:
        _assigner_line = "\n👤 Назначил курьера: Автоматически"
    elif order_assigner_name:
        _asgn_role_lbl = _ROLE_LABELS.get(order_assigner_role, "") if order_assigner_role else ""
        _assigner_line = f"\n👤 Назначил курьера: {_asgn_role_lbl} {order_assigner_name}".rstrip()
    elif order_creator_role in ("manager", "admin") and order_creator_name:
        _cr_asgn_lbl = _ROLE_LABELS.get(order_creator_role, order_creator_role.capitalize())
        _assigner_line = f"\n👤 Назначил курьера: {_cr_asgn_lbl} {order_creator_name}"
    else:
        _assigner_line = ""

    _is_in_delivery = order_status == OrderStatus.IN_DELIVERY
    if courier_name:
        _status_hdr = f"🚴 Курьер {courier_name} в пути" if _is_in_delivery else f"✅ Курьер {courier_name} назначен"
        staff_text = (
            f"{_status_hdr}\n\n"
            f"👤 {client_name}  |  {order_phone}\n"
            f"📍 {order_address}\n\n"
            f"Товары:\n{items_bullets}{ret_line}{lent_line}\n"
            f"💰 {total_str}  |  {pay_label_str}"
            f"{_creator_line}\n"
            f"🚴 {courier_name}{c_phone_part}"
            f"{_assigner_line}"
            f"{change_marker}"
        )
    else:
        staff_text = (
            f"👤 {client_name}  |  {order_phone}\n"
            f"📍 {order_address}\n\n"
            f"Товары:\n{items_bullets}{ret_line}{lent_line}\n"
            f"💰 {total_str}  |  {pay_label_str}"
            f"{_creator_line}"
            f"{change_marker}"
        )
    _cancel_kb = {"inline_keyboard": [
        [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
        [{"text": "❌ Отменить заказ", "callback_data": f"order:cancel:{oid}"}],
    ]}
    await edit_all_notifications(notification_msg_ids, staff_text, reply_markup=_cancel_kb)

    surcharge_line = f"\n💰 Надбавка за невозврат: {_fmtv(bottle_surcharge)}" if bottle_surcharge else ""
    client_text = (
        f"✏️ Состав вашего заказа изменён\n\n"
        f"{items_simple}{ret_line}{lent_line}{surcharge_line}\n\n"
        f"Итого: {total_str}"
    )
    await _tg(client_tg, client_text)

    # Rebuild courier's assignment message with updated items
    if courier_tg and courier_status_msg:
        from app.config import settings as _cfg_u
        _site_map_url = _cfg_u.MINI_APP_URL.rstrip("/") + "/courier/map"
        _note_line_u = f"\n🏠 {order_note}" if order_note else ""
        _pay_labels_u = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
        _pay_lbl_u = _pay_labels_u.get(order_payment, order_payment)
        _snum_u = f"{int(bottle_surcharge):,}".replace(",", " ")
        _items_u = "\n".join(
            f"  • {p.name} {q} шт. — {f'{int(p.price * q):,}'.replace(',', ' ')} сум"
            for p, q in items_data
        ) if items_data else "  —"
        if bottle_surcharge > 0 and missing_bottles > 0:
            _items_u += f"\n  • Невозвращённые бутылки {missing_bottles} шт. — +{_snum_u} сум"
        _client_id_u = f"{client_name}  |  {order_phone}" if client_name and client_name != "—" else order_phone
        _inline_ret_u = []
        if body.return_bottles_count:
            _inline_ret_u.append(f"♻️ Возврат бутылок: {body.return_bottles_count} шт.")
        if body.bottles_lent:
            _inline_ret_u.append(f"📦 Одолжить: {body.bottles_lent} шт.")
        _inline_ret_str_u = ("\n" + "\n".join(_inline_ret_u)) if _inline_ret_u else ""
        _courier_upd = (
            f"🚴 <b>Вам назначен заказ!</b>\n\n"
            f"👤 {_client_id_u}\n"
            f"📍 {order_address}{_note_line_u}\n\n"
            f"Товары:\n{_items_u}\n"
            f"💰 {total_str}  |  {_pay_lbl_u}"
            f"{_inline_ret_str_u}"
        )
        _del_btn = (
            f"courier:done:{oid}" if _is_in_delivery else f"courier:in_delivery:{oid}"
        )
        _del_lbl = "✔️ Доставлено" if _is_in_delivery else "🚴 В пути"
        _kb_u = [
            [{"text": "🗺 Карта заказов", "web_app": {"url": _site_map_url}}],
            [{"text": _del_lbl, "callback_data": _del_btn}],
            [{"text": "✏️ Изменить состав", "callback_data": f"courier:edit_items:{oid}"}],
        ]
        if order_creator_role_raw == "courier":
            _kb_u.append([{"text": "◀️ К списку", "callback_data": "cor:back"}])
        await _tg_edit(int(courier_tg), courier_status_msg, _courier_upd,
                       reply_markup={"inline_keyboard": _kb_u}, parse_mode="HTML")

    return {"ok": True}


@router.patch("/{order_id}/location")
async def update_order_location(order_id: int, body: LocationBody, db: AsyncSession = Depends(get_db)):
    import json as _j
    order = await _get_order(order_id, db)
    order.latitude = body.latitude
    order.longitude = body.longitude

    # Back-fill all same-address orders for this user that still have no location
    if order.user_id and order.address:
        await db.execute(
            sa_update(Order)
            .where(
                Order.user_id == order.user_id,
                Order.address == order.address,
                Order.latitude.is_(None),
            )
            .values(latitude=body.latitude, longitude=body.longitude)
        )
        # Also update matching saved_addresses entries
        user_q = await db.execute(select(User).where(User.id == order.user_id))
        user = user_q.scalar_one_or_none()
        if user and user.saved_addresses:
            try:
                addrs = _j.loads(user.saved_addresses)
                norm = order.address.strip().lower()
                changed = False
                for a in addrs:
                    if a.get("address", "").strip().lower() == norm and not a.get("lat") and not a.get("lng"):
                        a["lat"] = body.latitude
                        a["lng"] = body.longitude
                        changed = True
                if changed:
                    user.saved_addresses = _j.dumps(addrs, ensure_ascii=False)
            except Exception:
                pass

    await db.commit()
    return {"ok": True}


class DeleteBody(BaseModel):
    deleted_by_name: str | None = None
    deleted_by_role: str | None = None


@router.delete("/{order_id}")
async def delete_order(order_id: int, body: DeleteBody = DeleteBody(), db: AsyncSession = Depends(get_db)):
    """Soft-delete a delivered or rejected order so it remains visible in statistics."""
    order = await _get_order(order_id, db)
    if order.status not in (OrderStatus.DELIVERED, OrderStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Only delivered or rejected orders can be deleted")

    order.is_deleted = True
    order.deleted_at = datetime.utcnow()
    order.deleted_by_name = body.deleted_by_name
    order.deleted_by_role = body.deleted_by_role

    await db.commit()
    return {"ok": True}


async def _get_order(order_id: int, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(*_order_opts())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _eta_human(dt) -> str | None:
    if not dt:
        return None
    diff = dt - datetime.utcnow()
    mins = int(diff.total_seconds() / 60)
    if mins <= 0:
        return "уже должны были"
    if mins < 60:
        return f"~{mins} мин"
    h, m = divmod(mins, 60)
    return f"~{h} ч {m} мин" if m else f"~{h} ч"


def _order_to_out(order: Order, client_bottles_owed: int = 0, client_bottles_pending: int = 0) -> OrderOut:
    from app.schemas.order import OrderItemOut
    items = [
        OrderItemOut(
            id=i.id,
            product_id=i.product_id,
            quantity=i.quantity,
            price=i.price,
            product_name=i.product.name if i.product else None,
            volume=float(i.product.volume) if i.product and i.product.volume is not None else None,
        )
        for i in order.items
    ]
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        courier_id=order.courier_id,
        status=order.status,
        recipient_phone=order.recipient_phone,
        address=order.address,
        extra_info=order.extra_info,
        delivery_time=order.delivery_time,
        latitude=order.latitude,
        longitude=order.longitude,
        return_bottles_count=order.return_bottles_count,
        bottles_lent=order.bottles_lent or 0,
        return_bottles_volume=order.return_bottles_volume,
        bottle_discount=order.bottle_discount,
        bottle_surcharge=order.bottle_surcharge or 0,
        subtotal=order.subtotal,
        total=order.total,
        bonus_used=order.bonus_used,
        payment_method=order.payment_method,
        cash_collected=order.cash_collected,
        rejection_reason=order.rejection_reason,
        payment_confirmed=order.payment_confirmed,
        payment_collected=order.payment_collected,
        delivery_fee=order.delivery_fee or 0.0,
        cancellation_reason=order.cancellation_reason,
        cancellation_penalty=order.cancellation_penalty or 0.0,
        created_at=order.created_at,
        delivered_at=order.delivered_at,
        items=items,
        client_name=order.user.name if order.user else None,
        client_telegram_id=order.user.telegram_id if order.user else None,
        courier_name=order.courier.name if order.courier else None,
        courier_phone=order.courier.phone if order.courier else None,
        manager_phone=order.manager_phone,
        creator_role=order.creator_role,
        creator_name=order.creator_name or (order.agent.name if order.creator_role == "agent" and order.agent else None),
        assigner_name=order.assigner_name,
        assigner_role=order.assigner_role,
        previous_courier_name=order.previous_courier_name,
        courier_changed_by=order.courier_changed_by,
        courier_changed_by_role=order.courier_changed_by_role,
        rejected_by_name=order.rejected_by_name,
        rejected_by_role=order.rejected_by_role,
        review_id=order.review.id if order.review else None,
        notification_msg_ids=order.notification_msg_ids,
        client_bottles_owed=client_bottles_owed,
        client_bottles_pending=client_bottles_pending,
        eta_human=_eta_human(order.delivery_expected_at),
        is_items_edited=order.is_items_edited or False,
        items_edited_by=order.items_edited_by,
    )
