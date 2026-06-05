"""Single source of truth for per-courier "sold bottles" (проданные бутылки).

A *sold bottle* is a non-returned 19L bottle for which the client paid a
surcharge (надбавка). On the statistics "Продажи курьеров" card this is shown
as a single global figure; here we break it down per courier and allow manual
corrections so admins / managers / warehouse staff can edit each courier's
personal count exactly like the bottle-debt counter.

Formula (per courier):
    base        = Σ over delivered orders with bottle_surcharge > 0 of
                  (19L delivered − bottles returned in that order)   (clamped ≥ 0)
    adjustments = Σ BottleDebtAdjustment.delta where target_type = "courier_sold"
    sold        = max(0, base + adjustments)

Manual adjustments are stored in the shared BottleDebtAdjustment table with
target_type="courier_sold" so they reuse the same history/log plumbing as the
bottle-debt adjustments (but are kept separate from the debt totals).
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.warehouse import BottleDebtAdjustment
from app.models.order import Order, OrderItem, OrderStatus
from app.services.bottle_debt import get_19l_product_ids

SOLD_TARGET_TYPE = "courier_sold"


async def _sold_adj_map(db: AsyncSession) -> dict[int, int]:
    rows = (await db.execute(
        select(BottleDebtAdjustment.courier_id, func.sum(BottleDebtAdjustment.delta))
        .where(BottleDebtAdjustment.target_type == SOLD_TARGET_TYPE)
        .where(BottleDebtAdjustment.courier_id.isnot(None))
        .group_by(BottleDebtAdjustment.courier_id)
    )).all()
    return {cid: int(d or 0) for cid, d in rows}


async def courier_sold_map(db: AsyncSession) -> dict[int, int]:
    """Per-courier sold-bottle count for every courier that has any record."""
    ids19 = set(await get_19l_product_ids(db))
    base: dict[int, int] = {}
    if ids19:
        rows = (await db.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.courier_id.isnot(None))
            .where(Order.status == OrderStatus.DELIVERED)
            .where(Order.bottle_surcharge > 0)
        )).scalars().all()
        delivered: dict[int, int] = {}
        returned: dict[int, int] = {}
        for o in rows:
            cid = o.courier_id
            for item in (o.items or []):
                if item.product_id in ids19:
                    delivered[cid] = delivered.get(cid, 0) + (item.quantity or 0)
            returned[cid] = returned.get(cid, 0) + (o.return_bottles_count or 0)
        for cid in set(delivered) | set(returned):
            base[cid] = max(0, delivered.get(cid, 0) - returned.get(cid, 0))

    adj = await _sold_adj_map(db)
    result: dict[int, int] = {}
    for cid in set(base) | set(adj):
        result[cid] = max(0, base.get(cid, 0) + adj.get(cid, 0))
    return result


async def courier_sold(db: AsyncSession, courier_id: int) -> int:
    """Sold-bottle count for a single courier (same formula as courier_sold_map)."""
    return (await courier_sold_map(db)).get(courier_id, 0)
