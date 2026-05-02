"""
Google OAuth routes for authentication with Google
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from auth import get_user_by_id, verify_access_token
from database import get_db
from google_oauth_service import GoogleCalendarService, GoogleMeetService, GoogleOAuthService
from models import User

router = APIRouter(prefix="/api/auth", tags=["oauth"])


class GoogleAuthRequest(BaseModel):
    code: str
    state: Optional[str] = None


class GoogleAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict


def get_google_oauth_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate the caller using the same bearer token flow as the main API."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = authorization[7:]
    token_data = verify_access_token(token, db)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    user = get_user_by_id(token_data.user_id, db)
    if user is None or not user.is_active:  # type: ignore[arg-type]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


@router.get("/google/authorization-url")
async def get_google_authorization_url():
    """Get the Google OAuth authorization URL for frontend redirect"""
    try:
        return {
            "authorization_url": GoogleOAuthService.get_authorization_url()
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


@router.post("/google/callback", response_model=GoogleAuthResponse)
async def google_callback(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback
    Frontend sends the authorization code here
    """
    try:
        result = await GoogleOAuthService.handle_google_login(request.code, db)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=result.get("error", "Google authentication failed")
            )
        
        return GoogleAuthResponse(
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            token_type=result["token_type"],
            user=result["user"]
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}"
        )


@router.get("/google/calendar/list")
async def get_calendar_list(
    current_user: User = Depends(get_google_oauth_current_user),
    db: Session = Depends(get_db),
):
    """Get user's Google Calendar list"""
    try:
        result = await GoogleCalendarService.get_calendar_list(current_user)
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"],
            )
        db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/google/calendar/event")
async def create_calendar_event(
    event_data: dict,
    current_user: User = Depends(get_google_oauth_current_user),
    db: Session = Depends(get_db)
):
    """Create a Google Calendar event with optional Google Meet"""
    try:
        result = await GoogleCalendarService.create_event(
            user=current_user,
            title=event_data.get("title", ""),
            description=event_data.get("description", ""),
            start_time=event_data.get("start_time"),
            end_time=event_data.get("end_time"),
            attendees=event_data.get("attendees", []),
            meet_enabled=event_data.get("meet_enabled", False)
        )
        
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )

        db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/google/meet/{event_id}")
async def get_meet_link(
    event_id: str,
    current_user: User = Depends(get_google_oauth_current_user),
    db: Session = Depends(get_db),
):
    """Get Google Meet link for an event"""
    try:
        meet_link = await GoogleMeetService.get_meet_link(current_user, event_id)
        
        if not meet_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Google Meet link not found for this event"
            )

        db.commit()
        return {"meet_link": meet_link}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )