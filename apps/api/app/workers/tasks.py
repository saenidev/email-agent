"""ARQ background task definitions."""

import logging
from uuid import UUID

from sqlalchemy import case, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import async_session_maker
from app.models.batch_draft_job import BatchDraftJob
from app.models.draft import Draft
from app.models.email import Email
from app.models.gmail_token import GmailToken
from app.models.user import User
from app.services.activity_service import log_activity
from app.services.email_processor import create_email_processor, get_user_settings
from app.services.gmail_service import GmailService
from app.services.openrouter_service import EmailContext, OpenRouterService

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
                messages, new_history_id = await gmail_service.get_history_async(
                    user.gmail_token.history_id
                )
                if new_history_id:
                    user.gmail_token.history_id = new_history_id
                    await db.flush()
                else:
                    # History invalid/expired, fall back to full sync
                    messages = await gmail_service.list_messages_async(
                        query="is:inbox is:unread",
                        max_results=20,
                    )
            else:
                # Full sync - get recent unread messages
                messages = await gmail_service.list_messages_async(
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
                email_msg = await gmail_service.get_message_async(msg_ref["id"])

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

            reply_message_id = None
            thread_id = draft.email.thread_id if draft.email else None
            if draft.email:
                try:
                    original_message = await gmail_service.get_message_async(
                        draft.email.gmail_id
                    )
                    reply_message_id = original_message.message_id
                    thread_id = original_message.thread_id or thread_id
                except Exception as e:
                    logger.warning(
                        "Failed to fetch message-id for draft %s: %s",
                        draft_id,
                        e,
                    )

            await gmail_service.send_message_async(
                to=draft.to_emails,
                subject=draft.subject,
                body=draft.body_text,
                reply_to_message_id=reply_message_id,
                thread_id=thread_id,
            )

            # Update draft status
            from datetime import datetime, timezone

            draft.status = "sent"
            draft.sent_at = datetime.now(timezone.utc)

            # Log activity
            await log_activity(
                db,
                user_id=draft.user_id,
                activity_type="email_sent",
                description=f"Sent email to {', '.join(draft.to_emails)}",
                email_id=draft.email_id,
                draft_id=draft.id,
            )

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


async def generate_draft_for_email(
    ctx: dict, email_id: str, batch_job_id: str | None = None
) -> dict:
    """Generate a draft for a specific email on-demand.

    This task is used for manual draft generation when user selects
    emails and requests immediate drafting. It skips the "needs response"
    check since the user explicitly wants a draft.
    """
    async with async_session_maker() as db:
        try:
            # Get email with user relationship
            result = await db.execute(
                select(Email)
                .options(selectinload(Email.user).selectinload(User.settings))
                .where(Email.id == UUID(email_id))
            )
            email = result.scalar_one_or_none()

            if not email:
                await _update_batch_job_failed(db, batch_job_id)
                return {"status": "error", "reason": "email_not_found"}

            # Check if draft already exists (prevent duplicates)
            existing_result = await db.execute(
                select(Draft).where(
                    Draft.email_id == email.id,
                    Draft.status.in_(["pending", "approved", "sent", "auto_sent"]),
                )
            )
            if existing_result.scalar_one_or_none():
                await _update_batch_job_completed(db, batch_job_id)
                return {"status": "skipped", "reason": "draft_exists"}

            # Get user settings
            settings = email.user.settings
            if not settings:
                await _update_batch_job_failed(db, batch_job_id)
                return {"status": "error", "reason": "no_settings"}

            # Build EmailContext and generate response
            llm = OpenRouterService()
            context = EmailContext(
                original_email=email.body_text or "",
                sender_name=email.from_name or email.from_email or "",
                sender_email=email.from_email or "",
                subject=email.subject or "",
                user_signature=settings.signature,
                custom_instructions=settings.system_prompt,
            )

            response = await llm.generate_email_response(
                context,
                model=settings.llm_model,
                temperature=float(settings.llm_temperature),
            )

            # Create draft record
            draft = Draft(
                user_id=email.user_id,
                email_id=email.id,
                to_emails=[email.from_email] if email.from_email else [],
                subject=f"Re: {email.subject or ''}",
                body_text=response.body,
                status="pending",
                llm_model_used=settings.llm_model,
                llm_reasoning=response.reasoning,
            )
            db.add(draft)
            await db.flush()

            # Log activity
            await log_activity(
                db,
                user_id=email.user_id,
                activity_type="draft_created",
                description=f"AI drafted response for email from {email.from_email}",
                email_id=email.id,
                draft_id=draft.id,
            )

            # Update batch job progress
            await _update_batch_job_completed(db, batch_job_id)

            await db.commit()
            logger.info(
                "Generated draft %s for email %s", draft.id, email_id
            )
            return {"status": "success", "draft_id": str(draft.id)}

        except Exception as e:
            logger.exception("Error generating draft for email %s: %s", email_id, e)
            await db.rollback()

            # Try to update batch job as failed
            try:
                async with async_session_maker() as db2:
                    await _update_batch_job_failed(db2, batch_job_id)
                    await db2.commit()
            except Exception:
                pass

            return {"status": "error", "reason": str(e)}


async def _update_batch_job_completed(db: AsyncSession, batch_job_id: str | None) -> None:
    """Increment completed count and check if job is done."""
    if not batch_job_id:
        return

    completed_expr = BatchDraftJob.completed_emails + 1
    status_expr = case(
        (
            completed_expr + BatchDraftJob.failed_emails >= BatchDraftJob.total_emails,
            "completed",
        ),
        else_=BatchDraftJob.status,
    )
    await db.execute(
        update(BatchDraftJob)
        .where(BatchDraftJob.id == UUID(batch_job_id))
        .values(
            completed_emails=completed_expr,
            status=status_expr,
        )
    )
    await db.flush()


async def _update_batch_job_failed(db: AsyncSession, batch_job_id: str | None) -> None:
    """Increment failed count and check if job is done."""
    if not batch_job_id:
        return

    failed_expr = BatchDraftJob.failed_emails + 1
    status_expr = case(
        (
            BatchDraftJob.completed_emails + failed_expr >= BatchDraftJob.total_emails,
            "completed",
        ),
        else_=BatchDraftJob.status,
    )
    await db.execute(
        update(BatchDraftJob)
        .where(BatchDraftJob.id == UUID(batch_job_id))
        .values(
            failed_emails=failed_expr,
            status=status_expr,
        )
    )
    await db.flush()
