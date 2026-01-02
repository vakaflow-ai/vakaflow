"""
Unit tests for Compliance Review Skill
"""
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session

from app.services.agentic.compliance_reviewer_agent import ComplianceReviewerAgent
from app.models.agent import Agent, AgentStatus
from app.models.compliance_framework import ComplianceFramework
from app.models.user import User


@pytest.fixture
def sample_agent_for_compliance(db: Session, test_user: User):
    """Create a sample agent for compliance testing"""
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
        status=AgentStatus.APPROVED.value,
        compliance_score=85
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@pytest.mark.asyncio
async def test_compliance_review_basic(db: Session, test_user: User, sample_agent_for_compliance: Agent):
    """Test basic compliance review"""
    agent = ComplianceReviewerAgent(db, test_user.tenant_id, uuid4(), "Compliance Reviewer")
    
    input_data = {
        "agent_id": str(sample_agent_for_compliance.id)
    }
    
    with patch.object(agent, 'query_rag', new_callable=AsyncMock) as mock_rag, \
         patch.object(agent, 'call_llm', new_callable=AsyncMock) as mock_llm:
        mock_rag.return_value = [{"content": "Compliance requirement 1"}]
        mock_llm.return_value = "Compliance review: COMPLIANT"
        
        with patch('app.services.compliance_service.ComplianceService.check_agent_compliance', new_callable=AsyncMock) as mock_compliance:
            mock_compliance.return_value = {
                "compliance_score": 85,
                "gaps": [],
                "recommendations": []
            }
            
            result = await agent._compliance_review(input_data)
            
            assert result["agent_id"] == str(sample_agent_for_compliance.id)
            assert "overall_compliance_status" in result
            assert "compliance_score" in result
            assert result["compliance_score"] == 85


@pytest.mark.asyncio
async def test_compliance_review_with_framework(db: Session, test_user: User, sample_agent_for_compliance: Agent):
    """Test compliance review with specific framework"""
    # Create a compliance framework
    framework = ComplianceFramework(
        tenant_id=test_user.tenant_id,
        name="Test Framework",
        framework_type="security",
        is_active=True
    )
    db.add(framework)
    db.commit()
    
    agent = ComplianceReviewerAgent(db, test_user.tenant_id, uuid4(), "Compliance Reviewer")
    
    input_data = {
        "agent_id": str(sample_agent_for_compliance.id),
        "framework_id": str(framework.id)
    }
    
    with patch.object(agent, 'query_rag', new_callable=AsyncMock) as mock_rag, \
         patch.object(agent, 'call_llm', new_callable=AsyncMock) as mock_llm:
        mock_rag.return_value = []
        mock_llm.return_value = "Compliance review"
        
        with patch('app.services.compliance_service.ComplianceService.check_agent_compliance', new_callable=AsyncMock) as mock_compliance:
            mock_compliance.return_value = {"compliance_score": 75, "gaps": [], "recommendations": []}
            
            result = await agent._compliance_review(input_data)
            
            assert result["agent_id"] == str(sample_agent_for_compliance.id)
            assert len(result["frameworks_reviewed"]) > 0

