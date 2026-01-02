"""
Agent management tests
"""
import pytest
from fastapi import status
import uuid


def test_create_agent(client, test_user, db):
    """Test agent creation"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpassword123"
        }
    )
    token = login_response.json()["access_token"]
    
    # Create vendor first
    from app.models.vendor import Vendor
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Test Vendor",
        email="vendor@example.com"
    )
    db.add(vendor)
    db.commit()
    
    # Create agent
    response = client.post(
        "/api/v1/agents",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "vendor_id": str(vendor.id),
            "name": "Test Agent",
            "type": "ai_bot",
            "category": "customer_service",
            "version": "1.0.0",
            "description": "Test agent description"
        }
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Test Agent"
    assert "id" in data


def test_list_agents(client, test_user):
    """Test listing agents"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpassword123"
        }
    )
    token = login_response.json()["access_token"]
    
    # List agents
    response = client.get(
        "/api/v1/agents",
        headers={"Authorization": f"Bearer {token}"},
        params={"page": 1, "limit": 20}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "items" in data or isinstance(data, list)

