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
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS courier_earning FLOAT",
            "ALTER TABLE courier_water ADD COLUMN IF NOT EXISTS reserved INTEGER DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_collected BOOLEAN",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_prompt_msg_id BIGINT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_role VARCHAR(32)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_msg_ids TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(30)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_status_msg_id INTEGER",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id)",
            "ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL",
            "ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL",
            """CREATE TABLE IF NOT EXISTS courier_product_earnings (
                id SERIAL PRIMARY KEY,
                courier_id INTEGER NOT NULL REFERENCES couriers(id),
                product_id INTEGER NOT NULL REFERENCES products(id),
                earning FLOAT NOT NULL,
                UNIQUE(courier_id, product_id)
            )""",
            "UPDATE users SET phone = NULL WHERE phone = ''",
            # Sync phone from couriers/managers into users table where phone is missing
            """UPDATE users u SET phone = c.phone
               FROM couriers c
               WHERE u.telegram_id = c.telegram_id
                 AND (u.phone IS NULL OR u.phone = '')
                 AND c.phone IS NOT NULL AND c.phone != ''""",
            """UPDATE users u SET phone = m.phone
               FROM managers m
               WHERE u.telegram_id = m.telegram_id
                 AND (u.phone IS NULL OR u.phone = '')
                 AND m.phone IS NOT NULL AND m.phone != ''""",
            # Reverse: sync phone into couriers from users/managers where missing
            """UPDATE couriers c SET phone = u.phone
               FROM users u
               WHERE c.telegram_id = u.telegram_id
                 AND (c.phone IS NULL OR c.phone = '')
                 AND u.phone IS NOT NULL AND u.phone != ''""",
            """UPDATE couriers c SET phone = m.phone
               FROM managers m
               WHERE c.telegram_id = m.telegram_id
                 AND (c.phone IS NULL OR c.phone = '')
                 AND m.phone IS NOT NULL AND m.phone != ''""",
            # Reverse: sync phone into managers from users/couriers where missing
            """UPDATE managers mm SET phone = u.phone
               FROM users u
               WHERE mm.telegram_id = u.telegram_id
                 AND (mm.phone IS NULL OR mm.phone = '')
                 AND u.phone IS NOT NULL AND u.phone != ''""",
            # Normalize all stored phones to +998XXXXXXXXX (strip spaces and country-code variants)
            """UPDATE users SET phone = '+998' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)
               WHERE phone IS NOT NULL AND phone != ''
                 AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 9""",
            """UPDATE couriers SET phone = '+998' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)
               WHERE phone IS NOT NULL AND phone != ''
                 AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 9""",
            """UPDATE managers SET phone = '+998' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)
               WHERE phone IS NOT NULL AND phone != ''
                 AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 9""",
        ):
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
