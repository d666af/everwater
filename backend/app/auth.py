"""Telegram Mini App authentication.

Verifies initData using HMAC-SHA256 per Telegram Web App spec:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


def verify_init_data(init_data: str, max_age_seconds: int = 86400) -> dict:
    """Verify Telegram Mini App initData. Returns parsed user dict on success."""
    if not init_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing initData")

    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid hash")

    auth_date = int(parsed.get("auth_date", 0))
    if auth_date and (time.time() - auth_date) > max_age_seconds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="initData expired")

    user_str = parsed.get("user")
    if not user_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user")

    try:
        user = json.loads(user_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed user")

    return user


async def upsert_user(db: AsyncSession, tg_user: dict) -> User:
    """Find or create a User by telegram_id. Returns the DB row."""
    result = await db.execute(select(User).where(User.telegram_id == tg_user["id"]))
    user = result.scalar_one_or_none()
    if user:
        return user

    parts = [tg_user.get("first_name") or "", tg_user.get("last_name") or ""]
    name = " ".join(p for p in parts if p).strip() or tg_user.get("username") or None
    user = User(telegram_id=tg_user["id"], name=name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def current_user(
    db: AsyncSession,
    x_tg_init_data: str | None,
    x_tg_user_id: int | None,
) -> User:
    """Resolve the authenticated user from either initData or a fallback TG id header.
    Dev mode allows x_tg_user_id when initData is absent (for local/non-https testing).
    """
    if x_tg_init_data:
        tg_user = verify_init_data(x_tg_init_data)
        return await upsert_user(db, tg_user)
    if x_tg_user_id and settings.ALLOW_DEV_AUTH:
        return await upsert_user(db, {"id": x_tg_user_id, "first_name": "Dev"})
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def tg_header(x_tg_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data")):
    return x_tg_init_data


def tg_user_id_header(x_tg_user_id: int | None = Header(default=None, alias="X-Telegram-User-Id")):
    return x_tg_user_id
