"""
Zoom Server-to-Server OAuth service for creating scheduled meetings.
Uses account credentials flow to obtain access tokens.
"""

import logging
import time
from datetime import datetime
from typing import Optional

import requests
from config import settings

logger = logging.getLogger(__name__)

# Zoom API endpoints
ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE = "https://api.zoom.us/v2"


class ZoomService:
    """Handles Zoom API interactions using Server-to-Server OAuth."""

    def __init__(self):
        self.account_id = settings.ZOOM_ACCOUNT_ID
        self.client_id = settings.ZOOM_CLIENT_ID
        self.client_secret = settings.ZOOM_CLIENT_SECRET
        self.user_id = settings.ZOOM_USER_ID
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0

    def is_configured(self) -> bool:
        """Check if Zoom credentials are configured."""
        return bool(
            self.account_id
            and self.client_id
            and self.client_secret
        )

    def get_access_token(self) -> str:
        """Get a valid Zoom access token, using cached token if not expired."""
        # Return cached token if valid
        if self._access_token and time.time() < self._token_expiry:
            return self._access_token

        # Get new token
        try:
            response = requests.post(
                ZOOM_TOKEN_URL,
                auth=(self.client_id, self.client_secret),
                data={"grant_type": "account_credentials", "account_id": self.account_id},
                timeout=10,
            )
            response.raise_for_status()

            data = response.json()
            self._access_token = data["access_token"]
            # Cache token with 5-minute buffer before expiry
            self._token_expiry = time.time() + data["expires_in"] - 300
            return self._access_token
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get Zoom access token: {str(e)}")
            raise

    def create_scheduled_meeting(
        self,
        topic: str,
        start_time: datetime,
        duration_minutes: int,
        description: Optional[str] = None,
    ) -> dict:
        """
        Create a scheduled Zoom meeting.
        
        Args:
            topic: Meeting topic/title
            start_time: Meeting start datetime (UTC recommended)
            duration_minutes: Meeting duration in minutes
            description: Optional meeting description
            
        Returns:
            Dictionary with meeting details including join_url, start_url, meeting_id, password
        """
        if not self.is_configured():
            raise ValueError("Zoom is not configured")

        token = self.get_access_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Format start time as ISO 8601
        start_time_str = start_time.isoformat()

        meeting_data = {
            "topic": topic,
            "type": 2,  # Scheduled meeting
            "start_time": start_time_str,
            "duration": duration_minutes,
            "timezone": "UTC",
            "settings": {
                "host_video": True,
                "participant_video": True,
                "waiting_room": False,
                "join_before_host": False,
                "meeting_authentication": False,
            },
        }

        if description:
            meeting_data["agenda"] = description

        try:
            response = requests.post(
                f"{ZOOM_API_BASE}/users/{self.user_id}/meetings",
                headers=headers,
                json=meeting_data,
                timeout=10,
            )
            response.raise_for_status()

            meeting = response.json()
            return {
                "meeting_id": meeting["id"],
                "join_url": meeting["join_url"],
                "start_url": meeting.get("start_url"),
                "password": meeting.get("password", ""),
                "host_email": meeting.get("host_email", ""),
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create Zoom meeting: {str(e)}")
            raise

    def get_meeting(self, meeting_id: int) -> dict:
        """Get details of an existing Zoom meeting."""
        if not self.is_configured():
            raise ValueError("Zoom is not configured")

        token = self.get_access_token()
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.get(
                f"{ZOOM_API_BASE}/meetings/{meeting_id}",
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get Zoom meeting: {str(e)}")
            raise


# Global singleton instance
zoom_service = ZoomService()