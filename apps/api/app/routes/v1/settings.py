from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.user_settings import UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate
from app.services.guardrails_service import (
    GuardrailConfig,
    GuardrailsService,
    ViolationType,
)

router = APIRouter()


class GuardrailTestRequest(BaseModel):
    """Request to test guardrails against sample content."""

    content: str
    confidence: float = 1.0


class GuardrailViolationResponse(BaseModel):
    """A single guardrail violation."""

    violation_type: str
    matched_text: str
    description: str


class GuardrailTestResponse(BaseModel):
    """Response from guardrail test."""

    passed: bool
    violations: list[GuardrailViolationResponse]
    should_downgrade_to_draft: bool


@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    """Get current user settings."""
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
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
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
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
        {"id": "nvidia/nemotron-3-nano-30b-a3b:free", "name": "NVIDIA: Nemotron 3 Nano 30B A3B"},
        {"id": "z-ai/glm-4.5-air:free", "name": "Z.AI: GLM 4.5 Air (Free)"},
        {"id": "nvidia/nemotron-nano-12b-v2-vl:free", "name": "NVIDIA: Nemotron Nano 12B 2 VL"},
        {"id": "tngtech/tng-r1t-chimera:free", "name": "TNG: R1T Chimera (Free)"},
        {"id": "qwen/qwen3-coder:free", "name": "Qwen: Qwen3 Coder 480B A35B (Free)"},
        {"id": "deepseek/deepseek-r1-0528:free", "name": "DeepSeek: R1 0528 (Free)"},
        {"id": "google/gemma-3-27b-it:free", "name": "Google: Gemma 3 27B (Free)"},
        {"id": "allenai/olmo-3.1-32b-think:free", "name": "AllenAI: Olmo 3.1 32B Think (Free)"},
        {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Meta: Llama 3.3 70B Instruct"},
    ]


@router.post("/guardrails/test", response_model=GuardrailTestResponse)
async def test_guardrails(
    request: GuardrailTestRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> GuardrailTestResponse:
    """
    Test guardrails against sample content.

    This endpoint allows users to validate their guardrail settings
    by testing against sample email content without actually sending.
    """
    # Get user settings
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    settings = result.scalar_one_or_none()

    if not settings:
        # Use defaults if no settings exist
        settings = UserSettings(user_id=current_user.id)

    # Create guardrails service from settings
    config = GuardrailConfig(
        profanity_filter_enabled=settings.guardrail_profanity_enabled,
        pii_filter_enabled=settings.guardrail_pii_enabled,
        commitment_filter_enabled=settings.guardrail_commitment_enabled,
        custom_keywords_enabled=settings.guardrail_custom_keywords_enabled,
        confidence_threshold=float(settings.guardrail_confidence_threshold),
        custom_blocked_keywords=settings.guardrail_blocked_keywords or [],
    )
    guardrails = GuardrailsService(config)

    # Run validation
    validation = guardrails.validate(request.content, confidence=request.confidence)

    # Convert to response
    violations = [
        GuardrailViolationResponse(
            violation_type=v.violation_type.value,
            matched_text=v.matched_text,
            description=v.description,
        )
        for v in validation.violations
    ]

    return GuardrailTestResponse(
        passed=validation.passed,
        violations=violations,
        should_downgrade_to_draft=validation.should_downgrade_to_draft,
    )
