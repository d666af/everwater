from datetime import datetime
from urllib.parse import quote

from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo,
)
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.courier import (
    courier_menu_kb, courier_cash_confirm_kb, courier_card_confirm_kb,
    courier_location_prompt_kb, build_edit_items_kb,
)
from config import settings

router = Router()

STATUS_RU = {
    "new": "🆕 Новый",
    "awaiting_confirmation": "⏳ Ожидает подтверждения",
    "confirmed": "⏳ Ожидает",
    "assigned_to_courier": "⏳ Ожидает",
    "in_delivery": "🚴 В пути",
    "delivered": "✔️ Доставлен",
    "rejected": "❌ Отклонён",
}

PAGE_SIZE = 4

TAB_LABELS = {
    "waiting": ("⏳", "Ожидают"),
    "enroute": ("🚴", "В пути"),
    "done":    ("✔️", "Доставлено"),
}


def fmt(v):
    return f"{int(v):,}".replace(",", " ") + " сум"


def _order_brief(order: dict) -> str:
    items = order.get("items", [])
    parts = [f"{i.get('product_name', '?')} {i.get('quantity', 1)} шт." for i in items[:3]]
    extra = f" +{len(items) - 3} ещё" if len(items) > 3 else ""
    total = fmt(order.get("total", 0))
    return f"{', '.join(parts)}{extra} · {total}" if parts else total


async def _get_courier(telegram_id: int):
    return await api.get_courier_by_telegram(telegram_id)


async def _maybe_send_location_prompt(message, order_id: int, state=None):
    """After payment resolved: prompt courier to add map location if order has none."""
    if state is not None:
        await state.clear()
    try:
        order = await api.get_order(order_id)
    except Exception:
        return
    if order.get("latitude") or order.get("longitude"):
        return
    addr = order.get("address") or "—"
    client_name = order.get("client_name") or order.get("recipient_phone") or "—"
    brief = _order_brief(order)
    text = (
        f"📍 У адреса этого заказа нет локации на карте\n\n"
        f"👤 {client_name}\n"
        f"📍 {addr}\n"
        f"🛒 {brief}\n\n"
        f"Хотите добавить локацию?"
    )
    await message.answer(text, reply_markup=courier_location_prompt_kb(order_id))


# ─── FSM ──────────────────────────────────────────────────────────────────────

class CourierOrderCreate(StatesGroup):
    waiting_input = State()
    choosing_product = State()
    waiting_bottles = State()
    waiting_lent_bottles = State()
    choosing_address = State()
    waiting_address = State()
    confirming = State()


class PaymentIssueReason(StatesGroup):
    waiting_reason = State()


class LocationAddState(StatesGroup):
    waiting_location = State()


class CourierEditItems(StatesGroup):
    editing = State()



# ─── Helpers ──────────────────────────────────────────────────────────────────

def _filter_orders(orders: list, tab: str) -> list:
    if tab == "waiting":
        return [o for o in orders if o.get("status") in ("confirmed", "assigned_to_courier")]
    if tab == "enroute":
        return [o for o in orders if o.get("status") == "in_delivery"]
    if tab == "done":
        return [o for o in orders if o.get("status") == "delivered"]
    return orders


def _urgency_suffix(order: dict) -> str:
    if not order.get("delivery_time") or order["status"] in ("delivered", "rejected"):
        return ""
    try:
        dt = datetime.fromisoformat(order["delivery_time"].replace("Z", "+00:00"))
        mins = (dt.replace(tzinfo=None) - datetime.utcnow()).total_seconds() / 60
        if mins < 0:
            return " 🔴"
        if mins < 30:
            return " 🟠"
        if mins < 60:
            return " 🟡"
    except Exception:
        pass
    return ""


def _order_detail_text(order: dict) -> str:
    items = order.get("items", [])
    item_lines = [f"  • {i['product_name']} {i['quantity']} шт." for i in items]

    surcharge = order.get('bottle_surcharge') or 0
    if surcharge > 0:
        qty_20l = sum(i['quantity'] for i in items if (i.get('volume') or 0) >= 18.9)
        missing = max(0, qty_20l - (order.get('return_bottles_count') or 0))
        if missing > 0:
            item_lines.append(f"  • Невозвращённые бутылки {missing} шт. — +{fmt(surcharge)}")

    items_text = "\n".join(item_lines) if item_lines else "—"
    status = STATUS_RU.get(order["status"], order["status"])
    urgency = _urgency_suffix(order)
    time_str = order.get("delivery_time") or "—"
    pay = order.get('payment_method', 'cash')
    total = order.get('total') or 0
    delivery_fee = order.get('delivery_fee') or 0

    manager_phone = order.get("manager_phone") or ""
    from keyboards.courier import _is_phone as _ip
    manager_line = f"\n👔 Менеджер: {manager_phone}" if _ip(manager_phone) else ""

    if delivery_fee > 0:
        subtotal = total - delivery_fee
        money_lines = f"\n💰 Товары: {fmt(subtotal)}\n🚚 Доставка: +{fmt(delivery_fee)}"
    else:
        money_lines = ""

    if pay == 'cash':
        payment_line = f"\n\n💵 <b>Получить наличными: {fmt(total)}</b>"
    else:
        total_part = f" · {fmt(total)}" if not money_lines else ""
        payment_line = f"\n\n💳 <b>Оплата картой — проверьте чек клиента{total_part}</b>"

    return_count = order.get('return_bottles_count') or 0
    return_line = f"\n\n♻️ Забрать пустых бутылок: {return_count} шт." if return_count > 0 else ""
    lent_count = order.get('bottles_lent') or 0
    lent_line = f"\n🔄 Одолжить бутылок: {lent_count} шт." if lent_count > 0 else ""

    return (
        f"📦 <b>{status}{urgency}</b>\n\n"
        f"📍 {order.get('address') or '—'}\n"
        f"👤 {order.get('recipient_phone') or '—'}\n"
        f"⏰ {time_str}\n\n"
        f"Доставить:\n{items_text}"
        f"{return_line}"
        f"{lent_line}"
        f"{money_lines}"
        f"{payment_line}"
        f"{manager_line}"
    )


# ─── Orders list UI ───────────────────────────────────────────────────────────

def _filter_select_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⏳ Ожидают",    callback_data="cor:list:waiting:0"),
        InlineKeyboardButton(text="🚴 В пути",     callback_data="cor:list:enroute:0"),
        InlineKeyboardButton(text="✔️ Доставлено", callback_data="cor:list:done:0"),
    ]])


def _order_btn_text(order: dict) -> str:
    addr = (order.get("address") or "").split(",")[0].strip()
    if len(addr) > 28:
        addr = addr[:27] + "…"
    urgency = _urgency_suffix(order)
    total_str = fmt(order.get("total", 0))
    return f"📍 {addr} · {total_str}{urgency}"


def _orders_page_text(filtered: list, tab: str, page: int) -> str:
    icon, label = TAB_LABELS.get(tab, ("📋", tab))
    n = len(filtered)
    if n == 0:
        return f"{icon} <b>Мои заказы — {label}</b>\n\nЗаказов нет."
    total_pages = max(1, (n + PAGE_SIZE - 1) // PAGE_SIZE)
    pg_info = f" · стр. {page + 1}/{total_pages}" if total_pages > 1 else ""
    return f"{icon} <b>Мои заказы — {label}</b> ({n}){pg_info}\n\nВыберите заказ:"


def _orders_page_kb(filtered: list, tab: str, page: int) -> InlineKeyboardMarkup:
    n = len(filtered)
    total_pages = max(1, (n + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(0, min(page, total_pages - 1))
    chunk = filtered[page * PAGE_SIZE: (page + 1) * PAGE_SIZE]

    rows = []
    for o in chunk:
        rows.append([InlineKeyboardButton(
            text=_order_btn_text(o),
            callback_data=f"cor:order:{o['id']}:{tab}:{page}",
        )])

    if not rows:
        rows.append([InlineKeyboardButton(text="— Заказов нет —", callback_data="cor:noop")])

    if total_pages > 1:
        nav = []
        if page > 0:
            nav.append(InlineKeyboardButton(text="◀️", callback_data=f"cor:list:{tab}:{page - 1}"))
        nav.append(InlineKeyboardButton(text=f"{page + 1}/{total_pages}", callback_data="cor:noop"))
        if page < total_pages - 1:
            nav.append(InlineKeyboardButton(text="▶️", callback_data=f"cor:list:{tab}:{page + 1}"))
        rows.append(nav)

    rows.append([InlineKeyboardButton(text="🔙 Назад", callback_data="cor:filter")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _order_detail_kb(order_id: int, status: str, tab: str, page: int, order: dict) -> InlineKeyboardMarkup:
    rows = []
    _map_url = settings.MINI_APP_URL.rstrip("/") + "/courier/map"
    rows.append([InlineKeyboardButton(text="🗺 Карта заказов", web_app=WebAppInfo(url=_map_url))])

    if status == "confirmed":
        rows.append([InlineKeyboardButton(text="✅ Принял заказ", callback_data=f"corl:accept:{order_id}:{tab}:{page}")])
    elif status == "assigned_to_courier":
        rows.append([InlineKeyboardButton(text="🚴 В пути", callback_data=f"corl:in_delivery:{order_id}:{tab}:{page}")])
    elif status == "in_delivery":
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"corl:done:{order_id}:{tab}:{page}")])

    if status in ("confirmed", "assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="✏️ Изменить состав", callback_data=f"corl:edit_items:{order_id}:{tab}:{page}")])

    rows.append([InlineKeyboardButton(text="📋 К списку", callback_data=f"cor:back:{tab}:{page}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ─── Notification-triggered order detail keyboard (no back button) ─────────────

def _notif_detail_kb(order_id: int, status: str, order: dict) -> InlineKeyboardMarkup:
    rows = []
    _map_url = settings.MINI_APP_URL.rstrip("/") + "/courier/map"
    rows.append([InlineKeyboardButton(text="🗺 Карта заказов", web_app=WebAppInfo(url=_map_url))])

    if status == "assigned_to_courier":
        rows.append([InlineKeyboardButton(text="🚴 В пути", callback_data=f"courier:in_delivery:{order_id}")])
    elif status == "in_delivery":
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])

    if status in ("assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="✏️ Изменить состав", callback_data=f"courier:edit_items:{order_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ─── "Мои заказы" handlers ────────────────────────────────────────────────────

@router.message(F.text == "📋 Мои заказы")
async def courier_orders(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    await message.answer(
        "📋 <b>Мои заказы</b>\n\nВыберите раздел:",
        reply_markup=_filter_select_kb(),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "cor:filter")
async def courier_orders_filter(call: CallbackQuery):
    await call.message.edit_text(
        "📋 <b>Мои заказы</b>\n\nВыберите раздел:",
        reply_markup=_filter_select_kb(),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data.startswith("cor:list:"))
async def courier_orders_list(call: CallbackQuery):
    parts = call.data.split(":")
    tab = parts[2]
    page = int(parts[3]) if len(parts) > 3 else 0

    orders = await api.get_courier_orders(call.from_user.id)
    filtered = _filter_orders(orders, tab)
    total_pages = max(1, (len(filtered) + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(0, min(page, total_pages - 1))

    await call.message.edit_text(
        _orders_page_text(filtered, tab, page),
        reply_markup=_orders_page_kb(filtered, tab, page),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data.startswith("cor:order:"))
async def courier_order_detail(call: CallbackQuery):
    parts = call.data.split(":")
    order_id = int(parts[2])
    tab = parts[3] if len(parts) > 3 else "waiting"
    page = int(parts[4]) if len(parts) > 4 else 0

    order = await api.get_order(order_id)
    await call.message.edit_text(
        _order_detail_text(order),
        reply_markup=_order_detail_kb(order_id, order["status"], tab, page, order),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data.startswith("cor:back:"))
async def courier_orders_back(call: CallbackQuery):
    parts = call.data.split(":")
    tab = parts[2] if len(parts) > 2 else "waiting"
    page = int(parts[3]) if len(parts) > 3 else 0

    orders = await api.get_courier_orders(call.from_user.id)
    filtered = _filter_orders(orders, tab)
    total_pages = max(1, (len(filtered) + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(0, min(page, total_pages - 1))

    await call.message.edit_text(
        _orders_page_text(filtered, tab, page),
        reply_markup=_orders_page_kb(filtered, tab, page),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data == "cor:noop")
async def courier_noop(call: CallbackQuery):
    await call.answer()


# ─── List-triggered order actions (preserve tab/page context) ─────────────────

@router.callback_query(F.data.startswith("corl:accept:"))
async def list_courier_accept(call: CallbackQuery):
    parts = call.data.split(":")
    order_id = int(parts[2])
    tab = parts[3] if len(parts) > 3 else "waiting"
    page = int(parts[4]) if len(parts) > 4 else 0

    await api.courier_accept_order(order_id)
    order = await api.get_order(order_id)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            brief = _order_brief(order)
            await call.bot.send_message(client_tg, f"🚴 Курьер принял ваш заказ и скоро выедет!\n{brief}")
        except Exception:
            pass

    await call.message.edit_text(
        _order_detail_text(order),
        reply_markup=_order_detail_kb(order_id, order["status"], tab, page, order),
        parse_mode="HTML",
    )
    await call.answer("✅ Принято!")


@router.callback_query(F.data.startswith("corl:in_delivery:"))
async def list_courier_in_delivery(call: CallbackQuery):
    parts = call.data.split(":")
    order_id = int(parts[2])
    tab = parts[3] if len(parts) > 3 else "enroute"
    page = int(parts[4]) if len(parts) > 4 else 0

    await api.start_delivery(order_id, from_bot=False)
    order = await api.get_order(order_id)

    await call.message.edit_text(
        _order_detail_text(order),
        reply_markup=_order_detail_kb(order_id, order["status"], tab, page, order),
        parse_mode="HTML",
    )
    await call.answer("🚴 В пути!")


@router.callback_query(F.data.startswith("corl:done:"))
async def list_courier_done(call: CallbackQuery):
    parts = call.data.split(":")
    order_id = int(parts[2])

    result = await api.mark_delivered(order_id, from_bot=True)
    order = await api.get_order(order_id)

    from keyboards.user import review_kb
    brief = _order_brief(order)
    client_tg = order.get("client_telegram_id")
    bonus = (result or {}).get("bonus", 0) if isinstance(result, dict) else 0

    if client_tg:
        try:
            bonus_txt = f"\n🎁 Начислено {fmt(bonus)} сум бонусных баллов!" if bonus and bonus > 0 else ""
            await call.bot.send_message(client_tg, f"✅ Ваш заказ доставлен!{bonus_txt}")
            await call.bot.send_message(
                client_tg,
                "Пожалуйста, оцените качество доставки:",
                reply_markup=review_kb(order_id),
            )
        except Exception:
            pass

    try:
        await call.message.delete()
    except Exception:
        pass

    if order.get("payment_collected") is not None:
        await call.answer()
        return

    total_fmt = fmt(order.get("total", 0))
    pay = order.get("payment_method", "cash")
    if pay == "cash":
        sent = await call.bot.send_message(
            call.from_user.id,
            f"💵 Вы получили наличные?\nСумма: {total_fmt}",
            reply_markup=courier_cash_confirm_kb(order_id),
        )
    else:
        sent = await call.bot.send_message(
            call.from_user.id,
            f"💳 Вы проверили чек оплаты по карте?\nСумма: {total_fmt}",
            reply_markup=courier_card_confirm_kb(order_id),
        )
    try:
        await api.store_payment_prompt(order_id, sent.message_id)
    except Exception:
        pass
    await call.answer()


# ─── /courier command ─────────────────────────────────────────────────────────

@router.message(Command("courier"))
async def courier_panel(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        await message.answer("Вы не зарегистрированы как курьер.")
        return
    await message.answer(f"🚴 Панель курьера, {courier['name']}:", reply_markup=courier_menu_kb())


# ─── Quick stats ───────────────────────────────────────────────────────────────

@router.message(F.text == "📊 Мои данные")
async def courier_stats_quick(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    stats = await api.get_courier_stats(message.from_user.id)
    avg          = float(stats.get("avg_rating", 0) or 0)
    review_count = int(stats.get("review_count", 0) or 0)
    deliveries   = int(stats.get("delivery_count", 0) or stats.get("total_deliveries", 0) or 0)
    active       = int(stats.get("active_orders", 0) or 0)
    debt_qty     = int(stats.get("bottles_must_return", 0) or 0)
    debt_val     = float(stats.get("bottle_debt_value", 0) or 0)

    stars = "⭐" * round(avg) if avg else "—"
    lines = [
        "📊 <b>Статистика курьера</b>",
        "",
        f"✔️ Всего доставок: <b>{deliveries}</b>",
        f"🚴 Активных заказов: <b>{active}</b>",
    ]
    if debt_qty > 0:
        debt_val_str = f" · {fmt(debt_val)}" if debt_val > 0 else ""
        lines.append(f"🫙 Долг бутылок: <b>{debt_qty} шт.</b>{debt_val_str}")
    if review_count > 0:
        lines.append(f"⭐ Рейтинг: <b>{avg:.1f}</b> {stars} ({review_count} отзывов)")
    elif avg > 0:
        lines.append(f"⭐ Рейтинг: <b>{avg:.1f}</b> {stars}")

    site_url = settings.MINI_APP_URL.rstrip("/") + "/courier/stats"
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="📊 Открыть подробную статистику", web_app=WebAppInfo(url=site_url))
    ]])
    await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=kb)



# ─── Create order ─────────────────────────────────────────────────────────────

def _exch_price(p: dict) -> float:
    if p.get("has_bottle_deposit") and p.get("deposit_price"):
        return float(p["deposit_price"])
    return float(p.get("effective_price") or p.get("price") or 0)


def _full_price(p: dict) -> float:
    return float(p.get("price") or 0)


def _spc(products: list) -> float:
    """Surcharge per unreturned bottle."""
    for p in products:
        if p.get("has_bottle_deposit") and p.get("bottle_surcharge"):
            return float(p["bottle_surcharge"])
    for p in products:
        if p.get("has_bottle_deposit"):
            diff = _full_price(p) - _exch_price(p)
            if diff > 0:
                return diff
    return 0.0


def _qty19(items: dict, products: list) -> int:
    prod_map = {str(p["id"]): p for p in products}
    return sum(qty for pid, qty in items.items() if prod_map.get(pid, {}).get("has_bottle_deposit"))


def _calc_surcharge(items: dict, products: list, return_bottles: int, bottles_lent: int = 0) -> float:
    missing = max(0, _qty19(items, products) - return_bottles - bottles_lent)
    return missing * _spc(products)


def _cco_bottles_step_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Одолжить бутылки", callback_data="cco:lent_bottles")]
    ])


def _client_addrs(client: dict | None) -> list:
    if not client:
        return []
    for key in ("order_addresses", "addresses"):
        raw = client.get(key) or []
        if raw:
            result = []
            for a in raw:
                addr = (a.get("address") or "") if isinstance(a, dict) else str(a)
                if addr and addr not in result:
                    result.append(addr)
            if result:
                return result
    return []


def _cco_grid_kb(products: list, items: dict) -> InlineKeyboardMarkup:
    rows = []
    pair = []
    for p in products:
        if not p.get("is_active", True):
            continue
        pid = str(p["id"])
        qty = items.get(pid, 0)
        name = p.get("name", "?")
        label = f"✅ {name} ×{qty}" if qty > 0 else f"➕ {name}"
        pair.append(InlineKeyboardButton(text=label, callback_data=f"cco:cp:{pid}"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    if items:
        total_qty = sum(items.values())
        prod_map = {str(p["id"]): p for p in products}
        total_price = sum(_exch_price(prod_map[pid]) * qty for pid, qty in items.items() if pid in prod_map)
        rows.append([InlineKeyboardButton(
            text=f"▶ Далее  {total_qty} шт. · {fmt(total_price)}",
            callback_data="cco:done",
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _cco_grid_text(items: dict, products: list) -> str:
    if not items:
        return "🛒 <b>Состав заказа</b>\n\nВыберите товары:"
    prod_map = {str(p["id"]): p for p in products}
    lines = ["🛒 <b>Состав заказа</b>", ""]
    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        ep = _exch_price(p)
        fp = _full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {fmt(s)}{dep}")
    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


def _cco_qty_kb(pid: str, qty: int) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="➖", callback_data=f"cco:qd:{pid}:-1"),
            InlineKeyboardButton(text=f"{qty} шт.", callback_data="cco:noop"),
            InlineKeyboardButton(text="➕", callback_data=f"cco:qd:{pid}:1"),
        ],
        [
            InlineKeyboardButton(text="1", callback_data=f"cco:qs:{pid}:1"),
            InlineKeyboardButton(text="2", callback_data=f"cco:qs:{pid}:2"),
            InlineKeyboardButton(text="3", callback_data=f"cco:qs:{pid}:3"),
        ],
        [
            InlineKeyboardButton(text="5", callback_data=f"cco:qs:{pid}:5"),
            InlineKeyboardButton(text="10", callback_data=f"cco:qs:{pid}:10"),
            InlineKeyboardButton(text="20", callback_data=f"cco:qs:{pid}:20"),
        ],
    ]
    actions = []
    if qty > 0:
        actions.append(InlineKeyboardButton(text="🗑 Убрать", callback_data=f"cco:qremove:{pid}"))
    actions.append(InlineKeyboardButton(text="◀ Назад", callback_data="cco:back_catalog"))
    rows.append(actions)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _cco_qty_text(pid: str, products: list, items: dict) -> str:
    p = next((x for x in products if str(x["id"]) == pid), {})
    ep = _exch_price(p)
    fp = _full_price(p)
    qty = items.get(pid, 0)
    vol = p.get("volume", "")
    vol_str = f" {vol}л" if vol else ""
    dep_hint = f"\n<i>♻ Цена с обменом. Без обмена: {fmt(fp)}</i>" if p.get("has_bottle_deposit") and ep < fp else ""
    lines = [f"<b>{p.get('name', '?')}{vol_str}</b>", f"💵 {fmt(ep)} за шт.{dep_hint}"]
    if qty > 0:
        lines.append(f"\n📦 В заказе: {qty} шт. — {fmt(ep * qty)}")
    lines.append("\nВыберите количество:")
    return "\n".join(lines)


def _cco_confirm_text(data: dict, products: list) -> str:
    client = data.get("co_client")
    phone = data.get("co_phone", "—")
    address = data.get("co_address", "—")
    items = data.get("co_items", {})
    return_bottles = data.get("co_return_bottles", 0)
    lent_bottles = data.get("co_lent_bottles", 0)
    prod_map = {str(p["id"]): p for p in products}
    surcharge = _calc_surcharge(items, products, return_bottles, lent_bottles)

    lines = ["📋 <b>Подтверждение заказа</b>\n"]
    if client:
        _cname = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
        lines.append(f"👤 {_cname} · {phone}")
    else:
        lines.append(f"👤 {phone}")
    lines.append(f"📍 {address}")
    lines.append("\nТовары:")

    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        ep = _exch_price(p)
        fp = _full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {fmt(s)}{dep}")

    if return_bottles > 0:
        lines.append(f"\n♻️ Возврат: {return_bottles} шт.")
    if lent_bottles > 0:
        lines.append(f"🔄 Одолжено: {lent_bottles} шт.")
    if surcharge > 0:
        missing = max(0, _qty19(items, products) - return_bottles - lent_bottles)
        lines.append(f"🫙 Надбавка за невозврат {missing} бут.: +{fmt(surcharge)}")
        total += surcharge

    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


def _cco_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✏️ Состав", callback_data="cco:edit:items"),
            InlineKeyboardButton(text="♻️ Возврат", callback_data="cco:edit:bottles"),
            InlineKeyboardButton(text="📍 Адрес", callback_data="cco:edit:address"),
        ],
        [InlineKeyboardButton(text="✅ Создать заказ", callback_data="cco:confirm")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cco:cancel")],
    ])


def _cco_addr_kb(options: list) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=f"📍 {addr[:45]}", callback_data=f"cco:adr:{i}")]
        for i, addr in enumerate(options)
    ]
    rows.append([InlineKeyboardButton(text="✏️ Другой адрес", callback_data="cco:adr:custom")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _cco_show_addr(target, state: FSMContext):
    data = await state.get_data()
    options = data.get("co_addr_options", [])
    if options:
        await state.set_state(CourierOrderCreate.choosing_address)
        text = "📍 Выберите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text, reply_markup=_cco_addr_kb(options))
        else:
            await target.answer(text, reply_markup=_cco_addr_kb(options))
    else:
        await state.set_state(CourierOrderCreate.waiting_address)
        text = "📍 Введите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text)
        else:
            await target.answer(text)


async def _cco_show_confirm(target, state: FSMContext):
    data = await state.get_data()
    products = data.get("co_products", [])
    text = _cco_confirm_text(data, products)
    kb = _cco_confirm_kb()
    await state.set_state(CourierOrderCreate.confirming)
    if isinstance(target, CallbackQuery):
        await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(F.text == "📝 Новый заказ")
async def courier_create_order_start(message: Message, state: FSMContext):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    await state.update_data(co_courier=courier, co_items={})
    await state.set_state(CourierOrderCreate.waiting_input)
    await message.answer(
        "📝 <b>Новый заказ</b>\n\n"
        "Введите номер телефона клиента:\n"
        "<code>+998 90 123-45-67</code>\n\n"
        "Или быстрый ввод (3–4 строки через Enter):\n"
        "<code>5\n"
        "Балгарский, ул. Навои 12\n"
        "+998 91-551-51-44\n"
        "баклажка</code>\n\n"
        "<i>1 строка — кол-во 19л бутылей\n"
        "2 строка — адрес доставки\n"
        "3 строка — телефон клиента\n"
        "4 строка — число = надбавка только для N бутылок; б/баклажка = для всех; пусто = возврат всех</i>",
        parse_mode="HTML",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(CourierOrderCreate.waiting_input)
async def courier_co_input(message: Message, state: FSMContext):
    text = message.text.strip()
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    products = await api.get_products()
    products = [p for p in products if p.get("is_active", True)]

    if len(lines) >= 3:
        # ── Quick input mode ──────────────────────────────────────────────────
        try:
            qty = int(lines[0])
        except ValueError:
            await message.answer(
                "❌ Первая строка должна быть числом (количество бутылей).\nПопробуйте ещё раз."
            )
            return

        quick_addr = lines[1]
        phone = lines[2]
        if sum(1 for c in phone if c.isdigit()) < 9:
            await message.answer("❌ 3 строка — неверный номер телефона. Введите минимум 9 цифр.\nПопробуйте ещё раз.")
            return
        non_return = 0
        if len(lines) > 3:
            fourth = lines[3].strip()
            try:
                non_return = max(0, int(fourth))
                return_bottles = max(0, qty - non_return)
            except ValueError:
                if fourth.lstrip()[:1].lower() in ("б", "b"):
                    non_return = qty
                    return_bottles = 0
                else:
                    return_bottles = qty
        else:
            return_bottles = qty

        main_product = next(
            (p for p in products if p.get("has_bottle_deposit") and float(p.get("volume") or 0) >= 18),
            None,
        )
        items = {str(main_product["id"]): qty} if main_product else {}

        client = await api.lookup_user_by_phone(phone)
        addr_options = [quick_addr]
        for a in _client_addrs(client):
            if a not in addr_options:
                addr_options.append(a)

        await state.update_data(
            co_phone=phone,
            co_products=products,
            co_items=items,
            co_client=client,
            co_return_bottles=return_bottles,
            co_addr_options=addr_options,
            co_edit_mode=False,
        )

        if client:
            bottles_owed = client.get("bottles_owed", 0)
            _cn = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
            info = f"✅ {_cn} · {client.get('phone', phone)}"
            if bottles_owed > 0:
                info += f"\n🫙 Долг бутылок: {bottles_owed} шт."
        else:
            info = f"ℹ️ Клиент не найден — заказ по номеру {phone}"

        if main_product:
            items_info = f"\n🛒 {main_product['name']} {qty} шт."
            if non_return > 0:
                items_info += f" · надбавка за {non_return} бут."
        else:
            items_info = "\n⚠️ 19л продукт не найден — добавьте состав вручную"

        await message.answer(f"{info}{items_info}", parse_mode="HTML")
        await _cco_show_addr(message, state)

    else:
        # ── Normal mode (phone) ───────────────────────────────────────────────
        phone = text
        if sum(1 for c in phone if c.isdigit()) < 9:
            await message.answer("❌ Неверный номер телефона — введите минимум 9 цифр.\nПопробуйте ещё раз.")
            return
        client = await api.lookup_user_by_phone(phone)

        await state.update_data(
            co_phone=phone,
            co_products=products,
            co_items={},
            co_client=client,
            co_addr_options=_client_addrs(client),
            co_edit_mode=False,
        )
        await state.set_state(CourierOrderCreate.choosing_product)

        if client:
            bottles_owed = client.get("bottles_owed", 0)
            pending = client.get("pending_return", 0)
            available = client.get("available_bottles", bottles_owed)
            if bottles_owed > 0:
                if pending > 0:
                    bottle_line = (
                        f"\n🫙 Долг: {bottles_owed} бут. | В процессе: {pending} | Доступно: {available}"
                    )
                else:
                    bottle_line = f"\n🫙 Долг по бутылкам: {bottles_owed} шт."
            else:
                bottle_line = ""
            _cn = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
            info = f"✅ Клиент найден: {_cn} | {client.get('phone', phone)}{bottle_line}"
        else:
            info = "ℹ️ Клиент не найден — заказ создастся по номеру телефона"

        await message.answer(
            f"{info}\n\n{_cco_grid_text({}, products)}",
            reply_markup=_cco_grid_kb(products, {}),
            parse_mode="HTML",
        )


# ─── Products (grid catalog) ──────────────────────────────────────────────────

@router.callback_query(CourierOrderCreate.choosing_product, F.data == "cco:noop")
async def courier_co_catalog_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:cp:"))
async def courier_co_pick_product(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    products = data.get("co_products", [])
    items = data.get("co_items", {})
    qty = items.get(pid, 0)
    await call.message.edit_text(
        _cco_qty_text(pid, products, items),
        reply_markup=_cco_qty_kb(pid, qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:qd:"))
async def courier_co_qty_delta(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid = parts[2]
    delta = int(parts[3])
    data = await state.get_data()
    items = dict(data.get("co_items", {}))
    new_qty = max(0, items.get(pid, 0) + delta)
    if new_qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = new_qty
    await state.update_data(co_items=items)
    products = data.get("co_products", [])
    await call.message.edit_text(
        _cco_qty_text(pid, products, items),
        reply_markup=_cco_qty_kb(pid, new_qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:qs:"))
async def courier_co_qty_set(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid = parts[2]
    qty = int(parts[3])
    data = await state.get_data()
    items = dict(data.get("co_items", {}))
    if qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = qty
    await state.update_data(co_items=items)
    products = data.get("co_products", [])
    await call.message.edit_text(
        _cco_qty_text(pid, products, items),
        reply_markup=_cco_qty_kb(pid, qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:qremove:"))
async def courier_co_qty_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    items = dict(data.get("co_items", {}))
    items.pop(pid, None)
    await state.update_data(co_items=items)
    products = data.get("co_products", [])
    await call.message.edit_text(
        _cco_grid_text(items, products),
        reply_markup=_cco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data == "cco:back_catalog")
async def courier_co_back_catalog(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = data.get("co_products", [])
    items = data.get("co_items", {})
    await call.message.edit_text(
        _cco_grid_text(items, products),
        reply_markup=_cco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data == "cco:done")
async def courier_co_items_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("co_items"):
        await call.answer("Добавьте хотя бы один товар!")
        return
    items = data.get("co_items", {})
    products = data.get("co_products", [])
    prod_map = {str(p["id"]): p for p in products}
    has_deposit = any(prod_map.get(pid, {}).get("has_bottle_deposit") for pid in items)

    if data.get("co_edit_mode"):
        await call.answer()
        await _cco_show_confirm(call, state)
        return

    if has_deposit:
        await state.set_state(CourierOrderCreate.waiting_bottles)
        await call.message.edit_text(
            "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
            reply_markup=_cco_bottles_step_kb(),
        )
    else:
        await state.update_data(co_return_bottles=0)
        await _cco_show_addr(call, state)
    await call.answer()


# ─── Bottles ──────────────────────────────────────────────────────────────────

@router.message(CourierOrderCreate.waiting_bottles)
async def courier_co_bottles(message: Message, state: FSMContext):
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 0, 1, 2")
        return
    await state.update_data(co_return_bottles=count)
    data = await state.get_data()
    if data.get("co_edit_mode"):
        await _cco_show_confirm(message, state)
    else:
        await _cco_show_addr(message, state)


@router.callback_query(CourierOrderCreate.waiting_bottles, F.data == "cco:lent_bottles")
async def courier_co_lent_tap(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await state.set_state(CourierOrderCreate.waiting_lent_bottles)
    await call.message.edit_text("🔄 Сколько бутылок одолжить клиенту?\nВведите число:")


@router.message(CourierOrderCreate.waiting_lent_bottles)
async def courier_co_lent_bottles(message: Message, state: FSMContext):
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 1, 2, 3")
        return
    await state.update_data(co_lent_bottles=count)
    data = await state.get_data()
    if data.get("co_edit_mode"):
        await _cco_show_confirm(message, state)
    else:
        await _cco_show_addr(message, state)


# ─── Address selection ────────────────────────────────────────────────────────

@router.callback_query(CourierOrderCreate.choosing_address, F.data.startswith("cco:adr:"))
async def courier_co_select_addr(call: CallbackQuery, state: FSMContext):
    idx_str = call.data.split(":", 2)[2]
    if idx_str == "custom":
        await state.set_state(CourierOrderCreate.waiting_address)
        await call.message.edit_text("📍 Введите адрес доставки:")
        await call.answer()
        return

    data = await state.get_data()
    options = data.get("co_addr_options", [])
    try:
        addr = options[int(idx_str)]
    except (ValueError, IndexError):
        await call.answer("Ошибка выбора")
        return

    await state.update_data(co_address=addr)
    await call.answer()
    await _cco_show_confirm(call, state)


@router.message(CourierOrderCreate.waiting_address)
async def courier_co_address(message: Message, state: FSMContext):
    await state.update_data(co_address=message.text.strip())
    await _cco_show_confirm(message, state)


# ─── Edit from confirmation ───────────────────────────────────────────────────

@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:edit:items")
async def courier_co_edit_items(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = data.get("co_products", [])
    items = data.get("co_items", {})
    await state.update_data(co_edit_mode=True)
    await state.set_state(CourierOrderCreate.choosing_product)
    await call.message.edit_text(
        _cco_grid_text(items, products),
        reply_markup=_cco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:edit:bottles")
async def courier_co_edit_bottles(call: CallbackQuery, state: FSMContext):
    await state.update_data(co_edit_mode=True)
    await state.set_state(CourierOrderCreate.waiting_bottles)
    await call.message.edit_text(
        "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
        reply_markup=_cco_bottles_step_kb(),
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:edit:address")
async def courier_co_edit_address(call: CallbackQuery, state: FSMContext):
    await state.update_data(co_edit_mode=True)
    await call.answer()
    await _cco_show_addr(call, state)


# ─── Confirm / Cancel ─────────────────────────────────────────────────────────

@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:confirm")
async def courier_co_confirm(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    items_list = [{"product_id": int(pid), "quantity": qty} for pid, qty in data["co_items"].items()]
    products = data.get("co_products", [])
    return_bottles = data.get("co_return_bottles", 0)
    lent_bottles = data.get("co_lent_bottles", 0)
    surcharge = _calc_surcharge(data["co_items"], products, return_bottles, lent_bottles)
    courier_self = await api.get_courier_by_telegram(call.from_user.id)
    try:
        await api.courier_create_order({
            "phone": data["co_phone"],
            "address": data["co_address"],
            "items": items_list,
            "payment_method": "cash",
            "return_bottles_count": return_bottles,
            "bottles_lent": lent_bottles,
            "bottle_surcharge": surcharge,
            "courier_telegram_id": call.from_user.id,
            "creator_role": "courier",
            "creator_name": (courier_self or {}).get("name") or call.from_user.full_name or "",
        })
    except Exception:
        await call.message.edit_text("❌ Ошибка при создании заказа. Попробуйте ещё раз.")
        await state.clear()
        await call.answer()
        return
    await state.clear()
    await call.answer()
    try:
        await call.message.delete()
    except Exception:
        await call.message.edit_reply_markup(reply_markup=None)
    await call.message.answer("Панель курьера:", reply_markup=courier_menu_kb())


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:cancel")
async def courier_co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    await call.message.answer("Панель курьера:", reply_markup=courier_menu_kb())
    await call.answer()


# ─── Notification-triggered order actions ─────────────────────────────────────

@router.callback_query(F.data.startswith("courier:accept:"))
async def courier_accept(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.courier_accept_order(order_id)
    order = await api.get_order(order_id)
    brief = _order_brief(order)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await call.bot.send_message(client_tg, f"🚴 Курьер принял ваш заказ и скоро выедет!\n{brief}")
        except Exception:
            pass
    await call.message.edit_text(
        f"✅ Вы приняли заказ.\n{brief}",
        reply_markup=_notif_detail_kb(order_id, "in_delivery", order),
    )
    await call.answer()


@router.callback_query(F.data.startswith("courier:in_delivery:"))
async def courier_in_delivery(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id, from_bot=False)
    order = await api.get_order(order_id)
    try:
        await call.message.edit_text(
            _order_detail_text(order),
            reply_markup=_notif_detail_kb(order_id, "in_delivery", order),
            parse_mode="HTML",
        )
    except Exception:
        pass
    await call.answer("🚴 В пути!")


@router.callback_query(F.data.startswith("courier:done:"))
async def courier_done(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    result = await api.mark_delivered(order_id, from_bot=True)
    order = await api.get_order(order_id)

    from keyboards.user import review_kb
    brief = _order_brief(order)
    client_tg = order.get("client_telegram_id")
    bonus = (result or {}).get("bonus", 0) if isinstance(result, dict) else 0

    if client_tg:
        try:
            bonus_txt = f"\n🎁 Начислено {fmt(bonus)} сум бонусных баллов!" if bonus and bonus > 0 else ""
            await call.bot.send_message(client_tg, f"✅ Ваш заказ доставлен!{bonus_txt}")
            await call.bot.send_message(
                client_tg,
                "Пожалуйста, оцените качество доставки:",
                reply_markup=review_kb(order_id),
            )
        except Exception:
            pass

    try:
        await call.message.delete()
    except Exception:
        pass

    if order.get("payment_collected") is not None:
        await call.answer()
        return

    total_fmt = fmt(order.get("total", 0))
    pay = order.get("payment_method", "cash")
    if pay == "cash":
        sent = await call.bot.send_message(
            call.from_user.id,
            f"💵 Вы получили наличные?\nСумма: {total_fmt}",
            reply_markup=courier_cash_confirm_kb(order_id),
        )
    else:
        sent = await call.bot.send_message(
            call.from_user.id,
            f"💳 Вы проверили чек оплаты по карте?\nСумма: {total_fmt}",
            reply_markup=courier_card_confirm_kb(order_id),
        )
    try:
        await api.store_payment_prompt(order_id, sent.message_id)
    except Exception:
        pass
    await call.answer()


# ─── Payment confirmation ──────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("courier:cash_ok:"))
async def courier_cash_received(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    try:
        await api.update_order_cash_received(order_id)
        await api.set_payment_collected(order_id, True)
    except Exception:
        pass
    try:
        await call.message.edit_text("✅ Наличные зафиксированы!")
    except Exception:
        await call.message.answer("✅ Наличные зафиксированы!")
    await call.answer()
    await _maybe_send_location_prompt(call.message, order_id, state)


@router.callback_query(F.data.startswith("courier:card_ok:"))
async def courier_card_received(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    try:
        await api.set_payment_collected(order_id, True)
    except Exception:
        pass
    try:
        await call.message.edit_text("✅ Оплата по карте подтверждена!")
    except Exception:
        await call.message.answer("✅ Оплата по карте подтверждена!")
    await call.answer()
    await _maybe_send_location_prompt(call.message, order_id, state)


@router.callback_query(F.data.startswith("courier:cash_no:"))
async def courier_cash_no(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    await state.set_state(PaymentIssueReason.waiting_reason)
    await state.update_data(order_id=order_id, payment_method="cash", courier_name=call.from_user.full_name)
    await call.message.edit_text("💬 Укажите причину — почему не получили наличные:")
    await call.answer()


@router.callback_query(F.data.startswith("courier:card_no:"))
async def courier_card_no(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    await state.set_state(PaymentIssueReason.waiting_reason)
    await state.update_data(order_id=order_id, payment_method="card", courier_name=call.from_user.full_name)
    await call.message.edit_text("💬 Укажите причину — почему не проверили чек:")
    await call.answer()


@router.message(PaymentIssueReason.waiting_reason)
async def payment_issue_reason_received(message: Message, state: FSMContext):
    data = await state.get_data()
    order_id = data.get("order_id")
    payment_method = data.get("payment_method", "cash")
    courier_name = data.get("courier_name", "")
    reason = message.text or ""
    await state.clear()
    try:
        await api.report_payment_issue(order_id, payment_method, reason, courier_name)
        await api.set_payment_collected(order_id, False)
    except Exception:
        pass
    await message.answer("✅ Сообщение отправлено менеджеру. Причина зафиксирована.")
    if order_id:
        await _maybe_send_location_prompt(message, order_id)


# ── Location prompt handlers ─────────────────────────────────────────────────

@router.callback_query(F.data.startswith("courier:addloc:yes:"))
async def courier_addloc_yes(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[3])
    await state.set_state(LocationAddState.waiting_location)
    await state.update_data(order_id=order_id)
    try:
        await call.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    await call.message.answer("📍 Отправьте геолокацию для этого адреса:")
    await call.answer()


@router.callback_query(F.data.startswith("courier:addloc:no:"))
async def courier_addloc_no(call: CallbackQuery):
    try:
        await call.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    await call.answer()


@router.message(LocationAddState.waiting_location, F.location)
async def courier_location_received(message: Message, state: FSMContext):
    data = await state.get_data()
    order_id = data.get("order_id")
    await state.clear()
    lat = message.location.latitude
    lng = message.location.longitude
    try:
        await api.update_order_location(order_id, lat, lng)
        await message.answer("✅ Локация сохранена! Теперь этот адрес будет с картой.")
    except Exception:
        await message.answer("❌ Не удалось сохранить локацию.")


@router.message(LocationAddState.waiting_location)
async def courier_location_wrong_type(message: Message):
    await message.answer("📍 Пожалуйста, отправьте геолокацию (📎 → Геолокация).")


# ── Edit order items handlers ─────────────────────────────────────────────────

def _build_edit_text(items: dict, products: list, return_bottles: int, lent_bottles: int) -> str:
    prod_map = {str(p["id"]): p for p in products}
    lines = ["✏️ Изменить состав заказа:\n"]
    for pid, qty in items.items():
        name = prod_map.get(pid, {}).get("name", pid)
        lines.append(f"• {name}: {qty} шт.")
    if return_bottles > 0 or lent_bottles > 0:
        lines.append("")
    if return_bottles > 0:
        lines.append(f"♻️ Возврат: {return_bottles} шт.")
    if lent_bottles > 0:
        lines.append(f"📦 Одолжить: {lent_bottles} шт.")
    return "\n".join(lines)


async def _start_edit_items(call: CallbackQuery, state: FSMContext, order_id: int):
    """Common logic for opening the edit-items UI from any source."""
    try:
        order = await api.get_order(order_id)
        all_products = await api.get_products()
    except Exception:
        await call.answer("Ошибка загрузки данных", show_alert=True)
        return

    active = [p for p in (all_products or []) if p.get("is_active", True)]
    products_data = [{"id": p["id"], "name": p["name"], "price": p.get("price", 0)} for p in active]

    items: dict[str, int] = {}
    for it in order.get("items", []):
        pid = str(it.get("product_id", ""))
        if pid:
            items[pid] = it.get("quantity", 0)

    return_bottles = order.get("return_bottles_count") or 0
    lent_bottles = order.get("bottles_lent") or 0

    kb = build_edit_items_kb(order_id, items, return_bottles, lent_bottles, products_data)
    text = _build_edit_text(items, products_data, return_bottles, lent_bottles)
    sent = await call.message.answer(text, reply_markup=kb)

    await state.set_state(CourierEditItems.editing)
    await state.update_data(
        order_id=order_id,
        edit_msg_id=sent.message_id,
        items=items,
        return_bottles=return_bottles,
        lent_bottles=lent_bottles,
        products=products_data,
    )
    await call.answer()


async def _detect_editor_role(user_id: int) -> str:
    from handlers.admin import is_admin as _is_admin
    from handlers.manager import is_manager as _is_manager
    if _is_admin(user_id):
        return "admin"
    if await _is_manager(user_id):
        return "manager"
    return "courier"


@router.callback_query(F.data.startswith("courier:edit_items:"))
async def courier_edit_items_notif(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    await _start_edit_items(call, state, order_id)
    role = await _detect_editor_role(call.from_user.id)
    await state.update_data(editor_role=role)


@router.callback_query(F.data.startswith("corl:edit_items:"))
async def courier_edit_items_list(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    await _start_edit_items(call, state, order_id)
    role = await _detect_editor_role(call.from_user.id)
    await state.update_data(editor_role=role)


async def _cedit_update_kb(call: CallbackQuery, state: FSMContext):
    """Edit the message text + keyboard after any +/- change."""
    data = await state.get_data()
    items = data["items"]
    return_bottles = data["return_bottles"]
    lent_bottles = data["lent_bottles"]
    products = data["products"]
    kb = build_edit_items_kb(data["order_id"], items, return_bottles, lent_bottles, products)
    text = _build_edit_text(items, products, return_bottles, lent_bottles)
    try:
        await call.message.edit_text(text, reply_markup=kb)
    except Exception:
        pass
    await call.answer()


@router.callback_query(F.data.startswith("cedit:inc:"))
async def cedit_inc(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid = parts[3]
    data = await state.get_data()
    items = dict(data.get("items", {}))
    items[pid] = items.get(pid, 0) + 1
    await state.update_data(items=items)
    await _cedit_update_kb(call, state)


@router.callback_query(F.data.startswith("cedit:dec:"))
async def cedit_dec(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid = parts[3]
    data = await state.get_data()
    items = dict(data.get("items", {}))
    items[pid] = max(0, items.get(pid, 0) - 1)
    await state.update_data(items=items)
    await _cedit_update_kb(call, state)


@router.callback_query(F.data.startswith("cedit:ret_inc:"))
async def cedit_ret_inc(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(return_bottles=data.get("return_bottles", 0) + 1)
    await _cedit_update_kb(call, state)


@router.callback_query(F.data.startswith("cedit:ret_dec:"))
async def cedit_ret_dec(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(return_bottles=max(0, data.get("return_bottles", 0) - 1))
    await _cedit_update_kb(call, state)


@router.callback_query(F.data.startswith("cedit:lent_inc:"))
async def cedit_lent_inc(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(lent_bottles=data.get("lent_bottles", 0) + 1)
    await _cedit_update_kb(call, state)


@router.callback_query(F.data.startswith("cedit:lent_dec:"))
async def cedit_lent_dec(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(lent_bottles=max(0, data.get("lent_bottles", 0) - 1))
    await _cedit_update_kb(call, state)


@router.callback_query(F.data == "cedit:noop")
async def cedit_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(F.data.startswith("cedit:back:"))
async def cedit_back(call: CallbackQuery, state: FSMContext):
    await state.clear()
    try:
        await call.message.delete()
    except Exception:
        pass
    await call.answer()


@router.callback_query(F.data.startswith("cedit:done:"))
async def cedit_done(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    data = await state.get_data()
    items = data.get("items", {})
    return_bottles = data.get("return_bottles", 0)
    lent_bottles = data.get("lent_bottles", 0)
    await state.clear()

    items_payload = [
        {"product_id": int(pid), "quantity": qty}
        for pid, qty in items.items()
        if qty > 0
    ]

    if not items_payload:
        await call.answer("⚠️ Добавьте хотя бы один товар", show_alert=True)
        return

    try:
        await call.message.edit_text("⏳ Обновляю состав...", reply_markup=None)
    except Exception:
        pass

    try:
        _ROLE_LABELS_ED = {"admin": "Администратор", "manager": "Менеджер", "courier": "Курьер"}
        editor_role = data.get("editor_role", "courier")
        role_prefix = _ROLE_LABELS_ED.get(editor_role, "")
        is_admin_role = editor_role == "admin"
        db_name = await api.get_staff_db_name(call.from_user.id, is_admin_role)
        editor_display = f"{role_prefix} {db_name or call.from_user.full_name}".strip()
        await api.update_order_items(
            order_id=order_id,
            items=items_payload,
            return_bottles_count=return_bottles,
            bottles_lent=lent_bottles,
            courier_name=editor_display,
        )
        # Backend handles updating the courier's assignment message
        try:
            await call.message.edit_text("✅ Состав обновлён!", reply_markup=None)
        except Exception:
            pass

    except Exception:
        try:
            await call.message.edit_text("❌ Ошибка при обновлении состава.", reply_markup=None)
        except Exception:
            pass

    await call.answer()
