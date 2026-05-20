from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CourierProductEarning(Base):
    __tablename__ = "courier_product_earnings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    courier_id: Mapped[int] = mapped_column(ForeignKey("couriers.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    earning: Mapped[float] = mapped_column(Float)

    courier: Mapped["Courier"] = relationship("Courier")  # noqa: F821
    product: Mapped["Product"] = relationship("Product")  # noqa: F821
