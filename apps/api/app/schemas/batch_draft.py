"""Schemas for batch draft generation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BatchDraftRequest(BaseModel):
    """Request to generate drafts for multiple emails."""

    email_ids: list[UUID] = Field(..., min_length=1, max_length=20)


class BatchDraftJobStatus(BaseModel):
    """Status of a batch draft generation job."""

    id: UUID
    status: str  # 'pending', 'processing', 'completed', 'failed'
    total_emails: int
    completed_emails: int
    failed_emails: int
    created_at: datetime

    model_config = {"from_attributes": True}
