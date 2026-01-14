"""Guardrails service for content validation before sending emails."""

import re
from dataclasses import dataclass, field
from enum import Enum


class ViolationType(str, Enum):
    """Types of guardrail violations."""

    PROFANITY = "profanity"
    PII_CREDIT_CARD = "pii_credit_card"
    PII_SSN = "pii_ssn"
    PII_PASSWORD = "pii_password"
    COMMITMENT_WORD = "commitment_word"
    CUSTOM_KEYWORD = "custom_keyword"
    LOW_CONFIDENCE = "low_confidence"


@dataclass
class GuardrailViolation:
    """A single guardrail violation."""

    violation_type: ViolationType
    matched_text: str
    description: str


@dataclass
class ValidationResult:
    """Result of guardrail validation."""

    passed: bool
    violations: list[GuardrailViolation] = field(default_factory=list)
    should_downgrade_to_draft: bool = False

    @property
    def violation_summary(self) -> str:
        """Get a human-readable summary of violations."""
        if not self.violations:
            return ""
        return "; ".join(v.description for v in self.violations)


@dataclass
class GuardrailConfig:
    """Configuration for guardrail checks."""

    # Feature toggles
    profanity_filter_enabled: bool = True
    pii_filter_enabled: bool = True
    commitment_filter_enabled: bool = True
    custom_keywords_enabled: bool = True

    # Confidence threshold (0.0-1.0)
    confidence_threshold: float = 0.7

    # Custom blocklist (user-defined keywords)
    custom_blocked_keywords: list[str] = field(default_factory=list)


# Common profanity patterns (intentionally kept minimal/censored)
# In production, use a proper profanity library
PROFANITY_PATTERNS = [
    r"\b(damn|shit|fuck|ass|bitch|bastard|crap|hell)\b",
    r"\b(wtf|stfu|lmao|lmfao)\b",
]

# PII detection patterns
CREDIT_CARD_PATTERN = r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b"
SSN_PATTERN = r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"
PASSWORD_PATTERNS = [
    r"(?i)password\s*[:=]\s*\S+",
    r"(?i)pwd\s*[:=]\s*\S+",
    r"(?i)secret\s*[:=]\s*\S+",
    r"(?i)api[_-]?key\s*[:=]\s*\S+",
    r"(?i)access[_-]?token\s*[:=]\s*\S+",
]

# Commitment words that might bind the user legally or financially
COMMITMENT_PATTERNS = [
    r"(?i)\b(i agree|i accept|i confirm|i approve)\b",
    r"(?i)\b(confirmed|approved|accepted|agreed)\b",
    r"(?i)\b(i('ll| will) pay|i('ll| will) send (the )?money)\b",
    r"(?i)\b(you have my (word|permission|approval))\b",
    r"(?i)\b(deal|it's a deal|we have a deal)\b",
    r"(?i)\b(i commit|i promise|i guarantee)\b",
    r"(?i)\b(binding|legally binding|contractually)\b",
]


class GuardrailsService:
    """Service for validating email content against guardrails."""

    def __init__(self, config: GuardrailConfig | None = None):
        self.config = config or GuardrailConfig()
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Pre-compile regex patterns for performance."""
        self._profanity_re = [
            re.compile(p, re.IGNORECASE) for p in PROFANITY_PATTERNS
        ]
        self._credit_card_re = re.compile(CREDIT_CARD_PATTERN)
        self._ssn_re = re.compile(SSN_PATTERN)
        self._password_re = [re.compile(p) for p in PASSWORD_PATTERNS]
        self._commitment_re = [re.compile(p) for p in COMMITMENT_PATTERNS]
        self._custom_re: list[re.Pattern[str]] = []
        if self.config.custom_blocked_keywords:
            # Escape special regex chars and create word-boundary patterns
            patterns = [
                re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE)
                for kw in self.config.custom_blocked_keywords
                if kw.strip()
            ]
            self._custom_re = patterns

    def update_config(self, config: GuardrailConfig) -> None:
        """Update configuration and recompile patterns."""
        self.config = config
        self._compile_patterns()

    def validate(self, content: str, confidence: float = 1.0) -> ValidationResult:
        """
        Validate content against all enabled guardrails.

        Args:
            content: The email body text to validate
            confidence: The LLM confidence score (0.0-1.0)

        Returns:
            ValidationResult with pass/fail status and any violations
        """
        violations: list[GuardrailViolation] = []

        # Check confidence threshold
        if confidence < self.config.confidence_threshold:
            violations.append(
                GuardrailViolation(
                    violation_type=ViolationType.LOW_CONFIDENCE,
                    matched_text=f"confidence={confidence:.2f}",
                    description=f"Low confidence ({confidence:.2f}) below threshold ({self.config.confidence_threshold})",
                )
            )

        # Check profanity
        if self.config.profanity_filter_enabled:
            violations.extend(self._check_profanity(content))

        # Check PII
        if self.config.pii_filter_enabled:
            violations.extend(self._check_pii(content))

        # Check commitment words
        if self.config.commitment_filter_enabled:
            violations.extend(self._check_commitments(content))

        # Check custom keywords
        if self.config.custom_keywords_enabled and self._custom_re:
            violations.extend(self._check_custom_keywords(content))

        passed = len(violations) == 0
        return ValidationResult(
            passed=passed,
            violations=violations,
            should_downgrade_to_draft=not passed,
        )

    def _check_profanity(self, content: str) -> list[GuardrailViolation]:
        """Check for profanity in content."""
        violations = []
        for pattern in self._profanity_re:
            matches = pattern.findall(content)
            for match in matches:
                violations.append(
                    GuardrailViolation(
                        violation_type=ViolationType.PROFANITY,
                        matched_text=self._mask_text(match),
                        description=f"Profanity detected: {self._mask_text(match)}",
                    )
                )
        return violations

    def _check_pii(self, content: str) -> list[GuardrailViolation]:
        """Check for personally identifiable information."""
        violations = []

        # Credit card numbers
        cc_matches = self._credit_card_re.findall(content)
        for match in cc_matches:
            violations.append(
                GuardrailViolation(
                    violation_type=ViolationType.PII_CREDIT_CARD,
                    matched_text=self._mask_credit_card(match),
                    description=f"Credit card number detected: {self._mask_credit_card(match)}",
                )
            )

        # SSN
        ssn_matches = self._ssn_re.findall(content)
        for match in ssn_matches:
            # Basic validation: avoid false positives like phone numbers
            if self._looks_like_ssn(match):
                violations.append(
                    GuardrailViolation(
                        violation_type=ViolationType.PII_SSN,
                        matched_text="***-**-" + match[-4:],
                        description="Social Security Number detected",
                    )
                )

        # Passwords/secrets
        for pattern in self._password_re:
            matches = pattern.findall(content)
            for match in matches:
                violations.append(
                    GuardrailViolation(
                        violation_type=ViolationType.PII_PASSWORD,
                        matched_text="[REDACTED]",
                        description="Password or API key detected in content",
                    )
                )

        return violations

    def _check_commitments(self, content: str) -> list[GuardrailViolation]:
        """Check for commitment/agreement words."""
        violations = []
        for pattern in self._commitment_re:
            matches = pattern.findall(content)
            for match in matches:
                violations.append(
                    GuardrailViolation(
                        violation_type=ViolationType.COMMITMENT_WORD,
                        matched_text=match,
                        description=f"Commitment language detected: '{match}'",
                    )
                )
        return violations

    def _check_custom_keywords(self, content: str) -> list[GuardrailViolation]:
        """Check for user-defined blocked keywords."""
        violations = []
        for pattern in self._custom_re:
            matches = pattern.findall(content)
            for match in matches:
                violations.append(
                    GuardrailViolation(
                        violation_type=ViolationType.CUSTOM_KEYWORD,
                        matched_text=match,
                        description=f"Blocked keyword detected: '{match}'",
                    )
                )
        return violations

    def _mask_text(self, text: str) -> str:
        """Mask text for safe logging (show first and last char)."""
        if len(text) <= 2:
            return "*" * len(text)
        return text[0] + "*" * (len(text) - 2) + text[-1]

    def _mask_credit_card(self, number: str) -> str:
        """Mask credit card for logging (show last 4 digits)."""
        digits = re.sub(r"\D", "", number)
        return "****-****-****-" + digits[-4:]

    def _looks_like_ssn(self, text: str) -> bool:
        """
        Basic heuristic to distinguish SSN from other 9-digit patterns.
        Real SSNs don't start with 000, 666, or 9xx (reserved).
        """
        digits = re.sub(r"\D", "", text)
        if len(digits) != 9:
            return False
        # Area number (first 3) can't be 000, 666, or 900-999
        area = int(digits[:3])
        if area == 0 or area == 666 or area >= 900:
            return False
        # Group number (middle 2) can't be 00
        group = int(digits[3:5])
        if group == 0:
            return False
        # Serial number (last 4) can't be 0000
        serial = int(digits[5:])
        if serial == 0:
            return False
        return True


def create_guardrails_service_from_settings(
    profanity_filter_enabled: bool = True,
    pii_filter_enabled: bool = True,
    commitment_filter_enabled: bool = True,
    custom_keywords_enabled: bool = True,
    confidence_threshold: float = 0.7,
    custom_blocked_keywords: list[str] | None = None,
) -> GuardrailsService:
    """Factory function to create a GuardrailsService from user settings."""
    config = GuardrailConfig(
        profanity_filter_enabled=profanity_filter_enabled,
        pii_filter_enabled=pii_filter_enabled,
        commitment_filter_enabled=commitment_filter_enabled,
        custom_keywords_enabled=custom_keywords_enabled,
        confidence_threshold=confidence_threshold,
        custom_blocked_keywords=custom_blocked_keywords or [],
    )
    return GuardrailsService(config)
