"""Single source of truth for bottle-debt calculations.

All bottle-debt numbers across the whole app (courier profile, admin/manager
courier card, warehouse couriers list, statistics, warehouse overview, factory
cards) MUST go through this module so every screen shows identical figures.

Formulas
--------
Courier debt (per courier):
    issued − returned − delivery_net + adjustments
  where
    issued        = 19L warehouse dispatches (type="issue", batch_id IS NOT NULL)
    returned      = warehouse bottle returns (type="bottle_return", counts_for_debt != False)
    delivery_net  = bottles left at clients (type="delivery_net") — those become client debt
    adjustments   = manual BottleDebtAdjustment.delta (courier_id)
  Fallback: if a courier has NO warehouse issue records AND no adjustments, derive
  the debt from delivered orders (19L delivered − client-returned − warehouse-returned).
  This covers couriers whose warehouse batch records were deleted/cancelled.

Factory debt (per factory):
    factory_issue − factory_return + adjustments   (19L only)

Client debt (global):
    SUM(BottleDebt.count)  — client adjustments are applied directly to this counter.

Totals are the SUM of per-entity debts (each clamped at 0), so the statistics
totals always equal the sum of the individual cards.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.warehouse import WaterTransaction, BottleDebtAdjustment
from app.models.product import Product
from app.models.order import Order, OrderItem, OrderStatus
from app.models.client_data import BottleDebt


async def get_19l_product_ids(db: AsyncSession) -> list[int]:
    """Product ids for 19L bottles (the only products that carry bottle debt)."""
    prods = (await db.execute(select(Product))).scalars().all()
    return [p.id for p in prods if float(p.volume or 0) >= 18.9]


async def _grouped_tx_sum(
    db: AsyncSession,
    tx_type: str,
    *,
    product_ids: list[int] | None = None,
    require_batch: bool = False,
    counts_for_debt: bool = False,
) -> dict[int, int]:
    """Sum WaterTransaction.quantity grouped by courier_id for one transaction type."""
    q = (
        select(WaterTransaction.courier_id, func.sum(WaterTransaction.quantity))
        .where(WaterTransaction.transaction_type == tx_type)
        .where(WaterTransaction.courier_id.isnot(None))
        .group_by(WaterTransaction.courier_id)
    )
    if product_ids is not None:
        if not product_ids:
            return {}
        q = q.where(WaterTransaction.product_id.in_(product_ids))
    if require_batch:
        q = q.where(WaterTransaction.batch_id.isnot(None))
    if counts_for_debt:
        q = q.where(WaterTransaction.counts_for_debt != False)  # noqa: E712
    rows = (await db.execute(q)).all()
    return {cid: int(qty or 0) for cid, qty in rows}


async def _courier_adj_map(db: AsyncSession) -> dict[int, int]:
    rows = (await db.execute(
        select(BottleDebtAdjustment.courier_id, func.sum(BottleDebtAdjustment.delta))
        .where(BottleDebtAdjustment.courier_id.isnot(None))
        .group_by(BottleDebtAdjustment.courier_id)
    )).all()
    return {cid: int(d or 0) for cid, d in rows}


async def _orders_debt_map(db: AsyncSession, courier_ids: list[int], ids19: list[int]) -> dict[int, int]:
    """Fallback: derive per-courier 19L debt from delivered orders.

    Returns {courier_id: max(0, delivered_19l − client_returned)} for the given couriers.
    The warehouse bottle_return is subtracted by the caller.
    """
    if not courier_ids or not ids19:
        return {}
    ids19_set = set(ids19)
    rows = (await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.courier_id.in_(courier_ids))
        .where(Order.status == OrderStatus.DELIVERED)
    )).scalars().all()
    delivered: dict[int, int] = {}
    client_ret: dict[int, int] = {}
    for o in rows:
        cid = o.courier_id
        for item in (o.items or []):
            if item.product_id in ids19_set:
                delivered[cid] = delivered.get(cid, 0) + (item.quantity or 0)
        client_ret[cid] = client_ret.get(cid, 0) + (o.return_bottles_count or 0)
    return {
        cid: delivered.get(cid, 0) - client_ret.get(cid, 0)
        for cid in courier_ids
    }


async def courier_debt_map(db: AsyncSession) -> dict[int, int]:
    """Per-courier bottle debt for every courier that has any relevant record.

    Single formula used everywhere. Couriers with no debt are omitted (0).
    """
    ids19 = await get_19l_product_ids(db)
    issued = await _grouped_tx_sum(db, "issue", product_ids=ids19, require_batch=True)
    returned = await _grouped_tx_sum(db, "bottle_return", counts_for_debt=True)
    delivery_net = await _grouped_tx_sum(db, "delivery_net")
    adj = await _courier_adj_map(db)

    # Also consider couriers that delivered orders but have no warehouse records yet
    # (the orders fallback below recovers their debt — matches legacy warehouse logic).
    delivered_courier_rows = (await db.execute(
        select(Order.courier_id)
        .where(Order.courier_id.isnot(None))
        .where(Order.status == OrderStatus.DELIVERED)
        .distinct()
    )).all()
    delivered_courier_ids = {cid for (cid,) in delivered_courier_rows}

    all_ids = set(issued) | set(returned) | set(delivery_net) | set(adj) | delivered_courier_ids
    result: dict[int, int] = {}
    fallback_ids: list[int] = []
    for cid in all_ids:
        iss = issued.get(cid, 0)
        a = adj.get(cid, 0)
        if iss == 0 and a == 0:
            # No warehouse issue records and no manual adjustment → use orders fallback
            fallback_ids.append(cid)
        else:
            result[cid] = max(0, iss - returned.get(cid, 0) - delivery_net.get(cid, 0) + a)

    if fallback_ids:
        orders_map = await _orders_debt_map(db, fallback_ids, ids19)
        for cid in fallback_ids:
            from_orders = max(0, orders_map.get(cid, 0) - returned.get(cid, 0))
            result[cid] = max(0, from_orders)

    return result


async def courier_debt(db: AsyncSession, courier_id: int) -> int:
    """Bottle debt for a single courier (same formula as courier_debt_map)."""
    return (await courier_debt_map(db)).get(courier_id, 0)


async def factory_debt_map(db: AsyncSession) -> dict[int, int]:
    """Per-factory 19L bottle debt: factory_issue − factory_return + adjustments."""
    ids19 = await get_19l_product_ids(db)
    if not ids19:
        issued_rows = []
        returned_rows = []
    else:
        issued_rows = (await db.execute(
            select(WaterTransaction.factory_id, func.sum(WaterTransaction.quantity))
            .where(WaterTransaction.transaction_type == "factory_issue")
            .where(WaterTransaction.factory_id.isnot(None))
            .where(WaterTransaction.product_id.in_(ids19))
            .group_by(WaterTransaction.factory_id)
        )).all()
        returned_rows = (await db.execute(
            select(WaterTransaction.factory_id, func.sum(WaterTransaction.quantity))
            .where(WaterTransaction.transaction_type == "factory_return")
            .where(WaterTransaction.factory_id.isnot(None))
            .where(WaterTransaction.product_id.in_(ids19))
            .group_by(WaterTransaction.factory_id)
        )).all()
    issued = {fid: int(q or 0) for fid, q in issued_rows}
    returned = {fid: int(q or 0) for fid, q in returned_rows}
    adj_rows = (await db.execute(
        select(BottleDebtAdjustment.factory_id, func.sum(BottleDebtAdjustment.delta))
        .where(BottleDebtAdjustment.factory_id.isnot(None))
        .group_by(BottleDebtAdjustment.factory_id)
    )).all()
    adj = {fid: int(d or 0) for fid, d in adj_rows}

    all_ids = set(issued) | set(returned) | set(adj)
    return {
        fid: max(0, issued.get(fid, 0) - returned.get(fid, 0) + adj.get(fid, 0))
        for fid in all_ids
    }


async def factory_debt(db: AsyncSession, factory_id: int) -> int:
    return (await factory_debt_map(db)).get(factory_id, 0)


async def client_debt_total(db: AsyncSession) -> int:
    return int((await db.execute(select(func.sum(BottleDebt.count)))).scalar() or 0)


async def debt_totals(db: AsyncSession) -> dict[str, int]:
    """Aggregate bottle-debt totals. Totals == sum of per-entity debts (== sum of cards)."""
    cmap = await courier_debt_map(db)
    fmap = await factory_debt_map(db)
    clients = await client_debt_total(db)
    couriers = sum(cmap.values())
    factories = sum(fmap.values())
    return {
        "clients": clients,
        "couriers": couriers,
        "factories": factories,
        "total": clients + couriers + factories,
    }
