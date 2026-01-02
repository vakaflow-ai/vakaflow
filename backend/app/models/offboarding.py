"""
Offboarding models
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class OffboardingReason(str, enum.Enum):
    """Offboarding reason"""
    CONTRACT_END = "contract_end"
    SECURITY_INCIDENT = "security_incident"
    REPLACEMENT = "replacement"
    DEPRECATED = "deprecated"
    OTHER = "other"


class OffboardingStatus(str, enum.Enum):
    """Offboarding status"""
    INITIATED = "initiated"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class OffboardingRequest(Base):
    """Offboarding request model"""
    __tablename__ = "offboarding_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Request details
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(String(100), nullable=False)  # CONTRACT_END, SECURITY_INCIDENT, REPLACEMENT, OTHER
    reason_details = Column(Text, nullable=True)
    target_date = Column(Date, nullable=True)
    
    # Replacement
    replacement_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    
    # Status
    status = Column(String(50), nullable=False, default=OffboardingStatus.INITIATED.value, index=True)
    
    # Analysis
    impact_analysis = Column(JSON, nullable=True)  # Impact analysis results
    dependency_mapping = Column(JSON, nullable=True)  # Dependencies identified
    knowledge_extracted = Column(JSON, nullable=True)  # Extracted knowledge
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    # agent = relationship("Agent", foreign_keys=[agent_id])
    # replacement_agent = relationship("Agent", foreign_keys=[replacement_agent_id])
    # requester = relationship("User", foreign_keys=[requested_by])


class KnowledgeExtraction(Base):
    """Knowledge extraction during offboarding"""
    __tablename__ = "knowledge_extractions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    offboarding_request_id = Column(UUID(as_uuid=True), ForeignKey("offboarding_requests.id"), nullable=False, index=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    
    # Extraction details
    extraction_type = Column(String(100), nullable=False)  # documentation, integration, operational, etc.
    content = Column(Text, nullable=False)
    extraction_metadata = Column(JSON, nullable=True)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    rag_context = Column(JSON, nullable=True)  # RAG retrieval context
    
    # Source
    source_type = Column(String(100), nullable=True)  # artifact, review, compliance_check, etc.
    source_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Metadata
    extracted_at = Column(DateTime, default=datetime.utcnow)
    extracted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    # offboarding_request = relationship("OffboardingRequest", back_populates="knowledge_extractions")

