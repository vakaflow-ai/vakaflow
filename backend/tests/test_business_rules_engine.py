"""
Unit tests for Business Rules Engine
"""
import pytest
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.business_rules_engine import BusinessRulesEngine
from app.models.business_rule import BusinessRule, RuleType, RuleStatus
from app.models.user import User, UserRole


@pytest.fixture
def test_user_with_tenant(db: Session):
    """Create a test user with tenant_id"""
    from app.models.tenant import Tenant
    from app.core.security import get_password_hash
    
    tenant = Tenant(
        id=uuid4(),
        name="Test Tenant",
        domain="test.com"
    )
    db.add(tenant)
    db.flush()
    
    user = User(
        id=uuid4(),
        email="test@example.com",
        name="Test User",
        role=UserRole.TENANT_ADMIN,
        hashed_password=get_password_hash("test123"),
        is_active=True,
        tenant_id=tenant.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def sample_rule(db: Session, test_user_with_tenant: User):
    """Create a sample business rule for testing"""
    rule = BusinessRule(
        tenant_id=test_user_with_tenant.tenant_id,
        rule_id="test_rule_1",
        name="Test Rule",
        rule_type=RuleType.CONDITIONAL.value,
        condition_expression="user.department == 'IT'",
        action_expression="assign_to:user.department_manager",
        priority=100,
        is_active=True,
        is_automatic=True,
        status=RuleStatus.ACTIVE.value,
        created_by=test_user_with_tenant.id
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def test_evaluate_rules_simple_condition(db: Session, test_user_with_tenant: User, sample_rule: BusinessRule):
    """Test evaluating a simple business rule"""
    engine = BusinessRulesEngine(db, test_user_with_tenant.tenant_id)
    
    context = {
        "user": {
            "department": "IT"
        }
    }
    
    results = engine.evaluate_rules(
        context=context,
        entity_type="user",
        screen="agent_submission"
    )
    
    assert len(results) > 0
    assert any(r.rule_id == "test_rule_1" for r in results)


def test_evaluate_rules_no_match(db: Session, test_user_with_tenant: User, sample_rule: BusinessRule):
    """Test evaluating rules when condition doesn't match"""
    engine = BusinessRulesEngine(db, test_user_with_tenant.tenant_id)
    
    context = {
        "user": {
            "department": "HR"
        }
    }
    
    results = engine.evaluate_rules(
        context=context,
        entity_type="user",
        screen="agent_submission"
    )
    
    # Rule should not match
    assert not any(r.rule_id == "test_rule_1" for r in results)


def test_execute_actions(db: Session, test_user_with_tenant: User, sample_rule: BusinessRule):
    """Test executing rule actions"""
    engine = BusinessRulesEngine(db, test_user_with_tenant.tenant_id)
    
    context = {
        "user": {
            "department": "IT",
            "department_manager": "manager@example.com"
        }
    }
    
    results = engine.evaluate_rules(
        context=context,
        entity_type="user",
        screen="agent_submission"
    )
    
    action_results = engine.execute_actions(results, context, auto_execute=True)
    
    assert "executed" in action_results
    assert len(action_results["executed"]) > 0

