from datetime import datetime, timedelta
from typing import Optional
import secrets
import hashlib
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from config import settings
from sqlalchemy.orm import Session
from models import User, RefreshToken

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class TokenData(BaseModel):
    user_id: int
    email: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_refresh_token(refresh_token: str) -> str:
    """Hash a refresh token using SHA256."""
    return hashlib.sha256(refresh_token.encode()).hexdigest()


def create_access_token(user_id: int, email: str) -> str:
    """
    Create a short-lived JWT access token (NOT stored in DB).
    Expires in 10-15 minutes.
    """
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "type": "access"
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token() -> str:
    """
    Create a long-lived refresh token (random string).
    Will be hashed before storing in DB for security.
    """
    return secrets.token_urlsafe(32)


def verify_access_token(token: str) -> Optional[TokenData]:
    """
    Verify a JWT access token using secret key only (no DB hit).
    Returns None if invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        if payload.get("type") != "access":
            return None
        
        user_id: int = int(payload.get("sub"))
        email: str = payload.get("email")
        
        if user_id is None or email is None:
            return None
        
        return TokenData(user_id=user_id, email=email)
    except (JWTError, ValueError):
        return None


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve a user by email."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Retrieve a user by username."""
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, email: str, username: str, password: str) -> User:
    """Create a new user."""
    hashed_password = hash_password(password)
    db_user = User(email=email, username=username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def create_session(db: Session, user_id: int, refresh_token: str) -> RefreshToken:
    """
    Create a new refresh token record.
    - Hash the token before storing for security
    - Store in refresh_tokens table with expiration
    """
    hashed_token = hash_refresh_token(refresh_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_token = RefreshToken(
        user_id=user_id,
        hashed_token=hashed_token,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


def verify_refresh_token(db: Session, user_id: int, refresh_token: str) -> bool:
    """
    Verify refresh token from DB.
    Checks: token matches hash, not revoked, not expired, belongs to user.
    """
    hashed_token = hash_refresh_token(refresh_token)
    
    token_record = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.hashed_token == hashed_token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if token_record:
        # Update last_used_at
        token_record.last_used_at = datetime.utcnow()
        db.commit()
        return True
    
    return False


def revoke_refresh_token(db: Session, user_id: int, refresh_token: str) -> bool:
    """Revoke a specific refresh token."""
    hashed_token = hash_refresh_token(refresh_token)
    
    token_record = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.hashed_token == hashed_token
    ).first()
    
    if token_record:
        token_record.is_revoked = True
        db.commit()
        return True
    
    return False


def revoke_all_user_tokens(db: Session, user_id: int) -> int:
    """Revoke all refresh tokens for a user (logout from all devices)."""
    count = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()
    return count
