"""
Integration configuration UI endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.integration import Integration, IntegrationType
from app.api.v1.auth import get_current_user
from app.services.integration_service import IntegrationService

router = APIRouter(prefix="/integration-config", tags=["integration-config"])


class ServiceNowConfig(BaseModel):
    """ServiceNow configuration"""
    instance_url: str = Field(..., description="ServiceNow instance URL")
    username: str = Field(..., description="ServiceNow username")
    password: str = Field(..., description="ServiceNow password")
    table: str = Field(default="incident", description="Table name for tickets")
    workflow_mapping: Optional[Dict[str, str]] = None


class JiraConfig(BaseModel):
    """Jira configuration"""
    base_url: str = Field(..., description="Jira base URL")
    email: str = Field(..., description="Jira account email")
    api_token: str = Field(..., description="Jira API token")
    project_key: str = Field(..., description="Jira project key")
    issue_type: str = Field(default="Task", description="Issue type")


class SlackConfig(BaseModel):
    """Slack configuration"""
    bot_token: str = Field(..., description="Slack bot token")
    default_channel: Optional[str] = Field(None, description="Default channel for notifications")


class TeamsConfig(BaseModel):
    """Teams configuration"""
    webhook_url: str = Field(..., description="Teams webhook URL")


class SSOConfig(BaseModel):
    """SSO configuration"""
    type: str = Field(..., pattern="^(saml|oidc)$", description="SSO type")
    saml_settings: Optional[Dict[str, Any]] = None
    oidc: Optional[Dict[str, Any]] = None
    attribute_mapping: Optional[Dict[str, str]] = None


@router.post("/servicenow/{integration_id}")
async def configure_servicenow(
    integration_id: UUID,
    config: ServiceNowConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure ServiceNow integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can configure integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Update config
    integration.config = {
        "instance_url": config.instance_url,
        "username": config.username,
        "password": config.password,
        "table": config.table,
        "workflow_mapping": config.workflow_mapping or {}
    }
    
    # Test connection
    try:
        result = await IntegrationService.test_integration(db, str(integration_id))
        if result:
            integration.health_status = "healthy"
        else:
            integration.health_status = "error"
    except Exception as e:
        integration.health_status = "error"
        integration.last_error = str(e)
    
    db.commit()
    
    return {"status": "configured", "health": integration.health_status}


@router.post("/jira/{integration_id}")
async def configure_jira(
    integration_id: UUID,
    config: JiraConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure Jira integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can configure integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    # Update config
    integration.config = {
        "base_url": config.base_url,
        "email": config.email,
        "api_token": config.api_token,
        "project_key": config.project_key,
        "issue_type": config.issue_type
    }
    
    # Test connection
    try:
        result = await IntegrationService.test_integration(db, str(integration_id))
        if result:
            integration.health_status = "healthy"
        else:
            integration.health_status = "error"
    except Exception as e:
        integration.health_status = "error"
        integration.last_error = str(e)
    
    db.commit()
    
    return {"status": "configured", "health": integration.health_status}


@router.post("/slack/{integration_id}")
async def configure_slack(
    integration_id: UUID,
    config: SlackConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure Slack integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can configure integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    integration.config = {
        "bot_token": config.bot_token,
        "default_channel": config.default_channel
    }
    
    # Test connection
    try:
        result = await IntegrationService.test_integration(db, str(integration_id))
        if result:
            integration.health_status = "healthy"
        else:
            integration.health_status = "error"
    except Exception as e:
        integration.health_status = "error"
        integration.last_error = str(e)
    
    db.commit()
    
    return {"status": "configured", "health": integration.health_status}


@router.post("/teams/{integration_id}")
async def configure_teams(
    integration_id: UUID,
    config: TeamsConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure Teams integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can configure integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    integration.config = {
        "webhook_url": config.webhook_url
    }
    
    # Test connection
    try:
        result = await IntegrationService.test_integration(db, str(integration_id))
        if result:
            integration.health_status = "healthy"
        else:
            integration.health_status = "error"
    except Exception as e:
        integration.health_status = "error"
        integration.last_error = str(e)
    
    db.commit()
    
    return {"status": "configured", "health": integration.health_status}


@router.post("/sso/{integration_id}")
async def configure_sso(
    integration_id: UUID,
    config: SSOConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure SSO integration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can configure integrations"
        )
    
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found"
        )
    
    integration.config = {
        "type": config.type,
        "saml_settings": config.saml_settings or {},
        "oidc": config.oidc or {},
        "attribute_mapping": config.attribute_mapping or {}
    }
    
    db.commit()
    
    return {"status": "configured"}

