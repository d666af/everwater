from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def admin_menu_kb(subs_enabled: bool = True) -> ReplyKeyboardMarkup:
    base = settings.MINI_APP_URL.rstrip("/")
    rows = [
        [
            KeyboardButton(text="📄 Заказы", web_app=WebAppInfo(url=f"{base}/admin/orders")),
            KeyboardButton(text="📈 Статистика", web_app=WebAppInfo(url=f"{base}/admin/stats")),
        ],
        [
            KeyboardButton(text="👥 CRM", web_app=WebAppInfo(url=f"{base}/admin/crm")),
            KeyboardButton(text="📦 Продукты", web_app=WebAppInfo(url=f"{base}/admin/products")),
        ],
        [
            KeyboardButton(text="🗄️ Настройки", web_app=WebAppInfo(url=f"{base}/admin/settings")),
            KeyboardButton(text="🧮 Склад", web_app=WebAppInfo(url=f"{base}/admin/warehouse")),
        ],
        [
            KeyboardButton(text="📝 История склада", web_app=WebAppInfo(url=f"{base}/admin/warehouse/history")),
            KeyboardButton(text="📒 Отзывы", web_app=WebAppInfo(url=f"{base}/admin/reviews")),
        ],
        [KeyboardButton(text="📝 Создать заказ")],
    ]
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def order_confirm_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📦 Назначить курьера", callback_data=f"order:assign:{order_id}")],
        [InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"order:reject:{order_id}")],
    ])


def admin_order_reject_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📦 Товар закончился", callback_data=f"order:rj_r:{order_id}:stock")],
        [InlineKeyboardButton(text="📍 Адрес недоступен", callback_data=f"order:rj_r:{order_id}:addr")],
        [InlineKeyboardButton(text="⏰ Время недоступно", callback_data=f"order:rj_r:{order_id}:time")],
        [InlineKeyboardButton(text="✏️ Своя причина", callback_data=f"order:rj_r:{order_id}:custom")],
    ])


def courier_select_kb(couriers: list, order_id: int) -> InlineKeyboardMarkup:
    buttons = []
    for c in couriers:
        phone = (c.get("phone") or "").replace("+998", "").strip()
        label = f"{c['name']}  {phone}" if phone else c["name"]
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"admin:set_courier:{order_id}:{c['id']}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def reassign_courier_select_kb(couriers: list, order_id: int, current_courier_id: int | None = None) -> InlineKeyboardMarkup:
    """Courier picker for the 'Изменить курьера' flow (admin + manager).
    Skips the courier currently assigned to the order."""
    buttons = []
    for c in couriers:
        if current_courier_id and c.get("id") == current_courier_id:
            continue
        phone = (c.get("phone") or "").replace("+998", "").strip()
        label = f"{c['name']}  {phone}" if phone else c["name"]
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"order:reassign_set:{order_id}:{c['id']}")])
    buttons.append([InlineKeyboardButton(text="◀ Отмена", callback_data=f"order:reassign_cancel:{order_id}")])
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
    rows = []
    if tg_id:
        rows.append([InlineKeyboardButton(text="✉️ Написать", callback_data=f"admin:msg_user:{tg_id}")])
    rows.append([InlineKeyboardButton(text="🌐 Клиенты на сайте", url=_site("/admin/clients"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)




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


def product_edit_kb(product_id: int, has_deposit: bool = False, deposit_price: int | None = None) -> InlineKeyboardMarkup:
    deposit_label = "♻️ Залог. цена: ВКЛ ✅" if has_deposit else "♻️ Залог. цена: ВЫКЛ"
    rows = [
        [InlineKeyboardButton(text="✏️ Название", callback_data=f"ape:name:{product_id}")],
        [InlineKeyboardButton(text="📏 Объём", callback_data=f"ape:volume:{product_id}")],
        [InlineKeyboardButton(text="💰 Цена", callback_data=f"ape:price:{product_id}")],
        [InlineKeyboardButton(text="🖼 Фото", callback_data=f"ape:photo:{product_id}")],
        [InlineKeyboardButton(text="🔄 Активность", callback_data=f"ape:toggle:{product_id}")],
        [InlineKeyboardButton(text=deposit_label, callback_data=f"ape:deposit:{product_id}")],
    ]
    if has_deposit:
        dp_label = f"💵 Цена со сдачей: {deposit_price:,} сум".replace(",", " ") if deposit_price else "💵 Цена со сдачей: не задана"
        rows.append([InlineKeyboardButton(text=dp_label, callback_data=f"ape:deposit_price:{product_id}")])
    rows.append([InlineKeyboardButton(text="← Назад", callback_data="admin:products")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def low_stock_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏭 Открыть склад", callback_data="admin:warehouse")],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/admin/warehouse"))],
    ])


def subs_menu_kb(prefix: str, weekly_count: int, monthly_count: int) -> InlineKeyboardMarkup:
    """Summary screen: choose weekly or monthly list."""
    site_path = "/warehouse/subscriptions" if prefix == "wh" else f"/{prefix}/subscriptions"
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text=f"📅 Еженедельные ({weekly_count})",
                callback_data=f"{prefix}:subs:weekly:0",
            ),
            InlineKeyboardButton(
                text=f"🗓 Ежемесячные ({monthly_count})",
                callback_data=f"{prefix}:subs:monthly:0",
            ),
        ],
        [InlineKeyboardButton(text="🌐 На сайте", url=_site(site_path))],
    ])


def subs_list_kb(prefix: str, subs: list, plan: str, page: int, can_create_order: bool = True) -> InlineKeyboardMarkup:
    """Paginated subscription list with Create Order buttons."""
    PAGE_SIZE = 5
    total = len(subs)
    start = page * PAGE_SIZE
    chunk = subs[start:start + PAGE_SIZE]

    rows = []
    for s in chunk:
        sub_id = s["id"]
        client = s.get("client_name", "—")[:18]
        day_label = s.get("day", "?")
        badge = " 🔴" if s.get("overdue") else (" ⚡" if s.get("due_today") else "")
        rows.append([
            InlineKeyboardButton(
                text=f"👤 {client} | {day_label}{badge}",
                callback_data=f"{prefix}:sub_detail:{sub_id}",
            )
        ])
        if can_create_order:
            rows.append([
                InlineKeyboardButton(
                    text="🛒 Создать заказ",
                    callback_data=f"{prefix}:sub_order:{sub_id}",
                )
            ])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="◀️ Назад", callback_data=f"{prefix}:subs:{plan}:{page - 1}"))
    if start + PAGE_SIZE < total:
        nav.append(InlineKeyboardButton(text="▶️ Далее", callback_data=f"{prefix}:subs:{plan}:{page + 1}"))
    if nav:
        rows.append(nav)

    rows.append([InlineKeyboardButton(text="↩️ К подпискам", callback_data=f"{prefix}:subs:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def subs_period_kb(prefix: str = "admin") -> InlineKeyboardMarkup:
    """Legacy keyboard — kept for backward compat with card-payment confirm flow."""
    site_path = "/warehouse" if prefix == "wh" else "/manager" if prefix == "mgr" else "/admin/clients"
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📅 Эта неделя", callback_data=f"{prefix}:subs:week"),
            InlineKeyboardButton(text="🗓 Этот месяц", callback_data=f"{prefix}:subs:month"),
        ],
        [InlineKeyboardButton(text="🌐 На сайте", url=_site(site_path))],
    ])
