from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.warehouse import (
    warehouse_menu_kb, wh_prod_product_kb, wh_courier_select_kb,
    wh_ir_catalog_kb, wh_report_period_kb,
    wh_history_filter_kb, wh_period_kb, wh_stock_actions_kb, wh_low_stock_kb,
)
from keyboards.admin import subs_menu_kb, subs_list_kb
from handlers.admin import _subs_summary_text, _sub_card_text
from config import settings

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
    return user_id in get_all_warehouse_ids() or user_id in settings.ADMIN_IDS


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


class IssueReturnState(StatesGroup):
    choosing_courier = State()
    choosing_item = State()
    entering_qty = State()
    entering_return = State()


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
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число (больше 0).")
        return
    await state.update_data(prod_quantity=int(text))
    await state.set_state(ProductionState.waiting_note)
    await message.answer("Добавьте заметку (или отправьте «-» чтобы пропустить):")


@router.message(ProductionState.waiting_note)
async def wh_prod_note(message: Message, state: FSMContext):
    note = None if message.text.strip() == "-" else message.text.strip()
    data = await state.get_data()
    await state.clear()
    result = await api.warehouse_production(data["prod_product_id"], data["prod_quantity"], note)
    prod_name = data.get("prod_product_name", str(data["prod_product_id"]))
    await message.answer(
        f"✅ Производство записано!\n"
        f"Продукт: {prod_name}\n"
        f"Количество: {data['prod_quantity']} шт.\n"
        f"Новый остаток: {result.get('new_quantity', '—')} шт."
    )
    for admin_id in settings.ADMIN_IDS:
        try:
            await message.bot.send_message(
                admin_id,
                f"🏭 Произведено: {prod_name} — {data['prod_quantity']} шт."
            )
        except Exception:
            pass


# ─── Issue / Return (combined) ────────────────────────────────────────────────

async def _show_ir_catalog(message: Message, state: FSMContext, edit: bool = False):
    data = await state.get_data()
    catalog = data.get("ir_catalog", [])
    cart = data.get("ir_cart", {})
    return_qty = data.get("ir_return_qty", 0)
    courier_name = data.get("ir_courier_name", "")

    lines = [f"🔄 <b>Выдать/Возврат · {courier_name}</b>\n"]
    cart_items = [(v["name"], v["qty"]) for v in cart.values() if v["qty"] > 0]
    if cart_items:
        lines.append("📦 <b>Выдача:</b>")
        for name, qty in cart_items:
            lines.append(f"  • {name} — {qty} шт.")
    if return_qty > 0:
        lines.append(f"↩ <b>Возврат бутылок:</b> {return_qty} шт.")
    if not cart_items and return_qty == 0:
        lines.append("Выберите продукт или укажите возврат бутылок")

    text = "\n".join(lines)
    kb = wh_ir_catalog_kb(catalog, cart, return_qty)
    if edit:
        try:
            await message.edit_text(text, parse_mode="HTML", reply_markup=kb)
            return
        except Exception:
            pass
    await message.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(F.text == "🔄 Выдать/Возврат")
async def wh_ir_start(message: Message, state: FSMContext):
    if not await is_warehouse(message.from_user.id):
        return
    couriers = await api.get_couriers()
    active = [c for c in couriers if c.get("is_active", True)]
    if not active:
        await message.answer("Нет активных курьеров.")
        return
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    operator = await _operator_name(message.from_user.id)
    await state.update_data(ir_couriers=active, ir_catalog=catalog, ir_cart={}, ir_return_qty=0, ir_operator=operator)
    await state.set_state(IssueReturnState.choosing_courier)
    await message.answer("Выберите курьера:", reply_markup=wh_courier_select_kb(active, "ir"))


@router.callback_query(IssueReturnState.choosing_courier, F.data.startswith("wh:ir:courier:"))
async def wh_ir_courier(call: CallbackQuery, state: FSMContext):
    courier_id = int(call.data.split(":")[3])
    data = await state.get_data()
    courier = next((c for c in data.get("ir_couriers", []) if c["id"] == courier_id), {})
    await state.update_data(ir_courier_id=courier_id, ir_courier_name=courier.get("name", ""))
    await state.set_state(IssueReturnState.choosing_item)
    await _show_ir_catalog(call.message, state, edit=True)
    await call.answer()


@router.callback_query(IssueReturnState.choosing_item, F.data.startswith("wh:ir:p:"))
async def wh_ir_pick_product(call: CallbackQuery, state: FSMContext):
    product_id = int(call.data.split(":")[3])
    data = await state.get_data()
    prod = next((p for p in data.get("ir_catalog", []) if p.get("id") == product_id), {})
    current_qty = data.get("ir_cart", {}).get(str(product_id), {}).get("qty", 0)
    await state.update_data(ir_current_product_id=product_id, ir_current_product_name=prod.get("name", ""))
    await state.set_state(IssueReturnState.entering_qty)
    await call.message.edit_text(
        f"<b>{prod.get('name', '')}</b>\n"
        f"Сейчас: {current_qty} шт.\n"
        f"Введите количество (0 — убрать из выдачи):",
        parse_mode="HTML"
    )
    await call.answer()


@router.message(IssueReturnState.entering_qty)
async def wh_ir_enter_qty(message: Message, state: FSMContext):
    text = message.text.strip()
    try:
        qty = int(text)
        if qty < 0:
            raise ValueError
    except ValueError:
        await message.answer("Введите целое неотрицательное число.")
        return
    data = await state.get_data()
    product_id = data.get("ir_current_product_id")
    product_name = data.get("ir_current_product_name", "")
    cart = dict(data.get("ir_cart", {}))
    key = str(product_id)
    if qty == 0:
        cart.pop(key, None)
    else:
        cart[key] = {"name": product_name, "qty": qty}
    await state.update_data(ir_cart=cart)
    await state.set_state(IssueReturnState.choosing_item)
    await _show_ir_catalog(message, state, edit=False)


@router.callback_query(IssueReturnState.choosing_item, F.data == "wh:ir:ret")
async def wh_ir_pick_return(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    current = data.get("ir_return_qty", 0)
    await state.set_state(IssueReturnState.entering_return)
    await call.message.edit_text(
        f"↩ <b>Возврат бутылок 19л</b>\n"
        f"Сейчас: {current} шт.\n"
        f"Введите количество (0 — не возвращать):",
        parse_mode="HTML"
    )
    await call.answer()


@router.message(IssueReturnState.entering_return)
async def wh_ir_enter_return(message: Message, state: FSMContext):
    text = message.text.strip()
    try:
        qty = max(0, int(text))
    except ValueError:
        await message.answer("Введите целое число.")
        return
    await state.update_data(ir_return_qty=qty)
    await state.set_state(IssueReturnState.choosing_item)
    await _show_ir_catalog(message, state, edit=False)


@router.callback_query(IssueReturnState.choosing_item, F.data == "wh:ir:submit")
async def wh_ir_submit(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    courier_id = data.get("ir_courier_id")
    courier_name = data.get("ir_courier_name", "")
    cart = data.get("ir_cart", {})
    return_qty = data.get("ir_return_qty", 0)
    operator = data.get("ir_operator", "")
    catalog = data.get("ir_catalog", [])

    # Build items; use effective_price (post-discount) for the total
    price_map = {str(p["id"]): float(p.get("effective_price") or p.get("price") or 0) for p in catalog}
    items = [
        {"product_id": int(k), "product_name": v["name"], "quantity": v["qty"]}
        for k, v in cart.items() if v["qty"] > 0
    ]
    total_sum = sum(v["qty"] * price_map.get(k, 0) for k, v in cart.items() if v["qty"] > 0)

    from datetime import datetime, timezone, timedelta
    now_str = datetime.now(tz=timezone(timedelta(hours=5))).strftime("%d.%m.%Y %H:%M")

    await state.clear()
    try:
        await api.issue_batch(courier_id, items, return_qty, performed_by=operator)

        # Confirmation to operator
        lines = [f"✅ <b>Выдача записана</b>\nКурьер: {courier_name}"]
        if items:
            lines.append("\n📦 Выдано:")
            for it in items:
                lines.append(f"  • {it['product_name']} — {it['quantity']} шт.")
        if return_qty > 0:
            lines.append(f"\n↩ Возврат бутылок: {return_qty} шт.")
        if total_sum > 0:
            lines.append(f"💰 Итого: {int(total_sum):,} сум".replace(",", " "))
        await call.message.edit_text("\n".join(lines), parse_mode="HTML")

        # Notify courier — formatted as shown in design
        couriers_list = data.get("ir_couriers", [])
        courier = next((c for c in couriers_list if c["id"] == courier_id), {})
        if courier.get("telegram_id") and (items or return_qty > 0):
            n = ["📦 <b>Накладная со склада</b>", ""]
            if items:
                n.append("Получено:")
                for it in items:
                    n.append(f"  • {it['product_name']} — {it['quantity']} шт.")
            n.append("")
            if total_sum > 0:
                n.append(f"Итого: {int(total_sum):,} сум".replace(",", " "))
            if return_qty > 0:
                n.append(f"↩ Возврат бутылок: {return_qty} шт.")
            n.extend(["", f"Время: {now_str}"])
            try:
                await call.bot.send_message(courier["telegram_id"], "\n".join(n), parse_mode="HTML")
            except Exception:
                pass
    except Exception as e:
        await call.message.edit_text(f"❌ Ошибка при выдаче: {e}")
    await call.answer()


@router.callback_query(IssueReturnState.choosing_item, F.data == "wh:ir:cancel")
async def wh_ir_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("❌ Операция отменена.")
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
    if not await is_warehouse(call.from_user.id):
        return
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    await state.update_data(wh_products=catalog)
    await state.set_state(ProductionState.choosing_product)
    await call.message.answer("Выберите продукт для записи производства:",
                               reply_markup=wh_prod_product_kb(catalog))
    await call.answer()


@router.callback_query(F.data == "wh:quick:ir")
async def wh_quick_ir(call: CallbackQuery, state: FSMContext):
    if not await is_warehouse(call.from_user.id):
        return
    couriers = await api.get_couriers()
    active = [c for c in couriers if c.get("is_active", True)]
    products = await api.get_products()
    catalog = [p for p in (products or []) if p.get("is_active", True)]
    operator = await _operator_name(call.from_user.id)
    await state.update_data(ir_couriers=active, ir_catalog=catalog, ir_cart={}, ir_return_qty=0, ir_operator=operator)
    await state.set_state(IssueReturnState.choosing_courier)
    await call.message.answer("Выберите курьера:", reply_markup=wh_courier_select_kb(active, "ir"))
    await call.answer()


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
        await message_or_call.answer()
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
    if not await is_warehouse(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    await _wh_subs_menu(call, is_call=True)


@router.callback_query(F.data.startswith("wh:subs:weekly:") | F.data.startswith("wh:subs:monthly:"))
async def wh_subs_list(call: CallbackQuery):
    if not await is_warehouse(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
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
    await call.answer()
