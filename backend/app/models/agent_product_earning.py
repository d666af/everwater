from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AgentProductEarning(Base):
    __tablename__ = "agent_product_earnings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    earning: Mapped[float] = mapped_column(Float)

    agent: Mapped["Agent"] = relationship("Agent")  # noqa: F821
    product: Mapped["Product"] = relationship("Product")  # noqa: F821
