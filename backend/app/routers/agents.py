from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.database import get_db
from app.models.agent import Agent
from app.models.user import User
from app.models.order import Order
from app.routers.orders import _order_opts, _order_to_out
from app.schemas.agent import AgentCreate, AgentOut

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/", response_model=list[AgentOut])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=AgentOut)
async def create_agent(body: AgentCreate, db: AsyncSession = Depends(get_db)):
    telegram_id = body.telegram_id
    if telegram_id:
        existing = (await db.execute(
            select(Agent).where(Agent.telegram_id == telegram_id)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Telegram ID already linked to another agent")
    else:
        # Auto-link: find a registered user with matching phone
        suffix = body.phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")[-9:]
        user = (await db.execute(
            select(User).where(User.phone.contains(suffix), User.telegram_id.isnot(None))
        )).scalar_one_or_none()
        if user:
            telegram_id = user.telegram_id
    agent = Agent(name=body.name, phone=body.phone, telegram_id=telegram_id)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/by_telegram/{telegram_id}", response_model=AgentOut)
async def get_agent_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Agent).where(Agent.telegram_id == telegram_id, Agent.is_active == True)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}/deactivate", response_model=AgentOut)
async def deactivate_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.is_active = False
    await db.commit()
    await db.refresh(agent)
    return agent


@router.patch("/{agent_id}/activate", response_model=AgentOut)
async def activate_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.is_active = True
    await db.commit()
    await db.refresh(agent)
    return agent


@router.patch("/{agent_id}/link_telegram", response_model=AgentOut)
async def link_telegram(agent_id: int, telegram_id: int, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(Agent).where(Agent.telegram_id == telegram_id, Agent.id != agent_id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Telegram ID already linked to another agent")
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.telegram_id = telegram_id
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/{agent_id}/orders")
async def get_agent_orders(
    agent_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Order)
        .where(Order.agent_id == agent_id)
        .options(*_order_opts())
        .order_by(Order.created_at.desc())
    )
    if date_from:
        df = datetime.strptime(date_from, "%Y-%m-%d")
        q = q.where(Order.created_at >= datetime(df.year, df.month, df.day, 0, 0, 0))
    if date_to:
        dt = datetime.strptime(date_to, "%Y-%m-%d")
        q = q.where(Order.created_at <= datetime(dt.year, dt.month, dt.day, 23, 59, 59))
    result = await db.execute(q)
    return [_order_to_out(o) for o in result.scalars().all()]
