import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)


class ZoomService:
    """Minimal Zoom Server-to-Server OAuth client for scheduled meetings."""

    def __init__(self) -> None:
        self._access_token: Optional[str] = None
        self._access_token_expires_at: Optional[datetime] = None

    def is_configured(self) -> bool:
        return bool(settings.ZOOM_ACCOUNT_ID and settings.ZOOM_CLIENT_ID and settings.ZOOM_CLIENT_SECRET)

    def ensure_configured(self) -> None:
        if not self.is_configured():
            raise RuntimeError(
                "Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET."
            )

    def _build_basic_auth_header(self) -> str:
        encoded = base64.b64encode(
            f"{settings.ZOOM_CLIENT_ID}:{settings.ZOOM_CLIENT_SECRET}".encode("utf-8")
        ).decode("utf-8")
        return f"Basic {encoded}"

    def get_access_token(self) -> str:
        self.ensure_configured()

        now_utc = datetime.now(timezone.utc)
        if (
            self._access_token
            and self._access_token_expires_at
            and now_utc < self._access_token_expires_at - timedelta(minutes=1)
        ):
            return self._access_token

        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                "https://zoom.us/oauth/token",
                params={
                    "grant_type": "account_credentials",
                    "account_id": settings.ZOOM_ACCOUNT_ID,
                },
                headers={
                    "Authorization": self._build_basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

        if not response.is_success:
            try:
                payload = response.json()
            except ValueError:
                payload = {"message": response.text or "Unknown Zoom token error"}
            raise RuntimeError(
                f"Unable to obtain Zoom access token: {payload.get('reason') or payload.get('message') or response.status_code}"
            )

        token_payload = response.json()
        access_token = token_payload.get("access_token")
        expires_in = int(token_payload.get("expires_in") or 3600)
        token_type = str(token_payload.get("token_type") or "").lower()
        if not access_token or token_type != "bearer":
            raise RuntimeError("Zoom token response was missing a usable bearer token")

        self._access_token = str(access_token)
        self._access_token_expires_at = now_utc + timedelta(seconds=expires_in)
        return self._access_token

    def request(self, method: str, path: str, payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        token = self.get_access_token()
        with httpx.Client(timeout=20.0) as client:
            response = client.request(
                method,
                f"https://api.zoom.us/v2{path}",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )

        if response.is_success:
            if response.status_code == 204:
                return {}
            return response.json()

        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {"message": response.text or "Unknown Zoom API error"}

        logger.error("Zoom API request failed: %s %s", response.status_code, error_payload)
        raise RuntimeError(
            f"Zoom API request failed: {error_payload.get('message') or error_payload.get('reason') or response.status_code}"
        )

    def create_scheduled_meeting(
        self,
        *,
        topic: str,
        start_time: datetime,
        end_time: datetime,
        agenda: str = "",
    ) -> dict[str, Any]:
        start_utc = start_time.astimezone(timezone.utc)
        end_utc = end_time.astimezone(timezone.utc)
        duration_minutes = max(1, int((end_utc - start_utc).total_seconds() / 60))

        payload = {
            "topic": topic[:200] or "Appointment meeting",
            "type": 2,
            "start_time": start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "duration": duration_minutes,
            "timezone": "UTC",
            "agenda": agenda[:2000] if agenda else "",
            "settings": {
                "join_before_host": False,
                "waiting_room": True,
                "host_video": True,
                "participant_video": True,
                "mute_upon_entry": True,
            },
        }
        return self.request("POST", f"/users/{settings.ZOOM_USER_ID}/meetings", payload)


zoom_service = ZoomService()
