"""Activity logging service."""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog


async def log_activity(
    db: AsyncSession,
    user_id: UUID,
    activity_type: str,
    description: str | None = None,
    email_id: UUID | None = None,
    draft_id: UUID | None = None,
    rule_id: UUID | None = None,
    extra_data: dict[str, Any] | None = None,
) -> ActivityLog:
    """Log an activity event."""
    activity = ActivityLog(
        user_id=user_id,
        activity_type=activity_type,
        description=description,
        email_id=email_id,
        draft_id=draft_id,
        rule_id=rule_id,
        extra_data=extra_data,
    )
    db.add(activity)
    await db.flush()
    return activity
