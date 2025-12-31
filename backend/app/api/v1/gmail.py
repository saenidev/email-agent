from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt_token
from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.gmail_token import GmailToken
from app.schemas.gmail import GmailStatus
from app.services.gmail_service import GmailService
from app.services.oauth_service import exchange_code_for_tokens, get_authorization_url

router = APIRouter()


@router.get("/auth/url")
async def get_gmail_auth_url(current_user: CurrentUser) -> dict[str, str]:
    """Get the Gmail OAuth authorization URL."""
    # Include user_id in state for callback
    auth_url = get_authorization_url(state=str(current_user.id))
    return {"auth_url": auth_url}


@router.get("/auth/callback")
async def gmail_auth_callback(
    code: str | None = None,
    error: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle Gmail OAuth callback."""
    frontend_url = "http://localhost:3000/dashboard/settings"

    if error:
        return RedirectResponse(url=f"{frontend_url}?error={error}")

    if not code:
        return RedirectResponse(url=f"{frontend_url}?error=no_code")

    if not state:
        return RedirectResponse(url=f"{frontend_url}?error=no_state")

    try:
        from uuid import UUID

        user_id = UUID(state)

        # Exchange code for tokens
        tokens = await exchange_code_for_tokens(code)

        # Get user's Gmail address
        gmail_service = GmailService(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )
        profile = gmail_service.get_profile()

        # Check if token already exists for this user
        result = await db.execute(
            select(GmailToken).where(GmailToken.user_id == user_id)
        )
        existing_token = result.scalar_one_or_none()

        if existing_token:
            # Update existing token
            existing_token.gmail_email = profile["email"]
            existing_token.access_token_encrypted = encrypt_token(tokens["access_token"])
            existing_token.refresh_token_encrypted = encrypt_token(tokens["refresh_token"])
            existing_token.token_expiry = tokens.get("expiry")
            existing_token.scopes = tokens.get("scopes")
        else:
            # Create new token record
            gmail_token = GmailToken(
                user_id=user_id,
                gmail_email=profile["email"],
                access_token_encrypted=encrypt_token(tokens["access_token"]),
                refresh_token_encrypted=encrypt_token(tokens["refresh_token"]),
                token_expiry=tokens.get("expiry"),
                scopes=tokens.get("scopes"),
            )
            db.add(gmail_token)

        await db.flush()
        return RedirectResponse(url=f"{frontend_url}?gmail=connected")

    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}?error={str(e)}")


@router.get("/status", response_model=GmailStatus)
async def get_gmail_status(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> GmailStatus:
    """Check Gmail connection status."""
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == current_user.id)
    )
    token = result.scalar_one_or_none()

    if token:
        return GmailStatus(connected=True, email=token.gmail_email)

    return GmailStatus(connected=False, email=None)


@router.delete("/disconnect")
async def disconnect_gmail(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Revoke Gmail access and delete stored tokens."""
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == current_user.id)
    )
    token = result.scalar_one_or_none()

    if token:
        await db.delete(token)
        await db.flush()

    return {"status": "disconnected"}
