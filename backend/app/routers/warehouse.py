"""Warehouse management: stock tracking, production, issue, returns."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.warehouse import WaterStock, WaterTransaction, CourierWater
from app.models.courier import Courier
from app.models.order import Order, OrderStatus
from app.models.product import Product

router = APIRouter(prefix="/warehouse", tags=["warehouse"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _tx_out(tx: WaterTransaction) -> dict:
    return {
        "id": tx.id,
        "product_id": tx.product_id,
        "product_name": tx.product.name if tx.product else None,
        "courier_id": tx.courier_id,
        "order_id": tx.order_id,
        "type": tx.transaction_type,
        "quantity": tx.quantity,
        "note": tx.note,
        "created_at": tx.created_at.isoformat(),
    }


async def _ensure_stock(db: AsyncSession, product_id: int) -> WaterStock:
    result = await db.execute(select(WaterStock).where(WaterStock.product_id == product_id))
    stock = result.scalar_one_or_none()
    if not stock:
        stock = WaterStock(product_id=product_id, quantity=0)
        db.add(stock)
        await db.flush()
    return stock


# ─── Stock overview ───────────────────────────────────────────────────────────

@router.get("/stock")
async def get_stock(db: AsyncSession = Depends(get_db)):
    products_q = await db.execute(select(Product).where(Product.is_active == True))
    products = products_q.scalars().all()

    result = []
    for p in products:
        stock_q = await db.execute(select(WaterStock).where(WaterStock.product_id == p.id))
        stock = stock_q.scalar_one_or_none()
        qty = stock.quantity if stock else 0

        # Demand: delivered orders in last 30 days
        since = datetime.utcnow() - timedelta(days=30)
        demand_q = await db.execute(
            select(func.sum(
                select(func.count()).where(
                    and_(Order.status == OrderStatus.DELIVERED, Order.created_at >= since)
                ).scalar_subquery()
            ))
        )

        result.append({
            "product_id": p.id,
            "product_name": p.name,
            "volume": p.volume,
            "type": p.type,
            "quantity": qty,
        })
    return result


@router.get("/overview")
async def get_overview(period: str = "day", db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    if period == "week":
        since = now - timedelta(weeks=1)
    elif period == "month":
        since = now - timedelta(days=30)
    else:
        since = now - timedelta(days=1)

    prod_q = await db.execute(
        select(func.sum(WaterTransaction.quantity))
        .where(and_(WaterTransaction.transaction_type == "production",
                    WaterTransaction.created_at >= since))
    )
    issued_q = await db.execute(
        select(func.sum(WaterTransaction.quantity))
        .where(and_(WaterTransaction.transaction_type == "issue",
                    WaterTransaction.created_at >= since))
    )
    returned_q = await db.execute(
        select(func.sum(WaterTransaction.quantity))
        .where(and_(WaterTransaction.transaction_type == "return",
                    WaterTransaction.created_at >= since))
    )

    total_stock_q = await db.execute(select(func.sum(WaterStock.quantity)))

    return {
        "period": period,
        "produced": prod_q.scalar() or 0,
        "issued": issued_q.scalar() or 0,
        "returned": returned_q.scalar() or 0,
        "total_stock": total_stock_q.scalar() or 0,
    }


# ─── Production ───────────────────────────────────────────────────────────────

class ProductionBody(BaseModel):
    product_id: int
    quantity: int
    note: str | None = None


@router.post("/production")
async def add_production(body: ProductionBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    stock = await _ensure_stock(db, body.product_id)
    stock.quantity += body.quantity
    tx = WaterTransaction(
        product_id=body.product_id,
        transaction_type="production",
        quantity=body.quantity,
        note=body.note,
    )
    db.add(tx)
    await db.commit()
    return {"ok": True, "new_quantity": stock.quantity}


# ─── Issue to courier ─────────────────────────────────────────────────────────

class IssueBody(BaseModel):
    courier_id: int
    product_id: int
    quantity: int
    order_id: int | None = None
    note: str | None = None


@router.post("/issue")
async def issue_to_courier(body: IssueBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    stock = await _ensure_stock(db, body.product_id)
    if stock.quantity < body.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock")
    stock.quantity -= body.quantity

    # Update courier water inventory
    cw_q = await db.execute(
        select(CourierWater).where(
            and_(CourierWater.courier_id == body.courier_id,
                 CourierWater.product_id == body.product_id)
        )
    )
    cw = cw_q.scalar_one_or_none()
    if not cw:
        cw = CourierWater(courier_id=body.courier_id, product_id=body.product_id,
                          quantity=0, issued_today=0)
        db.add(cw)
    cw.quantity += body.quantity
    cw.issued_today += body.quantity

    tx = WaterTransaction(
        product_id=body.product_id,
        courier_id=body.courier_id,
        order_id=body.order_id,
        transaction_type="issue",
        quantity=body.quantity,
        note=body.note,
    )
    db.add(tx)
    await db.commit()
    return {"ok": True, "new_stock": stock.quantity}


@router.post("/issue_order")
async def issue_for_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Auto-issue stock for all items in an order assigned to a courier."""
    from sqlalchemy.orm import selectinload
    from app.models.order import OrderItem

    order_q = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items)
        )
    )
    order = order_q.scalar_one_or_none()
    if not order or not order.courier_id:
        raise HTTPException(status_code=400, detail="Order not found or no courier assigned")

    for item in order.items:
        stock = await _ensure_stock(db, item.product_id)
        if stock.quantity >= item.quantity:
            stock.quantity -= item.quantity
            cw_q = await db.execute(
                select(CourierWater).where(
                    and_(CourierWater.courier_id == order.courier_id,
                         CourierWater.product_id == item.product_id)
                )
            )
            cw = cw_q.scalar_one_or_none()
            if not cw:
                cw = CourierWater(courier_id=order.courier_id,
                                  product_id=item.product_id, quantity=0, issued_today=0)
                db.add(cw)
            cw.quantity += item.quantity
            cw.issued_today += item.quantity
            db.add(WaterTransaction(
                product_id=item.product_id,
                courier_id=order.courier_id,
                order_id=order_id,
                transaction_type="issue",
                quantity=item.quantity,
                note=f"Auto-issue for order #{order_id}",
            ))
    await db.commit()
    return {"ok": True}


# ─── Return from courier ──────────────────────────────────────────────────────

class ReturnBody(BaseModel):
    courier_id: int
    product_id: int
    quantity: int
    note: str | None = None


@router.post("/return")
async def return_from_courier(body: ReturnBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    stock = await _ensure_stock(db, body.product_id)
    stock.quantity += body.quantity

    cw_q = await db.execute(
        select(CourierWater).where(
            and_(CourierWater.courier_id == body.courier_id,
                 CourierWater.product_id == body.product_id)
        )
    )
    cw = cw_q.scalar_one_or_none()
    if cw:
        cw.quantity = max(0, cw.quantity - body.quantity)

    tx = WaterTransaction(
        product_id=body.product_id,
        courier_id=body.courier_id,
        transaction_type="return",
        quantity=body.quantity,
        note=body.note,
    )
    db.add(tx)
    await db.commit()
    return {"ok": True, "new_stock": stock.quantity}


# ─── Adjust stock ─────────────────────────────────────────────────────────────

class AdjustBody(BaseModel):
    product_id: int
    quantity: int
    note: str | None = None


@router.post("/stock/adjust")
async def adjust_stock(body: AdjustBody, db: AsyncSession = Depends(get_db)):
    stock = await _ensure_stock(db, body.product_id)
    old = stock.quantity
    stock.quantity = max(0, body.quantity)
    diff = stock.quantity - old
    tx = WaterTransaction(
        product_id=body.product_id,
        transaction_type="adjustment",
        quantity=diff,
        note=body.note or f"Manual adjustment: {old} → {stock.quantity}",
    )
    db.add(tx)
    await db.commit()
    return {"ok": True, "quantity": stock.quantity}


# ─── Couriers water inventory ────────────────────────────────────────────────

@router.get("/couriers")
async def get_couriers_water(db: AsyncSession = Depends(get_db)):
    couriers_q = await db.execute(select(Courier).where(Courier.is_active == True))
    couriers = couriers_q.scalars().all()
    result = []
    for c in couriers:
        water_q = await db.execute(
            select(CourierWater).where(CourierWater.courier_id == c.id)
        )
        water_items = water_q.scalars().all()
        active_orders_q = await db.execute(
            select(func.count(Order.id)).where(
                and_(Order.courier_id == c.id,
                     Order.status.in_([OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.IN_DELIVERY]))
            )
        )
        result.append({
            "courier_id": c.id,
            "courier_name": c.name,
            "telegram_id": c.telegram_id,
            "active_orders": active_orders_q.scalar() or 0,
            "water": [
                {"product_id": w.product_id, "quantity": w.quantity, "issued_today": w.issued_today}
                for w in water_items
            ],
        })
    return result


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    limit: int = 50,
    offset: int = 0,
    tx_type: str | None = None,
    product_id: int | None = None,
    courier_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    q = select(WaterTransaction).options(
        selectinload(WaterTransaction.product),
        selectinload(WaterTransaction.courier),
    ).order_by(WaterTransaction.created_at.desc())
    if tx_type:
        q = q.where(WaterTransaction.transaction_type == tx_type)
    if product_id:
        q = q.where(WaterTransaction.product_id == product_id)
    if courier_id:
        q = q.where(WaterTransaction.courier_id == courier_id)
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    return [_tx_out(tx) for tx in result.scalars().all()]


# ─── Production plan (subscriptions-based forecast) ──────────────────────────

@router.get("/production_plan")
async def get_production_plan(db: AsyncSession = Depends(get_db)):
    from app.models.client_data import Subscription
    subs_q = await db.execute(
        select(Subscription).where(Subscription.status == "active")
    )
    subs = subs_q.scalars().all()
    return {
        "active_subscriptions": len(subs),
        "weekly": len([s for s in subs if s.plan == "weekly"]),
        "monthly": len([s for s in subs if s.plan == "monthly"]),
    }


# ─── Subscriptions for warehouse ─────────────────────────────────────────────

@router.get("/subscriptions")
async def get_warehouse_subscriptions(db: AsyncSession = Depends(get_db)):
    from app.models.client_data import Subscription
    subs_q = await db.execute(
        select(Subscription).where(Subscription.status == "active").order_by(Subscription.day)
    )
    subs = subs_q.scalars().all()
    return [
        {"id": s.id, "plan": s.plan, "water_summary": s.water_summary,
         "qty": s.qty, "day": s.day, "address": s.address}
        for s in subs
    ]
