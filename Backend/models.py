"""SQLAlchemy models for the appointment backend."""

# pyright: reportAssignmentType=false

from typing import Any, Optional

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, CheckConstraint, UniqueConstraint, Numeric, Time
from sqlalchemy.sql import func
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id: Any = Column(Integer, primary_key=True, index=True)
    email: Any = Column(String, unique=True, index=True, nullable=False)
    first_name: Any = Column(String(100), nullable=False)
    last_name: Any = Column(String(100), nullable=False)
    phone: Any = Column(String(20), nullable=True)
    profile_picture_url: Any = Column(String(500), nullable=True)
    preferences: Any = Column(String, nullable=True)
    hashed_password: Any = Column(String, nullable=False)
    is_verified: Any = Column(Boolean, default=False)
    otp_code: Any = Column(String(6), nullable=True)
    otp_expires_at: Any = Column(DateTime(timezone=True), nullable=True)
    password_reset_token_version: Any = Column(Integer, default=0, nullable=False)
    is_active: Any = Column(Boolean, default=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Any = Column(DateTime(timezone=True), nullable=True)
    
    # Google OAuth
    google_id: Any = Column(String(500), unique=True, nullable=True, index=True)
    google_access_token: Any = Column(String, nullable=True)
    google_refresh_token: Any = Column(String, nullable=True)
    google_token_expiry: Any = Column(DateTime(timezone=True), nullable=True)
    google_calendar_id: Any = Column(String(500), nullable=True)
    google_meet_enabled: Any = Column(Boolean, default=False)


class UserRole(Base):
    __tablename__ = "user_roles"

    id: Any = Column(Integer, primary_key=True, index=True)
    user_id: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Any = Column(String(50), nullable=False, index=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("role IN ('CUSTOMER', 'ORGANIZER', 'ADMIN')"),
        UniqueConstraint('user_id', 'role', name='uq_user_role')  # Unique constraint on (user_id, role)
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Any = Column(Integer, primary_key=True, index=True)
    user_id: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hashed_token: Any = Column(String, unique=True, index=True, nullable=False)
    is_revoked: Any = Column(Boolean, default=False, index=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    expires_at: Any = Column(DateTime(timezone=True), nullable=False)
    last_used_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("expires_at > created_at"),
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Any = Column(Integer, primary_key=True, index=True)
    name: Any = Column(String(255), nullable=False)
    admin_user_id: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Any = Column(String, nullable=True)
    logo_url: Any = Column(String(500), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Any = Column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Any = Column(Integer, primary_key=True, index=True)
    user_id: Any = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    entity_type: Any = Column(String(100), nullable=False, index=True)
    entity_id: Any = Column(String(100), nullable=False, index=True)
    action: Any = Column(String(50), nullable=False)
    changes: Any = Column(String, nullable=True)
    ip_address: Any = Column(String(45), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())


class Service(Base):
    __tablename__ = "services"

    id: Any = Column(Integer, primary_key=True, index=True)
    organization_id: Any = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Any = Column(String(255), nullable=False)
    description: Any = Column(String, nullable=True)
    duration_minutes: Any = Column(Integer, nullable=False)
    capacity: Any = Column(Integer, default=1, nullable=False)
    is_published: Any = Column(Boolean, default=False, nullable=False)
    shareable_link: Any = Column(String(500), unique=True, nullable=True)
    max_bookings_per_user: Any = Column(Integer, nullable=True)
    requires_advance_payment: Any = Column(Boolean, default=False, nullable=False)
    advance_payment_amount: Any = Column(Numeric(10, 2), nullable=True)
    created_by: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Any = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("duration_minutes > 0"),
        CheckConstraint("capacity > 0"),
    )


class Resource(Base):
    __tablename__ = "resources"

    id: Any = Column(Integer, primary_key=True, index=True)
    organization_id: Any = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Any = Column(String(255), nullable=False)
    type: Any = Column(String(50), nullable=False)
    description: Any = Column(String, nullable=True)
    capacity: Any = Column(Integer, default=1, nullable=False)
    is_active: Any = Column(Boolean, default=True, nullable=False)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Any = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("type IN ('PROVIDER', 'ROOM', 'EQUIPMENT')"),
        CheckConstraint("capacity > 0"),
    )


class ServiceResource(Base):
    __tablename__ = "service_resources"

    id: Any = Column(Integer, primary_key=True, index=True)
    service_id: Any = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id: Any = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    is_required: Any = Column(Boolean, default=False, nullable=False)
    assignment_type: Any = Column(String(50), default="MANUAL", nullable=False)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("assignment_type IN ('MANUAL', 'AUTO')"),
        UniqueConstraint('service_id', 'resource_id', name='uq_service_resource')
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id: Any = Column(Integer, primary_key=True, index=True)
    service_id: Any = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    customer_id: Any = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    resource_id: Any = Column(Integer, ForeignKey("resources.id"), nullable=True, index=True)
    start_time: Any = Column(DateTime(timezone=True), nullable=False)
    end_time: Any = Column(DateTime(timezone=True), nullable=False)
    status: Any = Column(String(50), nullable=False, default='PENDING', index=True)
    capacity_used: Any = Column(Integer, default=1, nullable=False)
    notes: Any = Column(String, nullable=True)
    cancellation_reason: Any = Column(String, nullable=True)
    cancelled_at: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BookingFormQuestion(Base):
    __tablename__ = "booking_form_questions"

    id: Any = Column(Integer, primary_key=True, index=True)
    service_id: Any = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text: Any = Column(String, nullable=False)
    field_type: Any = Column(String(50), nullable=False)
    is_required: Any = Column(Boolean, default=True, nullable=False)
    options: Any = Column(String, nullable=True)  # JSON stored as string for simplicity
    display_order: Any = Column(Integer, nullable=False, default=0)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BookingFormResponse(Base):
    __tablename__ = "booking_form_responses"

    id: Any = Column(Integer, primary_key=True, index=True)
    appointment_id: Any = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Any = Column(Integer, ForeignKey("booking_form_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    response: Any = Column(String, nullable=False)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())


class Payment(Base):
    __tablename__ = "payments"

    id: Any = Column(Integer, primary_key=True, index=True)
    appointment_id: Any = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Any = Column(String(50), nullable=False, default="RAZORPAY", index=True)
    status: Any = Column(String(50), nullable=False, default="CREATED", index=True)
    amount: Any = Column(Numeric(10, 2), nullable=False)
    currency: Any = Column(String(8), nullable=False, default="INR")
    razorpay_order_id: Any = Column(String(255), unique=True, nullable=True, index=True)
    razorpay_payment_id: Any = Column(String(255), unique=True, nullable=True, index=True)
    razorpay_signature: Any = Column(String(500), nullable=True)
    gateway_response: Any = Column(String, nullable=True)
    verified_at: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("provider IN ('RAZORPAY')"),
        CheckConstraint("status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED')"),
        CheckConstraint("amount >= 0"),
    )


class AppointmentVirtualMeeting(Base):
    __tablename__ = "appointment_virtual_meetings"

    id: Any = Column(Integer, primary_key=True, index=True)
    appointment_id: Any = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Any = Column(String(50), nullable=False, default="ZOOM", index=True)
    external_meeting_id: Any = Column(String(255), nullable=True)
    join_url: Any = Column(String(1000), nullable=True)
    start_url: Any = Column(String(2000), nullable=True)
    meeting_password: Any = Column(String(255), nullable=True)
    host_email: Any = Column(String(255), nullable=True)
    recipient_email: Any = Column(String(255), nullable=True)
    meeting_payload: Any = Column(String, nullable=True)
    sent_at: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("provider IN ('ZOOM')"),
        UniqueConstraint("appointment_id", "provider", name="uq_appointment_virtual_meeting"),
    )


class ResourceWorkingHours(Base):
    __tablename__ = "resource_working_hours"

    id: Any = Column(Integer, primary_key=True, index=True)
    resource_id: Any = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week: Any = Column(Integer, nullable=False)  # 0=Sunday, 6=Saturday
    start_time: Any = Column(Time, nullable=False)
    end_time: Any = Column(Time, nullable=False)
    break_start: Any = Column(Time, nullable=True)
    break_end: Any = Column(Time, nullable=True)
    is_available: Any = Column(Boolean, default=True, nullable=False)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6"),
        UniqueConstraint('resource_id', 'day_of_week', name='uq_resource_day'),
    )


class ResourceUnavailability(Base):
    __tablename__ = "resource_unavailability"

    id: Any = Column(Integer, primary_key=True, index=True)
    resource_id: Any = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date_time: Any = Column(DateTime(timezone=True), nullable=False)
    end_date_time: Any = Column(DateTime(timezone=True), nullable=False)
    reason: Any = Column(String(255), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("start_date_time < end_date_time", name='ck_unavailability_datetime_valid'),
    )


class BookingLock(Base):
    __tablename__ = "booking_locks"

    lock_key: Any = Column(String(255), primary_key=True)
    updated_at: Any = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
