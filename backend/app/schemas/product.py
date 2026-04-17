from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    volume: float
    price: float
    type: str = "still"
    photo_url: str | None = None
    stock: int = 999
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    volume: float | None = None
    price: float | None = None
    type: str | None = None
    photo_url: str | None = None
    stock: int | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ProductOut(BaseModel):
    id: int
    name: str
    description: str | None
    volume: float
    price: float
    type: str
    photo_url: str | None
    stock: int
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}
