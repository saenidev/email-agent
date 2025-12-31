from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.draft import DraftDetail, DraftList, DraftUpdate

router = APIRouter()


@router.get("", response_model=DraftList)
async def list_drafts(
    status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> DraftList:
    """List drafts (filter by status)."""
    # TODO: Implement
    return DraftList(drafts=[], total=0, page=page, page_size=page_size)


@router.get("/{draft_id}", response_model=DraftDetail)
async def get_draft(
    draft_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> DraftDetail:
    """Get draft detail."""
    # TODO: Implement
    raise NotImplementedError


@router.put("/{draft_id}", response_model=DraftDetail)
async def update_draft(
    draft_id: UUID,
    draft_data: DraftUpdate,
    db: AsyncSession = Depends(get_db),
) -> DraftDetail:
    """Edit draft content."""
    # TODO: Implement
    raise NotImplementedError


@router.post("/{draft_id}/approve")
async def approve_draft(
    draft_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Approve and send the draft."""
    # TODO: Implement - enqueue send task
    return {"status": "approved", "draft_id": str(draft_id)}


@router.post("/{draft_id}/reject")
async def reject_draft(
    draft_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Reject the draft."""
    # TODO: Implement
    return {"status": "rejected", "draft_id": str(draft_id)}


@router.post("/{draft_id}/regenerate")
async def regenerate_draft(
    draft_id: UUID,
    custom_prompt: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> DraftDetail:
    """Regenerate draft with optional custom prompt."""
    # TODO: Implement
    raise NotImplementedError
