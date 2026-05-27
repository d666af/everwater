from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.warehouse import (
    warehouse_menu_kb, wh_prod_product_kb,
    wh_report_period_kb, wh_history_filter_kb, wh_period_kb,
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
    date_select = State()
    date_custom = State()
    entity_select = State()
    qty_19l = State()
    qty_bottles = State()
    confirm = State()
    qty_extra = State()


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


# ─── Issue flow ───────────────────────────────────────────────────────────────

from datetime import datetime, timezone, timedelta, date as _date_cls

_TZ_UZ = timezone(timedelta(hours=5))


def _today_uz() -> str:
    return datetime.now(tz=_TZ_UZ).strftime("%Y-%m-%d")


def _fmt_date_label(iso: str) -> str:
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


def _find_product_liters(catalog, liters):
    target = f"{liters}л"
    for p in catalog:
        if target in p.get("name", "").lower().replace(" ", ""):
            return p
    return None


def _simple_kb(*btns) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t, callback_data=c)] for t, c in btns
    ])


def _confirm_text(data: dict) -> str:
    entity_type = data.get("ir_entity_type", "courier")
    entity_name = data.get("ir_entity_name", "")
    entity_phone = data.get("ir_entity_phone", "")
    entity_cat = data.get("ir_entity_cat", "")
    issue_date = data.get("ir_issue_date", _today_uz())
    qty_19l = data.get("ir_qty_19l", 0)
    qty_bottles = data.get("ir_qty_bottles", 0)
    extra = data.get("ir_extra", {})
    is_backdated = issue_date != _today_uz()
    now_str = datetime.now(tz=_TZ_UZ).strftime("%d.%m %H:%M")
    date_label = _fmt_date_label(issue_date)
    date_line = f"⏮ <b>{date_label} {now_str[-5:]}</b>  (задним числом)" if is_backdated else f"📅 <b>{now_str}</b>"
    lines = [date_line, ""]
    if entity_type == "courier":
        lines.append(f"👤 {entity_name}" + (f"  {entity_phone}" if entity_phone else ""))
    else:
        tl = "Другое" if (entity_cat == "other" or entity_name == "НАХТ") else "Завод"
        lines.append(f"🏭 {entity_name}  ({tl})")
    lines += ["", f"🚰 Вода 19л — <b>{qty_19l}</b> шт."]
    if entity_type == "courier" and qty_bottles > 0:
        lines.append(f"↩ Бутылки 19л — <b>{qty_bottles}</b> шт.")
    for pdata in extra.values():
        if pdata.get("qty", 0) > 0:
            lines.append(f"📦 {pdata['name']} — <b>{pdata['qty']}</b> шт.")
    return "\n".join(lines)


def _confirm_kb(catalog, is_courier) -> InlineKeyboardMarkup:
    p10 = _find_product_liters(catalog, "10")
    p5 = _find_product_liters(catalog, "5")
    rows = []
    if p10:
        rows.append([InlineKeyboardButton(text=f"➕ {p10['name']}", callback_data="wh:ir:add:10")])
    if p5:
        rows.append([InlineKeyboardButton(text=f"➕ {p5['name']}", callback_data="wh:ir:add:5")])
    rows.append([InlineKeyboardButton(text="✅ Подтвердить", callback_data="wh:ir:submit")])
    rows.append([InlineKeyboardButton(text="❌ Отмена", callback_data="wh:ir:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _entity_kb(couriers, factories) -> InlineKeyboardMarkup:
    buttons = []
    if couriers:
        buttons.append([InlineKeyboardButton(text="── Курьеры ──", callback_data="wh:ir:noop")])
        for c in couriers:
            phone = c.get("phone", "")
            buttons.append([InlineKeyboardButton(
                text=c["name"] + (f"  {phone}" if phone else ""),
                callback_data=f"wh:ir:ent:c:{c['id']}",
            )])
    if factories:
        buttons.append([InlineKeyboardButton(text="── Заводы / Другое ──", callback_data="wh:ir:noop")])
        for f in factories:
            cat = f.get("category", "")
            tl = "Другое" if (cat == "other" or f.get("name") == "НАХТ") else "Завод"
            buttons.append([InlineKeyboardButton(
                text=f"{f['name']}  ({tl})",
                callback_data=f"wh:ir:ent:f:{f['id']}",
            )])
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="wh:ir:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _edit_main(bot, chat_id, msg_id, text, reply_markup=None, parse_mode="HTML"):
    try:
        await bot.edit_message_text(
            chat_id=chat_id, message_id=msg_id,
            text=text, parse_mode=parse_mode, reply_markup=reply_markup,
        )
    except Exception:
        pass


async def _delete_msg(bot, chat_id, msg_id):
    try:
        await bot.delete_message(chat_id=chat_id, message_id=msg_id)
    except Exception:
        pass


async def _show_confirm(bot, chat_id, msg_id, state: FSMContext):
    data = await state.get_data()
    await state.set_state(IssueState.confirm)
    await _edit_main(
        bot, chat_id, msg_id, _confirm_text(data),
        reply_markup=_confirm_kb(data.get("ir_catalog", []), data.get("ir_entity_type") == "courier"),
    )


async def _ir_start(target, state: FSMContext):
    is_cb = isinstance(target, CallbackQuery)
    uid = target.from_user.id
    chat_id = (target.message if is_cb else target).chat.id
    operator = await _operator_name(uid)
    couriers = await api.get_couriers_warehouse()
    active = [c for c in (couriers or []) if c.get("is_active", True)]
    factories = await api.get_factories()
    active_factories = [f for f in (factories or []) if f.get("is_active", True)]
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    await state.update_data(
        ir_operator=operator, ir_couriers=active, ir_factories=active_factories,
        ir_catalog=catalog, ir_issue_date=_today_uz(),
        ir_qty_19l=0, ir_qty_bottles=0, ir_extra={}, ir_entity_type=None,
    )
    await state.set_state(IssueState.date_select)
    now_uz = datetime.now(tz=_TZ_UZ)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📅 Сегодня", callback_data=f"wh:ir:dt:{_today_uz()}"),
            InlineKeyboardButton(text="📅 Вчера", callback_data=f"wh:ir:dt:{(now_uz - timedelta(days=1)).strftime('%Y-%m-%d')}"),
        ],
        [
            InlineKeyboardButton(text="✏️ Другая дата", callback_data="wh:ir:dt:custom"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="wh:ir:cancel"),
        ],
    ])
    if is_cb:
        try:
            await target.message.edit_text("Выберите дату:", reply_markup=kb)
            await state.update_data(ir_msg_id=target.message.message_id, ir_chat_id=chat_id)
        except Exception:
            sent = await target.message.answer("Выберите дату:", reply_markup=kb)
            await state.update_data(ir_msg_id=sent.message_id, ir_chat_id=chat_id)
    else:
        try:
            await target.delete()
        except Exception:
            pass
        sent = await target.answer("Выберите дату:", reply_markup=kb)
        await state.update_data(ir_msg_id=sent.message_id, ir_chat_id=chat_id)


@router.message(F.text == "🔄 Выдать/Возврат")
async def wh_ir_start(message: Message, state: FSMContext):
    if not await is_warehouse(message.from_user.id):
        return
    await _ir_start(message, state)


# ── Step 1: Date ──────────────────────────────────────────────────────────────

@router.callback_query(IssueState.date_select, F.data.startswith("wh:ir:dt:"))
async def wh_ir_date(call: CallbackQuery, state: FSMContext):
    key = call.data[len("wh:ir:dt:"):]
    data = await state.get_data()
    await call.answer()
    if key == "custom":
        await state.set_state(IssueState.date_custom)
        await _edit_main(call.bot, data["ir_chat_id"], data["ir_msg_id"],
                         "✏️ Введите дату (ДД.ММ или ДД.ММ.ГГГГ):",
                         reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")))
    else:
        await state.update_data(ir_issue_date=key)
        data = await state.get_data()
        await state.set_state(IssueState.entity_select)
        date_line = f"⏮ {_fmt_date_label(key)} — задним числом\n\n" if key != _today_uz() else ""
        await _edit_main(call.bot, data["ir_chat_id"], data["ir_msg_id"],
                         f"{date_line}👤 Выберите получателя:",
                         reply_markup=_entity_kb(data.get("ir_couriers", []), data.get("ir_factories", [])))


@router.message(IssueState.date_custom)
async def wh_ir_date_custom(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    data = await state.get_data()
    await _delete_msg(message.bot, data["ir_chat_id"], message.message_id)
    try:
        parts = text.split(".")
        d, m = int(parts[0]), int(parts[1])
        y = int(parts[2]) if len(parts) >= 3 else datetime.now(tz=_TZ_UZ).year
        parsed = _date_cls(y, m, d)
        if parsed > datetime.now(tz=_TZ_UZ).date():
            raise ValueError("future")
        iso = parsed.isoformat()
    except Exception:
        await _edit_main(message.bot, data["ir_chat_id"], data["ir_msg_id"],
                         "✏️ Неверный формат. Введите дату (ДД.ММ или ДД.ММ.ГГГГ):",
                         reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")))
        return
    await state.update_data(ir_issue_date=iso)
    data = await state.get_data()
    await state.set_state(IssueState.entity_select)
    await _edit_main(message.bot, data["ir_chat_id"], data["ir_msg_id"],
                     f"⏮ {_fmt_date_label(iso)} — задним числом\n\n👤 Выберите получателя:",
                     reply_markup=_entity_kb(data.get("ir_couriers", []), data.get("ir_factories", [])))


# ── Step 2: Entity ────────────────────────────────────────────────────────────

@router.callback_query(IssueState.entity_select, F.data.startswith("wh:ir:ent:c:"))
async def wh_ir_ent_courier(call: CallbackQuery, state: FSMContext):
    cid = int(call.data.split(":")[4])
    data = await state.get_data()
    courier = next((c for c in data.get("ir_couriers", []) if c["id"] == cid), {})
    await state.update_data(ir_entity_type="courier", ir_entity_id=cid,
                             ir_entity_name=courier.get("name", ""),
                             ir_entity_phone=courier.get("phone", ""), ir_entity_cat="")
    await state.set_state(IssueState.qty_19l)
    await call.answer()
    await _edit_main(call.bot, data["ir_chat_id"], data["ir_msg_id"],
                     f"👤 {courier.get('name', '')}\n\n🚰 Введите количество воды 19л:",
                     reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")))


@router.callback_query(IssueState.entity_select, F.data.startswith("wh:ir:ent:f:"))
async def wh_ir_ent_factory(call: CallbackQuery, state: FSMContext):
    fid = int(call.data.split(":")[4])
    data = await state.get_data()
    factory = next((f for f in data.get("ir_factories", []) if f["id"] == fid), {})
    cat = factory.get("category", "")
    fname = factory.get("name", "")
    tl = "Другое" if (cat == "other" or fname == "НАХТ") else "Завод"
    await state.update_data(ir_entity_type="factory", ir_entity_id=fid,
                             ir_entity_name=fname, ir_entity_phone="",
                             ir_entity_cat=cat or ("other" if fname == "НАХТ" else "factory"))
    await state.set_state(IssueState.qty_19l)
    await call.answer()
    await _edit_main(call.bot, data["ir_chat_id"], data["ir_msg_id"],
                     f"🏭 {fname}  ({tl})\n\n🚰 Введите количество воды 19л:",
                     reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")))


# ── Step 3: 19L qty ───────────────────────────────────────────────────────────

@router.message(IssueState.qty_19l)
async def wh_ir_qty19(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    data = await state.get_data()
    await _delete_msg(message.bot, data["ir_chat_id"], message.message_id)
    try:
        qty = max(0, int(text))
    except Exception:
        await _edit_main(message.bot, data["ir_chat_id"], data["ir_msg_id"],
                         "🚰 Введите количество воды 19л (целое число):",
                         reply_markup=_simple_kb(("❌ Отмена", "wh:ir:cancel")))
        return
    await state.update_data(ir_qty_19l=qty)
    data = await state.get_data()
    entity_name = data.get("ir_entity_name", "")
    if data.get("ir_entity_type") == "courier":
        await state.set_state(IssueState.qty_bottles)
        await _edit_main(message.bot, data["ir_chat_id"], data["ir_msg_id"],
                         f"👤 {entity_name}\n🚰 Вода 19л: {qty} шт.\n\n↩ Введите количество пустых бутылок на возврат:",
                         reply_markup=_simple_kb(
                             ("⏭ Пропустить (нет возврата)", "wh:ir:skip_bottles"),
                             ("❌ Отмена", "wh:ir:cancel"),
                         ))
    else:
        await state.update_data(ir_qty_bottles=0)
        await _show_confirm(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)


# ── Step 4: Bottle return qty (couriers only) ─────────────────────────────────

@router.callback_query(IssueState.qty_bottles, F.data == "wh:ir:skip_bottles")
async def wh_ir_skip_bottles(call: CallbackQuery, state: FSMContext):
    await state.update_data(ir_qty_bottles=0)
    data = await state.get_data()
    await _show_confirm(call.bot, data["ir_chat_id"], data["ir_msg_id"], state)
    await call.answer()


@router.message(IssueState.qty_bottles)
async def wh_ir_qty_bottles(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    data = await state.get_data()
    await _delete_msg(message.bot, data["ir_chat_id"], message.message_id)
    try:
        qty = max(0, int(text))
    except Exception:
        entity_name = data.get("ir_entity_name", "")
        await _edit_main(message.bot, data["ir_chat_id"], data["ir_msg_id"],
                         f"👤 {entity_name}\n\n↩ Введите количество пустых бутылок (целое число):",
                         reply_markup=_simple_kb(
                             ("⏭ Пропустить (нет возврата)", "wh:ir:skip_bottles"),
                             ("❌ Отмена", "wh:ir:cancel"),
                         ))
        return
    await state.update_data(ir_qty_bottles=qty)
    data = await state.get_data()
    await _show_confirm(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)


# ── Step 5: Confirmation ──────────────────────────────────────────────────────

@router.callback_query(IssueState.confirm, F.data.startswith("wh:ir:add:"))
async def wh_ir_add_extra(call: CallbackQuery, state: FSMContext):
    liters = call.data[len("wh:ir:add:"):]
    data = await state.get_data()
    prod = _find_product_liters(data.get("ir_catalog", []), liters)
    if not prod:
        await call.answer("Продукт не найден в каталоге", show_alert=True)
        return
    await state.update_data(ir_pending_extra=liters)
    await state.set_state(IssueState.qty_extra)
    await call.answer()
    await _edit_main(call.bot, data["ir_chat_id"], data["ir_msg_id"],
                     f"📦 Введите количество {prod['name']}:",
                     reply_markup=_simple_kb(
                         ("◀ Назад", "wh:ir:extra_back"),
                         ("❌ Отмена", "wh:ir:cancel"),
                     ))


@router.callback_query(IssueState.qty_extra, F.data == "wh:ir:extra_back")
async def wh_ir_extra_back(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await _show_confirm(call.bot, data["ir_chat_id"], data["ir_msg_id"], state)
    await call.answer()


@router.message(IssueState.qty_extra)
async def wh_ir_qty_extra(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    data = await state.get_data()
    await _delete_msg(message.bot, data["ir_chat_id"], message.message_id)
    liters = data.get("ir_pending_extra", "")
    prod = _find_product_liters(data.get("ir_catalog", []), liters)
    if not prod:
        await _show_confirm(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)
        return
    try:
        qty = max(0, int(text))
    except Exception:
        await _edit_main(message.bot, data["ir_chat_id"], data["ir_msg_id"],
                         f"📦 Введите количество {prod['name']} (целое число):",
                         reply_markup=_simple_kb(
                             ("◀ Назад", "wh:ir:extra_back"),
                             ("❌ Отмена", "wh:ir:cancel"),
                         ))
        return
    extra = dict(data.get("ir_extra", {}))
    if qty > 0:
        extra[str(prod["id"])] = {"name": prod["name"], "qty": qty}
    else:
        extra.pop(str(prod["id"]), None)
    await state.update_data(ir_extra=extra, ir_pending_extra=None)
    data = await state.get_data()
    await _show_confirm(message.bot, data["ir_chat_id"], data["ir_msg_id"], state)


# ── Submit ────────────────────────────────────────────────────────────────────

@router.callback_query(IssueState.confirm, F.data == "wh:ir:submit")
async def wh_ir_submit(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    entity_type = data.get("ir_entity_type")
    entity_name = data.get("ir_entity_name", "")
    entity_id = data.get("ir_entity_id")
    entity_cat = data.get("ir_entity_cat", "")
    entity_phone = data.get("ir_entity_phone", "")
    operator = data.get("ir_operator", "")
    catalog = data.get("ir_catalog", [])
    issue_date = data.get("ir_issue_date", _today_uz())
    qty_19l = data.get("ir_qty_19l", 0)
    qty_bottles = data.get("ir_qty_bottles", 0)
    extra = data.get("ir_extra", {})
    created_at = _build_created_at(issue_date)

    items = []
    prod_19l = _find_product_liters(catalog, "19")
    if prod_19l and qty_19l > 0:
        items.append({"product_id": prod_19l["id"], "product_name": prod_19l["name"], "quantity": qty_19l})
    for pid, pdata in extra.items():
        if pdata.get("qty", 0) > 0:
            items.append({"product_id": int(pid), "product_name": pdata["name"], "quantity": pdata["qty"]})

    if not items and (entity_type != "courier" or qty_bottles <= 0):
        await call.answer("Нечего выдавать — добавьте хотя бы один товар", show_alert=True)
        return

    try:
        if entity_type == "factory":
            await api.factory_issue_batch(entity_name, items, performed_by=operator, created_at=created_at)
        else:
            await api.issue_batch(entity_id, items, qty_bottles,
                                  performed_by=operator, vehicle_type=None, vehicle_plate=None,
                                  created_at=created_at)
    except Exception as e:
        await call.answer(f"Ошибка: {e}", show_alert=True)
        return

    await state.clear()
    date_label = _fmt_date_label(issue_date)
    lines = ["✅ <b>Записано!</b>", ""]
    if entity_type == "courier":
        lines.append(f"👤 {entity_name}" + (f"  {entity_phone}" if entity_phone else ""))
    else:
        tl = "Другое" if (entity_cat == "other" or entity_name == "НАХТ") else "Завод"
        lines.append(f"🏭 {entity_name}  ({tl})")
    lines.append(f"📅 {date_label}")
    if items:
        lines += ["", "📦 Выдано:"] + [f"  • {it['product_name']} — {it['quantity']} шт." for it in items]
    if entity_type == "courier" and qty_bottles > 0:
        lines.append(f"↩ Возврат бутылок: {qty_bottles} шт.")
    try:
        await call.message.edit_text("\n".join(lines), parse_mode="HTML")
    except Exception:
        await call.message.answer("\n".join(lines), parse_mode="HTML")

    if entity_type == "courier":
        couriers_list = data.get("ir_couriers", [])
        courier = next((c for c in couriers_list if c.get("id") == entity_id), {})
        if courier.get("telegram_id") and (items or qty_bottles > 0):
            now_str = datetime.now(tz=_TZ_UZ).strftime("%d.%m.%Y %H:%M")
            n = ["📦 <b>Накладная со склада</b>", ""]
            n += [f"  • {it['product_name']} — {it['quantity']} шт." for it in items]
            if qty_bottles > 0:
                n.append(f"↩ Возврат бутылок: {qty_bottles} шт.")
            n += ["", f"Время: {now_str}"]
            if created_at:
                n.append(f"(задним числом: {date_label})")
            try:
                await call.bot.send_message(courier["telegram_id"], "\n".join(n), parse_mode="HTML")
            except Exception:
                pass
    await call.answer()


# ── Noop & Cancel ─────────────────────────────────────────────────────────────

@router.callback_query(F.data == "wh:ir:noop")
async def wh_ir_noop(call: CallbackQuery):
    await call.answer()


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
    await _ir_start(call, state)


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
