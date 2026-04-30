from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from app.database import get_db
from app.models.order import Order, OrderItem, OrderStatus, Review
from app.models.product import Product
from app.models.user import User
from app.models.courier import Courier
from app.schemas.order import OrderCreate, OrderOut, ReviewCreate
from app.services.settings_service import get_all_settings

router = APIRouter(prefix="/orders", tags=["orders"])


def _order_items_text(items) -> str:
    """Build a human-readable order summary from items, e.g. 'Вода 19л x2, Кулер x1'."""
    if not items:
        return "—"
    parts = [f"{i.product.name} x{i.quantity}" for i in items if i.product]
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


async def _tg_send(chat_id: int, text: str, reply_markup: dict | None = None) -> int | None:
    """Send Telegram message, return message_id on success."""
    from app.config import settings as cfg
    import aiohttp
    if not chat_id:
        return None
    payload: dict = {"chat_id": chat_id, "text": text}
    if reply_markup:
        payload["reply_markup"] = reply_markup
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


async def _notify_low_stock_if_needed(db: AsyncSession, items_data: list, order_id: int):
    """After order creation, check warehouse stock and notify if any product is insufficient."""
    from app.config import settings as cfg
    from app.models.warehouse import WaterStock
    from app.models.manager import Manager

    shortage_lines = []
    for product, quantity in items_data:
        stock_q = await db.execute(select(WaterStock).where(WaterStock.product_id == product.id))
        stock = stock_q.scalar_one_or_none()
        available = stock.quantity if stock else 0
        if available < quantity:
            shortage_lines.append(
                f"• {product.name}: нужно {quantity} шт., на складе {available} шт."
            )

    if not shortage_lines:
        return

    text = (
        f"⚠️ Нехватка товара на складе!\n"
        f"Заказ #{order_id}\n\n"
        + "\n".join(shortage_lines)
        + "\n\nПополните склад как можно скорее."
    )

    recipients: list[int] = list(cfg.ADMIN_IDS) + list(cfg.WAREHOUSE_IDS)
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()
    for m in mgrs:
        if m.telegram_id:
            recipients.append(m.telegram_id)

    seen: set[int] = set()
    for chat_id in recipients:
        if chat_id and chat_id not in seen:
            seen.add(chat_id)
            await _tg(chat_id, text)


def calc_bottle_discount(count: int, subtotal: float, cfg: dict) -> float:
    if count <= 0:
        return 0.0
    if cfg.get("bottle_discount_type") == "percent":
        pct = float(cfg.get("bottle_discount_value") or 0)
        return min(subtotal, subtotal * pct / 100.0)
    per = float(cfg.get("bottle_discount_value") or 0)
    return count * per


@router.post("/", response_model=OrderOut)
async def create_order(data: OrderCreate, db: AsyncSession = Depends(get_db)):
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
    # Prefer client-sent bottle_discount (already shown to user); fallback to server calc
    bottle_discount = data.bottle_discount if data.bottle_discount is not None else \
        calc_bottle_discount(data.return_bottles_count, subtotal, cfg)

    bonus_used = min(float(data.bonus_used or 0), float(user.bonus_points or 0), subtotal)
    balance_used = min(float(data.balance_used or 0), float(user.balance or 0),
                       max(0.0, subtotal - bottle_discount - bonus_used))
    total = max(0.0, subtotal - bottle_discount - bonus_used - balance_used)

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
        subtotal=subtotal,
        total=total,
        bonus_used=bonus_used,
        balance_used=balance_used,
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
    if balance_used > 0:
        user.balance = max(0.0, user.balance - balance_used)

    await db.commit()
    await db.refresh(order)

    # Check warehouse stock for each item and notify if any product is low
    try:
        await _notify_low_stock_if_needed(db, items_data, order.id)
    except Exception:
        pass  # never fail the order on notification error

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
    return _order_to_out(order)


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
    order.status = OrderStatus.REJECTED
    order.rejection_reason = body.reason

    client_tg = order.user.telegram_id if order.user else None
    old_msg_id = order.client_status_msg_id
    items = _order_items_text(order.items)
    oid = order.id

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
async def payment_confirmed(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.status = OrderStatus.AWAITING_CONFIRMATION

    oid = order.id
    client_name = order.user.name if order.user else "—"
    client_phone = order.recipient_phone
    order_addr = order.address
    items_text = _order_items_text(order.items)
    order_total = int(order.total)
    pay_method = order.payment_method
    pay_labels = {"cash": "Наличные", "card": "Перевод на карту", "balance": "Баланс", "balance_card": "Баланс + карта"}
    pay_label = pay_labels.get(pay_method, pay_method)

    await db.commit()

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
    old_msg_id = order.client_status_msg_id
    items = _order_items_text(order.items)
    order_address = order.address
    order_phone = order.recipient_phone
    order_time = order.delivery_time or "—"
    order_total = int(order.total)
    courier_tg = courier.telegram_id
    courier_name = courier.name
    oid = order.id

    order.courier_id = courier_id
    order.status = OrderStatus.ASSIGNED_TO_COURIER
    if not order.delivery_expected_at:
        order.delivery_expected_at = datetime.utcnow() + timedelta(hours=2)

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

    await db.commit()

    if not from_bot:
        await _tg(courier_tg,
                  f"🚴 Вам назначен заказ!\n\n"
                  f"Адрес: {order_address}\nТелефон: {order_phone}\n"
                  f"Время: {order_time}\nТовары:\n{items}\n"
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
    items = _order_items_text(order.items)
    oid = order.id

    await db.commit()

    if not from_bot:
        text = f"✅ Заказ подтверждён!\n{items}\n🚴 Курьер уже едет к вам!"
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
            cashback_pct = float(cfg.get("cashback_percent") or 5)
            bonus = order.total * cashback_pct / 100.0
            user.bonus_points += bonus

        if order.courier_id:
            result = await db.execute(select(Courier).where(Courier.id == order.courier_id))
            courier = result.scalar_one_or_none()
            if courier:
                courier.total_deliveries += 1

        await db.commit()

    if not from_bot and not already_delivered:
        bonus_txt = f"\n🎁 Начислено {int(bonus):,} бонусных баллов!" if bonus > 0 else ""
        text = f"✔️ Заказ доставлен!\n{items}{bonus_txt}"
        new_msg_id = await _tg_edit_or_send(client_tg, text, old_msg_id)
        if new_msg_id and new_msg_id != old_msg_id:
            await _save_status_msg_id(db, oid, new_msg_id)
        # Send separate review prompt with star keyboard (handled by the bot)
        review_kb = {"inline_keyboard": [[
            {"text": f"{i}⭐", "callback_data": f"review:{oid}:{i}"} for i in range(1, 6)
        ]]}
        await _tg_send(client_tg, "Пожалуйста, оцените качество доставки:", review_kb)
        await _notify_admins(db, f"✔️ Заказ доставлен!\n{items}")

    return {"ok": True, "bonus": round(bonus, 2)}


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
    # Idempotent: update existing review if one already exists for this order
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
        order_q = await db.execute(select(Order).where(Order.id == data.order_id))
        order = order_q.scalar_one_or_none()

    review = Review(
        order_id=data.order_id,
        user_id=data.user_id or (order.user_id if order else None),
        courier_id=data.courier_id or (order.courier_id if order else None),
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return {"ok": True, "id": review.id}


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


def _order_to_out(order: Order) -> OrderOut:
    from app.schemas.order import OrderItemOut
    items = [
        OrderItemOut(
            id=i.id,
            product_id=i.product_id,
            quantity=i.quantity,
            price=i.price,
            product_name=i.product.name if i.product else None,
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
        subtotal=order.subtotal,
        total=order.total,
        bonus_used=order.bonus_used,
        balance_used=order.balance_used,
        payment_method=order.payment_method,
        cash_collected=order.cash_collected,
        rejection_reason=order.rejection_reason,
        payment_confirmed=order.payment_confirmed,
        created_at=order.created_at,
        items=items,
        client_name=order.user.name if order.user else None,
        client_telegram_id=order.user.telegram_id if order.user else None,
        courier_name=order.courier.name if order.courier else None,
        courier_phone=order.courier.phone if order.courier else None,
        manager_phone=order.manager_phone,
        review_id=order.review.id if order.review else None,
    )
