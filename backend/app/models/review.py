"""
Review models
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class ReviewStatus(str, enum.Enum):
    """Review status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVISION = "needs_revision"


class ReviewStage(Base):
    """Review stage definition"""
    __tablename__ = "review_stages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)  # PRE_REVIEW, SECURITY_REVIEW, etc.
    order_index = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, default=True)
    auto_assign = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Review(Base):
    """Review model"""
    __tablename__ = "reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    stage = Column(String(100), nullable=False, index=True)  # security, compliance, technical, business
    status = Column(String(50), nullable=False, default=ReviewStatus.PENDING.value)
    
    # Review content
    comment = Column(Text, nullable=True)
    findings = Column(JSON, nullable=True)  # List of findings/issues
    recommendations = Column(JSON, nullable=True)  # List of recommendations
    
    # Metadata
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # agent = relationship("Agent", back_populates="reviews")
    # reviewer = relationship("User", back_populates="reviews")

