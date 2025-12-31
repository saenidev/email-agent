from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EmailSummary(BaseModel):
    id: UUID
    gmail_id: str
    from_email: str | None
    from_name: str | None
    subject: str | None
    snippet: str | None
    is_read: bool
    is_processed: bool
    received_at: datetime | None

    model_config = {"from_attributes": True}


class EmailDetail(BaseModel):
    id: UUID
    gmail_id: str
    thread_id: str | None
    from_email: str | None
    from_name: str | None
    to_emails: list[str] | None
    cc_emails: list[str] | None
    subject: str | None
    snippet: str | None
    body_text: str | None
    body_html: str | None
    is_read: bool
    is_processed: bool
    requires_response: bool | None
    received_at: datetime | None
    processed_at: datetime | None

    model_config = {"from_attributes": True}


class EmailList(BaseModel):
    emails: list[EmailSummary]
    total: int
    page: int
    page_size: int
