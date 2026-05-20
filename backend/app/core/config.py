from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "SCA AI Data Analysis Platform API"
    database_url: str = "postgresql+psycopg://sca:sca_password@localhost:5432/sca_platform"
    redis_url: str = "redis://localhost:6379/0"
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    clerk_jwt_issuer: str | None = None
    clerk_jwt_audience: str | None = None
    clerk_jwks_url: str | None = None
    upload_dir: str = "storage/uploads"
    metadata_dir: str = "storage/metadata"
    max_upload_size_mb: int = 50

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


settings = Settings()
