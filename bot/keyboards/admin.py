from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def admin_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Заказы"), KeyboardButton(text="⏳ Новые заказы")],
            [KeyboardButton(text="📊 Статистика"), KeyboardButton(text="🚴 Курьеры")],
            [KeyboardButton(text="👥 Клиенты"), KeyboardButton(text="🏭 Склад")],
            [KeyboardButton(text="📦 Товары"), KeyboardButton(text="💸 Долги")],
            [KeyboardButton(text="🧑‍💼 Менеджеры"), KeyboardButton(text="⚙️ Настройки")],
            [KeyboardButton(text="📣 Рассылка"), KeyboardButton(text="🔄 Роль")],
        ],
        resize_keyboard=True,
    )


def order_confirm_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"admin:confirm:{order_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"admin:reject:{order_id}"),
        ],
        [InlineKeyboardButton(text="🚴 Назначить курьера", callback_data=f"admin:assign:{order_id}")],
        [InlineKeyboardButton(text="💬 Написать клиенту", callback_data=f"admin:contact:{order_id}")],
        [InlineKeyboardButton(text="🌐 Заказ на сайте", url=_site("/admin/orders"))],
    ])


def courier_select_kb(couriers: list, order_id: int) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=c["name"], callback_data=f"admin:set_courier:{order_id}:{c['id']}")]
        for c in couriers
    ]
    buttons.append([InlineKeyboardButton(text="➕ Добавить курьера", callback_data="admin:courier_create")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def stats_period_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="День", callback_data="admin:stats:day"),
            InlineKeyboardButton(text="Неделя", callback_data="admin:stats:week"),
            InlineKeyboardButton(text="Месяц", callback_data="admin:stats:month"),
        ],
        [InlineKeyboardButton(text="🌐 Статистика на сайте", url=_site("/admin/stats"))],
    ])


def admin_user_kb(user_id: int, tg_id: int | None) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text="💰 Пополнить баланс", callback_data=f"admin:topup_manual:{user_id}")]]
    if tg_id:
        rows.append([InlineKeyboardButton(text="✉️ Написать", callback_data=f"admin:msg_user:{tg_id}")])
    rows.append([InlineKeyboardButton(text="🌐 Клиенты на сайте", url=_site("/admin/clients"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_debt_kb(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Одобрить", callback_data=f"admin:debt:approve:{debt_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"admin:debt:reject:{debt_id}"),
        ],
        [InlineKeyboardButton(text="🌐 Курьеры на сайте", url=_site("/admin/couriers"))],
    ])


def broadcast_target_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👥 Все клиенты", callback_data="admin:bc:clients")],
        [InlineKeyboardButton(text="🚴 Курьеры", callback_data="admin:bc:couriers")],
        [InlineKeyboardButton(text="🧑‍💼 Менеджеры", callback_data="admin:bc:managers")],
        [InlineKeyboardButton(text="🌐 Все", callback_data="admin:bc:all")],
    ])


def product_list_kb(products: list) -> InlineKeyboardMarkup:
    rows = []
    for p in products:
        active = "✅" if p.get("is_active", True) else "❌"
        name = p.get("name", "")[:25]
        rows.append([
            InlineKeyboardButton(text=f"{active} {name}", callback_data=f"ap:edit:{p['id']}"),
            InlineKeyboardButton(text="🗑", callback_data=f"ap:del:{p['id']}"),
        ])
    rows.append([InlineKeyboardButton(text="➕ Добавить товар", callback_data="ap:new")])
    rows.append([InlineKeyboardButton(text="🌐 Товары на сайте", url=_site("/admin/products"))])
    rows.append([InlineKeyboardButton(text="← Назад", callback_data="admin:back")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def product_edit_kb(product_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Название", callback_data=f"ape:name:{product_id}")],
        [InlineKeyboardButton(text="📏 Объём", callback_data=f"ape:volume:{product_id}")],
        [InlineKeyboardButton(text="💰 Цена", callback_data=f"ape:price:{product_id}")],
        [InlineKeyboardButton(text="🔄 Активность", callback_data=f"ape:toggle:{product_id}")],
        [InlineKeyboardButton(text="← Назад", callback_data="admin:products")],
    ])


def low_stock_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏭 Открыть склад", callback_data="admin:warehouse")],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/admin/warehouse"))],
    ])
