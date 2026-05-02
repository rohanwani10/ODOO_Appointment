# Database Schema Design – Appointment Booking System

## Overview
This schema supports a multi-tenant appointment booking system with role-based access, resource management, and real-time availability tracking.

---

## Core Entities

### 1. Users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT email_valid CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);
```

### 2. User Roles
```sql
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('CUSTOMER', 'ORGANIZER', 'ADMIN')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);
```

### 3. Organizations (Optional - for multi-tenant support)
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    admin_user_id UUID NOT NULL REFERENCES users(id),
    description TEXT,
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### 4. Services/Appointment Types
```sql
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
    is_published BOOLEAN DEFAULT FALSE,
    shareable_link VARCHAR(500) UNIQUE,
    max_bookings_per_user INT,
    requires_advance_payment BOOLEAN DEFAULT FALSE,
    advance_payment_amount DECIMAL(10, 2),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### 5. Resources (Providers, Rooms, Equipment)
```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('PROVIDER', 'ROOM', 'EQUIPMENT')),
    description TEXT,
    capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### 6. Service-Resource Mapping
```sql
CREATE TABLE service_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT FALSE,
    assignment_type VARCHAR(50) DEFAULT 'MANUAL' CHECK (assignment_type IN ('MANUAL', 'AUTO')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, resource_id)
);
```

### 7. Resource Working Hours
```sql
CREATE TABLE resource_working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_id, day_of_week),
    CONSTRAINT time_valid CHECK (start_time < end_time)
);
```

### 8. Resource Unavailability (Holidays, Maintenance, etc.)
```sql
CREATE TABLE resource_unavailability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    start_date_time TIMESTAMP NOT NULL,
    end_date_time TIMESTAMP NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT datetime_valid CHECK (start_date_time < end_date_time)
);
```

### 9. Appointments/Bookings
```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    resource_id UUID REFERENCES resources(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN 
        ('PENDING', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW')),
    capacity_used INT NOT NULL DEFAULT 1 CHECK (capacity_used > 0),
    notes TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT datetime_valid CHECK (start_time < end_time)
);

-- Index for efficient querying
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_service ON appointments(service_id);
CREATE INDEX idx_appointments_resource ON appointments(resource_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_time_range ON appointments(start_time, end_time);
```

### 10. Custom Booking Form Questions
```sql
CREATE TABLE booking_form_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'DATE')),
    is_required BOOLEAN DEFAULT TRUE,
    options JSON, -- For SELECT/CHECKBOX types
    display_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 11. Booking Form Responses
```sql
CREATE TABLE booking_form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES booking_form_questions(id) ON DELETE CASCADE,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 12. Payments
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) CHECK (payment_method IN ('CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CRYPTO')),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    transaction_id VARCHAR(255) UNIQUE,
    payment_gateway VARCHAR(100), -- Stripe, PayPal, etc.
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 13. Audit Log
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    entity_type VARCHAR(100) NOT NULL, -- 'APPOINTMENT', 'SERVICE', etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'CANCEL'
    changes JSONB, -- Before/after values
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

---

## Key Design Decisions

### 1. **Concurrency & Double-Booking Prevention**
- Use **pessimistic locking** on resource availability during booking
- Maintain transaction atomicity for appointment creation + payment
- Time-range indexes enable efficient slot availability queries

### 2. **Real-time Availability**
- Compute slots from `resource_working_hours` + `resource_unavailability` + existing `appointments`
- Cache computed slots with short TTL (Redis) for performance
- Query pattern: `SELECT availability WHERE start_time >= NOW() AND resource_id = ?`

### 3. **Scalability**
- Partitioning: Appointments table can be partitioned by `created_at` (monthly/yearly)
- Separate analytics table for reporting without impacting transactional queries
- Denormalize frequently accessed fields (resource capacity, service duration)

### 4. **Soft Deletes**
- All main entities use soft deletes (`deleted_at`) for audit trails and GDPR compliance
- Queries should filter: `WHERE deleted_at IS NULL`

### 5. **Capacity Management**
- Track both resource capacity and appointment capacity usage
- Support overbooking prevention: `SUM(capacity_used) <= resource_capacity`

### 6. **Audit Trail**
- Immutable audit log captures all state changes
- Supports compliance, debugging, and user disputes

---

## Data Integrity Constraints

| Constraint | Details |
|-----------|---------|
| **No Double Booking** | Application-level lock + DB unique constraint on (resource_id, time_range) |
| **Valid Time Ranges** | start_time < end_time enforced at DB level |
| **Appointment Duration** | Duration must match service configuration |
| **Resource Capacity** | Total capacity_used in overlapping appointments ≤ resource capacity |
| **Service Availability** | Appointment time must fall within resource working hours |

---

## Query Patterns

### Find Available Slots for a Service
```sql
WITH unavailable_times AS (
    SELECT start_time, end_time FROM appointments 
    WHERE resource_id = $1 AND status NOT IN ('CANCELLED')
    UNION ALL
    SELECT start_date_time, end_date_time FROM resource_unavailability 
    WHERE resource_id = $1
)
SELECT generate_slot_times($1, $2, $3) -- resource_id, start_date, end_date
EXCEPT
SELECT * FROM unavailable_times;
```

### Check Double-Booking Risk
```sql
SELECT COUNT(*) FROM appointments 
WHERE resource_id = $1 
  AND status NOT IN ('CANCELLED')
  AND start_time < $3 
  AND end_time > $2
FOR UPDATE; -- Pessimistic lock
```

### Dashboard Analytics
```sql
SELECT 
    DATE_TRUNC('hour', start_time) as hour,
    COUNT(*) as booking_count,
    service_id,
    status
FROM appointments
WHERE resource_id = $1 AND start_time >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('hour', start_time), service_id, status
ORDER BY hour DESC;
```

---

## Performance Optimizations

| Optimization | Benefit |
|-------------|---------|
| **Indexed time ranges** | Fast slot availability queries |
| **Partition appointments by date** | Faster historical analytics |
| **Cache service+resource configs** | Reduce DB hits during booking flow |
| **Denormalize commonly-accessed fields** | Reduce joins on critical path |
| **Audit log in separate table** | Doesn't slow down transactional queries |

---

## Notes for Implementation

1. **Database**: PostgreSQL recommended for JSON support, partitioning, and advanced locking
2. **ORM Mapping**: Use SQLAlchemy with proper relationship definitions
3. **Transactions**: Use serializable isolation level for appointment booking
4. **Caching**: Redis cache for availability slots, service configs
5. **Background Jobs**: Process refunds, send notifications, generate reports

---

# API Endpoints

## Phase 1: Authentication & RBAC

### Authentication Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user (email, password, first_name, last_name) |
| POST | `/api/auth/send-otp` | ❌ | Send OTP to email for verification |
| POST | `/api/auth/verify-otp` | ❌ | Verify OTP and mark user as verified |
| POST | `/api/auth/login` | ❌ | Login user (email, password) - returns JWT token |
| POST | `/api/auth/logout` | ✅ | Logout user (invalidate token) |
| POST | `/api/auth/forgot-password` | ❌ | Request password reset email |
| POST | `/api/auth/reset-password` | ❌ | Reset password with token |
| POST | `/api/auth/refresh-token` | ✅ | Refresh JWT token |

### User Management Endpoints (RBAC)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/users/me` | ✅ | ALL | Get current user profile |
| PUT | `/api/users/me` | ✅ | ALL | Update user profile |
| GET | `/api/users/{user_id}` | ✅ | ADMIN | Get user by ID |
| PUT | `/api/users/{user_id}/role` | ✅ | ADMIN | Assign role to user |
| GET | `/api/users/{user_id}/roles` | ✅ | ADMIN | Get user roles |

---

## Phase 2: Customer Booking Flow

### Service Discovery
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/services` | ❌ | ALL | List all published services with filters |
| GET | `/api/services/{service_id}` | ❌ | ALL | Get service details |
| GET | `/api/services/{service_id}/availability` | ❌ | ALL | Get available slots for a service (date range, resource) |
| GET | `/api/services/{service_id}/resources` | ❌ | ALL | Get resources assigned to a service |
| GET | `/api/services/shareable/{shareable_link}` | ❌ | ALL | Get service by shareable link |

### Appointment Booking (Customer)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/appointments` | ✅ | CUSTOMER | Create/book new appointment |
| GET | `/api/appointments` | ✅ | CUSTOMER | List customer's appointments (with filters: status, date range) |
| GET | `/api/appointments/{appointment_id}` | ✅ | CUSTOMER | Get appointment details |
| PUT | `/api/appointments/{appointment_id}/reschedule` | ✅ | CUSTOMER | Reschedule appointment (new date/time) |
| DELETE | `/api/appointments/{appointment_id}` | ✅ | CUSTOMER | Cancel appointment |
| GET | `/api/appointments/{appointment_id}/confirmation` | ✅ | CUSTOMER | Get booking confirmation details |

### Booking Form Questions
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/services/{service_id}/form-questions` | ❌ | ALL | Get custom form questions for a service |
| POST | `/api/appointments/{appointment_id}/form-responses` | ✅ | CUSTOMER | Submit form responses for appointment |

---

## Phase 2: Organizer Management

### Service Management
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/services` | ✅ | ORGANIZER | Create new service |
| PUT | `/api/services/{service_id}` | ✅ | ORGANIZER | Update service details |
| DELETE | `/api/services/{service_id}` | ✅ | ORGANIZER | Delete service (soft delete) |
| POST | `/api/services/{service_id}/publish` | ✅ | ORGANIZER | Publish service |
| POST | `/api/services/{service_id}/unpublish` | ✅ | ORGANIZER | Unpublish service |
| POST | `/api/services/{service_id}/shareable-link` | ✅ | ORGANIZER | Generate shareable link |

### Resource Management (Organizer)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/resources` | ✅ | ORGANIZER | Create new resource (provider, room, equipment) |
| PUT | `/api/resources/{resource_id}` | ✅ | ORGANIZER | Update resource |
| DELETE | `/api/resources/{resource_id}` | ✅ | ORGANIZER | Delete resource |
| POST | `/api/resources/{resource_id}/working-hours` | ✅ | ORGANIZER | Set working hours for resource |
| PUT | `/api/resources/{resource_id}/working-hours/{day_of_week}` | ✅ | ORGANIZER | Update working hours for specific day |
| POST | `/api/resources/{resource_id}/unavailability` | ✅ | ORGANIZER | Add unavailability (holiday, maintenance) |
| GET | `/api/resources` | ✅ | ORGANIZER | List organizer's resources |
| GET | `/api/resources/{resource_id}` | ✅ | ORGANIZER | Get resource details |

### Service-Resource Mapping
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/services/{service_id}/resources` | ✅ | ORGANIZER | Assign resource to service |
| DELETE | `/api/services/{service_id}/resources/{resource_id}` | ✅ | ORGANIZER | Remove resource from service |
| PUT | `/api/services/{service_id}/resources/{resource_id}` | ✅ | ORGANIZER | Update resource assignment (required, assignment_type) |

### Custom Form Questions (Organizer)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/services/{service_id}/form-questions` | ✅ | ORGANIZER | Create form question for service |
| PUT | `/api/services/{service_id}/form-questions/{question_id}` | ✅ | ORGANIZER | Update form question |
| DELETE | `/api/services/{service_id}/form-questions/{question_id}` | ✅ | ORGANIZER | Delete form question |

### Appointment Management (Organizer)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/appointments` | ✅ | ORGANIZER | List all appointments for organizer's services |
| GET | `/api/appointments/{appointment_id}` | ✅ | ORGANIZER | Get appointment details |
| PUT | `/api/appointments/{appointment_id}/status` | ✅ | ORGANIZER | Update appointment status |
| GET | `/api/appointments/calendar` | ✅ | ORGANIZER | Get calendar view of appointments |

---

## Phase 3: Profile & Reporting

### Customer Profile
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/customers/profile` | ✅ | CUSTOMER | Get customer profile |
| PUT | `/api/customers/profile` | ✅ | CUSTOMER | Update customer profile |
| GET | `/api/customers/appointment-history` | ✅ | CUSTOMER | Get past appointments with filters |
| GET | `/api/customers/upcoming-appointments` | ✅ | CUSTOMER | Get upcoming appointments |

### Organizer Reports & Analytics
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/reports/dashboard` | ✅ | ORGANIZER | Get dashboard overview (total appointments, peak hours, utilization) |
| GET | `/api/reports/bookings` | ✅ | ORGANIZER | Get booking trends (date range, filters) |
| GET | `/api/reports/resource-utilization` | ✅ | ORGANIZER | Get resource utilization metrics |
| GET | `/api/reports/revenue` | ✅ | ORGANIZER | Get revenue report (if payment enabled) |
| GET | `/api/reports/customer-insights` | ✅ | ORGANIZER | Get customer booking patterns |
| GET | `/api/reports/export` | ✅ | ORGANIZER | Export reports to CSV/PDF |

---

## Phase 4: Admin Dashboard

### Admin User Management
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/admin/users` | ✅ | ADMIN | List all users with filters |
| GET | `/api/admin/users/{user_id}` | ✅ | ADMIN | Get user details |
| PUT | `/api/admin/users/{user_id}` | ✅ | ADMIN | Update user details |
| DELETE | `/api/admin/users/{user_id}` | ✅ | ADMIN | Soft delete user |
| POST | `/api/admin/users/{user_id}/roles` | ✅ | ADMIN | Assign roles to user |
| DELETE | `/api/admin/users/{user_id}/roles/{role}` | ✅ | ADMIN | Remove role from user |

### Admin Organization Management
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/admin/organizations` | ✅ | ADMIN | List all organizations |
| POST | `/api/admin/organizations` | ✅ | ADMIN | Create organization |
| PUT | `/api/admin/organizations/{org_id}` | ✅ | ADMIN | Update organization |
| DELETE | `/api/admin/organizations/{org_id}` | ✅ | ADMIN | Delete organization |

### Admin Provider Management
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/admin/providers` | ✅ | ADMIN | List all providers (resources of type PROVIDER) |
| GET | `/api/admin/providers/{provider_id}` | ✅ | ADMIN | Get provider details |
| PUT | `/api/admin/providers/{provider_id}` | ✅ | ADMIN | Manage provider details |

### Admin Dashboard & Reporting
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/admin/dashboard` | ✅ | ADMIN | Get system-wide dashboard |
| GET | `/api/admin/reports/system-metrics` | ✅ | ADMIN | Get system performance metrics |
| GET | `/api/admin/reports/audit-logs` | ✅ | ADMIN | View audit logs with filters |
| GET | `/api/admin/reports/revenue` | ✅ | ADMIN | System-wide revenue report |

---

## Payment Endpoints (Post-MVP)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/payments/checkout` | ✅ | CUSTOMER | Initialize payment checkout |
| POST | `/api/payments/confirm` | ✅ | CUSTOMER | Confirm payment for appointment |
| GET | `/api/payments/{payment_id}` | ✅ | ALL | Get payment status |
| POST | `/api/payments/{payment_id}/refund` | ✅ | ORGANIZER/ADMIN | Request refund |
| GET | `/api/payments` | ✅ | ORGANIZER | List payments for organizer |

---

## Error Handling & Response Format

### Standard Success Response
```json
{
  "success": true,
  "data": { /* resource data */ },
  "message": "Operation successful"
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { /* optional additional info */ }
  }
}
```

### HTTP Status Codes
- **200**: OK
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict (e.g., double booking attempt)
- **422**: Unprocessable Entity (validation error)
- **500**: Internal Server Error

---

## Authentication & Authorization

- **JWT Token**: Bearer token in Authorization header
- **Token Expiry**: 24 hours (configurable)
- **Refresh Token**: Available for extending sessions
- **RBAC**: Role checked on each protected endpoint
- **Rate Limiting**: 100 requests/minute per user (configurable)
