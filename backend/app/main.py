from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables, AsyncSessionLocal
from app.routers import products, orders, users, admin, auth, client
from app.services.seed import seed_products
from app.services.settings_service import seed_defaults


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
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


@app.get("/health")
async def health():
    return {"status": "ok"}
