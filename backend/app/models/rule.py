import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.draft import Draft
    from app.models.user import User


class Rule(Base, UUIDMixin, TimestampMixin):
    """Automation rules for email processing."""

    __tablename__ = "rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Rule enabled
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Priority (lower = higher priority)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    # Conditions (JSONB structure)
    # Example:
    # {
    #     "operator": "AND",
    #     "rules": [
    #         {"field": "from_email", "operator": "contains", "value": "@company.com"},
    #         {"field": "subject", "operator": "contains", "value": "urgent"}
    #     ]
    # }
    conditions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Action: 'auto_respond', 'draft_only', 'ignore', 'forward'
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # Action configuration (JSONB)
    # Example for auto_respond:
    # {
    #     "use_custom_prompt": true,
    #     "custom_prompt": "Respond professionally and briefly",
    #     "max_response_length": 500
    # }
    action_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="rules")
    drafts: Mapped[list["Draft"]] = relationship(back_populates="matched_rule")
