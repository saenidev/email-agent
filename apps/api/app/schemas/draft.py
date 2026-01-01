from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.email import EmailSummary


class DraftSummary(BaseModel):
    id: UUID
    email_id: UUID
    to_emails: list[str]
    subject: str
    body_text: str
    status: str
    llm_model_used: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DraftDetail(BaseModel):
    id: UUID
    email_id: UUID
    to_emails: list[str]
    cc_emails: list[str] | None
    subject: str
    body_text: str
    body_html: str | None
    status: str
    llm_model_used: str | None
    llm_reasoning: str | None
    matched_rule_id: UUID | None
    created_at: datetime
    reviewed_at: datetime | None
    sent_at: datetime | None
    original_body_text: str | None
    edited_by_user: bool
    original_email: EmailSummary | None = None

    model_config = {"from_attributes": True}


class DraftUpdate(BaseModel):
    to_emails: list[str] | None = None
    cc_emails: list[str] | None = None
    subject: str | None = None
    body_text: str | None = None


class DraftList(BaseModel):
    drafts: list[DraftSummary]
    total: int
    page: int
    page_size: int
