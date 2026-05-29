"""Warehouse management: stock tracking, production, issue, returns."""
import uuid
from datetime import datetime, timedelta, timezone
import json as _json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, and_, func, or_, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from io import BytesIO

from app.database import get_db
from app.models.warehouse import WaterStock, WaterTransaction, CourierWater, WarehouseStaff, CancelledBatch, BottleDebtAdjustment
from app.models.user import User
from app.models.factory import Factory
from app.models.courier import Courier
from app.models.order import Order, OrderStatus, OrderItem
from app.models.product import Product
from app.config import settings as app_settings
from app.services.invoice import generate_invoice_png
from app.services.settings_service import is_subscriptions_enabled
from app.services import bottle_debt
from sqlalchemy import update as sa_update
from app.services.tg_notify import tg_send_photo

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


_TZ_UZB = timezone(timedelta(hours=5))


def _tx_out(tx: WaterTransaction) -> dict:
    return {
        "id": tx.id,
        "product_id": tx.product_id,
        "product_name": tx.product.name if tx.product else None,
        "courier_id": tx.courier_id,
        "factory_id": tx.factory_id,
        "factory_name": tx.factory.name if tx.factory else None,
        "order_id": tx.order_id,
        "type": tx.transaction_type,
        "quantity": tx.quantity,
        "note": tx.note,
        "batch_id": tx.batch_id,
        "performed_by": tx.performed_by,
        "performed_by_role": tx.performed_by_role,
        "created_at": tx.created_at.isoformat() + "Z",
        "price": float(tx.product.price) if tx.product and tx.product.price else None,
        "cost_price": float(tx.product.cost_price) if tx.product and tx.product.cost_price else None,
    }


async def _ensure_stock(db: AsyncSession, product_id: int) -> WaterStock:
    result = await db.execute(select(WaterStock).where(WaterStock.product_id == product_id))
    stock = result.scalar_one_or_none()
    if not stock:
        stock = WaterStock(product_id=product_id, quantity=0)
        db.add(stock)
        await db.flush()
    return stock


async def _recalculate_stock(db: AsyncSession, product_id: int) -> None:
    """Recompute WaterStock.quantity from all WaterTransaction records for a product.
    Used after backdated entries so the current balance stays accurate.
    Inflow types: factory_issue, production, adjustment (positive).
    Outflow types: issue, factory_return (negative).
    """
    inflow_q = await db.execute(
        select(func.coalesce(func.sum(WaterTransaction.quantity), 0))
        .where(
            WaterTransaction.product_id == product_id,
            WaterTransaction.transaction_type.in_(["factory_issue", "production", "adjustment"]),
        )
    )
    outflow_q = await db.execute(
        select(func.coalesce(func.sum(WaterTransaction.quantity), 0))
        .where(
            WaterTransaction.product_id == product_id,
            WaterTransaction.transaction_type.in_(["issue", "factory_return"]),
        )
    )
    new_qty = int(inflow_q.scalar() or 0) - int(outflow_q.scalar() or 0)
    stock = await _ensure_stock(db, product_id)
    stock.quantity = new_qty


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


def _period_range(period: str, date_str: str | None, time_from: str | None, time_to: str | None, date_to_str: str | None = None):
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
        s = d
        e = end_of(d)
        if date_to_str:
            try:
                d_end = datetime.fromisoformat(date_to_str.split("T")[0]).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                e = end_of(d_end)
            except Exception:
                pass
        else:
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
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    since, until = _period_range(period, date, time_from, time_to, date_to)

    # All active products → seed per-product map
    products_q = await db.execute(select(Product).where(Product.is_active == True))
    products = products_q.scalars().all()
    per_product: dict[int, dict] = {}
    for p in products:
        per_product[p.id] = {
            "key": _product_key(p.volume, p.type),
            "product_id": p.id,
            "product_name": p.name,
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
            "factory_period": 0,
        }

    # Current stock
    for s in (await db.execute(select(WaterStock))).scalars().all():
        if s.product_id in per_product:
            per_product[s.product_id]["stock"] = s.quantity

    # On-hand with couriers
    for cw in (await db.execute(select(CourierWater))).scalars().all():
        if cw.product_id in per_product:
            per_product[cw.product_id]["on_couriers"] += cw.quantity

    # Bottle debt — single source of truth (totals == sum of per-entity cards)
    _debt = await bottle_debt.debt_totals(db)
    bottles_on_couriers = _debt["couriers"]
    bottles_on_factories = _debt["factories"]

    # Factory name lookup for the period breakdown
    factories_all = (await db.execute(select(Factory))).scalars().all()
    factory_names = {f.id: f.name for f in factories_all}
    factory_agg: dict[int, dict] = {}

    # Transactions in period (skip "tomorrow" — nothing produced yet)
    bottle_returns_period = 0
    factory_returns_period = 0
    if period != "tomorrow":
        tx_q = await db.execute(
            select(WaterTransaction).where(
                and_(WaterTransaction.created_at >= since, WaterTransaction.created_at <= until)
            )
        )
        for tx in tx_q.scalars().all():
            t = tx.transaction_type
            if t == "bottle_return":
                bottle_returns_period += tx.quantity
            elif t == "factory_return":
                factory_returns_period += tx.quantity
            # Per-factory breakdown for the period
            if t in ("factory_issue", "factory_return") and tx.factory_id:
                fa = factory_agg.setdefault(
                    tx.factory_id,
                    {"id": tx.factory_id, "name": factory_names.get(tx.factory_id, "—"),
                     "items": {}, "issued_total": 0, "returned_total": 0}
                )
                pname = per_product.get(tx.product_id, {}).get("product_name", "—")
                if t == "factory_issue":
                    fa["items"][pname] = fa["items"].get(pname, 0) + tx.quantity
                    fa["issued_total"] += tx.quantity
                else:
                    fa["returned_total"] += tx.quantity
            if tx.product_id not in per_product:
                continue
            if t == "production":
                per_product[tx.product_id]["produced_period"] += tx.quantity
            elif t == "issue" and tx.batch_id:
                per_product[tx.product_id]["issued_period"] += tx.quantity
            elif t == "factory_issue":
                # Count factory issues in "issued" total and in their own bucket
                per_product[tx.product_id]["issued_period"] += tx.quantity
                per_product[tx.product_id]["factory_period"] += tx.quantity
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
    factories_list = [
        {
            "id": fa["id"],
            "name": fa["name"],
            "issued_total": fa["issued_total"],
            "returned_total": fa["returned_total"],
            "items": [{"product_name": n, "qty": q} for n, q in fa["items"].items()],
        }
        for fa in factory_agg.values()
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
        "factory_period":      sum(p["factory_period"] for p in products_list),
        "shortfall":           sum(p["shortfall"] for p in products_list),
        "needed_orders":       needed_orders,
        "delivered_orders":    delivered_count,
        "bottles_returned_period": bottles_returned_period,
        "bottle_returns_period":   bottle_returns_period,
        "factory_returns_period":  factory_returns_period,
        "bottles_on_couriers": bottles_on_couriers,
        "bottles_on_factories": bottles_on_factories,
        "bottles_owed_total":  0,
    }
    return {"products": products_list, "totals": totals, "shortfall_items": shortfall_items,
            "factories": factories_list, "period": period}


# ─── Production ───────────────────────────────────────────────────────────────

def _note_with_actor(note: str | None, performed_by: str | None) -> str | None:
    """Prepend actor name to note if provided."""
    if performed_by:
        base = f"[{performed_by}]"
        return f"{base} {note}" if note else base
    return note


class ProductionBody(BaseModel):
    product_id: int | None = None
    product_name: str | None = None
    quantity: int
    note: str | None = None
    performed_by: str | None = None


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
        note=_note_with_actor(body.note, body.performed_by),
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
    performed_by: str | None = None
    vehicle_type: str | None = None
    vehicle_plate: str | None = None
    bottle_return: int = 0


async def _save_courier_vehicle(db: AsyncSession, courier_id: int,
                                 vtype: str | None, vplate: str | None) -> Courier | None:
    """Persist last-used vehicle info on the courier record (best-effort)."""
    if not (vtype or vplate):
        c_q = await db.execute(select(Courier).where(Courier.id == courier_id))
        return c_q.scalar_one_or_none()
    c_q = await db.execute(select(Courier).where(Courier.id == courier_id))
    c = c_q.scalar_one_or_none()
    if c:
        if vtype:
            c.vehicle_type = vtype
        if vplate:
            c.vehicle_plate = vplate
    return c


async def _send_invoice_to_admins(png: bytes, courier, items_summary: list[dict],
                                    batch_id: str, performed_by: str | None,
                                    db: AsyncSession | None = None,
                                    invoice_phone: str | None = None):
    """Send invoice PNG to the invoice group and persist the message_id for future deletion."""
    from app.services.tg_notify import tg_send_photo
    group_id = app_settings.INVOICE_GROUP_ID
    if not group_id or not png:
        return
    try:
        msg_id = await tg_send_photo(group_id, png, caption=None,
                                     filename=f"nakladnaya_{batch_id[:8]}.png")
        if msg_id and db:
            await db.execute(
                sa_update(WaterTransaction)
                .where(WaterTransaction.batch_id == batch_id)
                .values(invoice_message_id=msg_id)
            )
            await db.commit()
    except Exception:
        pass


async def _build_invoice_for_batch(db: AsyncSession, batch_id: str) -> tuple[bytes, Courier, list[dict]]:
    """Reconstruct the invoice PNG from stored transactions sharing batch_id.
    Supports both courier (issue/bottle_return) and factory (factory_issue) batches."""
    tx_q = await db.execute(
        select(WaterTransaction)
        .options(selectinload(WaterTransaction.product),
                 selectinload(WaterTransaction.courier),
                 selectinload(WaterTransaction.factory))
        .where(WaterTransaction.batch_id == batch_id)
        .order_by(WaterTransaction.id)
    )
    txs = tx_q.scalars().all()
    if not txs:
        raise HTTPException(404, "Накладная не найдена")
    courier = next((t.courier for t in txs if t.courier), None)
    factory = next((t.factory for t in txs if t.factory), None)
    is_factory_batch = any(t.transaction_type == "factory_issue" for t in txs)
    if not courier and not factory and not is_factory_batch:
        raise HTTPException(404, "Курьер не найден для накладной")

    # Aggregate same-product transactions defensively
    bottle_return_qty = 0
    by_product: dict[int, dict] = {}
    for t in txs:
        if t.transaction_type == "bottle_return":
            bottle_return_qty += int(t.quantity or 0)
            continue
        if t.transaction_type not in ("issue", "factory_issue") or not t.product:
            continue
        key = t.product_id
        price = float(t.product.price or 0)
        if key not in by_product:
            by_product[key] = {
                "name":  t.product.name,
                "unit":  "Шт",
                "qty":   0,
                "bonus": 0,
                "price": price,
                "sum":   0,
            }
        by_product[key]["qty"] += int(t.quantity or 0)
        by_product[key]["sum"] += int(t.quantity or 0) * price

    items = []
    if bottle_return_qty > 0:
        items.append({"name": "Возврат бутылок", "unit": "Шт", "qty": bottle_return_qty, "is_return": True})
    items.extend(by_product.values())

    # For courier batches: always show Вода 10л and Вода 5л even when qty = 0
    if not is_factory_batch:
        for _show_vol in (10.0, 5.0):
            _wq = await db.execute(
                select(Product)
                .where(and_(Product.volume >= _show_vol - 1.5,
                            Product.volume <= _show_vol + 1.5,
                            Product.is_active == True))
                .limit(1)
            )
            _wp = _wq.scalar_one_or_none()
            if _wp and _wp.id not in by_product:
                items.append({
                    "name": _wp.name, "unit": "Шт",
                    "qty": 0, "bonus": 0,
                    "price": float(_wp.price or 0), "sum": 0,
                })

    recipient_name = (courier.name if courier else None) or (factory.name if factory else "Завод")
    recipient_phone = courier.phone if courier else None
    recipient_vt = courier.vehicle_type if courier else None
    recipient_vp = courier.vehicle_plate if courier else None

    when = txs[0].created_at if txs else datetime.now()
    png = generate_invoice_png(
        items=items,
        courier_name=recipient_name,
        courier_phone=recipient_phone,
        vehicle_type=recipient_vt,
        vehicle_plate=recipient_vp,
        when=when,
    )
    return png, courier, items


@router.post("/issue")
async def issue_to_courier(body: IssueBody, db: AsyncSession = Depends(get_db)):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be positive")
    product = await _resolve_product(db, body.product_id, body.product_name)
    stock = await _ensure_stock(db, product.id)
    stock.quantity -= body.quantity  # allow negative (over-issue tracking)

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

    batch_id = str(uuid.uuid4())
    db.add(WaterTransaction(
        product_id=product.id,
        courier_id=body.courier_id,
        order_id=body.order_id,
        transaction_type="issue",
        quantity=body.quantity,
        note=_note_with_actor(body.note, body.performed_by),
        batch_id=batch_id,
    ))
    bottle_return_qty = max(0, body.bottle_return or 0)
    if bottle_return_qty > 0:
        prod_19l_ids = [r[0] for r in (await db.execute(
            select(Product.id).where(Product.volume >= 18.9)
        )).all()]
        c_issued = (await db.execute(
            select(func.sum(WaterTransaction.quantity))
            .where(WaterTransaction.courier_id == body.courier_id,
                   WaterTransaction.transaction_type == "issue",
                   WaterTransaction.batch_id.isnot(None),
                   WaterTransaction.product_id.in_(prod_19l_ids) if prod_19l_ids else False)
        )).scalar() or 0
        c_returned = (await db.execute(
            select(func.sum(WaterTransaction.quantity))
            .where(WaterTransaction.courier_id == body.courier_id,
                   WaterTransaction.transaction_type == "bottle_return",
                   WaterTransaction.counts_for_debt != False)
        )).scalar() or 0
        # Single-product issue: current batch contributes body.quantity if product is 19L
        _cur_19l = body.quantity if product.volume >= 18.9 else 0
        is_first_transaction = (c_issued - _cur_19l == 0 and c_returned == 0)
        if is_first_transaction:
            debt_after = max(0, c_issued - c_returned)
        else:
            debt_after = max(0, c_issued - c_returned - bottle_return_qty)
        db.add(WaterTransaction(
            product_id=None,
            courier_id=body.courier_id,
            order_id=None,
            transaction_type="bottle_return",
            quantity=bottle_return_qty,
            note=f"Остаток долга: {debt_after} бут.",
            batch_id=batch_id,
            counts_for_debt=not is_first_transaction,
        ))
    courier = await _save_courier_vehicle(db, body.courier_id, body.vehicle_type, body.vehicle_plate)
    await db.commit()

    # Generate invoice + send to admins (best-effort, post-commit)
    if courier:
        items = []
        if bottle_return_qty > 0:
            items.append({
                "name": "Возврат бутылок",
                "unit": "Шт",
                "qty":  bottle_return_qty,
                "is_return": True,
            })
        items.append({
            "name":  product.name,
            "unit":  "Шт",
            "qty":   body.quantity,
            "bonus": 0,
            "price": float(product.price or 0),
            "sum":   body.quantity * float(product.price or 0),
        })
        try:
            png = generate_invoice_png(
                items=items,
                courier_name=courier.name,
                courier_phone=courier.phone,
                vehicle_type=courier.vehicle_type,
                vehicle_plate=courier.vehicle_plate,
                when=datetime.now(),
            )
            await _send_invoice_to_admins(png, courier, items, batch_id, body.performed_by, db)
        except Exception:
            pass

    return {"ok": True, "new_stock": stock.quantity, "batch_id": batch_id}


# ── Multi-product batch issue (главная операция «Доп. выдача») ────────────────

class BatchIssueItem(BaseModel):
    product_id: int | None = None
    product_name: str | None = None
    quantity: int


class BatchIssueBody(BaseModel):
    courier_id: int
    items: list[BatchIssueItem] = []
    note: str | None = None
    performed_by: str | None = None
    performed_by_role: str | None = None
    vehicle_type: str | None = None
    vehicle_plate: str | None = None
    bottle_return: int = 0
    created_at: datetime | None = None  # for backdating (invoice nakl)
    invoice_phone: str | None = None    # phone from OCR invoice (may differ from DB)


@router.post("/issue_batch")
async def issue_batch(body: BatchIssueBody, db: AsyncSession = Depends(get_db)):
    """Issue several products to a courier in one transaction; produce one invoice."""
    bottle_return_qty = max(0, body.bottle_return or 0)
    if not body.items and bottle_return_qty == 0:
        raise HTTPException(400, "items is empty and no bottle return")

    # Resolve all products + validate stock up-front (atomic check)
    resolved: list[tuple[Product, int]] = []
    for it in body.items:
        if it.quantity <= 0:
            continue
        prod = await _resolve_product(db, it.product_id, it.product_name)
        stock = await _ensure_stock(db, prod.id)
        resolved.append((prod, it.quantity))  # allow negative stock (over-issue)
    if not resolved and bottle_return_qty == 0:
        raise HTTPException(400, "Все позиции имеют нулевое количество")

    batch_id = str(uuid.uuid4())
    invoice_items: list[dict] = []

    # Strip timezone so we store naive UTC in the timezone-naive DateTime column
    _ts: datetime | None = None
    if body.created_at:
        _ts = body.created_at.replace(tzinfo=None) if body.created_at.tzinfo else body.created_at

    for prod, qty in resolved:
        stock = await _ensure_stock(db, prod.id)
        stock.quantity -= qty

        cw_q = await db.execute(
            select(CourierWater).where(
                and_(CourierWater.courier_id == body.courier_id, CourierWater.product_id == prod.id)
            )
        )
        cw = cw_q.scalar_one_or_none()
        if not cw:
            cw = CourierWater(courier_id=body.courier_id, product_id=prod.id, quantity=0, issued_today=0)
            db.add(cw)
        cw.quantity += qty
        _is_today = (not _ts) or (_ts.date() == datetime.utcnow().date())
        if _is_today:
            cw.issued_today += qty

        tx = WaterTransaction(
            product_id=prod.id,
            courier_id=body.courier_id,
            order_id=None,
            transaction_type="issue",
            quantity=qty,
            note=_note_with_actor(body.note, body.performed_by),
            batch_id=batch_id,
            performed_by=body.performed_by,
            performed_by_role=body.performed_by_role,
        )
        if _ts:
            tx.created_at = _ts
        db.add(tx)
        price = float(prod.price or 0)
        invoice_items.append({
            "name":  prod.name,
            "unit":  "Шт",
            "qty":   qty,
            "bonus": 0,
            "price": price,
            "sum":   qty * price,
        })

    if bottle_return_qty > 0:
        prod_19l_ids = [r[0] for r in (await db.execute(
            select(Product.id).where(Product.volume >= 18.9)
        )).all()]
        c_issued = (await db.execute(
            select(func.sum(WaterTransaction.quantity))
            .where(WaterTransaction.courier_id == body.courier_id,
                   WaterTransaction.transaction_type == "issue",
                   WaterTransaction.batch_id.isnot(None),
                   WaterTransaction.product_id.in_(prod_19l_ids) if prod_19l_ids else False)
        )).scalar() or 0
        c_returned = (await db.execute(
            select(func.sum(WaterTransaction.quantity))
            .where(WaterTransaction.courier_id == body.courier_id,
                   WaterTransaction.transaction_type == "bottle_return",
                   WaterTransaction.counts_for_debt != False)
        )).scalar() or 0
        # On the courier's very first transaction the return does not reduce debt
        current_batch_19l = sum(qty for prod, qty in resolved if prod.volume >= 18.9)
        is_first_transaction = (c_issued - current_batch_19l == 0 and c_returned == 0)
        if is_first_transaction:
            debt_after = max(0, c_issued - c_returned)
        else:
            debt_after = max(0, c_issued - c_returned - bottle_return_qty)
        ret_tx = WaterTransaction(
            counts_for_debt=not is_first_transaction,
            product_id=None,
            courier_id=body.courier_id,
            order_id=None,
            transaction_type="bottle_return",
            quantity=bottle_return_qty,
            note=f"Остаток долга: {debt_after} бут.",
            batch_id=batch_id,
            performed_by=body.performed_by,
            performed_by_role=body.performed_by_role,
        )
        if _ts:
            ret_tx.created_at = _ts
        db.add(ret_tx)

    # Always include bottle return row (even when 0) so the invoice always shows it
    invoice_items.insert(0, {
        "name": "Возврат бутылок",
        "unit": "Шт",
        "qty":  bottle_return_qty,
        "is_return": True,
    })

    # Always show Вода 10л and Вода 5л even when qty = 0
    _issued_ids = {prod.id for prod, _ in resolved}
    for _show_vol in (10.0, 5.0):
        _wq = await db.execute(
            select(Product)
            .where(and_(Product.volume >= _show_vol - 1.5,
                        Product.volume <= _show_vol + 1.5,
                        Product.is_active == True))
            .limit(1)
        )
        _wp = _wq.scalar_one_or_none()
        if _wp and _wp.id not in _issued_ids:
            invoice_items.append({
                "name": _wp.name, "unit": "Шт",
                "qty": 0, "bonus": 0,
                "price": float(_wp.price or 0), "sum": 0,
            })

    courier = await _save_courier_vehicle(db, body.courier_id, body.vehicle_type, body.vehicle_plate)

    # If backdated, recalculate current stock from all transactions so the balance stays accurate
    if _ts:
        for prod, _ in resolved:
            await _recalculate_stock(db, prod.id)

    await db.commit()

    if courier:
        try:
            # Display time in UTC+5 (Tashkent)
            _when_utc = _ts or datetime.utcnow()
            _when = _when_utc + timedelta(hours=5)
            _display_phone = body.invoice_phone or courier.phone
            png = generate_invoice_png(
                items=invoice_items,
                courier_name=courier.name,
                courier_phone=_display_phone,
                vehicle_type=courier.vehicle_type,
                vehicle_plate=courier.vehicle_plate,
                when=_when,
            )
            await _send_invoice_to_admins(png, courier, invoice_items, batch_id, body.performed_by, db,
                                          invoice_phone=_display_phone)
        except Exception:
            pass

    return {"ok": True, "batch_id": batch_id}


# ─── Factories CRUD ───────────────────────────────────────────────────────────

@router.get("/couriers/list")
async def list_all_couriers(db: AsyncSession = Depends(get_db)):
    """All active couriers including warehouse-only — for warehouse UI dropdowns."""
    rows = (await db.execute(
        select(Courier).where(Courier.is_active == True).order_by(Courier.name)
    )).scalars().all()
    return [
        {"id": c.id, "name": c.name, "phone": c.phone,
         "vehicle_type": c.vehicle_type, "vehicle_plate": c.vehicle_plate,
         "warehouse_only": c.warehouse_only}
        for c in rows
    ]


@router.get("/factories")
async def list_factories(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Factory).order_by(Factory.name))).scalars().all()
    return [{"id": f.id, "name": f.name, "is_active": f.is_active, "category": f.category} for f in rows]


class FactoryBody(BaseModel):
    name: str
    is_active: bool = True
    category: str | None = None


@router.post("/factories")
async def create_factory(body: FactoryBody, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(Factory).where(Factory.name == body.name)
    )).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "name": existing.name, "is_active": existing.is_active, "category": existing.category}
    f = Factory(name=body.name, is_active=body.is_active, category=body.category)
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return {"id": f.id, "name": f.name, "is_active": f.is_active, "category": f.category}


@router.delete("/factories/{factory_id}")
async def delete_factory(factory_id: int, db: AsyncSession = Depends(get_db)):
    f = (await db.execute(select(Factory).where(Factory.id == factory_id))).scalar_one_or_none()
    if f:
        await db.delete(f)
        await db.commit()
    return {"ok": True}


# ─── Factory issue batch ──────────────────────────────────────────────────────

class FactoryIssueItem(BaseModel):
    product_id: int | None = None
    product_name: str | None = None
    quantity: int


class FactoryIssueBatchBody(BaseModel):
    factory_id: int | None = None
    factory_name: str | None = None
    items: list[FactoryIssueItem] = []
    note: str | None = None
    performed_by: str | None = None
    performed_by_role: str | None = None
    created_at: datetime | None = None


@router.post("/factory_issue_batch")
async def factory_issue_batch(body: FactoryIssueBatchBody, db: AsyncSession = Depends(get_db)):
    """Issue water to a factory (no courier tracking, no bottle debt)."""
    if not body.items:
        raise HTTPException(400, "items is empty")

    # Resolve or create factory
    factory: Factory | None = None
    if body.factory_id:
        factory = (await db.execute(select(Factory).where(Factory.id == body.factory_id))).scalar_one_or_none()
    if not factory and body.factory_name:
        factory = (await db.execute(
            select(Factory).where(Factory.name == body.factory_name)
        )).scalar_one_or_none()
        if not factory:
            factory = Factory(name=body.factory_name)
            db.add(factory)
            await db.flush()
    if not factory:
        raise HTTPException(400, "factory_id or factory_name required")

    resolved: list[tuple[Product, int]] = []
    for it in body.items:
        if it.quantity <= 0:
            continue
        prod = await _resolve_product(db, it.product_id, it.product_name)
        resolved.append((prod, it.quantity))
    if not resolved:
        raise HTTPException(400, "All items have zero quantity")

    batch_id = str(uuid.uuid4())
    _ts: datetime | None = None
    if body.created_at:
        _ts = body.created_at.replace(tzinfo=None) if body.created_at.tzinfo else body.created_at

    invoice_items: list[dict] = []
    for prod, qty in resolved:
        stock = await _ensure_stock(db, prod.id)
        stock.quantity -= qty

        tx = WaterTransaction(
            product_id=prod.id,
            factory_id=factory.id,
            courier_id=None,
            order_id=None,
            transaction_type="factory_issue",
            quantity=qty,
            note=_note_with_actor(body.note, body.performed_by),
            batch_id=batch_id,
            performed_by=body.performed_by,
            performed_by_role=body.performed_by_role,
        )
        if _ts:
            tx.created_at = _ts
        db.add(tx)
        price = float(prod.price or 0)
        invoice_items.append({
            "name": prod.name, "unit": "Шт", "qty": qty,
            "bonus": 0, "price": price, "sum": qty * price,
        })

    if _ts:
        for prod, _ in resolved:
            await _recalculate_stock(db, prod.id)

    await db.commit()

    # Generate and send invoice PNG to admins
    try:
        _when_utc = _ts or datetime.utcnow()
        _when = _when_utc + timedelta(hours=5)
        png = generate_invoice_png(
            items=invoice_items,
            courier_name=factory.name,
            courier_phone=None,
            vehicle_type=None,
            vehicle_plate=None,
            when=_when,
        )
        await _send_invoice_to_admins(png, factory, invoice_items, batch_id, body.performed_by, db)
    except Exception:
        pass

    return {"ok": True, "batch_id": batch_id, "factory_id": factory.id}


@router.post("/factory_return_batch")
async def factory_return_batch(body: FactoryIssueBatchBody, db: AsyncSession = Depends(get_db)):
    """Return water/bottles from a factory back to the warehouse (restores stock)."""
    if not body.items:
        raise HTTPException(400, "items is empty")

    factory: Factory | None = None
    if body.factory_id:
        factory = (await db.execute(select(Factory).where(Factory.id == body.factory_id))).scalar_one_or_none()
    if not factory and body.factory_name:
        factory = (await db.execute(
            select(Factory).where(Factory.name == body.factory_name)
        )).scalar_one_or_none()
    if not factory:
        raise HTTPException(400, "factory_id or factory_name required")

    resolved: list[tuple[Product, int]] = []
    for it in body.items:
        if it.quantity <= 0:
            continue
        prod = await _resolve_product(db, it.product_id, it.product_name)
        resolved.append((prod, it.quantity))
    if not resolved:
        raise HTTPException(400, "All items have zero quantity")

    batch_id = str(uuid.uuid4())
    _ts: datetime | None = None
    if body.created_at:
        _ts = body.created_at.replace(tzinfo=None) if body.created_at.tzinfo else body.created_at

    for prod, qty in resolved:
        stock = await _ensure_stock(db, prod.id)
        stock.quantity += qty
        tx = WaterTransaction(
            product_id=prod.id,
            factory_id=factory.id,
            courier_id=None,
            order_id=None,
            transaction_type="factory_return",
            quantity=qty,
            note=_note_with_actor(body.note, body.performed_by),
            batch_id=batch_id,
            performed_by=body.performed_by,
        )
        if _ts:
            tx.created_at = _ts
        db.add(tx)

    if _ts:
        for prod, _ in resolved:
            await _recalculate_stock(db, prod.id)

    await db.commit()

    # Generate and send invoice PNG to admins
    try:
        _when_utc = _ts or datetime.utcnow()
        _when = _when_utc + timedelta(hours=5)
        invoice_items = [
            {"name": prod.name, "unit": "Шт", "qty": qty, "is_return": True, "bonus": 0, "price": 0, "sum": 0}
            for prod, qty in resolved
        ]
        png = generate_invoice_png(
            items=invoice_items,
            courier_name=factory.name,
            courier_phone=None,
            vehicle_type=None,
            vehicle_plate=None,
            when=_when,
        )
        await _send_invoice_to_admins(png, factory, invoice_items, batch_id, body.performed_by, db)
    except Exception:
        pass

    return {"ok": True, "batch_id": batch_id, "factory_id": factory.id}


@router.get("/factory_stats")
async def factory_stats(
    period: str = "today",
    date: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Per-factory transaction breakdown for the period (for warehouse/admin cards)."""
    since, until = _period_range(period, date, None, None, date_to)

    factories = (await db.execute(select(Factory).order_by(Factory.name))).scalars().all()
    if not factories:
        return []

    # Bottle debt — single source of truth (includes factory adjustments)
    factory_debt = await bottle_debt.factory_debt_map(db)

    result = []
    for f in factories:
        # Period transactions joined with product for breakdown
        tx_q = await db.execute(
            select(WaterTransaction, Product)
            .outerjoin(Product, WaterTransaction.product_id == Product.id)
            .where(WaterTransaction.factory_id == f.id)
            .where(WaterTransaction.created_at >= since)
            .where(WaterTransaction.created_at <= until)
        )
        issued: dict[str, int] = {}
        returned_total = 0
        issued_total = 0
        issued_sum = 0.0
        for tx, prod in tx_q.all():
            short = _short_name(prod.volume, prod.type) if prod else "—"
            if tx.transaction_type == "factory_issue":
                issued[short] = issued.get(short, 0) + tx.quantity
                issued_total += tx.quantity
                issued_sum += tx.quantity * float(prod.price or 0) if prod else 0
            elif tx.transaction_type == "factory_return":
                returned_total += tx.quantity

        # All-time 19L bottle debt for the factory (single source of truth)
        bottles_must_return = factory_debt.get(f.id, 0)

        result.append({
            "id": f.id,
            "name": f.name,
            "category": f.category,
            "issued": issued,
            "issued_total": issued_total,
            "issued_sum": round(issued_sum, 2),
            "returned_total": returned_total,
            "bottles_must_return": bottles_must_return,
        })
    return result


class IssueOrderBody(BaseModel):
    order_id: int
    courier_id: int | None = None
    performed_by: str | None = None
    vehicle_type: str | None = None
    vehicle_plate: str | None = None


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

    batch_id = str(uuid.uuid4())
    invoice_items: list[dict] = []

    for item in order.items:
        stock = await _ensure_stock(db, item.product_id)
        stock.quantity -= item.quantity  # allow negative stock

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
            note=_note_with_actor(f"Заказ #{body.order_id}", body.performed_by),
            batch_id=batch_id,
        ))
        if item.product:
            price = float(item.product.price or 0)
            invoice_items.append({
                "name":  item.product.name,
                "unit":  "Шт",
                "qty":   item.quantity,
                "bonus": 0,
                "price": price,
                "sum":   item.quantity * price,
            })

    courier = await _save_courier_vehicle(db, courier_id, body.vehicle_type, body.vehicle_plate)
    await db.commit()

    if courier and invoice_items:
        try:
            png = generate_invoice_png(
                items=invoice_items,
                courier_name=courier.name,
                courier_phone=courier.phone,
                vehicle_type=courier.vehicle_type,
                vehicle_plate=courier.vehicle_plate,
                when=datetime.now(),
            )
            await _send_invoice_to_admins(png, courier, invoice_items, batch_id, body.performed_by, db)
        except Exception:
            pass

    return {"ok": True, "batch_id": batch_id if invoice_items else None}


# ─── Invoice download (mini-app) ──────────────────────────────────────────────

@router.get("/invoice/{batch_id}.png")
async def download_invoice(batch_id: str, db: AsyncSession = Depends(get_db)):
    """Render and stream the invoice PNG for a given batch_id."""
    png, _, _ = await _build_invoice_for_batch(db, batch_id)
    return StreamingResponse(
        BytesIO(png),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="invoice_{batch_id[:8]}.png"'},
    )


@router.get("/invoices")
async def list_invoices(
    limit: int = 50,
    offset: int = 0,
    courier_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List invoice batches (one row per batch_id) for the mini-app history."""
    q = (
        select(
            WaterTransaction.batch_id,
            WaterTransaction.courier_id,
            func.min(WaterTransaction.created_at).label("ts"),
            func.sum(WaterTransaction.quantity).label("qty_total"),
            func.count(WaterTransaction.id).label("lines"),
        )
        .where(WaterTransaction.batch_id.is_not(None))
        .where(WaterTransaction.transaction_type == "issue")
        .group_by(WaterTransaction.batch_id, WaterTransaction.courier_id)
        .order_by(func.min(WaterTransaction.created_at).desc())
        .limit(limit).offset(offset)
    )
    if courier_id:
        q = q.where(WaterTransaction.courier_id == courier_id)
    rows = (await db.execute(q)).all()
    if not rows:
        return []

    # Resolve courier names
    cids = list({r.courier_id for r in rows if r.courier_id})
    couriers = {}
    if cids:
        c_q = await db.execute(select(Courier).where(Courier.id.in_(cids)))
        couriers = {c.id: c for c in c_q.scalars().all()}

    return [{
        "batch_id":     r.batch_id,
        "courier_id":   r.courier_id,
        "courier_name": couriers.get(r.courier_id).name if couriers.get(r.courier_id) else None,
        "created_at":   r.ts.isoformat() if r.ts else None,
        "items_count":  r.lines,
        "qty_total":    r.qty_total,
    } for r in rows]


# ─── Return from courier ──────────────────────────────────────────────────────

class ReturnBody(BaseModel):
    courier_id: int
    product_id: int | None = None
    product_name: str | None = None
    quantity: int
    note: str | None = None
    performed_by: str | None = None


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
        note=_note_with_actor(body.note, body.performed_by),
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
    performed_by: str | None = None


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
        note=_note_with_actor(body.note or f"Manual adjustment: {old} → {new_qty}", body.performed_by),
    ))
    await db.commit()
    return {"ok": True, "quantity": new_qty}


# ─── Couriers water inventory (enriched) ─────────────────────────────────────

@router.get("/couriers")
async def get_couriers_water(
    period: str = "today",
    date: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    # Show active couriers + inactive ones that still have CourierWater inventory
    # (soft-deleted by admin/manager but warehouse still needs to track their bottle debt)
    active_or_has_inventory = or_(
        Courier.is_active == True,  # noqa: E712
        exists(select(CourierWater.courier_id).where(CourierWater.courier_id == Courier.id)),
    )
    couriers_q = await db.execute(select(Courier).where(active_or_has_inventory))
    couriers = couriers_q.scalars().all()

    period_start, period_end = _period_range(period, date, None, None, date_to)

    # Bottle debt — single source of truth (computed once for all couriers)
    debt_map = await bottle_debt.courier_debt_map(db)

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

        # Bottle debt — single source of truth (app.services.bottle_debt)
        bottles_must_return = debt_map.get(c.id, 0)

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
                .where(WaterTransaction.batch_id.isnot(None))
            )
            issued_order_ids = {row[0] for row in tx_q.all()}

        active_list = []
        to_pickup: dict[str, int] = {}
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

        # Delivered in period
        del_q = await db.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.product))
            .where(Order.courier_id == c.id)
            .where(Order.status == OrderStatus.DELIVERED)
            .where(Order.created_at >= period_start)
            .where(Order.created_at < period_end)
        )
        delivered_period = del_q.scalars().all()
        delivered_products: dict[str, int] = {}
        bottles_returned_today = sum(o.return_bottles_count for o in delivered_period)
        for o in delivered_period:
            for item in o.items:
                short = _short_name(item.product.volume, item.product.type)
                delivered_products[short] = delivered_products.get(short, 0) + item.quantity

        # Period transactions — join Product for per-product breakdown
        tx_q = await db.execute(
            select(WaterTransaction, Product)
            .outerjoin(Product, WaterTransaction.product_id == Product.id)
            .where(WaterTransaction.courier_id == c.id)
            .where(WaterTransaction.created_at >= period_start)
            .where(WaterTransaction.created_at < period_end)
        )
        issued_today_count = 0
        returned_today_count = 0
        bottles_returned_period = 0
        issued_products_period: dict[str, int] = {}
        for tx, prod in tx_q.all():
            if tx.transaction_type == "issue" and tx.batch_id:
                issued_today_count += tx.quantity
                if prod:
                    short = _short_name(prod.volume, prod.type)
                    issued_products_period[short] = issued_products_period.get(short, 0) + tx.quantity
            elif tx.transaction_type == "return":
                returned_today_count += tx.quantity
            elif tx.transaction_type == "bottle_return":
                bottles_returned_period += tx.quantity

        result.append({
            "id": c.id,
            "courier_id": c.id,
            "name": c.name,
            "courier_name": c.name,
            "phone": c.phone,
            "telegram_id": c.telegram_id,
            "vehicle_type": c.vehicle_type,
            "vehicle_plate": c.vehicle_plate,
            "on_hand": on_hand_total,
            "issued_today": issued_today_count,
            "returned_today": returned_today_count,
            "active_orders": active_list,
            "delivered_today": delivered_products,
            "to_pickup": to_pickup,
            "water": water_dict,
            "bottles_must_return": bottles_must_return,
            "bottles_returned_today": bottles_returned_period,
            "issued_products": issued_products_period,
            # Keep legacy format for bot compatibility
            "active_orders_count": len(active_orders),
        })
    return result


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    limit: int = 200,
    offset: int = 0,
    type: str | None = None,
    product: str | None = None,
    courier_id: int | None = None,
    factory_id: int | None = None,
    period: str = "all",
    date: str | None = None,
    time_from: str | None = None,
    time_to: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    since, until = _period_range(period, date, time_from, time_to, date_to)

    q = (
        select(WaterTransaction)
        .options(
            selectinload(WaterTransaction.product),
            selectinload(WaterTransaction.courier),
            selectinload(WaterTransaction.factory),
        )
        .order_by(WaterTransaction.created_at.desc())
    )

    if period != "all":
        q = q.where(WaterTransaction.created_at >= since)
        q = q.where(WaterTransaction.created_at <= until)

    if type and type != "all":
        q = q.where(WaterTransaction.transaction_type == type)
        # Never show unbatched auto-issue records regardless of filter
        if type == "issue":
            q = q.where(WaterTransaction.batch_id.isnot(None))
    else:
        # delivery_net is internal accounting — hide from default history view
        # Unbatched issue records are auto-created by order assignment, not real warehouse issuances
        q = q.where(WaterTransaction.transaction_type != "delivery_net")
        q = q.where(
            (WaterTransaction.transaction_type != "issue") | WaterTransaction.batch_id.isnot(None)
        )

    if product and product != "all":
        all_prods = (await db.execute(select(Product).where(Product.is_active == True))).scalars().all()
        matched_ids = [p.id for p in all_prods if _short_name(p.volume, p.type) == product or p.name == product]
        if not matched_ids:
            return []
        q = q.where(WaterTransaction.product_id.in_(matched_ids))

    if courier_id:
        q = q.where(WaterTransaction.courier_id == courier_id)

    if factory_id:
        q = q.where(WaterTransaction.factory_id == factory_id)

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    txs = result.scalars().all()
    return [
        {
            **_tx_out(tx),
            "courier_name": tx.courier.name if tx.courier else None,
            "factory_name": tx.factory.name if tx.factory else None,
        }
        for tx in txs
    ]


# ─── Production plan ─────────────────────────────────────────────────────────

@router.get("/production_plan")
async def get_production_plan(db: AsyncSession = Depends(get_db)):
    from app.models.client_data import Subscription
    if not await is_subscriptions_enabled(db):
        return {"active_subscriptions": 0, "weekly": 0, "monthly": 0}
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

    if not await is_subscriptions_enabled(db):
        return []
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


# ─── Batch cancellation (for warehouse bot "Отменить") ────────────────────────

@router.get("/issue_batches")
async def list_issue_batches(
    performed_by: str | None = None,
    include_factory: bool = True,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List distinct issue AND return batches (courier + factory), optionally filtered by performed_by."""
    tx_types = ["issue", "factory_issue"] if include_factory else ["issue"]
    q = (
        select(
            WaterTransaction.batch_id,
            WaterTransaction.courier_id,
            WaterTransaction.factory_id,
            WaterTransaction.created_at,
            WaterTransaction.performed_by,
            WaterTransaction.transaction_type,
        )
        .where(
            WaterTransaction.transaction_type.in_(tx_types),
            WaterTransaction.batch_id.isnot(None),
        )
        .order_by(WaterTransaction.created_at.desc())
    )
    if performed_by:
        q = q.where(WaterTransaction.performed_by == performed_by)
    rows = (await db.execute(q)).all()

    seen: set[str] = set()
    result = []

    async def _append_batch(row, tx_type: str):
        items_rows = (await db.execute(
            select(WaterTransaction, Product)
            .join(Product, WaterTransaction.product_id == Product.id, isouter=True)
            .where(
                WaterTransaction.batch_id == row.batch_id,
                WaterTransaction.transaction_type == tx_type,
            )
        )).all()
        total_sum = sum(
            (tx.quantity * float(p.price or 0)) if p else 0
            for tx, p in items_rows
        )
        courier = None
        if row.courier_id:
            courier = (await db.execute(
                select(Courier).where(Courier.id == row.courier_id)
            )).scalar_one_or_none()
        factory = None
        if row.factory_id:
            factory = (await db.execute(
                select(Factory).where(Factory.id == row.factory_id)
            )).scalar_one_or_none()
        batch_type_map = {
            "issue": "courier", "factory_issue": "factory",
            "bottle_return": "bottle_return", "factory_return": "factory_return",
        }
        if tx_type == "bottle_return":
            total_qty = sum(tx.quantity for tx, _ in items_rows)
            items = [{"product_name": "Возврат бутылок", "quantity": total_qty}]
        else:
            items = [{"product_name": p.name if p else "—", "quantity": tx.quantity} for tx, p in items_rows]
        recipient = courier.name if courier else (factory.name if factory else "—")
        result.append({
            "batch_id": row.batch_id,
            "batch_type": batch_type_map.get(tx_type, "courier"),
            "courier_id": row.courier_id,
            "courier_name": recipient,
            "factory_id": row.factory_id,
            "factory_name": factory.name if factory else None,
            "performed_by": row.performed_by,
            "created_at": row.created_at,
            "total_sum": round(total_sum),
            "items": items,
        })

    for row in rows:
        if row.batch_id in seen:
            continue
        seen.add(row.batch_id)
        await _append_batch(row, row.transaction_type)
        if len(result) >= limit:
            break

    # Also include standalone return batches (those not part of an issue batch)
    if len(result) < limit:
        for ret_type in ["bottle_return", "factory_return"]:
            ret_q = (
                select(
                    WaterTransaction.batch_id,
                    WaterTransaction.courier_id,
                    WaterTransaction.factory_id,
                    WaterTransaction.created_at,
                    WaterTransaction.performed_by,
                    WaterTransaction.transaction_type,
                )
                .where(
                    WaterTransaction.transaction_type == ret_type,
                    WaterTransaction.batch_id.isnot(None),
                )
                .order_by(WaterTransaction.created_at.desc())
            )
            if performed_by:
                ret_q = ret_q.where(WaterTransaction.performed_by == performed_by)
            if seen:
                ret_q = ret_q.where(WaterTransaction.batch_id.notin_(list(seen)))
            for row in (await db.execute(ret_q)).all():
                if row.batch_id in seen:
                    continue
                seen.add(row.batch_id)
                await _append_batch(row, ret_type)
                if len(result) >= limit:
                    break

    result.sort(key=lambda x: x["created_at"] or datetime.min, reverse=True)
    return result[:limit]


@router.delete("/issue_batch/{batch_id}")
async def cancel_issue_batch(batch_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Reverse an issue batch: restore warehouse stock, update courier water, delete transactions."""
    # Parse optional body for audit trail
    cancelled_by: str | None = None
    cancelled_by_role: str | None = None
    try:
        body = await request.json()
        cancelled_by = body.get("cancelled_by")
        cancelled_by_role = body.get("cancelled_by_role")
    except Exception:
        pass

    txs = (await db.execute(
        select(WaterTransaction)
        .options(selectinload(WaterTransaction.product), selectinload(WaterTransaction.courier), selectinload(WaterTransaction.factory))
        .where(WaterTransaction.batch_id == batch_id)
    )).scalars().all()
    if not txs:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Idempotency: if already cancelled, clean up any leftover transactions and return success
    existing_cancel = (await db.execute(
        select(CancelledBatch.id).where(CancelledBatch.batch_id == batch_id)
    )).scalar_one_or_none()
    if existing_cancel:
        for tx in txs:
            await db.delete(tx)
        if txs:
            await db.commit()
        return {"ok": True, "batch_id": batch_id}

    # Snapshot batch for audit trail before deleting
    issue_txs = [tx for tx in txs if tx.transaction_type in ("issue", "factory_issue")]
    first = issue_txs[0] if issue_txs else txs[0]
    items_snapshot = [
        {
            "product_name": tx.product.name if tx.product else None,
            "quantity": tx.quantity,
            "type": tx.transaction_type,
        }
        for tx in txs
    ]
    total_qty = sum(tx.quantity for tx in issue_txs) if issue_txs else sum(tx.quantity for tx in txs)
    invoice_msg_id = next((tx.invoice_message_id for tx in txs if tx.invoice_message_id), None)

    cancelled_batch = CancelledBatch(
        batch_id=batch_id,
        transaction_type=first.transaction_type,
        product_name=first.product.name if first.product else None,
        courier_name=first.courier.name if first.courier else None,
        factory_name=first.factory.name if first.factory else None,
        total_quantity=total_qty,
        items_json=_json.dumps(items_snapshot, ensure_ascii=False),
        performed_by=first.performed_by,
        performed_by_role=first.performed_by_role,
        cancelled_by=cancelled_by,
        cancelled_by_role=cancelled_by_role,
        invoice_message_id=invoice_msg_id,
        original_created_at=first.created_at,
    )
    db.add(cancelled_batch)

    for tx in txs:
        if tx.transaction_type == "issue":
            if tx.product_id:
                stock = await _ensure_stock(db, tx.product_id)
                stock.quantity += tx.quantity
            if tx.courier_id and tx.product_id:
                cw = (await db.execute(
                    select(CourierWater).where(
                        CourierWater.courier_id == tx.courier_id,
                        CourierWater.product_id == tx.product_id,
                    )
                )).scalar_one_or_none()
                if cw:
                    cw.quantity = max(0, cw.quantity - tx.quantity)
                    cw.issued_today = max(0, cw.issued_today - tx.quantity)
            await db.delete(tx)
        elif tx.transaction_type == "factory_issue" and tx.product_id:
            stock = await _ensure_stock(db, tx.product_id)
            stock.quantity += tx.quantity
            await db.delete(tx)
        elif tx.transaction_type == "bottle_return":
            await db.delete(tx)
        elif tx.transaction_type == "factory_return":
            # Reverse factory return: subtract the qty that was added back to warehouse stock
            if tx.product_id:
                stock = await _ensure_stock(db, tx.product_id)
                stock.quantity -= tx.quantity
            await db.delete(tx)

    await db.commit()

    # Delete the invoice message from the group (best-effort, after DB commit)
    if invoice_msg_id and app_settings.INVOICE_GROUP_ID:
        from app.services.tg_notify import tg_delete_message
        try:
            await tg_delete_message(app_settings.INVOICE_GROUP_ID, invoice_msg_id)
        except Exception:
            pass

    return {"ok": True, "batch_id": batch_id}


@router.get("/cancelled_batches")
async def get_cancelled_batches(db: AsyncSession = Depends(get_db)):
    """List all cancelled issuance batches for audit trail."""
    result = await db.execute(
        select(CancelledBatch).order_by(CancelledBatch.cancelled_at.desc())
    )
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "batch_id": b.batch_id,
            "transaction_type": b.transaction_type,
            "product_name": b.product_name,
            "courier_name": b.courier_name,
            "factory_name": b.factory_name,
            "total_quantity": b.total_quantity,
            "items_json": b.items_json,
            "performed_by": b.performed_by,
            "performed_by_role": b.performed_by_role,
            "cancelled_by": b.cancelled_by,
            "cancelled_by_role": b.cancelled_by_role,
            "invoice_message_id": b.invoice_message_id,
            "original_created_at": b.original_created_at.isoformat() + "Z" if b.original_created_at else None,
            "cancelled_at": b.cancelled_at.isoformat() + "Z",
        }
        for b in batches
    ]


@router.delete("/clear_order_issues")
async def clear_order_issues(db: AsyncSession = Depends(get_db)):
    """Delete all unbatched 'issue' WaterTransactions (auto-created by manager orders).
    Also deletes orphaned batch bottle_return records (batch was cancelled but return tx survived).
    These inflate courier debt without corresponding real warehouse handouts.
    After calling this, manually re-enter real handouts as batched invoices."""
    txs = (await db.execute(
        select(WaterTransaction).where(
            WaterTransaction.transaction_type == "issue",
            WaterTransaction.batch_id.is_(None),
        )
    )).scalars().all()
    count = 0
    for tx in txs:
        if tx.courier_id and tx.product_id:
            cw = (await db.execute(
                select(CourierWater).where(
                    CourierWater.courier_id == tx.courier_id,
                    CourierWater.product_id == tx.product_id,
                )
            )).scalar_one_or_none()
            if cw:
                cw.reserved = max(0, (cw.reserved or 0) - tx.quantity)
        await db.delete(tx)
        count += 1

    # Clean up orphaned batch bottle_return records:
    # these have a batch_id but no matching issue/factory_issue in the same batch
    batched_returns = (await db.execute(
        select(WaterTransaction).where(
            WaterTransaction.transaction_type == "bottle_return",
            WaterTransaction.batch_id.isnot(None),
        )
    )).scalars().all()
    for ret in batched_returns:
        sibling = (await db.execute(
            select(WaterTransaction.id).where(
                WaterTransaction.batch_id == ret.batch_id,
                WaterTransaction.transaction_type.in_(["issue", "factory_issue"]),
            ).limit(1)
        )).scalar()
        if not sibling:
            await db.delete(ret)
            count += 1

    await db.commit()
    return {"ok": True, "deleted": count}


@router.post("/sync_delivery_net")
async def sync_delivery_net(db: AsyncSession = Depends(get_db)):
    """Retroactively create delivery_net WaterTransactions for all delivered orders.
    delivery_net tracks the net bottle change per delivery (bottles at client home
    reduce courier debt to warehouse). Idempotent: deletes all existing delivery_net
    records first then rebuilds from order history."""
    from app.models.order import Order, OrderItem, OrderStatus
    from app.models.product import Product

    # Delete all existing delivery_net transactions
    existing = (await db.execute(
        select(WaterTransaction).where(WaterTransaction.transaction_type == "delivery_net")
    )).scalars().all()
    for tx in existing:
        await db.delete(tx)

    # Rebuild from delivered orders
    delivered_orders = (await db.execute(
        select(Order)
        .where(Order.status == OrderStatus.DELIVERED, Order.courier_id.isnot(None))
        .options(selectinload(Order.items).selectinload(OrderItem.product))
    )).scalars().all()

    created = 0
    for order in delivered_orders:
        bottles_19l = sum(
            i.quantity for i in order.items
            if i.product and i.product.has_bottle_deposit
        )
        if bottles_19l == 0 and (order.bottles_lent or 0) == 0:
            continue
        net_change = bottles_19l + (order.bottles_lent or 0) - (order.return_bottles_count or 0)
        if net_change == 0:
            continue
        tx_time = order.delivered_at or order.created_at
        tx = WaterTransaction(
            courier_id=order.courier_id,
            order_id=order.id,
            transaction_type="delivery_net",
            quantity=net_change,
            note=f"Доставка #{order.id}: выдано {bottles_19l}, возврат {order.return_bottles_count or 0}, одолжено {order.bottles_lent or 0}",
        )
        if tx_time:
            tx.created_at = tx_time
        db.add(tx)
        created += 1

    await db.commit()
    return {"ok": True, "deleted": len(existing), "created": created}


# ─── Bottle debt adjustments ──────────────────────────────────────────────────

class BottleDebtAdjustRequest(BaseModel):
    delta: int
    note: str | None = None
    performed_by: str | None = None
    performed_by_role: str | None = None


@router.post("/couriers/{courier_id}/debt_adjust")
async def adjust_courier_debt(
    courier_id: int,
    data: BottleDebtAdjustRequest,
    db: AsyncSession = Depends(get_db),
):
    courier = (await db.execute(select(Courier).where(Courier.id == courier_id))).scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    adj = BottleDebtAdjustment(
        target_type="courier",
        courier_id=courier_id,
        delta=data.delta,
        note=data.note,
        performed_by=data.performed_by,
        performed_by_role=data.performed_by_role,
    )
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return {"ok": True, "id": adj.id}


@router.post("/clients/{client_id}/debt_adjust")
async def adjust_client_debt_wh(
    client_id: int,
    data: BottleDebtAdjustRequest,
    db: AsyncSession = Depends(get_db),
):
    from app.models.client_data import BottleDebt
    user = (await db.execute(select(User).where(User.id == client_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")
    bd = (await db.execute(select(BottleDebt).where(BottleDebt.user_id == client_id))).scalar_one_or_none()
    if bd:
        bd.count = max(0, bd.count + data.delta)
    else:
        if data.delta > 0:
            db.add(BottleDebt(user_id=client_id, count=data.delta))
    adj = BottleDebtAdjustment(
        target_type="client",
        client_id=client_id,
        delta=data.delta,
        note=data.note,
        performed_by=data.performed_by,
        performed_by_role=data.performed_by_role,
    )
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return {"ok": True, "id": adj.id}


@router.post("/factories/{factory_id}/debt_adjust")
async def adjust_factory_debt_wh(
    factory_id: int,
    data: BottleDebtAdjustRequest,
    db: AsyncSession = Depends(get_db),
):
    factory = (await db.execute(select(Factory).where(Factory.id == factory_id))).scalar_one_or_none()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")
    adj = BottleDebtAdjustment(
        target_type="factory",
        factory_id=factory_id,
        delta=data.delta,
        note=data.note,
        performed_by=data.performed_by,
        performed_by_role=data.performed_by_role,
    )
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return {"ok": True, "id": adj.id}


@router.get("/debt_adjustments")
async def get_debt_adjustments_wh(
    limit: int = 100,
    target_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Return debt adjustment log. For warehouse: couriers only by default."""
    q = select(BottleDebtAdjustment).order_by(BottleDebtAdjustment.created_at.desc()).limit(limit)
    if target_type:
        q = q.where(BottleDebtAdjustment.target_type == target_type)
    rows = (await db.execute(q)).scalars().all()
    result = []
    for r in rows:
        target_name = None
        if r.courier_id:
            c = (await db.execute(select(Courier).where(Courier.id == r.courier_id))).scalar_one_or_none()
            target_name = c.name if c else None
        elif r.client_id:
            u = (await db.execute(select(User).where(User.id == r.client_id))).scalar_one_or_none()
            target_name = (u.name or u.phone) if u else None
        elif r.factory_id:
            fa = (await db.execute(select(Factory).where(Factory.id == r.factory_id))).scalar_one_or_none()
            target_name = fa.name if fa else None
        result.append({
            "id": r.id,
            "target_type": r.target_type,
            "courier_id": r.courier_id,
            "client_id": r.client_id,
            "factory_id": r.factory_id,
            "target_name": target_name,
            "delta": r.delta,
            "note": r.note,
            "performed_by": r.performed_by,
            "performed_by_role": r.performed_by_role,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result
