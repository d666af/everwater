import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text
from app.database import create_tables, AsyncSessionLocal, engine
from app.routers import products, orders, users, admin, auth, client
from app.routers import warehouse, couriers, agents
from app.services.seed import seed_products
from app.services.settings_service import seed_defaults
from app.services.background_tasks import background_loop

# Import all models so SQLAlchemy knows about them before create_tables
from app.models import user, order, product, courier as courier_model  # noqa: F401
from app.models import client_data, support, settings as settings_model  # noqa: F401
# TopupRequest is in client_data — imported above
from app.models import manager, warehouse as warehouse_model, cash_debt  # noqa: F401
from app.models import agent as agent_model  # noqa: F401
from app.models import courier_product_earning as cpe_model  # noqa: F401
from app.models import agent_product_earning as ape_model  # noqa: F401
from app.models import agent_earning_payout as aep_model  # noqa: F401
from app.models import factory as factory_model  # noqa: F401
from app.models import admin_user as admin_user_model  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS site_password VARCHAR(12)"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_status_msg_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE bottle_debts ADD COLUMN IF NOT EXISTS survey_done BOOLEAN DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE bottle_debts ADD COLUMN IF NOT EXISTS survey_msg_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT TRUE"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_msg_ids TEXT"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notification_msg_ids TEXT"
        ))
        await conn.execute(text(
            "ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS notification_msg_ids TEXT"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_delivery_date TIMESTAMP"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_delivered_at TIMESTAMP"
        ))
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_addresses TEXT"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(30)"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS has_bottle_deposit BOOLEAN DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS deposit_price INTEGER DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price FLOAT DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_until TIMESTAMP DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee FLOAT DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_penalty FLOAT DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500) DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE"
        ))
        # Update default for existing column (in case it was added with TRUE before)
        await conn.execute(text(
            "ALTER TABLE reviews ALTER COLUMN is_approved SET DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_expires_at TIMESTAMP DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS bonus_used FLOAT DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS avg_rating FLOAT DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE couriers ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0"
        ))
        # Extend enum for cancellation_requested status
        await conn.execute(text(
            "ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'cancellation_requested'"
        ))
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS idempotency_keys ("
            "key VARCHAR(64) PRIMARY KEY, "
            "order_id INTEGER NOT NULL, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_reminder_2_sent BOOLEAN DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS bottle_surcharge INTEGER DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS bottle_surcharge FLOAT DEFAULT 0"
        ))
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS agents ("
            "id SERIAL PRIMARY KEY, "
            "name VARCHAR(255) NOT NULL, "
            "phone VARCHAR(20) NOT NULL, "
            "is_active BOOLEAN DEFAULT TRUE, "
            "telegram_id BIGINT UNIQUE, "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id)"
        ))
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS agent_earning FLOAT DEFAULT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE couriers ALTER COLUMN telegram_id DROP NOT NULL"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_name VARCHAR(255)"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigner_name VARCHAR(255)"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_status_msg_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigner_role VARCHAR(32)"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_by_name VARCHAR(255)"
        ))
        await conn.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_by_role VARCHAR(32)"
        ))
        await conn.execute(text(
            "ALTER TABLE bottle_debt_adjustments ADD COLUMN IF NOT EXISTS factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL"
        ))
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS agent_product_earnings ("
            "id SERIAL PRIMARY KEY, "
            "agent_id INTEGER NOT NULL REFERENCES agents(id), "
            "product_id INTEGER NOT NULL REFERENCES products(id), "
            "earning FLOAT NOT NULL"
            ")"
        ))
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS agent_earning_payouts ("
            "id SERIAL PRIMARY KEY, "
            "agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE, "
            "amount FLOAT NOT NULL, "
            "note VARCHAR(500), "
            "performed_by VARCHAR(255), "
            "performed_by_role VARCHAR(50), "
            "created_at TIMESTAMP DEFAULT NOW()"
            ")"
        ))
    async with AsyncSessionLocal() as db:
        await seed_products(db)
        await seed_defaults(db)
    bg_task = asyncio.create_task(background_loop())
    yield
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Water Delivery Bot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(client.router)
app.include_router(couriers.router)
app.include_router(warehouse.router)
app.include_router(agents.router)

os.makedirs("static/products", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}
