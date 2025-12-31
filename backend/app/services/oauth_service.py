"""Gmail OAuth2 service for handling authentication flow."""

from google_auth_oauthlib.flow import Flow

from app.config import get_settings

settings = get_settings()


def get_flow() -> Flow:
    """Create OAuth2 flow for Gmail."""
    client_config = {
        "web": {
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.gmail_redirect_uri],
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=settings.gmail_scopes,
        redirect_uri=settings.gmail_redirect_uri,
    )
    return flow


def get_authorization_url() -> str:
    """Get the Gmail OAuth authorization URL."""
    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access and refresh tokens."""
    flow = get_flow()
    flow.fetch_token(code=code)

    credentials = flow.credentials
    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "expiry": credentials.expiry,
        "scopes": list(credentials.scopes) if credentials.scopes else [],
    }
