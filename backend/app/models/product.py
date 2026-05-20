from sqlalchemy import String, Float, Boolean, Text, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    volume: Mapped[float] = mapped_column(Float)  # литры
    price: Mapped[float] = mapped_column(Float)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stock: Mapped[int] = mapped_column(Integer, default=999)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    type: Mapped[str] = mapped_column(String(16), default="still")  # still | carbonated
    has_bottle_deposit: Mapped[bool] = mapped_column(Boolean, default=False)
    deposit_price: Mapped[int | None] = mapped_column(Integer, nullable=True)  # legacy — was "цена со сдачей", no longer used in math
    bottle_surcharge: Mapped[int | None] = mapped_column(Integer, nullable=True)  # надбавка за каждую невозвращённую бутылку (для 19л)
    cost_price: Mapped[float | None] = mapped_column(Float, nullable=True)  # себестоимость
    courier_earning: Mapped[float | None] = mapped_column(Float, nullable=True)  # заработок курьера с одного товара
    agent_earning: Mapped[float | None] = mapped_column(Float, nullable=True)  # заработок агента с одного товара
    discount_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)  # % скидки акции
    discount_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # до когда действует

    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="product")  # noqa: F821
