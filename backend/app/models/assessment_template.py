"""
Pre-bundled Assessment Templates
Templates are industry-specific and can be instantiated for tenants
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class TemplateApplicability(str, enum.Enum):
    """Which industries this template applies to"""
    ALL = "all"  # Applies to all industries
    HEALTHCARE = "healthcare"
    FINANCE = "finance"
    TECHNOLOGY = "technology"
    MANUFACTURING = "manufacturing"
    RETAIL = "retail"
    EDUCATION = "education"
    GOVERNMENT = "government"
    ENERGY = "energy"
    TRANSPORTATION = "transportation"
    CONSULTING = "consulting"


class AssessmentTemplate(Base):
    """Pre-bundled assessment templates that can be instantiated for tenants"""
    __tablename__ = "assessment_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Template Information
    name = Column(String(255), nullable=False)  # Template name (e.g., "HIPAA Compliance Assessment")
    assessment_type = Column(String(50), nullable=False)  # AssessmentType (tprm, compliance_assessment, etc.)
    description = Column(Text, nullable=True)  # Template description
    
    # Applicability
    applicable_industries = Column(JSON, nullable=False)  # Array of industries: ["healthcare", "finance"] or ["all"]
    # If ["all"], applies to all industries
    
    # Template Questions (stored as JSON for easy instantiation)
    # Structure: [{"question_type": "requirement_reference", "requirement_id": "...", "order": 1, "is_required": true}, ...]
    # or [{"question_type": "new_question", "question_text": "...", "field_type": "...", "order": 1, "is_required": true}, ...]
    questions = Column(JSON, nullable=False)  # Array of question definitions
    
    # Default Settings
    default_schedule_frequency = Column(String(50), nullable=True)  # Default schedule frequency
    default_status = Column(String(50), nullable=False, default="draft")  # Default status when instantiated
    
    # Metadata
    is_active = Column(Boolean, default=True)  # Whether template is active
    created_by = Column(UUID(as_uuid=True), nullable=True)  # Platform admin who created
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
