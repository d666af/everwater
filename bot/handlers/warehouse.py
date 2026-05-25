from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.warehouse import (
    warehouse_menu_kb, wh_prod_product_kb, wh_courier_select_kb,
    wh_factory_select_kb, wh_cart_kb, wh_date_menu_kb, wh_vtype_kb,
    wh_report_period_kb, wh_history_filter_kb, wh_period_kb,
    wh_stock_actions_kb, wh_low_stock_kb,
)
from keyboards.admin import subs_menu_kb, subs_list_kb
from handlers.admin import _subs_summary_text, _sub_card_text
from config import settings
from services.roles import get_all_admin_ids

router = Router()

TX_RU = {
    "production": "➕ Производство",
    "issue": "📤 Выдача",
    "bottle_return": "↩ Возврат тары",
    "return": "↩ Возврат",
}


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


async def is_warehouse(user_id: int) -> bool:
    from services.roles import get_all_warehouse_ids
    if user_id in get_all_warehouse_ids() or user_id in get_all_admin_ids():
        return True
    # Warehouse staff added via the CRM web live only in the DB
    try:
        staff = await api.get_warehouse_staff_db()
        return any(s.get("telegram_id") == user_id for s in staff)
    except Exception:
        return False


async def _operator_name(telegram_id: int, fallback: str = "Завсклада") -> str:
    try:
        staff = await api.get_warehouse_staff_db()
        entry = next((s for s in staff if s.get("telegram_id") == telegram_id), None)
        if entry and entry.get("name"):
            return entry["name"]
    except Exception:
        pass
    return fallback


# ─── FSM ──────────────────────────────────────────────────────────────────────

class ProductionState(StatesGroup):
    choosing_product = State()
    waiting_quantity = State()
    waiting_note = State()


class IssueState(StatesGroup):
    choosing_recipient = State()
    new_courier_name = State()
    new_courier_phone = State()
    cart = State()
    vehicle_plate = State()
    date_input = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("warehouse"))
async def warehouse_panel(message: Message):
    if not await is_warehouse(message.from_user.id):
        return
    subs_on = await api.is_subscriptions_enabled()
    await message.answer("🏭 Панель склада:", reply_markup=warehouse_menu_kb(subs_enabled=subs_on))


# ─── Stock overview ───────────────────────────────────────────────────────────

@router.message(F.text == "📦 Остатки")
async def wh_stock(message: Message):
    if not await is_warehouse(message.from_user.id):
        return
    stock = await api.get_warehouse_stock()
    if not stock:
        await message.answer("Нет данных по остаткам.")
        return
    lines = ["📦 <b>Остатки на складе:</b>\n"]
    for item in stock:
        qty = item.get("quantity", 0)
        warn = " ⚠️" if qty < 10 else ""
        lines.append(f"• {item['product_name']} — <b>{qty} шт.</b>{warn}")
    await message.answer("\n".join(lines), parse_mode="HTML")


# ─── Production ───────────────────────────────────────────────────────────────

@router.message(F.text == "➕ Производство")
async def wh_production_start(message: Message, state: FSMContext):
    if not await is_warehouse(message.from_user.id):
        return
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    if not catalog:
        await message.answer("Нет продуктов в каталоге.")
        return
    await state.update_data(wh_products=catalog)
    await state.set_state(ProductionState.choosing_product)
    await message.answer("Выберите продукт для записи производства:",
                         reply_markup=wh_prod_product_kb(catalog))


@router.callback_query(ProductionState.choosing_product, F.data.startswith("wh:prod:"))
async def wh_prod_product(call: CallbackQuery, state: FSMContext):
    product_id = int(call.data.split(":")[2])
    data = await state.get_data()
    catalog = data.get("wh_products", [])
    prod = next((p for p in catalog if p.get("id") == product_id), {})
    await state.update_data(prod_product_id=product_id, prod_product_name=prod.get("name", ""))
    await state.set_state(ProductionState.waiting_quantity)
    await call.message.edit_text(
        f"Введите количество произведённых единиц:\n<b>{prod.get('name', '')}</b>",
        parse_mode="HTML"
    )
    await call.answer()


@router.message(ProductionState.waiting_quantity)
async def wh_prod_quantity(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число (больше 0).")
        return
    await state.update_data(prod_quantity=int(text))
    await state.set_state(ProductionState.waiting_note)
    await message.answer("Добавьте заметку (или отправьте «-» чтобы пропустить):")


@router.message(ProductionState.waiting_note)
async def wh_prod_note(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text:
        await message.answer("Отправьте текстовую заметку или «-» чтобы пропустить.")
        return
    note = None if text == "-" else text
    data = await state.get_data()
    await state.clear()
    prod_name = data.get("prod_product_name", str(data.get("prod_product_id", "")))
    qty = data.get("prod_quantity", 0)
    try:
        result = await api.warehouse_production(data["prod_product_id"], qty, note)
    except Exception as e:
        await message.answer(f"❌ Не удалось записать производство: {e}")
        return
    await message.answer(
        f"✅ Производство записано!\n"
        f"Продукт: {prod_name}\n"
        f"Количество: {qty} шт.\n"
        f"Новый остаток: {result.get('new_quantity', '—')} шт."
    )
    for admin_id in get_all_admin_ids():
        try:
            await message.bot.send_message(
                admin_id,
                f"🏭 Произведено: {prod_name} — {qty} шт."
            )
        except Exception:
            pass


# ─── Issue / Return (new inline ± flow) ──────────────────────────────────────

from datetime import datetime, timezone, timedelta, date as _date_cls

_TZ_UZ = timezone(timedelta(hours=5))


def _today_uz() -> str:
    return datetime.now(tz=_TZ_UZ).strftime("%Y-%m-%d")


def _fmt_date_label(iso: str) -> str:
    """YYYY-MM-DD → DD.MM"""
    try:
        y, m, d = iso.split("-")
        return f"{d}.{m}"
    except Exception:
        return iso


def _build_created_at(issue_date: str):
    today = _today_uz()
    if issue_date == today:
        return None
    now_uz = datetime.now(tz=_TZ_UZ)
    y, mo, d = issue_date.split("-")
    backdated_uz = datetime(int(y), int(mo), int(d),
                            now_uz.hour, now_uz.minute, now_uz.second,
                            tzinfo=_TZ_UZ)
    return backdated_uz.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _cart_text(data: dict) -> str:
    factory_mode = data.get("ir_factory_mode", False)
    cart = data.get("ir_cart", {})
    return_qty = data.get("ir_return_qty", 0)
    issue_date = data.get("ir_issue_date", _today_uz())
    is_backdated = issue_date != _today_uz()

    if factory_mode:
        title = f"🏭 <b>Выдача заводу</b> · {data.get('ir_factory_name', '')}"
    else:
        cn = data.get("ir_courier_name", "")
        cp = data.get("ir_courier_phone", "")
        title = f"🔄 <b>Выдать/Возврат</b> · {cn}" + (f" ({cp})" if cp else "")

    date_str = _fmt_date_label(issue_date)
    date_line = ("⏮ " if is_backdated else "") + f"📅 {date_str}" + (" — задним числом" if is_backdated else "")

    lines = [title, date_line, ""]
    cart_items = [(v["name"], v["qty"]) for v in cart.values() if v["qty"] > 0]
    if cart_items:
        lines.append("📦 Выдача:")
        for name, qty in cart_items:
            lines.append(f"  • {name} — {qty} шт.")
    if not factory_mode and return_qty > 0:
        lines.append(f"↩ Возврат бутылок: {return_qty} шт.")
    if not cart_items and (factory_mode or return_qty == 0):
        lines.append("<i>Нажмите [+] чтобы добавить товар</i>")

    vtype = data.get("ir_vehicle_type", "")
    vplate = data.get("ir_vehicle_plate", "")
    if vtype or vplate:
        lines.append("")
        lines.append("🚗 " + " · ".join(filter(None, [vtype, vplate])))
    return "\n".join(lines)


async def _show_cart(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    kb = wh_cart_kb(
        data.get("ir_catalog", []), data.get("ir_cart", {}),
        data.get("ir_return_qty", 0),
        data.get("ir_vehicle_type", ""), data.get("ir_vehicle_plate", ""),
        _fmt_date_label(data.get("ir_issue_date", _today_uz())),
        is_factory=data.get("ir_factory_mode", False),
    )
    try:
        await call.message.edit_text(_cart_text(data), parse_mode="HTML", reply_markup=kb)
    except Exception:
        pass


async def _edit_cart_msg(bot, chat_id: int, msg_id: int, state: FSMContext):
    data = await state.get_data()
    kb = wh_cart_kb(
        data.get("ir_catalog", []), data.get("ir_cart", {}),
        data.get("ir_return_qty", 0),
        data.get("ir_vehicle_type", ""), data.get("ir_vehicle_plate", ""),
        _fmt_date_label(data.get("ir_issue_date", _today_uz())),
        is_factory=data.get("ir_factory_mode", False),
    )
    try:
        await bot.edit_message_text(
            chat_id=chat_id, message_id=msg_id,
            text=_cart_text(data), parse_mode="HTML", reply_markup=kb,
        )
    except Exception:
        pass


def _simple_kb(*btns) -> InlineKeyboardMarkup:
    """Build a simple 1-column keyboard from (text, callback_data) pairs."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t, callback_data=c)] for t, c in btns
    ])


async def _ir_start_flow(target, state: FSMContext):
    """Shared logic for wh_ir_start (Message) and wh_quick_ir (CallbackQuery)."""
    if isinstance(target, Message):
        uid = target.from_user.id
    else:
        uid = target.from_user.id

    couriers = await api.get_couriers()
    active = [c for c in couriers if c.get("is_active", True)]
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    operator = await _operator_name(uid)

    await state.update_data(
        ir_couriers=active, ir_catalog=catalog, ir_cart={}, ir_return_qty=0,
        ir_operator=operator, ir_factory_mode=False,
        ir_vehicle_type="", ir_vehicle_plate="",
        ir_issue_date=_today_uz(),
    )
    await state.set_state(IssueState.choosing_recipient)

    text = "👤 Выберите получателя:"
    kb = wh_courier_select_kb(active, "ir")
    if isinstance(target, Message):
        sent = await target.answer(text, reply_markup=kb)
        await state.update_data(ir_msg_id=sent.message_id, ir_chat_id=target.chat.id)
    else:
        await target.message.edit_text(text, reply_markup=kb)
        await state.update_data(ir_msg_id=target.message.message_id, ir_chat_id=target.message.chat.id)


@router.message(F.text == "🔄 Выдать/Возврат")
async def wh_ir_start(message: Message, state: FSMContext):
    if not await is_warehouse(message.from_user.id):
        return
    await _ir_start_flow(message, state)


# ── Recipient selection ───────────────────────────────────────────────────────

@router.callback_query(IssueState.choosing_recipient, F.data.startswith("wh:ir:courier:"))
async def wh_ir_courier(call: CallbackQuery, state: FSMContext):
    courier_id = int(call.data.split(":")[3])
    data = await state.get_data()
    courier = next((c for c in data.get("ir_couriers", []) if c["id"] == courier_id), {})
    await state.update_data(
        ir_courier_id=courier_id,
        ir_courier_name=courier.get("name", ""),
        ir_courier_phone=courier.get("phone", ""),
        ir_factory_mode=False,
    )
    await state.set_state(IssueState.cart)
    await _show_cart(call, state)
    await call.answer()


@router.callback_query(IssueState.choosing_recipient, F.data == "wh:ir:factory")
async def wh_ir_factory_list(call: CallbackQuery, state: FSMContext):
    factories = await api.get_factories()
    if not factories:
        await call.answer("Нет заводов. Добавьте завод через сайт.", show_alert=True)
        return
    await state.update_data(ir_factories=factories)
    await call.message.edit_text("🏭 Выберите завод:", reply_markup=wh_factory_select_kb(factories, "ir"))
    await call.answer()


@router.callback_query(IssueState.choosing_recipient, F.data.startswith("wh:ir:factpick:"))
async def wh_ir_factory_pick(call: CallbackQuery, state: FSMContext):
    factory_id = int(call.data.split(":")[3])
    data = await state.get_data()
    factory = next((f for f in data.get("ir_factories", []) if f["id"] == factory_id), {})
    await state.update_data(
        ir_factory_id=factory_id,
        ir_factory_name=factory.get("name", ""),
        ir_factory_mode=True, ir_return_qty=0,
    )
    await state.set_state(IssueState.cart)
    await _show_cart(call, state)
    await call.answer()


@router.callback_query(IssueState.choosing_recipient, F.data == "wh:ir:fback")
async def wh_ir_factory_back(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await call.message.edit_text("👤 Выберите получателя:",
                                 reply_markup=wh_courier_select_kb(data.get("ir_couriers", []), "ir"))
    await call.answer()


@router.callback_query(IssueState.choosing_recipient, F.data == "wh:ir:new_courier")
async def wh_ir_new_courier(call: CallbackQuery, state: FSMContext):
    await state.set_state(IssueState.new_courier_name)
    await call.message.edit_text(
        "➕ <b>Новый курьер</b>\n\nВведите имя:",
        parse_mode="HTML",
        reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")),
    )
    await call.answer()


# ── New courier text inputs ───────────────────────────────────────────────────

@router.message(IssueState.new_courier_name)
async def wh_ir_nc_name(message: Message, state: FSMContext):
    name = (message.text or "").strip()
    if not name:
        return
    data = await state.get_data()
    await state.update_data(ir_new_name=name)
    await state.set_state(IssueState.new_courier_phone)
    try:
        await message.bot.edit_message_text(
            chat_id=data["ir_chat_id"], message_id=data["ir_msg_id"],
            text=f"➕ <b>Новый курьер</b>\nИмя: {name}\n\nВведите телефон (+998XXXXXXXXX):",
            parse_mode="HTML",
            reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")),
        )
    except Exception:
        pass
    try:
        await message.delete()
    except Exception:
        pass


@router.message(IssueState.new_courier_phone)
async def wh_ir_nc_phone(message: Message, state: FSMContext):
    phone = (message.text or "").strip()
    if not phone:
        return
    data = await state.get_data()
    name = data.get("ir_new_name", "")
    try:
        courier = await api.create_courier_from_invoice(name, phone)
    except Exception as e:
        try:
            await message.bot.edit_message_text(
                chat_id=data["ir_chat_id"], message_id=data["ir_msg_id"],
                text=f"❌ Не удалось создать курьера: {e}\n\nВведите телефон ещё раз:",
                reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")),
            )
        except Exception:
            pass
        try:
            await message.delete()
        except Exception:
            pass
        return
    await state.update_data(
        ir_courier_id=courier.get("id"),
        ir_courier_name=courier.get("name", name),
        ir_courier_phone=courier.get("phone", phone),
        ir_factory_mode=False,
    )
    await state.set_state(IssueState.cart)
    await _edit_cart_msg(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)
    try:
        await message.delete()
    except Exception:
        pass


# ── Cart ± callbacks ──────────────────────────────────────────────────────────

@router.callback_query(IssueState.cart, F.data.startswith("wh:ir:plus:"))
async def wh_ir_plus(call: CallbackQuery, state: FSMContext):
    pid = int(call.data.split(":")[3])
    data = await state.get_data()
    cart = dict(data.get("ir_cart", {}))
    key = str(pid)
    prod = next((p for p in data.get("ir_catalog", []) if p["id"] == pid), {})
    entry = cart.get(key, {"name": prod.get("name", ""), "qty": 0})
    entry["qty"] = min(999, entry["qty"] + 1)
    cart[key] = entry
    await state.update_data(ir_cart=cart)
    await _show_cart(call, state)
    await call.answer()


@router.callback_query(IssueState.cart, F.data.startswith("wh:ir:minus:"))
async def wh_ir_minus(call: CallbackQuery, state: FSMContext):
    pid = int(call.data.split(":")[3])
    data = await state.get_data()
    cart = dict(data.get("ir_cart", {}))
    key = str(pid)
    if key in cart:
        cart[key]["qty"] = max(0, cart[key]["qty"] - 1)
        if cart[key]["qty"] == 0:
            del cart[key]
    await state.update_data(ir_cart=cart)
    await _show_cart(call, state)
    await call.answer()


@router.callback_query(IssueState.cart, F.data == "wh:ir:rplus")
async def wh_ir_rplus(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(ir_return_qty=min(999, data.get("ir_return_qty", 0) + 1))
    await _show_cart(call, state)
    await call.answer()


@router.callback_query(IssueState.cart, F.data == "wh:ir:rminus")
async def wh_ir_rminus(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(ir_return_qty=max(0, data.get("ir_return_qty", 0) - 1))
    await _show_cart(call, state)
    await call.answer()


# ── Date selection ────────────────────────────────────────────────────────────

@router.callback_query(IssueState.cart, F.data == "wh:ir:datemenu")
async def wh_ir_date_menu(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    current = data.get("ir_issue_date", _today_uz())
    now_uz = datetime.now(tz=_TZ_UZ)
    options = []
    for i, label in enumerate(["Сегодня", "Вчера", "Позавчера"]):
        iso = (now_uz - timedelta(days=i)).strftime("%Y-%m-%d")
        options.append((label, iso))
    try:
        await call.message.edit_reply_markup(reply_markup=wh_date_menu_kb(options, current))
    except Exception:
        pass
    await call.answer()


@router.callback_query(IssueState.cart, F.data.startswith("wh:ir:date:"))
async def wh_ir_date_cb(call: CallbackQuery, state: FSMContext):
    key = call.data[len("wh:ir:date:"):]
    if key == "back":
        await _show_cart(call, state)
    elif key == "custom":
        await state.set_state(IssueState.date_input)
        await call.message.edit_text(
            "✏️ Введите дату задним числом (ДД.ММ.ГГГГ):",
            reply_markup=_simple_kb(
                ("◀ Назад", "wh:ir:back_input"),
                ("❌ Отмена", "wh:ir:cancel"),
            ),
        )
    else:
        await state.update_data(ir_issue_date=key)
        await _show_cart(call, state)
    await call.answer()


@router.message(IssueState.date_input)
async def wh_ir_date_input(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    try:
        parts = text.split(".")
        d, m = int(parts[0]), int(parts[1])
        y = int(parts[2]) if len(parts) >= 3 else datetime.now(tz=_TZ_UZ).year
        parsed = _date_cls(y, m, d)
        today = datetime.now(tz=_TZ_UZ).date()
        if parsed > today:
            raise ValueError("future date")
        iso = parsed.isoformat()
    except Exception:
        try:
            await message.delete()
        except Exception:
            pass
        data = await state.get_data()
        try:
            await message.bot.edit_message_text(
                chat_id=data["ir_chat_id"], message_id=data["ir_msg_id"],
                text="✏️ Неверный формат. Введите дату (ДД.ММ.ГГГГ), например 23.05.2026:",
                reply_markup=_simple_kb(
                    ("◀ Назад", "wh:ir:back_input"),
                    ("❌ Отмена", "wh:ir:cancel"),
                ),
            )
        except Exception:
            pass
        return
    await state.update_data(ir_issue_date=iso)
    await state.set_state(IssueState.cart)
    data = await state.get_data()
    await _edit_cart_msg(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)
    try:
        await message.delete()
    except Exception:
        pass


# ── Vehicle type / plate ──────────────────────────────────────────────────────

@router.callback_query(IssueState.cart, F.data == "wh:ir:vtypemenu")
async def wh_ir_vtype_menu(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    try:
        await call.message.edit_reply_markup(reply_markup=wh_vtype_kb(data.get("ir_vehicle_type", "")))
    except Exception:
        pass
    await call.answer()


@router.callback_query(IssueState.cart, F.data.startswith("wh:ir:vtype:"))
async def wh_ir_vtype_cb(call: CallbackQuery, state: FSMContext):
    vtype = call.data[len("wh:ir:vtype:"):]
    if vtype == "__back":
        await _show_cart(call, state)
    else:
        await state.update_data(ir_vehicle_type=vtype)
        await _show_cart(call, state)
    await call.answer()


@router.callback_query(IssueState.cart, F.data == "wh:ir:vplate")
async def wh_ir_vplate(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    current = data.get("ir_vehicle_plate", "")
    await state.set_state(IssueState.vehicle_plate)
    prompt = "🔢 Введите номер авто" + (f" (сейчас: {current})" if current else "") + ":"
    try:
        await call.message.edit_text(
            prompt,
            reply_markup=_simple_kb(
                ("◀ Назад", "wh:ir:back_input"),
                ("❌ Отмена", "wh:ir:cancel"),
            ),
        )
    except Exception:
        pass
    await call.answer()


@router.message(IssueState.vehicle_plate)
async def wh_ir_vplate_input(message: Message, state: FSMContext):
    plate = (message.text or "").strip().upper()
    await state.update_data(ir_vehicle_plate=plate)
    await state.set_state(IssueState.cart)
    data = await state.get_data()
    await _edit_cart_msg(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)
    try:
        await message.delete()
    except Exception:
        pass


# ── Back to cart from input states ────────────────────────────────────────────

@router.callback_query(
    StateFilter(IssueState.vehicle_plate, IssueState.date_input),
    F.data == "wh:ir:back_input",
)
async def wh_ir_back_input(call: CallbackQuery, state: FSMContext):
    await state.set_state(IssueState.cart)
    await _show_cart(call, state)
    await call.answer()


# ── Back to courier list from cart ────────────────────────────────────────────

@router.callback_query(IssueState.cart, F.data == "wh:ir:back")
async def wh_ir_back_to_recipients(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.set_state(IssueState.choosing_recipient)
    await call.message.edit_text(
        "👤 Выберите получателя:",
        reply_markup=wh_courier_select_kb(data.get("ir_couriers", []), "ir"),
    )
    await call.answer()


# ── Noop ─────────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "wh:ir:noop")
async def wh_ir_noop(call: CallbackQuery):
    await call.answer()


# ── Submit ────────────────────────────────────────────────────────────────────

@router.callback_query(IssueState.cart, F.data == "wh:ir:submit")
async def wh_ir_submit(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    factory_mode = data.get("ir_factory_mode", False)
    cart = data.get("ir_cart", {})
    return_qty = data.get("ir_return_qty", 0)
    operator = data.get("ir_operator", "")
    catalog = data.get("ir_catalog", [])
    vtype = data.get("ir_vehicle_type") or None
    vplate = data.get("ir_vehicle_plate") or None
    issue_date = data.get("ir_issue_date", _today_uz())
    created_at = _build_created_at(issue_date)

    price_map = {str(p["id"]): float(p.get("effective_price") or p.get("price") or 0) for p in catalog}
    items = [
        {"product_id": int(k), "product_name": v["name"], "quantity": v["qty"]}
        for k, v in cart.items() if v["qty"] > 0
    ]
    total_sum = sum(v["qty"] * price_map.get(k, 0) for k, v in cart.items() if v["qty"] > 0)

    now_uz = datetime.now(tz=_TZ_UZ)
    now_str = now_uz.strftime("%d.%m.%Y %H:%M")
    date_label = _fmt_date_label(issue_date)

    if factory_mode:
        factory_name = data.get("ir_factory_name", "")
        if not items:
            await call.answer("Добавьте хотя бы один товар", show_alert=True)
            return
        try:
            await api.factory_issue_batch(factory_name, items, performed_by=operator, created_at=created_at)
        except Exception as e:
            await call.answer(f"Ошибка: {e}", show_alert=True)
            return
        await state.clear()
        lines = [f"✅ <b>Выдача записана</b>", f"🏭 Завод: {factory_name}", f"📅 {date_label}", "", "📦 Выдано:"]
        lines += [f"  • {it['product_name']} — {it['quantity']} шт." for it in items]
        if total_sum > 0:
            lines.append(f"💰 {int(total_sum):,} сум".replace(",", " "))
        try:
            await call.message.edit_text("\n".join(lines), parse_mode="HTML")
        except Exception:
            await call.message.answer("\n".join(lines), parse_mode="HTML")
        await call.answer()
        return

    # ── Courier issue ──────────────────────────────────────────────────────
    courier_id = data.get("ir_courier_id")
    courier_name = data.get("ir_courier_name", "")

    if not items and return_qty <= 0:
        await call.answer("Добавьте товар или укажите возврат бутылок", show_alert=True)
        return

    try:
        await api.issue_batch(
            courier_id, items, return_qty,
            performed_by=operator,
            vehicle_type=vtype, vehicle_plate=vplate,
            created_at=created_at,
        )
    except Exception as e:
        await call.answer(f"Ошибка: {e}", show_alert=True)
        return

    await state.clear()

    lines = [f"✅ <b>Выдача записана</b>", f"👤 Курьер: {courier_name}", f"📅 {date_label}"]
    if vtype or vplate:
        lines.append("🚗 " + " · ".join(filter(None, [vtype, vplate])))
    if items:
        lines.append("\n📦 Выдано:")
        lines += [f"  • {it['product_name']} — {it['quantity']} шт." for it in items]
    if return_qty > 0:
        lines.append(f"↩ Возврат бутылок: {return_qty} шт.")
    if total_sum > 0:
        lines.append(f"💰 {int(total_sum):,} сум".replace(",", " "))
    try:
        await call.message.edit_text("\n".join(lines), parse_mode="HTML")
    except Exception:
        await call.message.answer("\n".join(lines), parse_mode="HTML")

    # Notify the courier
    couriers_list = data.get("ir_couriers", [])
    courier = next((c for c in couriers_list if c.get("id") == courier_id), {})
    if courier.get("telegram_id") and (items or return_qty > 0):
        n = ["📦 <b>Накладная со склада</b>", ""]
        if items:
            n.append("Получено:")
            n += [f"  • {it['product_name']} — {it['quantity']} шт." for it in items]
        if total_sum > 0:
            n.append(f"\nИтого: {int(total_sum):,} сум".replace(",", " "))
        if return_qty > 0:
            n.append(f"↩ Возврат бутылок: {return_qty} шт.")
        n += ["", f"Время: {now_str}"]
        if created_at:
            n.append(f"(задним числом: {date_label})")
        try:
            await call.bot.send_message(courier["telegram_id"], "\n".join(n), parse_mode="HTML")
        except Exception:
            pass
    await call.answer()


# ── Cancel (all IR states) ────────────────────────────────────────────────────

@router.callback_query(F.data == "wh:ir:cancel")
async def wh_ir_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    try:
        await call.message.edit_text("❌ Операция отменена.")
    except Exception:
        pass
    await call.answer()


# ─── Report ───────────────────────────────────────────────────────────────────

@router.message(F.text == "📊 Отчёт")
async def wh_report_menu(message: Message):
    if not await is_warehouse(message.from_user.id):
        return
    await message.answer("Выберите период для отчёта:", reply_markup=wh_report_period_kb())


@router.callback_query(F.data.startswith("wh:report:"))
async def wh_report(call: CallbackQuery):
    period = call.data.split(":")[2]
    label = {"today": "сегодня", "week": "неделю", "month": "месяц"}.get(period, period)

    history, couriers = await _gather(
        api.get_warehouse_history(limit=200, period=period),
        api.get_warehouse_couriers(),
    )

    prod_by_product: dict[str, int] = {}
    issue_by_product: dict[str, int] = {}
    return_by_courier: dict[str, int] = {}

    for tx in history:
        tx_type = tx.get("type", "")
        qty = tx.get("quantity", 0)
        if tx_type == "production":
            name = tx.get("product_name") or "—"
            prod_by_product[name] = prod_by_product.get(name, 0) + qty
        elif tx_type in ("issue", "issued"):
            name = tx.get("product_name") or "—"
            issue_by_product[name] = issue_by_product.get(name, 0) + qty
        elif tx_type == "bottle_return":
            cn = tx.get("courier_name") or "—"
            return_by_courier[cn] = return_by_courier.get(cn, 0) + qty

    debt_couriers = [
        (c.get("name", "—"), c.get("bottles_must_return", 0))
        for c in couriers if (c.get("bottles_must_return") or 0) > 0
    ]

    lines = [f"📊 <b>Отчёт за {label}:</b>\n"]

    if prod_by_product:
        lines.append("➕ <b>Произведено:</b>")
        for name, qty in prod_by_product.items():
            lines.append(f"  • {name}: +{qty} шт.")

    if issue_by_product:
        lines.append("\n📤 <b>Выдано курьерам:</b>")
        for name, qty in issue_by_product.items():
            lines.append(f"  • {name}: {qty} шт.")

    if return_by_courier:
        lines.append("\n↩ <b>Возврат бутылок:</b>")
        for cn, qty in return_by_courier.items():
            lines.append(f"  • {cn}: {qty} бут.")

    if debt_couriers:
        lines.append("\n📌 <b>Долг по бутылкам:</b>")
        for name, debt in debt_couriers:
            lines.append(f"  • {name}: {debt} бут.")

    if not prod_by_product and not issue_by_product and not return_by_courier and not debt_couriers:
        lines.append("Нет данных за период")

    await call.message.edit_text("\n".join(lines), parse_mode="HTML", reply_markup=wh_report_period_kb())
    await call.answer()


async def _gather(*coros):
    import asyncio
    return await asyncio.gather(*coros, return_exceptions=False)


# ─── Couriers overview ────────────────────────────────────────────────────────

@router.message(F.text == "👥 Курьеры")
async def wh_couriers(message: Message):
    if not await is_warehouse(message.from_user.id):
        return
    data = await api.get_warehouse_couriers()
    if not data:
        await message.answer("Нет данных по курьерам.")
        return

    SEP = "─" * 14
    blocks = [f"👥 <b>Курьеры</b> ({len(data)})\n{SEP}"]

    for c in data:
        name = c.get("name") or c.get("courier_name") or f"ID {c.get('id')}"
        vehicle_parts = []
        if c.get("vehicle_type"):
            vehicle_parts.append(c["vehicle_type"])
        if c.get("vehicle_plate"):
            vehicle_parts.append(c["vehicle_plate"])

        card = [f"👤 <b>{name}</b>"]
        if vehicle_parts:
            card.append(f"🚗 {' · '.join(vehicle_parts)}")

        issued = c.get("issued_products", {})
        if isinstance(issued, dict) and issued:
            card.append("")
            card.append("📦 <b>Выдано:</b>")
            for prod_name, qty in issued.items():
                card.append(f"   {prod_name} — {qty} шт.")
        else:
            card.append("📦 Выдано: —")

        returned = c.get("bottles_returned_today", 0) or 0
        owed = c.get("bottles_must_return", 0) or 0
        card.append("")
        card.append(f"↩ Вернул: <b>{returned}</b> бут.")
        card.append(f"📌 Должен: <b>{owed}</b> бут.")

        blocks.append("\n".join(card))

    text = f"\n{SEP}\n".join(blocks)
    await message.answer(text, parse_mode="HTML")


# ─── History ──────────────────────────────────────────────────────────────────

@router.message(F.text == "📜 История")
async def wh_history_menu(message: Message):
    if not await is_warehouse(message.from_user.id):
        return
    await message.answer("Выберите тип операции:", reply_markup=wh_history_filter_kb())


def _fmt_ts(created_at: str) -> str:
    if not created_at:
        return ""
    try:
        from datetime import datetime, timezone, timedelta
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        local = dt.astimezone(timezone(timedelta(hours=5)))
        return local.strftime("%-d %b, %H:%M")
    except Exception:
        return created_at[:10]


@router.callback_query(F.data.startswith("wh:hist:"))
async def wh_history(call: CallbackQuery):
    tx_type_raw = call.data.split(":")[2]
    tx_type = None if tx_type_raw == "all" else tx_type_raw
    history = await api.get_warehouse_history(limit=20, tx_type=tx_type, period="today")
    if not history:
        await call.message.edit_text("История операций пуста.")
        await call.answer()
        return

    TYPE_ICON = {
        "production": "➕",
        "issue": "📤",
        "issued": "📤",
        "bottle_return": "↩",
        "return": "↩",
        "returned": "↩",
    }

    blocks = ["📜 <b>История · сегодня</b>"]
    for tx in history[:20]:
        tx_type_val = tx.get("type", "")
        icon = TYPE_ICON.get(tx_type_val, "•")
        kind = TX_RU.get(tx_type_val, tx_type_val)
        name = tx.get("product_name") or ("Бутылки 19л" if tx_type_val == "bottle_return" else "—")
        qty = tx.get("quantity", 0)
        sign = "+" if tx_type_val == "production" else ("+" if "return" in tx_type_val else "−")
        ts = _fmt_ts(tx.get("created_at", ""))
        courier = tx.get("courier_name") or ""
        note = tx.get("note") or ""

        header = f"{icon} <b>{kind}</b>" + (f" · {courier}" if courier else "")
        body = f"{name} — {sign}{qty} шт."
        meta_parts = [ts] + ([note] if note else [])
        meta = " · ".join(meta_parts)

        blocks.append(f"{header}\n{body}" + (f"\n<i>{meta}</i>" if meta else ""))

    await call.message.edit_text("\n\n".join(blocks), parse_mode="HTML")
    await call.answer()


# ─── Stock overview with quick actions ────────────────────────────────────────

@router.callback_query(F.data == "wh:quick:prod")
async def wh_quick_prod(call: CallbackQuery, state: FSMContext):
    await call.answer()
    if not await is_warehouse(call.from_user.id):
        return
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    await state.update_data(wh_products=catalog)
    await state.set_state(ProductionState.choosing_product)
    await call.message.answer("Выберите продукт для записи производства:",
                               reply_markup=wh_prod_product_kb(catalog))


@router.callback_query(F.data == "wh:quick:ir")
async def wh_quick_ir(call: CallbackQuery, state: FSMContext):
    await call.answer()
    if not await is_warehouse(call.from_user.id):
        return
    await _ir_start_flow(call, state)


# ─── Period/overview ──────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("wh:period:"))
async def wh_period(call: CallbackQuery):
    period = call.data.split(":")[2]
    overview = await api.get_warehouse_overview(period)
    label = {"today": "сегодня", "week": "неделю", "month": "месяц"}.get(period, period)
    totals = overview.get("totals", {})
    products = overview.get("products", [])
    lines = [f"📊 <b>Сводка склада за {label}:</b>\n"]
    lines.append(f"Произведено: {totals.get('produced_period', 0)} шт.")
    lines.append(f"Выдано: {totals.get('issued_period', 0)} шт.")
    lines.append(f"Возврат бутылок: {totals.get('bottle_returns_period', 0)} шт.")
    if products:
        lines.append("\n<b>Текущие остатки:</b>")
        for item in products:
            qty = item.get("stock", item.get("quantity", 0))
            warn = " ⚠️" if qty < 10 else ""
            lines.append(f"• {item.get('product_name', '—')}: {qty} шт.{warn}")
    await call.message.edit_text("\n".join(lines), parse_mode="HTML", reply_markup=wh_period_kb())
    await call.answer()


# ─── Subscriptions (read-only, stock focus) ──────────────────────────────────

async def _wh_subs_menu(message_or_call, is_call: bool = False):
    weekly = await api.get_admin_subscriptions(plan="weekly", status="active")
    monthly = await api.get_admin_subscriptions(plan="monthly", status="active")

    import re as _re
    water_totals: dict[str, int] = {}
    for s in weekly:
        for part in s.get("water_summary", "").split(","):
            part = part.strip()
            if not part:
                continue
            m = _re.match(r"(.+?)\s*[xхX×]\s*(\d+)", part)
            name, qty = (m.group(1).strip(), int(m.group(2))) if m else (part, 1)
            water_totals[name] = water_totals.get(name, 0) + qty

    text = _subs_summary_text(weekly, monthly)
    if water_totals:
        text += "\n\n<b>📦 Нужно за эту неделю:</b>\n"
        text += "\n".join(f"  • {k} × {v} шт." for k, v in sorted(water_totals.items()))

    kb = subs_menu_kb("wh", len(weekly), len(monthly))
    if is_call:
        try:
            await message_or_call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
        except Exception:
            await message_or_call.message.answer(text, parse_mode="HTML", reply_markup=kb)
    else:
        await message_or_call.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(F.text == "📅 Подписки")
async def wh_subs_overview(message: Message):
    if not await is_warehouse(message.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await message.answer("📅 Модуль подписок отключён администратором.")
        return
    await _wh_subs_menu(message, is_call=False)


@router.callback_query(F.data == "wh:subs:menu")
async def wh_subs_menu_cb(call: CallbackQuery):
    await call.answer()
    if not await is_warehouse(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.message.answer("⚠️ Подписки отключены.")
        return
    await _wh_subs_menu(call, is_call=True)


@router.callback_query(F.data.startswith("wh:subs:weekly:") | F.data.startswith("wh:subs:monthly:"))
async def wh_subs_list(call: CallbackQuery):
    await call.answer()
    if not await is_warehouse(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.message.answer("⚠️ Подписки отключены.")
        return
    parts = call.data.split(":")
    plan, page = parts[2], int(parts[3])
    subs = await api.get_admin_subscriptions(plan=plan, status="active")

    def _sort_key(s):
        return 0 if s.get("overdue") else (1 if s.get("due_today") else 2)

    subs.sort(key=_sort_key)
    plan_label = "Еженедельные" if plan == "weekly" else "Ежемесячные"
    PAGE_SIZE = 5
    start = page * PAGE_SIZE
    chunk = subs[start:start + PAGE_SIZE]
    header = f"📋 <b>{plan_label} подписки ({len(subs)}):</b>\n\n"
    detail_lines = [f"{i + 1}. {_sub_card_text(s)}" for i, s in enumerate(chunk, start=start)]
    text = header + "\n\n".join(detail_lines) if chunk else header + "Нет активных подписок."

    kb = subs_list_kb("wh", subs, plan, page, can_create_order=False)
    try:
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except Exception:
        await call.message.answer(text, parse_mode="HTML", reply_markup=kb)


# ─── Cancel issue batch ───────────────────────────────────────────────────────

_CANCEL_PAGE_SIZE = 5


class WrhCancelState(StatesGroup):
    listing = State()
    confirming = State()


def _cancel_list_kb(batches: list, page: int) -> InlineKeyboardMarkup:
    start = page * _CANCEL_PAGE_SIZE
    chunk = batches[start:start + _CANCEL_PAGE_SIZE]
    rows = [
        [InlineKeyboardButton(
            text=f"{i + 1}. {'🏭 ' if b.get('transaction_type') == 'factory_issue' else ''}{b.get('courier_name', '?')} · {_fmt_ts(b.get('created_at', ''))}",
            callback_data=f"wh:cncl:sel:{b['batch_id']}",
        )]
        for i, b in enumerate(chunk, start=start)
    ]
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="◀", callback_data=f"wh:cncl:pg:{page - 1}"))
    total_pages = (len(batches) + _CANCEL_PAGE_SIZE - 1) // _CANCEL_PAGE_SIZE
    if page + 1 < total_pages:
        nav.append(InlineKeyboardButton(text="▶", callback_data=f"wh:cncl:pg:{page + 1}"))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton(text="❌ Закрыть", callback_data="wh:cncl:close")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _cancel_confirm_kb(batch_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, отменить", callback_data=f"wh:cncl:ok:{batch_id}"),
            InlineKeyboardButton(text="◀ Назад", callback_data="wh:cncl:back"),
        ]
    ])


async def _show_cancel_list(target, state: FSMContext, page: int = 0):
    data = await state.get_data()
    batches = data.get("wh_cancel_batches", [])
    if not batches:
        text = "Нет доступных выдач для отмены."
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="❌ Закрыть", callback_data="wh:cncl:close")]
        ])
    else:
        text = f"🗑 <b>Отмена выдачи</b>\nВсего: {len(batches)} шт. Выберите:"
        kb = _cancel_list_kb(batches, page)
    await state.set_state(WrhCancelState.listing)
    if isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
        except Exception:
            await target.message.answer(text, parse_mode="HTML", reply_markup=kb)
    else:
        await target.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(F.text == "🗑 Отменить выдачу")
async def wh_cancel_start(message: Message, state: FSMContext):
    if not await is_warehouse(message.from_user.id):
        return
    batches = await api.get_warehouse_batches()
    await state.update_data(wh_cancel_batches=batches)
    await _show_cancel_list(message, state, page=0)


@router.callback_query(WrhCancelState.listing, F.data.startswith("wh:cncl:pg:"))
async def wh_cancel_page(call: CallbackQuery, state: FSMContext):
    page = int(call.data.split(":")[-1])
    await call.answer()
    await _show_cancel_list(call, state, page=page)


@router.callback_query(WrhCancelState.listing, F.data.startswith("wh:cncl:sel:"))
async def wh_cancel_select(call: CallbackQuery, state: FSMContext):
    batch_id = call.data[len("wh:cncl:sel:"):]
    data = await state.get_data()
    batches = data.get("wh_cancel_batches", [])
    batch = next((b for b in batches if b["batch_id"] == batch_id), None)
    if not batch:
        await call.answer("Не найдено", show_alert=True)
        return
    await state.update_data(wh_cancel_selected=batch)
    await state.set_state(WrhCancelState.confirming)
    items_text = ", ".join(
        f"{it['quantity']} × {it['product_name']}" for it in batch.get("items", [])
    )
    _is_factory = batch.get("transaction_type") == "factory_issue"
    _recipient_label = "Завод" if _is_factory else "Курьер"
    text = (
        f"🗑 <b>Отменить выдачу?</b>\n\n"
        f"{_recipient_label}: {batch.get('courier_name', '—')}\n"
        f"Дата: {_fmt_ts(batch.get('created_at', ''))}\n"
        f"Состав: {items_text or '—'}"
    )
    await call.answer()
    try:
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=_cancel_confirm_kb(batch_id))
    except Exception:
        await call.message.answer(text, parse_mode="HTML", reply_markup=_cancel_confirm_kb(batch_id))


@router.callback_query(WrhCancelState.confirming, F.data.startswith("wh:cncl:ok:"))
async def wh_cancel_confirm(call: CallbackQuery, state: FSMContext):
    batch_id = call.data[len("wh:cncl:ok:"):]
    await call.answer()
    operator = await _operator_name(call.from_user.id)
    try:
        await api.cancel_warehouse_batch(batch_id, cancelled_by=operator, cancelled_by_role="warehouse")
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка: {e}")
        await state.clear()
        return
    data = await state.get_data()
    batch = data.get("wh_cancel_selected", {})
    _rl = "Завод" if batch.get("transaction_type") == "factory_issue" else "Курьер"
    await call.message.edit_text(
        f"✅ Выдача отменена.\n{_rl}: {batch.get('courier_name', '—')} · {_fmt_ts(batch.get('created_at', ''))}",
        parse_mode="HTML",
    )
    await state.clear()


@router.callback_query(WrhCancelState.confirming, F.data == "wh:cncl:back")
async def wh_cancel_back(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await _show_cancel_list(call, state, page=0)


@router.callback_query(F.data == "wh:cncl:close")
async def wh_cancel_close(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await state.clear()
    await call.message.edit_text("Отменено.")
