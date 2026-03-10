"""Application configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Road Network API"
    debug: bool = True
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/road_network"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
