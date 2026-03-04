from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_tables
from app.routers import products, orders, users, admin

app = FastAPI(title="Water Delivery Bot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(users.router)
app.include_router(admin.router)


@app.on_event("startup")
async def startup():
    await create_tables()


@app.get("/health")
async def health():
    return {"status": "ok"}
