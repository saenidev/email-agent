import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ActivityLog(Base, UUIDMixin, TimestampMixin):
    """Audit log for email agent activities."""

    __tablename__ = "activity_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Activity type
    # Types: 'email_received', 'draft_created', 'draft_approved',
    #        'draft_rejected', 'email_sent', 'rule_matched',
    #        'gmail_connected', 'settings_changed'
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Related entities (optional references)
    email_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="SET NULL"),
        nullable=True,
    )
    draft_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drafts.id", ondelete="SET NULL"),
        nullable=True,
    )
    rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Details
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
