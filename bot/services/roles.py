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
    "agent":     "🤝 Агент",
}

# Priority order for non-admin users (highest wins)
_PRIORITY = ["admin", "warehouse", "manager", "courier", "agent", "client"]

# Runtime-added warehouse IDs (added by admin via bot, survive until restart)
_runtime_warehouse_ids: set[int] = set()

# Secondary admin IDs loaded from DB at startup (admin_users table)
_secondary_admin_ids: set[int] = set()


def add_warehouse_staff(telegram_id: int) -> None:
    _runtime_warehouse_ids.add(telegram_id)


def remove_warehouse_staff(telegram_id: int) -> None:
    _runtime_warehouse_ids.discard(telegram_id)


def get_all_warehouse_ids() -> set[int]:
    return set(settings.WAREHOUSE_IDS) | _runtime_warehouse_ids


def get_all_admin_ids() -> set[int]:
    """All admin IDs: hardcoded (env) + secondary (DB-loaded at startup)."""
    return set(settings.ADMIN_IDS) | _secondary_admin_ids


def add_secondary_admin(telegram_id: int) -> None:
    _secondary_admin_ids.add(telegram_id)


def remove_secondary_admin(telegram_id: int) -> None:
    _secondary_admin_ids.discard(telegram_id)


async def load_secondary_admins() -> None:
    """Load secondary admin IDs from DB into the runtime cache."""
    global _secondary_admin_ids
    try:
        admins = await api.get_secondary_admins()
        _secondary_admin_ids = {int(a["telegram_id"]) for a in admins if a.get("telegram_id")}
    except Exception:
        pass


async def get_user_roles(telegram_id: int) -> list[str]:
    """Return all roles a telegram user holds."""
    roles = ["client"]
    if telegram_id in get_all_admin_ids():
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
    agent = await api.get_agent_by_telegram(telegram_id)
    if agent:
        roles.append("agent")
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
