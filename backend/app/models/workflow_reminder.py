"""
Workflow Reminder Model
Stores scheduled reminders for workflow stages
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class WorkflowReminder(Base):
    """Scheduled reminders for workflow stages"""
    __tablename__ = "workflow_reminders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Entity reference
    entity_type = Column(String(100), nullable=False, index=True)  # e.g., "agent", "vendor", "assessment"
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Entity ID
    request_type = Column(String(100), nullable=False)  # e.g., "agent_onboarding_workflow"
    workflow_stage = Column(String(100), nullable=False, index=True)  # e.g., "pending_approval"
    
    # Reminder details
    reminder_days = Column(Integer, nullable=False)  # Days after stage entry
    reminder_date = Column(DateTime, nullable=False, index=True)  # When to send reminder
    recipients = Column(JSON, nullable=False)  # Array of recipient configs: ["user", "next_approver", etc.]
    
    # Status
    is_sent = Column(Boolean, default=False, nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)
    send_attempts = Column(Integer, default=0, nullable=False)  # Track retry attempts
    last_error = Column(Text, nullable=True)  # Last error message if send failed
    
    # Metadata
    scheduled_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_workflow_reminder_date_sent', 'reminder_date', 'is_sent'),
        Index('idx_workflow_reminder_entity', 'entity_type', 'entity_id', 'workflow_stage'),
        {'comment': 'Scheduled reminders for workflow stages'}
    )

