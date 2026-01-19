"""Test Agent Studio API endpoints"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_agent_studio_dashboard():
    """Test the Agent Studio dashboard endpoint"""
    response = client.get("/api/v1/agent-studio/dashboard")
    assert response.status_code == 200
    
    data = response.json()
    assert "compliance_metrics" in data
    assert "governance_alerts" in data
    assert "recent_activities" in data
    assert "entity_distribution" in data

def test_list_agents():
    """Test listing agents endpoint"""
    response = client.get("/api/v1/agent-studio/entities?type=agent")
    assert response.status_code == 200
    
    data = response.json()
    assert "entities" in data
    assert "total" in data

def test_list_products():
    """Test listing products endpoint"""
    response = client.get("/api/v1/agent-studio/entities?type=product")
    assert response.status_code == 200
    
    data = response.json()
    assert "entities" in data
    assert "total" in data

def test_list_services():
    """Test listing services endpoint"""
    response = client.get("/api/v1/agent-studio/entities?type=service")
    assert response.status_code == 200
    
    data = response.json()
    assert "entities" in data
    assert "total" in data

def test_get_compliance_summary():
    """Test compliance summary endpoint"""
    response = client.get("/api/v1/agent-studio/compliance-summary")
    assert response.status_code == 200
    
    data = response.json()
    assert "overall_compliance_score" in data
    assert "compliance_by_standard" in data
    assert "risk_distribution" in data

if __name__ == "__main__":
    pytest.main([__file__, "-v"])