from dotenv import load_dotenv
from starlette.config import Config
import json
from pydantic import TypeAdapter

class ConfigSettings():
    ENVIRONMENT: str
    DEBUG: bool
    ALLOWED_ORIGINS: list[str] = []

    MYSQL_USER: str
    MYSQL_PASSWORD: str
    MYSQL_HOST: str
    MYSQL_PORT: str
    MYSQL_DATABASE: str

    ALEMBIC_SCRIPT_LOCATION: str

    def __init__(self):
        load_dotenv()
        
        self.config = Config( ".env")

        self.ENVIRONMENT = self.config("ENVIRONMENT", default="development")
        self.DEBUG = self.config("DEBUG", cast=bool, default=False)

        self.ALLOWED_ORIGINS = TypeAdapter(list[str]).validate_python(
            json.loads(self.config("ALLOWED_ORIGINS", default='["http://localhost:3000"]'))
        )

        self.MYSQL_USER = self.config("MYSQL_USER", cast=str, default="root")
        self.MYSQL_PASSWORD = self.config("MYSQL_PASSWORD", cast=str, default="securepass123")
        self.MYSQL_HOST = self.config("MYSQL_HOST", cast=str, default="mysqldb")
        self.MYSQL_PORT = self.config("MYSQL_PORT", cast=int, default=3306)
        self.MYSQL_DATABASE = self.config("MYSQL_DATABASE", cast=str, default="leaf")

        self.ALEMBIC_SCRIPT_LOCATION = self.config("ALEMBIC_SCRIPT_LOCATION", cast=str, default="migrations")

        # self.DATABASE_URL = f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"