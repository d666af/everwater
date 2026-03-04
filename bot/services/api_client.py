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
async def get_user_orders(user_id: int):
    return await _get(f"/orders/user/{user_id}")


async def get_order(order_id: int):
    return await _get(f"/orders/{order_id}")


async def get_all_orders(status: str = None):
    params = {"status": status} if status else None
    return await _get("/orders/", params)


async def payment_confirmed(order_id: int):
    return await _patch(f"/orders/{order_id}/payment_confirmed")


async def confirm_order(order_id: int):
    return await _patch(f"/orders/{order_id}/confirm")


async def reject_order(order_id: int, reason: str = ""):
    return await _patch(f"/orders/{order_id}/reject", params={"reason": reason})


async def assign_courier(order_id: int, courier_id: int):
    return await _patch(f"/orders/{order_id}/assign_courier", params={"courier_id": courier_id})


async def start_delivery(order_id: int):
    return await _patch(f"/orders/{order_id}/in_delivery")


async def mark_delivered(order_id: int):
    return await _patch(f"/orders/{order_id}/delivered")


async def create_review(user_id: int, order_id: int, rating: int, comment: str = None):
    return await _post("/orders/reviews/", {
        "user_id": user_id, "order_id": order_id, "rating": rating, "comment": comment
    })


# Admin
async def get_couriers():
    return await _get("/admin/couriers")


async def get_stats(period: str = "month"):
    return await _get("/admin/stats", {"period": period})
