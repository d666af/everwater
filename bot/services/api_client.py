import aiohttp
from config import settings

BASE = settings.API_BASE_URL


async def _get(path: str, params: dict = None):
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{BASE}{path}", params=params) as r:
            r.raise_for_status()
            return await r.json()


async def _post(path: str, data: dict = None):
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{BASE}{path}", json=data) as r:
            r.raise_for_status()
            return await r.json()


async def _patch(path: str, data: dict = None, params: dict = None):
    async with aiohttp.ClientSession() as s:
        async with s.patch(f"{BASE}{path}", json=data, params=params) as r:
            r.raise_for_status()
            return await r.json()


async def _delete(path: str):
    async with aiohttp.ClientSession() as s:
        async with s.delete(f"{BASE}{path}") as r:
            r.raise_for_status()
            return await r.json()


# ─── Users ────────────────────────────────────────────────────────────────────

async def create_or_get_user(telegram_id: int, name: str = None, phone: str = None):
    return await _post("/users/", {"telegram_id": telegram_id, "name": name, "phone": phone})


async def get_user(telegram_id: int):
    try:
        return await _get(f"/users/by_telegram/{telegram_id}")
    except Exception:
        return None


async def update_user(telegram_id: int, **kwargs):
    return await _patch(f"/users/{telegram_id}", kwargs)


async def get_users_to_remind():
    try:
        return await _get("/users/unregistered/remind")
    except Exception:
        return []


async def get_all_users():
    try:
        return await _get("/admin/users")
    except Exception:
        return []


async def get_user_details(user_id: int):
    try:
        return await _get(f"/admin/users/{user_id}/details")
    except Exception:
        return None


# ─── Products ─────────────────────────────────────────────────────────────────

async def get_products():
    return await _get("/products/")


async def create_product(data: dict):
    return await _post("/products/", data)


async def update_product(product_id: int, data: dict):
    return await _patch(f"/products/{product_id}", data)


async def delete_product(product_id: int):
    return await _delete(f"/products/{product_id}")


# ─── Orders ───────────────────────────────────────────────────────────────────

async def create_order(data: dict):
    return await _post("/orders/", data)


async def get_user_orders(user_id: int):
    return await _get(f"/orders/user/{user_id}")


async def get_order(order_id: int):
    return await _get(f"/orders/{order_id}")


async def get_all_orders(status: str = None):
    params = {"status": status} if status else None
    return await _get("/orders/", params)


async def get_courier_orders(telegram_id: int):
    try:
        return await _get(f"/orders/courier/{telegram_id}")
    except Exception:
        return []


async def confirm_order(order_id: int, from_bot: bool = True):
    return await _patch(f"/orders/{order_id}/confirm", params={"from_bot": str(from_bot).lower()})


async def reject_order(order_id: int, reason: str = "", from_bot: bool = True):
    return await _patch(f"/orders/{order_id}/reject", {"reason": reason},
                        params={"from_bot": str(from_bot).lower()})


async def assign_courier(order_id: int, courier_id: int, from_bot: bool = True):
    return await _patch(f"/orders/{order_id}/assign_courier", {"courier_id": courier_id},
                        params={"from_bot": str(from_bot).lower()})


async def courier_accept_order(order_id: int):
    return await _patch(f"/orders/{order_id}/courier_accept")


async def start_delivery(order_id: int, from_bot: bool = True):
    return await _patch(f"/orders/{order_id}/in_delivery",
                        params={"from_bot": str(from_bot).lower()})


async def mark_delivered(order_id: int, from_bot: bool = True):
    return await _patch(f"/orders/{order_id}/delivered",
                        params={"from_bot": str(from_bot).lower()})


async def payment_confirmed(order_id: int):
    return await _patch(f"/orders/{order_id}/payment_confirmed")


async def create_review(user_id: int, order_id: int, rating: int, comment: str = None):
    return await _post("/orders/reviews/", {
        "user_id": user_id, "order_id": order_id, "rating": rating, "comment": comment
    })


# ─── Settings ─────────────────────────────────────────────────────────────────

async def get_settings():
    try:
        return await _get("/admin/settings")
    except Exception:
        return {}


async def update_settings(data: dict):
    return await _patch("/admin/settings", data)


# ─── Client data ──────────────────────────────────────────────────────────────

async def get_addresses(user_id: int):
    try:
        return await _get(f"/client/{user_id}/addresses")
    except Exception:
        return []


async def save_address(user_id: int, data: dict):
    return await _post(f"/client/{user_id}/addresses", data)


async def get_subscriptions(user_id: int):
    try:
        return await _get(f"/client/{user_id}/subscriptions")
    except Exception:
        return []


async def create_subscription(user_id: int, data: dict):
    return await _post(f"/client/{user_id}/subscriptions", data)


async def cancel_subscription(user_id: int, sub_id: int):
    return await _delete(f"/client/{user_id}/subscriptions/{sub_id}")


async def get_bottles_owed(user_id: int):
    try:
        return await _get(f"/client/{user_id}/bottles_owed")
    except Exception:
        return {"count": 0}


async def change_bottles_owed(user_id: int, delta: int):
    return await _post(f"/client/{user_id}/bottles_owed", {"delta": delta})


# ─── Admin ────────────────────────────────────────────────────────────────────

async def get_couriers():
    return await _get("/admin/couriers")


async def get_courier_by_telegram(telegram_id: int):
    try:
        return await _get(f"/admin/couriers/by_telegram/{telegram_id}")
    except Exception:
        return None


async def create_courier_api(telegram_id: int, name: str, phone: str = ""):
    return await _post("/admin/couriers", {"telegram_id": telegram_id, "name": name, "phone": phone})


async def deactivate_courier(courier_id: int):
    return await _delete(f"/admin/couriers/{courier_id}")


async def get_managers():
    try:
        return await _get("/admin/managers")
    except Exception:
        return []


async def get_manager_by_telegram(telegram_id: int):
    try:
        return await _get(f"/admin/managers/by_telegram/{telegram_id}")
    except Exception:
        return None


async def create_manager_api(telegram_id: int, name: str, phone: str = ""):
    return await _post("/admin/managers", {"telegram_id": telegram_id, "name": name, "phone": phone})


async def deactivate_manager(manager_id: int):
    return await _delete(f"/admin/managers/{manager_id}")


async def get_stats(period: str = "month"):
    return await _get("/admin/stats", {"period": period})


async def topup_user(user_id: int, amount: int):
    return await _post(f"/admin/users/{user_id}/topup", {"amount": amount})


async def broadcast(message: str, target: str = "all"):
    return await _post("/admin/broadcast", {"message": message, "target": target})


# ─── Courier-specific ─────────────────────────────────────────────────────────

async def get_courier_stats(telegram_id: int):
    try:
        return await _get(f"/couriers/{telegram_id}/stats")
    except Exception:
        return {}


async def get_courier_reviews(telegram_id: int):
    try:
        return await _get(f"/couriers/{telegram_id}/reviews")
    except Exception:
        return []


async def get_courier_water(courier_id: int):
    try:
        return await _get(f"/couriers/{courier_id}/water")
    except Exception:
        return []


async def get_courier_cash_debts(courier_id: int):
    try:
        return await _get(f"/couriers/{courier_id}/cash_debts")
    except Exception:
        return {"total_pending": 0, "debts": []}


async def request_cash_clearance(debt_id: int, note: str = None):
    return await _post(f"/couriers/cash_debts/{debt_id}/request_clearance", {"note": note})


async def get_cash_debts_admin(status: str = None):
    try:
        params = {"status": status} if status else None
        return await _get("/couriers/admin/cash_debts", params)
    except Exception:
        return []


async def decide_cash_debt(debt_id: int, action: str, note: str = None):
    return await _post(f"/couriers/admin/cash_debts/{debt_id}/decide", {"action": action, "note": note})


async def courier_create_order(data: dict):
    return await _post("/couriers/orders", data)


# ─── Warehouse ────────────────────────────────────────────────────────────────

async def get_warehouse_stock():
    try:
        return await _get("/warehouse/stock")
    except Exception:
        return []


async def get_warehouse_overview(period: str = "day"):
    try:
        return await _get("/warehouse/overview", {"period": period})
    except Exception:
        return {}


async def warehouse_production(product_id: int, quantity: int, note: str = None):
    return await _post("/warehouse/production", {"product_id": product_id, "quantity": quantity, "note": note})


async def warehouse_issue(courier_id: int, product_id: int, quantity: int):
    return await _post("/warehouse/issue", {"courier_id": courier_id, "product_id": product_id, "quantity": quantity})


async def warehouse_return(courier_id: int, product_id: int, quantity: int):
    return await _post("/warehouse/return", {"courier_id": courier_id, "product_id": product_id, "quantity": quantity})


async def warehouse_adjust(product_id: int, quantity: int, note: str = None):
    return await _post("/warehouse/stock/adjust", {"product_id": product_id, "quantity": quantity, "note": note})


async def get_warehouse_couriers():
    try:
        return await _get("/warehouse/couriers")
    except Exception:
        return []


async def get_warehouse_history(limit: int = 30, tx_type: str = None, courier_id: int = None):
    try:
        params = {"limit": limit}
        if tx_type:
            params["tx_type"] = tx_type
        if courier_id:
            params["courier_id"] = courier_id
        return await _get("/warehouse/history", params)
    except Exception:
        return []


# ─── Support chat ──────────────────────────────────────────────────────────────

async def send_user_support_message(telegram_id: int, user_name: str, text: str):
    return await _post("/admin/support/user_message", {
        "telegram_id": telegram_id, "user_name": user_name, "text": text
    })


async def get_undelivered_support_messages():
    try:
        return await _get("/admin/support/undelivered")
    except Exception:
        return []


async def mark_support_message_delivered(msg_id: int):
    try:
        return await _patch(f"/admin/support/messages/{msg_id}/delivered")
    except Exception:
        return {}
