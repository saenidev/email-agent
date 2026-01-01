from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActivitySummary(BaseModel):
    id: UUID
    activity_type: str
    description: str | None
    email_id: UUID | None
    draft_id: UUID | None
    rule_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityList(BaseModel):
    activities: list[ActivitySummary]
    total: int
    page: int
    page_size: int
