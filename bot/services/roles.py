"""
Role detection for multi-role users.

Every /start user is a "client" by default.
A single telegram_id can hold multiple roles simultaneously.
"""
import services.api_client as api
from config import settings

ROLE_LABELS = {
    "client":    "👤 Клиент",
    "courier":   "🚴 Курьер",
    "manager":   "🧑‍💼 Менеджер",
    "admin":     "🔧 Администратор",
    "warehouse": "🏭 Склад",
}


async def get_user_roles(telegram_id: int) -> list[str]:
    """Return all roles a telegram user holds, always starting with 'client'."""
    roles = ["client"]

    if telegram_id in settings.ADMIN_IDS:
        roles.append("admin")

    if telegram_id in settings.WAREHOUSE_IDS:
        roles.append("warehouse")

    mgr = await api.get_manager_by_telegram(telegram_id)
    if mgr:
        roles.append("manager")

    courier = await api.get_courier_by_telegram(telegram_id)
    if courier:
        roles.append("courier")

    return roles
