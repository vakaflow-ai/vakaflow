"""
Approval workflow models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class ApprovalStatus(str, enum.Enum):
    """Approval status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalWorkflow(Base):
    """Approval workflow definition"""
    __tablename__ = "approval_workflows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Workflow configuration
    agent_type = Column(String(100), nullable=True)  # Filter by agent type
    risk_level = Column(String(50), nullable=True)  # Filter by risk level
    workflow_config = Column(JSON, nullable=False)  # JSON workflow definition
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApprovalInstance(Base):
    """Approval instance for an agent"""
    __tablename__ = "approval_instances"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("approval_workflows.id"), nullable=True)
    
    # Status tracking
    current_step = Column(Integer, default=0)
    status = Column(String(50), nullable=False, default=ApprovalStatus.PENDING.value, index=True)
    
    # Approval details
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApprovalStep(Base):
    """Individual step in approval workflow"""
    __tablename__ = "approval_steps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instance_id = Column(UUID(as_uuid=True), ForeignKey("approval_instances.id"), nullable=False, index=True)
    
    # Step details
    step_number = Column(Integer, nullable=False)
    step_type = Column(String(50), nullable=False)  # approval, notification (review removed - everything is approval now)
    step_name = Column(String(255), nullable=True)
    
    # Assignment
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    assigned_role = Column(String(50), nullable=True)  # Fallback to role if user not assigned
    
    # Status
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, in_progress, completed, skipped
    
    # Completion details
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

