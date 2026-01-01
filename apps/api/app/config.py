from functools import lru_cache

from pydantic import PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "Email Agent"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: PostgresDsn

    # Redis
    redis_url: RedisDsn = "redis://localhost:6379"  # type: ignore

    # Security
    secret_key: str
    token_encryption_key: str  # Fernet key for encrypting OAuth tokens
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Gmail OAuth
    gmail_client_id: str
    gmail_client_secret: str
    gmail_redirect_uri: str = "http://localhost:8000/api/v1/gmail/auth/callback"
    gmail_scopes: list[str] = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
    ]

    # OpenRouter
    openrouter_api_key: str
    openrouter_default_model: str = "deepseek/deepseek-chat-v3.1:free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Email Polling
    email_poll_interval_minutes: int = 5

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        # Ensure asyncpg driver is used
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
