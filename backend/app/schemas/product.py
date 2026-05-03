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
    has_bottle_deposit: bool = False
    deposit_price: int | None = None


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
    has_bottle_deposit: bool | None = None
    deposit_price: int | None = None


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
    has_bottle_deposit: bool
    deposit_price: int | None = None

    model_config = {"from_attributes": True}
