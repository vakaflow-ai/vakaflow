"""
Action Item model - Unified action items for user inbox
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class ActionItemType(str, enum.Enum):
    """Types of action items"""
    APPROVAL = "approval"  # Approval step pending
    ASSESSMENT = "assessment"  # Assessment assignment to complete
    ONBOARDING_REVIEW = "onboarding_review"  # Onboarding request to review
    TPRM_QUESTIONNAIRE = "tprm_questionnaire"  # TPRM questionnaire to complete
    VENDOR_RESPONSE = "vendor_response"  # Vendor response required
    REVIEW = "review"  # Review task
    TICKET = "ticket"  # Ticket to respond to
    WORKFLOW_ACTION = "workflow_action"  # Workflow action required
    MESSAGE = "message"  # Unread message/comment requiring response
    COMMENT = "comment"  # Comment on resource requiring attention
    QUESTION = "question"  # Question requiring answer


class ActionItemStatus(str, enum.Enum):
    """Action item status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ActionItemPriority(str, enum.Enum):
    """Action item priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ActionItem(Base):
    """Unified action items for user inbox"""
    __tablename__ = "action_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Assignment
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Action details
    action_type = Column(SQLEnum(ActionItemType), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(SQLEnum(ActionItemPriority), default=ActionItemPriority.MEDIUM, index=True)
    
    # Status
    status = Column(SQLEnum(ActionItemStatus), nullable=False, default=ActionItemStatus.PENDING, index=True)
    
    # Due date
    due_date = Column(DateTime, nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Reference to source entity
    source_type = Column(String(50), nullable=False)  # "approval_step", "assessment_assignment", "onboarding_request", etc.
    source_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # ID of the source entity
    
    # Action URL and metadata
    action_url = Column(String(500), nullable=True)  # URL to take action
    item_metadata = Column(JSON, nullable=True)  # Additional context (e.g., agent_id, vendor_id, etc.)
    
    # Read/acknowledged status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # assigned_user = relationship("User", foreign_keys=[assigned_to])
    # assigner = relationship("User", foreign_keys=[assigned_by])
