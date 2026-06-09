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


class AgentPayoutCreate(BaseModel):
    amount: float
    note: str | None = None
    performed_by: str | None = None
    performed_by_role: str | None = None


class AgentPayoutOut(BaseModel):
    id: int
    agent_id: int
    amount: float
    note: str | None
    performed_by: str | None
    performed_by_role: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentBalanceOut(BaseModel):
    agent_id: int
    earned: float
    paid_out: float
    owed: float
