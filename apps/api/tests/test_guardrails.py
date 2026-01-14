"""Tests for the guardrails service."""

import pytest

from app.services.guardrails_service import (
    GuardrailConfig,
    GuardrailsService,
    ViolationType,
)


class TestProfanityFilter:
    """Tests for profanity detection."""

    def test_detects_profanity(self):
        """Should detect common profanity."""
        service = GuardrailsService()
        result = service.validate("This is damn annoying")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PROFANITY for v in result.violations)

    def test_case_insensitive(self):
        """Should detect profanity regardless of case."""
        service = GuardrailsService()
        result = service.validate("This is DAMN annoying")
        assert not result.passed

    def test_passes_clean_content(self):
        """Should pass content without profanity."""
        service = GuardrailsService()
        result = service.validate("Thank you for your email. I will respond shortly.")
        profanity_violations = [
            v for v in result.violations if v.violation_type == ViolationType.PROFANITY
        ]
        assert len(profanity_violations) == 0

    def test_disabled_filter(self):
        """Should not detect profanity when filter is disabled."""
        config = GuardrailConfig(profanity_filter_enabled=False)
        service = GuardrailsService(config)
        result = service.validate("This is damn annoying")
        profanity_violations = [
            v for v in result.violations if v.violation_type == ViolationType.PROFANITY
        ]
        assert len(profanity_violations) == 0


class TestPIIFilter:
    """Tests for PII detection."""

    def test_detects_credit_card_visa(self):
        """Should detect Visa credit card numbers."""
        service = GuardrailsService()
        result = service.validate("My card number is 4111111111111111")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PII_CREDIT_CARD for v in result.violations)

    def test_detects_credit_card_mastercard(self):
        """Should detect Mastercard numbers."""
        service = GuardrailsService()
        result = service.validate("Use card 5555555555554444 for payment")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PII_CREDIT_CARD for v in result.violations)

    def test_detects_ssn_with_dashes(self):
        """Should detect SSN with dashes."""
        service = GuardrailsService()
        result = service.validate("My SSN is 123-45-6789")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PII_SSN for v in result.violations)

    def test_detects_ssn_without_dashes(self):
        """Should detect SSN without dashes."""
        service = GuardrailsService()
        result = service.validate("SSN: 123456789")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PII_SSN for v in result.violations)

    def test_rejects_invalid_ssn_patterns(self):
        """Should not flag invalid SSN patterns (000, 666, 9xx start)."""
        service = GuardrailsService()
        # 000 area code is invalid
        result1 = service.validate("Number 000-12-3456")
        ssn_violations1 = [v for v in result1.violations if v.violation_type == ViolationType.PII_SSN]
        assert len(ssn_violations1) == 0

        # 666 area code is invalid
        result2 = service.validate("Number 666-12-3456")
        ssn_violations2 = [v for v in result2.violations if v.violation_type == ViolationType.PII_SSN]
        assert len(ssn_violations2) == 0

    def test_detects_password_patterns(self):
        """Should detect password patterns."""
        service = GuardrailsService()
        result = service.validate("The password: secret123")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PII_PASSWORD for v in result.violations)

    def test_detects_api_key_patterns(self):
        """Should detect API key patterns."""
        service = GuardrailsService()
        result = service.validate("Use api_key=sk-12345abcdef for auth")
        assert not result.passed
        assert any(v.violation_type == ViolationType.PII_PASSWORD for v in result.violations)

    def test_disabled_filter(self):
        """Should not detect PII when filter is disabled."""
        config = GuardrailConfig(pii_filter_enabled=False)
        service = GuardrailsService(config)
        result = service.validate("My card is 4111111111111111 and SSN is 123-45-6789")
        pii_violations = [
            v for v in result.violations
            if v.violation_type in {ViolationType.PII_CREDIT_CARD, ViolationType.PII_SSN, ViolationType.PII_PASSWORD}
        ]
        assert len(pii_violations) == 0


class TestCommitmentFilter:
    """Tests for commitment word detection."""

    def test_detects_i_agree(self):
        """Should detect 'I agree' language."""
        service = GuardrailsService()
        result = service.validate("I agree to the terms and conditions")
        assert not result.passed
        assert any(v.violation_type == ViolationType.COMMITMENT_WORD for v in result.violations)

    def test_detects_confirmed(self):
        """Should detect 'confirmed' language."""
        service = GuardrailsService()
        result = service.validate("The meeting is confirmed for tomorrow")
        assert not result.passed
        assert any(v.violation_type == ViolationType.COMMITMENT_WORD for v in result.violations)

    def test_detects_payment_commitment(self):
        """Should detect payment commitment language."""
        service = GuardrailsService()
        result = service.validate("I'll pay for the services next week")
        assert not result.passed
        assert any(v.violation_type == ViolationType.COMMITMENT_WORD for v in result.violations)

    def test_detects_deal_language(self):
        """Should detect deal/agreement language."""
        service = GuardrailsService()
        result = service.validate("It's a deal! Let's proceed.")
        assert not result.passed
        assert any(v.violation_type == ViolationType.COMMITMENT_WORD for v in result.violations)

    def test_passes_neutral_content(self):
        """Should pass content without commitment language."""
        service = GuardrailsService()
        result = service.validate("Thank you for your proposal. I will review it and get back to you.")
        commitment_violations = [
            v for v in result.violations if v.violation_type == ViolationType.COMMITMENT_WORD
        ]
        assert len(commitment_violations) == 0

    def test_disabled_filter(self):
        """Should not detect commitments when filter is disabled."""
        config = GuardrailConfig(commitment_filter_enabled=False)
        service = GuardrailsService(config)
        result = service.validate("I agree and confirm the deal")
        commitment_violations = [
            v for v in result.violations if v.violation_type == ViolationType.COMMITMENT_WORD
        ]
        assert len(commitment_violations) == 0


class TestCustomKeywords:
    """Tests for custom keyword blocking."""

    def test_blocks_custom_keyword(self):
        """Should block custom keywords."""
        config = GuardrailConfig(custom_blocked_keywords=["confidential", "secret project"])
        service = GuardrailsService(config)
        result = service.validate("This is about the confidential matter")
        assert not result.passed
        assert any(v.violation_type == ViolationType.CUSTOM_KEYWORD for v in result.violations)

    def test_blocks_multi_word_keyword(self):
        """Should block multi-word custom keywords."""
        config = GuardrailConfig(custom_blocked_keywords=["secret project"])
        service = GuardrailsService(config)
        result = service.validate("The secret project is progressing well")
        assert not result.passed
        assert any(v.violation_type == ViolationType.CUSTOM_KEYWORD for v in result.violations)

    def test_case_insensitive(self):
        """Should block keywords regardless of case."""
        config = GuardrailConfig(custom_blocked_keywords=["URGENT"])
        service = GuardrailsService(config)
        result = service.validate("This is urgent please respond")
        assert not result.passed

    def test_disabled_filter(self):
        """Should not block custom keywords when filter is disabled."""
        config = GuardrailConfig(
            custom_blocked_keywords=["confidential"],
            custom_keywords_enabled=False,
        )
        service = GuardrailsService(config)
        result = service.validate("This is confidential information")
        custom_violations = [
            v for v in result.violations if v.violation_type == ViolationType.CUSTOM_KEYWORD
        ]
        assert len(custom_violations) == 0

    def test_empty_keywords_list(self):
        """Should handle empty keywords list gracefully."""
        config = GuardrailConfig(custom_blocked_keywords=[])
        service = GuardrailsService(config)
        result = service.validate("Any content should pass")
        custom_violations = [
            v for v in result.violations if v.violation_type == ViolationType.CUSTOM_KEYWORD
        ]
        assert len(custom_violations) == 0


class TestConfidenceThreshold:
    """Tests for confidence threshold enforcement."""

    def test_low_confidence_fails(self):
        """Should flag low confidence responses."""
        config = GuardrailConfig(confidence_threshold=0.7)
        service = GuardrailsService(config)
        result = service.validate("Normal content", confidence=0.5)
        assert not result.passed
        assert any(v.violation_type == ViolationType.LOW_CONFIDENCE for v in result.violations)

    def test_high_confidence_passes(self):
        """Should pass high confidence responses."""
        config = GuardrailConfig(confidence_threshold=0.7)
        service = GuardrailsService(config)
        result = service.validate("Normal content", confidence=0.9)
        confidence_violations = [
            v for v in result.violations if v.violation_type == ViolationType.LOW_CONFIDENCE
        ]
        assert len(confidence_violations) == 0

    def test_exact_threshold_passes(self):
        """Should pass when confidence exactly matches threshold."""
        config = GuardrailConfig(confidence_threshold=0.7)
        service = GuardrailsService(config)
        result = service.validate("Normal content", confidence=0.7)
        confidence_violations = [
            v for v in result.violations if v.violation_type == ViolationType.LOW_CONFIDENCE
        ]
        assert len(confidence_violations) == 0

    def test_zero_threshold_always_passes(self):
        """Should always pass confidence check when threshold is 0."""
        config = GuardrailConfig(confidence_threshold=0.0)
        service = GuardrailsService(config)
        result = service.validate("Normal content", confidence=0.1)
        confidence_violations = [
            v for v in result.violations if v.violation_type == ViolationType.LOW_CONFIDENCE
        ]
        assert len(confidence_violations) == 0


class TestValidationResult:
    """Tests for validation result properties."""

    def test_passed_when_no_violations(self):
        """Should pass when all checks are clean."""
        service = GuardrailsService()
        result = service.validate("Thank you for your email. I look forward to hearing from you.")
        assert result.passed
        assert len(result.violations) == 0
        assert not result.should_downgrade_to_draft

    def test_failed_sets_downgrade_flag(self):
        """Should set downgrade flag when validation fails."""
        service = GuardrailsService()
        result = service.validate("This is damn annoying, I agree to pay")
        assert not result.passed
        assert result.should_downgrade_to_draft

    def test_violation_summary(self):
        """Should generate human-readable violation summary."""
        service = GuardrailsService()
        result = service.validate("I agree and confirm", confidence=0.5)
        summary = result.violation_summary
        assert len(summary) > 0
        assert ";" in summary or "Low confidence" in summary or "Commitment" in summary


class TestConfigUpdate:
    """Tests for dynamic configuration updates."""

    def test_update_config_recompiles_patterns(self):
        """Should recompile patterns when config is updated."""
        service = GuardrailsService()

        # Initially no custom keywords
        result1 = service.validate("This is a test keyword")
        assert result1.passed

        # Update config with custom keyword
        new_config = GuardrailConfig(custom_blocked_keywords=["test keyword"])
        service.update_config(new_config)

        result2 = service.validate("This is a test keyword")
        assert not result2.passed


class TestMasking:
    """Tests for sensitive data masking in violation details."""

    def test_profanity_masked(self):
        """Should mask profanity in violation details."""
        service = GuardrailsService()
        result = service.validate("This is damn annoying")
        profanity_violation = next(
            v for v in result.violations if v.violation_type == ViolationType.PROFANITY
        )
        # Should show masked version, not the full word
        assert "d**n" in profanity_violation.matched_text or len(profanity_violation.matched_text) < 6

    def test_credit_card_masked(self):
        """Should mask credit card numbers in violation details."""
        service = GuardrailsService()
        result = service.validate("My card is 4111111111111111")
        cc_violation = next(
            v for v in result.violations if v.violation_type == ViolationType.PII_CREDIT_CARD
        )
        # Should show only last 4 digits
        assert "1111" in cc_violation.matched_text
        assert "4111111111111111" not in cc_violation.matched_text

    def test_password_fully_redacted(self):
        """Should fully redact passwords in violation details."""
        service = GuardrailsService()
        result = service.validate("password: mysecretpassword")
        password_violation = next(
            v for v in result.violations if v.violation_type == ViolationType.PII_PASSWORD
        )
        assert "REDACTED" in password_violation.matched_text
        assert "mysecretpassword" not in password_violation.matched_text
