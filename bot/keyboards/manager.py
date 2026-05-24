from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def manager_menu_kb(subs_enabled: bool = True, support_enabled: bool = True) -> ReplyKeyboardMarkup:
    base = settings.MINI_APP_URL.rstrip("/")
    rows = [
        [
            KeyboardButton(text="📋 Заказы", web_app=WebAppInfo(url=f"{base}/manager")),
            KeyboardButton(text="👥 Клиенты", web_app=WebAppInfo(url=f"{base}/manager/clients")),
        ],
        [
            KeyboardButton(text="🚴 Курьеры", web_app=WebAppInfo(url=f"{base}/manager/couriers")),
            KeyboardButton(text="📊 Статистика", web_app=WebAppInfo(url=f"{base}/manager/stats")),
        ],
    ]
    third = []
    if subs_enabled:
        third.append(KeyboardButton(text="📅 Подписки"))
    if support_enabled:
        third.append(KeyboardButton(text="💬 Поддержка"))
    if third:
        rows.append(third)
    rows.append([KeyboardButton(text="📝 Создать заказ")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


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


def mgr_courier_select_kb(couriers: list, order_id: int, tab: str = "", page: int = 0) -> InlineKeyboardMarkup:
    buttons = []
    for c in couriers:
        phone = (c.get("phone") or "").replace("+998", "").strip()
        label = f"{c['name']}  {phone}" if phone else c["name"]
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"mgr:set_courier:{order_id}:{c['id']}:{tab}:{page}")])
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
        [InlineKeyboardButton(text="📦 Заказы клиента", callback_data=f"mgr:client_orders:{user_id}")],
        [InlineKeyboardButton(text="💳 Транзакции", callback_data=f"mgr:client_tx:{user_id}")],
        [InlineKeyboardButton(text="📋 Подписки", callback_data=f"mgr:client_subs:{user_id}")],
        [InlineKeyboardButton(text="🫙 Бутылки", callback_data=f"mgr:client_bottles:{user_id}")],
    ]
    if tg_id:
        rows.append([InlineKeyboardButton(text="✉️ Написать клиенту", callback_data=f"mgr:msg_client:{tg_id}")])
    rows.append([InlineKeyboardButton(text="🌐 Клиент на сайте", url=_site("/manager/clients"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)




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
