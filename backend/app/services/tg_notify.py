"""Shared Telegram notification helpers with idempotency support."""
import json
import aiohttp
from app.config import settings


async def tg_send_capture(chat_id: int, text: str, reply_markup=None) -> dict | None:
    """Send TG message, return {chat_id, message_id} on success or None."""
    if not chat_id:
        return None
    payload: dict = {"chat_id": chat_id, "text": text}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage"
    try:
        async with aiohttp.ClientSession() as s:
            r = await s.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5))
            data = await r.json()
            if data.get("ok"):
                return {"chat_id": chat_id, "message_id": data["result"]["message_id"]}
    except Exception:
        pass
    return None


async def tg_send_photo(chat_id: int, photo_bytes: bytes, caption: str | None = None,
                        filename: str = "invoice.png") -> bool:
    """Send a photo (PNG bytes) with optional HTML caption. Returns True on success."""
    if not chat_id or not photo_bytes:
        return False
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendPhoto"
    form = aiohttp.FormData()
    form.add_field("chat_id", str(chat_id))
    if caption:
        form.add_field("caption", caption)
        form.add_field("parse_mode", "HTML")
    form.add_field("photo", photo_bytes, filename=filename, content_type="image/png")
    try:
        async with aiohttp.ClientSession() as s:
            r = await s.post(url, data=form, timeout=aiohttp.ClientTimeout(total=15))
            data = await r.json()
            return bool(data.get("ok"))
    except Exception:
        return False


async def tg_edit_msg(chat_id: int, message_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/editMessageText"
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(url, json={
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
            }, timeout=aiohttp.ClientTimeout(total=5))
    except Exception:
        pass


async def edit_all_notifications(msg_ids_json: str | None, text: str) -> None:
    """Edit every stored notification message to show resolved state (removes buttons)."""
    if not msg_ids_json:
        return
    try:
        for m in json.loads(msg_ids_json):
            await tg_edit_msg(m["chat_id"], m["message_id"], text)
    except Exception:
        pass


async def notify_all(admin_ids: list[int], managers, text: str, reply_markup=None) -> str:
    """Send to all admins + active managers (deduplicated), return JSON list of {chat_id, message_id}."""
    msg_ids = []
    seen: set[int] = set()
    for aid in admin_ids:
        if aid in seen:
            continue
        seen.add(aid)
        result = await tg_send_capture(aid, text, reply_markup)
        if result:
            msg_ids.append(result)
    for m in managers:
        tg = m.telegram_id if hasattr(m, "telegram_id") else m.get("telegram_id")
        active = m.is_active if hasattr(m, "is_active") else m.get("is_active", True)
        if active and tg:
            tid = int(tg)
            if tid in seen:
                continue
            seen.add(tid)
            result = await tg_send_capture(tid, text, reply_markup)
            if result:
                msg_ids.append(result)
    return json.dumps(msg_ids)
