"""Activity log API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.activity import ActivityLog
from app.schemas.activity import ActivityList, ActivitySummary

router = APIRouter()


@router.get("", response_model=ActivityList)
async def list_activities(
    current_user: CurrentUser,
    activity_type: str | None = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ActivityList:
    """List activity logs for the current user."""
    # Build query
    query = select(ActivityLog).where(ActivityLog.user_id == current_user.id)
    count_query = (
        select(func.count())
        .select_from(ActivityLog)
        .where(ActivityLog.user_id == current_user.id)
    )

    if activity_type:
        query = query.where(ActivityLog.activity_type == activity_type)
        count_query = count_query.where(ActivityLog.activity_type == activity_type)

    # Count total
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get paginated activities (newest first)
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(page_size)
    )
    activities = result.scalars().all()

    return ActivityList(
        activities=[ActivitySummary.model_validate(a) for a in activities],
        total=total,
        page=page,
        page_size=page_size,
    )
