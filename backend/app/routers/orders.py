import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header
from pydantic import BaseModel
from sqlalchemy import update as sa_update, func
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


async def _save_status_msg_id(db: AsyncSession, order_id: int, msg_id: int):
    """Persist the Telegram message_id used for client status notifications."""
    await db.execute(sa_update(Order).where(Order.id == order_id).values(client_status_msg_id=msg_id))
    await db.commit()


async def _notify_admins(db: AsyncSession, text: str):
    from app.config import settings as cfg
    for aid in cfg.ADMIN_IDS:
        await _tg(aid, text)
    from app.models.manager import Manager
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
    for m in mgrs:
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
    recipients: list[int] = list(cfg.ADMIN_IDS) + list(cfg.WAREHOUSE_IDS) + list(extra_chat_ids or [])
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
    """Move order items from courier's available quantity → reserved.
    For manager-created orders, create the CourierWater row and WaterTransaction if they don't exist."""
    from app.models.warehouse import CourierWater, WaterTransaction
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
            db.add(WaterTransaction(
                product_id=item.product_id,
                courier_id=order.courier_id,
                order_id=order.id,
                transaction_type="issue",
                quantity=item.quantity,
                note="Заказ создан менеджером",
            ))
        elif row:
            qty = min(item.quantity, max(0, row.quantity))
            row.quantity = max(0, row.quantity - qty)
            row.reserved = (row.reserved or 0) + qty


async def _release_inventory(order, db: AsyncSession, consume: bool = False):
    """Move reserved items back to available (cancel) or simply remove them (deliver)."""
    from app.models.warehouse import CourierWater
    if not order.courier_id or not order.items:
        return
    # For manager-created orders always consume (items were never physically with the courier before assignment)
    if getattr(order, 'creator_role', None) == 'manager':
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


def calc_bottle_surcharge(items_data: list, return_count: int, cfg: dict) -> float:
    """New model: charge an extra fee for every 19L bottle the customer
    keeps (i.e. doesn't return) in this order. Per-product surcharge is
    used when set; otherwise falls back to the global setting."""
    fallback = float(cfg.get("bottle_discount_value") or 0)
    is_percent = cfg.get("bottle_discount_type") == "percent"
    returns_left = max(0, int(return_count or 0))
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
        calc_bottle_surcharge(items_data, data.return_bottles_count, cfg)

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
    result = await db.execute(
        select(Order).where(Order.user_id == user_id)
        .options(*_order_opts())
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.get("/", response_model=list[OrderOut])
async def get_all_orders(status: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Order).options(*_order_opts())
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


@router.patch("/{order_id}/reject")
async def reject_order(order_id: int, body: RejectBody = RejectBody(), from_bot: bool = False,
                       db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status == OrderStatus.REJECTED:
        raise HTTPException(status_code=409, detail="Order already rejected")

    msg_ids_json = order.notification_msg_ids
    was_assigned = order.courier_id is not None
    order.status = OrderStatus.REJECTED
    order.rejection_reason = body.reason

    client_tg = order.user.telegram_id if order.user else None
    old_msg_id = order.client_status_msg_id
    items = _order_items_text(order.items)
    oid = order.id

    if was_assigned:
        await _release_inventory(order, db, consume=False)
    await db.commit()

    from app.services.tg_notify import edit_all_notifications
    reason_part = f" · {body.reason}" if body.reason else ""
    await edit_all_notifications(msg_ids_json, f"❌ Заказ #{oid} отклонён{reason_part}")

    if not from_bot:
        reason_txt = f"\nПричина: {body.reason}" if body.reason else ""
        text = f"❌ Заказ отклонён.\n{items}{reason_txt}"
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

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
        from app.services.tg_notify import notify_all
        site_url = cfg.MINI_APP_URL.rstrip("/") + "/admin/orders"
        text = (
            f"🆕 Новый заказ!\n"
            f"Клиент: {client_name} | {client_phone}\n"
            f"Адрес: {order_addr}\n"
            f"Заказ: {items_text}\n"
            f"Сумма: {order_total:,} сум\n"
            f"Оплата: {pay_label}"
        )
        kb = {"inline_keyboard": [
            [{"text": "✅ Подтвердить", "callback_data": f"admin:confirm:{oid}"},
             {"text": "❌ Отклонить", "callback_data": f"admin:reject:{oid}"}],
            [{"text": "🌐 Заказ на сайте", "url": site_url}],
        ]}
        mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
        msg_ids_json = await notify_all(cfg.ADMIN_IDS, mgrs, text, kb)
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
    client_name = order.user.name if order.user else "—"
    old_msg_id = order.client_status_msg_id
    notification_msg_ids = order.notification_msg_ids
    items_bullets = "\n".join(
        f"  • {i.product.name} {i.quantity} шт." for i in order.items if i.product
    ) or "—"
    items = _order_items_text(order.items)
    items_data_for_stock = [(i.product, i.quantity) for i in order.items if i.product]
    order_address = order.address
    order_phone = order.recipient_phone
    order_time = order.delivery_time or "—"
    order_total = int(order.total)
    order_payment = order.payment_method or "cash"
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

    # Store which manager assigned this courier
    if body.manager_telegram_id:
        from app.models.manager import Manager
        from app.config import settings as cfg
        mgr = (await db.execute(
            select(Manager).where(Manager.telegram_id == body.manager_telegram_id, Manager.is_active == True)
        )).scalar_one_or_none()
        if mgr and mgr.phone:
            order.manager_phone = mgr.phone
        elif body.manager_telegram_id in cfg.ADMIN_IDS:
            admin_user = (await db.execute(
                select(User).where(User.telegram_id == body.manager_telegram_id)
            )).scalar_one_or_none()
            if admin_user and admin_user.phone:
                order.manager_phone = admin_user.phone

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
    await db.commit()

    _pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта", "bonus": "🎁 Бонусы"}
    pay_label_str = _pay_labels.get(order_payment, order_payment)
    c_phone_part = f"  |  {courier_phone}" if courier_phone else ""
    sync_text = (
        f"✅ Курьер {courier_name} назначен{c_phone_part}\n\n"
        f"👤 {client_name}  |  {order_phone}\n"
        f"📍 {order_address}\n\n"
        f"Товары:\n{items_bullets}\n"
        f"💰 {order_total:,} сум  |  {pay_label_str}\n"
        f"🚴 {courier_name}{c_phone_part}"
    )
    from app.services.tg_notify import edit_all_notifications
    await edit_all_notifications(notification_msg_ids, sync_text)

    if not from_bot:
        eta_text = f"⏱ ETA: ~{int(eta_hours)} ч (до {(datetime.utcnow() + timedelta(hours=eta_hours)).strftime('%H:%M')} UTC)\n"
        await _tg(courier_tg,
                  f"🚴 Вам назначен заказ!\n\n"
                  f"Адрес: {order_address}\nТелефон: {order_phone}\n"
                  f"Время: {order_time}\n{eta_text}"
                  f"Товары:\n{items}\n"
                  f"Сумма: {order_total:,} сум")
        text = f"✅ Заказ подтверждён!\n{items}\n🚴 Курьер {courier_name} назначен. Ожидайте доставку."
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)

    return {"ok": True}


@router.patch("/{order_id}/in_delivery")
async def start_delivery(order_id: int, from_bot: bool = False, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status == OrderStatus.IN_DELIVERY:
        return {"ok": True}
    order.status = OrderStatus.IN_DELIVERY

    client_tg = order.user.telegram_id if order.user else None
    old_msg_id = order.client_status_msg_id
    oid = order.id

    courier_name = ""
    if order.courier_id:
        c_q = await db.execute(select(Courier).where(Courier.id == order.courier_id))
        c = c_q.scalar_one_or_none()
        courier_name = c.name if c else ""

    await db.commit()

    if not from_bot:
        text = f"🚴 Курьер «{courier_name}» выехал к вам!" if courier_name else "🚴 Курьер выехал к вам!"
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
    old_msg_id = order.client_status_msg_id
    items = _order_items_text(order.items)
    oid = order.id
    bonus = 0.0

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

        # Track 19L bottle debt: add newly delivered bottles, subtract returned ones.
        # net_change = bottles client now has extra vs before this delivery.
        bottles_delivered = sum(
            i.quantity for i in order.items
            if i.product and i.product.has_bottle_deposit
        )
        returned = order.return_bottles_count or 0
        net_change = bottles_delivered - returned
        if bottles_delivered > 0 and user:
            debt_q = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user.id))
            debt_row = debt_q.scalar_one_or_none()
            if debt_row:
                debt_row.count = max(0, debt_row.count + net_change)
            else:
                db.add(BottleDebt(user_id=user.id, count=max(0, net_change)))

        if order.courier_id:
            result = await db.execute(select(Courier).where(Courier.id == order.courier_id))
            courier = result.scalar_one_or_none()
            if courier:
                courier.total_deliveries += 1

        await _release_inventory(order, db, consume=True)
        await db.commit()

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
        "return_bottles_volume": order.return_bottles_volume,
        "bottle_discount": order.bottle_discount or 0,
    }


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
        review_id=order.review.id if order.review else None,
        notification_msg_ids=order.notification_msg_ids,
        client_bottles_owed=client_bottles_owed,
        client_bottles_pending=client_bottles_pending,
        eta_human=_eta_human(order.delivery_expected_at),
    )
