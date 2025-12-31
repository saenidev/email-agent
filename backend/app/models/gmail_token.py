import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class GmailToken(Base, UUIDMixin, TimestampMixin):
    """Stores encrypted Gmail OAuth tokens for each user."""

    __tablename__ = "gmail_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    gmail_email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Encrypted tokens (use Fernet encryption)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)

    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scopes: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # For incremental sync - Gmail history ID
    history_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Relationship
    user: Mapped["User"] = relationship(back_populates="gmail_token")
