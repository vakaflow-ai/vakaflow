"""
Integration models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class IntegrationType(str, enum.Enum):
    """Integration type"""
    SSO = "sso"
    SERVICENOW = "servicenow"
    JIRA = "jira"
    SLACK = "slack"
    TEAMS = "teams"
    COMPLIANCE_TOOL = "compliance_tool"
    SECURITY_TOOL = "security_tool"
    WEBHOOK = "webhook"
    SMTP = "smtp"


class IntegrationStatus(str, enum.Enum):
    """Integration status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    CONFIGURING = "configuring"


class Integration(Base):
    """Integration configuration"""
    __tablename__ = "integrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # null = platform-wide
    
    # Integration details
    name = Column(String(255), nullable=False)
    integration_type = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default=IntegrationStatus.INACTIVE.value, index=True)
    
    # Configuration (encrypted in production)
    config = Column(JSON, nullable=False)  # API keys, endpoints, etc.
    
    # Health tracking
    last_sync_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    error_count = Column(Integer, default=0)
    health_status = Column(String(50), nullable=True)  # healthy, warning, error
    
    # Metadata
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class IntegrationEvent(Base):
    """Integration event log"""
    __tablename__ = "integration_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)  # sync, error, webhook, etc.
    resource_type = Column(String(100), nullable=True)  # agent, review, etc.
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Event data
    request_data = Column(JSON, nullable=True)
    response_data = Column(JSON, nullable=True)
    status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Metadata
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    # integration = relationship("Integration", back_populates="events")

