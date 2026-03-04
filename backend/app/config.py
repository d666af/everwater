from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/waterbot"

    # Telegram
    BOT_TOKEN: str
    ADMIN_IDS: list[int] = []

    # App
    SECRET_KEY: str = "change-me-in-production"
    WEBHOOK_URL: str = ""
    MINI_APP_URL: str = ""

    # Payment (реквизиты для ручной оплаты)
    PAYMENT_CARD: str = "0000 0000 0000 0000"
    PAYMENT_HOLDER: str = "Имя Фамилия"

    # Bottle return discount
    BOTTLE_DISCOUNT_TYPE: str = "fixed"  # "fixed" or "percent"
    BOTTLE_DISCOUNT_VALUE: float = 50.0  # рублей или % за бутылку

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
