from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.draft import Draft
    from app.models.email import Email
    from app.models.gmail_token import GmailToken
    from app.models.rule import Rule
    from app.models.user_settings import UserSettings


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    gmail_token: Mapped["GmailToken | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    settings: Mapped["UserSettings | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    emails: Mapped[list["Email"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    drafts: Mapped[list["Draft"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    rules: Mapped[list["Rule"]] = relationship(back_populates="user", cascade="all, delete-orphan")
