from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
from functools import wraps

from database import engine, get_db, Base
from models import User, UserRole, RefreshToken
from auth import (
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
    verify_password,
    hash_password,
    hash_refresh_token,
    generate_otp,
    send_otp_email,
    verify_otp,
    generate_password_reset_token,
    verify_password_reset_token,
    send_password_reset_email,
    get_user_by_email,
    get_user_by_id,
    create_user,
    get_user_roles,
    add_user_role,
    remove_user_role,
    soft_delete_user,
    revoke_refresh_token,
    revoke_all_user_tokens,
    UserResponse,
    UserDetailResponse,
    TokenResponse,
)
from config import settings
from pydantic import BaseModel, EmailStr

# ==================== Pydantic Models ====================

class RegisterRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    password: str


class SendOTPRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class AssignRoleRequest(BaseModel):
    role: str  # CUSTOMER, ORGANIZER, ADMIN


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: dict


# Initialize FastAPI app
app = FastAPI(
    title="Appointment Booking System - Backend",
    version="0.1.0",
    debug=settings.DEBUG
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Startup & Teardown ====================

@app.on_event("startup")
def startup():
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")


# ==================== Dependencies ====================

async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to extract and verify current user from access token.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization[7:]  # Remove "Bearer " prefix
    token_data = verify_access_token(token, db)
    
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Fetch user to verify they still exist and are active
    user = get_user_by_id(token_data.user_id, db)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    
    return user


def require_role(*allowed_roles: str):
    """
    Decorator to check if current user has required role(s).
    Usage: @app.get("/admin", dependencies=[Depends(require_role('ADMIN'))])
    """
    async def check_role(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        user_roles = get_user_roles(current_user.id, db)
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    
    return check_role


# ==================== Phase 1: Authentication Endpoints ====================

@app.post("/api/auth/register", response_model=LoginResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user and return tokens."""
    # Check if email already exists
    if get_user_by_email(request.email, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create new user
    user = create_user(
        email=request.email,
        first_name=request.first_name,
        last_name=request.last_name,
        password=request.password,
        phone=request.phone,
        db=db
    )
    
    # Assign CUSTOMER role by default
    add_user_role(user.id, "CUSTOMER", db)
    
    # Get user roles for token
    user_roles = get_user_roles(user.id, db)
    
    # Generate tokens
    access_token = create_access_token(user.id, user.email, user_roles)
    refresh_token, hashed_refresh_token = create_refresh_token(user.id)
    
    # Store refresh token in DB
    refresh_token_record = RefreshToken(
        user_id=user.id,
        hashed_token=hashed_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user),
    )


@app.post("/api/auth/send-otp")
def send_otp(request: SendOTPRequest, db: Session = Depends(get_db)):
    """Send OTP to email for verification."""
    user = get_user_by_email(request.email, db)
    
    if not user:
        # For security, don't reveal if email exists
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Generate OTP
    otp = generate_otp()
    otp_expires = datetime.utcnow() + timedelta(minutes=10)  # 10 minutes expiry
    
    # Update user with OTP
    user.otp_code = otp
    user.otp_expires_at = otp_expires
    db.commit()
    
    # Send OTP via email
    send_otp_email(user.email, otp)
    
    return {"message": "OTP sent to email"}


@app.post("/api/auth/verify-otp")
def verify_otp_endpoint(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP and mark user as verified."""
    user = get_user_by_email(request.email, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not verify_otp(user, request.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Mark user as verified
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    
    return {"message": "Email verified successfully"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return access + refresh tokens."""
    # Find user by email
    user = get_user_by_email(request.email, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Verify password
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    # Get user roles
    user_roles = get_user_roles(user.id, db)
    
    # Generate tokens
    access_token = create_access_token(user.id, user.email, user_roles)
    refresh_token, hashed_refresh_token = create_refresh_token(user.id)
    
    # Store refresh token in DB
    refresh_token_record = RefreshToken(
        user_id=user.id,
        hashed_token=hashed_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    db.commit()
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user),
    )


@app.post("/api/auth/logout")
def logout(
    request: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout user by revoking refresh token."""
    revoke_refresh_token(request.refresh_token, db)
    return {"message": "Logged out successfully"}


@app.post("/api/auth/logout-all-devices")
def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout from all devices by revoking all refresh tokens."""
    revoke_all_user_tokens(current_user.id, db)
    return {"message": "Logged out from all devices"}


@app.post("/api/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset email."""
    user = get_user_by_email(request.email, db)
    
    if not user:
        # For security, don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate password reset token
    reset_token = generate_password_reset_token(user.id, user.email)
    
    # Send reset email
    send_password_reset_email(user.email, reset_token)
    
    return {"message": "Password reset link sent to email"}


@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using token."""
    # Verify token
    token_data = verify_password_reset_token(request.token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user = get_user_by_id(token_data["user_id"], db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.hashed_password = hash_password(request.new_password)
    db.commit()
    
    # Revoke all refresh tokens for security
    revoke_all_user_tokens(user.id, db)
    
    return {"message": "Password reset successfully. Please login again."}


@app.post("/api/auth/refresh-token", response_model=TokenResponse)
def refresh_access_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh Token Rotation - CRITICAL SECURITY:
    1. Validate refresh token
    2. REVOKE old refresh token
    3. ISSUE new refresh token
    4. Return new access token + new refresh token
    
    Prevents token replay attacks.
    """
    # Verify refresh token
    user_id = verify_refresh_token(request.refresh_token, db)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user = get_user_by_id(user_id, db)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Revoke old token
    revoke_refresh_token(request.refresh_token, db)
    
    # Get user roles
    user_roles = get_user_roles(user.id, db)
    
    # Generate new tokens
    access_token = create_access_token(user.id, user.email, user_roles)
    new_refresh_token, hashed_new_refresh_token = create_refresh_token(user.id)
    
    # Store new refresh token
    refresh_token_record = RefreshToken(
        user_id=user.id,
        hashed_token=hashed_new_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )


# ==================== User Profile Endpoints ====================

@app.get("/api/users/me", response_model=UserDetailResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user profile with roles."""
    roles = get_user_roles(current_user.id, db)
    user_data = UserResponse.from_orm(current_user).dict()
    user_data['roles'] = roles
    return UserDetailResponse(**user_data)


@app.put("/api/users/me", response_model=UserDetailResponse)
def update_current_user_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    if request.first_name:
        current_user.first_name = request.first_name
    if request.last_name:
        current_user.last_name = request.last_name
    if request.phone is not None:
        current_user.phone = request.phone
    
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    
    roles = get_user_roles(current_user.id, db)
    user_data = UserResponse.from_orm(current_user).dict()
    user_data['roles'] = roles
    return UserDetailResponse(**user_data)


@app.post("/api/users/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = hash_password(request.new_password)
    db.commit()
    
    # Revoke all refresh tokens for security
    revoke_all_user_tokens(current_user.id, db)
    
    return {"message": "Password changed successfully. Please login again."}


# ==================== RBAC Endpoints (Admin Only) ====================

@app.get("/api/admin/users")
def list_all_users(
    skip: int = 0,
    limit: int = 10,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """List all users (Admin only)."""
    users = db.query(User).filter(User.deleted_at.is_(None)).offset(skip).limit(limit).all()
    total = db.query(User).filter(User.deleted_at.is_(None)).count()
    
    user_list = []
    for user in users:
        user_data = UserResponse.from_orm(user).dict()
        user_data['roles'] = get_user_roles(user.id, db)
        user_list.append(UserDetailResponse(**user_data))
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "users": user_list
    }


@app.get("/api/admin/users/{user_id}", response_model=UserDetailResponse)
def get_user_details(
    user_id: int,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """Get specific user details (Admin only)."""
    user = get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    roles = get_user_roles(user.id, db)
    user_data = UserResponse.from_orm(user).dict()
    user_data['roles'] = roles
    return UserDetailResponse(**user_data)


@app.post("/api/admin/users/{user_id}/roles")
def assign_user_role(
    user_id: int,
    request: AssignRoleRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """Assign a role to a user (Admin only)."""
    user = get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if request.role not in ["CUSTOMER", "ORGANIZER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    
    result = add_user_role(user_id, request.role, db)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to assign role"
        )
    
    return {"message": f"Role {request.role} assigned to user"}


@app.delete("/api/admin/users/{user_id}/roles/{role}")
def remove_user_role_endpoint(
    user_id: int,
    role: str,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """Remove a role from a user (Admin only)."""
    user = get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not remove_user_role(user_id, role, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove role"
        )
    
    return {"message": f"Role {role} removed from user"}


@app.delete("/api/admin/users/{user_id}")
def soft_delete_user_endpoint(
    user_id: int,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """Soft delete a user (Admin only)."""
    if not soft_delete_user(user_id, db):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User deleted successfully"}


# ==================== Health Check ====================

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow()}


# ==================== 404 Handler ====================

@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Appointment Booking System Backend API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
