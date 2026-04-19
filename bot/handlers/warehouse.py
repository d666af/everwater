from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.warehouse import (
    warehouse_menu_kb, wh_product_select_kb, wh_courier_select_kb, wh_history_filter_kb,
)
from config import settings

router = Router()

TX_RU = {
    "production": "➕ Производство",
    "issue": "📤 Выдача",
    "return": "📥 Возврат",
    "adjustment": "🔧 Корректировка",
}


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


def is_warehouse(user_id: int) -> bool:
    return user_id in settings.WAREHOUSE_IDS or user_id in settings.ADMIN_IDS


# ─── FSM ──────────────────────────────────────────────────────────────────────

class ProductionState(StatesGroup):
    choosing_product = State()
    waiting_quantity = State()
    waiting_note = State()


class IssueState(StatesGroup):
    choosing_courier = State()
    choosing_product = State()
    waiting_quantity = State()


class ReturnState(StatesGroup):
    choosing_courier = State()
    choosing_product = State()
    waiting_quantity = State()


class AdjustState(StatesGroup):
    choosing_product = State()
    waiting_quantity = State()
    waiting_note = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("warehouse"))
async def warehouse_panel(message: Message):
    if not is_warehouse(message.from_user.id):
        return
    await message.answer("🏭 Панель склада:", reply_markup=warehouse_menu_kb())


# ─── Stock overview ───────────────────────────────────────────────────────────

@router.message(F.text == "📦 Остатки")
async def wh_stock(message: Message):
    if not is_warehouse(message.from_user.id):
        return
    stock = await api.get_warehouse_stock()
    if not stock:
        await message.answer("Нет данных по остаткам.")
        return
    lines = ["📦 <b>Остатки на складе:</b>\n"]
    for item in stock:
        qty = item.get("quantity", 0)
        warn = " ⚠️" if qty < 10 else ""
        lines.append(
            f"• {item['product_name']} ({item.get('volume', '')}л) — <b>{qty} шт.</b>{warn}"
        )
    await message.answer("\n".join(lines), parse_mode="HTML")


# ─── Production ───────────────────────────────────────────────────────────────

@router.message(F.text == "➕ Производство")
async def wh_production_start(message: Message, state: FSMContext):
    if not is_warehouse(message.from_user.id):
        return
    stock = await api.get_warehouse_stock()
    if not stock:
        await message.answer("Нет продуктов.")
        return
    await state.update_data(wh_products=stock)
    await state.set_state(ProductionState.choosing_product)
    await message.answer("Выберите продукт для записи производства:",
                         reply_markup=wh_product_select_kb(stock, "prod"))


@router.callback_query(ProductionState.choosing_product, F.data.startswith("wh:prod:"))
async def wh_prod_product(call: CallbackQuery, state: FSMContext):
    product_id = int(call.data.split(":")[2])
    await state.update_data(prod_product_id=product_id)
    await state.set_state(ProductionState.waiting_quantity)
    await call.message.edit_text("Введите количество произведённых бутылок:")
    await call.answer()


@router.message(ProductionState.waiting_quantity)
async def wh_prod_quantity(message: Message, state: FSMContext):
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число.")
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
    products = data.get("wh_products", [])
    prod = next((p for p in products if p["product_id"] == data["prod_product_id"]), {})
    await message.answer(
        f"✅ Производство записано!\n"
        f"Продукт: {prod.get('product_name', data['prod_product_id'])}\n"
        f"Количество: {data['prod_quantity']} шт.\n"
        f"Новый остаток: {result.get('new_stock', '—')} шт."
    )
    # Notify admins about production
    for admin_id in settings.ADMIN_IDS:
        try:
            await message.bot.send_message(
                admin_id,
                f"🏭 Произведено: {prod.get('product_name', '')} — {data['prod_quantity']} шт."
            )
        except Exception:
            pass


# ─── Issue to courier ─────────────────────────────────────────────────────────

@router.message(F.text == "📤 Выдать курьеру")
async def wh_issue_start(message: Message, state: FSMContext):
    if not is_warehouse(message.from_user.id):
        return
    couriers = await api.get_couriers()
    active = [c for c in couriers if c.get("is_active", True)]
    if not active:
        await message.answer("Нет активных курьеров.")
        return
    await state.update_data(wh_couriers=active)
    await state.set_state(IssueState.choosing_courier)
    await message.answer("Выберите курьера:", reply_markup=wh_courier_select_kb(active, "issue"))


@router.callback_query(IssueState.choosing_courier, F.data.startswith("wh:issue:courier:"))
async def wh_issue_courier(call: CallbackQuery, state: FSMContext):
    courier_id = int(call.data.split(":")[3])
    await state.update_data(issue_courier_id=courier_id)
    stock = await api.get_warehouse_stock()
    await state.update_data(wh_products=stock)
    await state.set_state(IssueState.choosing_product)
    await call.message.edit_text("Выберите продукт для выдачи:",
                                  reply_markup=wh_product_select_kb(stock, "issue_p"))
    await call.answer()


@router.callback_query(IssueState.choosing_product, F.data.startswith("wh:issue_p:"))
async def wh_issue_product(call: CallbackQuery, state: FSMContext):
    product_id = int(call.data.split(":")[2])
    await state.update_data(issue_product_id=product_id)
    await state.set_state(IssueState.waiting_quantity)
    await call.message.edit_text("Введите количество бутылок для выдачи:")
    await call.answer()


@router.message(IssueState.waiting_quantity)
async def wh_issue_quantity(message: Message, state: FSMContext):
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число.")
        return
    qty = int(text)
    data = await state.get_data()
    await state.clear()
    result = await api.warehouse_issue(data["issue_courier_id"], data["issue_product_id"], qty)
    couriers = data.get("wh_couriers", [])
    products = data.get("wh_products", [])
    courier = next((c for c in couriers if c["id"] == data["issue_courier_id"]), {})
    product = next((p for p in products if p["product_id"] == data["issue_product_id"]), {})
    await message.answer(
        f"✅ Выдано!\nКурьер: {courier.get('name', data['issue_courier_id'])}\n"
        f"Продукт: {product.get('product_name', data['issue_product_id'])}\n"
        f"Количество: {qty} шт."
    )
    if courier.get("telegram_id"):
        try:
            await message.bot.send_message(
                courier["telegram_id"],
                f"📦 Вам выдано со склада: {product.get('product_name', '')} — {qty} шт."
            )
        except Exception:
            pass


# ─── Return from courier ──────────────────────────────────────────────────────

@router.message(F.text == "📥 Принять возврат")
async def wh_return_start(message: Message, state: FSMContext):
    if not is_warehouse(message.from_user.id):
        return
    couriers = await api.get_couriers()
    active = [c for c in couriers if c.get("is_active", True)]
    if not active:
        await message.answer("Нет активных курьеров.")
        return
    await state.update_data(wh_couriers=active)
    await state.set_state(ReturnState.choosing_courier)
    await message.answer("Выберите курьера:", reply_markup=wh_courier_select_kb(active, "ret"))


@router.callback_query(ReturnState.choosing_courier, F.data.startswith("wh:ret:courier:"))
async def wh_return_courier(call: CallbackQuery, state: FSMContext):
    courier_id = int(call.data.split(":")[3])
    await state.update_data(ret_courier_id=courier_id)
    stock = await api.get_warehouse_stock()
    await state.update_data(wh_products=stock)
    await state.set_state(ReturnState.choosing_product)
    await call.message.edit_text("Выберите продукт для возврата:",
                                  reply_markup=wh_product_select_kb(stock, "ret_p"))
    await call.answer()


@router.callback_query(ReturnState.choosing_product, F.data.startswith("wh:ret_p:"))
async def wh_return_product(call: CallbackQuery, state: FSMContext):
    product_id = int(call.data.split(":")[2])
    await state.update_data(ret_product_id=product_id)
    await state.set_state(ReturnState.waiting_quantity)
    await call.message.edit_text("Введите количество возвращаемых бутылок:")
    await call.answer()


@router.message(ReturnState.waiting_quantity)
async def wh_return_quantity(message: Message, state: FSMContext):
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число.")
        return
    qty = int(text)
    data = await state.get_data()
    await state.clear()
    await api.warehouse_return(data["ret_courier_id"], data["ret_product_id"], qty)
    couriers = data.get("wh_couriers", [])
    products = data.get("wh_products", [])
    courier = next((c for c in couriers if c["id"] == data["ret_courier_id"]), {})
    product = next((p for p in products if p["product_id"] == data["ret_product_id"]), {})
    await message.answer(
        f"✅ Возврат принят!\nКурьер: {courier.get('name', data['ret_courier_id'])}\n"
        f"Продукт: {product.get('product_name', data['ret_product_id'])}\n"
        f"Количество: {qty} шт."
    )


# ─── Courier water overview ───────────────────────────────────────────────────

@router.message(F.text == "🚴 Склад курьеров")
async def wh_couriers_water(message: Message):
    if not is_warehouse(message.from_user.id):
        return
    data = await api.get_warehouse_couriers()
    if not data:
        await message.answer("Нет данных по курьерам.")
        return
    lines = ["🚴 <b>Вода у курьеров:</b>\n"]
    for c in data:
        courier_name = c.get("name", f"ID {c.get('courier_id')}")
        water = c.get("water", [])
        active_orders = c.get("active_orders", 0)
        if water:
            items = ", ".join(f"{w.get('product_name', w.get('product_id'))}: {w['quantity']} шт." for w in water)
            lines.append(f"• <b>{courier_name}</b>: {items} | Активных заказов: {active_orders}")
        else:
            lines.append(f"• <b>{courier_name}</b>: нет воды | Активных заказов: {active_orders}")
    await message.answer("\n".join(lines), parse_mode="HTML")


# ─── History ──────────────────────────────────────────────────────────────────

@router.message(F.text == "📜 История")
async def wh_history_menu(message: Message):
    if not is_warehouse(message.from_user.id):
        return
    await message.answer("Выберите тип операции:", reply_markup=wh_history_filter_kb())


@router.callback_query(F.data.startswith("wh:hist:"))
async def wh_history(call: CallbackQuery):
    tx_type_raw = call.data.split(":")[2]
    tx_type = None if tx_type_raw == "all" else tx_type_raw
    history = await api.get_warehouse_history(limit=20, tx_type=tx_type)
    if not history:
        await call.message.edit_text("История операций пуста.")
        await call.answer()
        return
    lines = ["📜 <b>История операций:</b>\n"]
    for tx in history[:20]:
        kind = TX_RU.get(tx.get("type", ""), tx.get("type", ""))
        name = tx.get("product_name", f"ID {tx.get('product_id')}")
        qty = tx.get("quantity", 0)
        note = f" — {tx['note']}" if tx.get("note") else ""
        dt = tx.get("created_at", "")[:10]
        lines.append(f"• {dt} {kind}: {name} {qty} шт.{note}")
    await call.message.edit_text("\n".join(lines), parse_mode="HTML")
    await call.answer()
