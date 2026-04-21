from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
)
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.user import main_menu_kb, order_actions_kb, _site
from config import settings

_RU_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
_RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн",
               "июл", "авг", "сен", "окт", "ноя", "дек"]

router = Router()


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


def _short_name(p: dict) -> str:
    """Возвращает короткое название: '0.5л Вода' или '0.5л Газ. вода'."""
    vol = p.get("volume")
    is_carb = p.get("type") == "carbonated"
    vol_str = f"{vol}л " if vol else ""
    return f"{vol_str}{'Газ. вода' if is_carb else 'Вода'}"


# ─── FSM States ───────────────────────────────────────────────────────────────

class SurveyState(StatesGroup):
    asking_bottles = State()
    asking_count   = State()


class CheckoutState(StatesGroup):
    choosing_address  = State()
    waiting_address   = State()
    waiting_location  = State()
    waiting_landmark  = State()
    waiting_phone     = State()
    asking_return     = State()
    asking_bonus      = State()
    choosing_payment  = State()
    confirming        = State()


class SubscriptionState(StatesGroup):
    choosing_plan    = State()
    choosing_water   = State()   # now catalog-based, not text
    waiting_address  = State()
    waiting_landmark = State()   # NEW
    waiting_location = State()   # NEW (optional GPS)
    waiting_phone    = State()
    asking_bonus     = State()   # NEW
    choosing_payment = State()


class TopupState(StatesGroup):
    waiting_amount = State()


# ─── Survey after registration ────────────────────────────────────────────────

async def start_survey(message: Message, state: FSMContext):
    await state.set_state(SurveyState.asking_bottles)
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Да", callback_data="survey:yes"),
        InlineKeyboardButton(text="Нет", callback_data="survey:no"),
    ]])
    await message.answer("У вас есть пустые 19-литровые бутылки для возврата?", reply_markup=kb)


@router.callback_query(SurveyState.asking_bottles, F.data.startswith("survey:"))
async def survey_answer(call: CallbackQuery, state: FSMContext):
    if call.data == "survey:no":
        await state.clear()
        try:
            await call.message.edit_text("Отлично! Вы можете сделать заказ через каталог 🛒")
        except Exception:
            pass
        await call.answer()
        return
    await state.set_state(SurveyState.asking_count)
    counts = [1, 2, 3, 4, 5, 6, 10]
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=str(c), callback_data=f"survey_cnt:{c}") for c in counts],
        [InlineKeyboardButton(text="Другое число", callback_data="survey_cnt:other")],
    ])
    try:
        await call.message.edit_text("Сколько 19-литровых бутылок вернёте?", reply_markup=kb)
    except Exception:
        await call.message.answer("Сколько 19-литровых бутылок вернёте?", reply_markup=kb)
    await call.answer()


@router.callback_query(SurveyState.asking_count, F.data.startswith("survey_cnt:"))
async def survey_count_cb(call: CallbackQuery, state: FSMContext):
    val = call.data.split(":")[1]
    if val == "other":
        await call.message.edit_text("Введите количество бутылок:")
        await call.answer()
        return
    count = int(val)
    user = await api.get_user(call.from_user.id)
    if user:
        await api.change_bottles_owed(user["id"], count)
    await state.clear()
    try:
        await call.message.edit_text(f"Записали: {count} бутылок к возврату. Это учтётся при оформлении заказа.")
    except Exception:
        pass
    await call.answer()


@router.message(SurveyState.asking_count)
async def survey_count_text(message: Message, state: FSMContext):
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число бутылок.")
        return
    count = int(text)
    user = await api.get_user(message.from_user.id)
    if user:
        await api.change_bottles_owed(user["id"], count)
    await state.clear()
    await message.answer(f"Записали: {count} бутылок к возврату. Это учтётся при оформлении заказа.")


# ─── Catalog ─────────────────────────────────────────────────────────────────

def _catalog_kb(products: list, cart: dict, ftype: str = "all") -> InlineKeyboardMarkup:
    buttons = [[
        InlineKeyboardButton(text=("✅ " if ftype == "all" else "") + "Все", callback_data="cf:all"),
        InlineKeyboardButton(text=("✅ " if ftype == "still" else "") + "💧 Без газа", callback_data="cf:still"),
        InlineKeyboardButton(text=("✅ " if ftype == "carbonated" else "") + "🫧 Газ.", callback_data="cf:carbonated"),
    ]]

    for p in products:
        if ftype != "all" and p.get("type") != ftype:
            continue
        pid = str(p["id"])
        qty = cart.get(pid, {}).get("qty", 0)
        emoji = "🫧" if p.get("type") == "carbonated" else "💧"
        sname = _short_name(p)
        price_str = fmt(p["price"])

        if qty == 0:
            buttons.append([InlineKeyboardButton(
                text=f"{emoji} {sname} — {price_str}  ➕",
                callback_data=f"ca:{pid}",
            )])
        else:
            buttons.append([
                InlineKeyboardButton(text="➖", callback_data=f"cr:{pid}"),
                InlineKeyboardButton(text=f"×{qty}  {sname}", callback_data="noop"),
                InlineKeyboardButton(text="➕", callback_data=f"ca:{pid}"),
            ])

    if cart:
        total_qty = sum(v["qty"] for v in cart.values())
        total_sum = sum(v["price"] * v["qty"] for v in cart.values())
        buttons.append([InlineKeyboardButton(
            text=f"🛒 Корзина ({total_qty} шт.) — {fmt(total_sum)}",
            callback_data="show_cart",
        )])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _render_catalog(target, state: FSMContext, ftype: str = "all", edit: bool = False):
    products = await api.get_products() or []
    data = await state.get_data()
    cart = data.get("cart", {})
    for p in products:
        pid = str(p["id"])
        if pid in cart:
            cart[pid].update(name=p["name"], price=p["price"],
                             volume=p.get("volume", 0), product_id=p["id"])
    await state.update_data(products=products, cf=ftype, cart=cart)
    kb = _catalog_kb(products, cart, ftype)

    # Текст: список всех товаров с ценами
    lines = ["🛒 <b>Каталог воды Ever Water</b>\n"]
    shown = [p for p in products if ftype == "all" or p.get("type") == ftype]
    still = [p for p in shown if p.get("type") != "carbonated"]
    carb  = [p for p in shown if p.get("type") == "carbonated"]
    if still:
        lines.append("💧 <b>Без газа:</b>")
        for p in still:
            lines.append(f"  {_short_name(p)} — {fmt(p['price'])}")
    if carb:
        lines.append("\n🫧 <b>Газированная:</b>")
        for p in carb:
            lines.append(f"  {_short_name(p)} — {fmt(p['price'])}")
    lines.append("\n<i>Нажмите на товар чтобы добавить в корзину</i>")
    text = "\n".join(lines)

    if edit:
        msg = target.message if isinstance(target, CallbackQuery) else target
        await msg.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        msg = target if isinstance(target, Message) else target.message
        await msg.answer(text, reply_markup=kb, parse_mode="HTML")


def _sub_catalog_kb(products: list, cart: dict) -> InlineKeyboardMarkup:
    buttons = []
    for p in products:
        pid = str(p["id"])
        qty = cart.get(pid, {}).get("qty", 0)
        emoji = "🫧" if p.get("type") == "carbonated" else "💧"
        sname = _short_name(p)
        price_str = fmt(p["price"])
        if qty == 0:
            buttons.append([InlineKeyboardButton(
                text=f"{emoji} {sname} — {price_str}  ➕",
                callback_data=f"sca:{pid}",
            )])
        else:
            buttons.append([
                InlineKeyboardButton(text="➖", callback_data=f"scr:{pid}"),
                InlineKeyboardButton(text=f"×{qty}  {sname}", callback_data="noop"),
                InlineKeyboardButton(text="➕", callback_data=f"sca:{pid}"),
            ])
    if cart:
        total_qty = sum(v["qty"] for v in cart.values())
        buttons.append([InlineKeyboardButton(
            text=f"➡️ Продолжить ({total_qty} шт.)",
            callback_data="sub_water_done",
        )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _render_sub_catalog(target, state: FSMContext, edit: bool = False):
    products = await api.get_products() or []
    data = await state.get_data()
    cart = data.get("sub_cart", {})
    for p in products:
        pid = str(p["id"])
        if pid in cart:
            cart[pid].update(name=_short_name(p), price=p["price"])
    await state.update_data(products=products, sub_cart=cart)
    kb = _sub_catalog_kb(products, cart)
    lines = ["🛒 <b>Выберите воду для подписки:</b>\n"]
    still = [p for p in products if p.get("type") != "carbonated"]
    carb = [p for p in products if p.get("type") == "carbonated"]
    if still:
        lines.append("💧 <b>Без газа:</b>")
        for p in still:
            lines.append(f"  {_short_name(p)} — {fmt(p['price'])}")
    if carb:
        lines.append("\n🫧 <b>Газированная:</b>")
        for p in carb:
            lines.append(f"  {_short_name(p)} — {fmt(p['price'])}")
    text = "\n".join(lines)
    msg = target.message if isinstance(target, CallbackQuery) else target
    if edit:
        await msg.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await msg.answer(text, reply_markup=kb, parse_mode="HTML")


@router.message(F.text == "🛒 Заказать")
async def catalog(message: Message, state: FSMContext):
    await state.clear()
    await _render_catalog(message, state)


@router.callback_query(F.data.startswith("cf:"))
async def catalog_filter(call: CallbackQuery, state: FSMContext):
    await _render_catalog(call, state, ftype=call.data.split(":")[1], edit=True)
    await call.answer()


@router.callback_query(F.data.startswith("ca:"))
async def cart_add(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":")[1]
    data = await state.get_data()
    cart = data.get("cart", {})
    products = data.get("products") or await api.get_products() or []
    p = next((x for x in products if str(x["id"]) == pid), None)
    if not p:
        await call.answer("Товар не найден")
        return
    if pid not in cart:
        cart[pid] = {"name": _short_name(p), "price": p["price"],
                     "qty": 0, "volume": p.get("volume", 0), "product_id": p["id"]}
    cart[pid]["qty"] += 1
    await state.update_data(cart=cart)
    await _render_catalog(call, state, ftype=data.get("cf", "all"), edit=True)
    await call.answer()


@router.callback_query(F.data.startswith("cr:"))
async def cart_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":")[1]
    data = await state.get_data()
    cart = data.get("cart", {})
    if pid in cart:
        cart[pid]["qty"] -= 1
        if cart[pid]["qty"] <= 0:
            del cart[pid]
    await state.update_data(cart=cart)
    await _render_catalog(call, state, ftype=data.get("cf", "all"), edit=True)
    await call.answer()


@router.callback_query(F.data == "noop")
async def noop_cb(call: CallbackQuery):
    await call.answer()


# ─── Cart ─────────────────────────────────────────────────────────────────────

def _cart_kb(cart: dict) -> InlineKeyboardMarkup:
    rows = []
    for pid, item in cart.items():
        rows.append([InlineKeyboardButton(
            text=f"❌ {item['name']} × {item['qty']}",
            callback_data=f"cd:{pid}",
        )])
    rows.append([
        InlineKeyboardButton(text="🗑 Очистить", callback_data="cart_clear"),
        InlineKeyboardButton(text="✅ Оформить", callback_data="checkout_start"),
    ])
    rows.append([InlineKeyboardButton(text="← Каталог", callback_data="back_catalog")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def show_cart(target, state: FSMContext):
    data = await state.get_data()
    cart = data.get("cart", {})
    if not cart:
        text = "🛒 Корзина пуста."
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🛒 В каталог", callback_data="back_catalog")
        ]])
    else:
        lines = ["🛒 <b>Корзина</b>\n"]
        total = 0
        for item in cart.values():
            s = item["price"] * item["qty"]
            total += s
            lines.append(f"• {item['name']} × {item['qty']} — {fmt(s)}")
        lines.append(f"\n<b>Итого: {fmt(total)}</b>")
        lines.append("\n(Нажмите на товар, чтобы удалить)")
        text = "\n".join(lines)
        kb = _cart_kb(cart)

    if isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
        except Exception:
            await target.message.answer(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "show_cart")
async def show_cart_cb(call: CallbackQuery, state: FSMContext):
    await show_cart(call, state)
    await call.answer()


@router.callback_query(F.data == "back_catalog")
async def back_catalog(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await _render_catalog(call, state, ftype=data.get("cf", "all"), edit=True)
    await call.answer()


@router.callback_query(F.data.startswith("cd:"))
async def cart_delete_item(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":")[1]
    data = await state.get_data()
    cart = data.get("cart", {})
    cart.pop(pid, None)
    await state.update_data(cart=cart)
    await show_cart(call, state)
    await call.answer()


@router.callback_query(F.data == "cart_clear")
async def cart_clear(call: CallbackQuery, state: FSMContext):
    await state.update_data(cart={})
    await show_cart(call, state)
    await call.answer("Корзина очищена")


# ─── Checkout ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "checkout_start")
async def checkout_start(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("cart"):
        await call.answer("Корзина пуста!")
        return
    user = await api.get_user(call.from_user.id)
    if not user:
        await call.answer("Пользователь не найден")
        return
    saved = await api.get_addresses(user["id"]) or []
    await state.update_data(co_user=user, saved_addrs=saved)
    if saved:
        await state.set_state(CheckoutState.choosing_address)
        rows = [[InlineKeyboardButton(
            text=f"📍 {a.get('label') or a['address']}",
            callback_data=f"ua:{i}",
        )] for i, a in enumerate(saved)]
        rows.append([InlineKeyboardButton(text="✏️ Новый адрес", callback_data="new_addr")])
        await call.message.edit_text(
            "Выберите адрес доставки:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
    else:
        await state.set_state(CheckoutState.waiting_address)
        await call.message.edit_text("Введите адрес доставки:")
    await call.answer()


def _location_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📍 Отправить геолокацию", request_location=True)],
            [KeyboardButton(text="⏩ Пропустить")],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )



async def _ask_location(message: Message, state: FSMContext, addr: str):
    await state.set_state(CheckoutState.waiting_location)
    await message.answer(
        f"📍 Адрес: <b>{addr}</b>\n\n"
        "Отправьте геолокацию, чтобы курьер точно нашёл вас, или пропустите:",
        reply_markup=_location_kb(),
        parse_mode="HTML",
    )


@router.callback_query(CheckoutState.choosing_address, F.data.startswith("ua:"))
async def use_saved_addr(call: CallbackQuery, state: FSMContext):
    idx = int(call.data.split(":")[1])
    data = await state.get_data()
    addr = data["saved_addrs"][idx]
    await state.update_data(co_address=addr["address"],
                            co_lat=addr.get("lat"), co_lng=addr.get("lng"))
    await call.answer()
    if addr.get("lat"):
        await _ask_landmark(call.message, state)
    else:
        await _ask_location(call.message, state, addr["address"])


@router.callback_query(CheckoutState.choosing_address, F.data == "new_addr")
async def new_addr(call: CallbackQuery, state: FSMContext):
    await state.set_state(CheckoutState.waiting_address)
    await call.message.edit_text("Введите адрес доставки:")
    await call.answer()


@router.message(CheckoutState.waiting_address)
async def co_address(message: Message, state: FSMContext):
    await state.update_data(co_address=message.text.strip(), co_lat=None, co_lng=None)
    await _ask_location(message, state, message.text.strip())


# ── Локация ──────────────────────────────────────────────────────────────────

@router.message(CheckoutState.waiting_location, F.location)
async def co_location(message: Message, state: FSMContext):
    await state.update_data(co_lat=message.location.latitude,
                            co_lng=message.location.longitude)
    await message.answer("✅ Геолокация сохранена!", reply_markup=ReplyKeyboardRemove())
    await _ask_landmark(message, state)


@router.message(CheckoutState.waiting_location, F.text == "⏩ Пропустить")
async def co_location_skip(message: Message, state: FSMContext):
    await message.answer("Хорошо, пропускаем.", reply_markup=ReplyKeyboardRemove())
    await _ask_landmark(message, state)


async def _ask_landmark(message: Message, state: FSMContext):
    await state.set_state(CheckoutState.waiting_landmark)
    await message.answer(
        "Укажите ориентир для курьера (подъезд, этаж, домофон).\n"
        "Или нажмите кнопку чтобы пропустить:",
        reply_markup=ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="⏩ Пропустить")]],
            resize_keyboard=True, one_time_keyboard=True,
        ),
    )


@router.message(CheckoutState.waiting_landmark)
async def co_landmark(message: Message, state: FSMContext):
    val = message.text.strip()
    await state.update_data(co_extra=None if val in ("⏩ Пропустить", "—") else val)
    await message.answer("Принято!", reply_markup=ReplyKeyboardRemove())
    await _ask_phone(message, state)


# ── Телефон ───────────────────────────────────────────────────────────────────

async def _ask_phone(message: Message, state: FSMContext):
    data = await state.get_data()
    phone = data.get("co_user", {}).get("phone", "")
    await state.set_state(CheckoutState.waiting_phone)
    kb_rows = []
    if phone:
        kb_rows.append([KeyboardButton(text=f"✅ {phone}")])
    kb_rows.append([KeyboardButton(text="📱 Поделиться номером", request_contact=True)])
    await message.answer(
        "Телефон получателя:\nВыберите или введите номер:",
        reply_markup=ReplyKeyboardMarkup(keyboard=kb_rows, resize_keyboard=True, one_time_keyboard=True),
    )


@router.message(CheckoutState.waiting_phone)
async def co_phone(message: Message, state: FSMContext):
    data = await state.get_data()
    user_phone = data["co_user"].get("phone", "")
    if message.contact:
        phone = message.contact.phone_number
    elif message.text and message.text.startswith("✅ "):
        phone = user_phone
    else:
        phone = message.text.strip() if message.text else user_phone
    await state.update_data(co_phone=phone)

    bottles = await api.get_bottles_owed(data["co_user"]["id"])
    count = bottles.get("count", 0)
    await state.update_data(bottles_owed=count)

    cart = data.get("cart", {})
    has_20l = any(v.get("volume", 0) >= 18.9 for v in cart.values())

    if count > 0 and has_20l:
        await state.set_state(CheckoutState.asking_return)
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text=f"Да, верну {count} шт.", callback_data=f"rb:{count}"),
            InlineKeyboardButton(text="Нет", callback_data="rb:0"),
        ]])
        await message.answer(
            f"У вас числится {count} бутылок 20л к возврату. Вернёте при этой доставке?",
            reply_markup=kb,
        )
    else:
        await state.update_data(co_return=0)
        await _ask_bonus(message, state)


@router.callback_query(CheckoutState.asking_return, F.data.startswith("rb:"))
async def co_return(call: CallbackQuery, state: FSMContext):
    await state.update_data(co_return=int(call.data.split(":")[1]))
    await _ask_bonus(call.message, state)
    await call.answer()


async def _ask_bonus(message: Message, state: FSMContext):
    data = await state.get_data()
    bonus = data.get("co_user", {}).get("bonus_points", 0)
    if bonus and bonus > 0:
        await state.set_state(CheckoutState.asking_bonus)
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text=f"Использовать {fmt(bonus)}", callback_data=f"ub:{int(bonus)}"),
            InlineKeyboardButton(text="Не использовать", callback_data="ub:0"),
        ]])
        await message.answer(
            f"У вас {fmt(bonus)} бонусных баллов. Использовать при оплате?",
            reply_markup=kb,
        )
    else:
        await state.update_data(co_bonus=0)
        await _ask_payment(message, state)


@router.callback_query(CheckoutState.asking_bonus, F.data.startswith("ub:"))
async def co_bonus(call: CallbackQuery, state: FSMContext):
    await state.update_data(co_bonus=int(call.data.split(":")[1]))
    await _ask_payment(call.message, state)
    await call.answer()


async def _ask_payment(message: Message, state: FSMContext):
    await state.set_state(CheckoutState.choosing_payment)
    data = await state.get_data()
    balance = data.get("co_user", {}).get("balance", 0)
    rows = [
        [InlineKeyboardButton(text="💵 Наличные", callback_data="pm:cash")],
        [InlineKeyboardButton(text="💳 Карта", callback_data="pm:card")],
    ]
    if balance and balance > 0:
        rows.append([InlineKeyboardButton(text=f"💰 Баланс ({fmt(balance)})", callback_data="pm:balance")])
    await message.answer("Выберите способ оплаты:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(CheckoutState.choosing_payment, F.data.startswith("pm:"))
async def co_payment(call: CallbackQuery, state: FSMContext):
    await state.update_data(co_pay=call.data.split(":")[1])
    await state.set_state(CheckoutState.confirming)
    await _show_summary(call.message, state)
    await call.answer()


async def _show_summary(message: Message, state: FSMContext):
    data = await state.get_data()
    cart = data.get("cart", {})
    pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта", "balance": "💰 Баланс"}
    lines = ["<b>📋 Подтверждение заказа</b>\n", "<b>Товары:</b>"]
    total = 0
    for item in cart.values():
        s = item["price"] * item["qty"]
        total += s
        lines.append(f"  • {item['name']} × {item['qty']} — {fmt(s)}")
    geo = "✅ указана" if data.get("co_lat") else "—"
    lines += [
        f"\nСумма: {fmt(total)}",
        f"Адрес: {data.get('co_address', '—')}",
    ]
    if data.get("co_extra"):
        lines.append(f"Ориентир: {data['co_extra']}")
    lines += [
        f"Геолокация: {geo}",
        f"Телефон: {data.get('co_phone', '—')}",
        f"Оплата: {pay_labels.get(data.get('co_pay', ''), '—')}",
    ]
    if data.get("co_return", 0) > 0:
        lines.append(f"Бутылок к возврату: {data['co_return']} шт.")
    if data.get("co_bonus", 0) > 0:
        lines.append(f"Бонусы: −{fmt(data['co_bonus'])}")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Подтвердить", callback_data="co_confirm")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="co_cancel")],
    ])
    await message.answer("\n".join(lines), reply_markup=kb, parse_mode="HTML")


@router.callback_query(CheckoutState.confirming, F.data == "co_confirm")
async def co_confirm(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    user = data["co_user"]
    cart = data.get("cart", {})
    pay_method = data.get("co_pay", "cash")

    # Calculate balance_used when payment method is balance
    balance_used = 0
    if pay_method == "balance":
        subtotal = sum(v["price"] * v["qty"] for v in cart.values())
        balance_used = min(float(user.get("balance", 0)), subtotal)

    items = [
        {"product_id": v["product_id"], "quantity": v["qty"], "price": v["price"]}
        for v in cart.values()
    ]
    order = await api.create_order({
        "user_id": user["id"],
        "items": items,
        "address": data.get("co_address", ""),
        "extra_info": data.get("co_extra"),
        "latitude": data.get("co_lat"),
        "longitude": data.get("co_lng"),
        "recipient_phone": data.get("co_phone", user.get("phone", "")),
        "return_bottles_count": data.get("co_return", 0),
        "bonus_used": data.get("co_bonus", 0),
        "balance_used": balance_used,
        "payment_method": pay_method,
    })
    if not order or "id" not in order:
        await call.message.answer("Ошибка при создании заказа. Попробуйте ещё раз.")
        await call.answer()
        return

    order_id = order["id"]

    # Save address if it was typed manually (not from saved addresses)
    addr = data.get("co_address", "")
    saved_addrs = data.get("saved_addrs", [])
    is_new_address = addr and not any(a.get("address") == addr for a in saved_addrs)
    if is_new_address:
        try:
            await api.save_address(user["id"], {
                "address": addr,
                "latitude": data.get("co_lat"),
                "longitude": data.get("co_lng"),
            })
        except Exception:
            pass

    await state.update_data(cart={})
    await state.clear()

    PAY_LABELS = {"cash": "Наличными курьеру", "card": "Карта", "balance": "Баланс"}
    # Notify admins + managers about new order (cash/balance — no payment step)
    if pay_method != "card":
        from keyboards.admin import order_confirm_kb
        notification_text = (
            f"🆕 Новый заказ #{order_id}!\n"
            f"Клиент: {user.get('name', '—')} | {data.get('co_phone', user.get('phone', '—'))}\n"
            f"Адрес: {addr}\n"
            f"Сумма: {fmt(order.get('total', 0))}\nОплата: {PAY_LABELS.get(pay_method, pay_method)}"
        )
        for admin_id in settings.ADMIN_IDS:
            try:
                await call.bot.send_message(admin_id, notification_text, reply_markup=order_confirm_kb(order_id))
            except Exception:
                pass
        managers = await api.get_managers()
        for mgr in managers:
            if mgr.get("is_active") and mgr.get("telegram_id"):
                try:
                    await call.bot.send_message(mgr["telegram_id"], notification_text,
                                                 reply_markup=order_confirm_kb(order_id))
                except Exception:
                    pass

    if pay_method == "card":
        await call.message.edit_text(
            f"✅ Заказ создан!\n\n"
            f"Переведите <b>{fmt(order.get('total', 0))}</b> на карту:\n\n"
            f"💳 <b>{settings.PAYMENT_CARD}</b>\n"
            f"Получатель: {settings.PAYMENT_HOLDER}\n\n"
            "После оплаты нажмите кнопку ниже:",
            reply_markup=order_actions_kb(order_id),
            parse_mode="HTML",
        )
    else:
        await call.message.edit_text(
            "✅ Заказ создан!\n"
            "Ожидайте звонка оператора для подтверждения."
        )
        await call.message.answer("Главное меню:", reply_markup=main_menu_kb())
    await call.answer()


@router.callback_query(CheckoutState.confirming, F.data == "co_cancel")
async def co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb())
    await call.answer()


# ─── Subscriptions ────────────────────────────────────────────────────────────

@router.message(F.text == "📋 Подписки")
async def subscriptions(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    await state.update_data(sub_user=user)
    subs = await api.get_subscriptions(user["id"]) or []
    active = [s for s in subs if s.get("status") == "active"]

    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    if active:
        lines = ["<b>📋 Активные подписки:</b>\n"]
        for s in active:
            lines.append(
                f"• {plan_label.get(s.get('plan', ''), s.get('plan', ''))}"
                f" | {s.get('water_summary', '')} | {s.get('qty', '')} шт.\n"
                f"  День: {s.get('day', '—')} | Адрес: {s.get('address', '—')}"
            )
        rows = [[InlineKeyboardButton(text="➕ Добавить подписку", callback_data="sub_new")]]
        for s in active:
            rows.append([InlineKeyboardButton(
                text=f"❌ Отменить #{s['id']}",
                callback_data=f"sub_del:{s['id']}",
            )])
        await message.answer("\n".join(lines),
                             reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
                             parse_mode="HTML")
    else:
        await message.answer(
            "У вас нет активных подписок.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="➕ Оформить подписку", callback_data="sub_new")
            ]]),
        )


@router.callback_query(F.data.startswith("sub_del:"))
async def sub_cancel(call: CallbackQuery, state: FSMContext):
    sub_id = int(call.data.split(":")[1])
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    if user:
        await api.cancel_subscription(user["id"], sub_id)
    await call.message.edit_text("Подписка отменена.")
    await call.answer()


@router.callback_query(F.data == "sub_new")
async def sub_new(call: CallbackQuery, state: FSMContext):
    await state.set_state(SubscriptionState.choosing_plan)
    await call.message.edit_text(
        "Выберите план подписки:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📅 Еженедельная", callback_data="sp:weekly")],
            [InlineKeyboardButton(text="🗓 Ежемесячная", callback_data="sp:monthly")],
        ]),
    )
    await call.answer()


@router.callback_query(SubscriptionState.choosing_plan, F.data.startswith("sp:"))
async def sub_plan(call: CallbackQuery, state: FSMContext):
    await state.update_data(sub_plan=call.data.split(":")[1], sub_cart={})
    await state.set_state(SubscriptionState.choosing_water)
    await _render_sub_catalog(call, state, edit=True)
    await call.answer()


@router.callback_query(SubscriptionState.choosing_water, F.data.startswith("sca:"))
async def sub_cart_add(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":")[1]
    data = await state.get_data()
    cart = data.get("sub_cart", {})
    products = data.get("products") or await api.get_products() or []
    p = next((x for x in products if str(x["id"]) == pid), None)
    if not p:
        await call.answer("Товар не найден")
        return
    if pid not in cart:
        cart[pid] = {"name": _short_name(p), "price": p["price"], "qty": 0}
    cart[pid]["qty"] += 1
    await state.update_data(sub_cart=cart)
    await _render_sub_catalog(call, state, edit=True)
    await call.answer()


@router.callback_query(SubscriptionState.choosing_water, F.data.startswith("scr:"))
async def sub_cart_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":")[1]
    data = await state.get_data()
    cart = data.get("sub_cart", {})
    if pid in cart:
        cart[pid]["qty"] = max(0, cart[pid]["qty"] - 1)
        if cart[pid]["qty"] == 0:
            del cart[pid]
    await state.update_data(sub_cart=cart)
    await _render_sub_catalog(call, state, edit=True)
    await call.answer()


@router.callback_query(SubscriptionState.choosing_water, F.data == "sub_water_done")
async def sub_water_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("sub_cart"):
        await call.answer("Выберите хотя бы один товар", show_alert=True)
        return
    await state.set_state(SubscriptionState.waiting_address)
    await call.message.edit_text("Введите адрес доставки:")
    await call.answer()


@router.message(SubscriptionState.waiting_address)
async def sub_address(message: Message, state: FSMContext):
    await state.update_data(sub_address=message.text.strip())
    await state.set_state(SubscriptionState.waiting_landmark)
    await message.answer("Введите ориентир (подъезд, этаж, код домофона и т.д.):")


@router.message(SubscriptionState.waiting_landmark)
async def sub_landmark(message: Message, state: FSMContext):
    await state.update_data(sub_landmark=message.text.strip())
    await state.set_state(SubscriptionState.waiting_location)
    await message.answer(
        "Хотите отправить геолокацию для точной доставки?",
        reply_markup=ReplyKeyboardMarkup(keyboard=[
            [KeyboardButton(text="📍 Отправить геолокацию", request_location=True)],
            [KeyboardButton(text="⏩ Пропустить")],
        ], resize_keyboard=True, one_time_keyboard=True),
    )


@router.message(SubscriptionState.waiting_location, F.location)
async def sub_location(message: Message, state: FSMContext):
    loc = message.location
    await state.update_data(sub_lat=loc.latitude, sub_lon=loc.longitude)
    await _sub_ask_phone(message, state)


@router.message(SubscriptionState.waiting_location, F.text == "⏩ Пропустить")
async def sub_location_skip(message: Message, state: FSMContext):
    await _sub_ask_phone(message, state)


async def _sub_ask_phone(message: Message, state: FSMContext):
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(message.from_user.id)
    phone = user.get("phone", "") if user else ""
    await state.update_data(sub_user=user)
    await state.set_state(SubscriptionState.waiting_phone)
    await message.answer(
        f"Телефон получателя (текущий: {phone}). Введите номер или «-» для текущего:",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(SubscriptionState.waiting_phone)
async def sub_phone(message: Message, state: FSMContext):
    data = await state.get_data()
    if message.text.strip() == "-":
        user = data.get("sub_user") or await api.get_user(message.from_user.id)
        phone = user.get("phone", "") if user else ""
    else:
        phone = message.text.strip()
    await state.update_data(sub_phone=phone)
    await _sub_ask_bonus(message, state)


async def _sub_ask_bonus(message: Message, state: FSMContext):
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(message.from_user.id)
    bonus = int(user.get("bonus_points", 0)) if user else 0
    if bonus > 0:
        await state.set_state(SubscriptionState.asking_bonus)
        await message.answer(
            f"У вас {fmt(bonus)} бонусных баллов. Использовать при оплате подписки?",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text=f"Использовать {fmt(bonus)}", callback_data=f"sub_ub:{bonus}"),
                InlineKeyboardButton(text="Не использовать", callback_data="sub_ub:0"),
            ]]),
        )
    else:
        await state.update_data(sub_bonus=0)
        await _sub_ask_payment(message, state)


@router.callback_query(SubscriptionState.asking_bonus, F.data.startswith("sub_ub:"))
async def sub_bonus(call: CallbackQuery, state: FSMContext):
    await state.update_data(sub_bonus=int(call.data.split(":")[1]))
    await _sub_ask_payment(call.message, state)
    await call.answer()


async def _sub_ask_payment(message: Message, state: FSMContext):
    await state.set_state(SubscriptionState.choosing_payment)
    data = await state.get_data()
    user = data.get("sub_user") or {}
    balance = int(user.get("balance", 0))
    rows = [
        [InlineKeyboardButton(text="💵 Наличные", callback_data="subpm:cash")],
        [InlineKeyboardButton(text="💳 Карта", callback_data="subpm:card")],
    ]
    if balance > 0:
        rows.append([InlineKeyboardButton(text=f"💰 Баланс ({fmt(balance)})", callback_data="subpm:balance")])
    await message.answer("Выберите способ оплаты:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(SubscriptionState.choosing_payment, F.data.startswith("subpm:"))
async def sub_payment(call: CallbackQuery, state: FSMContext):
    method = call.data.split(":")[1]
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    if not user:
        await call.answer("Пользователь не найден")
        return
    cart = data.get("sub_cart", {})
    water_parts = [f"{v['name']} ×{v['qty']}" for v in cart.values() if v.get("qty", 0) > 0]
    water_summary = ", ".join(water_parts)
    result = await api.create_subscription(user["id"], {
        "plan": data.get("sub_plan"),
        "water_summary": water_summary,
        "address": data.get("sub_address"),
        "landmark": data.get("sub_landmark", ""),
        "phone": data.get("sub_phone"),
        "payment_method": method,
        "bonus_used": data.get("sub_bonus", 0),
    })
    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    pay_label = {"cash": "Наличные", "card": "Карта", "balance": "Баланс"}
    if result:
        await call.message.edit_text(
            f"✅ Подписка оформлена!\n\n"
            f"План: {plan_label.get(data.get('sub_plan', ''), '')}\n"
            f"Вода: {water_summary}\n"
            f"Адрес: {data.get('sub_address')}\n"
            f"Ориентир: {data.get('sub_landmark', '—')}\n"
            f"Оплата: {pay_label.get(method, method)}"
        )
        notification = (
            f"📋 Новая подписка!\n"
            f"Клиент: {user.get('name', '—')} | {data.get('sub_phone', '—')}\n"
            f"Вода: {water_summary}\n"
            f"Адрес: {data.get('sub_address', '—')}\n"
            f"Ориентир: {data.get('sub_landmark', '—')}\n"
            f"Оплата: {pay_label.get(method, method)}"
        )
        for admin_id in settings.ADMIN_IDS:
            try:
                await call.bot.send_message(admin_id, notification)
            except Exception:
                pass
        managers = await api.get_managers()
        for mgr in managers:
            if mgr.get("is_active") and mgr.get("telegram_id"):
                try:
                    await call.bot.send_message(mgr["telegram_id"], notification)
                except Exception:
                    pass
    else:
        await call.message.edit_text("Ошибка при оформлении подписки. Попробуйте ещё раз.")
    await state.clear()
    await call.answer()


# ─── Support Chat ─────────────────────────────────────────────────────────────

_QUICK_QUESTIONS = [
    "Где мой заказ?",
    "Хочу отменить заказ",
    "Проблема с оплатой",
    "Другой вопрос",
]


@router.message(F.text == "💬 Поддержка")
async def support_menu(message: Message):
    user = await api.get_user(message.from_user.id)
    history_text = ""
    if user:
        try:
            msgs = await api.get_client_support_messages(message.from_user.id)
            if msgs:
                recent = msgs[-5:]
                lines = ["<b>📜 Последние сообщения:</b>"]
                for m in recent:
                    who = "Вы" if m.get("sender") == "client" else "Оператор"
                    text_short = (m.get("text") or "")[:60]
                    lines.append(f"<i>{who}:</i> {text_short}")
                history_text = "\n".join(lines) + "\n\n"
        except Exception:
            pass

    quick_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=q, callback_data=f"sup_q:{i}")]
        for i, q in enumerate(_QUICK_QUESTIONS)
    ] + [
        [InlineKeyboardButton(text="🌐 Открыть чат на сайте", url=_site("/support"))]
    ])
    await message.answer(
        f"{history_text}💬 <b>Поддержка</b>\n\n"
        "Выберите тему или напишите вопрос — оператор ответит в ближайшее время:",
        reply_markup=quick_kb,
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("sup_q:"))
async def support_quick(call: CallbackQuery):
    idx = int(call.data.split(":")[1])
    question = _QUICK_QUESTIONS[idx] if idx < len(_QUICK_QUESTIONS) else "Вопрос"
    tg_id = call.from_user.id
    name = call.from_user.full_name or str(tg_id)
    try:
        await api.send_user_support_message(tg_id, name, question)
        await call.message.edit_text(
            f"✉️ Сообщение «{question}» отправлено в поддержку. Ожидайте ответа."
        )
    except Exception:
        await call.answer("Не удалось отправить. Попробуйте позже.", show_alert=True)
    await call.answer()


@router.message(F.text & ~F.text.startswith("/"))
async def forward_to_support(message: Message, state: FSMContext):
    """Catch-all: forward unhandled text to support chat."""
    current_state = await state.get_state()
    if current_state is not None:
        return
    tg_id = message.from_user.id
    name = message.from_user.full_name or str(tg_id)

    try:
        await api.send_user_support_message(tg_id, name, message.text)
        await message.answer("✉️ Сообщение отправлено. Оператор ответит в ближайшее время.")
    except Exception:
        await message.answer("✉️ Не удалось отправить сообщение. Попробуйте позже.")


# ─── Balance Topup ────────────────────────────────────────────────────────────

def _topup_presets_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="5 000", callback_data="tp_preset:5000"),
            InlineKeyboardButton(text="10 000", callback_data="tp_preset:10000"),
        ],
        [
            InlineKeyboardButton(text="20 000", callback_data="tp_preset:20000"),
            InlineKeyboardButton(text="50 000", callback_data="tp_preset:50000"),
        ],
        [InlineKeyboardButton(text="✏️ Другая сумма", callback_data="tp_preset:custom")],
    ])


@router.message(F.text == "💰 Пополнить")
async def topup_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "Выберите сумму пополнения или введите свою:",
        reply_markup=_topup_presets_kb(),
    )


@router.callback_query(F.data.startswith("tp_preset:"))
async def topup_preset(call: CallbackQuery, state: FSMContext):
    val = call.data.split(":")[1]
    if val == "custom":
        await state.set_state(TopupState.waiting_amount)
        await call.message.edit_text("Введите сумму пополнения баланса (в сум):")
        await call.answer()
        return
    amount = int(val)
    user = await api.get_user(call.from_user.id)
    user_id = user["id"] if user else None
    await call.message.edit_text(
        f"Для пополнения на <b>{fmt(amount)}</b> переведите средства на карту:\n\n"
        f"💳 <b>{settings.PAYMENT_CARD}</b>\n"
        f"Получатель: {settings.PAYMENT_HOLDER}\n\n"
        "После перевода нажмите кнопку ниже:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Я оплатил", callback_data=f"tp:{amount}:{user_id}")
        ]]),
        parse_mode="HTML",
    )
    await call.answer()


@router.message(TopupState.waiting_amount)
async def topup_amount(message: Message, state: FSMContext):
    text = message.text.strip().replace(" ", "")
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректную сумму числом.")
        return
    amount = int(text)
    user = await api.get_user(message.from_user.id)
    user_id = user["id"] if user else None
    await state.clear()
    await message.answer(
        f"Для пополнения на <b>{fmt(amount)}</b> переведите средства на карту:\n\n"
        f"💳 <b>{settings.PAYMENT_CARD}</b>\n"
        f"Получатель: {settings.PAYMENT_HOLDER}\n\n"
        "После перевода нажмите кнопку ниже:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Я оплатил", callback_data=f"tp:{amount}:{user_id}")
        ]]),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("tp:"))
async def topup_paid(call: CallbackQuery):
    parts = call.data.split(":")
    amount = int(parts[1])
    user_id = parts[2] if len(parts) > 2 else "?"
    from aiogram import Bot
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    bot: Bot = call.bot
    confirm_kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text=f"✅ Подтвердить {fmt(amount)}",
            callback_data=f"admin_topup_confirm:{user_id}:{amount}:{call.from_user.id}",
        ),
        InlineKeyboardButton(
            text="❌ Отклонить",
            callback_data=f"admin_topup_reject:{user_id}:{amount}:{call.from_user.id}",
        ),
    ]])
    notification_text = (
        f"💰 Запрос на пополнение баланса!\n"
        f"Пользователь: {call.from_user.full_name} (tg: {call.from_user.id})\n"
        f"ID в системе: {user_id}\n"
        f"Сумма: {fmt(amount)}"
    )
    for admin_id in settings.ADMIN_IDS:
        try:
            await bot.send_message(
                admin_id,
                notification_text,
                reply_markup=confirm_kb,
            )
        except Exception:
            pass
    managers = await api.get_managers()
    for mgr in managers:
        if mgr.get("is_active") and mgr.get("telegram_id"):
            try:
                await bot.send_message(mgr["telegram_id"], notification_text, reply_markup=confirm_kb)
            except Exception:
                pass
    await call.message.edit_text(
        f"✅ Заявка на пополнение {fmt(amount)} отправлена.\n"
        "Баланс будет зачислен после проверки администратором."
    )
    await call.answer()
