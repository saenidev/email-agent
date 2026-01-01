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
        {"id": "xiaomi/mimo-v2-flash:free", "name": "Xiaomi: MiMo-V2-Flash (Free)"},
        {"id": "mistralai/devstral-2512:free", "name": "Mistral: Devstral 2 2512 (Free)"},
        {"id": "kwaipilot/kat-coder-pro:free", "name": "Kwaipilot: KAT-Coder-Pro V1 (Free)"},
        {"id": "tngtech/deepseek-r1t2-chimera:free", "name": "TNG: DeepSeek R1T2 Chimera (Free)"},
        {"id": "nex-agi/deepseek-v3.1-nex-n1:free", "name": "Nex AGI: DeepSeek V3.1 Nex N1 (Free)"},
        {"id": "tngtech/deepseek-r1t-chimera:free", "name": "TNG: DeepSeek R1T Chimera (Free)"},
        {"id": "nvidia/nemotron-3-nano-30b-a3b:free", "name": "NVIDIA: Nemotron 3 Nano 30B A3B (Free)"},
        {"id": "z-ai/glm-4.5-air:free", "name": "Z.AI: GLM 4.5 Air (Free)"},
        {"id": "nvidia/nemotron-nano-12b-v2-vl:free", "name": "NVIDIA: Nemotron Nano 12B 2 VL (Free)"},
        {"id": "tngtech/tng-r1t-chimera:free", "name": "TNG: R1T Chimera (Free)"},
        {"id": "qwen/qwen3-coder:free", "name": "Qwen: Qwen3 Coder 480B A35B (Free)"},
        {"id": "deepseek/deepseek-r1-0528:free", "name": "DeepSeek: R1 0528 (Free)"},
        {"id": "google/gemma-3-27b-it:free", "name": "Google: Gemma 3 27B (Free)"},
        {"id": "allenai/olmo-3.1-32b-think:free", "name": "AllenAI: Olmo 3.1 32B Think (Free)"},
        {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Meta: Llama 3.3 70B Instruct (Free)"},
    ]
