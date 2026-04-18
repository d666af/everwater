from pydantic import BaseModel
from datetime import datetime
from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    user_id: int
    recipient_phone: str
    address: str
    extra_info: str | None = None
    delivery_time: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    return_bottles_count: int = 0
    return_bottles_volume: float = 0.0
    items: list[OrderItemCreate]
    bonus_used: float = 0.0
    balance_used: float = 0.0
    payment_method: str = "cash"
    bottle_discount: float | None = None


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float
    product_name: str | None = None

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    user_id: int
    courier_id: int | None
    status: OrderStatus
    recipient_phone: str
    address: str
    extra_info: str | None
    delivery_time: str | None
    latitude: float | None
    longitude: float | None
    return_bottles_count: int
    return_bottles_volume: float
    bottle_discount: float
    subtotal: float
    total: float
    bonus_used: float
    balance_used: float
    payment_method: str
    cash_collected: bool
    rejection_reason: str | None
    payment_confirmed: bool
    created_at: datetime
    items: list[OrderItemOut] = []
    # Denormalized convenience fields
    client_name: str | None = None
    client_telegram_id: int | None = None
    courier_name: str | None = None
    courier_phone: str | None = None

    model_config = {"from_attributes": True}


class ReviewCreate(BaseModel):
    user_id: int | None = None
    order_id: int
    courier_id: int | None = None
    rating: int
    comment: str | None = None


class CourierCreate(BaseModel):
    telegram_id: int
    name: str
    phone: str | None = None


class CourierOut(BaseModel):
    id: int
    telegram_id: int
    name: str
    phone: str | None
    is_active: bool
    total_deliveries: int

    model_config = {"from_attributes": True}
