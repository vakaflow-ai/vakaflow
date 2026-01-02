"""
Unit tests for Flow Templates
"""
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models.agentic_flow import AgenticFlow, FlowStatus
from app.models.user import User


@pytest.fixture
def flow_template(db: Session, test_user: User):
    """Create a flow template for testing"""
    template = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Test Template",
        description="A test flow template",
        category="test",
        flow_definition={
            "nodes": [
                {
                    "id": "node1",
                    "type": "agent",
                    "agent_id": str(uuid4()),
                    "skill": "test_skill",
                    "input": {},
                    "position": {"x": 0, "y": 0}
                }
            ],
            "edges": []
        },
        status=FlowStatus.ACTIVE.value,
        is_template=True,
        version=1,
        is_current_version=True
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def test_template_creation(flow_template: AgenticFlow):
    """Test that template is created correctly"""
    assert flow_template.is_template is True
    assert flow_template.status == FlowStatus.ACTIVE.value


def test_template_instantiation(db: Session, test_user: User, flow_template: AgenticFlow):
    """Test creating a flow from a template"""
    new_flow = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Flow from Template",
        description=flow_template.description,
        category=flow_template.category,
        flow_definition=flow_template.flow_definition,
        tags=flow_template.tags.copy() if flow_template.tags else [],
        is_template=False,
        status=FlowStatus.DRAFT.value,
        version=1,
        is_current_version=True,
        created_by=test_user.id
    )
    
    db.add(new_flow)
    db.commit()
    
    assert new_flow.is_template is False
    assert new_flow.status == FlowStatus.DRAFT.value
    assert new_flow.flow_definition == flow_template.flow_definition

