import os
from pathlib import Path

from pydantic_settings import BaseSettings


BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_DB = BACKEND_DIR / "appointment.db"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DEFAULT_SQLITE_DB}"
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
    
    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google-callback")
    GOOGLE_SCOPES: list = [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
    ]

    # Razorpay
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_CURRENCY: str = os.getenv("RAZORPAY_CURRENCY", "INR")

    # Zoom Server-to-Server OAuth
    ZOOM_ACCOUNT_ID: str = os.getenv("ZOOM_ACCOUNT_ID", "")
    ZOOM_CLIENT_ID: str = os.getenv("ZOOM_CLIENT_ID", "")
    ZOOM_CLIENT_SECRET: str = os.getenv("ZOOM_CLIENT_SECRET", "")
    ZOOM_USER_ID: str = os.getenv("ZOOM_USER_ID", "me")
    
    # Server
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    API_PREFIX: str = "/api"
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    APP_NAME: str = "Appointment Booking System"
    APP_VERSION: str = "0.1.0"
    
    class Config:
        env_file = str(BACKEND_DIR / ".env")
        case_sensitive = True


settings = Settings()
