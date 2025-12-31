from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.schemas.gmail import GmailStatus

router = APIRouter()


@router.get("/auth/url")
async def get_gmail_auth_url() -> dict[str, str]:
    """Get the Gmail OAuth authorization URL."""
    from app.services.oauth_service import get_authorization_url

    auth_url = get_authorization_url()
    return {"auth_url": auth_url}


@router.get("/auth/callback")
async def gmail_auth_callback(
    code: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    """Handle Gmail OAuth callback."""
    if error:
        # Redirect to frontend with error
        return RedirectResponse(url=f"http://localhost:3000/settings?error={error}")

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No authorization code provided",
        )

    # TODO: Exchange code for tokens and store them
    # Redirect to frontend settings page
    return RedirectResponse(url="http://localhost:3000/settings?gmail=connected")


@router.get("/status", response_model=GmailStatus)
async def get_gmail_status() -> GmailStatus:
    """Check Gmail connection status."""
    # TODO: Check if user has valid Gmail tokens
    return GmailStatus(
        connected=False,
        email=None,
    )


@router.delete("/disconnect")
async def disconnect_gmail() -> dict[str, str]:
    """Revoke Gmail access."""
    # TODO: Revoke tokens and remove from database
    return {"status": "disconnected"}
