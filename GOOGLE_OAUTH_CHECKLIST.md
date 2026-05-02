# Implementation Checklist & Code Snippets

## ✅ Implementation Status

### Backend Implementation

- [x] Dependencies installed (requirements.txt)
- [x] Configuration added (config.py)
- [x] Database models extended (models.py)
- [x] OAuth service created (google_oauth_service.py)
- [x] API routes created (google_oauth_routes.py)
- [x] Routes integrated in main.py
- [x] Migration script created (migrate_google_oauth_columns.py)

### Frontend Implementation

- [x] Package updated (package.json)
- [x] OAuth login hook (useGoogleLogin.ts)
- [x] Calendar integration hook (useGoogleCalendar.ts)
- [x] Login button component
- [x] Callback handler component
- [x] Example dashboard component

### Documentation

- [x] Complete setup guide (GOOGLE_OAUTH_SETUP.md)
- [x] Quick start guide (GOOGLE_OAUTH_QUICK_START.md)
- [x] README summary (GOOGLE_OAUTH_README.md)
- [x] Architecture diagram (GOOGLE_OAUTH_ARCHITECTURE.md)
- [x] This checklist (GOOGLE_OAUTH_CHECKLIST.md)

---

## 🔧 Installation Commands

### Backend Setup

```bash
# Navigate to backend
cd Backend

# Install dependencies
pip install -r requirements.txt

# Run migration
python migrate_google_oauth_columns.py

# Start server (you may need to configure DB first)
python main.py
```

### Frontend Setup

```bash
# Navigate to frontend
cd Frontend/appointment_app

# Install dependencies
npm install
# or
pnpm install

# Start dev server
npm run dev
# or
pnpm dev
```

---

## 📝 Environment Variables Needed

### Backend `.env` File

```env
# Database
DATABASE_URL=postgresql://user:password@localhost/db_name

# JWT
SECRET_KEY=your-secret-key-min-32-chars-long

# Frontend
FRONTEND_URL=http://localhost:3000

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx_secret_xxx
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### Frontend `.env.local` File

```env
# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

---

## 📄 Quick Code Snippets

### 1. Update Root Layout (app/layout.tsx)

```tsx
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
        >
          <AuthProvider>{children}</AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
```

### 2. Create Login Page (app/auth/login/page.tsx)

```tsx
"use client";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        <GoogleLoginButton
          onSuccess={() => router.push("/dashboard")}
          onError={setError}
          className="w-full"
        />
      </div>
    </div>
  );
}
```

### 3. Create Callback Page (app/auth/google-callback/page.tsx)

```tsx
import { GoogleCallbackHandler } from "@/components/auth/google-callback-handler";
import { Suspense } from "react";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GoogleCallbackHandler />
    </Suspense>
  );
}
```

### 4. Use in Dashboard (example)

```tsx
"use client";

import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useEffect, useState } from "react";

export function AvailabilityComponent() {
  const { calendars, getCalendarList, createEvent } = useGoogleCalendar();

  useEffect(() => {
    getCalendarList();
  }, [getCalendarList]);

  const handleScheduleAppointment = async () => {
    await createEvent({
      title: "Appointment with Client",
      description: "Discuss project requirements",
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      attendees: [{ email: "client@example.com" }],
      meet_enabled: true,
    });
  };

  return (
    <div>
      <h2>Available Calendars: {calendars.length}</h2>
      <button onClick={handleScheduleAppointment}>
        Schedule with Google Meet
      </button>
    </div>
  );
}
```

---

## 🗄️ Database Migration SQL

If `migrate_google_oauth_columns.py` doesn't work, run this manually:

```sql
-- Add Google OAuth columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(500) UNIQUE,
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(500),
ADD COLUMN IF NOT EXISTS google_meet_enabled BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

---

## 🧪 Testing the OAuth Flow

### Step 1: Start Backend

```bash
cd Backend
python main.py
# Should print: ✅ Database tables created successfully!
# Server running on http://localhost:8000
```

### Step 2: Start Frontend

```bash
cd Frontend/appointment_app
npm run dev
# Frontend running on http://localhost:3000
```

### Step 3: Test Login

```bash
# Open browser
# Navigate to: http://localhost:3000/auth/login

# Click "Sign in with Google"
# Complete Google authentication
# Should redirect to: http://localhost:3000/auth/google-callback
# Then to: http://localhost:3000/dashboard
```

### Step 4: Verify Database

```bash
# Check if user was created
SELECT * FROM users WHERE google_id IS NOT NULL;

# Should see:
# - user record with google_id populated
# - google_access_token and google_refresh_token set
# - is_verified = true
```

### Step 5: Test Calendar API

```bash
# In your dashboard component, add:
const { calendars } = useGoogleCalendar();
useEffect(() => { getCalendarList(); }, []);

# Should see list of user's Google Calendars
```

---

## 🐛 Common Issues & Fixes

### Issue: "Invalid Client ID"

**Fix**: Check `NEXT_PUBLIC_GOOGLE_CLIENT_ID` matches Google Cloud Console

### Issue: "Redirect URI mismatch"

**Fix**: Add `http://localhost:8000/api/auth/google/callback` to Google Cloud
Console

### Issue: "Token not refreshing"

**Fix**: Ensure `google_refresh_token` column exists in database

### Issue: "Calendar not found"

**Fix**: User must grant calendar scope - ask for permissions again

### Issue: "Meet link not created"

**Fix**: Ensure `meet_enabled: true` and user has G Suite account

---

## 📚 File Reference

| File                            | Purpose                     |
| ------------------------------- | --------------------------- |
| `google_oauth_service.py`       | Core OAuth and API services |
| `google_oauth_routes.py`        | FastAPI endpoints           |
| `useGoogleLogin.ts`             | Frontend OAuth hook         |
| `useGoogleCalendar.ts`          | Calendar integration hook   |
| `google-login-button.tsx`       | Login UI component          |
| `google-callback-handler.tsx`   | OAuth callback processor    |
| `google-calendar-dashboard.tsx` | Full dashboard example      |
| `GOOGLE_OAUTH_SETUP.md`         | Complete 11-step guide      |
| `GOOGLE_OAUTH_QUICK_START.md`   | Rapid deployment checklist  |
| `GOOGLE_OAUTH_README.md`        | Feature summary             |
| `GOOGLE_OAUTH_ARCHITECTURE.md`  | System design docs          |

---

## 🎯 Next Steps (Recommended Order)

1. **Get Google Credentials**
   - Go to Google Cloud Console
   - Create OAuth credentials
   - Copy Client ID and Secret

2. **Setup Environment Variables**
   - Create `.env` in Backend/
   - Create `.env.local` in Frontend/appointment_app/
   - Add credentials

3. **Run Database Migration**
   - Execute migration script or SQL

4. **Install Dependencies**
   - Backend: `pip install -r requirements.txt`
   - Frontend: `npm install`

5. **Start Servers**
   - Backend: `python main.py`
   - Frontend: `npm run dev`

6. **Test Authentication**
   - Go to login page
   - Click Google login
   - Verify authentication works

7. **Implement in Pages**
   - Add GoogleLoginButton to login pages
   - Add GoogleCalendarDashboard to dashboard
   - Use useGoogleCalendar in booking flows

8. **Production Deployment**
   - Update all URLs to production domains
   - Enable HTTPS
   - Configure CORS properly
   - Set up monitoring/logging

---

## 🔐 Security Checklist

- [ ] Google Client Secret is in `.env` only (never commit)
- [ ] JWT Secret Key is strong (>32 chars)
- [ ] CORS is configured for your domains only (not `*`)
- [ ] All API calls use HTTPS (in production)
- [ ] Tokens are never logged or exposed
- [ ] Refresh tokens are encrypted in database
- [ ] Rate limiting is implemented
- [ ] Error messages don't expose sensitive info
- [ ] Database backups are enabled
- [ ] Secrets are rotated periodically

---

## 📞 Support Resources

1. **Full Setup Guide**: Read `GOOGLE_OAUTH_SETUP.md`
2. **API Reference**: Check backend endpoints in `google_oauth_routes.py`
3. **Google Docs**: https://developers.google.com/identity/protocols/oauth2
4. **Calendar API**: https://developers.google.com/calendar/api
5. **Meet API**: https://developers.google.com/meet

---

## 🎓 Learning Points

This implementation teaches:

- OAuth 2.0 authentication flow
- JWT token management
- API integration (Google Calendar, Meet)
- Secure token storage
- Frontend-backend communication
- Error handling and recovery
- TypeScript + Python best practices
- Async/await patterns
- React hooks for state management

---

**Status**: ✅ Ready to implement

Start with the Google Cloud Console setup, then follow the installation commands
above. Should be running in 15-30 minutes!

---

Generated: May 2, 2024 Last Updated: May 2, 2024 Version: 1.0
