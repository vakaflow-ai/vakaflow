"""
Unit tests for Agent Offboarding Skill
"""
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session

from app.services.agentic.ai_grc_agent import AiGrcAgent
from app.models.agent import Agent, AgentStatus
from app.models.offboarding import OffboardingRequest, OffboardingStatus, OffboardingReason
from app.models.user import User


@pytest.fixture
def sample_agent(db: Session, test_user: User):
    """Create a sample agent for testing"""
    from app.models.vendor import Vendor
    
    vendor = Vendor(
        tenant_id=test_user.tenant_id,
        name="Test Vendor",
        contact_email="vendor@test.com"
    )
    db.add(vendor)
    db.flush()
    
    agent = Agent(
        tenant_id=test_user.tenant_id,
        vendor_id=vendor.id,
        name="Test Agent",
        type="ai",
        category="test",
        status=AgentStatus.APPROVED.value
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@pytest.mark.asyncio
async def test_agent_offboarding_creates_request(db: Session, test_user: User, sample_agent: Agent):
    """Test that agent offboarding creates an offboarding request"""
    agent = AiGrcAgent(db, test_user.tenant_id, sample_agent.id, "Test Agent")
    
    input_data = {
        "agent_id": str(sample_agent.id),
        "reason": OffboardingReason.CONTRACT_END.value,
        "reason_details": "Contract expired"
    }
    
    with patch.object(agent, 'query_rag', new_callable=AsyncMock) as mock_rag:
        mock_rag.return_value = []
        
        result = await agent._agent_offboarding(input_data)
        
        assert result["agent_id"] == str(sample_agent.id)
        assert result["offboarding_status"] == OffboardingStatus.IN_PROGRESS.value
        assert result["offboarding_request_id"] is not None
        assert "impact_analysis" in result
        assert "checklist" in result


@pytest.mark.asyncio
async def test_agent_offboarding_existing_request(db: Session, test_user: User, sample_agent: Agent):
    """Test that agent offboarding handles existing request"""
    # Create existing offboarding request
    existing_request = OffboardingRequest(
        agent_id=sample_agent.id,
        tenant_id=test_user.tenant_id,
        requested_by=test_user.id,
        reason=OffboardingReason.CONTRACT_END.value,
        status=OffboardingStatus.IN_PROGRESS.value
    )
    db.add(existing_request)
    db.commit()
    
    agent = AiGrcAgent(db, test_user.tenant_id, sample_agent.id, "Test Agent")
    
    input_data = {
        "agent_id": str(sample_agent.id),
        "reason": OffboardingReason.CONTRACT_END.value
    }
    
    with patch.object(agent, 'query_rag', new_callable=AsyncMock) as mock_rag:
        mock_rag.return_value = []
        
        result = await agent._agent_offboarding(input_data)
        
        assert result["offboarding_request_id"] == str(existing_request.id)
        assert "message" in result
        assert "already exists" in result["message"].lower()

