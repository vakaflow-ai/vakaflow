"""
Policy and compliance models
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class PolicyCategory(str, enum.Enum):
    """Policy category"""
    SECURITY = "security"
    COMPLIANCE = "compliance"
    TECHNICAL = "technical"
    BUSINESS = "business"


class PolicyType(str, enum.Enum):
    """Policy type"""
    REGULATORY = "regulatory"
    INTERNAL = "internal"
    STANDARD = "standard"


class ComplianceCheckStatus(str, enum.Enum):
    """Compliance check status"""
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    N_A = "n_a"
    PENDING = "pending"


class Policy(Base):
    """Policy model"""
    __tablename__ = "policies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # null = platform-wide
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # SECURITY, COMPLIANCE, TECHNICAL, BUSINESS
    type = Column(String(100), nullable=False)  # REGULATORY, INTERNAL, STANDARD
    region = Column(String(100), nullable=True)  # GDPR (EU), CCPA (CA), etc.
    description = Column(Text, nullable=True)
    policy_document_path = Column(Text, nullable=True)  # Path to policy document
    version = Column(String(50), nullable=True)
    effective_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Policy rules/metadata
    rules = Column(JSON, nullable=True)  # Structured rules for automated checking
    requirements = Column(JSON, nullable=True)  # List of requirements
    # Enforcement controls - what controls are being enforced (e.g., encryption, access controls)
    enforcement_controls = Column(JSON, nullable=True)  # [{"control": "encryption", "type": "required", "description": "..."}]
    # Required attributes - what data must be gathered from agents
    required_attributes = Column(JSON, nullable=True)  # [{"attribute": "data_classification", "type": "string", "required": true}]
    # Qualification criteria - how agents are evaluated/qualified
    qualification_criteria = Column(JSON, nullable=True)  # {"pass_threshold": 0.8, "checks": [...]}
    # Applicability criteria - when this policy applies to an agent
    # Example: {"data_types": ["healthcare", "PHI"], "industries": ["healthcare"], "regions": ["US"], "data_classification": ["PHI", "PII"]}
    applicability_criteria = Column(JSON, nullable=True)  # Criteria that determine if policy applies to an agent


class ComplianceCheck(Base):
    """Compliance check result"""
    __tablename__ = "compliance_checks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("policies.id"), nullable=False, index=True)
    check_type = Column(String(50), nullable=False)  # AUTOMATED, MANUAL
    status = Column(String(50), nullable=False)  # PASS, FAIL, WARNING, N/A, PENDING
    details = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=True)  # Array of evidence references
    rag_context = Column(JSON, nullable=True)  # RAG retrieval context
    confidence_score = Column(Numeric(3, 2), nullable=True)  # 0.00-1.00
    checked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    
    # Relationships
    # agent = relationship("Agent", back_populates="compliance_checks")
    # policy = relationship("Policy", back_populates="compliance_checks")

