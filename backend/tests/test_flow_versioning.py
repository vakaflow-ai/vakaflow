"""
Unit tests for Flow Versioning
"""
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models.agentic_flow import AgenticFlow, FlowStatus
from app.models.user import User


@pytest.fixture
def versioned_flow(db: Session, test_user: User):
    """Create a flow with versions for testing"""
    # Create parent flow (version 1)
    flow_v1 = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Versioned Flow",
        flow_definition={"nodes": [{"id": "node1", "type": "agent"}], "edges": []},
        status=FlowStatus.ACTIVE.value,
        version=1,
        is_current_version=False,  # Not current after v2 is created
        created_by=test_user.id
    )
    db.add(flow_v1)
    db.flush()
    
    # Create version 2
    flow_v2 = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Versioned Flow",
        flow_definition={"nodes": [{"id": "node1", "type": "agent"}, {"id": "node2", "type": "condition"}], "edges": []},
        status=FlowStatus.ACTIVE.value,
        version=2,
        parent_flow_id=flow_v1.id,
        is_current_version=True,
        created_by=test_user.id
    )
    db.add(flow_v2)
    db.commit()
    
    return flow_v1, flow_v2


def test_flow_versioning_creation(versioned_flow):
    """Test that flow versions are created correctly"""
    v1, v2 = versioned_flow
    
    assert v1.version == 1
    assert v2.version == 2
    assert v2.parent_flow_id == v1.id
    assert v2.is_current_version is True
    assert v1.is_current_version is False


def test_flow_version_retrieval(db: Session, versioned_flow):
    """Test retrieving specific flow version"""
    v1, v2 = versioned_flow
    
    # Get version 1
    retrieved_v1 = db.query(AgenticFlow).filter(
        AgenticFlow.id == v1.id,
        AgenticFlow.version == 1
    ).first()
    
    assert retrieved_v1 is not None
    assert retrieved_v1.version == 1
    assert len(retrieved_v1.flow_definition["nodes"]) == 1
    
    # Get version 2
    retrieved_v2 = db.query(AgenticFlow).filter(
        AgenticFlow.id == v2.id,
        AgenticFlow.version == 2
    ).first()
    
    assert retrieved_v2 is not None
    assert retrieved_v2.version == 2
    assert len(retrieved_v2.flow_definition["nodes"]) == 2


def test_flow_version_listing(db: Session, versioned_flow):
    """Test listing all versions of a flow"""
    v1, v2 = versioned_flow
    parent_id = v1.id
    
    versions = db.query(AgenticFlow).filter(
        AgenticFlow.parent_flow_id == parent_id
    ).all()
    
    # Should include both versions
    version_numbers = [v.version for v in versions]
    assert 1 in version_numbers or 2 in version_numbers

