"""
Workflow stage action and audit models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class WorkflowActionType(str, enum.Enum):
    """Workflow action types"""
    APPROVE = "approve"
    REJECT = "reject"
    FORWARD = "forward"
    COMMENT = "comment"
    REQUEST_REVISION = "request_revision"
    ESCALATE = "escalate"


class WorkflowStageAction(Base):
    """Workflow stage actions (approve, reject, forward, comments)"""
    __tablename__ = "workflow_stage_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    onboarding_request_id = Column(UUID(as_uuid=True), ForeignKey("onboarding_requests.id"), nullable=False, index=True)
    workflow_config_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configurations.id"), nullable=True, index=True)
    step_number = Column(Integer, nullable=False, index=True)
    
    # Action details
    action_type = Column(SQLEnum(WorkflowActionType), nullable=False, index=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    performed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Action data
    comments = Column(Text, nullable=True)
    forwarded_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # For forward action
    reason = Column(Text, nullable=True)  # For reject/revision requests
    
    # Additional metadata
    action_metadata = Column(JSON, nullable=True)  # Additional action data (renamed from 'metadata' to avoid SQLAlchemy conflict)
    
    # Relationships
    # onboarding_request = relationship("OnboardingRequest", foreign_keys=[onboarding_request_id])
    # performer = relationship("User", foreign_keys=[performed_by])
    # forwarded_user = relationship("User", foreign_keys=[forwarded_to])


class WorkflowAuditTrail(Base):
    """Comprehensive audit trail for workflow actions"""
    __tablename__ = "workflow_audit_trails"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    onboarding_request_id = Column(UUID(as_uuid=True), ForeignKey("onboarding_requests.id"), nullable=False, index=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True, index=True)
    
    # User and action
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)  # approve, reject, forward, comment, etc.
    
    # Stage information
    workflow_config_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configurations.id"), nullable=True)
    step_number = Column(Integer, nullable=True)
    step_name = Column(String(255), nullable=True)
    
    # Action details
    action_details = Column(JSON, nullable=True)  # Full action details
    comments = Column(Text, nullable=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    
    # Metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    # user = relationship("User", foreign_keys=[user_id])
    # onboarding_request = relationship("OnboardingRequest", foreign_keys=[onboarding_request_id])
