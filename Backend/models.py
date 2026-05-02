from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, CheckConstraint, UniqueConstraint, Numeric, Time
from sqlalchemy.sql import func
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    profile_picture_url = Column(String(500), nullable=True)
    preferences = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_token_version = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Google OAuth
    google_id = Column(String(500), unique=True, nullable=True, index=True)
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    google_token_expiry = Column(DateTime(timezone=True), nullable=True)
    google_calendar_id = Column(String(500), nullable=True)
    google_meet_enabled = Column(Boolean, default=False)


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("role IN ('CUSTOMER', 'ORGANIZER', 'ADMIN')"),
        UniqueConstraint('user_id', 'role', name='uq_user_role')  # Unique constraint on (user_id, role)
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hashed_token = Column(String, unique=True, index=True, nullable=False)
    is_revoked = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("expires_at > created_at"),
    )


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    admin_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String, nullable=True)
    logo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    capacity = Column(Integer, default=1, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    shareable_link = Column(String(500), unique=True, nullable=True)
    max_bookings_per_user = Column(Integer, nullable=True)
    requires_advance_payment = Column(Boolean, default=False, nullable=False)
    advance_payment_amount = Column(Numeric(10, 2), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("duration_minutes > 0"),
        CheckConstraint("capacity > 0"),
    )


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(String, nullable=True)
    capacity = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("type IN ('PROVIDER', 'ROOM', 'EQUIPMENT')"),
        CheckConstraint("capacity > 0"),
    )


class ServiceResource(Base):
    __tablename__ = "service_resources"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    is_required = Column(Boolean, default=False, nullable=False)
    assignment_type = Column(String(50), default="MANUAL", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("assignment_type IN ('MANUAL', 'AUTO')"),
        UniqueConstraint('service_id', 'resource_id', name='uq_service_resource')
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), nullable=False, default='PENDING', index=True)
    capacity_used = Column(Integer, default=1, nullable=False)
    notes = Column(String, nullable=True)
    cancellation_reason = Column(String, nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BookingFormQuestion(Base):
    __tablename__ = "booking_form_questions"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(String, nullable=False)
    field_type = Column(String(50), nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    options = Column(String, nullable=True)  # JSON stored as string for simplicity
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BookingFormResponse(Base):
    __tablename__ = "booking_form_responses"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("booking_form_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    response = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ResourceWorkingHours(Base):
    __tablename__ = "resource_working_hours"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Sunday, 6=Saturday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    break_start = Column(Time, nullable=True)
    break_end = Column(Time, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6"),
        UniqueConstraint('resource_id', 'day_of_week', name='uq_resource_day'),
    )


class ResourceUnavailability(Base):
    __tablename__ = "resource_unavailability"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date_time = Column(DateTime(timezone=True), nullable=False)
    end_date_time = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("start_date_time < end_date_time", name='ck_unavailability_datetime_valid'),
    )
