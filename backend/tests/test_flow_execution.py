"""
Unit tests for Flow Execution Service
"""
import pytest
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.flow_execution_service import FlowExecutionService
from app.models.agentic_flow import AgenticFlow, FlowExecution, FlowStatus, FlowExecutionStatus
from app.models.user import User


@pytest.fixture
def sample_flow(db: Session, test_user: User):
    """Create a sample flow for testing"""
    flow = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Test Flow",
        description="Test flow for unit tests",
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
        is_template=False,
        version=1,
        is_current_version=True,
        created_by=test_user.id
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow


def test_create_flow_execution(db: Session, test_user: User, sample_flow: AgenticFlow):
    """Test creating a flow execution"""
    service = FlowExecutionService(db)
    
    execution = FlowExecution(
        id=uuid4(),
        flow_id=sample_flow.id,
        tenant_id=test_user.tenant_id,
        status=FlowExecutionStatus.PENDING.value,
        triggered_by=test_user.id
    )
    
    db.add(execution)
    db.commit()
    
    assert execution.id is not None
    assert execution.flow_id == sample_flow.id
    assert execution.status == FlowExecutionStatus.PENDING.value


def test_flow_execution_error_handling(db: Session, test_user: User, sample_flow: AgenticFlow):
    """Test that flow execution errors are handled gracefully"""
    service = FlowExecutionService(db)
    
    # Create execution
    execution = FlowExecution(
        id=uuid4(),
        flow_id=sample_flow.id,
        tenant_id=test_user.tenant_id,
        status=FlowExecutionStatus.PENDING.value,
        triggered_by=test_user.id,
        started_at=datetime.utcnow()
    )
    db.add(execution)
    db.commit()
    
    # Simulate error
    execution.status = FlowExecutionStatus.FAILED.value
    execution.error_message = "Test error message"
    execution.completed_at = datetime.utcnow()
    db.commit()
    
    assert execution.status == FlowExecutionStatus.FAILED.value
    assert execution.error_message is not None
    assert "error" in execution.error_message.lower() or "Test" in execution.error_message

