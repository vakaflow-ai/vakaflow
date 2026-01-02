"""
Adoption tracking models
"""
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Boolean, JSON, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class AdoptionStatus(str, enum.Enum):
    """Adoption status"""
    NOT_STARTED = "not_started"
    EVALUATING = "evaluating"
    PILOT = "pilot"
    DEPLOYED = "deployed"
    WIDESPREAD = "widespread"
    DEPRECATED = "deprecated"


class AdoptionMetric(Base):
    """Adoption metrics for agents"""
    __tablename__ = "adoption_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Adoption status
    status = Column(String(50), nullable=False, default=AdoptionStatus.NOT_STARTED.value, index=True)
    
    # Metrics
    user_count = Column(Integer, default=0)  # Number of users using the agent
    usage_count = Column(Integer, default=0)  # Total usage count
    last_used_at = Column(DateTime, nullable=True)
    
    # Business metrics
    roi = Column(Numeric(10, 2), nullable=True)  # Return on investment
    cost_savings = Column(Numeric(10, 2), nullable=True)  # Cost savings
    efficiency_gain = Column(Numeric(5, 2), nullable=True)  # Efficiency gain percentage
    
    # Feedback
    user_satisfaction = Column(Numeric(3, 2), nullable=True)  # 0.00-1.00
    feedback_count = Column(Integer, default=0)
    
    # Metadata
    deployed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # agent = relationship("Agent", back_populates="adoption_metrics")


class AdoptionEvent(Base):
    """Adoption events tracking"""
    __tablename__ = "adoption_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)  # deployed, used, feedback, etc.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Event data
    event_metadata = Column(JSON, nullable=True)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    
    # Timestamp
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    # agent = relationship("Agent", back_populates="adoption_events")
    # user = relationship("User", foreign_keys=[user_id])

