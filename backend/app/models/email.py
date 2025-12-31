import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.draft import Draft
    from app.models.user import User


class Email(Base, UUIDMixin, TimestampMixin):
    """Cached emails from Gmail for display and processing context."""

    __tablename__ = "emails"
    __table_args__ = (UniqueConstraint("user_id", "gmail_id", name="uq_user_gmail_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gmail_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Email metadata
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    to_emails: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    cc_emails: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_response: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Timestamps
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="emails")
    drafts: Mapped[list["Draft"]] = relationship(back_populates="email", cascade="all, delete-orphan")
