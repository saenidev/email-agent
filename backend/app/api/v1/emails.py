from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.email import EmailDetail, EmailList

router = APIRouter()


@router.get("", response_model=EmailList)
async def list_emails(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> EmailList:
    """List emails from inbox (paginated)."""
    # TODO: Implement with pagination
    return EmailList(emails=[], total=0, page=page, page_size=page_size)


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(
    email_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> EmailDetail:
    """Get email detail."""
    # TODO: Implement
    raise NotImplementedError


@router.post("/sync")
async def sync_emails(
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Trigger manual email sync."""
    # TODO: Enqueue sync task
    return {"status": "sync_started"}


@router.get("/{email_id}/thread")
async def get_email_thread(
    email_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get full email thread."""
    # TODO: Implement
    raise NotImplementedError
