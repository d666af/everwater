from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, ReplyKeyboardRemove
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.courier import courier_menu_kb, courier_order_kb, courier_debt_kb
from config import settings

router = Router()

STATUS_RU = {
    "new": "🆕 Новый",
    "awaiting_confirmation": "⏳ Ожидает подтверждения",
    "confirmed": "✅ Подтверждён",
    "assigned_to_courier": "🚚 Назначен",
    "in_delivery": "🚴 В доставке",
    "delivered": "✔️ Доставлен",
    "rejected": "❌ Отклонён",
}


def fmt(v):
    return f"{int(v):,}".replace(",", " ") + " сум"


async def _get_courier(telegram_id: int):
    return await api.get_courier_by_telegram(telegram_id)


# ─── FSM ──────────────────────────────────────────────────────────────────────

class CourierOrderCreate(StatesGroup):
    waiting_phone = State()
    choosing_product = State()
    waiting_qty = State()
    waiting_address = State()
    confirming = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("courier"))
async def courier_panel(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        await message.answer("Вы не зарегистрированы как курьер.")
        return
    await message.answer(f"🚴 Панель курьера, {courier['name']}:", reply_markup=courier_menu_kb())


# ─── My orders ────────────────────────────────────────────────────────────────

@router.message(F.text == "📋 Мои заказы")
async def courier_orders(message: Message):
    courier = await _get_courier(message.from_user.id)
    if not courier:
        return
    orders = await api.get_courier_orders(message.from_user.id)
    active = [o for o in orders if o.get("status") not in ("delivered", "rejected")]
    if not active:
        await message.answer("У вас нет активных заказов.")
        return
    for o in active:
        items_text = "\n".join(f"  • {i['product_name']} ×{i['quantity']}" for i in o.get("items", []))
        status = STATUS_RU.get(o["status"], o["status"])
        text = (
            f"📦 <b>Заказ #{o['id']}</b> — {status}\n"
            f"Адрес: {o['address']}\n"
            f"Телефон: {o['recipient_phone']}\n"
            f"Время: {o.get('delivery_time') or '—'}\n"
            f"Товары:\n{items_text}\n"
            f"Сумма: {fmt(o['total'])}\n"
            f"Возврат бутылок: {o.get('return_bottles_count', 0)} шт."
        )
        await message.answer(text, reply_markup=courier_order_kb(o["id"], o["status"]), parse_mode="HTML")


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
        lines.append(f"{icon} #{d['id']} — {fmt(d['amount'])} (заказ #{d.get('order_id') or '—'}) [{d['status']}]")
    await message.answer("\n".join(lines), parse_mode="HTML")

    # Show request buttons for pending debts
    pending = [d for d in debts if d["status"] == "pending"]
    for d in pending[:3]:
        await message.answer(
            f"Долг #{d['id']} на {fmt(d['amount'])} — запросить погашение?",
            reply_markup=courier_debt_kb(d["id"])
        )


@router.callback_query(F.data.startswith("courier:debt_request:"))
async def courier_debt_request(call: CallbackQuery):
    debt_id = int(call.data.split(":")[2])
    await api.request_cash_clearance(debt_id)
    await call.message.edit_text(f"📤 Запрос на погашение долга #{debt_id} отправлен администратору.")
    # Notify admins
    for admin_id in settings.ADMIN_IDS:
        try:
            courier = await _get_courier(call.from_user.id)
            name = courier["name"] if courier else str(call.from_user.id)
            await call.bot.send_message(
                admin_id,
                f"💸 Курьер {name} запрашивает погашение долга #{debt_id}.\n"
                "Проверьте раздел «Долги курьеров» в /admin"
            )
        except Exception:
            pass
    await call.answer()


# ─── Create order by phone ────────────────────────────────────────────────────

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
    await state.update_data(co_phone=phone, co_products=products)
    await state.set_state(CourierOrderCreate.choosing_product)

    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=f"{p['name']} ({p.get('volume', '')}л) — {fmt(p['price'])}",
            callback_data=f"cco:add:{p['id']}"
        )] for p in products
    ] + [[InlineKeyboardButton(text="✅ Готово", callback_data="cco:done")]])
    await message.answer("Добавьте товары в заказ:", reply_markup=kb)


@router.callback_query(CourierOrderCreate.choosing_product, F.data.startswith("cco:add:"))
async def courier_co_add_product(call: CallbackQuery, state: FSMContext):
    pid = int(call.data.split(":")[2])
    data = await state.get_data()
    items = data.get("co_items", {})
    items[str(pid)] = items.get(str(pid), 0) + 1
    await state.update_data(co_items=items)
    products = data.get("co_products", [])
    product = next((p for p in products if p["id"] == pid), {})
    await call.answer(f"+ {product.get('name', pid)}")


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
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Создать", callback_data="cco:confirm"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="cco:cancel"),
        ]
    ])
    await state.set_state(CourierOrderCreate.confirming)
    await message.answer("\n".join(lines), reply_markup=kb, parse_mode="HTML")


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:confirm")
async def courier_co_confirm(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    items = [{"product_id": int(pid), "quantity": qty} for pid, qty in data["co_items"].items()]
    try:
        order = await api.courier_create_order({
            "phone": data["co_phone"],
            "address": data["co_address"],
            "items": items,
            "payment_method": "cash",
        })
        await state.clear()
        await call.message.edit_text(f"✅ Заказ #{order.get('id')} создан для клиента {data['co_phone']}!")
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка: клиент с телефоном {data['co_phone']} не найден в системе.")
        await state.clear()
    await call.answer()
    from keyboards.courier import courier_menu_kb
    await call.message.answer("Панель курьера:", reply_markup=courier_menu_kb())


@router.callback_query(CourierOrderCreate.confirming, F.data == "cco:cancel")
async def courier_co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    from keyboards.courier import courier_menu_kb
    await call.message.answer("Панель курьера:", reply_markup=courier_menu_kb())
    await call.answer()


# ─── Order actions ────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("courier:accept:"))
async def courier_accept(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.courier_accept_order(order_id)
    order = await api.get_order(order_id)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await call.bot.send_message(client_tg, f"🚴 Курьер принял ваш заказ #{order_id} и скоро выедет!")
        except Exception:
            pass
    await call.message.edit_text(
        f"✅ Вы приняли заказ #{order_id}.",
        reply_markup=courier_order_kb(order_id, "in_delivery"),
    )
    await call.answer()


@router.callback_query(F.data.startswith("courier:in_delivery:"))
async def courier_in_delivery(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id, from_bot=True)
    order = await api.get_order(order_id)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await call.bot.send_message(client_tg, f"🚴 Ваш заказ #{order_id} в пути! Курьер уже едет к вам.")
        except Exception:
            pass
    for admin_id in settings.ADMIN_IDS:
        try:
            await call.bot.send_message(admin_id, f"🚴 Курьер начал доставку заказа #{order_id}")
        except Exception:
            pass
    await call.message.edit_text(
        f"🚴 Заказ #{order_id} — в доставке.",
        reply_markup=courier_order_kb(order_id, "in_delivery"),
    )
    await call.answer()


@router.callback_query(F.data.startswith("courier:done:"))
async def courier_done(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.mark_delivered(order_id, from_bot=True)
    order = await api.get_order(order_id)

    from keyboards.user import review_kb
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await call.bot.send_message(
                client_tg,
                f"✔️ Ваш заказ #{order_id} доставлен!\nПожалуйста, оцените качество доставки:",
                reply_markup=review_kb(order_id),
            )
        except Exception:
            pass

    # Bonus info for client
    bonus = order.get("bonus_earned", 0)
    if bonus and bonus > 0 and client_tg:
        try:
            await call.bot.send_message(client_tg, f"🎁 Вам начислено {fmt(bonus)} бонусных баллов!")
        except Exception:
            pass

    for admin_id in settings.ADMIN_IDS:
        try:
            await call.bot.send_message(
                admin_id,
                f"✔️ Заказ #{order_id} доставлен!\nКурьер: {call.from_user.full_name}\nСумма: {fmt(order['total'])}"
            )
        except Exception:
            pass

    # Notify managers too
    managers = await api.get_managers()
    for mgr in managers:
        if mgr.get("is_active") and mgr.get("telegram_id") and mgr["telegram_id"] not in settings.ADMIN_IDS:
            try:
                await call.bot.send_message(mgr["telegram_id"], f"✔️ Заказ #{order_id} доставлен!")
            except Exception:
                pass

    await call.message.edit_text(f"✔️ Заказ #{order_id} помечен как доставленный!")
    await call.answer()
