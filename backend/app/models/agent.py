"""
Agent models
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON, UniqueConstraint, Boolean
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
    tenant_id: Optional[uuid.UUID] = Column(UUID(as_uuid=True), nullable=True, index=True)  # type: ignore
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Governance and Identity fields
    service_account: Optional[str] = Column(String(255), nullable=True)  # type: ignore  # Service account used by agent
    department: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # Department owning the agent
    organization: Optional[str] = Column(String(255), nullable=True)  # type: ignore  # Organization/unit using the agent
    kill_switch_enabled: bool = Column(Boolean, default=False, nullable=False)  # type: ignore  # Emergency disable capability
    last_governance_review: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore  # Last compliance review date
    governance_owner_id: Optional[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # type: ignore  # User responsible for governance
    
    # Ecosystem relationships
    skills: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # List of skills this agent possesses (replaces use_cases)
    related_product_ids: Optional[List[uuid.UUID]] = Column(JSON, nullable=True)  # type: ignore  # Related products this agent integrates with
    related_service_ids: Optional[List[uuid.UUID]] = Column(JSON, nullable=True)  # type: ignore  # Related services this agent depends on
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="agents")
    # metadata = relationship("AgentMetadata", back_populates="agent", uselist=False)
    # artifacts = relationship("AgentArtifact", back_populates="agent")


class AgentMetadata(Base):
    """Agent metadata model with comprehensive governance and compliance fields"""
    __tablename__ = "agent_metadata"
    
    # Prevent SQLAlchemy from using 'metadata' attribute
    __mapper_args__ = {"confirm_deleted_rows": False}
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    agent_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)  # type: ignore
    
    # === CORE FUNCTIONALITY ===
    capabilities: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Core agent capabilities
    skills: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Specific skills the agent can perform
    features: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Detailed features offered
    
    # === DATA HANDLING ===
    data_types: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Types of data processed
    data_classification_levels: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Confidentiality levels (public, internal, confidential, restricted)
    data_retention_period: Optional[str] = Column(String(50), nullable=True)  # type: ignore  # How long data is retained
    
    # === GEOGRAPHIC SCOPE ===
    regions: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Geographic regions of operation
    jurisdictions: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Legal jurisdictions
    
    # === INTEGRATIONS & DEPENDENCIES ===
    integrations: Optional[List[Dict[str, Any]]] = Column(JSON, nullable=True)  # type: ignore  # Connected systems
    dependencies: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Software/hardware dependencies
    related_product_ids: Optional[List[uuid.UUID]] = Column(JSON, nullable=True)  # type: ignore  # Related products this agent integrates with
    related_service_ids: Optional[List[uuid.UUID]] = Column(JSON, nullable=True)  # type: ignore  # Related services this agent depends on
    
    # === TECHNICAL ARCHITECTURE ===
    architecture_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Technical architecture details
    deployment_type: Optional[str] = Column(String(50), nullable=True)  # type: ignore  # cloud, on_premise, hybrid
    hosting_provider: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # Cloud provider or hosting solution
    
    # === AI/ML SPECIFICS ===
    ai_ml_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # AI/ML framework and models used
    llm_vendor: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # e.g., OpenAI, Anthropic, Google
    llm_model: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # e.g., GPT-4, Claude-3, Gemini-Pro
    training_data_source: Optional[str] = Column(Text, nullable=True)  # type: ignore  # Source of training data
    
    # === SECURITY & COMPLIANCE ===
    security_controls: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Implemented security measures
    compliance_standards: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # e.g., SOC2, ISO27001, GDPR, HIPAA
    certification_status: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Certification details and dates
    incident_response_plan: Optional[bool] = Column(Boolean, nullable=True)  # type: ignore  # Has incident response procedures
    audit_trail_enabled: Optional[bool] = Column(Boolean, nullable=True)  # type: ignore  # Maintains activity logs
    
    # === DATA PRIVACY ===
    data_sharing_scope: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # What data is shared externally
    data_usage_purpose: Optional[str] = Column(Text, nullable=True)  # type: ignore  # Purpose of data processing
    privacy_policy_url: Optional[str] = Column(String(500), nullable=True)  # type: ignore  # Link to privacy policy
    data_protection_officer: Optional[str] = Column(String(255), nullable=True)  # type: ignore  # DPO contact
    
    # === VERSION & CHANGE MANAGEMENT ===
    version_info: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Release notes, changelog, etc.
    change_log: Optional[List[Dict[str, Any]]] = Column(JSON, nullable=True)  # type: ignore  # History of changes
    rollback_procedures: Optional[str] = Column(Text, nullable=True)  # type: ignore  # How to rollback changes
    
    # === BUSINESS CONTEXT ===
    business_purpose: Optional[str] = Column(Text, nullable=True)  # type: ignore  # Primary business purpose
    target_audience: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Intended user groups
    competitive_advantage: Optional[str] = Column(Text, nullable=True)  # type: ignore  # What makes this agent unique
    
    # === MONITORING & GOVERNANCE ===
    monitoring_tools: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Tools used for monitoring
    governance_framework: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # Governance approach
    service_level_agreements: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # SLA commitments
    
    # === DOCUMENTATION & ARTIFACTS ===
    documentation_urls: Optional[Dict[str, str]] = Column(JSON, nullable=True)  # type: ignore  # Links to docs, diagrams, specs
    architecture_diagrams: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Architecture diagram URLs/paths
    landscape_diagrams: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # System landscape diagrams
    
    # === LEGACY FIELDS (deprecated but kept for backward compatibility) ===
    use_cases: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Legacy field - use skills instead
    personas: Optional[List[Dict[str, Any]]] = Column(JSON, nullable=True)  # type: ignore  # Legacy field - use target_audience instead
    extra_data: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Legacy field for unstructured data
    
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


class AgentProduct(Base):
    """Many-to-many relationship: Agent can be tagged/categorized under Product"""
    __tablename__ = "agent_products"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    agent_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)  # type: ignore
    product_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)  # type: ignore
    relationship_type: Optional[str] = Column(String(50), nullable=True)  # type: ignore  # component, integration, dependency
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    
    # Unique constraint
    __table_args__ = (UniqueConstraint('agent_id', 'product_id', name='uq_agent_product'),)
