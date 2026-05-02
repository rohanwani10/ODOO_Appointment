from datetime import datetime, timedelta, timezone
from typing import Optional, List, Union
import secrets
import random
import hashlib
from urllib.parse import quote
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from config import settings
from sqlalchemy.orm import Session
from sqlalchemy import Column
from models import User, RefreshToken, UserRole

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


# ==================== Pydantic Models ====================

class TokenData(BaseModel):
    user_id: int
    email: str
    roles: List[str]


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    profile_picture_url: Optional[str]
    preferences: Optional[str]
    is_verified: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    roles: List[str]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class PasswordResetToken(BaseModel):
    token: str
    expires_at: datetime


# ==================== Password Hashing ====================

def hash_password(password: str) -> str:
    """Hash a password using argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: Union[str, Column]) -> bool:
    """Verify a password against its hash."""
    try:
        return pwd_context.verify(plain_password, hashed_password)  # type: ignore[arg-type]
    except Exception:
        # Any error during verification should be treated as a failed match
        return False


def hash_refresh_token(refresh_token: str) -> str:
    """Hash a refresh token using SHA256."""
    return hashlib.sha256(refresh_token.encode()).hexdigest()


# ==================== OTP Handling ====================

def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return str(random.randint(100000, 999999))


def send_otp_email(email: Union[str, Column], otp: Union[str, Column]) -> bool:
    """Send OTP via email."""
    from email_service import email_service
    # Extract user name from email for personalization
    user_name = str(email).split('@')[0].capitalize()
    return email_service.send_otp_email(str(email), str(otp), user_name)  # type: ignore[arg-type]


def verify_otp(user: User, provided_otp: str) -> bool:
    """Verify if OTP is correct and not expired."""
    if not user.otp_code or not user.otp_expires_at:  # type: ignore[arg-type]
        return False
    
    if datetime.now(timezone.utc) > user.otp_expires_at:  # type: ignore[operator]
        return False
    
    return bool(user.otp_code == provided_otp)  # type: ignore[return-value]


# ==================== JWT Token Management ====================

def create_access_token(user_id: Union[int, Column], email: Union[str, Column], roles: List[str], 
                       expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "user_id": user_id,
        "email": email,
        "roles": roles,
        "exp": expire
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: Union[int, Column]) -> tuple[str, str]:
    """Create a refresh token and return (token, hashed_token)."""
    token = secrets.token_urlsafe(32)
    hashed_token = hash_refresh_token(token)
    return token, hashed_token


def verify_access_token(token: str, db: Session) -> Optional[TokenData]:
    """Verify JWT access token and return token data."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("user_id")  # type: ignore[assignment]
        email: str = payload.get("email")  # type: ignore[assignment]
        roles: List[str] = payload.get("roles", [])  # type: ignore[assignment]
        
        if user_id is None or email is None:
            return None
        
        return TokenData(user_id=user_id, email=email, roles=roles)
    except JWTError:
        return None


def verify_refresh_token(token: str, db: Session) -> Optional[int]:
    """Verify refresh token and return user_id if valid."""
    hashed_token = hash_refresh_token(token)
    refresh_token_record = db.query(RefreshToken).filter(
        RefreshToken.hashed_token == hashed_token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not refresh_token_record:
        return None
    
    # Update last_used_at
    refresh_token_record.last_used_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    
    return int(refresh_token_record.user_id)  # type: ignore[return-value]


def revoke_refresh_token(token: str, db: Session) -> bool:
    """Revoke a specific refresh token."""
    hashed_token = hash_refresh_token(token)
    refresh_token_record = db.query(RefreshToken).filter(
        RefreshToken.hashed_token == hashed_token
    ).first()
    
    if not refresh_token_record:
        return False
    
    refresh_token_record.is_revoked = True  # type: ignore[assignment]
    db.commit()
    return True


def revoke_all_user_tokens(user_id: Union[int, Column], db: Session) -> bool:
    """Revoke all refresh tokens for a user (logout all devices)."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False
    ).update({RefreshToken.is_revoked: True})
    db.commit()
    return True


# ==================== Password Reset ====================

def generate_password_reset_token(user_id: Union[int, Column], email: Union[str, Column]) -> str:
    """Generate a password reset token."""
    expire = datetime.now(timezone.utc) + timedelta(hours=1)  # 1 hour expiry
    to_encode = {
        "user_id": user_id,
        "email": email,
        "exp": expire,
        "type": "password_reset"
    }
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_password_reset_token(token: str) -> Optional[dict]:
    """Verify password reset token and return user info."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        if payload.get("type") != "password_reset":
            return None
        
        return {
            "user_id": payload.get("user_id"),
            "email": payload.get("email")
        }
    except JWTError:
        return None


def send_password_reset_email(email: str, reset_token: str) -> bool:
    """Send password reset email."""
    from email_service import email_service
    from config import settings
    
    # Build reset URL
    frontend_base_url = settings.FRONTEND_URL.rstrip("/")
    reset_url = f"{frontend_base_url}/auth/reset-password/{quote(reset_token, safe='')}"
    
    # Extract user name from email for personalization
    user_name = email.split('@')[0].capitalize()
    
    return email_service.send_password_reset_email(email, reset_url, user_name)


# ==================== User Database Operations ====================

def get_user_by_email(email: str, db: Session) -> Optional[User]:
    """Get user by email."""
    return db.query(User).filter(
        User.email == email,
        User.deleted_at.is_(None)
    ).first()


def get_user_by_id(user_id: Union[int, Column], db: Session) -> Optional[User]:
    """Get user by ID."""
    return db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()


def create_user(email: str, first_name: str, last_name: str, password: str, 
                phone: Optional[str] = None, db: Session = None) -> Optional[User]:  # type: ignore[assignment]
    """Create a new user."""
    if get_user_by_email(email, db):
        return None  # User already exists
    
    hashed_password = hash_password(password)
    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        hashed_password=hashed_password,
        is_verified=False
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


def get_user_roles(user_id: Union[int, Column], db: Session) -> List[str]:
    """Get all roles for a user."""
    roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    return [str(role.role) for role in roles]  # type: ignore[return-value]


def add_user_role(user_id: Union[int, Column], role: str, db: Session) -> Optional[UserRole]:
    """Add a role to a user."""
    if role not in ['CUSTOMER', 'ORGANIZER', 'ADMIN']:
        return None
    
    # Check if user already has this role
    existing_role = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role == role
    ).first()
    
    if existing_role:
        return existing_role
    
    user_role = UserRole(user_id=user_id, role=role)
    db.add(user_role)
    db.commit()
    db.refresh(user_role)
    
    return user_role


def remove_user_role(user_id: Union[int, Column], role: str, db: Session) -> bool:
    """Remove a role from a user."""
    result = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role == role
    ).delete()
    db.commit()
    return result > 0


def soft_delete_user(user_id: Union[int, Column], db: Session) -> bool:
    """Soft delete a user."""
    user = get_user_by_id(user_id, db)
    if not user:
        return False
    
    user.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return True
