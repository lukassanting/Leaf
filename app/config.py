from dotenv import load_dotenv
from starlette.config import Config


class ConfigSettings():

    POSTGRES_HOST: str
    POSTGRES_PORT: str
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    ENVIRONMENT: str
    DEBUG: bool

    DATABASE_URL: str

    def __init__(self):
        load_dotenv()
        
        self.config = Config(".env")

        self.POSTGRES_HOST = self.config("POSTGRES_HOST", cast=str)
        self.POSTGRES_PORT = self.config("POSTGRES_PORT", cast=int)
        self.POSTGRES_DB = self.config("POSTGRES_DB", cast=str)
        self.POSTGRES_USER = self.config("POSTGRES_USER", cast=str)
        self.POSTGRES_PASSWORD = self.config("POSTGRES_PASSWORD", cast=str)


        self.ENVIRONMENT = self.config("ENVIRONMENT", default="development")
        self.DEBUG = self.config("DEBUG", default=False, cast=bool)

        self.DATABASE_URL = f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"