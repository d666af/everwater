from sqlalchemy import (
    String, Float, Boolean, DateTime, Text, Integer,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import enum
from app.database import Base


class OrderStatus(str, enum.Enum):
    NEW = "new"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    CONFIRMED = "confirmed"
    ASSIGNED_TO_COURIER = "assigned_to_courier"
    IN_DELIVERY = "in_delivery"
    DELIVERED = "delivered"
    REJECTED = "rejected"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    courier_id: Mapped[int | None] = mapped_column(ForeignKey("couriers.id"), nullable=True)

    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus), default=OrderStatus.NEW
    )

    # Delivery details
    recipient_phone: Mapped[str] = mapped_column(String(20))
    address: Mapped[str] = mapped_column(Text)
    extra_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_time: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Bottle return
    return_bottles_count: Mapped[int] = mapped_column(Integer, default=0)
    return_bottles_volume: Mapped[float] = mapped_column(Float, default=0.0)
    bottle_discount: Mapped[float] = mapped_column(Float, default=0.0)

    # Pricing
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    bonus_used: Mapped[float] = mapped_column(Float, default=0.0)

    # Admin
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivery_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_expected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="orders")  # noqa: F821
    courier: Mapped["Courier | None"] = relationship("Courier", back_populates="orders")  # noqa: F821
    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    review: Mapped["Review | None"] = relationship("Review", back_populates="order", uselist=False)  # noqa: F821


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="order_items")  # noqa: F821


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True)
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="reviews")  # noqa: F821
    order: Mapped["Order"] = relationship("Order", back_populates="review")
