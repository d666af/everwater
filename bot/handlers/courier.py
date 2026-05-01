from datetime import datetime

from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton,
)
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.courier import courier_menu_kb, courier_debt_kb, courier_cash_confirm_kb
from config import settings

router = Router()

STATUS_RU = {
    "new": "🆕 Новый",
    "awaiting_confirmation": "⏳ Ожидает подтверждения",
    "confirmed": "✅ Подтверждён",
    "assigned_to_courier": "🚚 Назначен курьеру",
    "in_delivery": "🚴 В доставке",
    "delivered": "✔️ Доставлен",
    "rejected": "❌ Отклонён",
}


def fmt(v):
    return f"{int(v):,}".replace(",", " ") + " сум"


def _order_brief(order: dict) -> str:
    items = order.get("items", [])
    parts = [f"{i.get('product_name', '?')} ×{i.get('quantity', 1)}" for i in items[:3]]
    extra = f" +{len(items) - 3} ещё" if len(items) > 3 else ""
    total = fmt(order.get("total", 0))
    return f"{', '.join(parts)}{extra} · {total}" if parts else total


async def _get_courier(telegram_id: int):
    return await api.get_courier_by_telegram(telegram_id)


# ─── FSM ──────────────────────────────────────────────────────────────────────

class CourierOrderCreate(StatesGroup):
    waiting_phone = State()
    choosing_product = State()
    waiting_address = State()
    confirming = State()


# ─── Orders list (single message, edit in place) ──────────────────────────────

def _filter_orders(orders: list, tab: str) -> list:
    if tab == "waiting":
        return [o for o in orders if o.get("status") in ("assigned_to_courier",)]
    if tab == "enroute":
        return [o for o in orders if o.get("status") == "in_delivery"]
    if tab == "done":
        return [o for o in orders if o.get("status") == "delivered"]
    return orders  # "all"


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


TAB_LABELS = {
    "waiting": ("⏳", "Ожидают"),
    "enroute": ("🚴", "В пути"),
    "done": ("✔️", "Выполнено"),
    "all": ("📋", "Все"),
}


def _orders_list_text(orders: list, tab: str) -> str:
    icon, label = TAB_LABELS.get(tab, ("📋", tab))
    filtered = _filter_orders(orders, tab)
    return f"📋 <b>Мои заказы — {label}</b> ({len(filtered)})"


def _orders_list_kb(orders: list, tab: str) -> InlineKeyboardMarkup:
    tab_row = []
    for t, (icon, _) in TAB_LABELS.items():
        marker = "·" if t == tab else ""
        tab_row.append(
            InlineKeyboardButton(text=f"{marker}{icon}{marker}", callback_data=f"cor:tab:{t}")
        )

    filtered = _filter_orders(orders, tab)
    order_rows = []
    for o in filtered[:10]:
        brief = _order_brief(o)
        urgency = _urgency_suffix(o)
        order_rows.append([
            InlineKeyboardButton(text=f"{brief}{urgency}", callback_data=f"cor:detail:{o['id']}")
        ])

    if not order_rows:
        order_rows = [[InlineKeyboardButton(text="— Нет заказов —", callback_data="cor:noop")]]

    return InlineKeyboardMarkup(inline_keyboard=[tab_row] + order_rows)


def _order_detail_text(order: dict) -> str:
    items_text = "\n".join(
        f"  • {i['product_name']} ×{i['quantity']}" for i in order.get("items", [])
    )
    status = STATUS_RU.get(order["status"], order["status"])
    urgency = _urgency_suffix(order)
    time_str = order.get("delivery_time") or "—"
    pay = order.get('payment_method', 'cash')
    cash_line = f"\nПолучить от клиента: {fmt(order['total'])}" if pay == 'cash' else ""
    return (
        f"📦 <b>{status}{urgency}</b>\n\n"
        f"Адрес: {order['address']}\n"
        f"Телефон: {order['recipient_phone']}\n"
        f"Время: {time_str}\n"
        f"Товары:\n{items_text}"
        f"{cash_line}\n"
        f"Возврат бутылок: {order.get('return_bottles_count', 0)} шт."
    )


def _is_phone(v: str) -> bool:
    return bool(v) and v not in ("—", "-", "None") and any(c.isdigit() for c in v)


def _order_detail_kb(order_id: int, status: str, order: dict | None = None) -> InlineKeyboardMarkup:
    rows = []

    client_phone = (order or {}).get("recipient_phone", "")
    manager_phone = (order or {}).get("manager_phone", "")
    lat = (order or {}).get("latitude")
    lng = (order or {}).get("longitude")
    address = (order or {}).get("address", "")

    if _is_phone(client_phone):
        rows.append([InlineKeyboardButton(text="📞 Клиент", url=f"tel:{client_phone}")])
    if _is_phone(manager_phone):
        rows.append([InlineKeyboardButton(text="📞 Менеджер", url=f"tel:{manager_phone}")])
    if lat and lng:
        rows.append([InlineKeyboardButton(text="🗺 На карте", url=f"https://maps.google.com/?q={lat},{lng}")])
    elif address:
        from urllib.parse import quote
        rows.append([InlineKeyboardButton(text="🗺 На карте", url=f"https://maps.google.com/?q={quote(address)}")])

    if status == "assigned_to_courier":
        rows.append([InlineKeyboardButton(text="🚴 Выехал", callback_data=f"courier:in_delivery:{order_id}")])
    elif status == "in_delivery":
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])
    rows.append([InlineKeyboardButton(text="◀️ К списку", callback_data="cor:back")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.message(Command("courier"))
async def courier_panel(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        await message.answer("Вы не зарегистрированы как курьер.")
        return
    await message.answer(f"🚴 Панель курьера, {courier['name']}:", reply_markup=courier_menu_kb())


@router.message(F.text == "📋 Мои заказы")
async def courier_orders(message: Message, state: FSMContext):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    orders = await api.get_courier_orders(message.from_user.id)
    await state.update_data(courier_orders=orders, cor_tab="waiting")
    await message.answer(
        _orders_list_text(orders, "waiting"),
        reply_markup=_orders_list_kb(orders, "waiting"),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("cor:tab:"))
async def courier_orders_tab(call: CallbackQuery, state: FSMContext):
    tab = call.data.split(":")[2]
    data = await state.get_data()
    orders = data.get("courier_orders")
    if orders is None:
        orders = await api.get_courier_orders(call.from_user.id)
        await state.update_data(courier_orders=orders)
    await state.update_data(cor_tab=tab)
    await call.message.edit_text(
        _orders_list_text(orders, tab),
        reply_markup=_orders_list_kb(orders, tab),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data.startswith("cor:detail:"))
async def courier_order_detail(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[2])
    order = await api.get_order(order_id)
    await call.message.edit_text(
        _order_detail_text(order),
        reply_markup=_order_detail_kb(order_id, order["status"], order),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data == "cor:back")
async def courier_orders_back(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    tab = data.get("cor_tab", "waiting")
    orders = await api.get_courier_orders(call.from_user.id)
    await state.update_data(courier_orders=orders)
    await call.message.edit_text(
        _orders_list_text(orders, tab),
        reply_markup=_orders_list_kb(orders, tab),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data == "cor:noop")
async def courier_noop(call: CallbackQuery):
    await call.answer()


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.message(F.text == "📊 Мои отчеты")
async def courier_report(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        await message.answer("Вы не зарегистрированы как курьер.")
        return
    stats = await api.get_courier_stats(message.from_user.id)
    avg = stats.get("avg_rating", 0)
    stars = "⭐" * round(float(avg)) if avg else "—"
    await message.answer(
        f"📊 <b>Ваша статистика:</b>\n\n"
        f"✔️ Выполнено доставок: {stats.get('total_deliveries', 0)}\n"
        f"💰 Общая выручка: {fmt(stats.get('total_revenue', 0))}\n"
        f"⭐ Средний рейтинг: {float(avg):.1f} {stars}\n"
        f"📝 Отзывов: {stats.get('review_count', 0)}\n"
        f"🚴 Активных заказов: {stats.get('active_orders', 0)}",
        parse_mode="HTML",
    )


# ─── Reviews ──────────────────────────────────────────────────────────────────

@router.message(F.text == "⭐ Мои отзывы")
async def courier_reviews(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    reviews = await api.get_courier_reviews(message.from_user.id)
    if not reviews:
        await message.answer("У вас пока нет отзывов.")
        return
    lines = [f"⭐ <b>Последние отзывы ({len(reviews)}):</b>\n"]
    for r in reviews[:10]:
        stars = "⭐" * r["rating"]
        comment = f"\n   «{r['comment']}»" if r.get("comment") else ""
        date = r.get("created_at", "")[:10]
        lines.append(f"• {date} {stars}{comment}")
    await message.answer("\n".join(lines), parse_mode="HTML")


# ─── Water inventory ──────────────────────────────────────────────────────────

@router.message(F.text == "💧 Мой склад")
async def courier_water(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    water = await api.get_courier_water(courier["id"])
    products = await api.get_products()
    prod_map = {p["id"]: p["name"] for p in products}
    if not water:
        await message.answer("💧 У вас нет воды на руках.")
        return
    lines = ["💧 <b>Вода на руках:</b>\n"]
    for w in water:
        name = prod_map.get(w["product_id"], f"ID {w['product_id']}")
        lines.append(f"• {name}: {w['quantity']} шт. (выдано сегодня: {w.get('issued_today', 0)})")
    await message.answer("\n".join(lines), parse_mode="HTML")


# ─── Cash debts ───────────────────────────────────────────────────────────────

@router.message(F.text == "💸 Мои долги")
async def courier_debts(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    result = await api.get_courier_cash_debts(courier["id"])
    total = result.get("total_pending", 0)
    debts = result.get("debts", [])
    if not debts:
        await message.answer("💸 Долгов нет.")
        return
    lines = [f"💸 <b>Долги по наличным</b>\nОжидает погашения: {fmt(total)}\n"]
    for d in debts[:10]:
        status_map = {"pending": "⏳", "requested": "📤", "approved": "✅", "rejected": "❌"}
        icon = status_map.get(d["status"], "•")
        lines.append(f"{icon} {fmt(d['amount'])} [{d['status']}]")
    await message.answer("\n".join(lines), parse_mode="HTML")

    pending = [d for d in debts if d["status"] == "pending"]
    for d in pending[:3]:
        await message.answer(
            f"Долг на {fmt(d['amount'])} — запросить погашение?",
            reply_markup=courier_debt_kb(d["id"]),
        )


@router.callback_query(F.data.startswith("courier:debt_request:"))
async def courier_debt_request(call: CallbackQuery):
    debt_id = int(call.data.split(":")[2])
    await api.request_cash_clearance(debt_id)
    await call.message.edit_text(f"📤 Запрос на погашение долга отправлен администратору.")
    for admin_id in settings.ADMIN_IDS:
        try:
            courier = await _get_courier(call.from_user.id)
            name = courier["name"] if courier else str(call.from_user.id)
            await call.bot.send_message(
                admin_id,
                f"💸 Курьер {name} запрашивает погашение долга #{debt_id}.\n"
                "Проверьте раздел «Долги курьеров» в /admin",
            )
        except Exception:
            pass
    await call.answer()


# ─── Create order ─────────────────────────────────────────────────────────────

def _cco_catalog_kb(products: list, items: dict) -> InlineKeyboardMarkup:
    rows = []
    for p in products:
        qty = items.get(str(p["id"]), 0)
        label = f"{p['name']} ({p.get('volume', '')}л) — {fmt(p['price'])}"
        if qty == 0:
            rows.append([InlineKeyboardButton(text=f"➕ {label}", callback_data=f"cco:add:{p['id']}")])
        else:
            rows.append([
                InlineKeyboardButton(text="➖", callback_data=f"cco:rem:{p['id']}"),
                InlineKeyboardButton(text=f"{label} ×{qty}", callback_data="cco:noop"),
                InlineKeyboardButton(text="➕", callback_data=f"cco:add:{p['id']}"),
            ])
    total_qty = sum(items.values())
    total_price = sum(
        next((p["price"] for p in products if str(p["id"]) == pid), 0) * qty
        for pid, qty in items.items()
    )
    done_label = (
        f"✅ Готово ({total_qty} шт. · {fmt(total_price)})" if total_qty else "✅ Готово"
    )
    rows.append([InlineKeyboardButton(text=done_label, callback_data="cco:done")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _cco_catalog_text(items: dict, products: list) -> str:
    if not items:
        return "Добавьте товары в заказ:"
    prod_map = {str(p["id"]): p for p in products}
    lines = ["<b>Заказ:</b>"]
    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        s = p.get("price", 0) * qty
        total += s
        lines.append(f"  • {p.get('name', pid)} ×{qty} — {fmt(s)}")
    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


@router.message(F.text == "📝 Создать заказ")
async def courier_create_order_start(message: Message, state: FSMContext):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    await state.update_data(co_courier=courier, co_items={})
    await state.set_state(CourierOrderCreate.waiting_phone)
    await message.answer("Введите номер телефона клиента:", reply_markup=ReplyKeyboardRemove())


@router.message(CourierOrderCreate.waiting_phone)
async def courier_co_phone(message: Message, state: FSMContext):
    phone = message.text.strip()
    products = await api.get_products()
    await state.update_data(co_phone=phone, co_products=products, co_items={})
    await state.set_state(CourierOrderCreate.choosing_product)
    await message.answer(
        "Добавьте товары в заказ:",
        reply_markup=_cco_catalog_kb(products, {}),
    )


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:add:"))
async def courier_co_add_product(call: CallbackQuery, state: FSMContext):
    pid = int(call.data.split(":")[2])
    data = await state.get_data()
    items = dict(data.get("co_items", {}))
    items[str(pid)] = items.get(str(pid), 0) + 1
    await state.update_data(co_items=items)
    products = data.get("co_products", [])
    await call.message.edit_text(
        _cco_catalog_text(items, products),
        reply_markup=_cco_catalog_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:rem:"))
async def courier_co_rem_product(call: CallbackQuery, state: FSMContext):
    pid = int(call.data.split(":")[2])
    data = await state.get_data()
    items = dict(data.get("co_items", {}))
    if items.get(str(pid), 0) > 1:
        items[str(pid)] -= 1
    else:
        items.pop(str(pid), None)
    await state.update_data(co_items=items)
    products = data.get("co_products", [])
    await call.message.edit_text(
        _cco_catalog_text(items, products),
        reply_markup=_cco_catalog_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data == "cco:noop")
async def courier_co_catalog_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(CourierOrderCreate.choosing_product, F.data == "cco:done")
async def courier_co_items_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("co_items"):
        await call.answer("Добавьте хотя бы один товар!")
        return
    await state.set_state(CourierOrderCreate.waiting_address)
    await call.message.edit_text("Введите адрес доставки:")
    await call.answer()


@router.message(CourierOrderCreate.waiting_address)
async def courier_co_address(message: Message, state: FSMContext):
    await state.update_data(co_address=message.text.strip())
    data = await state.get_data()
    products = data.get("co_products", [])
    items = data.get("co_items", {})
    prod_map = {str(p["id"]): p for p in products}
    lines = [f"📋 <b>Подтверждение заказа</b>\n",
             f"Клиент: {data['co_phone']}", f"Адрес: {data['co_address']}", "\nТовары:"]
    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        s = p.get("price", 0) * qty
        total += s
        lines.append(f"  • {p.get('name', pid)} ×{qty} — {fmt(s)}")
    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Создать", callback_data="cco:confirm"),
        InlineKeyboardButton(text="❌ Отмена", callback_data="cco:cancel"),
    ]])
    await state.set_state(CourierOrderCreate.confirming)
    await message.answer("\n".join(lines), reply_markup=kb, parse_mode="HTML")


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:confirm")
async def courier_co_confirm(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    items = [{"product_id": int(pid), "quantity": qty} for pid, qty in data["co_items"].items()]
    try:
        await api.courier_create_order({
            "phone": data["co_phone"],
            "address": data["co_address"],
            "items": items,
            "payment_method": "cash",
        })
        await call.message.edit_text(f"✅ Заказ создан для клиента {data['co_phone']}!")
    except Exception:
        await call.message.edit_text(f"❌ Клиент с телефоном {data['co_phone']} не найден в системе.")
    await state.clear()
    await call.answer()
    await call.message.answer("Панель курьера:", reply_markup=courier_menu_kb())


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:cancel")
async def courier_co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    await call.message.answer("Панель курьера:", reply_markup=courier_menu_kb())
    await call.answer()


# ─── Order actions ────────────────────────────────────────────────────────────

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
        reply_markup=_order_detail_kb(order_id, "in_delivery", order),
    )
    await call.answer()


@router.callback_query(F.data.startswith("courier:in_delivery:"))
async def courier_in_delivery(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id, from_bot=True)
    order = await api.get_order(order_id)
    try:
        await call.message.edit_text(
            _order_detail_text(order),
            reply_markup=_order_detail_kb(order_id, "in_delivery", order),
            parse_mode="HTML",
        )
    except Exception:
        pass
    await call.answer("🚴 Выехал!")


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
            bonus_txt = f"\n🎁 Начислено {fmt(bonus)} бонусных баллов!" if bonus and bonus > 0 else ""
            await call.bot.send_message(
                client_tg,
                f"✔️ Ваш заказ доставлен!\n{brief}{bonus_txt}\n\nПожалуйста, оцените качество доставки:",
                reply_markup=review_kb(order_id),
            )
        except Exception:
            pass

    for admin_id in settings.ADMIN_IDS:
        try:
            await call.bot.send_message(
                admin_id,
                f"✔️ Доставлено!\nКурьер: {call.from_user.full_name}\n{brief}",
            )
        except Exception:
            pass

    managers = await api.get_managers()
    for mgr in managers:
        if mgr.get("is_active") and mgr.get("telegram_id") and mgr["telegram_id"] not in settings.ADMIN_IDS:
            try:
                await call.bot.send_message(mgr["telegram_id"], f"✔️ Доставлено: {brief}")
            except Exception:
                pass

    await call.message.edit_text(f"✔️ Доставлено: {brief}", reply_markup=None)
    if order.get("payment_method") == "cash":
        await call.message.answer(
            f"💵 Вы получили наличные?\n{brief}",
            reply_markup=courier_cash_confirm_kb(order_id),
        )
    await call.answer()


@router.callback_query(F.data.startswith("courier:cash_ok:"))
async def courier_cash_received(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    try:
        await api.update_order_cash_received(order_id)
    except Exception:
        pass
    await call.message.edit_text("✅ Наличные зафиксированы. Заказ помечен как доставленный!")
    await call.answer()


@router.callback_query(F.data.startswith("courier:cash_skip:"))
async def courier_cash_skip(call: CallbackQuery):
    await call.message.edit_text("✔️ Заказ помечен как доставленный! Безналичная оплата зафиксирована.")
    await call.answer()
