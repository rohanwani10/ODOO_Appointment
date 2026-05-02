# Google OAuth Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT BOOKING SYSTEM                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐         ┌──────────────────────────┐
│    FRONTEND (Next.js)    │         │   BACKEND (FastAPI)      │
│    http://localhost:3000 │         │  http://localhost:8000   │
├──────────────────────────┤         ├──────────────────────────┤
│                          │         │                          │
│ ┌──────────────────────┐ │         │ ┌────────────────────┐   │
│ │ Login Page           │ │         │ │ Google OAuth       │   │
│ │ - Google Button      │ │         │ │ Routes             │   │
│ │ - Redirect to Google │ │         │ │ - POST /callback   │   │
│ └──────────────────────┘ │         │ └────────────────────┘   │
│           │              │         │           │              │
│           │              │         │  ┌────────▼──────────┐   │
│ ┌─────────▼──────────┐   │         │  │ OAuth Service     │   │
│ │ Callback Handler   │◄──┼─────────┼──┤ - Token exchange  │   │
│ │ - Save tokens      │   │         │  │ - User creation   │   │
│ │ - Redirect to dash │   │         │  │ - Token refresh   │   │
│ └────────────────────┘   │         │  └────────┬──────────┘   │
│           │              │         │           │              │
│ ┌─────────▼──────────┐   │         │  ┌────────▼──────────┐   │
│ │ Dashboard          │   │         │  │ PostgreSQL        │   │
│ │ - Calendar hook    │───┼─────────┼──┤ - Users           │   │
│ │ - Create events    │   │         │  │ - Tokens          │   │
│ │ - View Meet links  │   │         │  │ - Calendars       │   │
│ └────────────────────┘   │         │  └───────────────────┘   │
│                          │         │                          │
└──────────────────────────┘         └──────────────────────────┘
           │                                     │
           │                                     │
           └─────────────────────┬───────────────┘
                                 │
                    ┌────────────▼───────────┐
                    │  GOOGLE CLOUD APIS    │
                    ├──────────────────────┤
                    │                       │
                    │ ┌─────────────────┐  │
                    │ │ Google OAuth    │  │
                    │ │ - Auth flow     │  │
                    │ │ - Token mgmt    │  │
                    │ └─────────────────┘  │
                    │                       │
                    │ ┌─────────────────┐  │
                    │ │ Google Calendar │  │
                    │ │ - List events   │  │
                    │ │ - Create events │  │
                    │ └─────────────────┘  │
                    │                       │
                    │ ┌─────────────────┐  │
                    │ │ Google Meet     │  │
                    │ │ - Create links  │  │
                    │ │ - Get URLs      │  │
                    │ └─────────────────┘  │
                    │                       │
                    └───────────────────────┘
```

## Data Flow: Login

```
User Browser                    Frontend                Backend              Google Cloud
     │                            │                       │                      │
     │ 1. Click "Sign in"        │                       │                      │
     ├───────────────────────────►│                       │                      │
     │                            │                       │                      │
     │                            │ 2. GET /auth/google   │                      │
     │                            │  /authorization-url   │                      │
     │                            ├──────────────────────►│                      │
     │                            │                       │                      │
     │                            │ 3. Return OAuth URL   │                      │
     │                            │◄──────────────────────┤                      │
     │                            │                       │                      │
     │ 4. Redirect to Google      │                       │                      │
     │◄───────────────────────────┤                       │                      │
     │                            │                       │                      │
     │────────────────────────────────────────────────────────────────────────────►│
     │                                                                            │ 5. OAuth
     │                                                                            │    Consent
     │ 6. User grants permissions                                                │
     │                                                                            │
     │◄─ redirect + code ───────────────────────────────────────────────────────┤
     │                            │                       │                      │
     │ 7. POST code to callback   │                       │                      │
     ├───────────────────────────►│                       │                      │
     │                            │ 8. POST /callback     │                      │
     │                            ├──────────────────────►│                      │
     │                            │                       │ 9. Exchange code     │
     │                            │                       ├─────────────────────►│
     │                            │                       │                      │
     │                            │                       │ 10. Return tokens    │
     │                            │                       │◄─────────────────────┤
     │                            │                       │                      │
     │                            │ 11. Get user info     │
     │                            │                       ├─────────────────────►│
     │                            │                       │                      │
     │                            │                       │ 12. Return user data │
     │                            │                       │◄─────────────────────┤
     │                            │                       │                      │
     │                            │ 13. Create/update     │
     │                            │     user in DB        │
     │                            │                       │
     │                            │ 14. Return JWT        │
     │                            │◄──────────────────────┤
     │                            │                       │
     │ 15. Store tokens          │                       │
     │◄───────────────────────────┤                       │
     │                            │                       │
     │ 16. Redirect to dashboard  │                       │
     ├───────────────────────────►│                       │
     │                            │                       │
```

## Data Flow: Create Event with Meet

```
User Interface          Frontend              Backend          PostgreSQL         Google APIs
      │                    │                    │                    │                │
      │ 1. Fill form       │                    │                    │                │
      ├───────────────────►│                    │                    │                │
      │                    │                    │                    │                │
      │ 2. Click Create    │                    │                    │                │
      ├───────────────────►│                    │                    │                │
      │                    │                    │                    │                │
      │                    │ 3. POST event data │                    │                │
      │                    │ + JWT token        │                    │                │
      │                    ├───────────────────►│                    │                │
      │                    │                    │                    │                │
      │                    │                    │ 4. Verify JWT      │                │
      │                    │                    │ & get user         │                │
      │                    │                    ├───────────────────►│                │
      │                    │                    │                    │                │
      │                    │                    │ 5. User + tokens   │                │
      │                    │                    │◄───────────────────┤                │
      │                    │                    │                    │                │
      │                    │                    │ 6. Create event    │
      │                    │                    │ with conferenceSolution
      │                    │                    ├────────────────────────────────────►│
      │                    │                    │                    │                │
      │                    │                    │ 7. Return event    │
      │                    │                    │ + Meet URL         │                │
      │                    │                    │◄────────────────────────────────────┤
      │                    │                    │                    │                │
      │                    │                    │ 8. Update user     │
      │                    │                    │ calendar_id        │
      │                    │                    ├───────────────────►│                │
      │                    │                    │                    │                │
      │                    │ 9. Return event    │                    │                │
      │                    │ + Meet link        │                    │                │
      │                    │◄───────────────────┤                    │                │
      │                    │                    │                    │                │
      │ 10. Show success   │                    │                    │                │
      │◄───────────────────┤                    │                    │                │
      │ & Meet link        │                    │                    │                │
      │                    │                    │                    │                │
```

## Component Hierarchy

```
App (Root Layout)
├─ GoogleOAuthProvider
│  └─ AuthProvider
│     ├─ LoginPage
│     │  └─ GoogleLoginButton
│     │     └─ useGoogleLogin hook
│     │
│     ├─ GoogleCallbackPage
│     │  └─ GoogleCallbackHandler
│     │
│     └─ Dashboard
│        ├─ GoogleCalendarDashboard
│        │  └─ useGoogleCalendar hook
│        │     ├─ getCalendarList()
│        │     ├─ createEvent()
│        │     └─ getMeetLink()
│        │
│        └─ Other Dashboard Components
```

## Token Flow

```
┌─────────────────────────────────────────────────────────┐
│                    TOKEN LIFECYCLE                       │
└─────────────────────────────────────────────────────────┘

Google Access Token (expires in ~1 hour)
├─ Used for: Calendar API, Meet API requests
├─ Stored: In-memory + database
├─ Refresh: Automatic when 401 received
└─ Auto-refresh: No manual refresh needed

Google Refresh Token (expires in 6 months)
├─ Used for: Getting new access tokens
├─ Stored: Encrypted in PostgreSQL
├─ Revoked: When user logs out
└─ Security: Never exposed to frontend

JWT Access Token (expires in 15 minutes)
├─ Used for: API requests from frontend
├─ Stored: localStorage (frontend)
├─ Refresh: Manual refresh endpoint
└─ Format: Bearer token in Authorization header

JWT Refresh Token (expires in 7 days)
├─ Used for: Getting new JWT access token
├─ Stored: localStorage (frontend)
├─ Revoked: When user logs out
└─ Tracked: In refresh_tokens table
```

## Database Schema

```
users
├─ id (PK)
├─ email (unique)
├─ first_name
├─ last_name
├─ profile_picture_url
├─ hashed_password
├─ is_verified
├─ created_at
├─ updated_at
│
├─ [NEW OAUTH FIELDS]
├─ google_id (unique, nullable)
├─ google_access_token (encrypted)
├─ google_refresh_token (encrypted)
├─ google_token_expiry
├─ google_calendar_id
└─ google_meet_enabled

user_roles
├─ id (PK)
├─ user_id (FK → users)
├─ role (ENUM: CUSTOMER, ORGANIZER, ADMIN)
└─ unique(user_id, role)

refresh_tokens
├─ id (PK)
├─ user_id (FK → users)
├─ hashed_token (unique)
├─ is_revoked
├─ created_at
├─ expires_at
└─ last_used_at
```

## Error Handling Flow

```
API Request
    │
    ├─ 400: Invalid Request Data
    │  └─ Return error message
    │
    ├─ 401: Unauthorized
    │  ├─ JWT expired? → Refresh JWT
    │  ├─ Google token expired? → Refresh Google token
    │  └─ No token? → Redirect to login
    │
    ├─ 403: Forbidden
    │  └─ Insufficient permissions
    │
    ├─ 404: Not Found
    │  └─ Resource doesn't exist
    │
    ├─ 500: Server Error
    │  └─ Log error, return generic message
    │
    └─ 503: Service Unavailable
       └─ Google APIs down, retry later
```

## Security Architecture

```
┌────────────────────────────────────┐
│     Frontend (Browser)              │
│                                     │
│  JWT in localStorage                │
│  (but NOT httpOnly - risky!)        │
│                                     │
│  Should implement:                  │
│  - httpOnly cookies                 │
│  - CSRF protection                  │
│  - Content Security Policy          │
└────────────────────────────────────┘
           ├─ HTTPS ─┤
┌──────────▼─────────────────────────┐
│     Backend (FastAPI)               │
│                                     │
│  Validate JWT                       │
│  ├─ Check signature                 │
│  ├─ Check expiry                    │
│  └─ Check user exists               │
│                                     │
│  Rate limiting                      │
│  CORS validation                    │
│  Input sanitization                 │
└────────────────────────────────────┘
           ├─ HTTPS ─┤
┌──────────▼─────────────────────────┐
│     PostgreSQL Database             │
│                                     │
│  Encrypted columns:                 │
│  - google_refresh_token             │
│  - google_access_token              │
│                                     │
│  Hashed passwords (argon2)          │
│  Hashed refresh tokens (SHA256)     │
└────────────────────────────────────┘
           ├─ HTTPS ─┤
┌──────────▼─────────────────────────┐
│     Google Cloud APIs               │
│                                     │
│  OAuth 2.0 protocol                 │
│  HTTPS only                         │
│  Scope-based permissions            │
│  Token expiry management            │
└────────────────────────────────────┘
```

## Deployment Architecture

```
Production Environment

┌─────────────────────────────────────────────┐
│            Cloudflare / CDN                  │
│        (caching, DDoS protection)            │
└────────────┬────────────────────────────────┘
             │
     ┌───────┴───────┐
     │               │
┌────▼────┐    ┌─────▼──────┐
│ Frontend │    │  Backend   │
│(Vercel) │    │ (Render/   │
│  Next.js │    │  Railway)  │
│          │    │  FastAPI   │
└────┬─────┘    └─────┬──────┘
     │                │
     └────────┬───────┘
              │
         ┌────▼────────┐
         │ PostgreSQL  │
         │ (AWS RDS)   │
         └─────────────┘
              │
     ┌────────┴──────────┐
     │                   │
  ┌──▼───┐         ┌────▼───┐
  │Secret│         │Storage │
  │Manager        │Bucket  │
  └──────┘         └────────┘
         (AWS Secrets Manager)
```

---

This architecture ensures:

- ✅ Secure OAuth 2.0 flow
- ✅ Automatic token refresh
- ✅ Direct Google Calendar integration
- ✅ Direct Google Meet link generation
- ✅ Scalable microservices design
- ✅ Proper error handling
- ✅ Type-safe frontend and backend
