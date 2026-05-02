# pyright: reportGeneralTypeIssues=false

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any, cast
from functools import wraps

from database import engine, get_db, Base
from models import (
    User, UserRole, RefreshToken, Organization, Service, Resource,
    ServiceResource, Appointment, BookingFormQuestion, BookingFormResponse,
    ResourceWorkingHours, ResourceUnavailability
)
from email_service import email_service
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
    role: Optional[str] = "CUSTOMER"  # CUSTOMER or ORGANIZER


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


class OrganizationCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: int
    name: str
    admin_user_id: int
    description: Optional[str]
    logo_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Phase 2: Pydantic Models (Services & Appointments) ====================
class ServiceResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str]
    duration_minutes: int
    capacity: int
    is_published: bool
    shareable_link: Optional[str]
    max_bookings_per_user: Optional[int]
    requires_advance_payment: bool
    advance_payment_amount: Optional[float]
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class ServiceCreateRequest(BaseModel):
    organization_id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int
    capacity: int = 1
    is_published: bool = False
    max_bookings_per_user: Optional[int] = None
    requires_advance_payment: bool = False
    advance_payment_amount: Optional[float] = None
    shareable_link: Optional[str] = None


class AppointmentCreateRequest(BaseModel):
    service_id: int
    resource_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    capacity_used: int = 1
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    service_id: int
    customer_id: int
    resource_id: Optional[int]
    start_time: datetime
    end_time: datetime
    status: str
    capacity_used: int
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda value: (
                value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                if value.tzinfo and value.utcoffset() is not None
                else value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
            )
        }

# ==================== Phase 2: Resource Pydantic Models ====================

class ResourceCreateRequest(BaseModel):
    organization_id: int
    name: str
    type: str  # PROVIDER, ROOM, EQUIPMENT
    description: Optional[str] = None
    capacity: int = 1


class ResourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None


class ResourceResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    type: str
    description: Optional[str]
    capacity: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkingHoursCreateRequest(BaseModel):
    day_of_week: int
    start_time: str  # HH:MM:SS
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    is_available: bool = True


class WorkingHoursResponse(BaseModel):
    id: int
    resource_id: int
    day_of_week: int
    start_time: str
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    is_available: bool

    class Config:
        from_attributes = True


class UnavailabilityCreateRequest(BaseModel):
    start_date_time: datetime
    end_date_time: datetime
    reason: Optional[str] = None


class UnavailabilityResponse(BaseModel):
    id: int
    resource_id: int
    start_date_time: datetime
    end_date_time: datetime
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ServiceResourceAssignRequest(BaseModel):
    resource_id: int
    is_required: bool = False
    assignment_type: str = "MANUAL"


class ServiceResourceUpdateRequest(BaseModel):
    is_required: Optional[bool] = None
    assignment_type: Optional[str] = None


class ServiceResourceResponse(BaseModel):
    id: int
    service_id: int
    resource_id: int
    is_required: bool
    assignment_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class FormQuestionCreateRequest(BaseModel):
    question_text: str
    field_type: str
    is_required: bool = True
    options: Optional[str] = None
    display_order: int = 0


class FormQuestionUpdateRequest(BaseModel):
    question_text: Optional[str] = None
    field_type: Optional[str] = None
    is_required: Optional[bool] = None
    options: Optional[str] = None
    display_order: Optional[int] = None


class FormQuestionResponse(BaseModel):
    id: int
    service_id: int
    question_text: str
    field_type: str
    is_required: bool
    options: Optional[str]
    display_order: int

    class Config:
        from_attributes = True


class FormResponseItem(BaseModel):
    question_id: int
    response: str


class FormResponseSubmitRequest(BaseModel):
    responses: List[FormResponseItem]


class RescheduleRequest(BaseModel):
    start_time: datetime
    end_time: datetime


class CancelAppointmentRequest(BaseModel):
    cancellation_reason: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str


class ServiceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    capacity: Optional[int] = None
    is_published: Optional[bool] = None
    max_bookings_per_user: Optional[int] = None
    requires_advance_payment: Optional[bool] = None
    advance_payment_amount: Optional[float] = None


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
    if user is None or not user.is_active:  # type: ignore[arg-type]
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


def orm(obj: Any) -> Any:
    """Return an ORM instance as Any so Pylance does not treat mapped fields as Column objects."""
    return obj


def normalize_datetime_to_utc(value: datetime) -> datetime:
    """Treat naive datetimes as UTC and normalize aware datetimes to UTC."""
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def serialize_datetime(value: Optional[datetime]) -> Optional[str]:
    """Return ISO timestamps with an explicit UTC marker for the frontend."""
    if value is None:
        return None
    return normalize_datetime_to_utc(value).isoformat().replace("+00:00", "Z")


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
    
    # Assign role (default CUSTOMER, allow ORGANIZER during public signup)
    chosen_role = request.role if request.role in ("CUSTOMER", "ORGANIZER") else "CUSTOMER"
    add_user_role(user.id, chosen_role, db)  # type: ignore[union-attr]

    if chosen_role == "ORGANIZER":
        existing_org = db.query(Organization).filter(
            Organization.admin_user_id == user.id,  # type: ignore[union-attr]
            Organization.deleted_at.is_(None)
        ).first()
        if not existing_org:
            org_name = f"{request.first_name} {request.last_name}".strip() or request.email.split("@")[0]
            db.add(
                Organization(
                    name=f"{org_name} Organization",
                    admin_user_id=user.id,  # type: ignore[union-attr]
                    description="Default organizer workspace",
                )
            )
            db.commit()
    
    # Get user roles for token
    user_roles = get_user_roles(user.id, db)  # type: ignore[union-attr]
    
    # Generate tokens
    access_token = create_access_token(user.id, user.email, user_roles)  # type: ignore[union-attr]
    refresh_token, hashed_refresh_token = create_refresh_token(user.id)  # type: ignore[union-attr]
    
    # Store refresh token in DB
    refresh_token_record = RefreshToken(
        user_id=user.id,  # type: ignore[union-attr]
        hashed_token=hashed_refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    db.commit()

    # Send onboarding email without blocking signup if email delivery fails
    try:
        email_service.send_welcome_email(user.email, user.first_name)  # type: ignore[union-attr,arg-type]
    except Exception:
        pass
    
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
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minutes expiry
    
    # Update user with OTP
    user.otp_code = otp  # type: ignore[assignment]
    user.otp_expires_at = otp_expires  # type: ignore[assignment]
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
    user.is_verified = True  # type: ignore[assignment]
    user.otp_code = None  # type: ignore[assignment]
    user.otp_expires_at = None  # type: ignore[assignment]
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
    
    if not user.is_active:  # type: ignore[arg-type]
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
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
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
    reset_token = generate_password_reset_token(user.id, user.email)  # type: ignore[arg-type]
    
    # Send reset email
    send_password_reset_email(user.email, reset_token)  # type: ignore[arg-type]
    
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
    user.hashed_password = hash_password(request.new_password)  # type: ignore[assignment]
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
    if not user or not user.is_active:  # type: ignore[arg-type]
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
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
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
        current_user.first_name = request.first_name  # type: ignore[assignment]
    if request.last_name:
        current_user.last_name = request.last_name  # type: ignore[assignment]
    if request.phone is not None:
        current_user.phone = request.phone  # type: ignore[assignment]
    
    current_user.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
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
    if not verify_password(request.current_password, current_user.hashed_password):  # type: ignore[arg-type]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = hash_password(request.new_password)  # type: ignore[assignment]
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


# ==================== Phase 2: Organization Endpoints ====================


@app.get("/api/organizations/mine", response_model=List[OrganizationResponse])
def list_my_organizations(
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    organizations = db.query(Organization).filter(
        Organization.admin_user_id == current_user.id,
        Organization.deleted_at.is_(None)
    ).order_by(Organization.created_at.desc()).all()
    return [OrganizationResponse.from_orm(org) for org in organizations]


@app.post("/api/organizations", response_model=OrganizationResponse, status_code=201)
def create_organization(
    request: OrganizationCreateRequest,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    organization = Organization(
        name=request.name,
        description=request.description,
        admin_user_id=current_user.id,
    )
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


# ==================== Phase 2: Services Endpoints ====================


@app.get("/api/services", response_model=List[ServiceResponse])
def list_services(db: Session = Depends(get_db)):
    """List published services."""
    services = db.query(Service).filter(Service.deleted_at.is_(None), Service.is_published == True).all()
    return services


@app.get("/api/organizer/services", response_model=List[ServiceResponse])
def list_organizer_services(
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    services = db.query(Service).filter(
        Service.created_by == current_user.id,
        Service.deleted_at.is_(None)
    ).order_by(Service.created_at.desc()).all()
    return services


@app.get("/api/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


@app.post("/api/services", response_model=ServiceResponse, status_code=201)
def create_service(request: ServiceCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    _verify_org_owner(current_user.id, request.organization_id, db)
    service = Service(
        organization_id=request.organization_id,
        name=request.name,
        description=request.description,
        duration_minutes=request.duration_minutes,
        capacity=request.capacity,
        is_published=request.is_published,
        shareable_link=request.shareable_link if hasattr(request, 'shareable_link') else None,
        max_bookings_per_user=request.max_bookings_per_user,
        requires_advance_payment=request.requires_advance_payment,
        advance_payment_amount=request.advance_payment_amount,
        created_by=current_user.id,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@app.put("/api/services/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, request: ServiceUpdateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    # only creator or admin can update
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this service")

    for key, value in request.dict(exclude_unset=True).items():
        setattr(service, key, value)

    db.commit()
    db.refresh(service)
    return service


@app.post("/api/services/{service_id}/publish")
def publish_service(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    service.is_published = True  # type: ignore[assignment]
    db.commit()
    return {"message": "Service published"}


@app.post("/api/services/{service_id}/unpublish")
def unpublish_service(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    service.is_published = False  # type: ignore[assignment]
    db.commit()
    return {"message": "Service unpublished"}


# ==================== Phase 2: Service Management (continued) ====================


@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Soft delete a service (Organizer only)."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    service.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return {"message": "Service deleted"}


@app.post("/api/services/{service_id}/shareable-link")
def generate_shareable_link(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Generate a shareable link for a service."""
    import secrets as _secrets
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    link = _secrets.token_urlsafe(16)
    service.shareable_link = link  # type: ignore[assignment]
    db.commit()
    return {"shareable_link": link}


@app.get("/api/services/shareable/{shareable_link}", response_model=ServiceResponse)
def get_service_by_shareable_link(shareable_link: str, db: Session = Depends(get_db)):
    """Get a service by its shareable link."""
    service = db.query(Service).filter(Service.shareable_link == shareable_link, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


# ==================== Phase 2: Service Discovery ====================


@app.get("/api/services/{service_id}/resources")
def get_service_resources(service_id: int, db: Session = Depends(get_db)):
    """Get resources assigned to a service."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    sr_records = db.query(ServiceResource).filter(ServiceResource.service_id == service_id).all()
    resource_ids = [sr.resource_id for sr in sr_records]
    if not resource_ids:
        return []
    resources = db.query(Resource).filter(Resource.id.in_(resource_ids), Resource.deleted_at.is_(None)).all()
    return [ResourceResponse.from_orm(r) for r in resources]


@app.get("/api/services/{service_id}/availability")
def get_service_availability(
    service_id: int,
    date: str,
    resource_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get available time slots for a service on a given date."""
    from datetime import time as time_type

    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Use YYYY-MM-DD")

    day_of_week = target_date.isoweekday() % 7  # 0=Sunday

    # Determine which resources to check
    if resource_id:
        resources = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).all()
    else:
        sr_records = db.query(ServiceResource).filter(ServiceResource.service_id == service_id).all()
        r_ids = [sr.resource_id for sr in sr_records]
        if not r_ids:
            return []
        resources = db.query(Resource).filter(Resource.id.in_(r_ids), Resource.deleted_at.is_(None)).all()

    all_slots = []
    for resource in resources:
        working_hours = db.query(ResourceWorkingHours).filter(
            ResourceWorkingHours.resource_id == resource.id,
            ResourceWorkingHours.day_of_week == day_of_week,
            ResourceWorkingHours.is_available == True
        ).first()
        if not working_hours:
            continue

        day_start = normalize_datetime_to_utc(datetime.combine(target_date, time_type.min))
        day_end = normalize_datetime_to_utc(datetime.combine(target_date, time_type.max))

        existing_appts = db.query(Appointment).filter(
            Appointment.resource_id == resource.id,
            Appointment.status != 'CANCELLED',
            Appointment.start_time < day_end,
            Appointment.end_time > day_start
        ).all()

        unavailability = db.query(ResourceUnavailability).filter(
            ResourceUnavailability.resource_id == resource.id,
            ResourceUnavailability.start_date_time < day_end,
            ResourceUnavailability.end_date_time > day_start
        ).all()

        slot_duration = timedelta(minutes=service.duration_minutes)  # type: ignore[arg-type]
        current = normalize_datetime_to_utc(
            datetime.combine(target_date, working_hours.start_time)  # type: ignore[arg-type]
        )
        work_end = normalize_datetime_to_utc(
            datetime.combine(target_date, working_hours.end_time)  # type: ignore[arg-type]
        )
        break_start = (
            normalize_datetime_to_utc(datetime.combine(target_date, working_hours.break_start))
            if working_hours.break_start
            else None
        )
        break_end = (
            normalize_datetime_to_utc(datetime.combine(target_date, working_hours.break_end))
            if working_hours.break_end
            else None
        )

        while current + slot_duration <= work_end:
            slot_start = current
            slot_end = current + slot_duration

            # Skip break period
            if break_start and break_end and slot_start < break_end and slot_end > break_start:
                current = break_end
                continue

            # Capacity check
            used = sum(
                a.capacity_used
                for a in existing_appts
                if normalize_datetime_to_utc(a.start_time) < slot_end
                and normalize_datetime_to_utc(a.end_time) > slot_start
            )  # type: ignore[arg-type]
            if used >= resource.capacity:
                current += slot_duration
                continue

            # Unavailability check
            is_blocked = any(
                normalize_datetime_to_utc(u.start_date_time) < slot_end
                and normalize_datetime_to_utc(u.end_date_time) > slot_start
                for u in unavailability
            )  # type: ignore[arg-type]
            if not is_blocked:
                all_slots.append({
                    "start_time": serialize_datetime(slot_start),
                    "end_time": serialize_datetime(slot_end),
                    "resource_id": resource.id,
                    "resource_name": resource.name,
                    "available_capacity": resource.capacity - used,
                })
            current += slot_duration

    return all_slots


@app.get("/api/services/{service_id}/form-questions")
def get_form_questions(service_id: int, db: Session = Depends(get_db)):
    """Get custom form questions for a service."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    questions = db.query(BookingFormQuestion).filter(
        BookingFormQuestion.service_id == service_id
    ).order_by(BookingFormQuestion.display_order).all()
    return [FormQuestionResponse.from_orm(q) for q in questions]


# ==================== Phase 2: Resource Management ====================


def _verify_org_owner(user_id, org_id, db):
    """Helper: verify user is the admin of the organization."""
    org = db.query(Organization).filter(Organization.id == org_id, Organization.deleted_at.is_(None)).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    roles = get_user_roles(user_id, db)
    if org.admin_user_id != user_id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")
    return org


@app.get("/api/resources")
def list_resources(current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """List resources for organizer's organizations."""
    orgs = db.query(Organization).filter(
        Organization.admin_user_id == current_user.id, Organization.deleted_at.is_(None)
    ).all()
    org_ids = [o.id for o in orgs]
    if not org_ids:
        return []
    resources = db.query(Resource).filter(
        Resource.organization_id.in_(org_ids), Resource.deleted_at.is_(None)
    ).all()
    return [ResourceResponse.from_orm(r) for r in resources]


@app.get("/api/resources/{resource_id}", response_model=ResourceResponse)
def get_resource(resource_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Get resource details."""
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)
    return resource


@app.get("/api/resources/{resource_id}/working-hours", response_model=List[WorkingHoursResponse])
def get_resource_working_hours(
    resource_id: int,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)

    working_hours = db.query(ResourceWorkingHours).filter(
        ResourceWorkingHours.resource_id == resource_id
    ).order_by(ResourceWorkingHours.day_of_week.asc()).all()

    return [
        WorkingHoursResponse(
            id=entry.id,  # type: ignore[arg-type]
            resource_id=entry.resource_id,  # type: ignore[arg-type]
            day_of_week=entry.day_of_week,  # type: ignore[arg-type]
            start_time=str(entry.start_time),
            end_time=str(entry.end_time),
            break_start=str(entry.break_start) if entry.break_start else None,  # type: ignore[arg-type]
            break_end=str(entry.break_end) if entry.break_end else None,  # type: ignore[arg-type]
            is_available=entry.is_available,  # type: ignore[arg-type]
        )
        for entry in working_hours
    ]


@app.post("/api/resources", response_model=ResourceResponse, status_code=201)
def create_resource(request: ResourceCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Create a new resource."""
    if request.type not in ("PROVIDER", "ROOM", "EQUIPMENT"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resource type")
    _verify_org_owner(current_user.id, request.organization_id, db)
    resource = Resource(
        organization_id=request.organization_id,
        name=request.name,
        type=request.type,
        description=request.description,
        capacity=request.capacity,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@app.put("/api/resources/{resource_id}", response_model=ResourceResponse)
def update_resource(resource_id: int, request: ResourceUpdateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Update a resource."""
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)
    for key, value in request.dict(exclude_unset=True).items():
        if value is not None:
            setattr(resource, key, value)
    db.commit()
    db.refresh(resource)
    return resource


@app.delete("/api/resources/{resource_id}")
def delete_resource(resource_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Soft delete a resource."""
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)
    resource.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return {"message": "Resource deleted"}


# ==================== Phase 2: Working Hours & Unavailability ====================


@app.post("/api/resources/{resource_id}/working-hours", status_code=201)
def set_working_hours(resource_id: int, request: WorkingHoursCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Set working hours for a resource on a specific day."""
    from datetime import time as _time
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)
    if request.day_of_week < 0 or request.day_of_week > 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="day_of_week must be 0-6")

    existing = db.query(ResourceWorkingHours).filter(
        ResourceWorkingHours.resource_id == resource_id,
        ResourceWorkingHours.day_of_week == request.day_of_week
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Working hours already set for this day. Use PUT to update.")

    wh = ResourceWorkingHours(
        resource_id=resource_id,
        day_of_week=request.day_of_week,
        start_time=_time.fromisoformat(request.start_time),
        end_time=_time.fromisoformat(request.end_time),
        break_start=_time.fromisoformat(request.break_start) if request.break_start else None,
        break_end=_time.fromisoformat(request.break_end) if request.break_end else None,
        is_available=request.is_available,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return {
        "id": wh.id, "resource_id": wh.resource_id, "day_of_week": wh.day_of_week,  # type: ignore[arg-type]
        "start_time": str(wh.start_time), "end_time": str(wh.end_time),
        "break_start": str(wh.break_start) if wh.break_start else None,  # type: ignore[arg-type]
        "break_end": str(wh.break_end) if wh.break_end else None,  # type: ignore[arg-type]
        "is_available": wh.is_available,  # type: ignore[arg-type]
    }


@app.put("/api/resources/{resource_id}/working-hours/{day_of_week}")
def update_working_hours(resource_id: int, day_of_week: int, request: WorkingHoursCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Update working hours for a resource on a specific day."""
    from datetime import time as _time
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)

    wh = db.query(ResourceWorkingHours).filter(
        ResourceWorkingHours.resource_id == resource_id,
        ResourceWorkingHours.day_of_week == day_of_week
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Working hours not found for this day")

    wh.start_time = _time.fromisoformat(request.start_time)  # type: ignore[assignment]
    wh.end_time = _time.fromisoformat(request.end_time)  # type: ignore[assignment]
    wh.break_start = _time.fromisoformat(request.break_start) if request.break_start else None  # type: ignore[assignment]
    wh.break_end = _time.fromisoformat(request.break_end) if request.break_end else None  # type: ignore[assignment]
    wh.is_available = request.is_available  # type: ignore[assignment]
    db.commit()
    return {
        "id": wh.id, "resource_id": wh.resource_id, "day_of_week": wh.day_of_week,  # type: ignore[arg-type]
        "start_time": str(wh.start_time), "end_time": str(wh.end_time),
        "break_start": str(wh.break_start) if wh.break_start else None,  # type: ignore[arg-type]
        "break_end": str(wh.break_end) if wh.break_end else None,  # type: ignore[arg-type]
        "is_available": wh.is_available,  # type: ignore[arg-type]
    }


@app.post("/api/resources/{resource_id}/unavailability", status_code=201)
def add_unavailability(resource_id: int, request: UnavailabilityCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Add an unavailability period for a resource."""
    resource = db.query(Resource).filter(Resource.id == resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    _verify_org_owner(current_user.id, resource.organization_id, db)
    if request.start_date_time >= request.end_date_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start must be before end")
    ua = ResourceUnavailability(
        resource_id=resource_id,
        start_date_time=request.start_date_time,
        end_date_time=request.end_date_time,
        reason=request.reason,
    )
    db.add(ua)
    db.commit()
    db.refresh(ua)
    return UnavailabilityResponse.from_orm(ua)


# ==================== Phase 2: Service-Resource Mapping ====================


@app.post("/api/services/{service_id}/resources", status_code=201)
def assign_resource_to_service(service_id: int, request: ServiceResourceAssignRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Assign a resource to a service."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    resource = db.query(Resource).filter(Resource.id == request.resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    existing = db.query(ServiceResource).filter(
        ServiceResource.service_id == service_id, ServiceResource.resource_id == request.resource_id
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource already assigned to this service")
    sr = ServiceResource(
        service_id=service_id, resource_id=request.resource_id,
        is_required=request.is_required, assignment_type=request.assignment_type,
    )
    db.add(sr)
    db.commit()
    db.refresh(sr)
    return ServiceResourceResponse.from_orm(sr)


@app.put("/api/services/{service_id}/resources/{resource_id}")
def update_service_resource(service_id: int, resource_id: int, request: ServiceResourceUpdateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Update a resource assignment on a service."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    sr = db.query(ServiceResource).filter(
        ServiceResource.service_id == service_id, ServiceResource.resource_id == resource_id
    ).first()
    if not sr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource assignment not found")
    if request.is_required is not None:
        sr.is_required = request.is_required  # type: ignore[assignment]
    if request.assignment_type is not None:
        sr.assignment_type = request.assignment_type  # type: ignore[assignment]
    db.commit()
    db.refresh(sr)
    return ServiceResourceResponse.from_orm(sr)


@app.delete("/api/services/{service_id}/resources/{resource_id}")
def remove_resource_from_service(service_id: int, resource_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Remove a resource from a service."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    deleted = db.query(ServiceResource).filter(
        ServiceResource.service_id == service_id, ServiceResource.resource_id == resource_id
    ).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource assignment not found")
    return {"message": "Resource removed from service"}


# ==================== Phase 2: Form Questions Management ====================


@app.post("/api/services/{service_id}/form-questions", status_code=201)
def create_form_question(service_id: int, request: FormQuestionCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Create a form question for a service."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    valid_types = ("TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT", "CHECKBOX", "DATE")
    if request.field_type not in valid_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid field_type. Must be one of: {valid_types}")
    q = BookingFormQuestion(
        service_id=service_id, question_text=request.question_text,
        field_type=request.field_type, is_required=request.is_required,
        options=request.options, display_order=request.display_order,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return FormQuestionResponse.from_orm(q)


@app.put("/api/services/{service_id}/form-questions/{question_id}")
def update_form_question(service_id: int, question_id: int, request: FormQuestionUpdateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Update a form question."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    q = db.query(BookingFormQuestion).filter(
        BookingFormQuestion.id == question_id, BookingFormQuestion.service_id == service_id
    ).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    for key, value in request.dict(exclude_unset=True).items():
        if value is not None:
            setattr(q, key, value)
    db.commit()
    db.refresh(q)
    return FormQuestionResponse.from_orm(q)


@app.delete("/api/services/{service_id}/form-questions/{question_id}")
def delete_form_question(service_id: int, question_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Delete a form question."""
    service = db.query(Service).filter(Service.id == service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    deleted = db.query(BookingFormQuestion).filter(
        BookingFormQuestion.id == question_id, BookingFormQuestion.service_id == service_id
    ).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return {"message": "Question deleted"}


# ==================== Phase 2: Appointments Endpoints ====================


@app.post("/api/appointments", response_model=AppointmentResponse, status_code=201)
def create_appointment(request: AppointmentCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate service
    start_time = normalize_datetime_to_utc(request.start_time)
    end_time = normalize_datetime_to_utc(request.end_time)

    service = db.query(Service).filter(Service.id == request.service_id, Service.deleted_at.is_(None)).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    # For now require explicit resource selection
    if not request.resource_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="resource_id is required")

    resource = db.query(Resource).filter(Resource.id == request.resource_id, Resource.deleted_at.is_(None)).first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time range")

    # Pessimistic check for overlapping appointments on the resource
    overlapping = db.query(Appointment).filter(
        Appointment.resource_id == resource.id,
        Appointment.status != 'CANCELLED',
        Appointment.start_time < end_time,
        Appointment.end_time > start_time
    ).with_for_update().all()

    used_capacity = sum([a.capacity_used for a in overlapping])
    if used_capacity + request.capacity_used > resource.capacity:  # type: ignore[operator]
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource capacity exceeded for selected slot")

    # Also check service-level capacity
    overlapping_service = db.query(Appointment).filter(
        Appointment.service_id == service.id,
        Appointment.status != 'CANCELLED',
        Appointment.start_time < end_time,
        Appointment.end_time > start_time
    ).with_for_update().all()
    used_service = sum([a.capacity_used for a in overlapping_service])
    if used_service + request.capacity_used > service.capacity:  # type: ignore[operator]
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Service capacity exceeded for selected slot")

    appointment = Appointment(
        service_id=service.id,
        customer_id=current_user.id,
        resource_id=resource.id,
        start_time=start_time,
        end_time=end_time,
        status='CONFIRMED',
        capacity_used=request.capacity_used,
        notes=request.notes,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return appointment


@app.get("/api/appointments", response_model=List[AppointmentResponse])
def list_appointments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = get_user_roles(current_user.id, db)
    if "ORGANIZER" in roles or "ADMIN" in roles:
        # appointments for organizer's services
        services = db.query(Service).filter(Service.created_by == current_user.id).all()
        service_ids = [s.id for s in services]
        if not service_ids:
            return []
        appts = db.query(Appointment).filter(Appointment.service_id.in_(service_ids)).all()
    else:
        appts = db.query(Appointment).filter(Appointment.customer_id == current_user.id).all()

    return appts


@app.get("/api/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(appointment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get appointment details."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    roles = get_user_roles(current_user.id, db)
    # Customer can see own, organizer can see their services' appointments
    if appt.customer_id == current_user.id:
        return appt
    if "ORGANIZER" in roles:
        service = db.query(Service).filter(Service.id == appt.service_id).first()
        if service and service.created_by == current_user.id:
            return appt
    if "ADMIN" in roles:
        return appt
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


@app.put("/api/appointments/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(appointment_id: int, request: RescheduleRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Reschedule an appointment to a new date/time."""
    start_time = normalize_datetime_to_utc(request.start_time)
    end_time = normalize_datetime_to_utc(request.end_time)
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if appt.status == "CANCELLED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reschedule a cancelled appointment")
    if start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time range")

    # Check resource capacity for new time
    if appt.resource_id:
        resource = db.query(Resource).filter(Resource.id == appt.resource_id).first()
        if resource:
            overlapping = db.query(Appointment).filter(
                Appointment.resource_id == appt.resource_id,
                Appointment.id != appt.id,
                Appointment.status != 'CANCELLED',
                Appointment.start_time < end_time,
                Appointment.end_time > start_time
            ).with_for_update().all()
            used = sum(a.capacity_used for a in overlapping)
            if used + appt.capacity_used > resource.capacity:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource capacity exceeded for new time slot")

    appt.start_time = start_time  # type: ignore[assignment]
    appt.end_time = end_time  # type: ignore[assignment]
    appt.status = "RESCHEDULED"  # type: ignore[assignment]
    appt.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    db.refresh(appt)
    return appt


@app.delete("/api/appointments/{appointment_id}")
def cancel_appointment(appointment_id: int, request: Optional[CancelAppointmentRequest] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Cancel an appointment."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.customer_id != current_user.id:  # type: ignore[operator]
        roles = get_user_roles(current_user.id, db)
        if "ADMIN" not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if appt.status == "CANCELLED":  # type: ignore[operator]
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Appointment already cancelled")
    appt.status = "CANCELLED"  # type: ignore[assignment]
    appt.cancelled_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    if request and request.cancellation_reason:
        appt.cancellation_reason = request.cancellation_reason  # type: ignore[assignment]
    appt.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return {"message": "Appointment cancelled"}


@app.get("/api/appointments/{appointment_id}/confirmation")
def get_appointment_confirmation(appointment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get booking confirmation details."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    service = db.query(Service).filter(Service.id == appt.service_id).first()
    roles = get_user_roles(current_user.id, db)
    if appt.customer_id != current_user.id:  # type: ignore[operator]
        can_view_as_owner = bool(service and service.created_by == current_user.id)
        if "ADMIN" not in roles and not can_view_as_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    resource = db.query(Resource).filter(Resource.id == appt.resource_id).first() if appt.resource_id else None
    return {
        "appointment_id": appt.id,
        "status": appt.status,
        "service_name": service.name if service else None,
        "resource_name": resource.name if resource else None,
        "start_time": serialize_datetime(appt.start_time),
        "end_time": serialize_datetime(appt.end_time),
        "capacity_used": appt.capacity_used,
        "notes": appt.notes,
        "created_at": serialize_datetime(appt.created_at),
    }


@app.put("/api/appointments/{appointment_id}/status")
def update_appointment_status(appointment_id: int, request: UpdateStatusRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Update appointment status (Organizer only)."""
    valid_statuses = ("PENDING", "CONFIRMED", "CANCELLED", "RESCHEDULED", "COMPLETED", "NO_SHOW")
    if request.status not in valid_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status. Must be one of: {valid_statuses}")
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    service = db.query(Service).filter(Service.id == appt.service_id).first()
    roles = get_user_roles(current_user.id, db)
    if not service or (service.created_by != current_user.id and "ADMIN" not in roles):  # type: ignore[operator]
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    appt.status = request.status  # type: ignore[assignment]
    if request.status == "CANCELLED":
        appt.cancelled_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    appt.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return {"message": f"Appointment status updated to {request.status}"}


@app.get("/api/appointments/calendar")
def get_appointments_calendar(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    """Get calendar view of appointments for organizer's services."""
    services = db.query(Service).filter(Service.created_by == current_user.id).all()
    service_ids = [s.id for s in services]
    if not service_ids:
        return []
    query = db.query(Appointment).filter(Appointment.service_id.in_(service_ids))
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Appointment.start_time >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Appointment.start_time < ed)
        except ValueError:
            pass
    appts = query.order_by(Appointment.start_time).all()
    result = []
    for a in appts:
        svc = next((s for s in services if s.id == a.service_id), None)
        result.append({
            "id": a.id,
            "service_id": a.service_id,
            "service_name": svc.name if svc else None,
            "customer_id": a.customer_id,
            "resource_id": a.resource_id,
            "start_time": serialize_datetime(a.start_time),
            "end_time": serialize_datetime(a.end_time),
            "status": a.status,
            "capacity_used": a.capacity_used,
        })
    return result


@app.post("/api/appointments/{appointment_id}/form-responses", status_code=201)
def submit_form_responses(appointment_id: int, request: FormResponseSubmitRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit form responses for an appointment."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appt.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    created = []
    for item in request.responses:
        question = db.query(BookingFormQuestion).filter(BookingFormQuestion.id == item.question_id).first()
        if not question:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Question {item.question_id} not found")
        fr = BookingFormResponse(
            appointment_id=appointment_id,
            question_id=item.question_id,
            response=item.response,
        )
        db.add(fr)
        created.append(fr)
    db.commit()
    return {"message": f"{len(created)} responses submitted"}


# ==================== Health Check ====================

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}


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
