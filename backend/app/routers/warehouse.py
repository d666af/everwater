"""Warehouse management: stock tracking, production, issue, returns."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.warehouse import WaterStock, WaterTransaction, CourierWater, WarehouseStaff
from app.models.courier import Courier
from app.models.order import Order, OrderStatus, OrderItem
from app.models.product import Product

router = APIRouter(prefix="/warehouse", tags=["warehouse"])

_ACTIVE_STATUSES = [
    OrderStatus.CONFIRMED,
    OrderStatus.ASSIGNED_TO_COURIER,
    OrderStatus.IN_DELIVERY,
]

# ─── Internal helpers ─────────────────────────────────────────────────────────

def _product_key(volume, ptype: str) -> str:
    v = int(volume) if float(volume) == int(float(volume)) else float(volume)
    return f"{v}-{ptype}"


def _short_name(volume, ptype: str) -> str:
    v = int(volume) if float(volume) == int(float(volume)) else float(volume)
    return f"Газ. вода {v}л" if ptype == "carb" else f"Вода {v}л"


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


async def _resolve_product(db: AsyncSession, product_id: int | None, product_name: str | None) -> Product:
    """Return Product by id or by name (short or full). Raises 404 if not found."""
    if product_id:
        r = await db.execute(select(Product).where(Product.id == product_id))
        p = r.scalar_one_or_none()
        if p:
            return p
    if product_name:
        # Try exact full name first
        r = await db.execute(select(Product).where(Product.name == product_name))
        p = r.scalar_one_or_none()
        if p:
            return p
        # Try short name match
        all_q = await db.execute(select(Product).where(Product.is_active == True))
        for prod in all_q.scalars().all():
            if _short_name(prod.volume, prod.type) == product_name:
                return prod
    raise HTTPException(status_code=404, detail=f"Product not found: {product_name or product_id}")


def _period_range(period: str, date_str: str | None, time_from: str | None, time_to: str | None):
    """Return (since, until) UTC datetimes for the given period descriptor."""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    def end_of(d: datetime) -> datetime:
        return d.replace(hour=23, minute=59, second=59, microsecond=999999)

    if period == "today":
        return today, end_of(today)
    if period == "yesterday":
        y = today - timedelta(days=1)
        return y, end_of(y)
    if period == "tomorrow":
        t = today + timedelta(days=1)
        return t, end_of(t)
    if period == "week":
        return today - timedelta(days=6), end_of(today)
    if period == "month":
        return today - timedelta(days=29), end_of(today)
    if period == "custom" and date_str:
        try:
            d = datetime.fromisoformat(date_str.split("T")[0]).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        except Exception:
            d = today
        s = d.replace(hour=0, minute=0, second=0, microsecond=0)
        e = end_of(d)
        if time_from:
            try:
                h, m = [int(x) for x in time_from.split(":")]
                s = d.replace(hour=h, minute=m, second=0, microsecond=0)
            except Exception:
                pass
        if time_to:
            try:
                h, m = [int(x) for x in time_to.split(":")]
                e = d.replace(hour=h, minute=m, second=59, microsecond=999999)
            except Exception:
                pass
        return s, e
    # "all" or unknown
    return datetime(2000, 1, 1), datetime(2099, 12, 31)


# ─── Stock overview ───────────────────────────────────────────────────────────

@router.get("/stock")
async def get_stock(db: AsyncSession = Depends(get_db)):
    products_q = await db.execute(select(Product).where(Product.is_active == True))
    products = products_q.scalars().all()
    result = []
    for p in products:
        stock_q = await db.execute(select(WaterStock).where(WaterStock.product_id == p.id))
        stock = stock_q.scalar_one_or_none()
        result.append({
            "product_id": p.id,
            "product_name": p.name,
            "short_name": _short_name(p.volume, p.type),
            "key": _product_key(p.volume, p.type),
            "volume": p.volume,
            "type": p.type,
            "quantity": stock.quantity if stock else 0,
        })
    return {"stock": result}


# ─── Overview (per-product analytics, period-aware) ──────────────────────────

@router.get("/overview")
async def get_overview(
    period: str = "today",
    date: str | None = None,
    time_from: str | None = None,
    time_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    since, until = _period_range(period, date, time_from, time_to)

    # All active products → seed per-product map
    products_q = await db.execute(select(Product).where(Product.is_active == True))
    products = products_q.scalars().all()
    per_product: dict[int, dict] = {}
    for p in products:
        per_product[p.id] = {
            "key": _product_key(p.volume, p.type),
            "product_id": p.id,
            "product_name": _short_name(p.volume, p.type),
            "catalog_name": p.name,
            "volume": p.volume,
            "type": p.type,
            "stock": 0,
            "on_couriers": 0,
            "needed_period": 0,
            "delivered_period": 0,
            "produced_period": 0,
            "issued_period": 0,
            "returned_period": 0,
        }

    # Current stock
    for s in (await db.execute(select(WaterStock))).scalars().all():
        if s.product_id in per_product:
            per_product[s.product_id]["stock"] = s.quantity

    # On-hand with couriers
    for cw in (await db.execute(select(CourierWater))).scalars().all():
        if cw.product_id in per_product:
            per_product[cw.product_id]["on_couriers"] += cw.quantity

    # Transactions in period (skip "tomorrow" — nothing produced yet)
    if period != "tomorrow":
        tx_q = await db.execute(
            select(WaterTransaction).where(
                and_(WaterTransaction.created_at >= since, WaterTransaction.created_at <= until)
            )
        )
        for tx in tx_q.scalars().all():
            if tx.product_id not in per_product:
                continue
            t = tx.transaction_type
            if t == "production":
                per_product[tx.product_id]["produced_period"] += tx.quantity
            elif t == "issue":
                per_product[tx.product_id]["issued_period"] += tx.quantity
            elif t == "return":
                per_product[tx.product_id]["returned_period"] += tx.quantity

    # Active orders → needed_period
    act_q = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.status.in_(_ACTIVE_STATUSES))
    )
    active_orders = act_q.scalars().all()
    needed_orders = len(active_orders)
    for o in active_orders:
        for item in o.items:
            if item.product_id in per_product:
                per_product[item.product_id]["needed_period"] += item.quantity

    # Delivered orders in period → delivered_period
    del_q = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.status == OrderStatus.DELIVERED)
        .where(Order.created_at >= since)
        .where(Order.created_at <= until)
    )
    delivered_orders = del_q.scalars().all()
    delivered_count = len(delivered_orders)
    bottles_returned_period = sum(o.return_bottles_count for o in delivered_orders)
    for o in delivered_orders:
        for item in o.items:
            if item.product_id in per_product:
                per_product[item.product_id]["delivered_period"] += item.quantity

    # Assemble product list with computed fields
    products_list = []
    for p in per_product.values():
        p["total"] = p["stock"] + p["on_couriers"]
        p["shortfall"] = max(0, p["needed_period"] - p["total"])
        products_list.append(p)

    shortfall_items = [
        {"product_name": p["product_name"], "qty": p["shortfall"]}
        for p in products_list if p["shortfall"] > 0
    ]
    totals = {
        "stock":               sum(p["stock"] for p in products_list),
        "on_couriers":         sum(p["on_couriers"] for p in products_list),
        "total":               sum(p["total"] for p in products_list),
        "needed_period":       sum(p["needed_period"] for p in products_list),
        "delivered_period":    sum(p["delivered_period"] for p in products_list),
        "produced_period":     sum(p["produced_period"] for p in products_list),
        "issued_period":       sum(p["issued_period"] for p in products_list),
        "returned_period":     sum(p["returned_period"] for p in products_list),
        "shortfall":           sum(p["shortfall"] for p in products_list),
        "needed_orders":       needed_orders,
        "delivered_orders":    delivered_count,
        "bottles_returned_period": bottles_returned_period,
        "bottles_owed_total":  0,
    }
    return {"products": products_list, "totals": totals, "shortfall_items": shortfall_items, "period": period}


# ─── Production ───────────────────────────────────────────────────────────────

class ProductionBody(BaseModel):
    product_id: int | None = None
    product_name: str | None = None
    quantity: int
    note: str | None = None


@router.post("/production")
async def add_production(body: ProductionBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    product = await _resolve_product(db, body.product_id, body.product_name)
    stock = await _ensure_stock(db, product.id)
    stock.quantity += body.quantity
    db.add(WaterTransaction(
        product_id=product.id,
        transaction_type="production",
        quantity=body.quantity,
        note=body.note,
    ))
    await db.commit()
    return {"ok": True, "new_quantity": stock.quantity}


# ─── Issue to courier ─────────────────────────────────────────────────────────

class IssueBody(BaseModel):
    courier_id: int
    product_id: int | None = None
    product_name: str | None = None
    quantity: int
    order_id: int | None = None
    note: str | None = None


@router.post("/issue")
async def issue_to_courier(body: IssueBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    product = await _resolve_product(db, body.product_id, body.product_name)
    stock = await _ensure_stock(db, product.id)
    if stock.quantity < body.quantity:
        raise HTTPException(status_code=400, detail=f"Not enough stock (have {stock.quantity})")
    stock.quantity -= body.quantity

    cw_q = await db.execute(
        select(CourierWater).where(
            and_(CourierWater.courier_id == body.courier_id, CourierWater.product_id == product.id)
        )
    )
    cw = cw_q.scalar_one_or_none()
    if not cw:
        cw = CourierWater(courier_id=body.courier_id, product_id=product.id, quantity=0, issued_today=0)
        db.add(cw)
    cw.quantity += body.quantity
    cw.issued_today += body.quantity

    db.add(WaterTransaction(
        product_id=product.id,
        courier_id=body.courier_id,
        order_id=body.order_id,
        transaction_type="issue",
        quantity=body.quantity,
        note=body.note,
    ))
    await db.commit()
    return {"ok": True, "new_stock": stock.quantity}


class IssueOrderBody(BaseModel):
    order_id: int
    courier_id: int | None = None


@router.post("/issue_order")
async def issue_for_order(body: IssueOrderBody, db: AsyncSession = Depends(get_db)):
    """Auto-issue stock for all items in an order to its assigned courier."""
    order_q = await db.execute(
        select(Order).where(Order.id == body.order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
    )
    order = order_q.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=400, detail="Order not found")
    courier_id = body.courier_id or order.courier_id
    if not courier_id:
        raise HTTPException(status_code=400, detail="No courier assigned to this order")

    for item in order.items:
        stock = await _ensure_stock(db, item.product_id)
        if stock.quantity < item.quantity:
            continue  # skip if not enough stock for this item
        stock.quantity -= item.quantity

        cw_q = await db.execute(
            select(CourierWater).where(
                and_(CourierWater.courier_id == courier_id, CourierWater.product_id == item.product_id)
            )
        )
        cw = cw_q.scalar_one_or_none()
        if not cw:
            cw = CourierWater(courier_id=courier_id, product_id=item.product_id, quantity=0, issued_today=0)
            db.add(cw)
        cw.quantity += item.quantity
        cw.issued_today += item.quantity

        db.add(WaterTransaction(
            product_id=item.product_id,
            courier_id=courier_id,
            order_id=body.order_id,
            transaction_type="issue",
            quantity=item.quantity,
            note=f"Auto-issue for order #{body.order_id}",
        ))
    await db.commit()
    return {"ok": True}


# ─── Return from courier ──────────────────────────────────────────────────────

class ReturnBody(BaseModel):
    courier_id: int
    product_id: int | None = None
    product_name: str | None = None
    quantity: int
    note: str | None = None


@router.post("/return")
async def return_from_courier(body: ReturnBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    product = await _resolve_product(db, body.product_id, body.product_name)
    stock = await _ensure_stock(db, product.id)
    stock.quantity += body.quantity

    cw_q = await db.execute(
        select(CourierWater).where(
            and_(CourierWater.courier_id == body.courier_id, CourierWater.product_id == product.id)
        )
    )
    cw = cw_q.scalar_one_or_none()
    if cw:
        cw.quantity = max(0, cw.quantity - body.quantity)

    db.add(WaterTransaction(
        product_id=product.id,
        courier_id=body.courier_id,
        transaction_type="return",
        quantity=body.quantity,
        note=body.note,
    ))
    await db.commit()
    return {"ok": True, "new_stock": stock.quantity}


# ─── Adjust stock ─────────────────────────────────────────────────────────────

class AdjustBody(BaseModel):
    product_id: int | None = None
    product_name: str | None = None
    quantity: int | None = None   # absolute new value (bot)
    delta: int | None = None      # relative change (frontend: positive = add, negative = remove)
    type: str | None = None       # accepted but unused
    note: str | None = None


@router.post("/stock/adjust")
async def adjust_stock(body: AdjustBody, db: AsyncSession = Depends(get_db)):
    if body.quantity is None and body.delta is None:
        raise HTTPException(status_code=400, detail="quantity or delta required")
    product = await _resolve_product(db, body.product_id, body.product_name)
    stock = await _ensure_stock(db, product.id)
    old = stock.quantity
    if body.delta is not None:
        new_qty = max(0, old + body.delta)
    else:
        new_qty = max(0, body.quantity)
    stock.quantity = new_qty
    diff = new_qty - old
    db.add(WaterTransaction(
        product_id=product.id,
        transaction_type="adjustment",
        quantity=diff,
        note=body.note or f"Manual adjustment: {old} → {new_qty}",
    ))
    await db.commit()
    return {"ok": True, "quantity": new_qty}


# ─── Couriers water inventory (enriched) ─────────────────────────────────────

@router.get("/couriers")
async def get_couriers_water(db: AsyncSession = Depends(get_db)):
    couriers_q = await db.execute(select(Courier).where(Courier.is_active == True))
    couriers = couriers_q.scalars().all()

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = []

    for c in couriers:
        # On-hand inventory with product names
        cw_q = await db.execute(
            select(CourierWater, Product)
            .join(Product, CourierWater.product_id == Product.id)
            .where(CourierWater.courier_id == c.id)
        )
        water_dict: dict[str, int] = {}
        on_hand_total = 0
        for cw, prod in cw_q.all():
            short = _short_name(prod.volume, prod.type)
            water_dict[short] = water_dict.get(short, 0) + cw.quantity
            on_hand_total += cw.quantity

        # Active orders with items
        act_q = await db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.product),
                selectinload(Order.user),
            )
            .where(Order.courier_id == c.id)
            .where(Order.status.in_(_ACTIVE_STATUSES))
        )
        active_orders = act_q.scalars().all()

        # Which orders already have water issued?
        issued_order_ids: set[int] = set()
        if active_orders:
            oid_list = [o.id for o in active_orders]
            tx_q = await db.execute(
                select(WaterTransaction.order_id).distinct()
                .where(WaterTransaction.order_id.in_(oid_list))
                .where(WaterTransaction.transaction_type == "issue")
            )
            issued_order_ids = {row[0] for row in tx_q.all()}

        active_list = []
        to_pickup: dict[str, int] = {}
        bottles_must_return = 0
        for o in active_orders:
            order_items = []
            for item in o.items:
                short = _short_name(item.product.volume, item.product.type)
                key = _product_key(item.product.volume, item.product.type)
                order_items.append({
                    "product_id": item.product_id,
                    "product_name": short,
                    "short_name": short,
                    "key": key,
                    "quantity": item.quantity,
                })
                to_pickup[short] = to_pickup.get(short, 0) + item.quantity
            active_list.append({
                "id": o.id,
                "status": o.status.value,
                "address": o.address,
                "client_name": o.user.name if o.user else "",
                "delivery_date": o.delivery_time or "",
                "delivery_period": "",
                "total": float(o.total),
                "water_issued": o.id in issued_order_ids,
                "return_bottles_count": o.return_bottles_count,
                "items": order_items,
            })
            bottles_must_return += o.return_bottles_count

        # Delivered today
        del_q = await db.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.product))
            .where(Order.courier_id == c.id)
            .where(Order.status == OrderStatus.DELIVERED)
            .where(Order.created_at >= today)
        )
        delivered_today = del_q.scalars().all()
        delivered_products: dict[str, int] = {}
        bottles_returned_today = sum(o.return_bottles_count for o in delivered_today)
        for o in delivered_today:
            for item in o.items:
                short = _short_name(item.product.volume, item.product.type)
                delivered_products[short] = delivered_products.get(short, 0) + item.quantity

        # Today's transactions for issued/returned counts
        tx_q = await db.execute(
            select(WaterTransaction)
            .where(WaterTransaction.courier_id == c.id)
            .where(WaterTransaction.created_at >= today)
        )
        issued_today_count = 0
        returned_today_count = 0
        for tx in tx_q.scalars().all():
            if tx.transaction_type == "issue":
                issued_today_count += tx.quantity
            elif tx.transaction_type == "return":
                returned_today_count += tx.quantity

        result.append({
            "id": c.id,
            "courier_id": c.id,
            "name": c.name,
            "courier_name": c.name,
            "telegram_id": c.telegram_id,
            "on_hand": on_hand_total,
            "issued_today": issued_today_count,
            "returned_today": returned_today_count,
            "active_orders": active_list,
            "delivered_today": delivered_products,
            "to_pickup": to_pickup,
            "water": water_dict,
            "bottles_must_return": bottles_must_return,
            "bottles_returned_today": bottles_returned_today,
            # Keep legacy format for bot compatibility
            "active_orders_count": len(active_orders),
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
    q = (
        select(WaterTransaction)
        .options(
            selectinload(WaterTransaction.product),
            selectinload(WaterTransaction.courier),
        )
        .order_by(WaterTransaction.created_at.desc())
    )
    if tx_type:
        q = q.where(WaterTransaction.transaction_type == tx_type)
    if product_id:
        q = q.where(WaterTransaction.product_id == product_id)
    if courier_id:
        q = q.where(WaterTransaction.courier_id == courier_id)
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    txs = result.scalars().all()
    return [
        {
            **_tx_out(tx),
            "courier_name": tx.courier.name if tx.courier else None,
        }
        for tx in txs
    ]


# ─── Production plan ─────────────────────────────────────────────────────────

@router.get("/production_plan")
async def get_production_plan(db: AsyncSession = Depends(get_db)):
    from app.models.client_data import Subscription
    subs_q = await db.execute(select(Subscription).where(Subscription.status == "active"))
    subs = subs_q.scalars().all()
    return {
        "active_subscriptions": len(subs),
        "weekly": len([s for s in subs if s.plan == "weekly"]),
        "monthly": len([s for s in subs if s.plan == "monthly"]),
    }


# ─── Subscriptions (period-aware) ────────────────────────────────────────────

_DAYS_RU = {0: "Понедельник", 1: "Вторник", 2: "Среда", 3: "Четверг", 4: "Пятница", 5: "Суббота", 6: "Воскресенье"}


@router.get("/subscriptions")
async def get_warehouse_subscriptions(
    period: str = "today",
    date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from app.models.client_data import Subscription

    today = datetime.utcnow()
    if period == "today":
        targets = [today]
    elif period == "tomorrow":
        targets = [today + timedelta(days=1)]
    elif period == "yesterday":
        targets = [today - timedelta(days=1)]
    elif period == "week":
        targets = [today + timedelta(days=i) for i in range(7)]
    elif period == "custom" and date:
        try:
            targets = [datetime.fromisoformat(date.split("T")[0])]
        except Exception:
            targets = [today]
    else:
        targets = [today + timedelta(days=i) for i in range(30)]

    target_days = {_DAYS_RU[d.weekday()] for d in targets}

    subs_q = await db.execute(select(Subscription).where(Subscription.status == "active"))
    subs = subs_q.scalars().all()
    return [
        {
            "id": s.id,
            "plan": s.plan,
            "water_summary": s.water_summary,
            "qty": s.qty,
            "day": s.day,
            "address": s.address,
        }
        for s in subs
        if not s.day or s.day in target_days
    ]


# ─── Warehouse staff management ───────────────────────────────────────────────

class StaffBody(BaseModel):
    telegram_id: int
    name: str = ""


@router.post("/staff")
async def add_warehouse_staff(body: StaffBody, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(WarehouseStaff).where(WarehouseStaff.telegram_id == body.telegram_id)
    )).scalar_one_or_none()
    if existing:
        existing.is_active = True
        existing.name = body.name or existing.name
    else:
        db.add(WarehouseStaff(telegram_id=body.telegram_id, name=body.name, is_active=True))
    await db.commit()
    return {"ok": True}


@router.delete("/staff/{telegram_id}")
async def remove_warehouse_staff(telegram_id: int, db: AsyncSession = Depends(get_db)):
    staff = (await db.execute(
        select(WarehouseStaff).where(WarehouseStaff.telegram_id == telegram_id)
    )).scalar_one_or_none()
    if staff:
        staff.is_active = False
        await db.commit()
    return {"ok": True}


@router.get("/staff")
async def list_warehouse_staff(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(WarehouseStaff).where(WarehouseStaff.is_active == True)
    )).scalars().all()
    return [{"telegram_id": r.telegram_id, "name": r.name} for r in rows]
