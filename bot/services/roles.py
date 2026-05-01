"""
Role detection. Only admins can switch between flows.
Non-admin users are locked to their single primary role.
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

# Priority order for non-admin users (highest wins)
_PRIORITY = ["admin", "warehouse", "manager", "courier", "client"]

# Runtime-added warehouse IDs (added by admin via bot, survive until restart)
_runtime_warehouse_ids: set[int] = set()


def add_warehouse_staff(telegram_id: int) -> None:
    _runtime_warehouse_ids.add(telegram_id)


def remove_warehouse_staff(telegram_id: int) -> None:
    _runtime_warehouse_ids.discard(telegram_id)


def get_all_warehouse_ids() -> set[int]:
    return set(settings.WAREHOUSE_IDS) | _runtime_warehouse_ids


async def get_user_roles(telegram_id: int) -> list[str]:
    """Return all roles a telegram user holds."""
    roles = ["client"]
    if telegram_id in settings.ADMIN_IDS:
        roles.append("admin")
    is_wh = telegram_id in get_all_warehouse_ids()
    if not is_wh:
        try:
            staff = await api.get_warehouse_staff_db()
            is_wh = any(s.get("telegram_id") == telegram_id for s in staff)
        except Exception:
            pass
    if is_wh:
        roles.append("warehouse")
    mgr = await api.get_manager_by_telegram(telegram_id)
    if mgr:
        roles.append("manager")
    courier = await api.get_courier_by_telegram(telegram_id)
    if courier:
        roles.append("courier")
    return roles


async def get_primary_role(telegram_id: int) -> str:
    """
    Return the single active role for this user.
    Admin is the only role that can manually switch — everyone else
    is locked to their highest-priority non-client role.
    """
    roles = await get_user_roles(telegram_id)
    for r in _PRIORITY:
        if r in roles:
            return r
    return "client"
