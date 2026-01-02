"""
Audit trail models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class AuditAction(str, enum.Enum):
    """Audit action types"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    REVIEW = "review"
    UPLOAD = "upload"
    DOWNLOAD = "download"
    LOGIN = "login"
    LOGOUT = "logout"
    POLICY_UPDATE = "policy_update"
    TENANT_UPDATE = "tenant_update"
    FEATURE_UPDATE = "feature_update"
    # Workflow actions
    WORKFLOW_APPROVED = "workflow_approved"
    WORKFLOW_REJECTED = "workflow_rejected"
    WORKFLOW_FORWARDED = "workflow_forwarded"
    WORKFLOW_COMMENT = "workflow_comment"
    WORKFLOW_REVISION_REQUESTED = "workflow_revision_requested"
    WORKFLOW_ESCALATED = "workflow_escalated"


class AuditLog(Base):
    """Audit log model"""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)  # agent, review, policy, etc.
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    details = Column(JSON, nullable=True)  # Additional details
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    # user = relationship("User", back_populates="audit_logs")

