"""ARQ background task definitions."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import async_session_maker
from app.models.draft import Draft
from app.models.email import Email
from app.models.gmail_token import GmailToken
from app.models.user import User
from app.services.email_processor import create_email_processor, get_user_settings
from app.services.gmail_service import GmailService

logger = logging.getLogger(__name__)


async def poll_emails_for_user(ctx: dict, user_id: str) -> dict:
    """Poll and process emails for a single user."""
    async with async_session_maker() as db:
        # Get user with related data
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.gmail_token),
                selectinload(User.settings),
                selectinload(User.rules),
            )
            .where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()

        if not user or not user.gmail_token:
            return {"status": "skipped", "reason": "no_gmail_token"}

        try:
            # Create Gmail service
            gmail_service = GmailService.from_encrypted_tokens(
                user.gmail_token.access_token_encrypted,
                user.gmail_token.refresh_token_encrypted,
            )

            # Get new messages (incremental sync if history_id available)
            if user.gmail_token.history_id:
                messages, new_history_id = gmail_service.get_history(
                    user.gmail_token.history_id
                )
                if new_history_id:
                    user.gmail_token.history_id = new_history_id
                    await db.flush()
            else:
                # Full sync - get recent unread messages
                messages = gmail_service.list_messages(
                    query="is:inbox is:unread",
                    max_results=20,
                )

            if not messages:
                return {"status": "success", "processed": 0}

            # Create processor
            processor = await create_email_processor(db, user)
            if not processor:
                return {"status": "error", "reason": "failed_to_create_processor"}

            settings = await get_user_settings(db, user.id)
            if not settings:
                return {"status": "error", "reason": "no_settings"}

            processed = 0
            for msg_ref in messages:
                # Check if already in database
                existing = await db.execute(
                    select(Email).where(
                        Email.user_id == user.id,
                        Email.gmail_id == msg_ref["id"],
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                # Fetch full message
                email_msg = gmail_service.get_message(msg_ref["id"])

                # Store in database
                email = Email(
                    user_id=user.id,
                    gmail_id=email_msg.gmail_id,
                    thread_id=email_msg.thread_id,
                    from_email=email_msg.from_email,
                    from_name=email_msg.from_name,
                    to_emails=email_msg.to_emails,
                    cc_emails=email_msg.cc_emails,
                    subject=email_msg.subject,
                    snippet=email_msg.snippet,
                    body_text=email_msg.body_text,
                    body_html=email_msg.body_html,
                    received_at=email_msg.received_at,
                )
                db.add(email)
                await db.flush()

                # Process the email
                await processor.process_email(email_msg, settings)
                processed += 1

            await db.commit()
            return {"status": "success", "processed": processed}

        except Exception as e:
            logger.exception(f"Error polling emails for user {user_id}: {e}")
            await db.rollback()
            return {"status": "error", "reason": str(e)}


async def poll_all_users(ctx: dict) -> dict:
    """Poll emails for all users with Gmail connected."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(User.id)
            .join(GmailToken)
            .where(User.is_active == True)  # noqa: E712
        )
        user_ids = [str(uid) for (uid,) in result.all()]

    results = {}
    for user_id in user_ids:
        results[user_id] = await poll_emails_for_user(ctx, user_id)

    return {"users_processed": len(user_ids), "results": results}


async def send_approved_draft(ctx: dict, draft_id: str) -> dict:
    """Send an approved draft email."""
    async with async_session_maker() as db:
        # Get draft with related data
        result = await db.execute(
            select(Draft)
            .options(selectinload(Draft.email), selectinload(Draft.user))
            .where(Draft.id == UUID(draft_id))
        )
        draft = result.scalar_one_or_none()

        if not draft:
            return {"status": "error", "reason": "draft_not_found"}

        if draft.status != "approved":
            return {"status": "error", "reason": f"invalid_status_{draft.status}"}

        # Get user's Gmail token
        token_result = await db.execute(
            select(GmailToken).where(GmailToken.user_id == draft.user_id)
        )
        token = token_result.scalar_one_or_none()

        if not token:
            return {"status": "error", "reason": "no_gmail_token"}

        try:
            # Create Gmail service and send
            gmail_service = GmailService.from_encrypted_tokens(
                token.access_token_encrypted,
                token.refresh_token_encrypted,
            )

            gmail_service.send_message(
                to=draft.to_emails,
                subject=draft.subject,
                body=draft.body_text,
                reply_to_message_id=draft.email.gmail_id if draft.email else None,
                thread_id=draft.email.thread_id if draft.email else None,
            )

            # Update draft status
            from datetime import datetime, timezone

            draft.status = "sent"
            draft.sent_at = datetime.now(timezone.utc)
            await db.commit()

            return {"status": "success", "draft_id": draft_id}

        except Exception as e:
            logger.exception(f"Error sending draft {draft_id}: {e}")
            await db.rollback()
            return {"status": "error", "reason": str(e)}


async def refresh_gmail_tokens(ctx: dict) -> dict:
    """Refresh expiring Gmail tokens."""
    from datetime import datetime, timedelta, timezone

    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    from app.config import get_settings
    from app.core.encryption import decrypt_token, encrypt_token

    settings = get_settings()
    expiry_threshold = datetime.now(timezone.utc) + timedelta(hours=1)

    async with async_session_maker() as db:
        result = await db.execute(
            select(GmailToken).where(GmailToken.token_expiry < expiry_threshold)
        )
        tokens = result.scalars().all()

        refreshed = 0
        for token in tokens:
            try:
                credentials = Credentials(
                    token=decrypt_token(token.access_token_encrypted),
                    refresh_token=decrypt_token(token.refresh_token_encrypted),
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=settings.gmail_client_id,
                    client_secret=settings.gmail_client_secret,
                )

                # Force refresh with proper Request object
                credentials.refresh(Request())

                # Update token
                token.access_token_encrypted = encrypt_token(credentials.token)
                if credentials.expiry:
                    token.token_expiry = credentials.expiry

                refreshed += 1

            except Exception as e:
                logger.error(f"Failed to refresh token {token.id}: {e}")

        await db.commit()
        return {"refreshed": refreshed, "total": len(tokens)}
