"""
Agent models
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List
from app.core.database import Base
import enum


class AgentStatus(str, enum.Enum):
    """Agent status"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    OFFBOARDED = "offboarded"


class Agent(Base):
    """Agent model"""
    __tablename__ = "agents"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    vendor_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)  # type: ignore
    name: str = Column(String(255), nullable=False)  # type: ignore
    type: str = Column(String(100), nullable=False)  # type: ignore
    category: Optional[str] = Column(String(100), nullable=True)  # type: ignore
    subcategory: Optional[str] = Column(String(100), nullable=True)  # type: ignore
    description: Optional[str] = Column(Text, nullable=True)  # type: ignore
    version: str = Column(String(50), nullable=False)  # type: ignore
    status: str = Column(String(50), nullable=False, default=AgentStatus.DRAFT.value)  # type: ignore
    submission_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    approval_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    compliance_score: Optional[int] = Column(Integer, nullable=True)  # type: ignore
    risk_score: Optional[int] = Column(Integer, nullable=True)  # type: ignore
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="agents")
    # metadata = relationship("AgentMetadata", back_populates="agent", uselist=False)
    # artifacts = relationship("AgentArtifact", back_populates="agent")


class AgentMetadata(Base):
    """Agent metadata model"""
    __tablename__ = "agent_metadata"
    
    # Prevent SQLAlchemy from using 'metadata' attribute
    __mapper_args__ = {"confirm_deleted_rows": False}
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    agent_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)  # type: ignore
    capabilities: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore
    data_types: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore
    regions: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore
    integrations: Optional[List[Dict[str, Any]]] = Column(JSON, nullable=True)  # type: ignore
    dependencies: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore
    architecture_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore
    # New fields for enhanced agent information
    use_cases: Optional[List[str]] = Column(JSON, nullable=True)  # List of use cases  # type: ignore
    features: Optional[List[str]] = Column(JSON, nullable=True)  # List of features  # type: ignore
    personas: Optional[List[Dict[str, Any]]] = Column(JSON, nullable=True)  # List of target personas  # type: ignore
    version_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # Enhanced version information (release notes, changelog, etc.)  # type: ignore
    # AI/LLM information for risk assessment
    llm_vendor: Optional[str] = Column(String(100), nullable=True)  # e.g., OpenAI, Anthropic, Google, etc.  # type: ignore
    llm_model: Optional[str] = Column(String(100), nullable=True)  # e.g., GPT-4, Claude-3, Gemini-Pro, etc.  # type: ignore
    deployment_type: Optional[str] = Column(String(50), nullable=True)  # cloud, on_premise, hybrid  # type: ignore
    data_sharing_scope: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # Information about what data is shared with LLM  # type: ignore
    data_usage_purpose: Optional[str] = Column(Text, nullable=True)  # How the agent uses data with the LLM  # type: ignore
    extra_data: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # Additional unstructured data  # type: ignore
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Relationships
    # agent = relationship("Agent", back_populates="agent_metadata")


class AgentArtifact(Base):
    """Agent artifact model"""
    __tablename__ = "agent_artifacts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    artifact_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    extra_data = Column(JSON, nullable=True)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    # agent = relationship("Agent", back_populates="artifacts")
