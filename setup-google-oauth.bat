@echo off
REM Quick setup script for Google OAuth configuration
REM This creates the necessary .env files with placeholders

echo.
echo ============================================
echo Google OAuth Setup for ODOO Appointment
echo ============================================
echo.
echo This script will help you set up Google OAuth.
echo You need Google OAuth credentials first.
echo.
echo STEP 1: Get credentials from Google Cloud Console
echo - Go to: https://console.cloud.google.com/apis/credentials
echo - Create OAuth 2.0 Web Application
echo - Copy the Client ID and Client Secret
echo.
echo STEP 2: Create Backend .env file
if not exist "Backend\.env" (
    (
        echo # Database
        echo DATABASE_URL=postgresql://postgres:password@localhost/pg_admin
        echo.
        echo # Google OAuth Configuration
        echo GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
        echo GOOGLE_CLIENT_SECRET=PASTE_YOUR_CLIENT_SECRET_HERE
        echo GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
    ) > Backend\.env
    echo Created Backend\.env - Now edit it with your credentials
) else (
    echo Backend\.env already exists - please update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
)

echo.
echo STEP 3: Create Frontend .env.local file
if not exist "Frontend\appointment_app\.env.local" (
    (
        echo # Google OAuth Configuration
        echo NEXT_PUBLIC_GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
    ) > Frontend\appointment_app\.env.local
    echo Created Frontend\appointment_app\.env.local - Now edit it with your Client ID
) else (
    echo Frontend\appointment_app\.env.local already exists
)

echo.
echo ============================================
echo Next steps:
echo 1. Update Backend\.env with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
echo 2. Update Frontend\appointment_app\.env.local with NEXT_PUBLIC_GOOGLE_CLIENT_ID
echo 3. Run: cd Backend ^&^& python migrate_google_oauth_columns.py
echo 4. Run: python main.py (Backend)
echo 5. Run: cd Frontend\appointment_app ^&^& npm run dev (Frontend)
echo ============================================
echo.
pause
