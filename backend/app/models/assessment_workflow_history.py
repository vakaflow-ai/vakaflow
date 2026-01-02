"""
Assessment Workflow History Model - Tracks complete workflow lifecycle
Tracks: approvals, send-backs, resubmissions, forwards, etc.
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class WorkflowActionType(str, enum.Enum):
    """Types of workflow actions"""
    SUBMITTED = "submitted"  # Assessment submitted by vendor
    APPROVED = "approved"  # Assessment approved
    DENIED = "denied"  # Assessment denied
    SENT_BACK = "sent_back"  # Sent back to vendor for more info/revision
    RESUBMITTED = "resubmitted"  # Vendor resubmitted after send-back
    FORWARDED = "forwarded"  # Forwarded to another user
    COMMENT_ADDED = "comment_added"  # Comment added
    STATUS_CHANGED = "status_changed"  # Status changed


class AssessmentWorkflowHistory(Base):
    """Complete workflow history for assessment assignments"""
    __tablename__ = "assessment_workflow_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assessment_assignments.id"), nullable=False, index=True)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Action details
    action_type = Column(String(50), nullable=False)  # WorkflowActionType
    action_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)  # Who performed the action
    action_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Action target (for forwards)
    forwarded_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # If forwarded, who it was forwarded to
    
    # Question-specific actions (for forwarding specific questions)
    question_ids = Column(JSON, nullable=True)  # Array of question IDs if action is question-specific
    
    # Comments and notes
    comments = Column(Text, nullable=True)  # Comments added with the action
    decision_comment = Column(Text, nullable=True)  # Decision-specific comment
    
    # Status tracking
    previous_status = Column(String(50), nullable=True)  # Previous assignment status
    new_status = Column(String(50), nullable=True)  # New assignment status
    
    # Metadata
    action_metadata = Column(JSON, nullable=True)  # Additional metadata
    workflow_ticket_id = Column(String(50), nullable=True)  # Ticket ID for reference
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    assignment = relationship("AssessmentAssignment", foreign_keys=[assignment_id])
    assessment = relationship("Assessment", foreign_keys=[assessment_id])
    action_by_user = relationship("User", foreign_keys=[action_by])
    forwarded_to_user = relationship("User", foreign_keys=[forwarded_to])

