"""Rule engine for email automation."""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

from app.services.gmail_service import EmailMessage


class FieldOperator(str, Enum):
    """Operators for rule conditions."""

    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    MATCHES_REGEX = "matches_regex"
    IN_LIST = "in_list"


class RuleAction(str, Enum):
    """Actions a rule can take."""

    AUTO_RESPOND = "auto_respond"
    DRAFT_ONLY = "draft_only"
    IGNORE = "ignore"
    FORWARD = "forward"


@dataclass
class RuleCondition:
    """A single condition in a rule."""

    field: str  # from_email, from_name, subject, body_text
    operator: FieldOperator
    value: str | list[str]
    case_sensitive: bool = False


@dataclass
class RuleGroup:
    """A group of conditions with AND/OR logic."""

    operator: str  # "AND" or "OR"
    conditions: list[RuleCondition | "RuleGroup"]


@dataclass
class Rule:
    """An automation rule."""

    id: str
    name: str
    priority: int
    conditions: RuleGroup
    action: RuleAction
    action_config: dict[str, Any] | None = None
    is_active: bool = True


class RuleEngine:
    """Engine for evaluating rules against emails."""

    def __init__(self, rules: list[Rule]):
        # Sort by priority (lower = higher priority)
        self.rules = sorted(rules, key=lambda r: r.priority)

    @classmethod
    def from_db_rules(cls, db_rules: list[Any]) -> "RuleEngine":
        """Create engine from database rule models."""
        rules = []
        for db_rule in db_rules:
            conditions = cls._parse_conditions(db_rule.conditions)
            rules.append(
                Rule(
                    id=str(db_rule.id),
                    name=db_rule.name,
                    priority=db_rule.priority,
                    conditions=conditions,
                    action=RuleAction(db_rule.action),
                    action_config=db_rule.action_config,
                    is_active=db_rule.is_active,
                )
            )
        return cls(rules)

    @classmethod
    def _parse_conditions(cls, data: dict[str, Any]) -> RuleGroup:
        """Parse conditions from JSON structure."""
        operator = data.get("operator", "AND")
        conditions: list[RuleCondition | RuleGroup] = []

        for item in data.get("rules", []):
            if "operator" in item and "rules" in item:
                # Nested group
                conditions.append(cls._parse_conditions(item))
            else:
                # Single condition
                conditions.append(
                    RuleCondition(
                        field=item["field"],
                        operator=FieldOperator(item["operator"]),
                        value=item["value"],
                        case_sensitive=item.get("case_sensitive", False),
                    )
                )

        return RuleGroup(operator=operator, conditions=conditions)

    def evaluate(self, email: EmailMessage) -> Rule | None:
        """Find the first matching rule for an email."""
        for rule in self.rules:
            if rule.is_active and self._matches(email, rule.conditions):
                return rule
        return None

    def evaluate_all(self, email: EmailMessage) -> list[Rule]:
        """Find all matching rules for an email."""
        matching = []
        for rule in self.rules:
            if rule.is_active and self._matches(email, rule.conditions):
                matching.append(rule)
        return matching

    def _matches(self, email: EmailMessage, group: RuleGroup) -> bool:
        """Recursively evaluate rule conditions."""
        results = []

        for condition in group.conditions:
            if isinstance(condition, RuleGroup):
                results.append(self._matches(email, condition))
            else:
                results.append(self._evaluate_condition(email, condition))

        if group.operator == "AND":
            return all(results) if results else False
        else:  # OR
            return any(results) if results else False

    def _evaluate_condition(
        self,
        email: EmailMessage,
        condition: RuleCondition,
    ) -> bool:
        """Evaluate a single condition against an email."""
        # Get field value from email
        field_value = self._get_field_value(email, condition.field)
        target = condition.value

        # Handle case sensitivity
        if not condition.case_sensitive:
            if isinstance(field_value, str):
                field_value = field_value.lower()
            if isinstance(target, str):
                target = target.lower()
            elif isinstance(target, list):
                target = [t.lower() for t in target]

        # Evaluate based on operator
        match condition.operator:
            case FieldOperator.EQUALS:
                return field_value == target
            case FieldOperator.NOT_EQUALS:
                return field_value != target
            case FieldOperator.CONTAINS:
                return isinstance(target, str) and target in field_value
            case FieldOperator.NOT_CONTAINS:
                return isinstance(target, str) and target not in field_value
            case FieldOperator.STARTS_WITH:
                return isinstance(target, str) and field_value.startswith(target)
            case FieldOperator.ENDS_WITH:
                return isinstance(target, str) and field_value.endswith(target)
            case FieldOperator.MATCHES_REGEX:
                try:
                    return bool(re.search(str(target), field_value))
                except re.error:
                    return False
            case FieldOperator.IN_LIST:
                if isinstance(target, list):
                    return field_value in target
                return False
            case _:
                return False

    def _get_field_value(self, email: EmailMessage, field: str) -> str:
        """Get a field value from an email."""
        match field:
            case "from_email":
                return email.from_email or ""
            case "from_name":
                return email.from_name or ""
            case "subject":
                return email.subject or ""
            case "body_text":
                return email.body_text or ""
            case "snippet":
                return email.snippet or ""
            case _:
                return ""
