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
from services.roles import get_all_admin_ids

_RU_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
_RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн",
               "июл", "авг", "сен", "окт", "ноя", "дек"]

router = Router()


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


def _cart_summary(cart: dict) -> str:
    parts = [f"{v['name']} {v['qty']} шт." for v in list(cart.values())[:3]]
    extra = f" +ещё {len(cart) - 3}" if len(cart) > 3 else ""
    total = sum(_item_eff_price(v) * v["qty"] for v in cart.values())
    return f"{', '.join(parts)}{extra} · {fmt(total)}"


def _item_eff_price(item: dict) -> float:
    """Effective display price for a cart item (uses deposit_price if deposit product)."""
    if item.get("has_bottle_deposit") and item.get("deposit_price"):
        return item["deposit_price"]
    return item["price"]


def _short_name(p: dict) -> str:
    """Display name for a product. Uses the admin-configured product.name
    (so renames in the admin panel are reflected immediately); falls back
    to a volume-based label only when name is missing."""
    name = (p.get("name") or "").strip()
    if name:
        return name
    vol = p.get("volume")
    is_carb = p.get("type") == "carbonated"
    vol_str = f"{vol}л " if vol else ""
    return f"{vol_str}{'Газ. вода' if is_carb else 'Вода'}"


# ─── FSM States ───────────────────────────────────────────────────────────────

ALL_BOTTLE_COMPANIES = ['Grand Water', 'Fresco', 'Hamd', 'Hydrolife', 'Zam-Zam', 'Kavsar', 'Montella']


class SurveyState(StatesGroup):
    asking_source  = State()
    asking_company = State()
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
    asking_save_addr  = State()


class CatalogState(StatesGroup):
    waiting_custom_qty = State()


class SubscriptionState(StatesGroup):
    choosing_plan        = State()
    choosing_water       = State()
    choosing_address     = State()
    waiting_address      = State()
    waiting_landmark     = State()
    waiting_location     = State()
    waiting_phone        = State()
    asking_bonus         = State()
    choosing_payment     = State()
    waiting_card_payment = State()



# ─── Survey after registration ────────────────────────────────────────────────

async def start_survey(message: Message, state: FSMContext):
    from keyboards.user import _site
    from aiogram.types import WebAppInfo
    site_url = _site("/")
    site_btn = (
        InlineKeyboardButton(text="📱 Открыть на сайте", web_app=WebAppInfo(url=site_url))
        if site_url.startswith("https")
        else InlineKeyboardButton(text="📱 Открыть на сайте", url=site_url)
    )
    await state.set_state(SurveyState.asking_source)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Наши бутылки", callback_data="survey_src:our")],
        [InlineKeyboardButton(text="🔄 Другой бренд", callback_data="survey_src:other")],
        [InlineKeyboardButton(text="❌ Нет бутылок", callback_data="survey_src:no")],
        [site_btn],
    ])
    sent = await message.answer("У вас есть пустые 19-литровые бутылки для возврата?", reply_markup=kb)
    # Save msg_id so mini app can sync this message
    user = await api.get_user(message.from_user.id)
    if user:
        await api.save_bottle_survey_msg(user["id"], sent.message_id)


@router.callback_query(SurveyState.asking_source, F.data.startswith("survey_src:"))
async def survey_source(call: CallbackQuery, state: FSMContext):
    src = call.data.split(":")[1]
    if src == "no":
        await state.clear()
        user = await api.get_user(call.from_user.id)
        if user:
            await api.mark_bottle_survey_done(user["id"], 0)
        await call.message.edit_text("Хорошо! Вы можете сделать заказ через каталог 🛒")
        await call.answer()
        return
    if src == "our":
        await state.update_data(survey_company="our", survey_accepted=True)
        await _survey_ask_count(call, state)
        await call.answer()
        return
    # other: check require_bottle_brand_selection setting
    try:
        settings_data = await api.get_settings()
        require_brand = settings_data.get("require_bottle_brand_selection", False) if settings_data else False
        accepted = settings_data.get("accepted_bottle_companies", []) if settings_data else []
    except Exception:
        require_brand = False
        accepted = []

    if not require_brand or not accepted:
        # Brand selection disabled or no brands configured — accept all foreign bottles
        await state.update_data(survey_company="other", survey_accepted=True)
        await _survey_ask_count(call, state)
        await call.answer()
        return

    await state.update_data(survey_accepted_companies=accepted)
    await state.set_state(SurveyState.asking_company)
    rows = [[InlineKeyboardButton(text=company, callback_data=f"survey_co:{company}")] for company in accepted]
    try:
        await call.message.edit_text(
            "Выберите бренд ваших бутылок:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
    except Exception:
        await call.message.answer(
            "Выберите бренд ваших бутылок:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
    await call.answer()


@router.callback_query(SurveyState.asking_company, F.data.startswith("survey_co:"))
async def survey_company(call: CallbackQuery, state: FSMContext):
    company = call.data[len("survey_co:"):]
    # All shown brands are from the accepted list, so always accepted
    await state.update_data(survey_company=company, survey_accepted=True)
    await _survey_ask_count(call, state)
    await call.answer()


async def _survey_ask_count(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    is_accepted = data.get("survey_accepted", True)
    await state.set_state(SurveyState.asking_count)
    counts = [1, 2, 3, 4, 5, 6, 10]
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=str(c), callback_data=f"survey_cnt:{c}") for c in counts],
        [InlineKeyboardButton(text="Другое число", callback_data="survey_cnt:other")],
    ])
    warning = (
        "\n\n⚠️ Мы не принимаем бутылки этого бренда — укажите количество для справки."
        if not is_accepted else ""
    )
    msg = f"Сколько 19-литровых бутылок вернёте?{warning}"
    try:
        await call.message.edit_text(msg, reply_markup=kb)
    except Exception:
        await call.message.answer(msg, reply_markup=kb)


@router.callback_query(SurveyState.asking_count, F.data.startswith("survey_cnt:"))
async def survey_count_cb(call: CallbackQuery, state: FSMContext):
    val = call.data.split(":")[1]
    if val == "other":
        await call.message.edit_text("Введите количество бутылок:")
        await call.answer()
        return
    count = int(val)
    data = await state.get_data()
    is_accepted = data.get("survey_accepted", True)
    actual_count = count if is_accepted else 0
    user = await api.get_user(call.from_user.id)
    if user:
        await api.mark_bottle_survey_done(user["id"], actual_count)
    await state.clear()
    if is_accepted:
        msg = f"Записали: {count} бутылок к возврату. Это учтётся при оформлении заказа."
    else:
        msg = "Понято. Бутылки этого бренда не принимаются, поэтому при заказе они не учитываются."
    await call.message.edit_text(msg)
    await call.answer()


@router.message(SurveyState.asking_count)
async def survey_count_text(message: Message, state: FSMContext):
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число бутылок.")
        return
    count = int(text)
    data = await state.get_data()
    is_accepted = data.get("survey_accepted", True)
    actual_count = count if is_accepted else 0
    user = await api.get_user(message.from_user.id)
    if user:
        await api.mark_bottle_survey_done(user["id"], actual_count)
    await state.clear()
    if is_accepted:
        await message.answer(f"Записали: {count} бутылок к возврату. Это учтётся при оформлении заказа.")
    else:
        await message.answer("Понято. Бутылки этого бренда не принимаются.")


# ─── Catalog ─────────────────────────────────────────────────────────────────

def _eff_price(p: dict, disc_val: float = 0, disc_type: str = "fixed") -> float:
    """Return the effective display price (with return discount) for deposit products."""
    if not p.get("has_bottle_deposit"):
        return p["price"]
    if p.get("deposit_price") and p["deposit_price"] > 0:
        return p["deposit_price"]
    if disc_val <= 0:
        return p["price"]
    if disc_type == "percent":
        return max(0, round(p["price"] * (1 - disc_val / 100)))
    return max(0, p["price"] - disc_val)


def _catalog_grid_kb(products: list, cart: dict) -> InlineKeyboardMarkup:
    """2-per-row product picker. Tapping a product opens a quantity sheet.
    'Далее' appears at the bottom only when the cart is non-empty.
    """
    rows = []
    pair = []
    for p in products:
        pid = str(p["id"])
        emoji = "🫧" if p.get("type") == "carbonated" else "💧"
        sname = _short_name(p)
        label = f"{emoji} {sname}"
        pair.append(InlineKeyboardButton(text=label, callback_data=f"cp:{pid}"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)

    if cart:
        rows.append([InlineKeyboardButton(
            text="▶ Далее",
            callback_data="checkout_start",
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _render_catalog(target, state: FSMContext, edit: bool = False):
    products = await api.get_products() or []
    data = await state.get_data()
    cart = data.get("cart", {})
    # Sync names/prices from fresh product data (in case admin changed them)
    for p in products:
        pid = str(p["id"])
        if pid in cart:
            cart[pid].update(name=_short_name(p), price=p["price"],
                             volume=p.get("volume", 0), product_id=p["id"],
                             has_bottle_deposit=p.get("has_bottle_deposit", False),
                             deposit_price=p.get("deposit_price"),
                             bottle_surcharge=p.get("bottle_surcharge"))
    try:
        cfg = await api.get_settings() or {}
    except Exception:
        cfg = {}
    disc_type = cfg.get("bottle_discount_type", "fixed")
    disc_val = float(cfg.get("bottle_discount_value") or 0)

    await state.update_data(products=products, cart=cart)
    kb = _catalog_grid_kb(products, cart)

    # Concise text: header + price list. No long instructions.
    lines = ["🛒 <b>Каталог</b>", ""]
    still = [p for p in products if p.get("type") != "carbonated"]
    carb = [p for p in products if p.get("type") == "carbonated"]
    if still:
        for p in still:
            lines.append(f"💧 {_short_name(p)} — {fmt(p['price'])}")
    if carb:
        if still:
            lines.append("")
        for p in carb:
            lines.append(f"🫧 {_short_name(p)} — {fmt(p['price'])}")

    if cart:
        total_qty = sum(v["qty"] for v in cart.values())
        total_sum = sum(_item_eff_price(v) * v["qty"] for v in cart.values())
        lines.append("")
        lines.append(f"📦 <b>В корзине:</b>")
        # Preserve insertion order; products appear top-to-bottom as added
        for pid, item in cart.items():
            lines.append(f"   • {item['name']} × {item['qty']} шт.")
        lines.append(f"\nИтого: <b>{total_qty} шт. · {fmt(total_sum)}</b>")

    text = "\n".join(lines)

    if edit:
        msg = target.message if isinstance(target, CallbackQuery) else target
        try:
            await msg.edit_text(text, reply_markup=kb, parse_mode="HTML")
            new_id = msg.message_id
        except Exception:
            sent = await msg.answer(text, reply_markup=kb, parse_mode="HTML")
            new_id = sent.message_id
    else:
        msg = target if isinstance(target, Message) else target.message
        # Drop the previous catalog message (if any) before sending the new one
        prev_id = data.get("catalog_msg_id")
        if prev_id:
            try:
                await msg.bot.delete_message(msg.chat.id, prev_id)
            except Exception:
                pass
        sent = await msg.answer(text, reply_markup=kb, parse_mode="HTML")
        new_id = sent.message_id

    await state.update_data(catalog_msg_id=new_id)


# ─── Quantity picker (per-product) ─────────────────────────────────────────────

def _qty_kb(pid: str, qty: int) -> InlineKeyboardMarkup:
    rows = [
        # Live counter
        [
            InlineKeyboardButton(text="➖", callback_data=f"qd:{pid}:-1"),
            InlineKeyboardButton(text=f"{qty} шт.", callback_data="noop"),
            InlineKeyboardButton(text="➕", callback_data=f"qd:{pid}:1"),
        ],
        # Quick presets
        [
            InlineKeyboardButton(text="1", callback_data=f"qs:{pid}:1"),
            InlineKeyboardButton(text="2", callback_data=f"qs:{pid}:2"),
            InlineKeyboardButton(text="3", callback_data=f"qs:{pid}:3"),
        ],
        [
            InlineKeyboardButton(text="5", callback_data=f"qs:{pid}:5"),
            InlineKeyboardButton(text="10", callback_data=f"qs:{pid}:10"),
            InlineKeyboardButton(text="20", callback_data=f"qs:{pid}:20"),
        ],
    ]
    actions = []
    if qty > 0:
        actions.append(InlineKeyboardButton(text="🗑 Убрать", callback_data=f"qremove:{pid}"))
    actions.append(InlineKeyboardButton(text="✅ Готово", callback_data="back_catalog"))
    rows.append(actions)
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _build_qty_picker_view(state: FSMContext, pid: str):
    """Compute (text, keyboard) for the per-product qty sheet."""
    data = await state.get_data()
    products = data.get("products") or []
    p = next((x for x in products if str(x["id"]) == pid), None)
    if not p:
        return None, None
    cart = data.get("cart", {})
    qty = cart.get(pid, {}).get("qty", 0)

    try:
        cfg = await api.get_settings() or {}
    except Exception:
        cfg = {}
    disc_type = cfg.get("bottle_discount_type", "fixed")
    disc_val = float(cfg.get("bottle_discount_value") or 0)

    emoji = "🫧" if p.get("type") == "carbonated" else "💧"
    sname = _short_name(p)
    base_price = p["price"]

    lines = [f"{emoji} <b>{sname}</b>", ""]
    lines.append(f"💵 Цена: <b>{fmt(base_price)}</b>")

    if qty > 0:
        line_total = base_price * qty
        lines.append("")
        lines.append(f"📦 В корзине: {qty} шт. на {fmt(line_total)}")

    lines.append("")
    lines.append("<i>Выберите количество кнопками или просто отправьте число сообщением.</i>")
    return "\n".join(lines), _qty_kb(pid, qty)


async def _render_qty_picker(call: CallbackQuery, state: FSMContext, pid: str):
    text, kb = await _build_qty_picker_view(state, pid)
    if text is None:
        await call.answer("Товар не найден", show_alert=True)
        return
    try:
        await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        await call.message.answer(text, reply_markup=kb, parse_mode="HTML")


def _update_cart_qty(cart: dict, pid: str, products: list, qty: int) -> None:
    """Set cart[pid] qty (in-place). qty<=0 removes the item."""
    qty = max(0, int(qty))
    if qty <= 0:
        cart.pop(pid, None)
        return
    p = next((x for x in products if str(x["id"]) == pid), None)
    if not p:
        return
    item = cart.get(pid) or {
        "product_id": p["id"],
        "name": _short_name(p),
        "price": p["price"],
        "volume": p.get("volume", 0),
        "has_bottle_deposit": p.get("has_bottle_deposit", False),
        "deposit_price": p.get("deposit_price"),
        "bottle_surcharge": p.get("bottle_surcharge"),
    }
    item["qty"] = qty
    cart[pid] = item


def _sub_catalog_kb(products: list, cart: dict, ftype: str = "all",
                    disc_val: float = 0, disc_type: str = "fixed") -> InlineKeyboardMarkup:
    buttons = []
    has_still = any(p.get("type") != "carbonated" for p in products)
    has_carb = any(p.get("type") == "carbonated" for p in products)
    if has_still and has_carb:
        row = [InlineKeyboardButton(text=("✅ " if ftype == "all" else "") + "Все", callback_data="scf:all")]
        row.append(InlineKeyboardButton(text=("✅ " if ftype == "still" else "") + "💧 Без газа", callback_data="scf:still"))
        row.append(InlineKeyboardButton(text=("✅ " if ftype == "carbonated" else "") + "🫧 Газ.", callback_data="scf:carbonated"))
        buttons.append(row)

    for p in products:
        if ftype != "all" and p.get("type") != ftype:
            continue
        pid = str(p["id"])
        qty = cart.get(pid, {}).get("qty", 0)
        emoji = "🫧" if p.get("type") == "carbonated" else "💧"
        sname = _short_name(p)
        ep = _eff_price(p, disc_val, disc_type)
        deposit_mark = " ♻" if p.get("has_bottle_deposit") and ep < p["price"] else ""
        if qty == 0:
            buttons.append([InlineKeyboardButton(
                text=f"{emoji} {sname} — {fmt(ep)}{deposit_mark}  ➕",
                callback_data=f"sca:{pid}",
            )])
        else:
            buttons.append([
                InlineKeyboardButton(text="➖", callback_data=f"scr:{pid}"),
                InlineKeyboardButton(text=f"{qty} шт.  {sname}", callback_data="noop"),
                InlineKeyboardButton(text="➕", callback_data=f"sca:{pid}"),
            ])
    if cart:
        total_qty = sum(v["qty"] for v in cart.values())
        buttons.append([InlineKeyboardButton(
            text=f"➡️ Продолжить ({total_qty} шт.)",
            callback_data="sub_water_done",
        )])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _render_sub_catalog(target, state: FSMContext, ftype: str = "all", edit: bool = False):
    products = await api.get_products() or []
    try:
        cfg = await api.get_settings() or {}
    except Exception:
        cfg = {}
    disc_type = cfg.get("bottle_discount_type", "fixed")
    disc_val = float(cfg.get("bottle_discount_value") or 0)

    data = await state.get_data()
    cart = data.get("sub_cart", {})
    for p in products:
        pid = str(p["id"])
        if pid in cart:
            cart[pid].update(name=_short_name(p), price=p["price"])
    await state.update_data(products=products, sub_cart=cart, sub_cf=ftype)
    kb = _sub_catalog_kb(products, cart, ftype, disc_val, disc_type)

    lines = ["🛒 <b>Каталог воды Ever Water</b>\n"]
    shown = [p for p in products if ftype == "all" or p.get("type") == ftype]
    still = [p for p in shown if p.get("type") != "carbonated"]
    carb = [p for p in shown if p.get("type") == "carbonated"]
    if still:
        lines.append("💧 <b>Без газа:</b>")
        for p in still:
            ep = _eff_price(p, disc_val, disc_type)
            if p.get("has_bottle_deposit") and ep < p["price"]:
                lines.append(f"  {_short_name(p)} — {fmt(ep)} ♻ (без возврата: {fmt(p['price'])})")
            else:
                lines.append(f"  {_short_name(p)} — {fmt(p['price'])}")
    if carb:
        lines.append("\n🫧 <b>Газированная:</b>")
        for p in carb:
            lines.append(f"  {_short_name(p)} — {fmt(p['price'])}")
    lines.append("\n<i>Нажмите на товар чтобы добавить в корзину</i>")
    text = "\n".join(lines)
    msg = target.message if isinstance(target, CallbackQuery) else target
    if edit:
        await msg.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await msg.answer(text, reply_markup=kb, parse_mode="HTML")


@router.message(F.text == "🛒 Заказать")
async def catalog(message: Message, state: FSMContext):
    # Preserve the previous catalog message id so we can delete the stale
    # message after wiping state.
    data = await state.get_data()
    prev_msg_id = data.get("catalog_msg_id")
    await state.clear()
    if prev_msg_id:
        try:
            await message.bot.delete_message(message.chat.id, prev_msg_id)
        except Exception:
            pass
    await _render_catalog(message, state)


@router.callback_query(F.data.startswith("cp:"))
async def cart_pick(call: CallbackQuery, state: FSMContext):
    """Open the per-product quantity sheet. Enter waiting_custom_qty so
    typing a number applies to the picked product directly."""
    pid = call.data.split(":")[1]
    data = await state.get_data()
    if not data.get("products"):
        products = await api.get_products() or []
        await state.update_data(products=products)
    await state.set_state(CatalogState.waiting_custom_qty)
    await state.update_data(
        pending_qty_pid=pid,
        picker_msg_id=call.message.message_id,
        picker_chat_id=call.message.chat.id,
    )
    await _render_qty_picker(call, state, pid)
    await call.answer()


@router.callback_query(F.data.startswith("qd:"))
async def qty_delta(call: CallbackQuery, state: FSMContext):
    """Live counter ➖/➕ in the qty picker."""
    _, pid, delta = call.data.split(":")
    delta = int(delta)
    data = await state.get_data()
    cart = data.get("cart", {})
    products = data.get("products") or []
    current = cart.get(pid, {}).get("qty", 0)
    _update_cart_qty(cart, pid, products, current + delta)
    await state.update_data(cart=cart)
    await _render_qty_picker(call, state, pid)
    await call.answer()


@router.callback_query(F.data.startswith("qs:"))
async def qty_set(call: CallbackQuery, state: FSMContext):
    """Preset (1/2/3/5/10/20) in the qty picker."""
    _, pid, n = call.data.split(":")
    data = await state.get_data()
    cart = data.get("cart", {})
    products = data.get("products") or []
    _update_cart_qty(cart, pid, products, int(n))
    await state.update_data(cart=cart)
    await _render_qty_picker(call, state, pid)
    await call.answer()


@router.callback_query(F.data.startswith("qremove:"))
async def qty_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":")[1]
    data = await state.get_data()
    cart = data.get("cart", {})
    cart.pop(pid, None)
    await state.update_data(cart=cart, pending_qty_pid=None)
    await state.set_state(None)
    await call.answer("Убрано")
    await _render_catalog(call, state, edit=True)


@router.message(CatalogState.waiting_custom_qty)
async def qty_custom_input(message: Message, state: FSMContext):
    """User typed a number while a qty picker is open — apply to picked product."""
    data = await state.get_data()
    pid = data.get("pending_qty_pid")
    products = data.get("products") or []
    cart = data.get("cart", {})
    picker_msg_id = data.get("picker_msg_id")
    picker_chat_id = data.get("picker_chat_id")

    # Always remove the user's number message so the picker stays the only
    # message in this transaction.
    try:
        await message.delete()
    except Exception:
        pass

    if not pid:
        return

    txt = (message.text or "").strip()
    try:
        n = int(txt)
    except ValueError:
        # Not a number — silently ignore to keep the picker uncluttered.
        return
    if n < 0 or n > 999:
        return

    _update_cart_qty(cart, pid, products, n)
    await state.update_data(cart=cart)

    # Edit the picker message in place
    if picker_msg_id and picker_chat_id:
        text, kb = await _build_qty_picker_view(state, pid)
        if text is not None:
            try:
                await message.bot.edit_message_text(
                    chat_id=picker_chat_id,
                    message_id=picker_msg_id,
                    text=text,
                    reply_markup=kb,
                    parse_mode="HTML",
                )
            except Exception:
                pass


@router.callback_query(F.data == "noop")
async def noop_cb(call: CallbackQuery):
    await call.answer()


# ─── Cart ─────────────────────────────────────────────────────────────────────

def _cart_kb(cart: dict) -> InlineKeyboardMarkup:
    rows = []
    for pid, item in cart.items():
        rows.append([InlineKeyboardButton(
            text=f"❌ {item['name']} {item['qty']} шт.",
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
            ep = _item_eff_price(item)
            s = ep * item["qty"]
            total += s
            deposit_note = " ♻" if item.get("has_bottle_deposit") and item.get("deposit_price") else ""
            lines.append(f"• {item['name']} {item['qty']} шт. — {fmt(s)}{deposit_note}")
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
    # Leaving the qty picker → exit the "type a number" state
    cur = await state.get_state()
    if cur == CatalogState.waiting_custom_qty.state:
        await state.set_state(None)
    await state.update_data(pending_qty_pid=None)
    await _render_catalog(call, state, edit=True)
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
    saved = await api.get_user_addresses(user["id"]) or []
    await state.update_data(co_user=user, saved_addrs=saved)

    cart = data.get("cart", {})
    has_20l = any(v.get("volume", 0) >= 18.9 for v in cart.values())

    # Freeze the current message: remove all buttons, leave only cart summary
    try:
        total_qty = sum(v["qty"] for v in cart.values())
        total_sum = sum(_item_eff_price(v) * v["qty"] for v in cart.values())
        frozen_lines = ["🛒 <b>Каталог</b>", "", "📦 <b>В корзине:</b>"]
        for item in cart.values():
            frozen_lines.append(f"   • {item['name']} × {item['qty']} шт.")
        frozen_lines.append(f"\nИтого: <b>{total_qty} шт. · {fmt(total_sum)}</b>")
        await call.message.edit_text("\n".join(frozen_lines), parse_mode="HTML")
    except Exception:
        pass

    if has_20l:
        await _begin_return_step(call, state, edit=False)
    else:
        await state.update_data(co_return=0)
        await _begin_address_step(call, state, edit=False)
    await call.answer()


async def _begin_address_step(target, state: FSMContext, edit: bool = False):
    """Show saved addresses or ask for a new one. `target` is CallbackQuery or Message."""
    data = await state.get_data()
    saved = data.get("saved_addrs") or []
    if saved:
        await state.set_state(CheckoutState.choosing_address)
        rows = [[InlineKeyboardButton(
            text=f"📍 {a.get('label') or a['address']}",
            callback_data=f"ua:{i}",
        )] for i, a in enumerate(saved)]
        rows.append([InlineKeyboardButton(text="✏️ Новый адрес", callback_data="new_addr")])
        body = "Выберите адрес доставки:"
        kb = InlineKeyboardMarkup(inline_keyboard=rows)
    else:
        await state.set_state(CheckoutState.waiting_address)
        body = "Введите адрес доставки:"
        kb = None

    if edit and isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(body, reply_markup=kb)
            return
        except Exception:
            pass
    msg = target.message if isinstance(target, CallbackQuery) else target
    await msg.answer(body, reply_markup=kb)


def _is_setting_on(cfg: dict, key: str, default: bool = True) -> bool:
    v = cfg.get(key)
    if v is None:
        return default
    return str(v).lower() not in ("false", "0", "нет", "off", "no")


def _per_bottle_surcharge(cfg: dict, product: dict | None = None) -> int:
    """How much extra (in сум) the customer pays for each NON-returned 19L
    bottle in the order. Prefers product.bottle_surcharge; falls back to
    the global setting (interpreted as fixed amount or %)."""
    if not _is_setting_on(cfg, "bottle_bonus_enabled"):
        return 0
    if product:
        per_unit = product.get("bottle_surcharge") if isinstance(product, dict) else getattr(product, "bottle_surcharge", None)
        if per_unit and per_unit > 0:
            return int(per_unit)
    base_price = (product or {}).get("price", 0) if isinstance(product, dict) else 0
    if cfg.get("bottle_discount_type") == "percent":
        pct = float(cfg.get("bottle_discount_value") or 0)
        return int(round(base_price * pct / 100))
    return int(float(cfg.get("bottle_discount_value") or 0))


def _return_step_view(count: int, qty_20l: int, surcharge: int, max_return: int | None = None):
    """Build (text, keyboard) for the bottle-return step at a given count.
    max_return caps the + button (defaults to qty_20l = equal mode)."""
    cap = max_return if max_return is not None else qty_20l
    if count >= qty_20l:
        text = (
            "🫙 <b>Возврат бутылок 19 л</b>\n\n"
            f"Вы возвращаете <b>{count} {'бутылку' if count == 1 else 'бутылки' if 2 <= count <= 4 else 'бутылок'} 19л</b>."
        )
    else:
        missing = qty_20l - count
        extra_total = surcharge * missing
        word_b = "бутылку" if missing == 1 else "бутылки" if 2 <= missing <= 4 else "бутылок"
        text = (
            f"🫙 <b>Возврат бутылок 19 л</b>\n\n"
            f"Вы возвращаете <b>{count} из {qty_20l}</b>.\n"
            f"За каждую невозвращённую (всего {missing} {word_b}) "
            f"к заказу будет добавлено <b>{fmt(surcharge)}</b> за бутылку."
        )
        if extra_total > 0 and missing > 1:
            text += f"\nИтого надбавка: <b>{fmt(extra_total)}</b>"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="−", callback_data=f"rb_adj:{max(0, count - 1)}:{qty_20l}:{cap}"),
            InlineKeyboardButton(text=f"🫙 {count} шт.", callback_data="rb_noop"),
            InlineKeyboardButton(text="+", callback_data=f"rb_adj:{min(cap, count + 1)}:{qty_20l}:{cap}"),
        ],
        [InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"rb:{count}")],
    ])
    return text, kb


async def _begin_return_step(target, state: FSMContext, edit: bool = False):
    """Ask the user how many 19L bottles they return — before address."""
    data = await state.get_data()
    cart = data.get("cart", {})
    user = data.get("co_user") or {}
    qty_20l = sum(v.get("qty", 1) for v in cart.values() if v.get("volume", 0) >= 18.9)

    if qty_20l <= 0:
        await state.update_data(co_return=0)
        await _begin_address_step(target, state, edit=edit)
        return

    bottles = await api.get_bottles_owed(user.get("id"))
    count = bottles.get("count", 0)
    await state.update_data(bottles_owed=count)

    target_msg = target.message if isinstance(target, CallbackQuery) else target

    try:
        cfg = await api.get_settings() or {}
    except Exception:
        cfg = {}

    p19 = next((v for v in cart.values() if v.get("volume", 0) >= 18.9), None)
    surcharge = _per_bottle_surcharge(cfg, p19)

    # When user has no bottles on record — surcharge applies for every new 19L bottle.
    if count <= 0:
        await state.update_data(co_return=0, co_surcharge=surcharge, co_qty_20l=qty_20l)
        extra_total = surcharge * qty_20l
        word_b = "бутылку" if qty_20l == 1 else "бутылки" if 2 <= qty_20l <= 4 else "бутылок"
        msg_text = (
            f"♻️ <b>Возврат бутылок 19 л</b>\n\n"
            f"Нет бутылок к возврату — за {qty_20l} {word_b} "
            f"к заказу будет добавлено <b>{fmt(surcharge)}</b> за бутылку."
        )
        if extra_total > 0 and qty_20l > 1:
            msg_text += f"\nИтого надбавка: <b>{fmt(extra_total)}</b>"
        await target_msg.answer(msg_text, parse_mode="HTML")
        await _begin_address_step(target, state)
        return

    buttons_visible = cfg.get("bottle_return_buttons_visible", True)
    return_mode = cfg.get("bottle_return_mode", "max")

    # max mode: return up to all owed bottles; equal mode: return up to ordered qty.
    max_return = count if return_mode == "max" else min(qty_20l, count)
    initial_count = max_return  # start at the maximum allowed

    surcharge = _per_bottle_surcharge(cfg, p19)

    if not buttons_visible:
        await state.update_data(co_return=initial_count, co_surcharge=surcharge, co_qty_20l=qty_20l)
        if initial_count >= qty_20l:
            word_b = "бутылку" if initial_count == 1 else "бутылки" if 2 <= initial_count <= 4 else "бутылок"
            msg_text = f"♻️ <b>Учтён возврат {initial_count} {word_b} 19л</b>"
        else:
            missing = qty_20l - initial_count
            word_b = "бутылку" if missing == 1 else "бутылки" if 2 <= missing <= 4 else "бутылок"
            extra_total = surcharge * missing
            msg_text = (
                f"♻️ <b>Возврат бутылок 19 л</b>\n\n"
                f"Учтён возврат <b>{initial_count}</b> из <b>{qty_20l}</b>.\n"
                f"За каждую невозвращённую (всего {missing} {word_b}) "
                f"к заказу будет добавлено <b>{fmt(surcharge)}</b> за бутылку."
            )
            if extra_total > 0 and missing > 1:
                msg_text += f"\nИтого надбавка: <b>{fmt(extra_total)}</b>"
        await target_msg.answer(msg_text, parse_mode="HTML")
        await _begin_address_step(target, state)
        return

    await state.update_data(co_return=initial_count, co_surcharge=surcharge, co_qty_20l=qty_20l)
    await state.set_state(CheckoutState.asking_return)
    text, kb = _return_step_view(initial_count, qty_20l, surcharge, max_return=max_return)

    if edit and isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception:
            pass
    await target_msg.answer(text, reply_markup=kb, parse_mode="HTML")


def _location_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📍 Отправить геолокацию", request_location=True)],
            [KeyboardButton(text="⏩ Пропустить")],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )



async def _ask_location(message: Message, state: FSMContext, addr: str | None = None):
    await state.set_state(CheckoutState.waiting_location)
    head = f"📍 Адрес: <b>{addr}</b>\n\n" if addr else ""
    await message.answer(
        head + "Отправьте геолокацию, чтобы курьер точно нашёл вас, или пропустите:",
        reply_markup=_location_kb(),
        parse_mode="HTML",
    )


@router.callback_query(CheckoutState.choosing_address, F.data.startswith("ua:"))
async def use_saved_addr(call: CallbackQuery, state: FSMContext):
    idx = int(call.data.split(":")[1])
    data = await state.get_data()
    addr = data["saved_addrs"][idx]
    await state.update_data(
        co_address=addr["address"],
        co_lat=addr.get("lat") or addr.get("latitude"),
        co_lng=addr.get("lng") or addr.get("longitude"),
        co_extra=addr.get("extra_info"),
    )
    await call.answer()
    # Saved addresses already have location + landmark — skip straight to phone
    await call.message.edit_text(f"📍 Адрес: <b>{addr['address']}</b>", parse_mode="HTML")
    await _ask_phone(call.message, state)


@router.callback_query(CheckoutState.choosing_address, F.data == "new_addr")
async def new_addr(call: CallbackQuery, state: FSMContext):
    await state.set_state(CheckoutState.waiting_address)
    await call.message.edit_text("Введите адрес доставки:")
    await call.answer()


@router.message(CheckoutState.waiting_address)
async def co_address(message: Message, state: FSMContext):
    await state.update_data(co_address=message.text.strip(), co_lat=None, co_lng=None)
    await _ask_landmark(message, state, addr=message.text.strip())


# ── Ориентир ─────────────────────────────────────────────────────────────────

async def _ask_landmark(message: Message, state: FSMContext, addr: str | None = None):
    await state.set_state(CheckoutState.waiting_landmark)
    head = f"📍 Адрес: <b>{addr}</b>\n\n" if addr else ""
    await message.answer(
        head + "Укажите ориентир для курьера (подъезд, этаж, домофон).\n"
        "Или нажмите кнопку чтобы пропустить:",
        reply_markup=ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="⏩ Пропустить")]],
            resize_keyboard=True, one_time_keyboard=True,
        ),
        parse_mode="HTML",
    )


@router.message(CheckoutState.waiting_landmark)
async def co_landmark(message: Message, state: FSMContext):
    val = message.text.strip()
    await state.update_data(co_extra=None if val in ("⏩ Пропустить", "—") else val)
    await message.answer("Принято!", reply_markup=ReplyKeyboardRemove())
    await _ask_location(message, state)


# ── Локация ──────────────────────────────────────────────────────────────────

@router.message(CheckoutState.waiting_location, F.location)
async def co_location(message: Message, state: FSMContext):
    await state.update_data(co_lat=message.location.latitude,
                            co_lng=message.location.longitude)
    await message.answer("✅ Геолокация сохранена!", reply_markup=ReplyKeyboardRemove())
    await _ask_phone(message, state)


@router.message(CheckoutState.waiting_location, F.text == "⏩ Пропустить")
async def co_location_skip(message: Message, state: FSMContext):
    await message.answer("Хорошо, пропускаем.", reply_markup=ReplyKeyboardRemove())
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
    # Return-bottles question is asked BEFORE address now; here we go straight
    # to the bonus step. co_return is already set in state at this point.
    await _ask_bonus(message, state)



def _bottle_adj_kb(count: int, max_return: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="−", callback_data=f"rb_adj:{max(0, count - 1)}:{max_return}"),
            InlineKeyboardButton(text=f"🫙 {count} шт.", callback_data="rb_noop"),
            InlineKeyboardButton(text="+", callback_data=f"rb_adj:{min(max_return, count + 1)}:{max_return}"),
        ],
        [
            InlineKeyboardButton(text=f"✅ Верну {count} шт.", callback_data=f"rb:{count}"),
            InlineKeyboardButton(text="❌ Не возвращаю", callback_data="rb:0"),
        ],
    ])


@router.callback_query(CheckoutState.asking_return, F.data.startswith("rb_adj:"))
async def co_return_adjust(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    count = int(parts[1])
    qty_20l = int(parts[2])
    max_return = int(parts[3]) if len(parts) > 3 else qty_20l
    data = await state.get_data()
    surcharge = int(data.get("co_surcharge", 0))
    await state.update_data(co_return=count)
    text, kb = _return_step_view(count, qty_20l, surcharge, max_return=max_return)
    try:
        await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        pass
    await call.answer()


@router.callback_query(CheckoutState.asking_return, F.data == "rb_noop")
async def co_return_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(CheckoutState.asking_return, F.data.startswith("rb:"))
async def co_return(call: CallbackQuery, state: FSMContext):
    val = int(call.data.split(":")[1])
    await state.update_data(co_return=val)
    label = f"Верну {val} шт." if val > 0 else "Не возвращаю"
    try:
        await call.message.edit_text(f"🫙 Бутылки к возврату: {label}")
    except Exception:
        pass
    # Return question is asked before address → proceed to address step
    await _begin_address_step(call.message, state)
    await call.answer()


async def _ask_bonus(message: Message, state: FSMContext):
    data = await state.get_data()
    bonus = float(data.get("co_user", {}).get("bonus_points") or 0)
    if bonus >= 1:
        try:
            cfg = await api.get_settings() or {}
        except Exception:
            cfg = {}
        if not _is_setting_on(cfg, "bonus_program_enabled"):
            await state.update_data(co_bonus=0)
            await _ask_payment(message, state)
            return

        # Compute the actual bonus cap: min(total * limit_pct, total)
        cart = data.get("cart", {})
        subtotal = sum(item["price"] * item["qty"] for item in cart.values())
        co_qty_20l = data.get("co_qty_20l", 0)
        co_return = data.get("co_return", 0)
        co_surcharge = int(data.get("co_surcharge") or 0)
        bottle_surcharge_total = max(0, co_qty_20l - co_return) * co_surcharge
        pre_total = subtotal + bottle_surcharge_total
        bonus_limit_pct = float(cfg.get("bonus_limit_percent") or 30) / 100
        max_bonus = int(min(bonus, pre_total, pre_total * bonus_limit_pct))
        max_bonus = max(0, max_bonus)

        if max_bonus < 1:
            await state.update_data(co_bonus=0)
            await _ask_payment(message, state)
            return

        await state.set_state(CheckoutState.asking_bonus)
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text=f"Использовать {fmt(max_bonus)}", callback_data=f"ub:{max_bonus}"),
            InlineKeyboardButton(text="Не использовать", callback_data="ub:0"),
        ]])
        limit_note = (
            f"\n⚠️ Лимит: не более {int(bonus_limit_pct * 100)}% от суммы заказа."
            if bonus > max_bonus else ""
        )
        await message.answer(
            f"💎 У вас <b>{fmt(int(bonus))}</b> бонусных баллов.\n"
            f"Можно применить скидку: <b>{fmt(max_bonus)} сум</b>{limit_note}\n\n"
            f"Использовать при оплате?",
            reply_markup=kb,
            parse_mode="HTML",
        )
    else:
        await state.update_data(co_bonus=0)
        await _ask_payment(message, state)


@router.callback_query(CheckoutState.asking_bonus, F.data.startswith("ub:"))
async def co_bonus(call: CallbackQuery, state: FSMContext):
    val = int(call.data.split(":")[1])
    await state.update_data(co_bonus=val)
    label = f"Использую {fmt(val)}" if val > 0 else "Не использую"
    await call.message.edit_text(f"Бонусы: {label}")
    await _ask_payment(call.message, state)
    await call.answer()


async def _ask_payment(message: Message, state: FSMContext):
    await state.set_state(CheckoutState.choosing_payment)
    data = await state.get_data()
    rows = [
        [InlineKeyboardButton(text="💵 Наличные", callback_data="pm:cash")],
        [InlineKeyboardButton(text="💳 Карта", callback_data="pm:card")],
    ]
    await message.answer("Выберите способ оплаты:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@router.callback_query(CheckoutState.choosing_payment, F.data.startswith("pm:"))
async def co_payment(call: CallbackQuery, state: FSMContext):
    pay = call.data.split(":")[1]
    await state.update_data(co_pay=pay)
    pay_labels = {"cash": "💵 Наличными курьеру", "card": "💳 Картой"}
    await call.message.edit_text(f"Оплата: {pay_labels.get(pay, pay)}")
    await state.set_state(CheckoutState.confirming)
    await _show_summary(call.message, state)
    await call.answer()


async def _show_summary(message: Message, state: FSMContext):
    from datetime import datetime
    data = await state.get_data()
    cart = data.get("cart", {})

    # Late order warning
    late_warning = ""
    delivery_fee = 0
    try:
        cfg = await api.get_settings()
        late_hour = int(cfg.get("late_order_hour") or 18)
        now_h = datetime.utcnow().hour + 5  # UTC+5 approximate
        if now_h >= late_hour:
            late_warning = f"\n⚠️ <b>Внимание:</b> Заказы после {late_hour}:00 могут быть доставлены на следующий день.\n"
        delivery_fee = int(cfg.get("delivery_price") or 0) if cfg.get("delivery_enabled", True) else 0
    except Exception:
        cfg = {}
    pay_labels = {"cash": "💵 Наличные", "card": "💳 Карта"}
    co_return = data.get("co_return", 0)
    co_qty_20l = data.get("co_qty_20l", 0)
    co_surcharge = int(data.get("co_surcharge") or 0)
    bottle_surcharge_total = 0

    lines = ["<b>📋 Подтверждение заказа</b>\n", "<b>Товары:</b>"]
    total = 0
    for item in cart.values():
        s = item["price"] * item["qty"]
        total += s
        lines.append(f"  • {item['name']} {item['qty']} шт. — {fmt(s)}")

    if co_qty_20l > 0:
        missing = max(0, co_qty_20l - co_return)
        if missing > 0 and co_surcharge > 0:
            bottle_surcharge_total = missing * co_surcharge
            lines.append(f"  • Невозвращённые бутылки {missing} шт. — +{fmt(bottle_surcharge_total)}")
        lines.append("")
        lines.append("<b>Возврат:</b>")
        lines.append(f"• Бутылки 19л — {co_return} шт.")

    geo = "✅ указана" if data.get("co_lat") else "—"
    grand_total = total + bottle_surcharge_total
    co_bonus = int(data.get("co_bonus", 0))
    bonus_discount = min(co_bonus, grand_total)
    after_bonus = max(0, grand_total - bonus_discount)
    final_total = after_bonus + delivery_fee
    if delivery_fee > 0:
        lines.append(f"\nТовары: {fmt(grand_total)}")
        if bonus_discount > 0:
            lines.append(f"💎 Бонусы: −{fmt(bonus_discount)}")
        lines += [
            f"Доставка: +{fmt(delivery_fee)}",
            f"<b>Итого: {fmt(final_total)}</b>",
        ]
    else:
        if bonus_discount > 0:
            lines += [
                f"\nТовары: {fmt(grand_total)}",
                f"💎 Бонусы: −{fmt(bonus_discount)}",
                f"<b>Итого: {fmt(after_bonus)}</b>",
            ]
        else:
            lines.append(f"\n<b>Итого: {fmt(grand_total)}</b>")
    lines.append(f"Адрес: {data.get('co_address', '—')}")
    if data.get("co_extra"):
        lines.append(f"Ориентир: {data['co_extra']}")
    lines += [
        f"Геолокация: {geo}",
        f"Телефон: {data.get('co_phone', '—')}",
        f"Оплата: {pay_labels.get(data.get('co_pay', ''), '—')}",
    ]
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Подтвердить", callback_data="co_confirm")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="co_cancel")],
    ])
    text = "\n".join(lines)
    if late_warning:
        text = late_warning + text
    await message.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(CheckoutState.confirming, F.data == "co_confirm")
async def co_confirm(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    user = data["co_user"]
    cart = data.get("cart", {})
    pay_method = data.get("co_pay", "cash")

    items = [
        {"product_id": v["product_id"], "quantity": v["qty"], "price": v["price"]}
        for v in cart.values()
    ]
    try:
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
            "payment_method": pay_method,
        })
    except Exception:
        order = None
    if not order or "id" not in order:
        await state.clear()
        await call.message.answer(
            "❌ Ошибка при создании заказа. Попробуйте ещё раз.",
            reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()),
        )
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

    PAY_LABELS = {"cash": "Наличными курьеру", "card": "Картой"}
    # Notify admins + managers (cash — no payment step needed)
    if pay_method != "card":
        from keyboards.admin import order_confirm_kb
        cart_info = _cart_summary(cart)
        order_bonus_used = float(order.get("bonus_used") or 0)
        order_total = float(order.get("total") or 0)
        bonus_line = f"\n💎 Бонусы: −{fmt(int(order_bonus_used))}" if order_bonus_used > 0 else ""
        notification_text = (
            f"🆕 Новый заказ! Создан клиентом\n"
            f"Клиент: {user.get('name', '—')} | {data.get('co_phone', user.get('phone', '—'))}\n"
            f"Адрес: {addr}\n"
            f"Заказ: {cart_info}\n"
            f"Оплата: {PAY_LABELS.get(pay_method, pay_method)}\n"
            f"Итого: {fmt(int(order_total))}{bonus_line}"
        )
        sent_msgs = []
        seen_tg: set[int] = set()
        for admin_id in get_all_admin_ids():
            if admin_id in seen_tg:
                continue
            seen_tg.add(admin_id)
            try:
                msg = await call.bot.send_message(admin_id, notification_text, reply_markup=order_confirm_kb(order_id))
                sent_msgs.append({"chat_id": admin_id, "message_id": msg.message_id})
            except Exception:
                pass
        managers = await api.get_managers()
        for mgr in managers:
            if mgr.get("is_active") and mgr.get("telegram_id"):
                tid = int(mgr["telegram_id"])
                if tid in seen_tg:
                    continue
                seen_tg.add(tid)
                try:
                    msg = await call.bot.send_message(tid, notification_text,
                                                      reply_markup=order_confirm_kb(order_id))
                    sent_msgs.append({"chat_id": tid, "message_id": msg.message_id})
                except Exception:
                    pass
        if sent_msgs:
            try:
                await api.store_order_notification_msgs(order_id, sent_msgs)
            except Exception:
                pass

    if pay_method == "card":
        try:
            pay_cfg = await api.get_settings() or {}
        except Exception:
            pay_cfg = {}
        card_num = pay_cfg.get("payment_card") or settings.PAYMENT_CARD
        card_holder = pay_cfg.get("payment_holder") or settings.PAYMENT_HOLDER
        await call.message.edit_text(
            f"✅ Заказ создан!\n\n"
            f"Переведите <b>{fmt(order.get('total', 0))}</b> на карту:\n\n"
            f"💳 <b>{card_num}</b>\n"
            f"Получатель: {card_holder}\n\n"
            "После оплаты нажмите кнопку ниже:",
            reply_markup=order_actions_kb(order_id),
            parse_mode="HTML",
        )
    else:
        await call.message.edit_text(
            "✅ Заказ создан!\n"
            "Ожидайте подтверждения оператора."
        )

    # Ask to save address if it's new
    saved_addrs = data.get("saved_addrs", [])
    is_new_address = addr and not any(a.get("address") == addr for a in saved_addrs)
    if is_new_address:
        await state.set_state(CheckoutState.asking_save_addr)
        await state.update_data(
            save_user_id=user["id"],
            save_address=addr,
            save_lat=data.get("co_lat"),
            save_lng=data.get("co_lng"),
            save_extra=data.get("co_extra"),
        )
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="💾 Сохранить", callback_data="save_addr:yes"),
            InlineKeyboardButton(text="Нет", callback_data="save_addr:no"),
        ]])
        await call.message.answer("Сохранить этот адрес для следующих заказов?", reply_markup=kb)
    else:
        await state.clear()
        await call.message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()))
    await call.answer()


@router.callback_query(CheckoutState.asking_save_addr, F.data.startswith("save_addr:"))
async def save_addr_cb(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if call.data == "save_addr:yes":
        try:
            await api.save_address(data["save_user_id"], {
                "address": data.get("save_address", ""),
                "latitude": data.get("save_lat"),
                "longitude": data.get("save_lng"),
                "extra_info": data.get("save_extra"),
            })
            # Also persist to the user-level saved addresses
            user_id = data["save_user_id"]
            existing = await api.get_user_addresses(user_id) or []
            new_addr = {
                "id": int(__import__("time").time() * 1000),
                "address": data.get("save_address", ""),
                "lat": data.get("save_lat"),
                "lng": data.get("save_lng"),
                "extra_info": data.get("save_extra"),
                "label": data.get("save_address", ""),
            }
            if not any(a.get("address") == new_addr["address"] for a in existing):
                await api.save_user_addresses(user_id, (existing + [new_addr])[-10:])
            await call.message.edit_text("✅ Адрес сохранён!")
        except Exception:
            await call.message.edit_text("Не удалось сохранить адрес.")
    else:
        await call.message.edit_text("Хорошо, адрес не сохранён.")
    await state.clear()
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()))
    await call.answer()


@router.callback_query(CheckoutState.confirming, F.data == "co_cancel")
async def co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()))
    await call.answer()


# ─── Subscriptions ────────────────────────────────────────────────────────────

_PLAN_LABEL = {
    "weekly": "Еженедельная",
    "biweekly": "Каждые 2 нед.",
    "ten_days": "Каждые 10 дн.",
    "monthly": "Ежемесячная",
}
_PAY_LABEL = {"cash": "💵 Наличные", "card": "💳 Карта"}
_SUB_STATUS = {"active": "✅ Активна", "paused": "⏸ На паузе", "cancelled": "❌ Отменена"}


def _sub_card(s: dict) -> str:
    plan = _PLAN_LABEL.get(s.get("plan", ""), s.get("plan", ""))
    status = _SUB_STATUS.get(s.get("status", ""), s.get("status", ""))
    pay = _PAY_LABEL.get(s.get("payment_method", ""), s.get("payment_method", ""))
    total = int(s.get("total") or 0)
    lines = [
        f"<b>Подписка #{s['id']}</b>  {status}",
        f"📦 {plan} · {s.get('water_summary', '')} ({s.get('qty', '—')} шт.)",
    ]
    if s.get("day"):
        lines.append(f"📅 День доставки: {s['day']}")
    if s.get("time_slot"):
        lines.append(f"🕐 Время: {s['time_slot']}")
    lines.append(f"📍 {s.get('address', '—')}")
    if total > 0:
        lines.append(f"💰 Сумма: {total:,} сум · {pay}".replace(",", " "))
    elif pay:
        lines.append(f"💳 Оплата: {pay}")
    return "\n".join(lines)


@router.message(F.text == "📋 Подписки")
async def subscriptions(message: Message, state: FSMContext):
    await state.clear()
    if not await api.is_subscriptions_enabled():
        await message.answer("📋 Модуль подписок временно отключён администратором.")
        return
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    await state.update_data(sub_user=user)
    subs = await api.get_subscriptions(user["id"]) or []
    active = [s for s in subs if s.get("status") in ("active", "paused")]

    if not active:
        await message.answer(
            "📋 <b>Подписки</b>\n\nУ вас нет активных подписок.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="➕ Оформить подписку", callback_data="sub_new")
            ]]),
            parse_mode="HTML",
        )
        return

    text = "📋 <b>Мои подписки</b>\n"
    for s in active:
        text += "\n" + _sub_card(s) + "\n"

    rows = [[InlineKeyboardButton(text="➕ Добавить подписку", callback_data="sub_new")]]
    for s in active:
        sub_id = s["id"]
        row = []
        if s.get("status") == "paused":
            row.append(InlineKeyboardButton(text=f"▶ Возобновить #{sub_id}", callback_data=f"sub_resume:{sub_id}"))
        else:
            row.append(InlineKeyboardButton(text=f"⏸ Пауза #{sub_id}", callback_data=f"sub_pause:{sub_id}"))
        row.append(InlineKeyboardButton(text=f"❌ Отменить #{sub_id}", callback_data=f"sub_del:{sub_id}"))
        rows.append(row)

    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows), parse_mode="HTML")


@router.callback_query(F.data.startswith("sub_del:"))
async def sub_cancel(call: CallbackQuery, state: FSMContext):
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    sub_id = int(call.data.split(":")[1])
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    if user:
        await api.cancel_subscription(user["id"], sub_id)
    await call.message.edit_text("Подписка отменена.")
    await call.answer()


@router.callback_query(F.data.startswith("sub_pause:"))
async def sub_pause(call: CallbackQuery, state: FSMContext):
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    sub_id = int(call.data.split(":")[1])
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    if user:
        await api.pause_subscription(user["id"], sub_id)
    await call.message.edit_text("⏸ Подписка приостановлена.")
    await call.answer()


@router.callback_query(F.data.startswith("sub_resume:"))
async def sub_resume(call: CallbackQuery, state: FSMContext):
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    sub_id = int(call.data.split(":")[1])
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    if user:
        await api.resume_subscription(user["id"], sub_id)
    await call.message.edit_text("▶ Подписка возобновлена!")
    await call.answer()


@router.callback_query(F.data == "sub_new")
async def sub_new(call: CallbackQuery, state: FSMContext):
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    await state.set_state(SubscriptionState.choosing_plan)
    await call.message.edit_text(
        "Выберите план подписки:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📅 Еженедельная", callback_data="sp:weekly")],
            [InlineKeyboardButton(text="📅 Каждые 2 недели", callback_data="sp:biweekly")],
            [InlineKeyboardButton(text="📅 Каждые 10 дней", callback_data="sp:ten_days")],
            [InlineKeyboardButton(text="🗓 Ежемесячная", callback_data="sp:monthly")],
        ]),
    )
    await call.answer()


@router.callback_query(SubscriptionState.choosing_plan, F.data.startswith("sp:"))
async def sub_plan(call: CallbackQuery, state: FSMContext):
    await state.update_data(sub_plan=call.data.split(":")[1], sub_cart={}, sub_cf="all")
    await state.set_state(SubscriptionState.choosing_water)
    await _render_sub_catalog(call, state, ftype="all", edit=True)
    await call.answer()


@router.callback_query(SubscriptionState.choosing_water, F.data.startswith("scf:"))
async def sub_catalog_filter(call: CallbackQuery, state: FSMContext):
    await _render_sub_catalog(call, state, ftype=call.data.split(":")[1], edit=True)
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
        cart[pid] = {"name": _short_name(p), "price": p["price"], "qty": 0,
                     "has_bottle_deposit": p.get("has_bottle_deposit", False),
                     "deposit_price": p.get("deposit_price")}
    cart[pid]["qty"] += 1
    await state.update_data(sub_cart=cart)
    await _render_sub_catalog(call, state, ftype=data.get("sub_cf", "all"), edit=True)
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
    await _render_sub_catalog(call, state, ftype=data.get("sub_cf", "all"), edit=True)
    await call.answer()


@router.callback_query(SubscriptionState.choosing_water, F.data == "sub_water_done")
async def sub_water_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("sub_cart"):
        await call.answer("Выберите хотя бы один товар", show_alert=True)
        return
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    await state.update_data(sub_user=user)
    saved = []
    if user and user.get("id"):
        saved = await api.get_user_addresses(user["id"]) or []
    await state.update_data(sub_saved_addrs=saved)
    if saved:
        await state.set_state(SubscriptionState.choosing_address)
        rows = [[InlineKeyboardButton(
            text=f"📍 {a.get('label') or a['address']}",
            callback_data=f"sua:{i}",
        )] for i, a in enumerate(saved)]
        rows.append([InlineKeyboardButton(text="✏️ Новый адрес", callback_data="sub_new_addr")])
        await call.message.edit_text(
            "Выберите адрес доставки:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
    else:
        await state.set_state(SubscriptionState.waiting_address)
        await call.message.edit_text("Введите адрес доставки:")
    await call.answer()


@router.callback_query(SubscriptionState.choosing_address, F.data.startswith("sua:"))
async def sub_use_saved_addr(call: CallbackQuery, state: FSMContext):
    idx = int(call.data.split(":")[1])
    data = await state.get_data()
    addr = data["sub_saved_addrs"][idx]
    await state.update_data(
        sub_address=addr["address"],
        sub_lat=addr.get("lat"),
        sub_lon=addr.get("lng"),
        sub_landmark=addr.get("extra_info") or "",
    )
    await call.answer()
    await call.message.edit_text(f"📍 Адрес: <b>{addr['address']}</b>", parse_mode="HTML")
    await _sub_ask_phone(call.message, state)


@router.callback_query(SubscriptionState.choosing_address, F.data == "sub_new_addr")
async def sub_new_addr(call: CallbackQuery, state: FSMContext):
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
        try:
            cfg = await api.get_settings() or {}
        except Exception:
            cfg = {}
        if _is_setting_on(cfg, "bonus_program_enabled"):
            await state.set_state(SubscriptionState.asking_bonus)
            await message.answer(
                f"У вас {fmt(bonus)} бонусных баллов. Использовать при оплате подписки?",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                    InlineKeyboardButton(text=f"Использовать {fmt(bonus)}", callback_data=f"sub_ub:{bonus}"),
                    InlineKeyboardButton(text="Не использовать", callback_data="sub_ub:0"),
                ]]),
            )
            return
    await state.update_data(sub_bonus=0)
    await _sub_ask_payment(message, state)


@router.callback_query(SubscriptionState.asking_bonus, F.data.startswith("sub_ub:"))
async def sub_bonus(call: CallbackQuery, state: FSMContext):
    val = int(call.data.split(":")[1])
    await state.update_data(sub_bonus=val)
    label = f"Использую {fmt(val)}" if val > 0 else "Не использую"
    await call.message.edit_text(f"Бонусы: {label}")
    await _sub_ask_payment(call.message, state)
    await call.answer()


async def _sub_ask_payment(message: Message, state: FSMContext):
    await state.set_state(SubscriptionState.choosing_payment)
    data = await state.get_data()
    user = data.get("sub_user") or {}
    rows = [
        [InlineKeyboardButton(text="💵 Наличные", callback_data="subpm:cash")],
        [InlineKeyboardButton(text="💳 Карта", callback_data="subpm:card")],
    ]
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
    water_parts = [f"{v['name']} {v['qty']} шт." for v in cart.values() if v.get("qty", 0) > 0]
    water_summary = ", ".join(water_parts)
    await state.update_data(sub_water_summary=water_summary, sub_payment_method=method)

    if method == "card":
        # Show card details; create subscription only when user confirms payment
        total = sum(_item_eff_price(v) * v.get("qty", 0) for v in cart.values())
        bonus = data.get("sub_bonus", 0)
        to_pay = max(0, total - bonus)
        try:
            pay_cfg = await api.get_settings() or {}
        except Exception:
            pay_cfg = {}
        card_num = pay_cfg.get("payment_card") or settings.PAYMENT_CARD
        card_holder = pay_cfg.get("payment_holder") or settings.PAYMENT_HOLDER
        await call.message.edit_text(
            f"💳 Переведите <b>{fmt(to_pay)}</b> сум на карту:\n\n"
            f"<b>{card_num}</b>\n"
            f"Получатель: {card_holder}\n\n"
            f"После оплаты нажмите кнопку ниже:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="✅ Я оплатил", callback_data="sub_card_paid"),
            ]]),
            parse_mode="HTML",
        )
        await state.set_state(SubscriptionState.waiting_card_payment)
        await call.answer()
        return

    # For cash — create subscription immediately
    total = sum(_item_eff_price(v) * v.get("qty", 0) for v in cart.values())
    bonus = data.get("sub_bonus", 0)
    to_pay = max(0, total - bonus)
    pay_labels = {"cash": "💵 Наличными", "card": "💳 Картой"}
    await call.message.edit_text(f"Оплата: {pay_labels.get(method, method)}")
    result = await api.create_subscription(user["id"], {
        "plan": data.get("sub_plan"),
        "water_summary": water_summary,
        "address": data.get("sub_address"),
        "landmark": data.get("sub_landmark", ""),
        "phone": data.get("sub_phone"),
        "payment_method": method,
        "bonus_used": bonus,
        "total": to_pay,
    })
    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    pay_label = {"cash": "Наличные", "card": "Карта"}
    bonus_line = f"\nСписано бонусов: {fmt(bonus)}" if bonus > 0 else ""
    if result:
        await call.message.edit_text(
            f"✅ Подписка оформлена!\n\n"
            f"План: {plan_label.get(data.get('sub_plan', ''), '')}\n"
            f"Вода: {water_summary}\n"
            f"Адрес: {data.get('sub_address')}\n"
            f"Ориентир: {data.get('sub_landmark', '—')}\n"
            f"Оплата: {pay_label.get(method, method)}{bonus_line}\n"
            f"<b>Сумма: {fmt(to_pay)}</b>",
            parse_mode="HTML",
        )
    else:
        await call.message.edit_text("Ошибка при оформлении подписки. Попробуйте ещё раз.")
    await state.clear()
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()))
    await call.answer()


@router.callback_query(SubscriptionState.waiting_card_payment, F.data == "sub_card_paid")
async def sub_card_paid(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    user = data.get("sub_user") or await api.get_user(call.from_user.id)
    if not user:
        await call.answer("Пользователь не найден")
        return
    cart = data.get("sub_cart", {})
    total = sum(_item_eff_price(v) * v.get("qty", 0) for v in cart.values())
    bonus = data.get("sub_bonus", 0)
    to_pay = max(0, total - bonus)
    result = await api.create_subscription(user["id"], {
        "plan": data.get("sub_plan"),
        "water_summary": data.get("sub_water_summary", ""),
        "address": data.get("sub_address"),
        "landmark": data.get("sub_landmark", ""),
        "phone": data.get("sub_phone"),
        "payment_method": "card",
        "bonus_used": bonus,
        "total": to_pay,
    })
    if result:
        sub_id = result.get("id", "")
        bonus_line = f"\nСписано бонусов: {fmt(bonus)}" if bonus > 0 else ""
        await call.message.edit_text(
            f"⏳ Заявка на подписку #{sub_id} отправлена!\n\n"
            f"Вода: {data.get('sub_water_summary', '')}\n"
            f"Адрес: {data.get('sub_address', '')}\n"
            f"Оплата: 💳 Карта{bonus_line}\n"
            f"<b>Сумма: {fmt(to_pay)}</b>\n\n"
            "Менеджер проверит оплату и активирует подписку.",
            parse_mode="HTML",
        )
    else:
        await call.message.edit_text("Ошибка при оформлении подписки. Попробуйте ещё раз.")
    await state.clear()
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()))
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
    cfg = await api.get_settings()
    if not cfg.get("support_chat_enabled", True):
        contacts = (cfg.get("support_contacts_text") or "").strip()
        body = ("💬 <b>Поддержка</b>\n\n" + contacts) if contacts else (
            "💬 <b>Поддержка</b>\n\nКонтактная информация скоро появится."
        )
        await message.answer(body, parse_mode="HTML")
        return
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


_MENU_TEXTS = {
    "🛒 Заказать", "🧺 Корзина", "📦 Мои заказы", "👤 Профиль",
    "📋 Подписки", "🎁 Бонусы", "💬 Поддержка", "🔄 Роль", "⭐ Мои отзывы",
}


@router.message(F.text == "🧺 Корзина")
async def cart_menu(message: Message, state: FSMContext):
    await show_cart(message, state)


@router.message(F.text & ~F.text.startswith("/") & ~F.text.in_(_MENU_TEXTS))
async def forward_to_support(message: Message, state: FSMContext):
    """Catch-all: forward unhandled text to support chat."""
    current_state = await state.get_state()
    if current_state is not None:
        # User is in an active flow but no handler matched (e.g. typed text during
        # an inline-button-only step). Give them a visible escape route.
        await message.answer("Используйте кнопки выше или нажмите /menu для возврата в меню.")
        return
    tg_id = message.from_user.id
    name = message.from_user.full_name or str(tg_id)

    cfg = await api.get_settings()
    subs_on = bool(cfg.get("subscriptions_enabled", True))

    # If chat is disabled — show static contacts instead of forwarding
    if not cfg.get("support_chat_enabled", True):
        contacts = (cfg.get("support_contacts_text") or "").strip()
        body = ("💬 <b>Поддержка</b>\n\n" + contacts) if contacts else (
            "💬 <b>Поддержка</b>\n\nЧат сейчас недоступен."
        )
        await message.answer(
            body, parse_mode="HTML",
            reply_markup=main_menu_kb(subs_enabled=subs_on),
        )
        return

    try:
        await api.send_user_support_message(tg_id, name, message.text)
        await message.answer(
            "✉️ Сообщение отправлено. Оператор ответит в ближайшее время.",
            reply_markup=main_menu_kb(subs_enabled=subs_on),
        )
    except Exception:
        await message.answer(
            "✉️ Не удалось отправить сообщение. Попробуйте позже.",
            reply_markup=main_menu_kb(subs_enabled=subs_on),
        )

