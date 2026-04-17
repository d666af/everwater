from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/lookup", response_model=UserOut)
async def lookup_user(phone: str | None = None, telegram_id: int | None = None, db: AsyncSession = Depends(get_db)):
    if phone:
        result = await db.execute(select(User).where(User.phone == phone))
    elif telegram_id:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    else:
        raise HTTPException(status_code=400, detail="Provide phone or telegram_id")
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/by_telegram/{telegram_id}", response_model=UserOut)
async def get_user_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserOut)
async def create_or_get_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.telegram_id == data.telegram_id))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(**data.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{telegram_id}", response_model=UserOut)
async def update_user(telegram_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    if user.name and user.phone:
        user.is_registered = True
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/unregistered/remind", response_model=list[UserOut])
async def get_users_to_remind(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.is_registered == False, User.is_blocked == False)
    )
    return result.scalars().all()
