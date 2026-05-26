from sqlalchemy import Integer, Float, DateTime, ForeignKey, String, Text, Boolean, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class WaterStock(Base):
    __tablename__ = "water_stock"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), unique=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product: Mapped["Product"] = relationship("Product")  # noqa: F821


class WaterTransaction(Base):
    __tablename__ = "water_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    courier_id: Mapped[int | None] = mapped_column(ForeignKey("couriers.id"), nullable=True)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id"), nullable=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    # production | issue | factory_issue | return | adjustment
    transaction_type: Mapped[str] = mapped_column(String(32))
    quantity: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    performed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    counts_for_debt: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=True)
    invoice_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["Product | None"] = relationship("Product")  # noqa: F821
    courier: Mapped["Courier | None"] = relationship("Courier")  # noqa: F821
    factory: Mapped["Factory | None"] = relationship("Factory")  # noqa: F821


class CourierWater(Base):
    """Tracks how many bottles of each product a courier currently has."""
    __tablename__ = "courier_water"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    courier_id: Mapped[int] = mapped_column(ForeignKey("couriers.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    issued_today: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    courier: Mapped["Courier"] = relationship("Courier")  # noqa: F821
    product: Mapped["Product"] = relationship("Product")  # noqa: F821


class CancelledBatch(Base):
    """Audit trail of cancelled issuance batches."""
    __tablename__ = "cancelled_batches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    transaction_type: Mapped[str] = mapped_column(String(32))
    product_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    courier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    factory_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_quantity: Mapped[int] = mapped_column(Integer)
    items_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cancelled_by_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    invoice_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    original_created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WarehouseStaff(Base):
    """Persistent warehouse staff members (завсклада)."""
    __tablename__ = "warehouse_staff"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BottleDebtAdjustment(Base):
    """Manual adjustment to a courier's or client's bottle debt."""
    __tablename__ = "bottle_debt_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(String(16))  # "courier" | "client"
    courier_id: Mapped[int | None] = mapped_column(ForeignKey("couriers.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    delta: Mapped[int] = mapped_column(Integer)  # signed: +N more debt, -N less debt
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
