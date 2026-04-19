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


# Users
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


# Products
async def get_products():
    return await _get("/products/")


# Orders
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


async def courier_accept_order(order_id: int):
    return await _patch(f"/orders/{order_id}/courier_accept")


async def payment_confirmed(order_id: int):
    return await _patch(f"/orders/{order_id}/payment_confirmed")


async def confirm_order(order_id: int):
    return await _patch(f"/orders/{order_id}/confirm")


async def reject_order(order_id: int, reason: str = ""):
    return await _patch(f"/orders/{order_id}/reject", {"reason": reason})


async def assign_courier(order_id: int, courier_id: int):
    return await _patch(f"/orders/{order_id}/assign_courier", {"courier_id": courier_id})


async def start_delivery(order_id: int):
    return await _patch(f"/orders/{order_id}/in_delivery")


async def mark_delivered(order_id: int):
    return await _patch(f"/orders/{order_id}/delivered")


async def create_review(user_id: int, order_id: int, rating: int, comment: str = None):
    return await _post("/orders/reviews/", {
        "user_id": user_id, "order_id": order_id, "rating": rating, "comment": comment
    })


# Settings
async def get_settings():
    try:
        return await _get("/admin/settings")
    except Exception:
        return {}


# Client data
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


# Admin
async def get_couriers():
    return await _get("/admin/couriers")


async def get_stats(period: str = "month"):
    return await _get("/admin/stats", {"period": period})


async def get_courier_stats(telegram_id: int):
    try:
        return await _get(f"/couriers/{telegram_id}/stats")
    except Exception:
        return {}


async def topup_user(user_id: int, amount: int):
    return await _post(f"/admin/users/{user_id}/topup", {"amount": amount})


# Support chat
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
