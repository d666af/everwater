from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Lightweight column additions for tables that already exist
        # (Postgres-only; safe to re-run because of IF NOT EXISTS).
        from sqlalchemy import text
        for stmt in (
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(64)",
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(32)",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS batch_id VARCHAR(36)",
            "CREATE INDEX IF NOT EXISTS ix_water_transactions_batch_id ON water_transactions (batch_id)",
        ):
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
