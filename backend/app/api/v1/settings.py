from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter()


@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Get current user settings."""
    # TODO: Implement with real user
    return UserSettingsResponse(
        approval_mode="draft_approval",
        llm_model="anthropic/claude-3.5-sonnet",
        llm_temperature=0.7,
        system_prompt=None,
        signature=None,
        notify_on_draft=True,
        notify_on_auto_send=True,
    )


@router.put("", response_model=UserSettingsResponse)
async def update_settings(
    settings_data: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Update user settings."""
    # TODO: Implement
    raise NotImplementedError


@router.get("/models")
async def list_available_models() -> list[dict[str, str]]:
    """List available LLM models from OpenRouter."""
    # Popular models on OpenRouter
    return [
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet"},
        {"id": "anthropic/claude-3-opus", "name": "Claude 3 Opus"},
        {"id": "openai/gpt-4-turbo", "name": "GPT-4 Turbo"},
        {"id": "openai/gpt-4o", "name": "GPT-4o"},
        {"id": "meta-llama/llama-3.1-70b-instruct", "name": "Llama 3.1 70B"},
        {"id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5"},
    ]
