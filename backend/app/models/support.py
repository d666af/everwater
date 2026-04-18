from sqlalchemy import BigInteger, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class SupportChat(Base):
    __tablename__ = "support_chats"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # telegram_id
    user_name: Mapped[str] = mapped_column(String(255), default="")
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    last_message: Mapped[str] = mapped_column(String(500), default="")
    last_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    messages: Mapped[list["SupportMessage"]] = relationship(
        back_populates="chat", order_by="SupportMessage.created_at"
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("support_chats.id"))
    text: Mapped[str] = mapped_column(String(2000))
    from_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    delivered: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    chat: Mapped["SupportChat"] = relationship(back_populates="messages")
