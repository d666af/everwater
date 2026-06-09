from sqlalchemy import Float, ForeignKey, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.database import Base


class AgentEarningPayout(Base):
    __tablename__ = "agent_earning_payouts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
