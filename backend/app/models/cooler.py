from sqlalchemy import ForeignKey, String, Float, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class Cooler(Base):
    __tablename__ = "coolers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    price: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    payments: Mapped[list["CoolerPayment"]] = relationship("CoolerPayment", back_populates="cooler", cascade="all, delete-orphan", order_by="CoolerPayment.created_at")


class CoolerPayment(Base):
    __tablename__ = "cooler_payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cooler_id: Mapped[int] = mapped_column(ForeignKey("coolers.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cooler: Mapped["Cooler"] = relationship("Cooler", back_populates="payments")
