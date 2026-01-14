import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.email import Email
    from app.models.rule import Rule
    from app.models.user import User


class Draft(Base, UUIDMixin, TimestampMixin):
    """AI-generated email responses awaiting approval."""

    __tablename__ = "drafts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Draft content
    to_emails: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    cc_emails: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status: 'pending', 'approved', 'rejected', 'sent', 'auto_sent'
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False, index=True)

    # Metadata
    llm_model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    llm_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    matched_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Timestamps
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # User modifications
    original_body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_by_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Guardrail tracking
    guardrail_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    guardrail_violations: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="drafts")
    email: Mapped["Email"] = relationship(back_populates="drafts")
    matched_rule: Mapped["Rule | None"] = relationship(back_populates="drafts")
