from sqlalchemy import String, Float, Boolean, DateTime, Text, Integer, BigInteger, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class SavedAddress(Base):
    __tablename__ = "saved_addresses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[str] = mapped_column(Text)
    extra_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    plan: Mapped[str] = mapped_column(String(32))  # weekly | monthly
    water_summary: Mapped[str] = mapped_column(Text)  # "Вода 20л x2, Вода 5л x1"
    qty: Mapped[int] = mapped_column(Integer, default=1)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    address: Mapped[str] = mapped_column(Text)
    landmark: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    day: Mapped[str | None] = mapped_column(String(16), nullable=True)  # weekday name
    time_slot: Mapped[str | None] = mapped_column(String(16), nullable=True)  # morning | afternoon
    payment_method: Mapped[str] = mapped_column(String(32), default="balance")
    payment_confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | expired | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TopupRequest(Base):
    """Pending balance top-up requests from the mini app."""
    __tablename__ = "topup_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | confirmed | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BottleDebt(Base):
    """Tracks 20L bottles the user currently owes."""
    __tablename__ = "bottle_debts"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    survey_done: Mapped[bool] = mapped_column(Boolean, default=False)
    survey_msg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
