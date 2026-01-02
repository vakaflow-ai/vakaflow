"""
Question Library model - Central repository for reusable questions
Questions can be used across multiple assessments and are organized by assessment type
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class QuestionCategory(str, enum.Enum):
    """Question categories"""
    SECURITY = "security"
    COMPLIANCE = "compliance"
    RISK_MANAGEMENT = "risk_management"
    DATA_PROTECTION = "data_protection"
    BUSINESS_CONTINUITY = "business_continuity"
    VENDOR_MANAGEMENT = "vendor_management"
    CUSTOM = "custom"


class QuestionLibrary(Base):
    """Central question library - reusable questions for assessments"""
    __tablename__ = "question_library"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Human-readable question ID (e.g., Q-SEC-01, Q-COM-02)
    question_id = Column(String(50), nullable=True, index=True, unique=False)  # Unique per tenant, not globally
    
    # Question Details
    title = Column(String(255), nullable=False)  # Question title
    question_text = Column(Text, nullable=False)  # Question text
    description = Column(Text, nullable=True)  # Question description
    assessment_type = Column(JSON, nullable=False)  # Array of assessment types this question belongs to (e.g., ["tprm", "vendor_qualification"])
    category = Column(String(100), nullable=True)  # QuestionCategory
    field_type = Column(String(50), nullable=False)  # Field type (text, textarea, select, etc.)
    response_type = Column(String(50), nullable=False)  # ResponseType: Text, File, Number, Date, etc.
    
    # Question Configuration
    is_required = Column(Boolean, default=False)
    options = Column(JSON, nullable=True)  # For select/radio/checkbox options
    validation_rules = Column(JSON, nullable=True)  # Min/max length, pattern, etc.
    
    # Requirement Mapping
    # Questions can satisfy requirements (compliance requirements/objectives)
    requirement_ids = Column(JSON, nullable=True)  # Array of requirement IDs this question satisfies
    compliance_framework_ids = Column(JSON, nullable=True)  # Array of framework IDs this question certifies
    
    # Industry Applicability
    applicable_industries = Column(JSON, nullable=True)  # Array of industries (e.g., ["healthcare", "finance", "all"])
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)  # How many assessments use this question
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # Questions can be referenced by assessment_questions via reusable_question_id
