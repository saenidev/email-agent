import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.draft import Draft
from app.models.email import Email
from app.schemas.draft import DraftDetail, DraftList, DraftSummary, DraftUpdate
from app.schemas.email import EmailSummary

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=DraftList)
async def list_drafts(
    current_user: CurrentUser,
    draft_status: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> DraftList:
    """List drafts (filter by status)."""
    # Build query
    query = select(Draft).where(Draft.user_id == current_user.id)
    count_query = select(func.count()).select_from(Draft).where(Draft.user_id == current_user.id)

    if draft_status:
        query = query.where(Draft.status == draft_status)
        count_query = count_query.where(Draft.status == draft_status)

    # Count total
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get paginated drafts
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(Draft.created_at.desc()).offset(offset).limit(page_size)
    )
    drafts = result.scalars().all()

    return DraftList(
        drafts=[DraftSummary.model_validate(d) for d in drafts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{draft_id}", response_model=DraftDetail)
async def get_draft(
    draft_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> DraftDetail:
    """Get draft detail."""
    result = await db.execute(
        select(Draft)
        .options(selectinload(Draft.email))
        .where(
            Draft.id == draft_id,
            Draft.user_id == current_user.id,
        )
    )
    draft = result.scalar_one_or_none()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found",
        )

    detail = DraftDetail.model_validate(draft)
    if draft.email:
        detail.original_email = EmailSummary.model_validate(draft.email)

    return detail


@router.put("/{draft_id}", response_model=DraftDetail)
async def update_draft(
    draft_id: UUID,
    draft_data: DraftUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> DraftDetail:
    """Edit draft content."""
    result = await db.execute(
        select(Draft)
        .options(selectinload(Draft.email))
        .where(
            Draft.id == draft_id,
            Draft.user_id == current_user.id,
        )
    )
    draft = result.scalar_one_or_none()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found",
        )

    if draft.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only edit pending drafts",
        )

    # Store original if first edit
    if not draft.edited_by_user:
        draft.original_body_text = draft.body_text

    # Update fields
    update_data = draft_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(draft, field, value)

    draft.edited_by_user = True
    await db.flush()
    await db.refresh(draft)

    detail = DraftDetail.model_validate(draft)
    if draft.email:
        detail.original_email = EmailSummary.model_validate(draft.email)

    return detail


@router.post("/{draft_id}/approve")
async def approve_draft(
    draft_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Approve and send the draft."""
    result = await db.execute(
        select(Draft).where(
            Draft.id == draft_id,
            Draft.user_id == current_user.id,
        )
    )
    draft = result.scalar_one_or_none()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found",
        )

    if draft.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only approve pending drafts",
        )

    # Update status and enqueue send job
    draft.status = "approved"
    draft.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    # Enqueue send task
    from arq import create_pool
    from arq.connections import RedisSettings

    from app.config import get_settings

    settings = get_settings()

    try:
        redis = await create_pool(RedisSettings.from_dsn(str(settings.redis_url)))
        await redis.enqueue_job("send_approved_draft", str(draft_id))
        await redis.close()
    except Exception as e:
        logger.exception("Failed to enqueue approved draft %s: %s", draft_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enqueue draft for sending",
        )

    return {"status": "approved", "draft_id": str(draft_id)}


@router.post("/{draft_id}/reject")
async def reject_draft(
    draft_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Reject the draft."""
    result = await db.execute(
        select(Draft).where(
            Draft.id == draft_id,
            Draft.user_id == current_user.id,
        )
    )
    draft = result.scalar_one_or_none()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found",
        )

    if draft.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only reject pending drafts",
        )

    draft.status = "rejected"
    draft.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "rejected", "draft_id": str(draft_id)}


@router.post("/{draft_id}/regenerate", response_model=DraftDetail)
async def regenerate_draft(
    draft_id: UUID,
    current_user: CurrentUser,
    custom_prompt: str | None = Body(None, embed=True),
    request: Request | None = None,
    db: AsyncSession = Depends(get_db),
) -> DraftDetail:
    """Regenerate draft with optional custom prompt."""
    result = await db.execute(
        select(Draft)
        .options(selectinload(Draft.email))
        .where(
            Draft.id == draft_id,
            Draft.user_id == current_user.id,
        )
    )
    draft = result.scalar_one_or_none()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found",
        )

    if not draft.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original email not found",
        )

    # Get user settings and regenerate
    from app.models.user_settings import UserSettings
    from app.services.openrouter_service import EmailContext, OpenRouterService

    if custom_prompt is None and request is not None:
        custom_prompt = request.query_params.get("custom_prompt")

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = settings_result.scalar_one_or_none()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User settings not found",
        )

    # Generate new response
    llm = OpenRouterService()
    context = EmailContext(
        original_email=draft.email.body_text or "",
        sender_name=draft.email.from_name or draft.email.from_email or "",
        sender_email=draft.email.from_email or "",
        subject=draft.email.subject or "",
        user_signature=settings.signature,
        custom_instructions=custom_prompt or settings.system_prompt,
    )

    response = await llm.generate_email_response(
        context,
        model=settings.llm_model,
        temperature=float(settings.llm_temperature),
    )

    # Update draft
    if not draft.original_body_text:
        draft.original_body_text = draft.body_text

    draft.body_text = response.body
    draft.llm_reasoning = response.reasoning
    draft.edited_by_user = False
    await db.flush()
    await db.refresh(draft)

    detail = DraftDetail.model_validate(draft)
    detail.original_email = EmailSummary.model_validate(draft.email)

    return detail
