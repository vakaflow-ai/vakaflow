"""
Webhook models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class WebhookStatus(str, enum.Enum):
    """Webhook status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class WebhookEvent(str, enum.Enum):
    """Webhook event types"""
    AGENT_CREATED = "agent.created"
    AGENT_UPDATED = "agent.updated"
    AGENT_APPROVED = "agent.approved"
    AGENT_REJECTED = "agent.rejected"
    REVIEW_CREATED = "review.created"
    REVIEW_COMPLETED = "review.completed"
    APPROVAL_STARTED = "approval.started"
    APPROVAL_COMPLETED = "approval.completed"
    COMPLIANCE_CHECK_COMPLETED = "compliance.check_completed"
    OFFBOARDING_STARTED = "offboarding.started"
    OFFBOARDING_COMPLETED = "offboarding.completed"


class Webhook(Base):
    """Webhook configuration"""
    __tablename__ = "webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # null = platform-wide
    
    # Webhook details
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    secret = Column(String(255), nullable=True)  # For HMAC signature verification
    events = Column(JSON, nullable=False)  # List of event types to subscribe to
    status = Column(String(50), nullable=False, default=WebhookStatus.INACTIVE.value, index=True)
    
    # Configuration
    headers = Column(JSON, nullable=True)  # Custom headers to include
    timeout = Column(Integer, default=30)  # Request timeout in seconds
    
    # Statistics
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    
    # Metadata
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class WebhookDelivery(Base):
    """Webhook delivery log"""
    __tablename__ = "webhook_deliveries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Delivery details
    event_type = Column(String(100), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    
    # Response
    status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timing
    attempted_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)  # Duration in milliseconds
    
    # Relationships
    # webhook = relationship("Webhook", back_populates="deliveries")

