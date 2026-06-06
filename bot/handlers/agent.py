import logging
from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery,
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo, ReplyKeyboardRemove,
)
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from config import settings
import services.api_client as api

log = logging.getLogger(__name__)

router = Router()


def _site(path: str) -> str:
    return f"{settings.MINI_APP_URL.rstrip('/')}{path}"


def agent_webapp_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Оформить заказ")],
            [KeyboardButton(text="📜 История заказов", web_app=WebAppInfo(url=_site("/agent/orders")))],
        ],
        resize_keyboard=True,
    )


@router.message(Command("agent"))
async def agent_panel(message: Message):
    agent = await api.get_agent_by_telegram(message.from_user.id)
    if not agent:
        await message.answer("❌ Вы не зарегистрированы как агент.")
        return
    await message.answer(
        f"🤝 <b>Панель агента</b>\n\n"
        f"Имя: {agent.get('name', '—')}\n"
        f"Телефон: {agent.get('phone', '—')}",
        parse_mode="HTML",
        reply_markup=agent_webapp_kb(),
    )


# ─── Agent order creation FSM ─────────────────────────────────────────────────

class AcoOrderCreate(StatesGroup):
    waiting_input    = State()
    choosing_product = State()
    waiting_bottles  = State()
    waiting_lent_bottles = State()
    choosing_address = State()
    waiting_address  = State()
    waiting_location = State()
    confirming       = State()


def _fmt(n: float) -> str:
    return f"{int(n):,}".replace(",", " ")


def _exch_price(p: dict) -> float:
    if p.get("has_bottle_deposit") and p.get("deposit_price"):
        return float(p["deposit_price"])
    return float(p.get("effective_price") or p.get("price") or 0)


def _full_price(p: dict) -> float:
    return float(p.get("price") or 0)


def _spc(products: list) -> float:
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


def _bottles_step_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Одолжить бутылки", callback_data="aco:lent_bottles")]
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


def _grid_kb(products: list, items: dict) -> InlineKeyboardMarkup:
    rows = []
    pair = []
    for p in products:
        if not p.get("is_active", True):
            continue
        pid = str(p["id"])
        qty = items.get(pid, 0)
        name = p.get("name", "?")
        label = f"✅ {name} ×{qty}" if qty > 0 else f"➕ {name}"
        pair.append(InlineKeyboardButton(text=label, callback_data=f"aco:cp:{pid}"))
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
            text=f"▶ Далее  {total_qty} шт. · {_fmt(total_price)}",
            callback_data="aco:done",
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _grid_text(items: dict, products: list) -> str:
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
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {_fmt(s)}{dep}")
    lines.append(f"\n<b>Итого: {_fmt(total)}</b>")
    return "\n".join(lines)


def _qty_kb(pid: str, qty: int) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="➖", callback_data=f"aco:qd:{pid}:-1"),
            InlineKeyboardButton(text=f"{qty} шт.", callback_data="aco:noop"),
            InlineKeyboardButton(text="➕", callback_data=f"aco:qd:{pid}:1"),
        ],
        [
            InlineKeyboardButton(text="1", callback_data=f"aco:qs:{pid}:1"),
            InlineKeyboardButton(text="2", callback_data=f"aco:qs:{pid}:2"),
            InlineKeyboardButton(text="3", callback_data=f"aco:qs:{pid}:3"),
        ],
        [
            InlineKeyboardButton(text="5", callback_data=f"aco:qs:{pid}:5"),
            InlineKeyboardButton(text="10", callback_data=f"aco:qs:{pid}:10"),
            InlineKeyboardButton(text="20", callback_data=f"aco:qs:{pid}:20"),
        ],
    ]
    actions = []
    if qty > 0:
        actions.append(InlineKeyboardButton(text="🗑 Убрать", callback_data=f"aco:qremove:{pid}"))
    actions.append(InlineKeyboardButton(text="◀ Назад", callback_data="aco:back_catalog"))
    rows.append(actions)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _qty_text(pid: str, products: list, items: dict) -> str:
    p = next((x for x in products if str(x["id"]) == pid), {})
    ep = _exch_price(p)
    fp = _full_price(p)
    qty = items.get(pid, 0)
    vol = p.get("volume", "")
    vol_str = f" {vol}л" if vol else ""
    dep_hint = (
        f"\n<i>♻ Цена с обменом. Без обмена: {_fmt(fp)}</i>"
        if p.get("has_bottle_deposit") and ep < fp else ""
    )
    lines = [f"<b>{p.get('name', '?')}{vol_str}</b>", f"💵 {_fmt(ep)} за шт.{dep_hint}"]
    if qty > 0:
        lines.append(f"\n📦 В заказе: {qty} шт. — {_fmt(ep * qty)}")
    lines.append("\nВыберите количество:")
    return "\n".join(lines)


def _addr_coords(client: dict | None, address: str):
    """Return (lat, lng) of a saved address for this client, or (None, None)."""
    if not client or not address:
        return None, None
    for a in (client.get("order_addresses") or []):
        if isinstance(a, dict) and (a.get("address") or "").strip() == address.strip():
            lat, lng = a.get("lat"), a.get("lng")
            if lat is not None and lng is not None:
                return lat, lng
    return None, None


def _confirm_text(data: dict, products: list) -> str:
    client = data.get("aco_client")
    phone = data.get("aco_phone", "—")
    address = data.get("aco_address", "—")
    items = data.get("aco_items", {})
    return_bottles = data.get("aco_return_bottles", 0)
    lent_bottles = data.get("aco_lent_bottles", 0)
    prod_map = {str(p["id"]): p for p in products}
    surcharge = _calc_surcharge(items, products, return_bottles, lent_bottles)

    lines = ["📋 <b>Подтверждение заказа</b>\n"]
    _cname = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—') if client else None
    lines.append(f"👤 {_cname} · {phone}" if client else f"👤 {phone}")
    lines.append(f"📍 {address}")
    if data.get("aco_lat") is not None and data.get("aco_lng") is not None:
        lines.append("🗺 Локация прикреплена ✓")
    lines.append("\nТовары:")

    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        ep = _exch_price(p)
        fp = _full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {_fmt(s)}{dep}")

    if return_bottles > 0:
        lines.append(f"\n♻️ Возврат: {return_bottles} шт.")
    if lent_bottles > 0:
        lines.append(f"🔄 Одолжено: {lent_bottles} шт.")
    if surcharge > 0:
        missing = max(0, _qty19(items, products) - return_bottles - lent_bottles)
        lines.append(f"🫙 Надбавка за невозврат {missing} бут.: +{_fmt(surcharge)}")
        total += surcharge

    lines.append(f"\n<b>Итого: {_fmt(total)}</b>")
    return "\n".join(lines)


def _confirm_kb(has_location: bool = False) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="✏️ Состав",  callback_data="aco:edit:items"),
            InlineKeyboardButton(text="♻️ Возврат", callback_data="aco:edit:bottles"),
            InlineKeyboardButton(text="📍 Адрес",   callback_data="aco:edit:address"),
        ],
    ]
    if not has_location:
        rows.append([InlineKeyboardButton(text="📍 Добавить локацию", callback_data="aco:add_location")])
    rows.append([InlineKeyboardButton(text="✅ Создать заказ", callback_data="aco:confirm")])
    rows.append([InlineKeyboardButton(text="❌ Отмена", callback_data="aco:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _addr_kb(options: list) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=f"📍 {addr[:45]}", callback_data=f"aco:adr:{i}")]
        for i, addr in enumerate(options)
    ]
    rows.append([InlineKeyboardButton(text="✏️ Другой адрес", callback_data="aco:adr:custom")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _show_addr(target, state: FSMContext):
    data = await state.get_data()
    options = data.get("aco_addr_options", [])
    if options:
        await state.set_state(AcoOrderCreate.choosing_address)
        text = "📍 Выберите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text, reply_markup=_addr_kb(options))
        else:
            await target.answer(text, reply_markup=_addr_kb(options))
    else:
        await state.set_state(AcoOrderCreate.waiting_address)
        text = "📍 Введите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text)
        else:
            await target.answer(text)


async def _show_confirm(target, state: FSMContext):
    data = await state.get_data()
    products = data.get("aco_products", [])
    text = _confirm_text(data, products)
    has_loc = data.get("aco_lat") is not None and data.get("aco_lng") is not None
    kb = _confirm_kb(has_loc)
    await state.set_state(AcoOrderCreate.confirming)
    if isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
        except Exception:
            await target.message.answer(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


# ─── Trigger ──────────────────────────────────────────────────────────────────

@router.message(F.text == "📋 Оформить заказ")
async def aco_start(message: Message, state: FSMContext):
    agent = await api.get_agent_by_telegram(message.from_user.id)
    if not agent:
        return
    await state.update_data(aco_items={}, aco_agent_id=agent["id"])
    await state.set_state(AcoOrderCreate.waiting_input)
    await message.answer(
        "📋 <b>Новый заказ</b>\n\n"
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


# ─── Phone / quick-input ──────────────────────────────────────────────────────

@router.message(AcoOrderCreate.waiting_input)
async def aco_input(message: Message, state: FSMContext):
    text = message.text.strip()
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    products = await api.get_products()
    products = [p for p in products if p.get("is_active", True)]

    if len(lines) >= 3:
        # Quick input: qty / address / phone [/ баклажка]
        try:
            qty = int(lines[0])
        except ValueError:
            await message.answer("❌ Первая строка должна быть числом (количество бутылей).")
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
            aco_phone=phone,
            aco_products=products,
            aco_items=items,
            aco_client=client,
            aco_return_bottles=return_bottles,
            aco_addr_options=addr_options,
            aco_edit_mode=False,
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
        await _show_addr(message, state)

    else:
        # Normal mode: phone only → show product catalog
        phone = text
        if sum(1 for c in phone if c.isdigit()) < 9:
            await message.answer("❌ Неверный номер телефона — введите минимум 9 цифр.\nПопробуйте ещё раз.")
            return
        client = await api.lookup_user_by_phone(phone)
        await state.update_data(
            aco_phone=phone,
            aco_products=products,
            aco_items={},
            aco_client=client,
            aco_addr_options=_client_addrs(client),
            aco_edit_mode=False,
        )
        await state.set_state(AcoOrderCreate.choosing_product)

        if client:
            bottles_owed = client.get("bottles_owed", 0)
            _cn = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
            info = f"✅ Клиент найден: {_cn} | {client.get('phone', phone)}"
            if bottles_owed > 0:
                info += f"\n🫙 Долг по бутылкам: {bottles_owed} шт."
        else:
            info = "ℹ️ Клиент не найден — заказ создастся по номеру телефона"

        await message.answer(
            f"{info}\n\n{_grid_text({}, products)}",
            reply_markup=_grid_kb(products, {}),
            parse_mode="HTML",
        )


# ─── Product catalog ──────────────────────────────────────────────────────────

@router.callback_query(AcoOrderCreate.choosing_product, F.data == "aco:noop")
async def aco_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(AcoOrderCreate.choosing_product, F.data.startswith("aco:cp:"))
async def aco_pick_product(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    items = data.get("aco_items", {})
    products = data.get("aco_products", [])
    qty = items.get(pid, 0)
    await call.message.edit_text(_qty_text(pid, products, items), reply_markup=_qty_kb(pid, qty), parse_mode="HTML")
    await call.answer()


@router.callback_query(AcoOrderCreate.choosing_product, F.data.startswith("aco:qd:"))
async def aco_qty_delta(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid, delta = parts[2], int(parts[3])
    data = await state.get_data()
    items = dict(data.get("aco_items", {}))
    new_qty = max(0, items.get(pid, 0) + delta)
    if new_qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = new_qty
    await state.update_data(aco_items=items)
    products = data.get("aco_products", [])
    await call.message.edit_text(_qty_text(pid, products, items), reply_markup=_qty_kb(pid, new_qty), parse_mode="HTML")
    await call.answer()


@router.callback_query(AcoOrderCreate.choosing_product, F.data.startswith("aco:qs:"))
async def aco_qty_set(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid, qty = parts[2], int(parts[3])
    data = await state.get_data()
    items = dict(data.get("aco_items", {}))
    if qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = qty
    await state.update_data(aco_items=items)
    products = data.get("aco_products", [])
    await call.message.edit_text(_qty_text(pid, products, items), reply_markup=_qty_kb(pid, qty), parse_mode="HTML")
    await call.answer()


@router.callback_query(AcoOrderCreate.choosing_product, F.data.startswith("aco:qremove:"))
async def aco_qty_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    items = dict(data.get("aco_items", {}))
    items.pop(pid, None)
    await state.update_data(aco_items=items)
    products = data.get("aco_products", [])
    await call.message.edit_text(_grid_text(items, products), reply_markup=_grid_kb(products, items), parse_mode="HTML")
    await call.answer()


@router.callback_query(AcoOrderCreate.choosing_product, F.data == "aco:back_catalog")
async def aco_back_catalog(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    items = data.get("aco_items", {})
    products = data.get("aco_products", [])
    await call.message.edit_text(_grid_text(items, products), reply_markup=_grid_kb(products, items), parse_mode="HTML")
    await call.answer()


@router.callback_query(AcoOrderCreate.choosing_product, F.data == "aco:done")
async def aco_items_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("aco_items"):
        await call.answer("Добавьте хотя бы один товар!")
        return
    items = data["aco_items"]
    products = data.get("aco_products", [])
    has_deposit = any(
        {str(p["id"]): p for p in products}.get(pid, {}).get("has_bottle_deposit")
        for pid in items
    )
    if data.get("aco_edit_mode"):
        await call.answer()
        await _show_confirm(call, state)
        return
    if has_deposit:
        await state.set_state(AcoOrderCreate.waiting_bottles)
        await call.message.edit_text(
            "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
            reply_markup=_bottles_step_kb(),
        )
    else:
        await state.update_data(aco_return_bottles=0)
        await _show_addr(call, state)
    await call.answer()


# ─── Bottles ──────────────────────────────────────────────────────────────────

@router.message(AcoOrderCreate.waiting_bottles)
async def aco_bottles(message: Message, state: FSMContext):
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 0, 1, 2")
        return
    await state.update_data(aco_return_bottles=count)
    data = await state.get_data()
    if data.get("aco_edit_mode"):
        await _show_confirm(message, state)
    else:
        await _show_addr(message, state)


@router.callback_query(AcoOrderCreate.waiting_bottles, F.data == "aco:lent_bottles")
async def aco_lent_tap(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await state.set_state(AcoOrderCreate.waiting_lent_bottles)
    await call.message.edit_text("🔄 Сколько бутылок одолжить клиенту?\nВведите число:")


@router.message(AcoOrderCreate.waiting_lent_bottles)
async def aco_lent_bottles(message: Message, state: FSMContext):
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 1, 2, 3")
        return
    await state.update_data(aco_lent_bottles=count)
    data = await state.get_data()
    if data.get("aco_edit_mode"):
        await _show_confirm(message, state)
    else:
        await _show_addr(message, state)


# ─── Address ──────────────────────────────────────────────────────────────────

@router.callback_query(AcoOrderCreate.choosing_address, F.data.startswith("aco:adr:"))
async def aco_select_addr(call: CallbackQuery, state: FSMContext):
    idx_str = call.data.split(":", 2)[2]
    if idx_str == "custom":
        await state.set_state(AcoOrderCreate.waiting_address)
        await call.message.edit_text("📍 Введите адрес доставки:")
        await call.answer()
        return
    data = await state.get_data()
    options = data.get("aco_addr_options", [])
    try:
        addr = options[int(idx_str)]
    except (ValueError, IndexError):
        await call.answer("Ошибка выбора")
        return
    lat, lng = _addr_coords(data.get("aco_client"), addr)
    # Keep a manually-dropped location if re-selecting the same address.
    if (lat is None or lng is None) and addr == data.get("aco_address"):
        lat, lng = data.get("aco_lat"), data.get("aco_lng")
    await state.update_data(aco_address=addr, aco_lat=lat, aco_lng=lng)
    await call.answer()
    await _show_confirm(call, state)


@router.message(AcoOrderCreate.waiting_address)
async def aco_address(message: Message, state: FSMContext):
    new_addr = message.text.strip()
    data = await state.get_data()
    if new_addr == data.get("aco_address"):
        await state.update_data(aco_address=new_addr)  # unchanged → keep any location
    else:
        await state.update_data(aco_address=new_addr, aco_lat=None, aco_lng=None)
    await _show_confirm(message, state)


# ─── Add location (geolocation) ───────────────────────────────────────────────

@router.callback_query(AcoOrderCreate.confirming, F.data == "aco:add_location")
async def aco_add_location(call: CallbackQuery, state: FSMContext):
    await state.set_state(AcoOrderCreate.waiting_location)
    await call.answer()
    await call.message.answer(
        "📍 Отправьте геолокацию точки доставки кнопкой ниже — она будет прикреплена к адресу заказа.",
        reply_markup=ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text="📍 Отправить геолокацию", request_location=True)],
                [KeyboardButton(text="↩️ Без локации")],
            ],
            resize_keyboard=True,
            one_time_keyboard=True,
        ),
    )


@router.message(AcoOrderCreate.waiting_location, F.location)
async def aco_location_received(message: Message, state: FSMContext):
    await state.update_data(
        aco_lat=message.location.latitude,
        aco_lng=message.location.longitude,
    )
    await message.answer("✅ Локация прикреплена к адресу.", reply_markup=ReplyKeyboardRemove())
    await _show_confirm(message, state)


@router.message(AcoOrderCreate.waiting_location)
async def aco_location_skip(message: Message, state: FSMContext):
    await message.answer("Продолжаем без локации.", reply_markup=ReplyKeyboardRemove())
    await _show_confirm(message, state)


# ─── Edit from confirmation ───────────────────────────────────────────────────

@router.callback_query(AcoOrderCreate.confirming, F.data == "aco:edit:items")
async def aco_edit_items(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = await api.get_products()
    products = [p for p in products if p.get("is_active", True)]
    items = data.get("aco_items", {})
    await state.update_data(aco_edit_mode=True, aco_products=products)
    await state.set_state(AcoOrderCreate.choosing_product)
    await call.message.edit_text(_grid_text(items, products), reply_markup=_grid_kb(products, items), parse_mode="HTML")
    await call.answer()


@router.callback_query(AcoOrderCreate.confirming, F.data == "aco:edit:bottles")
async def aco_edit_bottles(call: CallbackQuery, state: FSMContext):
    await state.update_data(aco_edit_mode=True)
    await state.set_state(AcoOrderCreate.waiting_bottles)
    await call.message.edit_text(
        "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
        reply_markup=_bottles_step_kb(),
    )
    await call.answer()


@router.callback_query(AcoOrderCreate.confirming, F.data == "aco:edit:address")
async def aco_edit_address(call: CallbackQuery, state: FSMContext):
    await state.update_data(aco_edit_mode=True)
    await call.answer()
    await _show_addr(call, state)


# ─── Confirm / Cancel ─────────────────────────────────────────────────────────

@router.callback_query(AcoOrderCreate.confirming, F.data == "aco:confirm")
async def aco_confirm(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    items_list = [{"product_id": int(pid), "quantity": qty} for pid, qty in data["aco_items"].items()]
    products = data.get("aco_products", [])
    return_bottles = data.get("aco_return_bottles", 0)
    lent_bottles = data.get("aco_lent_bottles", 0)
    surcharge = _calc_surcharge(data["aco_items"], products, return_bottles, lent_bottles)
    agent_id = data.get("aco_agent_id")
    agent_self = await api.get_agent_by_telegram(call.from_user.id)
    try:
        result = await api.courier_create_order({
            "phone": data.get("aco_phone", ""),
            "address": data.get("aco_address", ""),
            "items": items_list,
            "payment_method": "cash",
            "return_bottles_count": return_bottles,
            "bottles_lent": lent_bottles,
            "bottle_surcharge": surcharge,
            "latitude": data.get("aco_lat"),
            "longitude": data.get("aco_lng"),
            "creator_role": "agent",
            "creator_name": (agent_self or {}).get("name") or call.from_user.full_name or "",
            "agent_id": agent_id,
        })
        oid = result.get("order_id") or result.get("id", "?")
    except Exception:
        log.exception("aco_confirm failed for agent_id=%s", agent_id)
        await call.message.edit_text("❌ Ошибка при создании заказа. Попробуйте ещё раз.")
        await state.clear()
        await call.answer()
        return

    await state.clear()
    await call.answer()
    try:
        await call.message.delete()
    except Exception:
        await call.message.edit_text("✅")
    await call.message.answer("Панель агента:", reply_markup=agent_webapp_kb())


@router.callback_query(AcoOrderCreate.confirming, F.data == "aco:cancel")
async def aco_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    await call.message.answer("Панель агента:", reply_markup=agent_webapp_kb())
    await call.answer()
