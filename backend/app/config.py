import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "HelpDesk X"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field(default="super_secret_key_change_me_in_production_1234567890", env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    DATABASE_URL: str = Field(default="postgresql://postgres:postgres@localhost:5432/helpdeskx", env="DATABASE_URL")
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    @property
    def sync_database_url(self) -> str:
        # If DATABASE_URL starts with postgresql://, we check if postgresql package psycopg2 is available
        # or if we should fallback to sqlite in the workspace.
        url = self.DATABASE_URL
        if not url:
            db_path = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "helpdeskx.db")
            return f"sqlite:///{db_path}"
        return url

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
