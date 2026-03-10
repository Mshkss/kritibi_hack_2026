from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Notes API"
    database_url: str = "postgresql+psycopg://notes:notes@db:5432/notes_db"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
