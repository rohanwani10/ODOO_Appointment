okay so the plan fro the hackathon is to tacken the problem statement in the following phases
# Phase 1
- complete auth setup and RBAC setup

# Phase 2
## Customer side
- Home page / view all appointment / appointment overview
## Organizer side
- Service / Appointment creation

# Phase 3
## Customer side
- Profile management
## Organizer side
- Reports & insights

## Phase 3 - Backend Endpoints (Implemented)

- `GET /api/users/me` : Get current user profile with roles and profile fields.
- `PUT /api/users/me` : Update current user profile (`first_name`, `last_name`, `phone`).
- `POST /api/users/me/photo` : Upload a profile photo (multipart/form-data). Returns `profile_picture_url`.
- `GET /api/users/me/preferences` : Retrieve stored user preferences (JSON).
- `PUT /api/users/me/preferences` : Update stored user preferences (JSON payload).

Organizer reports:
- `GET /api/organizer/reports/appointments?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Returns appointment counts grouped by date for the organizer's services. (internal organizer path)
- `GET /api/organizer/reports/resource-utilization?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Returns resource-level utilization (total appointments and total minutes booked) for organizer resources. (internal organizer path)

Documentation-aligned public report endpoints (added):
- `GET /api/reports/appointments?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Same as organizer appointments report, under `/api/reports`.
- `GET /api/reports/resource-utilization?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Alias for resource utilization.
- `GET /api/reports/bookings?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Bookings grouped by service (count).
- `GET /api/reports/revenue?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Estimated revenue from advance payments (best-effort).
- `GET /api/reports/customer-insights?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : Top customers by booking count.
- `GET /api/reports/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` : CSV export of appointments for organizer's services.

Notes:
- Uploaded profile images are served under `/uploads/profiles/<filename>`.
- Profile photo upload enforces: MIME `image/*`, allowed extensions `png,jpg,jpeg,gif,webp`, and maximum file size 5 MB.
- Preferences are stored as JSON string in the `users.preferences` column.
- Reports endpoints default to the last 30 days when date range is omitted.
- Report endpoints require `ORGANIZER` or `ADMIN` roles.

## Phase 3 - Calendar Invite Emails

When an appointment is created or rescheduled, a confirmation email is automatically sent to the customer with:
- Appointment details (service, date, time, resource)
- A "Add to Calendar" button that opens Google Calendar intent to add the appointment
- Calendar invite link format: `https://calendar.google.com/calendar/render?action=TEMPLATE&text={service_name}&dates={startDateTime}/{endDateTime}&details={description}`
- Email sent via SMTP configured in Backend/config.py
- If email send fails, appointment creation is NOT blocked (graceful degradation)
# Phase 4

- Admin Dashboard
- User provider managemement