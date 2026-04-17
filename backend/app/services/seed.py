"""Seed the database with default products on first startup."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


EVER_PHOTOS = [
    "https://branding.uz/wp-content/uploads/2022/11/ever-0.png",
    "https://branding.uz/wp-content/uploads/2022/11/ever-1.png",
    "https://branding.uz/wp-content/uploads/2022/11/ever-2.png",
    "https://branding.uz/wp-content/uploads/2022/11/ever-3.png",
    "https://branding.uz/wp-content/uploads/2022/11/ever-4.png",
    "https://branding.uz/wp-content/uploads/2022/11/ever-5.png",
    "https://branding.uz/wp-content/uploads/2022/11/ph_juravlev-29.png",
]


DEFAULT_PRODUCTS = [
    ("Вода 0.5 литровая", 0.5, 2000, "still", 1, EVER_PHOTOS[0]),
    ("Вода 1 литровая", 1.0, 3500, "still", 2, EVER_PHOTOS[1]),
    ("Вода 1.5 литровая", 1.5, 4500, "still", 3, EVER_PHOTOS[2]),
    ("Вода 5 литровая", 5.0, 8000, "still", 4, EVER_PHOTOS[3]),
    ("Вода 10 литровая", 10.0, 14000, "still", 5, EVER_PHOTOS[4]),
    ("Вода 20 литровая", 20.0, 25000, "still", 6, EVER_PHOTOS[5]),
    ("Вода 0.5 литровая газированная", 0.5, 3000, "carbonated", 7, EVER_PHOTOS[6]),
    ("Вода 1 литровая газированная", 1.0, 5000, "carbonated", 8, EVER_PHOTOS[0]),
    ("Вода 1.5 литровая газированная", 1.5, 6000, "carbonated", 9, EVER_PHOTOS[1]),
    ("Вода 5 литровая газированная", 5.0, 10000, "carbonated", 10, EVER_PHOTOS[2]),
]


async def seed_products(db: AsyncSession) -> None:
    result = await db.execute(select(Product.id).limit(1))
    if result.scalar_one_or_none() is not None:
        return
    for name, volume, price, ptype, order, photo in DEFAULT_PRODUCTS:
        db.add(Product(
            name=name, volume=volume, price=price, type=ptype,
            sort_order=order, photo_url=photo, description="",
        ))
    await db.commit()
