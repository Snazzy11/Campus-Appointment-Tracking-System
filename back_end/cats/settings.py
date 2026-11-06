from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Real environment variables (e.g. from docker-compose.yml) take precedence over .env
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str


settings = Settings()  # pyright: ignore[reportCallIssue]  # fields come from the environment
