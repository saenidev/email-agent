"""OpenRouter LLM service for generating email responses."""

import logging
import re
from dataclasses import dataclass

from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


@dataclass
class EmailContext:
    """Context for generating an email response."""

    original_email: str
    sender_name: str
    sender_email: str
    subject: str
    thread_history: list[str] | None = None
    user_signature: str | None = None
    custom_instructions: str | None = None


@dataclass
class DraftResponse:
    """AI-generated email response."""

    body: str
    reasoning: str
    confidence: float
    suggested_subject: str | None = None


class OpenRouterService:
    """Service for interacting with OpenRouter LLM API."""

    def __init__(
        self,
        api_key: str | None = None,
        default_model: str | None = None,
    ):
        self.client = AsyncOpenAI(
            api_key=api_key or settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )
        self.default_model = default_model or settings.openrouter_default_model

    async def generate_email_response(
        self,
        context: EmailContext,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> DraftResponse:
        """Generate an email response using the LLM."""
        system_prompt = self._build_system_prompt(context)
        user_prompt = self._build_user_prompt(context)

        used_model = model or self.default_model
        response = await self.client.chat.completions.create(
            model=used_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content or "" if response.choices else ""
        logger.debug(
            "LLM response from %s: length=%d, preview=%s",
            used_model,
            len(content),
            content[:200] if content else "(empty)",
        )
        return self._parse_response(content)

    async def should_respond(self, email_body: str, subject: str) -> tuple[bool, str]:
        """Determine if an email requires a response."""
        prompt = f"""Analyze this email and determine if it requires a response.

Subject: {subject}
Body: {email_body[:1000]}

Respond with:
1. REQUIRES_RESPONSE: yes or no
2. REASON: Brief explanation

Examples of emails that DON'T require response:
- Newsletters and marketing emails
- Automated notifications (shipping, receipts)
- No-reply sender addresses
- Calendar invitations (handled separately)
- Email threads where you're CC'd but not directly addressed

Examples that DO require response:
- Direct questions to you
- Meeting requests with specific asks
- Action items assigned to you
- Requests for information or help"""

        response = await self.client.chat.completions.create(
            model=self.default_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200,
        )

        content = response.choices[0].message.content or "" if response.choices else ""

        requires_response = False
        reason = "Unable to determine"
        for line in content.splitlines():
            line_stripped = line.strip()
            if line_stripped.lower().startswith("requires_response:"):
                value = line_stripped.split(":", 1)[1].strip().lower()
                requires_response = value.startswith("y")
            elif line_stripped.lower().startswith("reason:"):
                parsed_reason = line_stripped.split(":", 1)[1].strip()
                if parsed_reason:
                    reason = parsed_reason

        if not requires_response and "requires_response: yes" in content.lower():
            requires_response = True
        if reason == "Unable to determine":
            lower_content = content.lower()
            if "reason:" in lower_content:
                reason = content[lower_content.index("reason:") + len("reason:") :].strip()

        return requires_response, reason

    async def classify_email(
        self,
        email_body: str,
        subject: str,
        categories: list[str],
    ) -> tuple[str, float]:
        """Classify an email into one of the provided categories."""
        if not categories:
            return "", 0.0
        categories_str = ", ".join(categories)
        prompt = f"""Classify this email into one of these categories: {categories_str}

Subject: {subject}
Body: {email_body[:500]}

Respond with:
CATEGORY: [one of the categories]
CONFIDENCE: [0.0 to 1.0]"""

        response = await self.client.chat.completions.create(
            model=self.default_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=100,
        )

        content = response.choices[0].message.content or "" if response.choices else ""

        # Parse response
        category = categories[0]  # Default
        confidence = 0.5

        for line in content.split("\n"):
            if line.startswith("CATEGORY:"):
                cat = line.split(":")[1].strip()
                if cat in categories:
                    category = cat
            elif line.startswith("CONFIDENCE:"):
                try:
                    confidence = float(line.split(":")[1].strip())
                except ValueError:
                    pass

        return category, confidence

    def _build_system_prompt(self, context: EmailContext) -> str:
        """Build the system prompt for email response generation."""
        prompt = """You are an AI email assistant helping to draft professional email responses.

Guidelines:
- Be professional, clear, and concise
- Match the tone of the original email (formal vs casual)
- Address all questions or points raised
- Keep responses focused and to the point
- Don't add unnecessary pleasantries or filler"""

        if context.custom_instructions:
            prompt += f"\n\nAdditional instructions: {context.custom_instructions}"

        return prompt

    def _build_user_prompt(self, context: EmailContext) -> str:
        """Build the user prompt with email context."""
        prompt = f"""Please draft a response to this email:

From: {context.sender_name} <{context.sender_email}>
Subject: {context.subject}

---
{context.original_email}
---

Provide your response in this format:
RESPONSE:
[Your email response here]

REASONING:
[Brief explanation of your approach]

CONFIDENCE: [0.0 to 1.0]"""

        if context.user_signature:
            prompt += f"\n\nPlease end the email with this signature:\n{context.user_signature}"
        else:
            # When no signature is configured, instruct LLM to use a simple closing
            prompt += "\n\nNo signature is configured. End the email with just 'Best,' on its own line (no name placeholder)."

        return prompt

    def _parse_response(self, content: str) -> DraftResponse:
        """Parse the LLM response into a DraftResponse."""
        body = ""
        reasoning = ""
        confidence = 0.7

        # Handle reasoning models (DeepSeek R1, etc.) that wrap thinking in <think> tags
        # Strip the thinking block but preserve the actual response
        think_match = re.search(r"<think>(.*?)</think>", content, re.DOTALL)
        if think_match:
            # Extract reasoning from think block
            reasoning = think_match.group(1).strip()[:500]  # Limit reasoning length
            # Remove think block from content for parsing
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

        # Extract response body
        if "RESPONSE:" in content:
            parts = content.split("RESPONSE:")
            if len(parts) > 1:
                response_part = parts[1]
                if "REASONING:" in response_part:
                    body = response_part.split("REASONING:")[0].strip()
                else:
                    body = response_part.strip()

        # Extract reasoning
        if "REASONING:" in content:
            parts = content.split("REASONING:")
            if len(parts) > 1:
                reasoning_part = parts[1]
                if "CONFIDENCE:" in reasoning_part:
                    reasoning = reasoning_part.split("CONFIDENCE:")[0].strip()
                else:
                    reasoning = reasoning_part.strip()

        # Extract confidence
        if "CONFIDENCE:" in content:
            try:
                conf_str = content.split("CONFIDENCE:")[1].strip().split()[0]
                confidence = float(conf_str)
            except (ValueError, IndexError):
                pass

        # Fallback if parsing failed
        if not body:
            body = content

        # Log warning if body is still empty (helps debug model issues)
        if not body.strip():
            logger.warning(
                "Empty response body after parsing. Original content length: %d, "
                "had think block: %s",
                len(content) if content else 0,
                "RESPONSE:" in (content or ""),
            )

        return DraftResponse(
            body=body,
            reasoning=reasoning,
            confidence=min(max(confidence, 0.0), 1.0),
        )
