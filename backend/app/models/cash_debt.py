from sqlalchemy import Float, DateTime, ForeignKey, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class CashDebt(Base):
    __tablename__ = "cash_debts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    courier_id: Mapped[int] = mapped_column(ForeignKey("couriers.id"))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    # pending | requested | approved | rejected
    status: Mapped[str] = mapped_column(String(32), default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    courier: Mapped["Courier"] = relationship("Courier")  # noqa: F821
    order: Mapped["Order | None"] = relationship("Order")  # noqa: F821
