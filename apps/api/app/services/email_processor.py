"""Email processor - main orchestration logic for the email agent."""

import logging
from datetime import UTC
from enum import Enum
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.draft import Draft
from app.models.email import Email
from app.models.user import User
from app.models.user_settings import UserSettings
from app.services.activity_service import log_activity
from app.services.gmail_service import EmailMessage, GmailService
from app.services.openrouter_service import EmailContext, OpenRouterService
from app.services.rule_engine import Rule, RuleAction, RuleEngine

logger = logging.getLogger(__name__)


class ProcessingResult(str, Enum):
    """Result of processing an email."""

    DRAFT_CREATED = "draft_created"
    AUTO_SENT = "auto_sent"
    FORWARDED = "forwarded"
    IGNORED = "ignored"
    NO_RESPONSE_NEEDED = "no_response_needed"
    ERROR = "error"


class EmailProcessor:
    """Main email processing pipeline."""

    def __init__(
        self,
        db: AsyncSession,
        gmail_service: GmailService,
        openrouter_service: OpenRouterService,
        rule_engine: RuleEngine,
        user_id: UUID,
    ):
        self.db = db
        self.gmail = gmail_service
        self.llm = openrouter_service
        self.rules = rule_engine
        self.user_id = user_id

    async def process_email(
        self,
        email: EmailMessage,
        settings: UserSettings,
    ) -> ProcessingResult:
        """Process a single email through the agent pipeline."""
        try:
            # Step 1: Check if email needs response
            needs_response, reason = await self.llm.should_respond(email.body_text, email.subject)

            if not needs_response:
                logger.info(f"Email {email.gmail_id} doesn't need response: {reason}")
                await self._update_email_status(
                    email.gmail_id,
                    is_processed=True,
                    requires_response=False,
                )
                return ProcessingResult.NO_RESPONSE_NEEDED

            # Step 2: Check automation rules
            matched_rule = self.rules.evaluate(email)

            if matched_rule and matched_rule.action == RuleAction.IGNORE:
                logger.info(f"Email {email.gmail_id} ignored by rule: {matched_rule.name}")
                await self._update_email_status(
                    email.gmail_id,
                    is_processed=True,
                    requires_response=False,
                )
                return ProcessingResult.IGNORED

            if matched_rule and matched_rule.action == RuleAction.FORWARD:
                forward_targets = self._get_forward_targets(matched_rule)
                if not forward_targets:
                    logger.error(
                        "Forward rule %s missing forward targets for email %s",
                        matched_rule.name,
                        email.gmail_id,
                    )
                    await self._update_email_status(
                        email.gmail_id,
                        is_processed=True,
                        requires_response=False,
                    )
                    return ProcessingResult.ERROR

                forward_body = self._format_forward_body(email)
                await self.gmail.send_message_async(
                    to=forward_targets,
                    subject=f"Fwd: {email.subject}",
                    body=forward_body,
                )
                await self._update_email_status(
                    email.gmail_id,
                    is_processed=True,
                    requires_response=False,
                )
                logger.info(
                    "Forwarded email %s to %s",
                    email.gmail_id,
                    ", ".join(forward_targets),
                )
                return ProcessingResult.FORWARDED

            # Step 3: Generate AI response
            context = EmailContext(
                original_email=email.body_text,
                sender_name=email.from_name or email.from_email,
                sender_email=email.from_email,
                subject=email.subject,
                user_signature=settings.signature,
                custom_instructions=self._get_custom_instructions(matched_rule, settings),
            )

            draft_response = await self.llm.generate_email_response(
                context,
                model=settings.llm_model,
                temperature=float(settings.llm_temperature),
            )

            # Step 4: Determine action based on settings and rules
            should_auto_send = self._should_auto_send(
                settings.approval_mode,
                matched_rule,
            )

            if should_auto_send:
                # Auto-send the response
                await self.gmail.send_message_async(
                    to=[email.from_email],
                    subject=f"Re: {email.subject}",
                    body=draft_response.body,
                    reply_to_message_id=email.message_id,
                    thread_id=email.thread_id,
                )

                # Create draft record with auto_sent status
                await self._create_draft(
                    email=email,
                    body=draft_response.body,
                    reasoning=draft_response.reasoning,
                    model=settings.llm_model,
                    matched_rule=matched_rule,
                    status="auto_sent",
                )

                await self._update_email_status(
                    email.gmail_id,
                    is_processed=True,
                    requires_response=True,
                )
                logger.info(f"Auto-sent response to {email.from_email}")
                return ProcessingResult.AUTO_SENT

            else:
                # Create draft for approval
                await self._create_draft(
                    email=email,
                    body=draft_response.body,
                    reasoning=draft_response.reasoning,
                    model=settings.llm_model,
                    matched_rule=matched_rule,
                    status="pending",
                )

                await self._update_email_status(
                    email.gmail_id,
                    is_processed=True,
                    requires_response=True,
                )
                logger.info(f"Created draft for email from {email.from_email}")
                return ProcessingResult.DRAFT_CREATED

        except Exception as e:
            logger.exception("Error processing email %s: %s", email.gmail_id, e)
            await self._update_email_status(email.gmail_id, is_processed=False)
            return ProcessingResult.ERROR

    def _should_auto_send(
        self,
        approval_mode: str,
        matched_rule: Rule | None,
    ) -> bool:
        """Determine if email should be auto-sent based on settings and rules."""
        if matched_rule and matched_rule.action in {RuleAction.DRAFT_ONLY, RuleAction.FORWARD}:
            return False

        if approval_mode == "fully_automatic":
            return True

        if approval_mode == "auto_with_rules":
            if matched_rule and matched_rule.action == RuleAction.AUTO_RESPOND:
                return True
            return False

        # draft_approval mode - always require approval
        return False

    def _get_forward_targets(self, matched_rule: Rule) -> list[str]:
        """Extract forward targets from rule config."""
        if not matched_rule.action_config:
            return []
        targets = matched_rule.action_config.get("forward_to")
        if isinstance(targets, str):
            return [targets]
        if isinstance(targets, list):
            return [t for t in targets if isinstance(t, str) and t.strip()]
        return []

    def _format_forward_body(self, email: EmailMessage) -> str:
        """Create a simple forwarded message body."""
        header_lines = [
            "Forwarded message:",
            f"From: {email.from_name or ''} <{email.from_email}>",
            f"To: {', '.join(email.to_emails)}",
            f"Subject: {email.subject}",
            f"Date: {email.received_at.isoformat()}",
            "",
        ]
        return "\n".join(header_lines) + (email.body_text or "")

    def _get_custom_instructions(
        self,
        matched_rule: Rule | None,
        settings: UserSettings,
    ) -> str | None:
        """Get custom instructions from rule or settings."""
        if matched_rule and matched_rule.action_config:
            custom_prompt = matched_rule.action_config.get("custom_prompt")
            if custom_prompt:
                return custom_prompt

        return settings.system_prompt

    async def _update_email_status(
        self,
        gmail_id: str,
        is_processed: bool = False,
        requires_response: bool | None = None,
    ) -> None:
        """Update email status in database."""
        from datetime import datetime

        result = await self.db.execute(
            select(Email).where(
                Email.user_id == self.user_id,
                Email.gmail_id == gmail_id,
            )
        )
        email = result.scalar_one_or_none()

        if email:
            email.is_processed = is_processed
            if requires_response is not None:
                email.requires_response = requires_response
            email.processed_at = datetime.now(UTC)
            await self.db.flush()

    async def _create_draft(
        self,
        email: EmailMessage,
        body: str,
        reasoning: str,
        model: str,
        matched_rule: Rule | None,
        status: str,
    ) -> Draft:
        """Create a draft in the database."""
        # First get the email record
        result = await self.db.execute(
            select(Email).where(
                Email.user_id == self.user_id,
                Email.gmail_id == email.gmail_id,
            )
        )
        email_record = result.scalar_one_or_none()

        if not email_record:
            raise ValueError(f"Email {email.gmail_id} not found in database")

        existing = await self.db.execute(
            select(Draft).where(
                Draft.email_id == email_record.id,
                Draft.status.in_(["pending", "approved", "sent", "auto_sent"]),
            )
        )
        existing_draft = existing.scalar_one_or_none()
        if existing_draft:
            return existing_draft

        from datetime import datetime

        sent_at = datetime.now(UTC) if status == "auto_sent" else None
        draft = Draft(
            user_id=self.user_id,
            email_id=email_record.id,
            to_emails=[email.from_email],
            subject=f"Re: {email.subject}",
            body_text=body,
            status=status,
            llm_model_used=model,
            llm_reasoning=reasoning,
            matched_rule_id=UUID(matched_rule.id) if matched_rule else None,
            sent_at=sent_at,
        )

        self.db.add(draft)
        await self.db.flush()
        await self.db.refresh(draft)

        # Log activity
        activity_type = "email_sent" if status == "auto_sent" else "draft_created"
        description = (
            f"Auto-sent response to {email.from_email}"
            if status == "auto_sent"
            else f"AI drafted response for email from {email.from_email}"
        )
        await log_activity(
            self.db,
            user_id=self.user_id,
            activity_type=activity_type,
            description=description,
            email_id=email_record.id,
            draft_id=draft.id,
            rule_id=UUID(matched_rule.id) if matched_rule else None,
        )

        return draft


async def get_user_settings(db: AsyncSession, user_id: UUID) -> UserSettings | None:
    """Get user settings from database."""
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    return result.scalar_one_or_none()


async def create_email_processor(
    db: AsyncSession,
    user: User,
) -> EmailProcessor | None:
    """Factory function to create an EmailProcessor for a user."""
    # Get Gmail token
    if not user.gmail_token:
        logger.warning(f"User {user.id} has no Gmail token")
        return None

    # Create Gmail service
    gmail_service = GmailService.from_encrypted_tokens(
        user.gmail_token.access_token_encrypted,
        user.gmail_token.refresh_token_encrypted,
    )

    # Create OpenRouter service
    openrouter_service = OpenRouterService()

    # Create rule engine
    rule_engine = RuleEngine.from_db_rules(user.rules)

    return EmailProcessor(
        db=db,
        gmail_service=gmail_service,
        openrouter_service=openrouter_service,
        rule_engine=rule_engine,
        user_id=user.id,
    )
