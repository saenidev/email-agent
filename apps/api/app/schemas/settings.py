from decimal import Decimal

from pydantic import BaseModel, Field


class UserSettingsResponse(BaseModel):
    approval_mode: str
    llm_model: str
    llm_temperature: Decimal
    system_prompt: str | None
    signature: str | None
    notify_on_draft: bool
    notify_on_auto_send: bool

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    approval_mode: str | None = Field(
        None,
        pattern="^(draft_approval|auto_with_rules|fully_automatic)$",
    )
    llm_model: str | None = None
    llm_temperature: Decimal | None = Field(None, ge=0, le=2)
    system_prompt: str | None = None
    signature: str | None = None
    notify_on_draft: bool | None = None
    notify_on_auto_send: bool | None = None
