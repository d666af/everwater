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
    # Each migration runs in its own connection+transaction so one failure
    # doesn't abort the rest.
    from sqlalchemy import text
    for stmt in (
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(64)",
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(32)",
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS warehouse_only BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE factories ADD COLUMN IF NOT EXISTS category VARCHAR(32)",
            # Seed special "other" factory entities (НАХТ, MILK VILL)
            "INSERT INTO factories (name, category) VALUES ('НАХТ', 'other') ON CONFLICT (name) DO UPDATE SET category = 'other'",
            "INSERT INTO factories (name) VALUES ('MILK VILL') ON CONFLICT (name) DO UPDATE SET category = NULL",
            "INSERT INTO factories (name) VALUES ('Склад офис') ON CONFLICT (name) DO NOTHING",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS batch_id VARCHAR(36)",
            "CREATE INDEX IF NOT EXISTS ix_water_transactions_batch_id ON water_transactions (batch_id)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS courier_earning FLOAT",
            "ALTER TABLE courier_water ADD COLUMN IF NOT EXISTS reserved INTEGER DEFAULT 0",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_collected BOOLEAN",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_prompt_msg_id BIGINT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_role VARCHAR(32)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bottles_lent INTEGER DEFAULT 0",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS performed_by VARCHAR(64)",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS counts_for_debt BOOLEAN DEFAULT TRUE",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_msg_ids TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_notification_msg_ids TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(30)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_status_msg_id INTEGER",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_items_edited BOOLEAN DEFAULT FALSE",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_edited_by VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_change_log TEXT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigner_name VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigner_role VARCHAR(32)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS previous_courier_name VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_changed_by VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_changed_by_role VARCHAR(32)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_name VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_by_name VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_by_role VARCHAR(32)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_status_msg_id BIGINT",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_expected_at TIMESTAMP",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_reminder_sent BOOLEAN DEFAULT FALSE",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_reminder_2_sent BOOLEAN DEFAULT FALSE",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS has_bottle_deposit BOOLEAN DEFAULT FALSE",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_by_name VARCHAR(255)",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_by_role VARCHAR(32)",
            "ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL",
            "ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS factory_id INTEGER REFERENCES factories(id)",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS invoice_message_id BIGINT",
            "ALTER TABLE water_transactions ADD COLUMN IF NOT EXISTS performed_by_role VARCHAR(32)",
            "ALTER TABLE water_transactions ALTER COLUMN performed_by TYPE VARCHAR(255)",
            """CREATE TABLE IF NOT EXISTS cancelled_batches (
                id SERIAL PRIMARY KEY,
                batch_id VARCHAR(36) UNIQUE NOT NULL,
                transaction_type VARCHAR(32) NOT NULL,
                product_name VARCHAR(255),
                courier_name VARCHAR(255),
                factory_name VARCHAR(255),
                total_quantity INTEGER NOT NULL,
                items_json TEXT,
                performed_by VARCHAR(255),
                performed_by_role VARCHAR(32),
                cancelled_by VARCHAR(255),
                cancelled_by_role VARCHAR(32),
                invoice_message_id BIGINT,
                original_created_at TIMESTAMP,
                cancelled_at TIMESTAMP NOT NULL DEFAULT NOW()
            )""",
            "CREATE INDEX IF NOT EXISTS ix_cancelled_batches_batch_id ON cancelled_batches (batch_id)",
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
            """CREATE TABLE IF NOT EXISTS bottle_debt_adjustments (
    id SERIAL PRIMARY KEY,
    target_type VARCHAR(16) NOT NULL,
    courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    delta INTEGER NOT NULL,
    note TEXT,
    performed_by VARCHAR(255),
    performed_by_role VARCHAR(32),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
)""",
            "CREATE INDEX IF NOT EXISTS ix_bda_courier_id ON bottle_debt_adjustments (courier_id)",
            "CREATE INDEX IF NOT EXISTS ix_bda_client_id ON bottle_debt_adjustments (client_id)",
        ):
            try:
                async with engine.begin() as _conn:
                    await _conn.execute(text(stmt))
            except Exception:
                pass
