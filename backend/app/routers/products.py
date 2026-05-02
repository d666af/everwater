import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])

UPLOAD_DIR = Path("static/products")
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.get("/", response_model=list[ProductOut])
async def get_products(include_inactive: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(Product).order_by(Product.sort_order)
    if not include_inactive:
        query = query.where(Product.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/upload-photo")
async def upload_product_photo(request: Request, file: UploadFile = File(...)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if suffix not in ALLOWED_SUFFIXES:
        suffix = ".jpg"
    filename = f"{uuid.uuid4().hex}{suffix}"
    content = await file.read()
    (UPLOAD_DIR / filename).write_bytes(content)
    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/static/products/{filename}"}


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductOut)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(**data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    await db.commit()
    return {"ok": True}
