import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class UserSettings(Base, UUIDMixin, TimestampMixin):
    """User preferences for the email agent."""

    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Approval mode: 'draft_approval', 'auto_with_rules', 'fully_automatic'
    approval_mode: Mapped[str] = mapped_column(
        String(50),
        default="draft_approval",
        nullable=False,
    )

    # LLM settings
    llm_model: Mapped[str] = mapped_column(
        String(100),
        default="deepseek/deepseek-chat-v3.1:free",
        nullable=False,
    )
    llm_temperature: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        default=Decimal("0.7"),
        nullable=False,
    )

    # Prompt customization
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    signature: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Notification preferences
    notify_on_draft: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_on_auto_send: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Guardrail settings
    guardrail_profanity_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    guardrail_pii_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    guardrail_commitment_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    guardrail_custom_keywords_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    guardrail_confidence_threshold: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        default=Decimal("0.70"),
        nullable=False,
    )
    guardrail_blocked_keywords: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )

    # Relationship
    user: Mapped["User"] = relationship(back_populates="settings")
