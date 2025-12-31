from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser
from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleDetail, RuleUpdate

router = APIRouter()


@router.get("", response_model=list[RuleDetail])
async def list_rules(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[Rule]:
    """List all rules."""
    result = await db.execute(
        select(Rule)
        .where(Rule.user_id == current_user.id)
        .order_by(Rule.priority.asc())
    )
    return list(result.scalars().all())


@router.post("", response_model=RuleDetail)
async def create_rule(
    rule_data: RuleCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Rule:
    """Create a new automation rule."""
    rule = Rule(
        user_id=current_user.id,
        name=rule_data.name,
        description=rule_data.description,
        priority=rule_data.priority,
        conditions=rule_data.conditions,
        action=rule_data.action,
        action_config=rule_data.action_config,
        is_active=rule_data.is_active,
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=RuleDetail)
async def get_rule(
    rule_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Rule:
    """Get rule detail."""
    result = await db.execute(
        select(Rule).where(
            Rule.id == rule_id,
            Rule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        )

    return rule


@router.put("/{rule_id}", response_model=RuleDetail)
async def update_rule(
    rule_id: UUID,
    rule_data: RuleUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Rule:
    """Update a rule."""
    result = await db.execute(
        select(Rule).where(
            Rule.id == rule_id,
            Rule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        )

    update_data = rule_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.flush()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete a rule."""
    result = await db.execute(
        select(Rule).where(
            Rule.id == rule_id,
            Rule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        )

    await db.delete(rule)
    await db.flush()

    return {"status": "deleted", "rule_id": str(rule_id)}


@router.post("/{rule_id}/toggle", response_model=RuleDetail)
async def toggle_rule(
    rule_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Rule:
    """Enable or disable a rule."""
    result = await db.execute(
        select(Rule).where(
            Rule.id == rule_id,
            Rule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        )

    rule.is_active = not rule.is_active
    await db.flush()
    await db.refresh(rule)

    return rule


@router.post("/test")
async def test_rule(
    rule_data: RuleCreate,
    current_user: CurrentUser,
    test_email_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Test a rule against a sample email."""
    if not test_email_id:
        return {"matches": False, "error": "No email provided to test against"}

    from app.models.email import Email
    from app.services.gmail_service import EmailMessage
    from app.services.rule_engine import Rule as RuleModel, RuleEngine

    # Get email
    result = await db.execute(
        select(Email).where(
            Email.id == test_email_id,
            Email.user_id == current_user.id,
        )
    )
    email = result.scalar_one_or_none()

    if not email:
        return {"matches": False, "error": "Email not found"}

    # Create test rule
    test_rule = RuleModel(
        id="test",
        name=rule_data.name,
        priority=rule_data.priority,
        conditions=RuleEngine._parse_conditions(rule_data.conditions),
        action=rule_data.action,
        action_config=rule_data.action_config,
        is_active=True,
    )

    # Create email message for testing
    test_email = EmailMessage(
        gmail_id=email.gmail_id,
        thread_id=email.thread_id or "",
        from_email=email.from_email or "",
        from_name=email.from_name,
        to_emails=email.to_emails or [],
        cc_emails=email.cc_emails or [],
        subject=email.subject or "",
        snippet=email.snippet or "",
        body_text=email.body_text or "",
        body_html=email.body_html,
        received_at=email.received_at or email.created_at,
    )

    # Test rule
    engine = RuleEngine([test_rule])
    matched = engine.evaluate(test_email)

    return {"matches": matched is not None}
