"""
Application configuration loaded from environment variables.
Uses pydantic-settings for automatic .env parsing and type validation.
"""
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Application ───────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── Data ──────────────────────────────────────────────────────────────────
    # Ligue 1 competition_id as found in the CSV data
    COMPETITION_ID: str = "dm5ka0os1e3dxcp3vh05kmp33"
    DEFAULT_SEASON: str = "25-26"

    # ── Cache ─────────────────────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = 3600
    SHOTS_CACHE_TTL: int = 86400

    # ── Environment ───────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list) -> list[str]:
        """Accept either a comma-separated string or a list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — called once, reused everywhere."""
    return Settings()


# Module-level shortcut used in most files: from app.config import settings
settings = get_settings()
