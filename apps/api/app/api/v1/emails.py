import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.batch_draft_job import BatchDraftJob
from app.models.draft import Draft
from app.models.email import Email
from app.schemas.batch_draft import BatchDraftJobStatus, BatchDraftRequest
from app.schemas.email import EmailDetail, EmailList, EmailSummary

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=EmailList)
async def list_emails(
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> EmailList:
    """List emails from inbox (paginated)."""
    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(Email).where(Email.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    # Get paginated emails
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Email)
        .where(Email.user_id == current_user.id)
        .order_by(Email.received_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    emails = result.scalars().all()

    return EmailList(
        emails=[EmailSummary.model_validate(e) for e in emails],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unreplied", response_model=EmailList)
async def list_unreplied_emails(
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> EmailList:
    """List emails without active drafts (unreplied emails).

    An email is considered "unreplied" if it has no drafts, or all its drafts
    have been rejected.
    """
    # Subquery: check if email has an active draft
    has_active_draft = exists().where(
        and_(
            Draft.email_id == Email.id,
            Draft.status.in_(["pending", "approved", "sent", "auto_sent"]),
        )
    )

    # Base query for unreplied emails
    base_query = select(Email).where(
        Email.user_id == current_user.id,
        not_(has_active_draft),
    )

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    # Get paginated emails
    offset = (page - 1) * page_size
    result = await db.execute(
        base_query.order_by(Email.received_at.desc()).offset(offset).limit(page_size)
    )
    emails = result.scalars().all()

    return EmailList(
        emails=[EmailSummary.model_validate(e) for e in emails],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/generate-drafts", response_model=BatchDraftJobStatus)
async def generate_drafts_for_emails(
    request: BatchDraftRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> BatchDraftJobStatus:
    """Queue selected emails for immediate draft generation.

    Creates a batch job and enqueues worker tasks to generate drafts.
    Returns the job status for polling.
    """
    from arq import create_pool
    from arq.connections import RedisSettings

    from app.config import get_settings

    # Validate all email_ids belong to user
    result = await db.execute(
        select(Email.id).where(
            Email.id.in_(request.email_ids),
            Email.user_id == current_user.id,
        )
    )
    valid_email_ids = set(result.scalars().all())

    if not valid_email_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid emails found",
        )

    # Filter out emails that already have active drafts
    has_active_draft = exists().where(
        and_(
            Draft.email_id == Email.id,
            Draft.status.in_(["pending", "approved", "sent", "auto_sent"]),
        )
    )
    result = await db.execute(
        select(Email.id).where(
            Email.id.in_(valid_email_ids),
            not_(has_active_draft),
        )
    )
    emails_to_process = list(result.scalars().all())

    if not emails_to_process:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All selected emails already have active drafts",
        )

    # Create batch job
    batch_job = BatchDraftJob(
        user_id=current_user.id,
        total_emails=len(emails_to_process),
        completed_emails=0,
        failed_emails=0,
        status="processing",
        email_ids=emails_to_process,
    )
    db.add(batch_job)
    await db.flush()
    await db.refresh(batch_job)
    await db.commit()

    # Enqueue worker tasks
    settings = get_settings()
    redis = None
    try:
        redis = await create_pool(RedisSettings.from_dsn(str(settings.redis_url)))
        for email_id in emails_to_process:
            await redis.enqueue_job(
                "generate_draft_for_email",
                str(email_id),
                str(batch_job.id),
            )
    except Exception as e:
        logger.exception("Failed to enqueue draft generation jobs: %s", e)
        batch_job.status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start draft generation",
        )
    finally:
        if redis is not None:
            await redis.close()

    return BatchDraftJobStatus.model_validate(batch_job)


@router.get("/generate-drafts/{job_id}/status", response_model=BatchDraftJobStatus)
async def get_batch_job_status(
    job_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> BatchDraftJobStatus:
    """Get status of a batch draft generation job."""
    result = await db.execute(
        select(BatchDraftJob).where(
            BatchDraftJob.id == job_id,
            BatchDraftJob.user_id == current_user.id,
        )
    )
    batch_job = result.scalar_one_or_none()

    if not batch_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch job not found",
        )

    return BatchDraftJobStatus.model_validate(batch_job)


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(
    email_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Email:
    """Get email detail."""
    result = await db.execute(
        select(Email).where(
            Email.id == email_id,
            Email.user_id == current_user.id,
        )
    )
    email = result.scalar_one_or_none()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found",
        )

    return email


@router.post("/sync")
async def sync_emails(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Trigger manual email sync."""
    from arq import create_pool
    from arq.connections import RedisSettings

    from app.config import get_settings

    settings = get_settings()

    try:
        redis = await create_pool(RedisSettings.from_dsn(str(settings.redis_url)))
        await redis.enqueue_job("poll_emails_for_user", str(current_user.id))
        await redis.close()
        return {"status": "sync_started"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{email_id}/thread")
async def get_email_thread(
    email_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[EmailSummary]:
    """Get full email thread."""
    # First get the email to find its thread_id
    result = await db.execute(
        select(Email).where(
            Email.id == email_id,
            Email.user_id == current_user.id,
        )
    )
    email = result.scalar_one_or_none()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found",
        )

    if not email.thread_id:
        return [EmailSummary.model_validate(email)]

    # Get all emails in thread
    result = await db.execute(
        select(Email)
        .where(
            Email.thread_id == email.thread_id,
            Email.user_id == current_user.id,
        )
        .order_by(Email.received_at.asc())
    )
    thread_emails = result.scalars().all()

    return [EmailSummary.model_validate(e) for e in thread_emails]
