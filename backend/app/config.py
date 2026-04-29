from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/waterbot"

    # Telegram
    BOT_TOKEN: str
    ADMIN_IDS: list[int] = []
    WAREHOUSE_IDS: list[int] = []

    # App
    SECRET_KEY: str = "change-me-in-production"
    WEBHOOK_URL: str = ""
    MINI_APP_URL: str = "http://localhost:3000"
    ALLOW_DEV_AUTH: bool = True  # allow X-Telegram-User-Id header as a fallback (dev only)

    # Default seed values (persisted into AppSetting table on first startup)
    PAYMENT_CARD: str = "0000 0000 0000 0000"
    PAYMENT_HOLDER: str = "Имя Фамилия"
    BOTTLE_DISCOUNT_TYPE: str = "fixed"  # fixed | percent
    BOTTLE_DISCOUNT_VALUE: float = 2000.0

    @field_validator("ADMIN_IDS", "WAREHOUSE_IDS", mode="before")
    @classmethod
    def _split_int_list(cls, v):
        if isinstance(v, str):
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
