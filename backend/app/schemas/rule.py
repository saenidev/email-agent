from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class RuleCondition(BaseModel):
    field: str  # from_email, from_name, subject, body_text
    operator: str  # equals, contains, starts_with, ends_with, regex
    value: str
    case_sensitive: bool = False


class RuleGroup(BaseModel):
    operator: str  # "AND" or "OR"
    rules: list[RuleCondition | "RuleGroup"]


class RuleCreate(BaseModel):
    name: str
    description: str | None = None
    priority: int = 100
    conditions: dict[str, Any]  # RuleGroup as dict
    action: str  # 'auto_respond', 'draft_only', 'ignore', 'forward'
    action_config: dict[str, Any] | None = None
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = None
    conditions: dict[str, Any] | None = None
    action: str | None = None
    action_config: dict[str, Any] | None = None
    is_active: bool | None = None


class RuleDetail(BaseModel):
    id: UUID
    name: str
    description: str | None
    priority: int
    conditions: dict[str, Any]
    action: str
    action_config: dict[str, Any] | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
