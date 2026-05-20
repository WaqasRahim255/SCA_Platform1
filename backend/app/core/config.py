from functools import cached_property

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "SCA AI Data Analysis Platform API"

    # PostgreSQL
    database_url: str = (
        "postgresql+psycopg://sca:sca_password@localhost:5432/sca_platform"
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Frontend URLs
    backend_cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    # Clerk Authentication
    clerk_jwt_issuer: str | None = None
    clerk_jwt_audience: str | None = None
    clerk_jwks_url: str | None = None

    # Upload Storage
    upload_dir: str = "storage/uploads"
    metadata_dir: str = "storage/metadata"

    # Upload Limits
    max_upload_size_mb: int = 50

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value

        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)

        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)

        if value.startswith("postgresql+psycopg2://"):
            return value.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

        return value

    @cached_property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()
