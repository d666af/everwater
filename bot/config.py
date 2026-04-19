from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class BotSettings(BaseSettings):
    BOT_TOKEN: str
    API_BASE_URL: str = "http://localhost:8000"
    ADMIN_IDS: list[int] = []
    WAREHOUSE_IDS: list[int] = []
    MINI_APP_URL: str = "https://your-domain.com"
    PAYMENT_CARD: str = "0000 0000 0000 0000"
    PAYMENT_HOLDER: str = "Имя Фамилия"

    @field_validator("ADMIN_IDS", "WAREHOUSE_IDS", mode="before")
    @classmethod
    def split_ids(cls, v):
        if isinstance(v, str):
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> BotSettings:
    return BotSettings()


settings = get_settings()
