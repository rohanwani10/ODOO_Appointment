# 🔧 Quick Fix: Google Login Failed

Your Google OAuth isn't initialized yet. Here's how to fix it:

## Problem

The error "Failed to initialize Google login" means the frontend can't get the
authorization URL from the backend because:

1. **GOOGLE_CLIENT_ID** is not set in Backend `.env`
2. **NEXT_PUBLIC_GOOGLE_CLIENT_ID** is not set in Frontend `.env.local`

## Solution (5 minutes)

### 1️⃣ Get Google OAuth Credentials

Go to: https://console.cloud.google.com/apis/credentials

- Create a new "Web application" OAuth credential
- Add redirect URI: `http://localhost:8000/api/auth/google/callback`
- Copy your **Client ID** and **Client Secret**

### 2️⃣ Create Backend `.env`

Create file: `Backend/.env`

```env
DATABASE_URL=postgresql://postgres:password@localhost/pg_admin
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### 3️⃣ Create Frontend `.env.local`

Create file: `Frontend/appointment_app/.env.local`

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
```

### 4️⃣ Run Database Migration

```bash
cd Backend
python migrate_google_oauth_columns.py
```

### 5️⃣ Restart Services

Terminal 1 (Backend):

```bash
cd Backend
python main.py
```

Terminal 2 (Frontend):

```bash
cd Frontend/appointment_app
npm run dev
```

## ✅ Test It

1. Go to: http://localhost:3000/auth/login
2. Click "Sign in with Google"
3. You should be redirected to Google login

## 📁 Files Structure

```
Backend/
  ├── .env ← Add GOOGLE_CLIENT_ID and SECRET here
  ├── config.py (already configured to read from .env)
  ├── google_oauth_routes.py (endpoint: /api/auth/google/authorization-url)
  └── google_oauth_service.py (handles OAuth logic)

Frontend/
  ├── .env.local ← Add NEXT_PUBLIC_GOOGLE_CLIENT_ID here
  ├── app/layout.tsx (GoogleOAuthProvider - already added)
  ├── app/auth/login/page.tsx (Google button - already added)
  ├── app/auth/register/page.tsx (Google button - already added)
  └── components/auth/google-login-button.tsx (button component)
```

## 🚀 What's Already Done

✅ Backend OAuth service created  
✅ Frontend OAuth components created  
✅ Google login button added to login page  
✅ Google login button added to registration form  
✅ Environment configuration setup  
✅ Database migration script ready

## ⚠️ Common Issues

| Error                               | Fix                                             |
| ----------------------------------- | ----------------------------------------------- |
| "Failed to initialize Google login" | Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local  |
| Backend returns empty Client ID     | Set GOOGLE_CLIENT_ID in Backend/.env            |
| "No module named config"            | Make sure you're running from Backend directory |
| Port 8000 already in use            | Change port in FastAPI or kill existing process |

## 📞 Need Help?

Check these files for configuration:

- [Backend config.py](Backend/config.py) - Shows all config variables
- [Google OAuth setup guide](GOOGLE_OAUTH_SETUP.md) - Detailed instructions
