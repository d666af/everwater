"""Telegram Mini App auth.

Clients send initData (signed by Telegram) and receive a user object.
During dev (ALLOW_DEV_AUTH=true) we also accept {telegram_id, name, phone} directly.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import upsert_user, verify_init_data
from app.config import settings
from app.database import get_db
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


class InitDataBody(BaseModel):
    init_data: str | None = None
    telegram_id: int | None = None
    name: str | None = None
    phone: str | None = None


@router.post("/telegram", response_model=UserOut)
async def telegram_auth(body: InitDataBody, db: AsyncSession = Depends(get_db)):
    if body.init_data:
        tg_user = verify_init_data(body.init_data)
        return await upsert_user(db, tg_user)

    if settings.ALLOW_DEV_AUTH and body.telegram_id:
        tg_user = {"id": body.telegram_id}
        if body.name:
            tg_user["first_name"] = body.name
        user = await upsert_user(db, tg_user)
        if body.phone and not user.phone:
            user.phone = body.phone
            await db.commit()
            await db.refresh(user)
        return user

    raise HTTPException(status_code=401, detail="initData required")
