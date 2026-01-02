"""
Attribute-level rules for automatically adding questions/requirements to assessments
Rules match based on assessment attributes (type, industry, vendor category, risk type, etc.)
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class RuleType(str, enum.Enum):
    """Type of rule"""
    QUESTION_GROUP = "question_group"  # Adds a group of questions
    REQUIREMENT_GROUP = "requirement_group"  # Adds a group of requirements
    AUTO_ADD = "auto_add"  # Automatically adds questions/requirements based on conditions


class AssessmentRule(Base):
    """Attribute-level rules for auto-adding questions/requirements to assessments"""
    __tablename__ = "assessment_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Rule Configuration
    name = Column(String(255), nullable=False)  # Rule name
    description = Column(Text, nullable=True)  # Rule description
    rule_type = Column(String(50), nullable=False)  # RuleType
    
    # Matching Conditions (JSON structure)
    # Example: {
    #   "assessment_type": ["tprm", "risk_assessment"],
    #   "industry": ["healthcare", "finance"],
    #   "vendor_category": ["Security & Compliance"],
    #   "risk_type": ["SOD_risk", "post_breach"],
    #   "vendor_attributes": {"category": ["Security"]},
    #   "agent_attributes": {"risk_level": ["high"]}
    # }
    match_conditions = Column(JSON, nullable=False)  # Conditions that must match for rule to apply
    
    # Action: What to add
    # For QUESTION_GROUP: Array of question library IDs
    # For REQUIREMENT_GROUP: Array of requirement IDs
    # For AUTO_ADD: Mixed array of question/requirement IDs
    question_ids = Column(JSON, nullable=True)  # Array of question library IDs to add
    requirement_ids = Column(JSON, nullable=True)  # Array of requirement IDs to add
    
    # Rule Priority (lower number = higher priority)
    priority = Column(Integer, default=100)  # Default priority
    
    # Rule Status
    is_active = Column(Boolean, default=True)
    is_automatic = Column(Boolean, default=True)  # If true, automatically applies; if false, suggests to user
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
