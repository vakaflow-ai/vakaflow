"""
Unit tests for Flow Sharing
"""
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models.agentic_flow import AgenticFlow, FlowStatus
from app.models.user import User


@pytest.fixture
def shared_flow(db: Session, test_user: User):
    """Create a shared flow for testing"""
    flow = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Shared Flow",
        description="A flow shared with other tenants",
        category="test",
        flow_definition={"nodes": [], "edges": []},
        status=FlowStatus.ACTIVE.value,
        is_shared=True,
        shared_with_tenants=None,  # Shared with all tenants
        version=1,
        is_current_version=True
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow


def test_flow_sharing_all_tenants(shared_flow: AgenticFlow):
    """Test that flow shared with all tenants is accessible"""
    assert shared_flow.is_shared is True
    assert shared_flow.shared_with_tenants is None  # None means all tenants


def test_flow_sharing_specific_tenants(db: Session, test_user: User):
    """Test flow sharing with specific tenants"""
    other_tenant_id = uuid4()
    
    flow = AgenticFlow(
        tenant_id=test_user.tenant_id,
        name="Selectively Shared Flow",
        flow_definition={"nodes": [], "edges": []},
        status=FlowStatus.ACTIVE.value,
        is_shared=True,
        shared_with_tenants=[str(other_tenant_id)],
        version=1,
        is_current_version=True
    )
    db.add(flow)
    db.commit()
    
    assert flow.is_shared is True
    assert flow.shared_with_tenants == [str(other_tenant_id)]


def test_flow_unshare(db: Session, shared_flow: AgenticFlow):
    """Test unsharing a flow"""
    shared_flow.is_shared = False
    shared_flow.shared_with_tenants = None
    db.commit()
    
    assert shared_flow.is_shared is False

