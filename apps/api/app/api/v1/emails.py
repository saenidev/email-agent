from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.email import Email
from app.schemas.email import EmailDetail, EmailList, EmailSummary

router = APIRouter()


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
