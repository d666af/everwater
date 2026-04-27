from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.database import create_tables, AsyncSessionLocal, engine
from app.routers import products, orders, users, admin, auth, client
from app.routers import warehouse, couriers
from app.services.seed import seed_products
from app.services.settings_service import seed_defaults

# Import all models so SQLAlchemy knows about them before create_tables
from app.models import user, order, product, courier as courier_model  # noqa: F401
from app.models import client_data, support, settings as settings_model  # noqa: F401
# TopupRequest is in client_data — imported above
from app.models import manager, warehouse as warehouse_model, cash_debt  # noqa: F401


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
    async with AsyncSessionLocal() as db:
        await seed_products(db)
        await seed_defaults(db)
    yield


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


@app.get("/health")
async def health():
    return {"status": "ok"}
