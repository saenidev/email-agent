from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.user_settings import UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter()


@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    """Get current user settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create default settings if not exists
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)

    return settings


@router.put("", response_model=UserSettingsResponse)
async def update_settings(
    settings_data: UserSettingsUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    """Update user settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    # Update only provided fields
    update_data = settings_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.flush()
    await db.refresh(settings)
    return settings


@router.get("/models")
async def list_available_models() -> list[dict[str, str]]:
    """List available LLM models from OpenRouter (free tier)."""
    return [
        {"id": "deepseek/deepseek-chat-v3.1:free", "name": "DeepSeek V3.1 (Free)"},
        {"id": "deepseek/deepseek-r1-0528:free", "name": "DeepSeek R1 May 2025 (Free)"},
        {"id": "deepseek/deepseek-r1:free", "name": "DeepSeek R1 (Free)"},
        {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B (Free)"},
        {"id": "qwen/qwen-2.5-72b-instruct:free", "name": "Qwen 2.5 72B (Free)"},
    ]
