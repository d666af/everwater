from pydantic import BaseModel
from datetime import datetime


class AgentCreate(BaseModel):
    name: str
    phone: str
    telegram_id: int | None = None


class AgentOut(BaseModel):
    id: int
    name: str
    phone: str
    is_active: bool
    telegram_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
