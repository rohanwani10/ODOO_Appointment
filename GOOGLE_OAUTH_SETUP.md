# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth authentication with
Google Meet and Calendar integration.

## Prerequisites

- Google Cloud Project with OAuth 2.0 credentials
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:3000`

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Calendar API
   - Google Meet API (via Google Workspace)
   - Google+ API (for user info)

## Step 2: Create OAuth 2.0 Credentials

### Create OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** for User Type
3. Fill in the app information:
   - App name: "Appointment Booking System"
   - User support email: Your email
   - Developer contact: Your email
4. Add the following scopes:
   - `userinfo.profile`
   - `userinfo.email`
   - `calendar`
   - `calendar.events`
   - `meet.readonly`

### Create OAuth Client Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Choose **Web application**
4. Add Authorized redirect URIs:
   ```
   http://localhost:8000/api/auth/google/callback
   http://localhost:3000/api/auth/google/callback
   https://yourdomain.com/api/auth/google/callback (for production)
   ```
5. Copy the Client ID and Client Secret

## Step 3: Update Backend Environment Variables

Create a `.env` file in the `Backend` directory:

```env
# Existing variables...
DATABASE_URL=postgresql://postgres:password@localhost/pg_admin
SECRET_KEY=your-secret-key-change-this-in-production-min-32-chars-long-12345
FRONTEND_URL=http://localhost:3000

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

## Step 4: Create Database Migration

Run this migration to add Google OAuth columns to the users table:

```sql
ALTER TABLE users ADD COLUMN google_id VARCHAR(500) UNIQUE;
ALTER TABLE users ADD COLUMN google_access_token TEXT;
ALTER TABLE users ADD COLUMN google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN google_token_expiry TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN google_calendar_id VARCHAR(500);
ALTER TABLE users ADD COLUMN google_meet_enabled BOOLEAN DEFAULT FALSE;
```

Or use the provided migration script if available.

## Step 5: Install Backend Dependencies

```bash
cd Backend
pip install -r requirements.txt
```

## Step 6: Update Frontend Configuration

Update your frontend environment variables in `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

## Step 7: Install Frontend Dependencies

```bash
cd Frontend/appointment_app
npm install
# or
pnpm install
```

## Step 8: Update Frontend Root Layout

Add the Google OAuth provider to your root layout (`app/layout.tsx`):

```tsx
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
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

## Step 9: Add Login Pages

### Create Login Page (`app/auth/login/page.tsx`)

```tsx
"use client";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = (user: any) => {
    router.push("/dashboard");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Sign In</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <GoogleLoginButton
          onSuccess={handleSuccess}
          onError={setError}
          className="w-full"
        />

        <p className="text-center text-gray-600 mt-6 text-sm">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
```

### Create Callback Page (`app/auth/google-callback/page.tsx`)

```tsx
import { GoogleCallbackHandler } from "@/components/auth/google-callback-handler";

export default function GoogleCallbackPage() {
  return <GoogleCallbackHandler />;
}
```

## Step 10: Use Google Calendar in Your App

Example usage in a component:

```tsx
"use client";

import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useEffect } from "react";

export function CalendarComponent() {
  const { calendars, isLoading, getCalendarList, createEvent } =
    useGoogleCalendar();

  useEffect(() => {
    getCalendarList();
  }, [getCalendarList]);

  const handleCreateEvent = async () => {
    const event = await createEvent({
      title: "Meeting with John",
      description: "Discuss project updates",
      start_time: "2024-05-15T10:00:00Z",
      end_time: "2024-05-15T11:00:00Z",
      attendees: [{ email: "john@example.com" }],
      meet_enabled: true,
    });

    console.log("Meet Link:", event.meet_link);
  };

  return (
    <div>
      <h2>Your Calendars</h2>
      {calendars.map((cal) => (
        <p key={cal.id}>{cal.summary}</p>
      ))}
      <button onClick={handleCreateEvent}>Create Meeting with Meet</button>
    </div>
  );
}
```

## Step 11: API Endpoints Reference

### Get Authorization URL

```
GET /api/auth/google/authorization-url
Response: { "authorization_url": "https://..." }
```

### Google OAuth Callback

```
POST /api/auth/google/callback
Body: { "code": "auth_code", "state": "state" }
Response: {
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "token_type": "bearer",
  "user": { "id", "email", "first_name", "last_name", ... }
}
```

### Get Calendar List

```
GET /api/auth/google/calendar/list
Headers: Authorization: Bearer <access_token>
Response: { "items": [ { "id", "summary", "description", ... } ] }
```

### Create Calendar Event

```
POST /api/auth/google/calendar/event
Headers: Authorization: Bearer <access_token>
Body: {
  "title": "Meeting",
  "description": "Description",
  "start_time": "2024-05-15T10:00:00Z",
  "end_time": "2024-05-15T11:00:00Z",
  "attendees": [{ "email": "example@gmail.com" }],
  "meet_enabled": true
}
Response: {
  "success": true,
  "event_id": "event_id",
  "event_url": "https://...",
  "meet_link": "https://meet.google.com/...",
  "created_at": "timestamp"
}
```

### Get Google Meet Link

```
GET /api/auth/google/meet/{event_id}
Headers: Authorization: Bearer <access_token>
Response: { "meet_link": "https://meet.google.com/..." }
```

## Troubleshooting

### "Invalid Client ID"

- Ensure your `GOOGLE_CLIENT_ID` matches the one in Google Cloud Console
- Check that your redirect URI is registered in Google Cloud

### "Token Expired"

- The system automatically refreshes tokens
- Ensure your database has the `google_refresh_token` field

### "Calendar not found"

- User must have granted calendar permissions during OAuth login
- Check that `GOOGLE_SCOPES` includes calendar scopes

### "Meet link not created"

- Ensure the user has Google Workspace
- `meet_enabled: true` must be set when creating the event
- Verify the event was created successfully

## Security Considerations

1. **Token Storage**: Refresh tokens are stored securely in the database
2. **HTTPS**: Use HTTPS in production
3. **CORS**: Configure proper CORS origins in both frontend and backend
4. **Scope Minimization**: Only request necessary scopes
5. **Token Expiry**: Implement token refresh logic (already done in
   `GoogleOAuthService`)

## Production Deployment

1. Update `GOOGLE_REDIRECT_URI` to your production domain
2. Update `FRONTEND_URL` in backend config
3. Add your production domain to Google Cloud Console authorized URIs
4. Use environment variables for all sensitive data
5. Enable HTTPS
6. Set up proper error logging and monitoring

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [Google Meet Documentation](https://developers.google.com/meet)
- [React OAuth Library](https://github.com/react-oauth/google)
