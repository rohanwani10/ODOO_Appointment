# Quick Start Guide - Phase 1

## Prerequisites
- Python 3.11+
- PostgreSQL 12+
- Git

## 1. Clone & Setup

```bash
# Navigate to backend
cd Backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## 2. Database Setup

```bash
# Create database
createdb appointment_booking

# Or with credentials
createdb -U postgres appointment_booking
```

## 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://user:password@localhost/appointment_booking
```

## 4. Run Application

```bash
# Development mode
uvicorn main:app --reload --port 8000

# Production mode (requires gunicorn)
# pip install gunicorn
# gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

## 5. Verify Installation

Open browser and navigate to:
- API Docs: http://localhost:8000/docs
- API ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

---

## Phase 1 API Endpoints Summary

### Authentication
```
POST   /api/auth/register           - Register new user
POST   /api/auth/send-otp           - Send OTP
POST   /api/auth/verify-otp         - Verify OTP
POST   /api/auth/login              - Login
POST   /api/auth/logout             - Logout
POST   /api/auth/logout-all-devices - Logout all
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password
POST   /api/auth/refresh-token      - Refresh access token
```

### User Profile
```
GET    /api/users/me                - Get current user
PUT    /api/users/me                - Update profile
POST   /api/users/change-password   - Change password
```

### Admin RBAC
```
GET    /api/admin/users             - List all users
GET    /api/admin/users/{id}        - Get user
POST   /api/admin/users/{id}/roles  - Assign role
DELETE /api/admin/users/{id}/roles/{role} - Remove role
DELETE /api/admin/users/{id}        - Delete user
```

---

## Example: Register & Login Flow

### 1. Register User
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "abc123...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890",
    "is_verified": false,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00"
  }
}
```

### 2. Get Current User
```bash
curl -X GET http://localhost:8000/api/users/me \
  -H "Authorization: Bearer <access_token>"
```

### 3. Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### 4. Refresh Token
```bash
curl -X POST http://localhost:8000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "abc123..."
  }'
```

---

## Troubleshooting

### Database Connection Error
```
psycopg2.OperationalError: could not connect to server
```
- Check PostgreSQL is running: `sudo service postgresql start`
- Verify DATABASE_URL in .env
- Ensure database exists: `createdb appointment_booking`

### Module Not Found
```
ModuleNotFoundError: No module named 'fastapi'
```
- Activate virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

### Port Already in Use
```
OSError: [Errno 48] Address already in use
```
- Use different port: `uvicorn main:app --reload --port 8001`
- Or kill process: `lsof -ti:8000 | xargs kill -9`

---

## Next Steps

1. **Email Integration**: Configure SendGrid or AWS SES for OTP/password reset
2. **Frontend**: Build registration, login, and profile pages
3. **Testing**: Create unit and integration tests
4. **Deployment**: Set up Docker, CI/CD, and production environment

---

## Documentation Links

- [PHASE1.md](PHASE1.md) - Detailed Phase 1 documentation
- [BACKEND.md](BACKEND.md) - Full API specification
- [models.py](models.py) - Database schema
- [auth.py](auth.py) - Authentication functions
- [main.py](main.py) - API endpoints

---

## Need Help?

Check the logs for error details:
```bash
# View recent logs
tail -f /var/log/postgresql/postgresql.log
```

Enable debug mode in .env:
```
DEBUG=True
```

Use FastAPI automatic docs for API testing:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
