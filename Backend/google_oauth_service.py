"""
Google OAuth Service for handling Google authentication and API integrations
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import json
import httpx
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from config import settings
from models import User, UserRole
from auth import create_access_token, create_refresh_token, hash_refresh_token


class GoogleOAuthService:
    """Service for handling Google OAuth flow and token management"""
    
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    @staticmethod
    def get_authorization_url() -> str:
        """Generate Google OAuth authorization URL"""
        if not settings.GOOGLE_CLIENT_ID:
            raise ValueError("GOOGLE_CLIENT_ID is not configured")
        if not settings.GOOGLE_REDIRECT_URI:
            raise ValueError("GOOGLE_REDIRECT_URI is not configured")

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(settings.GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": "security_token"  # Should be random and stored in session
        }
        
        query_string = urlencode(params)
        return f"{GoogleOAuthService.AUTHORIZATION_URL}?{query_string}"
    
    @staticmethod
    async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        if not settings.GOOGLE_CLIENT_ID:
            raise ValueError("GOOGLE_CLIENT_ID is not configured")
        if not settings.GOOGLE_CLIENT_SECRET:
            raise ValueError("GOOGLE_CLIENT_SECRET is not configured")
        if not settings.GOOGLE_REDIRECT_URI:
            raise ValueError("GOOGLE_REDIRECT_URI is not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                GoogleOAuthService.TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                }
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                try:
                    error_data = exc.response.json()
                    error = error_data.get("error", "token_exchange_failed")
                    description = error_data.get("error_description", "")
                    raise ValueError(f"Google token exchange failed: {error}. {description}".strip())
                except ValueError:
                    raise
                except Exception:
                    raise ValueError(f"Google token exchange failed with status {exc.response.status_code}")
            return response.json()
    
    @staticmethod
    async def get_user_info(access_token: str) -> Dict[str, Any]:
        """Get user info from Google using access token"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GoogleOAuthService.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
        """Refresh the access token using refresh token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GoogleOAuthService.TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                }
            )
            response.raise_for_status()
            return response.json()
    
    @staticmethod
    async def handle_google_login(code: str, db: Session) -> Dict[str, Any]:
        """
        Handle complete Google login flow:
        1. Exchange code for tokens
        2. Get user info
        3. Create or update user in database
        4. Return JWT tokens for frontend
        """
        try:
            # Exchange authorization code for tokens
            token_response = await GoogleOAuthService.exchange_code_for_tokens(code)
            google_access_token = token_response.get("access_token")
            google_refresh_token = token_response.get("refresh_token")
            expires_in = token_response.get("expires_in", 3600)
            
            # Calculate token expiry
            google_token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            
            # Get user information from Google
            user_info = await GoogleOAuthService.get_user_info(google_access_token)
            
            google_id = user_info.get("id")
            email = user_info.get("email")
            first_name = user_info.get("given_name", "")
            last_name = user_info.get("family_name", "")
            
            # Check if user exists by google_id first
            user = db.query(User).filter(User.google_id == google_id).first()
            
            if user:
                # Update existing user with new Google tokens
                user.google_access_token = google_access_token
                user.google_refresh_token = google_refresh_token
                user.google_token_expiry = google_token_expiry
                if not user.is_verified:
                    user.is_verified = True
            else:
                # Check if user exists by email
                user = db.query(User).filter(User.email == email).first()
                
                if user:
                    # Link Google account to existing user
                    user.google_id = google_id
                    user.google_access_token = google_access_token
                    user.google_refresh_token = google_refresh_token
                    user.google_token_expiry = google_token_expiry
                    user.is_verified = True
                else:
                    # Create new user
                    user = User(
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        hashed_password="",  # OAuth users don't have passwords
                        google_id=google_id,
                        google_access_token=google_access_token,
                        google_refresh_token=google_refresh_token,
                        google_token_expiry=google_token_expiry,
                        is_verified=True,
                        is_active=True,
                    )
                    db.add(user)
                    db.flush()
                    
                    # Add default CUSTOMER role
                    customer_role = UserRole(user_id=user.id, role="CUSTOMER")
                    db.add(customer_role)
            
            db.commit()
            db.refresh(user)
            
            # Create JWT tokens for frontend
            roles = [r.role for r in db.query(UserRole).filter(UserRole.user_id == user.id).all()]
            access_token = create_access_token(user.id, user.email, roles)
            refresh_token, hashed_refresh_token = create_refresh_token(user.id)
            
            # Store refresh token in database
            from models import RefreshToken
            db_refresh_token = RefreshToken(
                user_id=user.id,
                hashed_token=hashed_refresh_token,
                expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            )
            db.add(db_refresh_token)
            db.commit()
            
            return {
                "success": True,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_verified": user.is_verified,
                    "roles": roles,
                }
            }
        except Exception as e:
            print(f"Error during Google login: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


class GoogleCalendarService:
    """Service for Google Calendar integration"""
    
    CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
    
    @staticmethod
    async def get_calendar_list(user: User) -> Dict[str, Any]:
        """Get list of user's calendars"""
        if not user.google_access_token:
            return {"error": "Google access token not found"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GoogleCalendarService.CALENDAR_API_BASE}/users/me/calendarList",
                headers={"Authorization": f"Bearer {user.google_access_token}"}
            )
            
            if response.status_code == 401:
                # Token expired, refresh it
                new_tokens = await GoogleOAuthService.refresh_access_token(user.google_refresh_token)
                user.google_access_token = new_tokens.get("access_token")
                # Token is valid, retry
                response = await client.get(
                    f"{GoogleCalendarService.CALENDAR_API_BASE}/users/me/calendarList",
                    headers={"Authorization": f"Bearer {user.google_access_token}"}
                )
            
            response.raise_for_status()
            return response.json()
    
    @staticmethod
    async def create_event(
        user: User,
        title: str,
        description: str,
        start_time: str,  # ISO format
        end_time: str,    # ISO format
        attendees: Optional[list] = None,
        meet_enabled: bool = False
    ) -> Dict[str, Any]:
        """Create a calendar event with optional Google Meet"""
        if not user.google_access_token:
            return {"error": "Google access token not found"}
        
        calendar_id = user.google_calendar_id or "primary"
        
        event = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_time, "timeZone": "UTC"},
            "end": {"dateTime": end_time, "timeZone": "UTC"},
            "attendees": attendees or [],
        }
        
        if meet_enabled:
            event["conferenceData"] = {
                "createRequest": {
                    "requestId": f"meet_{user.id}_{int(datetime.now(timezone.utc).timestamp())}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"}
                }
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{GoogleCalendarService.CALENDAR_API_BASE}/calendars/{calendar_id}/events",
                json=event,
                headers={"Authorization": f"Bearer {user.google_access_token}"},
                params={"conferenceDataVersion": 1} if meet_enabled else {}
            )
            
            if response.status_code == 401:
                # Refresh token and retry
                new_tokens = await GoogleOAuthService.refresh_access_token(user.google_refresh_token)
                user.google_access_token = new_tokens.get("access_token")
                response = await client.post(
                    f"{GoogleCalendarService.CALENDAR_API_BASE}/calendars/{calendar_id}/events",
                    json=event,
                    headers={"Authorization": f"Bearer {user.google_access_token}"},
                    params={"conferenceDataVersion": 1} if meet_enabled else {}
                )
            
            response.raise_for_status()
            event_data = response.json()
            
            # Extract Meet link if available
            meet_link = None
            if meet_enabled and "conferenceData" in event_data:
                for entry_point in event_data["conferenceData"].get("entryPoints", []):
                    if entry_point.get("entryPointType") == "video":
                        meet_link = entry_point.get("uri")
                        break
            
            return {
                "success": True,
                "event_id": event_data.get("id"),
                "event_url": event_data.get("htmlLink"),
                "meet_link": meet_link,
                "created_at": event_data.get("created")
            }


class GoogleMeetService:
    """Service for Google Meet integration"""
    
    @staticmethod
    async def get_meet_link(user: User, event_id: str) -> Optional[str]:
        """Get Google Meet link for an existing calendar event"""
        if not user.google_access_token:
            return None
        
        calendar_id = user.google_calendar_id or "primary"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GoogleCalendarService.CALENDAR_API_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {user.google_access_token}"}
            )
            
            if response.status_code == 401:
                new_tokens = await GoogleOAuthService.refresh_access_token(user.google_refresh_token)
                user.google_access_token = new_tokens.get("access_token")
                response = await client.get(
                    f"{GoogleCalendarService.CALENDAR_API_BASE}/calendars/{calendar_id}/events/{event_id}",
                    headers={"Authorization": f"Bearer {user.google_access_token}"}
                )
            
            response.raise_for_status()
            event_data = response.json()
            
            # Extract Meet link
            if "conferenceData" in event_data:
                for entry_point in event_data["conferenceData"].get("entryPoints", []):
                    if entry_point.get("entryPointType") == "video":
                        return entry_point.get("uri")
        
        return None
