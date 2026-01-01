"""Batch draft job model for tracking bulk draft generation."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class BatchDraftJob(Base, UUIDMixin, TimestampMixin):
    """Track batch draft generation jobs."""

    __tablename__ = "batch_draft_jobs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Progress tracking
    total_emails: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_emails: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_emails: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Status: 'pending', 'processing', 'completed', 'failed'
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    # Track which emails are being processed
    email_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)),
        nullable=False,
    )

    # Relationship
    user: Mapped[User] = relationship(back_populates="batch_draft_jobs")
