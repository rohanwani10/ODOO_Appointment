from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost/pg_admin"
    )
    
    # JWT
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "your-secret-key-change-this-in-production-min-32-chars-long-12345"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # SMTP Email Configuration
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@appointmentbooking.com")
    
    # Frontend URL (for reset password links)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Server
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    API_PREFIX: str = "/api"
    CORS_ORIGINS: str = "*"
    APP_NAME: str = "Appointment Booking System"
    APP_VERSION: str = "0.1.0"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
