"""
Unit tests for Flow Execution Audit Logging
"""
import pytest
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.agentic_flow import AgenticFlow, FlowExecution, FlowStatus, FlowExecutionStatus
from app.models.audit import AuditLog, AuditAction
from app.models.user import User


def test_flow_execution_audit_log_created(db: Session, test_user: User):
    """Test that audit log is created for flow execution"""
    # Create flow
    flow = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Test Flow",
        flow_definition={"nodes": [], "edges": []},
        status=FlowStatus.ACTIVE.value,
        version=1,
        is_current_version=True
    )
    db.add(flow)
    db.commit()
    
    # Create execution
    execution = FlowExecution(
        id=uuid4(),
        flow_id=flow.id,
        tenant_id=test_user.tenant_id,
        status=FlowExecutionStatus.RUNNING.value,
        triggered_by=test_user.id,
        started_at=datetime.utcnow()
    )
    db.add(execution)
    db.commit()
    
    # Create audit log
    audit_log = AuditLog(
        user_id=str(test_user.id),
        action=AuditAction.EXECUTE.value,
        resource_type="flow_execution",
        resource_id=str(execution.id),
        tenant_id=str(test_user.tenant_id),
        details={
            "flow_id": str(flow.id),
            "flow_name": flow.name,
            "status": execution.status
        }
    )
    db.add(audit_log)
    db.commit()
    
    # Verify audit log
    retrieved = db.query(AuditLog).filter(
        AuditLog.resource_id == execution.id
    ).first()
    
    assert retrieved is not None
    assert retrieved.action == AuditAction.EXECUTE.value
    assert retrieved.resource_type == "flow_execution"
    assert retrieved.details["flow_id"] == str(flow.id)

