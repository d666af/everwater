from sqlalchemy import BigInteger, String, Boolean, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    is_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)

    # Balance & bonuses
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    bonus_points: Mapped[float] = mapped_column(Float, default=0.0)

    # Registration reminders
    reminder_count: Mapped[int] = mapped_column(default=0)
    last_reminder_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    site_password: Mapped[str | None] = mapped_column(String(12), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")  # noqa: F821
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="user")  # noqa: F821
