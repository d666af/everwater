from urllib.parse import quote
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def _is_phone(v: str) -> bool:
    return bool(v) and str(v) not in ("—", "-", "None") and any(c.isdigit() for c in str(v))


def _fmt_sum(v) -> str:
    return f"{int(v):,}".replace(",", " ") + " сум"


def courier_assignment_text(order: dict) -> str:
    items = order.get("items", [])
    item_lines = [f"  • {i.get('product_name', '?')} {i.get('quantity', 1)} шт." for i in items]

    surcharge = order.get('bottle_surcharge') or 0
    if surcharge > 0:
        qty_20l = sum(i.get('quantity', 1) for i in items if (i.get('volume') or 0) >= 18.9)
        missing = max(0, qty_20l - (order.get('return_bottles_count') or 0))
        if missing > 0:
            item_lines.append(f"  • Невозвращённые бутылки {missing} шт. — +{_fmt_sum(surcharge)}")

    items_text = "\n".join(item_lines) if item_lines else "—"
    pay = order.get("payment_method", "cash")
    total = order.get("total") or 0
    delivery_fee = order.get("delivery_fee") or 0
    time_str = order.get("delivery_time") or "—"
    manager_phone = order.get("manager_phone") or ""
    manager_line = f"\n👔 Менеджер: {manager_phone}" if _is_phone(manager_phone) else ""

    if delivery_fee > 0:
        subtotal = total - delivery_fee
        money_lines = f"\n💰 Товары: {_fmt_sum(subtotal)}\n🚚 Доставка: +{_fmt_sum(delivery_fee)}"
    else:
        money_lines = ""

    if pay == "cash":
        payment_line = f"\n\n💵 <b>Получить наличными: {_fmt_sum(total)}</b>"
    else:
        total_part = f" · {_fmt_sum(total)}" if not money_lines else ""
        payment_line = f"\n\n💳 <b>Оплата картой — проверьте чек клиента{total_part}</b>"

    return_count = order.get('return_bottles_count') or 0
    return_line = f"\n\n♻️ Забрать пустых бутылок: {return_count} шт." if return_count > 0 else ""

    return (
        f"📍 {order.get('address') or '—'}\n"
        f"👤 {order.get('recipient_phone') or '—'}\n"
        f"⏰ {time_str}\n\n"
        f"Доставить:\n{items_text}"
        f"{return_line}"
        f"{money_lines}"
        f"{payment_line}"
        f"{manager_line}"
    )


def courier_assignment_kb(order_id: int, order: dict) -> InlineKeyboardMarkup:
    rows = []
    lat = order.get("latitude")
    lng = order.get("longitude")
    address = order.get("address", "")

    if lat and lng:
        rows.append([InlineKeyboardButton(text="🗺 На карте", url=f"https://maps.google.com/?q={lat},{lng}")])
    elif address:
        rows.append([InlineKeyboardButton(text="🗺 На карте", url=f"https://maps.google.com/?q={quote(address)}")])
    rows.append([InlineKeyboardButton(text="🚴 Выехал", callback_data=f"courier:in_delivery:{order_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def courier_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Мои заказы"), KeyboardButton(text="📊 Мои отчеты")],
            [KeyboardButton(text="💧 Мой склад"), KeyboardButton(text="⭐ Мои отзывы")],
            [KeyboardButton(text="📝 Создать заказ")],
        ],
        resize_keyboard=True,
    )


def courier_order_kb(order_id: int, status: str = "assigned_to_courier") -> InlineKeyboardMarkup:
    rows = []
    if status == "assigned_to_courier":
        rows.append([InlineKeyboardButton(text="🚴 Выехал", callback_data=f"courier:in_delivery:{order_id}")])
    elif status == "in_delivery":
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)




def courier_cash_confirm_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Да, получил", callback_data=f"courier:cash_ok:{order_id}")],
        [InlineKeyboardButton(text="❌ Нет", callback_data=f"courier:cash_no:{order_id}")],
    ])


def courier_card_confirm_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Да, проверил", callback_data=f"courier:card_ok:{order_id}")],
        [InlineKeyboardButton(text="❌ Нет", callback_data=f"courier:card_no:{order_id}")],
    ])
