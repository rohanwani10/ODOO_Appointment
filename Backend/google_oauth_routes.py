"""
Google OAuth routes for authentication with Google
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
from google_oauth_service import GoogleOAuthService
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["oauth"])


class GoogleAuthRequest(BaseModel):
    code: str
    state: Optional[str] = None


class GoogleAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict


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
async def get_calendar_list(db: Session = Depends(get_db)):
    """Get user's Google Calendar list"""
    from auth import verify_access_token
    from fastapi import Header
    
    auth_header = Header(default="")
    try:
        token = auth_header.split(" ")[1] if auth_header else None
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization token"
            )
        
        token_data = verify_access_token(token, db)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        from models import User
        user = db.query(User).filter(User.id == token_data.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        result = await GoogleOAuthService.get_calendar_list(user)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/google/calendar/event")
async def create_calendar_event(
    event_data: dict,
    db: Session = Depends(get_db)
):
    """Create a Google Calendar event with optional Google Meet"""
    from auth import verify_access_token
    from fastapi import Header
    
    auth_header = Header(default="")
    try:
        token = auth_header.split(" ")[1] if auth_header else None
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization token"
            )
        
        token_data = verify_access_token(token, db)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        from models import User
        user = db.query(User).filter(User.id == token_data.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        result = await GoogleOAuthService.create_event(
            user=user,
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
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/google/meet/{event_id}")
async def get_meet_link(event_id: str, db: Session = Depends(get_db)):
    """Get Google Meet link for an event"""
    from auth import verify_access_token
    from fastapi import Header
    
    auth_header = Header(default="")
    try:
        token = auth_header.split(" ")[1] if auth_header else None
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization token"
            )
        
        token_data = verify_access_token(token, db)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        from models import User
        from google_oauth_service import GoogleMeetService
        
        user = db.query(User).filter(User.id == token_data.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        meet_link = await GoogleMeetService.get_meet_link(user, event_id)
        
        if not meet_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Google Meet link not found for this event"
            )
        
        return {"meet_link": meet_link}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
