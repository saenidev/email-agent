"""Gmail API service for reading and sending emails."""

import base64
import binascii
import functools
import html
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import getaddresses, parseaddr
from email.mime.text import MIMEText
from typing import Any

import anyio
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import get_settings
from app.core.encryption import decrypt_token

settings = get_settings()


@dataclass
class EmailMessage:
    """Parsed email message."""

    gmail_id: str
    message_id: str | None
    thread_id: str
    from_email: str
    from_name: str | None
    to_emails: list[str]
    cc_emails: list[str]
    subject: str
    snippet: str
    body_text: str
    body_html: str | None
    received_at: datetime


class GmailService:
    """Service for interacting with Gmail API."""

    def __init__(self, access_token: str, refresh_token: str):
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.gmail_client_id,
            client_secret=settings.gmail_client_secret,
        )
        self.service = build("gmail", "v1", credentials=credentials)

    @classmethod
    def from_encrypted_tokens(
        cls, access_token_encrypted: str, refresh_token_encrypted: str
    ) -> "GmailService":
        """Create service from encrypted tokens."""
        access_token = decrypt_token(access_token_encrypted)
        refresh_token = decrypt_token(refresh_token_encrypted)
        return cls(access_token, refresh_token)

    def list_messages(
        self,
        query: str = "is:inbox is:unread",
        max_results: int = 50,
    ) -> list[dict[str, str]]:
        """List message IDs matching query."""
        results = (
            self.service.users()
            .messages()
            .list(userId="me", q=query, maxResults=max_results)
            .execute()
        )
        return results.get("messages", [])

    async def _run_async(self, func, *args, **kwargs):
        return await anyio.to_thread.run_sync(
            functools.partial(func, *args, **kwargs)
        )

    async def list_messages_async(
        self,
        query: str = "is:inbox is:unread",
        max_results: int = 50,
    ) -> list[dict[str, str]]:
        """Async wrapper for list_messages."""
        return await self._run_async(self.list_messages, query, max_results)

    def get_message(self, message_id: str) -> EmailMessage:
        """Fetch and parse a full message by ID."""
        msg = (
            self.service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )
        return self._parse_message(msg)

    async def get_message_async(self, message_id: str) -> EmailMessage:
        """Async wrapper for get_message."""
        return await self._run_async(self.get_message, message_id)

    def get_history(
        self, start_history_id: int
    ) -> tuple[list[dict[str, str]], int | None]:
        """Get messages since history_id for incremental sync."""
        try:
            message_ids: list[dict[str, str]] = []
            new_history_id: str | None = None
            page_token: str | None = None

            while True:
                results = (
                    self.service.users()
                    .history()
                    .list(
                        userId="me",
                        startHistoryId=start_history_id,
                        historyTypes=["messageAdded"],
                        pageToken=page_token,
                    )
                    .execute()
                )
                history = results.get("history", [])
                new_history_id = results.get("historyId") or new_history_id

                for record in history:
                    for msg in record.get("messagesAdded", []):
                        message_ids.append({"id": msg["message"]["id"]})

                page_token = results.get("nextPageToken")
                if not page_token:
                    break

            return message_ids, int(new_history_id) if new_history_id else None
        except Exception:
            # History ID invalid or expired, need full sync
            return [], None

    async def get_history_async(
        self, start_history_id: int
    ) -> tuple[list[dict[str, str]], int | None]:
        """Async wrapper for get_history."""
        return await self._run_async(self.get_history, start_history_id)

    def send_message(
        self,
        to: list[str],
        subject: str,
        body: str,
        reply_to_message_id: str | None = None,
        thread_id: str | None = None,
    ) -> str:
        """Send an email message."""
        message = MIMEText(body, "plain", "utf-8")
        message["to"] = ", ".join(to)
        message["subject"] = subject

        if reply_to_message_id:
            message["In-Reply-To"] = reply_to_message_id
            message["References"] = reply_to_message_id

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        body_dict: dict[str, Any] = {"raw": raw}
        if thread_id:
            body_dict["threadId"] = thread_id

        result = (
            self.service.users().messages().send(userId="me", body=body_dict).execute()
        )
        return result["id"]

    async def send_message_async(
        self,
        to: list[str],
        subject: str,
        body: str,
        reply_to_message_id: str | None = None,
        thread_id: str | None = None,
    ) -> str:
        """Async wrapper for send_message."""
        return await self._run_async(
            self.send_message,
            to,
            subject,
            body,
            reply_to_message_id,
            thread_id,
        )

    def get_profile(self) -> dict[str, str | None]:
        """Get the authenticated user's email address and history id."""
        profile = self.service.users().getProfile(userId="me").execute()
        return {
            "email": profile.get("emailAddress"),
            "history_id": profile.get("historyId"),
        }

    async def get_profile_async(self) -> dict[str, str | None]:
        """Async wrapper for get_profile."""
        return await self._run_async(self.get_profile)

    def _parse_message(self, msg: dict) -> EmailMessage:
        """Parse Gmail API message into EmailMessage dataclass."""
        headers = {h["name"].lower(): h["value"] for h in msg["payload"]["headers"]}

        # Parse from field
        from_raw = headers.get("from", "")
        parsed_name, parsed_email = parseaddr(from_raw)
        from_name = parsed_name or None
        from_email = parsed_email or from_raw.strip()

        # Parse to field
        to_raw = headers.get("to", "")
        to_emails = [addr for _, addr in getaddresses([to_raw]) if addr]

        # Parse cc field
        cc_raw = headers.get("cc", "")
        cc_emails = [addr for _, addr in getaddresses([cc_raw]) if addr]

        # Get body
        body_text, body_html = self._get_body(msg["payload"])

        # Parse date
        internal_date = int(msg.get("internalDate", 0))
        received_at = datetime.fromtimestamp(internal_date / 1000, tz=timezone.utc)

        return EmailMessage(
            gmail_id=msg["id"],
            message_id=headers.get("message-id"),
            thread_id=msg.get("threadId", ""),
            from_email=from_email,
            from_name=from_name,
            to_emails=to_emails,
            cc_emails=cc_emails,
            subject=headers.get("subject", ""),
            snippet=msg.get("snippet", ""),
            body_text=body_text,
            body_html=body_html,
            received_at=received_at,
        )

    @staticmethod
    def _decode_base64url(data: str) -> str:
        """Decode Gmail's base64url payloads, handling missing padding."""
        if not data:
            return ""
        padded = data + "=" * (-len(data) % 4)
        try:
            return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
        except (binascii.Error, ValueError):
            return ""

    def _get_body(self, payload: dict) -> tuple[str, str | None]:
        """Extract text and HTML body from message payload."""
        text_body = ""
        html_body = None

        if "parts" in payload:
            for part in payload["parts"]:
                mime_type = part.get("mimeType", "")
                if mime_type == "text/plain":
                    data = part.get("body", {}).get("data", "")
                    text_body = self._decode_base64url(data)
                elif mime_type == "text/html":
                    data = part.get("body", {}).get("data", "")
                    html_body = self._decode_base64url(data)
                elif "parts" in part:
                    # Nested multipart
                    nested_text, nested_html = self._get_body(part)
                    if nested_text:
                        text_body = nested_text
                    if nested_html:
                        html_body = nested_html
        else:
            # Single part message
            data = payload.get("body", {}).get("data", "")
            if data:
                text_body = self._decode_base64url(data)

        if not text_body and html_body:
            text_body = self._strip_html(html_body)

        return text_body, html_body

    @staticmethod
    def _strip_html(html_body: str) -> str:
        """Best-effort HTML to text fallback."""
        if not html_body:
            return ""
        text = re.sub(r"(?i)<br\s*/?>", "\n", html_body)
        text = re.sub(r"(?i)</p>", "\n", text)
        text = re.sub(r"<[^>]+>", "", text)
        text = html.unescape(text)
        return text.strip()
