"""
Ticket tracking models for agent submissions
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class TicketStatus(str, enum.Enum):
    """Ticket status"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class TicketStage(str, enum.Enum):
    """Ticket review stages"""
    SUBMITTED = "submitted"
    SECURITY_REVIEW = "security_review"
    COMPLIANCE_REVIEW = "compliance_review"
    TECHNICAL_REVIEW = "technical_review"
    BUSINESS_REVIEW = "business_review"
    APPROVAL = "approval"
    COMPLETED = "completed"


class Ticket(Base):
    """Ticket for tracking agent submissions"""
    __tablename__ = "tickets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Ticket details
    ticket_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g., TKT-2024-001
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Status and stage
    status = Column(String(50), nullable=False, default=TicketStatus.OPEN.value, index=True)
    current_stage = Column(String(50), nullable=False, default=TicketStage.SUBMITTED.value)
    
    # People
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # Current reviewer/approver
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Stage tracking
    stage_progress = Column(JSON, nullable=True)  # {stage: {status, completed_at, completed_by}}
    
    # Dates
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Metadata
    ticket_metadata = Column(JSON, nullable=True)  # Additional tracking data (renamed from 'metadata' to avoid SQLAlchemy conflict)
    
    # Relationships
    # agent = relationship("Agent", back_populates="ticket")
    # submitter = relationship("User", foreign_keys=[submitted_by])
    # assignee = relationship("User", foreign_keys=[assigned_to])


class TicketActivity(Base):
    """Activity log for tickets"""
    __tablename__ = "ticket_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Activity details
    activity_type = Column(String(50), nullable=False)  # stage_change, comment, status_change, assignment
    description = Column(Text, nullable=True)
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    
    # Metadata
    activity_metadata = Column(JSON, nullable=True)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    # ticket = relationship("Ticket", back_populates="activities")
    # user = relationship("User", foreign_keys=[user_id])

