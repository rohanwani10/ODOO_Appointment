# pyright: reportGeneralTypeIssues=false

from fastapi import FastAPI, Depends, HTTPException, status, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone, time as time_type
from typing import Optional, List, Any, Literal
from sqlalchemy import func, text
import httpx
import os
import secrets
import hashlib
import hmac
import json
from pathlib import Path
from uuid import uuid4
from fastapi.responses import StreamingResponse
import io
import csv
import logging
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

from database import engine, get_db, Base
from models import (
    User, UserRole, RefreshToken, Organization, Service, Resource,
    ServiceResource, Appointment, BookingFormQuestion, BookingFormResponse,
    ResourceWorkingHours, ResourceUnavailability, AuditLog, Payment,
    AppointmentVirtualMeeting,
)
from email_service import email_service
from google_oauth_routes import router as google_oauth_router
from schema_manager import sync_schema
from zoom_service import zoom_service
from auth import (
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
    verify_password,
    hash_password,
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
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

BACKEND_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_PROFILES_DIR = UPLOADS_DIR / "profiles"

# ==================== Pydantic Models ====================

class RegisterRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    password: str
    role: Optional[Literal["CUSTOMER", "ORGANIZER"]] = "CUSTOMER"


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
    role: Literal["CUSTOMER", "ORGANIZER", "ADMIN"]


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


class OrganizationCreateRequestAdmin(BaseModel):
    name: str
    description: Optional[str] = None
    admin_user_id: Optional[int] = None
    logo_url: Optional[str] = None


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    admin_user_id: Optional[int] = None
    logo_url: Optional[str] = None


class UserAdminUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class ResourceAdminUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    entity_type: str
    entity_id: str
    action: str
    changes: Optional[str]
    ip_address: Optional[str]
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
    duration_minutes: int = Field(..., gt=0)
    capacity: int = Field(default=1, gt=0)
    is_published: bool = False
    max_bookings_per_user: Optional[int] = Field(default=None, gt=0)
    requires_advance_payment: bool = False
    advance_payment_amount: Optional[float] = Field(default=None, ge=0)
    shareable_link: Optional[str] = None

    @model_validator(mode="after")
    def validate_advance_payment(self) -> "ServiceCreateRequest":
        if self.requires_advance_payment and self.advance_payment_amount is None:
            raise ValueError("advance_payment_amount is required when advance payment is enabled")
        if not self.requires_advance_payment and self.advance_payment_amount not in (None, 0, 0.0):
            raise ValueError("advance_payment_amount must be omitted unless advance payment is enabled")
        return self


class AppointmentCreateRequest(BaseModel):
    service_id: int
    resource_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    capacity_used: int = Field(default=1, gt=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_range(self) -> "AppointmentCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


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


class ShareZoomMeetingRequest(BaseModel):
    recipient_email: EmailStr
    recipient_name: Optional[str] = None


class VirtualMeetingResponse(BaseModel):
    appointment_id: int
    provider: str
    meeting_id: Optional[str] = None
    join_url: str
    start_url: Optional[str] = None
    recipient_email: EmailStr
    sent_at: datetime
    reused_existing_meeting: bool = False

# ==================== Phase 2: Resource Pydantic Models ====================

class ResourceCreateRequest(BaseModel):
    organization_id: int
    name: str
    type: Literal["PROVIDER", "ROOM", "EQUIPMENT"]
    description: Optional[str] = None
    capacity: int = Field(default=1, gt=0)


class ResourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None


class ResourceResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    type: str
    description: Optional[str]
    capacity: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WorkingHoursCreateRequest(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str  # HH:MM:SS
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    is_available: bool = True

    @field_validator("start_time", "end_time", "break_start", "break_end")
    @classmethod
    def validate_time_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            time_type.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Time fields must use HH:MM[:SS] format") from exc
        return value

    @model_validator(mode="after")
    def validate_working_hours(self) -> "WorkingHoursCreateRequest":
        start = time_type.fromisoformat(self.start_time)
        end = time_type.fromisoformat(self.end_time)
        if start >= end:
            raise ValueError("start_time must be before end_time")

        if (self.break_start is None) ^ (self.break_end is None):
            raise ValueError("break_start and break_end must both be provided or both be omitted")

        if self.break_start and self.break_end:
            break_start = time_type.fromisoformat(self.break_start)
            break_end = time_type.fromisoformat(self.break_end)
            if break_start >= break_end:
                raise ValueError("break_start must be before break_end")
            if break_start < start or break_end > end:
                raise ValueError("Breaks must fall within working hours")

        return self


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

    @model_validator(mode="after")
    def validate_unavailability_window(self) -> "UnavailabilityCreateRequest":
        if self.end_date_time <= self.start_date_time:
            raise ValueError("end_date_time must be after start_date_time")
        return self


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
    assignment_type: Literal["MANUAL", "AUTO"] = "MANUAL"


class ServiceResourceUpdateRequest(BaseModel):
    is_required: Optional[bool] = None
    assignment_type: Optional[Literal["MANUAL", "AUTO"]] = None


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
    field_type: Literal["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT", "CHECKBOX", "DATE"]
    is_required: bool = True
    options: Optional[str] = None
    display_order: int = 0


class FormQuestionUpdateRequest(BaseModel):
    question_text: Optional[str] = None
    field_type: Optional[Literal["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT", "CHECKBOX", "DATE"]] = None
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


class FormResponseView(BaseModel):
    id: int
    appointment_id: int
    question_id: int
    question_text: str
    response: str
    created_at: datetime


class RescheduleRequest(BaseModel):
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def validate_time_range(self) -> "RescheduleRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class CancelAppointmentRequest(BaseModel):
    cancellation_reason: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: Literal["PENDING", "CONFIRMED", "CANCELLED", "RESCHEDULED", "COMPLETED", "NO_SHOW"]


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentResponse(BaseModel):
    id: int
    appointment_id: int
    provider: str
    status: str
    amount: float
    currency: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentStatusResponse(BaseModel):
    appointment_id: int
    requires_payment: bool
    amount: float
    currency: str
    is_paid: bool
    latest_payment: Optional[PaymentResponse] = None


class RazorpayOrderResponse(BaseModel):
    appointment_id: int
    key_id: str
    order_id: str
    amount: int
    currency: str
    payment: PaymentResponse


class ServiceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    capacity: Optional[int] = Field(default=None, gt=0)
    is_published: Optional[bool] = None
    max_bookings_per_user: Optional[int] = Field(default=None, gt=0)
    requires_advance_payment: Optional[bool] = None
    advance_payment_amount: Optional[float] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_advance_payment(self) -> "ServiceUpdateRequest":
        if self.requires_advance_payment is False and self.advance_payment_amount not in (None, 0, 0.0):
            raise ValueError("advance_payment_amount must be omitted unless advance payment is enabled")
        return self


# Initialize FastAPI app
app = FastAPI(
    title="Appointment Booking System - Backend",
    version="0.1.0",
    debug=settings.DEBUG
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"],
    allow_credentials=settings.CORS_ORIGINS != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
UPLOADS_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include Google OAuth routes
app.include_router(google_oauth_router)


# ==================== Startup & Teardown ====================

def validate_runtime_configuration() -> None:
    """Reject broken partial configuration and warn when optional integrations are disabled."""
    if settings.SECRET_KEY.startswith("your-secret-key-change-this") and not settings.DEBUG:
        raise RuntimeError("SECRET_KEY must be overridden when DEBUG is disabled")

    smtp_has_partial_config = bool(settings.SMTP_USERNAME) != bool(settings.SMTP_PASSWORD)
    google_has_partial_config = bool(settings.GOOGLE_CLIENT_ID) != bool(settings.GOOGLE_CLIENT_SECRET)
    razorpay_has_partial_config = bool(settings.RAZORPAY_KEY_ID) != bool(settings.RAZORPAY_KEY_SECRET)
    zoom_has_partial_config = (
        len({bool(settings.ZOOM_ACCOUNT_ID), bool(settings.ZOOM_CLIENT_ID), bool(settings.ZOOM_CLIENT_SECRET)}) > 1
    )

    if smtp_has_partial_config:
        logger.warning(
            "SMTP configuration is incomplete; OTP and password-reset email delivery are disabled "
            "until both SMTP_USERNAME and SMTP_PASSWORD are set"
        )
    elif not email_service.is_configured():
        logger.warning("SMTP is not configured; OTP and password-reset email delivery are disabled")

    if google_has_partial_config:
        logger.warning(
            "Google OAuth configuration is incomplete; Google auth/calendar features are disabled "
            "until both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set"
        )
    elif not settings.GOOGLE_CLIENT_ID:
        logger.warning("Google OAuth is not configured; Google auth/calendar features are disabled")

    if razorpay_has_partial_config:
        logger.warning(
            "Razorpay configuration is incomplete; payment features are disabled until both "
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set"
        )
    elif not settings.RAZORPAY_KEY_ID:
        logger.warning("Razorpay is not configured; payment features are disabled")

    if zoom_has_partial_config:
        logger.warning(
            "Zoom configuration is incomplete; organizer meeting-share features are disabled until "
            "ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET are all set"
        )
    elif not settings.ZOOM_ACCOUNT_ID:
        logger.warning("Zoom is not configured; organizer meeting-share features are disabled")

@app.on_event("startup")
def startup():
    validate_runtime_configuration()
    sync_schema(engine)

    logger.info("Database tables checked successfully")


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


def create_audit_log(
    db: Session,
    user_id: Optional[int],
    entity_type: str,
    entity_id: Any,
    action: str,
    changes: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Create a lightweight audit log entry for admin actions."""
    import json

    db.add(AuditLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        changes=json.dumps(changes) if changes is not None else None,
        ip_address=ip_address,
    ))


def user_has_role(user_id: int, role: str, db: Session) -> bool:
    """Return True when the user currently has the given role."""
    return role in get_user_roles(user_id, db)


def is_admin_user(user: User, db: Session) -> bool:
    """Convenience helper for admin checks used by organizer-capable routes."""
    return user_has_role(user.id, "ADMIN", db)


def get_active_organization(org_id: int, db: Session) -> Optional[Organization]:
    """Fetch a non-deleted organization."""
    return db.query(Organization).filter(
        Organization.id == org_id,
        Organization.deleted_at.is_(None),
    ).first()


def get_service_base_query(db: Session):
    """Shared query for services that belong to active organizations."""
    return db.query(Service).join(
        Organization, Organization.id == Service.organization_id
    ).filter(
        Service.deleted_at.is_(None),
        Organization.deleted_at.is_(None),
    )


def get_resource_base_query(db: Session):
    """Shared query for resources that belong to active organizations."""
    return db.query(Resource).join(
        Organization, Organization.id == Resource.organization_id
    ).filter(
        Resource.deleted_at.is_(None),
        Organization.deleted_at.is_(None),
    )


def get_service_or_404(service_id: int, db: Session, require_published: bool = False) -> Service:
    """Fetch a service only if both the service and its organization are active."""
    query = get_service_base_query(db).filter(Service.id == service_id)
    if require_published:
        query = query.filter(Service.is_published.is_(True))

    service = query.first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


def get_resource_or_404(resource_id: int, db: Session, require_active: bool = False) -> Resource:
    """Fetch a resource only if both the resource and its organization are active."""
    query = get_resource_base_query(db).filter(Resource.id == resource_id)
    if require_active:
        query = query.filter(Resource.is_active.is_(True))

    resource = query.first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return resource


def get_manageable_services_query(current_user: User, db: Session):
    """Return the services visible to the current organizer/admin."""
    query = get_service_base_query(db)
    if not is_admin_user(current_user, db):
        query = query.filter(Service.created_by == current_user.id)
    return query


def get_manageable_service_or_404(service_id: int, current_user: User, db: Session) -> Service:
    """Fetch a service only if the current organizer/admin is allowed to manage it."""
    service = get_manageable_services_query(current_user, db).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


def get_manageable_service_ids(current_user: User, db: Session) -> List[int]:
    """Return service IDs visible to the current organizer/admin."""
    return [service.id for service in get_manageable_services_query(current_user, db).all()]


def get_manageable_resources_query(current_user: User, db: Session):
    """Return the resources visible to the current organizer/admin."""
    query = get_resource_base_query(db)
    if not is_admin_user(current_user, db):
        query = query.filter(Organization.admin_user_id == current_user.id)
    return query


def ensure_assignable_organization_admin(user_id: int, db: Session) -> User:
    """Allow organization ownership only for active ORGANIZER/ADMIN users."""
    user = get_user_by_id(user_id, db)
    if user is None or not user.is_active:  # type: ignore[arg-type]
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found")

    roles = get_user_roles(user.id, db)
    if "ADMIN" not in roles and "ORGANIZER" not in roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization owner must have ORGANIZER or ADMIN role",
        )

    return user


def ensure_email_delivery_available() -> None:
    """Fail fast when SMTP is not configured instead of pretending delivery worked."""
    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery is not configured",
        )


def ensure_zoom_delivery_available() -> None:
    """Fail fast when Zoom or SMTP are unavailable for meeting-share actions."""
    ensure_email_delivery_available()
    if not zoom_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Zoom meeting sharing is not configured",
        )


def get_virtual_meeting_for_appointment(appointment_id: int, db: Session) -> Optional[AppointmentVirtualMeeting]:
    return db.query(AppointmentVirtualMeeting).filter(
        AppointmentVirtualMeeting.appointment_id == appointment_id,
        AppointmentVirtualMeeting.provider == "ZOOM",
    ).first()


def serialize_virtual_meeting(
    meeting: AppointmentVirtualMeeting,
    *,
    recipient_email: str,
    reused_existing_meeting: bool,
) -> VirtualMeetingResponse:
    sent_at = meeting.sent_at or datetime.now(timezone.utc)
    return VirtualMeetingResponse(
        appointment_id=meeting.appointment_id,  # type: ignore[arg-type]
        provider=meeting.provider,  # type: ignore[arg-type]
        meeting_id=meeting.external_meeting_id,
        join_url=meeting.join_url or "",
        start_url=meeting.start_url,
        recipient_email=recipient_email,
        sent_at=sent_at,
        reused_existing_meeting=reused_existing_meeting,
    )


def ensure_service_resource_assignment(service_id: int, resource_id: int, db: Session) -> ServiceResource:
    """Require the selected resource to be explicitly assigned to the service."""
    assignment = db.query(ServiceResource).filter(
        ServiceResource.service_id == service_id,
        ServiceResource.resource_id == resource_id,
    ).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected resource is not assigned to this service",
        )
    return assignment


def acquire_booking_capacity_locks(service_id: int, resource_id: int, db: Session) -> None:
    """Serialize booking writes for the relevant service/resource pair across workers and DBs."""
    updated_at = datetime.now(timezone.utc)
    for lock_key in sorted({f"resource:{resource_id}", f"service:{service_id}"}):
        db.execute(
            text(
                """
                INSERT INTO booking_locks (lock_key, updated_at)
                VALUES (:lock_key, :updated_at)
                ON CONFLICT(lock_key) DO NOTHING
                """
            ),
            {"lock_key": lock_key, "updated_at": updated_at},
        )
        db.execute(
            text(
                """
                UPDATE booking_locks
                SET updated_at = :updated_at
                WHERE lock_key = :lock_key
                """
            ),
            {"lock_key": lock_key, "updated_at": updated_at},
        )


ACTIVE_UPCOMING_APPOINTMENT_STATUSES = ("PENDING", "CONFIRMED", "RESCHEDULED")


def build_booking_limit_message(limit: int) -> str:
    """Return a clear per-user booking-limit message for customer-facing conflicts."""
    if limit == 1:
        return (
            "This service allows only 1 active upcoming booking per customer. "
            "Cancel, complete, or reschedule your existing booking before reserving another slot."
        )

    return (
        f"This service allows only {limit} active upcoming bookings per customer. "
        "Cancel, complete, or reschedule an existing booking before reserving another slot."
    )


def validate_appointment_slot(
    *,
    service: Service,
    resource: Resource,
    start_time: datetime,
    end_time: datetime,
    capacity_used: int,
    db: Session,
    customer_id: Optional[int] = None,
    exclude_appointment_id: Optional[int] = None,
) -> None:
    """Enforce service/resource assignment, schedule rules, and capacity checks."""
    if resource.organization_id != service.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected resource does not belong to the service organization",
        )

    if not resource.is_active:  # type: ignore[arg-type]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected resource is inactive",
        )

    ensure_service_resource_assignment(service.id, resource.id, db)
    acquire_booking_capacity_locks(service.id, resource.id, db)

    duration_minutes = int((end_time - start_time).total_seconds() / 60)
    if duration_minutes != service.duration_minutes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Appointments for this service must be exactly {service.duration_minutes} minutes long",
        )

    if start_time.date() != end_time.date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointments must start and end on the same day",
        )

    if capacity_used > service.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested capacity exceeds the service capacity",
        )

    if capacity_used > resource.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested capacity exceeds the resource capacity",
        )

    day_of_week = start_time.isoweekday() % 7
    working_hours = db.query(ResourceWorkingHours).filter(
        ResourceWorkingHours.resource_id == resource.id,
        ResourceWorkingHours.day_of_week == day_of_week,
        ResourceWorkingHours.is_available.is_(True),
    ).first()
    if not working_hours:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resource is not available on the selected day",
        )

    slot_start_time = start_time.time().replace(tzinfo=None)
    slot_end_time = end_time.time().replace(tzinfo=None)
    if slot_start_time < working_hours.start_time or slot_end_time > working_hours.end_time:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Selected time falls outside the resource working hours",
        )

    if (
        working_hours.break_start
        and working_hours.break_end
        and slot_start_time < working_hours.break_end
        and slot_end_time > working_hours.break_start
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Selected time overlaps the resource break window",
        )

    unavailability_query = db.query(ResourceUnavailability).filter(
        ResourceUnavailability.resource_id == resource.id,
        ResourceUnavailability.start_date_time < end_time,
        ResourceUnavailability.end_date_time > start_time,
    )
    if unavailability_query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Selected time overlaps a blocked period for the resource",
        )

    overlapping_resource_query = db.query(Appointment).filter(
        Appointment.resource_id == resource.id,
        Appointment.status != "CANCELLED",
        Appointment.start_time < end_time,
        Appointment.end_time > start_time,
    )
    if exclude_appointment_id is not None:
        overlapping_resource_query = overlapping_resource_query.filter(Appointment.id != exclude_appointment_id)
    overlapping_resource_appointments = overlapping_resource_query.with_for_update().all()
    used_resource_capacity = sum(appointment.capacity_used for appointment in overlapping_resource_appointments)
    if used_resource_capacity + capacity_used > resource.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resource capacity exceeded for the selected slot",
        )

    overlapping_service_query = db.query(Appointment).filter(
        Appointment.service_id == service.id,
        Appointment.status != "CANCELLED",
        Appointment.start_time < end_time,
        Appointment.end_time > start_time,
    )
    if exclude_appointment_id is not None:
        overlapping_service_query = overlapping_service_query.filter(Appointment.id != exclude_appointment_id)
    overlapping_service_appointments = overlapping_service_query.with_for_update().all()
    used_service_capacity = sum(appointment.capacity_used for appointment in overlapping_service_appointments)
    if used_service_capacity + capacity_used > service.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Service capacity exceeded for the selected slot",
        )

    if customer_id is not None and service.max_bookings_per_user:
        now_utc = datetime.now(timezone.utc)
        existing_customer_bookings = db.query(Appointment).filter(
            Appointment.service_id == service.id,
            Appointment.customer_id == customer_id,
            Appointment.status.in_(ACTIVE_UPCOMING_APPOINTMENT_STATUSES),
            Appointment.end_time >= now_utc,
        )
        if exclude_appointment_id is not None:
            existing_customer_bookings = existing_customer_bookings.filter(Appointment.id != exclude_appointment_id)
        active_booking_count = existing_customer_bookings.count()
        if active_booking_count >= service.max_bookings_per_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=build_booking_limit_message(service.max_bookings_per_user),
            )


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
    chosen_role = request.role or "CUSTOMER"
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
    ensure_email_delivery_available()
    user = get_user_by_email(request.email, db)
    
    if not user:
        return {"message": "If the account exists, an OTP has been sent"}
    
    # Generate OTP
    otp = generate_otp()
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minutes expiry
    
    # Update user with OTP
    user.otp_code = otp  # type: ignore[assignment]
    user.otp_expires_at = otp_expires  # type: ignore[assignment]
    db.commit()
    
    # Send OTP via email
    if not send_otp_email(user.email, otp):
        user.otp_code = None  # type: ignore[assignment]
        user.otp_expires_at = None  # type: ignore[assignment]
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send OTP email at this time",
        )
    
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
    if not revoke_refresh_token(request.refresh_token, db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid refresh token",
        )
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
    ensure_email_delivery_available()
    user = get_user_by_email(request.email, db)
    
    if not user:
        # For security, don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate password reset token
    next_token_version = int(user.password_reset_token_version) + 1  # type: ignore[arg-type]
    user.password_reset_token_version = next_token_version  # type: ignore[assignment]
    reset_token = generate_password_reset_token(
        user.id,
        user.email,
        next_token_version,
    )  # type: ignore[arg-type]
    
    # Send reset email
    if not send_password_reset_email(user.email, reset_token):  # type: ignore[arg-type]
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send password reset email at this time",
        )

    db.commit()
    
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

    if token_data.get("token_version") != user.password_reset_token_version:  # type: ignore[arg-type]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password
    user.hashed_password = hash_password(request.new_password)  # type: ignore[assignment]
    user.password_reset_token_version = int(user.password_reset_token_version) + 1  # type: ignore[assignment,arg-type]
    user.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
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
    revoke_refresh_token(request.refresh_token, db, user_id)
    
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


# ==================== Phase 3: Profile Management ====================


class PreferencesRequest(BaseModel):
    preferences: Optional[dict] = None


@app.post("/api/users/me/photo")
def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and attach a profile photo to the current user."""
    # Ensure uploads/profiles exists
    UPLOADS_PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    # Validate file type and size
    MAX_BYTES = 5 * 1024 * 1024  # 5 MB
    allowed_ext = {"png", "jpg", "jpeg", "gif", "webp"}

    # Basic MIME check
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image uploads are allowed")

    # Read up to MAX_BYTES+1 to detect oversized files
    content = file.file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 5MB)")

    # Validate extension
    filename = (file.filename or "profile").lower()
    ext = filename.split(".")[-1] if "." in filename else ""
    if ext not in allowed_ext:
        # if extension not present or not allowed, still accept if MIME is image/* but normalize ext to png
        ext = "png"

    unique_name = f"{current_user.id}_{uuid4().hex}.{ext}"
    path = UPLOADS_PROFILES_DIR / unique_name

    with open(path, "wb") as f:
        f.write(content)

    # Save URL to user
    current_user.profile_picture_url = f"/uploads/profiles/{unique_name}"  # type: ignore[assignment]
    current_user.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    db.refresh(current_user)

    return {"profile_picture_url": current_user.profile_picture_url}


# ==================== Customer Endpoints (aliases per docs) ====================


@app.get("/api/customers/profile", response_model=UserDetailResponse)
def get_customer_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Alias for GET /api/users/me to match documentation."""
    roles = get_user_roles(current_user.id, db)
    user_data = UserResponse.from_orm(current_user).dict()
    user_data['roles'] = roles
    return UserDetailResponse(**user_data)


@app.put("/api/customers/profile", response_model=UserDetailResponse)
def put_customer_profile(request: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Alias for PUT /api/users/me to match documentation."""
    # reuse existing update logic
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


@app.get("/api/customers/appointment-history", response_model=List[AppointmentResponse])
def customer_appointment_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return past appointments for the authenticated customer."""
    now = normalize_datetime_to_utc(datetime.now(timezone.utc))
    appts = db.query(Appointment).filter(
        Appointment.customer_id == current_user.id,
        Appointment.end_time < now
    ).order_by(Appointment.start_time.desc()).all()
    return appts


@app.get("/api/customers/upcoming-appointments", response_model=List[AppointmentResponse])
def customer_upcoming_appointments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return upcoming/future appointments for the authenticated customer."""
    now = normalize_datetime_to_utc(datetime.now(timezone.utc))
    appts = db.query(Appointment).filter(
        Appointment.customer_id == current_user.id,
        Appointment.start_time >= now,
        Appointment.status != 'CANCELLED'
    ).order_by(Appointment.start_time.asc()).all()
    return appts


@app.get("/api/users/me/preferences")
def get_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = None
    if current_user.preferences:
        try:
            import json
            prefs = json.loads(current_user.preferences)
        except Exception:
            prefs = None
    return {"preferences": prefs}


@app.put("/api/users/me/preferences")
def update_preferences(request: PreferencesRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import json
    current_user.preferences = json.dumps(request.preferences or {})  # type: ignore[assignment]
    current_user.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    db.refresh(current_user)
    return {"preferences": request.preferences or {}}



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
    current_user.password_reset_token_version = int(current_user.password_reset_token_version) + 1  # type: ignore[assignment,arg-type]
    current_user.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
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
    
    result = add_user_role(user_id, request.role, db, commit=False)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to assign role"
        )

    create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="USER",
        entity_id=user_id,
        action="ASSIGN_ROLE",
        changes={"role": request.role},
    )
    db.commit()
    
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
    
    if not remove_user_role(user_id, role, db, commit=False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove role"
        )

    create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="USER",
        entity_id=user_id,
        action="REMOVE_ROLE",
        changes={"role": role},
    )
    db.commit()
    
    return {"message": f"Role {role} removed from user"}


@app.delete("/api/admin/users/{user_id}")
def soft_delete_user_endpoint(
    user_id: int,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """Soft delete a user (Admin only)."""
    if not soft_delete_user(user_id, db, commit=False):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="USER",
        entity_id=user_id,
        action="DELETE",
    )
    db.commit()
    
    return {"message": "User deleted successfully"}


@app.put("/api/admin/users/{user_id}", response_model=UserDetailResponse)
def update_admin_user(
    user_id: int,
    request: UserAdminUpdateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    """Update user details (Admin only)."""
    user = get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    before = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "is_active": user.is_active,
    }

    if request.first_name is not None:
        user.first_name = request.first_name  # type: ignore[assignment]
    if request.last_name is not None:
        user.last_name = request.last_name  # type: ignore[assignment]
    if request.phone is not None:
        user.phone = request.phone  # type: ignore[assignment]
    if request.is_active is not None:
        user.is_active = request.is_active  # type: ignore[assignment]

    user.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="USER",
        entity_id=user.id,
        action="UPDATE",
        changes={"before": before, "after": {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "is_active": user.is_active,
        }},
    )
    db.commit()
    db.refresh(user)

    roles = get_user_roles(user.id, db)
    user_data = UserResponse.from_orm(user).dict()
    user_data["roles"] = roles
    return UserDetailResponse(**user_data)


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


@app.get("/api/admin/organizations", response_model=List[OrganizationResponse])
def admin_list_organizations(
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    organizations = db.query(Organization).filter(Organization.deleted_at.is_(None)).order_by(Organization.created_at.desc()).all()
    return [OrganizationResponse.from_orm(org) for org in organizations]


@app.post("/api/admin/organizations", response_model=OrganizationResponse, status_code=201)
def admin_create_organization(
    request: OrganizationCreateRequestAdmin,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    admin_user_id = request.admin_user_id or current_user.id
    ensure_assignable_organization_admin(admin_user_id, db)

    organization = Organization(
        name=request.name,
        description=request.description,
        admin_user_id=admin_user_id,
        logo_url=request.logo_url,
    )
    db.add(organization)
    db.flush()
    create_audit_log(db, current_user.id, "ORGANIZATION", organization.id, "CREATE", {"name": request.name, "admin_user_id": admin_user_id})
    db.commit()
    db.refresh(organization)
    return organization


@app.put("/api/admin/organizations/{org_id}", response_model=OrganizationResponse)
def admin_update_organization(
    org_id: int,
    request: OrganizationUpdateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    organization = db.query(Organization).filter(Organization.id == org_id, Organization.deleted_at.is_(None)).first()
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    before = {
        "name": organization.name,
        "description": organization.description,
        "admin_user_id": organization.admin_user_id,
        "logo_url": organization.logo_url,
    }

    if request.name is not None:
        organization.name = request.name  # type: ignore[assignment]
    if request.description is not None:
        organization.description = request.description  # type: ignore[assignment]
    if request.logo_url is not None:
        organization.logo_url = request.logo_url  # type: ignore[assignment]
    if request.admin_user_id is not None:
        ensure_assignable_organization_admin(request.admin_user_id, db)
        organization.admin_user_id = request.admin_user_id  # type: ignore[assignment]

    organization.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    create_audit_log(db, current_user.id, "ORGANIZATION", organization.id, "UPDATE", {"before": before, "after": {
        "name": organization.name,
        "description": organization.description,
        "admin_user_id": organization.admin_user_id,
        "logo_url": organization.logo_url,
    }})
    db.commit()
    db.refresh(organization)
    return organization


@app.delete("/api/admin/organizations/{org_id}")
def admin_delete_organization(
    org_id: int,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    organization = db.query(Organization).filter(Organization.id == org_id, Organization.deleted_at.is_(None)).first()
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    deleted_at = datetime.now(timezone.utc)
    organization.deleted_at = deleted_at  # type: ignore[assignment]
    db.query(Service).filter(
        Service.organization_id == organization.id,
        Service.deleted_at.is_(None),
    ).update(
        {
            Service.deleted_at: deleted_at,
            Service.is_published: False,
        },
        synchronize_session=False,
    )
    db.query(Resource).filter(
        Resource.organization_id == organization.id,
        Resource.deleted_at.is_(None),
    ).update(
        {
            Resource.deleted_at: deleted_at,
            Resource.is_active: False,
        },
        synchronize_session=False,
    )
    create_audit_log(db, current_user.id, "ORGANIZATION", organization.id, "DELETE")
    db.commit()
    return {"message": "Organization deleted successfully"}


@app.get("/api/admin/providers")
def admin_list_providers(
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    providers = get_resource_base_query(db).filter(
        Resource.type == "PROVIDER",
    ).order_by(Resource.created_at.desc()).all()
    return [ResourceResponse.from_orm(provider) for provider in providers]


@app.get("/api/admin/providers/{provider_id}", response_model=ResourceResponse)
def admin_get_provider(
    provider_id: int,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    provider = get_resource_or_404(provider_id, db)
    if provider.type != "PROVIDER":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider


@app.put("/api/admin/providers/{provider_id}", response_model=ResourceResponse)
def admin_update_provider(
    provider_id: int,
    request: ResourceAdminUpdateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    provider = get_resource_or_404(provider_id, db)
    if provider.type != "PROVIDER":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    before = {
        "name": provider.name,
        "description": provider.description,
        "capacity": provider.capacity,
        "is_active": provider.is_active,
    }

    if request.name is not None:
        provider.name = request.name  # type: ignore[assignment]
    if request.description is not None:
        provider.description = request.description  # type: ignore[assignment]
    if request.capacity is not None:
        provider.capacity = request.capacity  # type: ignore[assignment]
    if request.is_active is not None:
        provider.is_active = request.is_active  # type: ignore[assignment]

    provider.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    create_audit_log(db, current_user.id, "RESOURCE", provider.id, "UPDATE", {"before": before, "after": {
        "name": provider.name,
        "description": provider.description,
        "capacity": provider.capacity,
        "is_active": provider.is_active,
    }})
    db.commit()
    db.refresh(provider)
    return provider


# ==================== Phase 2: Services Endpoints ====================


def generate_unique_shareable_link(db: Session) -> str:
    """Generate a unique public share token for a service."""
    for _ in range(10):
        candidate = secrets.token_urlsafe(16)
        exists = db.query(Service.id).filter(Service.shareable_link == candidate).first()
        if not exists:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to generate a unique shareable link",
    )


@app.get("/api/services", response_model=List[ServiceResponse])
def list_services(db: Session = Depends(get_db)):
    """List published services."""
    services = get_service_base_query(db).filter(Service.is_published.is_(True)).all()
    return services


@app.get("/api/organizer/services", response_model=List[ServiceResponse])
def list_organizer_services(
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    services = get_manageable_services_query(current_user, db).order_by(Service.created_at.desc()).all()
    return services


@app.get("/api/organizer/services/{service_id}", response_model=ServiceResponse)
def get_organizer_service(
    service_id: int,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    return get_manageable_service_or_404(service_id, current_user, db)


@app.get("/api/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    return get_service_or_404(service_id, db, require_published=True)


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
    if service.is_published and not service.shareable_link:
        service.shareable_link = generate_unique_shareable_link(db)  # type: ignore[assignment]
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@app.put("/api/services/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, request: ServiceUpdateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    service = get_service_or_404(service_id, db)

    # only creator or admin can update
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this service")

    for key, value in request.dict(exclude_unset=True).items():
        setattr(service, key, value)
    if request.requires_advance_payment is False:
        service.advance_payment_amount = None  # type: ignore[assignment]
    if service.is_published and not service.shareable_link:
        service.shareable_link = generate_unique_shareable_link(db)  # type: ignore[assignment]

    db.commit()
    db.refresh(service)
    return service


@app.post("/api/services/{service_id}/publish")
def publish_service(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    service = get_service_or_404(service_id, db)
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    service.is_published = True  # type: ignore[assignment]
    if not service.shareable_link:
        service.shareable_link = generate_unique_shareable_link(db)  # type: ignore[assignment]
    db.commit()
    return {"message": "Service published", "shareable_link": service.shareable_link}


@app.post("/api/services/{service_id}/unpublish")
def unpublish_service(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    service = get_service_or_404(service_id, db)
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
    service = get_service_or_404(service_id, db)
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    service.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return {"message": "Service deleted"}


@app.post("/api/services/{service_id}/shareable-link")
def generate_shareable_link(service_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Generate a shareable link for a service."""
    service = get_service_or_404(service_id, db)
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    link = generate_unique_shareable_link(db)
    service.shareable_link = link  # type: ignore[assignment]
    db.commit()
    return {"shareable_link": link}


@app.get("/api/services/shareable/{shareable_link}", response_model=ServiceResponse)
def get_service_by_shareable_link(shareable_link: str, db: Session = Depends(get_db)):
    """Get a service by its shareable link."""
    service = get_service_base_query(db).filter(
        Service.shareable_link == shareable_link,
        Service.is_published.is_(True),
    ).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


# ==================== Phase 2: Service Discovery ====================


@app.get("/api/services/{service_id}/resources")
def get_service_resources(service_id: int, db: Session = Depends(get_db)):
    """Get resources assigned to a service."""
    get_service_or_404(service_id, db, require_published=True)
    sr_records = db.query(ServiceResource).filter(ServiceResource.service_id == service_id).all()
    resource_ids = [sr.resource_id for sr in sr_records]
    if not resource_ids:
        return []
    resources = get_resource_base_query(db).filter(
        Resource.id.in_(resource_ids),
        Resource.is_active.is_(True),
    ).all()
    return [ResourceResponse.from_orm(r) for r in resources]


@app.get("/api/organizer/services/{service_id}/resources", response_model=List[ServiceResourceResponse])
def get_organizer_service_resources(
    service_id: int,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    """Get raw resource assignments for a manageable service, including draft services."""
    get_manageable_service_or_404(service_id, current_user, db)
    assignments = db.query(ServiceResource).filter(
        ServiceResource.service_id == service_id
    ).order_by(ServiceResource.created_at.asc()).all()
    return [ServiceResourceResponse.from_orm(assignment) for assignment in assignments]


@app.get("/api/services/{service_id}/availability")
def get_service_availability(
    service_id: int,
    date: str,
    resource_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get available time slots for a service on a given date."""
    from datetime import time as time_type

    service = get_service_or_404(service_id, db, require_published=True)

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Use YYYY-MM-DD")

    day_of_week = target_date.isoweekday() % 7  # 0=Sunday

    # Determine which resources to check
    if resource_id:
        resource = get_resource_or_404(resource_id, db, require_active=True)
        if resource.organization_id != service.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected resource does not belong to the service organization",
            )
        ensure_service_resource_assignment(service_id, resource_id, db)
        resources = [resource]
    else:
        sr_records = db.query(ServiceResource).filter(ServiceResource.service_id == service_id).all()
        r_ids = [sr.resource_id for sr in sr_records]
        if not r_ids:
            return []
        resources = get_resource_base_query(db).filter(
            Resource.id.in_(r_ids),
            Resource.is_active.is_(True),
        ).all()

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
    get_service_or_404(service_id, db, require_published=True)
    questions = db.query(BookingFormQuestion).filter(
        BookingFormQuestion.service_id == service_id
    ).order_by(BookingFormQuestion.display_order).all()
    return [FormQuestionResponse.from_orm(q) for q in questions]


@app.get("/api/organizer/services/{service_id}/form-questions", response_model=List[FormQuestionResponse])
def get_organizer_form_questions(
    service_id: int,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    """Get custom form questions for a manageable service, including draft services."""
    get_manageable_service_or_404(service_id, current_user, db)
    questions = db.query(BookingFormQuestion).filter(
        BookingFormQuestion.service_id == service_id
    ).order_by(BookingFormQuestion.display_order.asc(), BookingFormQuestion.id.asc()).all()
    return [FormQuestionResponse.from_orm(q) for q in questions]


# ==================== Phase 2: Resource Management ====================


def _verify_org_owner(user_id, org_id, db):
    """Helper: verify user is the admin of the organization."""
    org = get_active_organization(org_id, db)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    roles = get_user_roles(user_id, db)
    if org.admin_user_id != user_id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")
    return org


@app.get("/api/resources")
def list_resources(current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """List resources for organizer's organizations."""
    resources = get_manageable_resources_query(current_user, db).all()
    return [ResourceResponse.from_orm(r) for r in resources]


@app.get("/api/resources/{resource_id}", response_model=ResourceResponse)
def get_resource(resource_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Get resource details."""
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)
    return resource


@app.get("/api/resources/{resource_id}/working-hours", response_model=List[WorkingHoursResponse])
def get_resource_working_hours(
    resource_id: int,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    resource = get_resource_or_404(resource_id, db)
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
    resource = get_resource_or_404(resource_id, db)
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
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)
    resource.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    return {"message": "Resource deleted"}


# ==================== Phase 2: Working Hours & Unavailability ====================


@app.post("/api/resources/{resource_id}/working-hours", status_code=201)
def set_working_hours(resource_id: int, request: WorkingHoursCreateRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Set working hours for a resource on a specific day."""
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)

    existing = db.query(ResourceWorkingHours).filter(
        ResourceWorkingHours.resource_id == resource_id,
        ResourceWorkingHours.day_of_week == request.day_of_week
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Working hours already set for this day. Use PUT to update.")

    wh = ResourceWorkingHours(
        resource_id=resource_id,
        day_of_week=request.day_of_week,
        start_time=time_type.fromisoformat(request.start_time),
        end_time=time_type.fromisoformat(request.end_time),
        break_start=time_type.fromisoformat(request.break_start) if request.break_start else None,
        break_end=time_type.fromisoformat(request.break_end) if request.break_end else None,
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
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)

    if request.day_of_week != day_of_week:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_week in the path must match the request body",
        )

    wh = db.query(ResourceWorkingHours).filter(
        ResourceWorkingHours.resource_id == resource_id,
        ResourceWorkingHours.day_of_week == day_of_week
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Working hours not found for this day")

    wh.start_time = time_type.fromisoformat(request.start_time)  # type: ignore[assignment]
    wh.end_time = time_type.fromisoformat(request.end_time)  # type: ignore[assignment]
    wh.break_start = time_type.fromisoformat(request.break_start) if request.break_start else None  # type: ignore[assignment]
    wh.break_end = time_type.fromisoformat(request.break_end) if request.break_end else None  # type: ignore[assignment]
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
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)
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


@app.get("/api/resources/{resource_id}/unavailability", response_model=List[UnavailabilityResponse])
def list_unavailability(resource_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """List unavailability periods for a resource."""
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)
    periods = db.query(ResourceUnavailability).filter(
        ResourceUnavailability.resource_id == resource_id
    ).order_by(ResourceUnavailability.start_date_time.desc()).all()
    return [UnavailabilityResponse.from_orm(period) for period in periods]


@app.delete("/api/resources/{resource_id}/unavailability/{unavailability_id}")
def delete_unavailability(resource_id: int, unavailability_id: int, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Delete an unavailability period for a resource."""
    resource = get_resource_or_404(resource_id, db)
    _verify_org_owner(current_user.id, resource.organization_id, db)
    deleted = db.query(ResourceUnavailability).filter(
        ResourceUnavailability.id == unavailability_id,
        ResourceUnavailability.resource_id == resource_id,
    ).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unavailability not found")
    return {"message": "Unavailability deleted"}


# ==================== Phase 2: Service-Resource Mapping ====================


@app.post("/api/services/{service_id}/resources", status_code=201)
def assign_resource_to_service(service_id: int, request: ServiceResourceAssignRequest, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Assign a resource to a service."""
    service = get_service_or_404(service_id, db)
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    resource = get_resource_or_404(request.resource_id, db)
    if resource.organization_id != service.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resource and service must belong to the same organization",
        )
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
    service = get_service_or_404(service_id, db)
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
    service = get_service_or_404(service_id, db)
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
    service = get_service_or_404(service_id, db)
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
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
    service = get_service_or_404(service_id, db)
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
    service = get_service_or_404(service_id, db)
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


def ensure_razorpay_configured() -> None:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay payments are not configured",
        )


def get_appointment_or_404(appointment_id: int, db: Session) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return appointment


def get_viewable_appointment_or_404(appointment_id: int, current_user: User, db: Session) -> Appointment:
    appointment = get_appointment_or_404(appointment_id, db)
    roles = get_user_roles(current_user.id, db)
    if appointment.customer_id == current_user.id:
        return appointment
    if "ADMIN" in roles:
        return appointment
    if "ORGANIZER" in roles:
        service = db.query(Service).filter(Service.id == appointment.service_id).first()
        if service and service.created_by == current_user.id:
            return appointment
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")


def get_appointment_payment_amount(service: Service, appointment: Appointment) -> Decimal:
    advance_amount = Decimal(str(service.advance_payment_amount or 0))
    return (advance_amount * Decimal(int(appointment.capacity_used or 1))).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def serialize_payment(payment: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=payment.id,  # type: ignore[arg-type]
        appointment_id=payment.appointment_id,  # type: ignore[arg-type]
        provider=payment.provider,  # type: ignore[arg-type]
        status=payment.status,  # type: ignore[arg-type]
        amount=float(payment.amount),  # type: ignore[arg-type]
        currency=payment.currency,  # type: ignore[arg-type]
        razorpay_order_id=payment.razorpay_order_id,  # type: ignore[arg-type]
        razorpay_payment_id=payment.razorpay_payment_id,  # type: ignore[arg-type]
        verified_at=payment.verified_at,  # type: ignore[arg-type]
        created_at=payment.created_at,  # type: ignore[arg-type]
        updated_at=payment.updated_at,  # type: ignore[arg-type]
    )


def get_latest_payment_for_appointment(appointment_id: int, db: Session) -> Optional[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.appointment_id == appointment_id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .first()
    )


def build_payment_status_response(appointment: Appointment, service: Service, db: Session) -> PaymentStatusResponse:
    latest_payment = get_latest_payment_for_appointment(appointment.id, db)
    amount = (
        get_appointment_payment_amount(service, appointment)
        if service.requires_advance_payment and service.advance_payment_amount
        else Decimal("0.00")
    )
    is_paid = bool(latest_payment and latest_payment.status in {"AUTHORIZED", "CAPTURED"})
    return PaymentStatusResponse(
        appointment_id=appointment.id,  # type: ignore[arg-type]
        requires_payment=bool(service.requires_advance_payment),
        amount=float(amount),
        currency=settings.RAZORPAY_CURRENCY,
        is_paid=is_paid,
        latest_payment=serialize_payment(latest_payment) if latest_payment else None,
    )


def get_or_create_zoom_meeting_for_appointment(
    appointment: Appointment,
    service: Service,
    resource: Optional[Resource],
    db: Session,
) -> tuple[AppointmentVirtualMeeting, bool]:
    existing_meeting = get_virtual_meeting_for_appointment(appointment.id, db)
    appointment_updated_at = normalize_datetime_to_utc(appointment.updated_at or appointment.created_at)

    if (
        existing_meeting
        and existing_meeting.join_url
        and existing_meeting.updated_at
        and normalize_datetime_to_utc(existing_meeting.updated_at) >= appointment_updated_at
    ):
        return existing_meeting, True

    organizer = get_user_by_id(service.created_by, db)
    customer = get_user_by_id(appointment.customer_id, db)
    topic = f"{service.name} appointment #{appointment.id}"
    agenda_parts = [
        f"Service: {service.name}",
        f"Customer: {customer.first_name} {customer.last_name}".strip() if customer else None,
        f"Resource: {resource.name}" if resource else None,
        f"Notes: {appointment.notes}" if appointment.notes else None,
    ]
    agenda = "\n".join(part for part in agenda_parts if part)
    meeting_payload = zoom_service.create_scheduled_meeting(
        topic=topic,
        start_time=normalize_datetime_to_utc(appointment.start_time),
        end_time=normalize_datetime_to_utc(appointment.end_time),
        agenda=agenda,
    )

    now_utc = datetime.now(timezone.utc)
    if existing_meeting is None:
        existing_meeting = AppointmentVirtualMeeting(
            appointment_id=appointment.id,
            provider="ZOOM",
        )
        db.add(existing_meeting)

    existing_meeting.external_meeting_id = str(meeting_payload.get("id") or "")  # type: ignore[assignment]
    existing_meeting.join_url = meeting_payload.get("join_url")  # type: ignore[assignment]
    existing_meeting.start_url = meeting_payload.get("start_url")  # type: ignore[assignment]
    existing_meeting.meeting_password = (
        meeting_payload.get("password") or meeting_payload.get("encrypted_password")
    )  # type: ignore[assignment]
    existing_meeting.host_email = (
        str(meeting_payload.get("host_email"))
        if meeting_payload.get("host_email") is not None
        else organizer.email if organizer else None
    )  # type: ignore[assignment]
    existing_meeting.meeting_payload = json.dumps(meeting_payload)  # type: ignore[assignment]
    existing_meeting.updated_at = now_utc  # type: ignore[assignment]
    db.flush()

    if not existing_meeting.join_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Zoom did not return a join URL for the meeting",
        )

    return existing_meeting, False


def razorpay_request(method: str, path: str, payload: Optional[dict] = None) -> dict:
    ensure_razorpay_configured()
    base_url = "https://api.razorpay.com/v1"
    with httpx.Client(timeout=20.0) as client:
        response = client.request(
            method,
            f"{base_url}{path}",
            json=payload,
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        )

    if response.is_success:
        return response.json()

    try:
        error_payload = response.json()
        message = (
            error_payload.get("error", {}).get("description")
            or error_payload.get("error", {}).get("reason")
            or error_payload.get("error", {}).get("code")
            or "Razorpay request failed"
        )
    except Exception:
        message = "Razorpay request failed"

    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> None:
    ensure_razorpay_configured()
    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Razorpay payment signature",
        )


@app.post("/api/appointments", response_model=AppointmentResponse, status_code=201)
def create_appointment(request: AppointmentCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate service
    start_time = normalize_datetime_to_utc(request.start_time)
    end_time = normalize_datetime_to_utc(request.end_time)

    service = get_service_or_404(request.service_id, db, require_published=True)

    # For now require explicit resource selection
    if not request.resource_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="resource_id is required")

    resource = get_resource_or_404(request.resource_id, db, require_active=True)
    validate_appointment_slot(
        service=service,
        resource=resource,
        start_time=start_time,
        end_time=end_time,
        capacity_used=request.capacity_used,
        customer_id=current_user.id,
        db=db,
    )

    appointment = Appointment(
        service_id=service.id,
        customer_id=current_user.id,
        resource_id=resource.id,
        start_time=start_time,
        end_time=end_time,
        status='PENDING' if service.requires_advance_payment else 'CONFIRMED',
        capacity_used=request.capacity_used,
        notes=request.notes,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    # Send appointment confirmation email with calendar link
    try:
        email_service.send_appointment_confirmation_email(
            email=current_user.email,
            user_name=current_user.first_name,
            service_name=service.name,
            start_time=start_time,
            end_time=end_time,
            resource_name=resource.name,
            notes=request.notes or ""
        )
    except Exception as e:
        logger.warning(f"Failed to send appointment confirmation email: {str(e)}")
        # Don't fail the appointment creation if email fails

    return appointment


@app.get("/api/appointments", response_model=List[AppointmentResponse])
def list_appointments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = get_user_roles(current_user.id, db)
    if "ADMIN" in roles:
        appts = db.query(Appointment).order_by(Appointment.start_time.desc()).all()
    elif "ORGANIZER" in roles:
        service_ids = get_manageable_service_ids(current_user, db)
        if not service_ids:
            return []
        appts = db.query(Appointment).filter(Appointment.service_id.in_(service_ids)).order_by(Appointment.start_time.desc()).all()
    else:
        appts = db.query(Appointment).filter(Appointment.customer_id == current_user.id).order_by(Appointment.start_time.desc()).all()

    return appts


@app.get("/api/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(appointment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get appointment details."""
    return get_viewable_appointment_or_404(appointment_id, current_user, db)


@app.get("/api/payments/appointments/{appointment_id}", response_model=PaymentStatusResponse)
def get_appointment_payment_status(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = get_viewable_appointment_or_404(appointment_id, current_user, db)
    service = get_service_or_404(appointment.service_id, db)
    return build_payment_status_response(appointment, service, db)


@app.post("/api/payments/appointments/{appointment_id}/order", response_model=RazorpayOrderResponse)
def create_appointment_payment_order(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = get_viewable_appointment_or_404(appointment_id, current_user, db)
    service = get_service_or_404(appointment.service_id, db)

    if appointment.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the customer can initiate payment for this appointment",
        )

    if not service.requires_advance_payment or not service.advance_payment_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This appointment does not require advance payment",
        )

    latest_payment = get_latest_payment_for_appointment(appointment.id, db)
    if latest_payment and latest_payment.status in {"AUTHORIZED", "CAPTURED"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This appointment is already paid",
        )

    amount = get_appointment_payment_amount(service, appointment)
    amount_paise = int((amount * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    db.query(Payment).filter(
        Payment.appointment_id == appointment.id,
        Payment.status == "CREATED",
    ).update({Payment.status: "CANCELLED"}, synchronize_session=False)

    order_data = razorpay_request(
        "POST",
        "/orders",
        payload={
            "amount": amount_paise,
            "currency": settings.RAZORPAY_CURRENCY,
            "receipt": f"appointment_{appointment.id}_{int(datetime.now(timezone.utc).timestamp())}",
            "notes": {
                "appointment_id": str(appointment.id),
                "service_id": str(service.id),
                "customer_id": str(appointment.customer_id),
            },
        },
    )

    payment = Payment(
        appointment_id=appointment.id,
        provider="RAZORPAY",
        status="CREATED",
        amount=amount,
        currency=settings.RAZORPAY_CURRENCY,
        razorpay_order_id=order_data.get("id"),
        gateway_response=json.dumps(order_data),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return RazorpayOrderResponse(
        appointment_id=appointment.id,  # type: ignore[arg-type]
        key_id=settings.RAZORPAY_KEY_ID,
        order_id=order_data["id"],
        amount=amount_paise,
        currency=settings.RAZORPAY_CURRENCY,
        payment=serialize_payment(payment),
    )


@app.post("/api/payments/appointments/{appointment_id}/verify", response_model=PaymentStatusResponse)
def verify_appointment_payment(
    appointment_id: int,
    request: RazorpayVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = get_viewable_appointment_or_404(appointment_id, current_user, db)
    if appointment.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the customer can verify payment for this appointment",
        )

    service = get_service_or_404(appointment.service_id, db)
    if not service.requires_advance_payment or not service.advance_payment_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This appointment does not require advance payment",
        )

    payment = db.query(Payment).filter(
        Payment.appointment_id == appointment.id,
        Payment.razorpay_order_id == request.razorpay_order_id,
    ).order_by(Payment.id.desc()).first()

    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")

    verify_razorpay_signature(
        request.razorpay_order_id,
        request.razorpay_payment_id,
        request.razorpay_signature,
    )

    payment_details = razorpay_request("GET", f"/payments/{request.razorpay_payment_id}")
    gateway_status = str(payment_details.get("status") or "").lower()
    if gateway_status == "captured":
        next_status = "CAPTURED"
    elif gateway_status == "authorized":
        next_status = "AUTHORIZED"
    else:
        next_status = "FAILED"

    payment.status = next_status  # type: ignore[assignment]
    payment.razorpay_payment_id = request.razorpay_payment_id  # type: ignore[assignment]
    payment.razorpay_signature = request.razorpay_signature  # type: ignore[assignment]
    payment.gateway_response = json.dumps(payment_details)  # type: ignore[assignment]
    payment.verified_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    payment.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]

    if next_status in {"AUTHORIZED", "CAPTURED"} and appointment.status == "PENDING":
        appointment.status = "CONFIRMED"  # type: ignore[assignment]
        appointment.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]

    db.commit()
    db.refresh(payment)
    db.refresh(appointment)

    return build_payment_status_response(appointment, service, db)


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
    if not appt.resource_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Appointment has no resource to reschedule")

    service = get_service_or_404(appt.service_id, db)
    resource = get_resource_or_404(appt.resource_id, db, require_active=True)
    validate_appointment_slot(
        service=service,
        resource=resource,
        start_time=start_time,
        end_time=end_time,
        capacity_used=appt.capacity_used,
        customer_id=current_user.id,
        exclude_appointment_id=appt.id,
        db=db,
    )

    appt.start_time = start_time  # type: ignore[assignment]
    appt.end_time = end_time  # type: ignore[assignment]
    appt.status = "RESCHEDULED"  # type: ignore[assignment]
    appt.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    db.refresh(appt)

    # Send rescheduled appointment confirmation email with updated calendar link
    try:
        service = db.query(Service).filter(Service.id == appt.service_id).first()
        resource = db.query(Resource).filter(Resource.id == appt.resource_id).first() if appt.resource_id else None
        if service:
            email_service.send_appointment_confirmation_email(
                email=current_user.email,
                user_name=current_user.first_name,
                service_name=service.name,
                start_time=start_time,
                end_time=end_time,
                resource_name=resource.name if resource else "",
                notes=appt.notes or ""
            )
    except Exception as e:
        logger.warning(f"Failed to send rescheduled appointment email: {str(e)}")

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
    customer = db.query(User).filter(User.id == appt.customer_id).first()
    roles = get_user_roles(current_user.id, db)
    if appt.customer_id != current_user.id:  # type: ignore[operator]
        can_view_as_owner = bool(service and service.created_by == current_user.id)
        if "ADMIN" not in roles and not can_view_as_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    resource = db.query(Resource).filter(Resource.id == appt.resource_id).first() if appt.resource_id else None
    virtual_meeting = get_virtual_meeting_for_appointment(appt.id, db)
    return {
        "appointment_id": appt.id,
        "status": appt.status,
        "service_name": service.name if service else None,
        "resource_name": resource.name if resource else None,
        "customer_email": customer.email if customer else None,
        "customer_name": (
            f"{customer.first_name} {customer.last_name}".strip()
            if customer
            else None
        ),
        "start_time": serialize_datetime(appt.start_time),
        "end_time": serialize_datetime(appt.end_time),
        "capacity_used": appt.capacity_used,
        "notes": appt.notes,
        "virtual_meeting_provider": virtual_meeting.provider if virtual_meeting else None,
        "virtual_meeting_join_url": virtual_meeting.join_url if virtual_meeting else None,
        "virtual_meeting_start_url": virtual_meeting.start_url if virtual_meeting else None,
        "created_at": serialize_datetime(appt.created_at),
    }


@app.post("/api/appointments/{appointment_id}/zoom-share", response_model=VirtualMeetingResponse)
def share_zoom_meeting(
    appointment_id: int,
    request: ShareZoomMeetingRequest,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db),
):
    """Create or reuse a Zoom meeting for an appointment and email the join link."""
    ensure_zoom_delivery_available()

    appointment = get_appointment_or_404(appointment_id, db)
    if appointment.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot share a Zoom meeting for a cancelled appointment",
        )

    service = get_service_or_404(appointment.service_id, db)
    roles = get_user_roles(current_user.id, db)
    if service.created_by != current_user.id and "ADMIN" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    resource = db.query(Resource).filter(Resource.id == appointment.resource_id).first() if appointment.resource_id else None
    customer = db.query(User).filter(User.id == appointment.customer_id).first()
    recipient_name = (
        request.recipient_name.strip()
        if request.recipient_name and request.recipient_name.strip()
        else (
            f"{customer.first_name} {customer.last_name}".strip()
            if customer and customer.email == request.recipient_email
            else "there"
        )
    )

    try:
        virtual_meeting, reused_existing_meeting = get_or_create_zoom_meeting_for_appointment(
            appointment,
            service,
            resource,
            db,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    db.commit()
    db.refresh(virtual_meeting)

    email_sent = email_service.send_zoom_meeting_invite_email(
        email=request.recipient_email,
        recipient_name=recipient_name,
        organizer_name=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
        service_name=service.name,
        start_time=normalize_datetime_to_utc(appointment.start_time),
        end_time=normalize_datetime_to_utc(appointment.end_time),
        join_url=virtual_meeting.join_url or "",
        resource_name=resource.name if resource else None,
        notes=appointment.notes,
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Zoom meeting created, but email delivery failed",
        )

    now_utc = datetime.now(timezone.utc)
    virtual_meeting.recipient_email = request.recipient_email  # type: ignore[assignment]
    virtual_meeting.sent_at = now_utc  # type: ignore[assignment]
    virtual_meeting.updated_at = now_utc  # type: ignore[assignment]
    db.commit()
    db.refresh(virtual_meeting)

    return serialize_virtual_meeting(
        virtual_meeting,
        recipient_email=request.recipient_email,
        reused_existing_meeting=reused_existing_meeting,
    )


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

    if appt.status == "CANCELLED" and request.status != "CANCELLED":
        if not appt.resource_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancelled appointment cannot be restored without a resource")
        resource = get_resource_or_404(appt.resource_id, db, require_active=True)
        validate_appointment_slot(
            service=get_service_or_404(appt.service_id, db),
            resource=resource,
            start_time=normalize_datetime_to_utc(appt.start_time),
            end_time=normalize_datetime_to_utc(appt.end_time),
            capacity_used=appt.capacity_used,
            customer_id=appt.customer_id,
            exclude_appointment_id=appt.id,
            db=db,
        )

    appt.status = request.status  # type: ignore[assignment]
    if request.status == "CANCELLED":
        appt.cancelled_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    else:
        appt.cancelled_at = None  # type: ignore[assignment]
        appt.cancellation_reason = None  # type: ignore[assignment]
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
    services = get_manageable_services_query(current_user, db).all()
    service_ids = [service.id for service in services]
    if not service_ids:
        return []
    query = db.query(Appointment).filter(Appointment.service_id.in_(service_ids))
    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
            query = query.filter(Appointment.start_time >= sd)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
            query = query.filter(Appointment.start_time < ed)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
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
        question = db.query(BookingFormQuestion).filter(
            BookingFormQuestion.id == item.question_id,
            BookingFormQuestion.service_id == appt.service_id,
        ).first()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Question {item.question_id} not found for this appointment",
            )
        fr = BookingFormResponse(
            appointment_id=appointment_id,
            question_id=item.question_id,
            response=item.response,
        )
        db.add(fr)
        created.append(fr)
    db.commit()
    return {"message": f"{len(created)} responses submitted"}


@app.get("/api/appointments/{appointment_id}/form-responses", response_model=List[FormResponseView])
def get_form_responses(appointment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get submitted form responses for an appointment."""
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    roles = get_user_roles(current_user.id, db)
    if appt.customer_id != current_user.id:
        service = db.query(Service).filter(Service.id == appt.service_id).first()
        is_manageable = bool(service and service.created_by == current_user.id)
        if "ADMIN" not in roles and not is_manageable:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    responses = db.query(BookingFormResponse, BookingFormQuestion.question_text).join(
        BookingFormQuestion,
        BookingFormQuestion.id == BookingFormResponse.question_id,
    ).filter(
        BookingFormResponse.appointment_id == appointment_id
    ).order_by(BookingFormResponse.created_at.asc()).all()

    return [
        FormResponseView(
            id=response.id,  # type: ignore[arg-type]
            appointment_id=response.appointment_id,  # type: ignore[arg-type]
            question_id=response.question_id,  # type: ignore[arg-type]
            question_text=question_text,
            response=response.response,  # type: ignore[arg-type]
            created_at=response.created_at,  # type: ignore[arg-type]
        )
        for response, question_text in responses
    ]


# ==================== Phase 3: Reports & Insights (Organizer) ====================


class AppointmentReportItem(BaseModel):
    date: str
    count: int


class ResourceUtilizationItem(BaseModel):
    resource_id: int
    resource_name: Optional[str]
    total_appointments: int
    total_minutes_booked: float


@app.get("/api/organizer/reports/appointments", response_model=List[AppointmentReportItem])
def organizer_appointments_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    """Return appointments count grouped by date for organizer's services."""
    # default to last 30 days
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        ed = normalize_datetime_to_utc(datetime.now(timezone.utc) + timedelta(days=1))

    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        sd = ed - timedelta(days=30)

    services = get_manageable_services_query(current_user, db).all()
    service_ids = [s.id for s in services]
    if not service_ids:
        return []

    rows = db.query(func.date(Appointment.start_time).label('date'), func.count(Appointment.id).label('count')).filter(
        Appointment.service_id.in_(service_ids),
        Appointment.start_time >= sd,
        Appointment.start_time < ed
    ).group_by(func.date(Appointment.start_time)).order_by(func.date(Appointment.start_time)).all()

    result = []
    for r in rows:
        # r[0] is date (datetime.date)
        d = r[0].isoformat() if hasattr(r[0], 'isoformat') else str(r[0])
        result.append(AppointmentReportItem(date=d, count=int(r[1])))
    return result


@app.get("/api/organizer/reports/resource-utilization", response_model=List[ResourceUtilizationItem])
def organizer_resource_utilization(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_role("ORGANIZER", "ADMIN")),
    db: Session = Depends(get_db)
):
    """Return resource utilization metrics for organizer's resources."""
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        ed = normalize_datetime_to_utc(datetime.now(timezone.utc) + timedelta(days=1))

    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        sd = ed - timedelta(days=30)

    resources = get_manageable_resources_query(current_user, db).filter(Resource.is_active.is_(True)).all()
    result = []
    for r in resources:
        appts = db.query(Appointment).filter(
            Appointment.resource_id == r.id,
            Appointment.start_time >= sd,
            Appointment.start_time < ed,
            Appointment.status != 'CANCELLED'
        ).all()
        total_appointments = len(appts)
        total_minutes = 0.0
        for a in appts:
            try:
                delta = (a.end_time - a.start_time).total_seconds() / 60.0
                total_minutes += delta
            except Exception:
                pass
        result.append(ResourceUtilizationItem(
            resource_id=r.id, resource_name=r.name, total_appointments=total_appointments, total_minutes_booked=round(total_minutes, 2)
        ))
    return result


# === Documentation-aligned report endpoints (/api/reports/*) ===


@app.get("/api/reports/appointments", response_model=List[AppointmentReportItem])
def reports_appointments(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    return organizer_appointments_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)


@app.get("/api/reports/resource-utilization", response_model=List[ResourceUtilizationItem])
def reports_resource_utilization(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    return organizer_resource_utilization(start_date=start_date, end_date=end_date, current_user=current_user, db=db)


@app.get("/api/reports/bookings")
def reports_bookings(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Return bookings grouped by service with counts. Matches documented /api/reports/bookings."""
    # reuse service list
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        ed = normalize_datetime_to_utc(datetime.now(timezone.utc) + timedelta(days=1))
    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        sd = ed - timedelta(days=30)

    services = get_manageable_services_query(current_user, db).all()
    service_ids = [s.id for s in services]
    if not service_ids:
        return []

    rows = db.query(Service.id, Service.name, func.count(Appointment.id).label('count')).join(Appointment, Appointment.service_id == Service.id).filter(
        Service.id.in_(service_ids), Appointment.start_time >= sd, Appointment.start_time < ed
    ).group_by(Service.id, Service.name).all()

    return [{"service_id": r[0], "service_name": r[1], "count": int(r[2])} for r in rows]


@app.get("/api/reports/revenue")
def reports_revenue(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Estimate revenue from advance payments (best-effort).
    Uses service.advance_payment_amount * appointment.capacity_used for appointments where requires_advance_payment is True.
    """
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        ed = normalize_datetime_to_utc(datetime.now(timezone.utc) + timedelta(days=1))
    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        sd = ed - timedelta(days=30)

    services = get_manageable_services_query(current_user, db).all()
    service_ids = [s.id for s in services]
    if not service_ids:
        return {"revenue": 0.0}

    total = 0.0
    appts = db.query(Appointment).filter(Appointment.service_id.in_(service_ids), Appointment.start_time >= sd, Appointment.start_time < ed).all()
    svc_map = {s.id: s for s in services}
    for a in appts:
        svc = svc_map.get(a.service_id)
        if svc and svc.requires_advance_payment and svc.advance_payment_amount:
            try:
                total += float(svc.advance_payment_amount) * (a.capacity_used or 1)
            except Exception:
                pass
    return {"revenue": round(total, 2)}


@app.get("/api/reports/customer-insights")
def reports_customer_insights(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Return top customers by number of bookings for organizer."""
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        ed = normalize_datetime_to_utc(datetime.now(timezone.utc) + timedelta(days=1))
    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        sd = ed - timedelta(days=30)

    services = get_manageable_services_query(current_user, db).all()
    service_ids = [s.id for s in services]
    if not service_ids:
        return []

    rows = db.query(Appointment.customer_id, func.count(Appointment.id).label('count')).filter(
        Appointment.service_id.in_(service_ids), Appointment.start_time >= sd, Appointment.start_time < ed
    ).group_by(Appointment.customer_id).order_by(func.count(Appointment.id).desc()).limit(10).all()

    result = []
    for r in rows:
        user = get_user_by_id(r[0], db)
        result.append({"customer_id": r[0], "email": user.email if user else None, "count": int(r[1])})
    return result


@app.get("/api/reports/export")
def reports_export(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(require_role("ORGANIZER", "ADMIN")), db: Session = Depends(get_db)):
    """Export appointments CSV for organizer's services for a date range."""
    if end_date:
        try:
            ed = normalize_datetime_to_utc(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format. Use YYYY-MM-DD")
    else:
        ed = normalize_datetime_to_utc(datetime.now(timezone.utc) + timedelta(days=1))
    if start_date:
        try:
            sd = normalize_datetime_to_utc(datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format. Use YYYY-MM-DD")
    else:
        sd = ed - timedelta(days=30)

    services = get_manageable_services_query(current_user, db).all()
    service_ids = [s.id for s in services]
    if not service_ids:
        return StreamingResponse(io.StringIO(""), media_type="text/csv")

    appts = db.query(Appointment).filter(Appointment.service_id.in_(service_ids), Appointment.start_time >= sd, Appointment.start_time < ed).order_by(Appointment.start_time).all()

    def iter_csv():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["id", "service_id", "customer_id", "resource_id", "start_time", "end_time", "status", "capacity_used"])
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
        for a in appts:
            writer.writerow([a.id, a.service_id, a.customer_id, a.resource_id, serialize_datetime(a.start_time), serialize_datetime(a.end_time), a.status, a.capacity_used])
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(iter_csv(), media_type="text/csv")


@app.get("/api/admin/dashboard")
def admin_dashboard(current_user: User = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    """System-wide dashboard metrics for admins."""
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
    total_organizations = db.query(Organization).filter(Organization.deleted_at.is_(None)).count()
    total_services = get_service_base_query(db).count()
    total_resources = get_resource_base_query(db).count()
    total_providers = get_resource_base_query(db).filter(Resource.type == "PROVIDER").count()
    total_appointments = db.query(Appointment).count()
    upcoming_appointments = db.query(Appointment).filter(Appointment.start_time >= datetime.now(timezone.utc), Appointment.status != 'CANCELLED').count()

    return {
        "total_users": total_users,
        "total_organizations": total_organizations,
        "total_services": total_services,
        "total_resources": total_resources,
        "total_providers": total_providers,
        "total_appointments": total_appointments,
        "upcoming_appointments": upcoming_appointments,
    }


@app.get("/api/admin/reports/system-metrics")
def admin_system_metrics(current_user: User = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    """High-level system metrics for admins."""
    role_counts = {
        "customers": db.query(UserRole).join(User, User.id == UserRole.user_id).filter(UserRole.role == "CUSTOMER", User.deleted_at.is_(None)).count(),
        "organizers": db.query(UserRole).join(User, User.id == UserRole.user_id).filter(UserRole.role == "ORGANIZER", User.deleted_at.is_(None)).count(),
        "admins": db.query(UserRole).join(User, User.id == UserRole.user_id).filter(UserRole.role == "ADMIN", User.deleted_at.is_(None)).count(),
    }
    active_services = get_service_base_query(db).filter(Service.is_published.is_(True)).count()
    active_providers = get_resource_base_query(db).filter(Resource.type == "PROVIDER", Resource.is_active.is_(True)).count()
    total_appointments = db.query(Appointment).count()
    cancelled_appointments = db.query(Appointment).filter(Appointment.status == "CANCELLED").count()
    return {
        "role_counts": role_counts,
        "active_services": active_services,
        "active_providers": active_providers,
        "total_appointments": total_appointments,
        "cancelled_appointments": cancelled_appointments,
    }


@app.get("/api/admin/reports/audit-logs", response_model=List[AuditLogResponse])
def admin_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@app.get("/api/admin/reports/revenue")
def admin_revenue_report(current_user: User = Depends(require_role("ADMIN")), db: Session = Depends(get_db)):
    """System-wide estimated revenue (best-effort) from services requiring advance payment."""
    services = get_service_base_query(db).all()
    service_map = {service.id: service for service in services}
    appts = db.query(Appointment).filter(Appointment.status != 'CANCELLED').all()
    total = 0.0
    for appointment in appts:
        service = service_map.get(appointment.service_id)
        if service and service.requires_advance_payment and service.advance_payment_amount:
            try:
                total += float(service.advance_payment_amount) * (appointment.capacity_used or 1)
            except Exception:
                pass
    return {"revenue": round(total, 2)}


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
