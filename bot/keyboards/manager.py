from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def manager_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📋 Заказы", callback_data="mgr:orders"),
            InlineKeyboardButton(text="⏳ Новые заказы", callback_data="mgr:new_orders"),
        ],
        [
            InlineKeyboardButton(text="👥 Клиенты", callback_data="mgr:clients"),
            InlineKeyboardButton(text="📊 Статистика", callback_data="mgr:stats_menu"),
        ],
        [
            InlineKeyboardButton(text="💸 Долги курьеров", callback_data="mgr:debts"),
            InlineKeyboardButton(text="💬 Чат поддержки", callback_data="mgr:support"),
        ],
        [InlineKeyboardButton(text="🌐 Открыть на сайте", url=_site("/manager"))],
    ])


def mgr_order_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"mgr:confirm:{order_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"mgr:reject:{order_id}"),
        ],
        [InlineKeyboardButton(text="🚴 Назначить курьера", callback_data=f"mgr:assign:{order_id}")],
        [InlineKeyboardButton(text="🌐 Заказы на сайте", url=_site("/manager"))],
    ])


def mgr_order_reject_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📦 Товар закончился", callback_data=f"mgr:rj_r:{order_id}:stock")],
        [InlineKeyboardButton(text="📍 Адрес недоступен", callback_data=f"mgr:rj_r:{order_id}:addr")],
        [InlineKeyboardButton(text="⏰ Время недоступно", callback_data=f"mgr:rj_r:{order_id}:time")],
        [InlineKeyboardButton(text="✏️ Своя причина", callback_data=f"mgr:rj_r:{order_id}:custom")],
    ])


def mgr_courier_select_kb(couriers: list, order_id: int) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=c["name"], callback_data=f"mgr:set_courier:{order_id}:{c['id']}")]
        for c in couriers
    ]
    buttons.append([InlineKeyboardButton(text="🌐 Курьеры на сайте", url=_site("/manager/couriers"))])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def mgr_stats_period_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="День", callback_data="mgr:stats:day"),
            InlineKeyboardButton(text="Неделя", callback_data="mgr:stats:week"),
            InlineKeyboardButton(text="Месяц", callback_data="mgr:stats:month"),
        ],
        [InlineKeyboardButton(text="🌐 Статистика на сайте", url=_site("/manager/stats"))],
    ])


def mgr_client_kb(user_id: int, tg_id: int | None) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="💰 Пополнить баланс", callback_data=f"mgr:topup:{user_id}")],
        [InlineKeyboardButton(text="📦 Заказы клиента", callback_data=f"mgr:client_orders:{user_id}")],
        [InlineKeyboardButton(text="💳 Транзакции", callback_data=f"mgr:client_tx:{user_id}")],
        [InlineKeyboardButton(text="📋 Подписки", callback_data=f"mgr:client_subs:{user_id}")],
        [InlineKeyboardButton(text="🫙 Бутылки", callback_data=f"mgr:client_bottles:{user_id}")],
    ]
    if tg_id:
        rows.append([InlineKeyboardButton(text="✉️ Написать клиенту", callback_data=f"mgr:msg_client:{tg_id}")])
    rows.append([InlineKeyboardButton(text="🌐 Клиент на сайте", url=_site("/manager/clients"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def mgr_topup_presets_kb(user_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="5 000", callback_data=f"mgr:tp_p:{user_id}:5000"),
            InlineKeyboardButton(text="10 000", callback_data=f"mgr:tp_p:{user_id}:10000"),
        ],
        [
            InlineKeyboardButton(text="25 000", callback_data=f"mgr:tp_p:{user_id}:25000"),
            InlineKeyboardButton(text="50 000", callback_data=f"mgr:tp_p:{user_id}:50000"),
        ],
        [InlineKeyboardButton(text="✏️ Другая сумма", callback_data=f"mgr:topup:{user_id}")],
    ])


def mgr_debt_kb(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Одобрить", callback_data=f"mgr:debt:approve:{debt_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"mgr:debt:reject:{debt_id}"),
        ],
        [InlineKeyboardButton(text="🌐 Курьеры на сайте", url=_site("/manager/couriers"))],
    ])


def mgr_support_chat_kb(chat_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Ответить", callback_data=f"mgr:sup_reply:{chat_id}")],
        [InlineKeyboardButton(text="🌐 Поддержка на сайте", url=_site("/manager/support"))],
    ])


def mgr_support_quick_kb(chat_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Заказ обрабатывается", callback_data=f"mgr:sup_q:{chat_id}:1")],
        [InlineKeyboardButton(text="🚴 Курьер уже в пути", callback_data=f"mgr:sup_q:{chat_id}:2")],
        [InlineKeyboardButton(text="📞 Ожидайте звонка", callback_data=f"mgr:sup_q:{chat_id}:3")],
        [InlineKeyboardButton(text="🙏 Спасибо за обращение!", callback_data=f"mgr:sup_q:{chat_id}:4")],
        [InlineKeyboardButton(text="✏️ Своё сообщение", callback_data=f"mgr:sup_reply:{chat_id}")],
    ])
