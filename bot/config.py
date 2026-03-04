from pydantic_settings import BaseSettings
from functools import lru_cache


class BotSettings(BaseSettings):
    BOT_TOKEN: str
    API_BASE_URL: str = "http://localhost:8000"
    ADMIN_IDS: list[int] = []
    MINI_APP_URL: str = "https://your-domain.com"
    PAYMENT_CARD: str = "0000 0000 0000 0000"
    PAYMENT_HOLDER: str = "Имя Фамилия"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> BotSettings:
    return BotSettings()


settings = get_settings()
