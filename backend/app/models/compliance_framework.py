"""
Compliance Framework models - structured frameworks with rules and risks
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class FrameworkStatus(str, enum.Enum):
    """Framework status"""
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    DRAFT = "draft"


class ComplianceFramework(Base):
    """Compliance Framework - e.g., NERC CIP, HIPAA, GDPR"""
    __tablename__ = "compliance_frameworks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)  # null = platform-wide
    
    # Framework details
    name = Column(String(255), nullable=False, unique=True)  # e.g., "NERC CIP", "HIPAA", "GDPR"
    code = Column(String(100), nullable=False, unique=True)  # e.g., "NERC_CIP", "HIPAA", "GDPR"
    description = Column(Text, nullable=True)
    region = Column(String(100), nullable=True)  # e.g., "US", "EU", "Global"
    category = Column(String(100), nullable=True)  # e.g., "energy", "healthcare", "data_privacy"
    version = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default=FrameworkStatus.ACTIVE.value)
    
    # Industry applicability: Which industries this framework applies to
    # JSON array: ["healthcare", "finance"] or ["all"] for all industries
    # If null or empty, applies to all industries (backward compatibility)
    applicable_industries = Column(JSON, nullable=True)  # Array of industries or ["all"]
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FrameworkRisk(Base):
    """Risks associated with a compliance framework"""
    __tablename__ = "framework_risks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    framework_id = Column(UUID(as_uuid=True), ForeignKey("compliance_frameworks.id"), nullable=False, index=True)
    
    # Risk details
    name = Column(String(255), nullable=False)  # Risk name
    code = Column(String(100), nullable=False)  # Risk code
    description = Column(Text, nullable=True)
    severity = Column(String(50), nullable=False)  # "low", "medium", "high", "critical"
    category = Column(String(100), nullable=True)  # e.g., "security", "privacy", "operational"
    
    # Metadata
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FrameworkRule(Base):
    """Rules in the rule library with attribute-based conditions"""
    __tablename__ = "framework_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    framework_id = Column(UUID(as_uuid=True), ForeignKey("compliance_frameworks.id"), nullable=False, index=True)
    risk_id = Column(UUID(as_uuid=True), ForeignKey("framework_risks.id"), nullable=True, index=True)
    
    # Rule details
    name = Column(String(255), nullable=False)  # Rule name
    code = Column(String(100), nullable=False)  # Rule code
    description = Column(Text, nullable=True)
    
    # Attribute-based conditions - determines when this rule applies
    # Example: {"agent_category": ["healthcare", "financial"], "data_types": ["PHI", "PII"], "regions": ["US"]}
    conditions = Column(JSON, nullable=True)  # Attribute-based matching conditions
    
    # Requirement details
    requirement_text = Column(Text, nullable=False)  # The actual requirement text
    requirement_code = Column(String(100), nullable=True)  # Requirement code/ID
    
    # Parent requirement (for hierarchical requirements)
    parent_rule_id = Column(UUID(as_uuid=True), ForeignKey("framework_rules.id"), nullable=True, index=True)
    
    # Metadata
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentFrameworkLink(Base):
    """Links agents to compliance frameworks"""
    __tablename__ = "agent_framework_links"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    framework_id = Column(UUID(as_uuid=True), ForeignKey("compliance_frameworks.id"), nullable=False, index=True)
    
    # Link metadata
    is_required = Column(Boolean, default=True)  # Is this framework required for this agent?
    linked_at = Column(DateTime, default=datetime.utcnow)
    linked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    


class RequirementResponse(Base):
    """Vendor responses to framework requirements"""
    __tablename__ = "requirement_responses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("framework_rules.id"), nullable=False, index=True)
    
    # Response details
    response_text = Column(Text, nullable=True)  # Vendor's response to the requirement
    evidence = Column(JSON, nullable=True)  # Evidence/documentation (file paths, links, etc.)
    compliance_status = Column(String(50), nullable=True)  # "compliant", "non_compliant", "partial", "not_applicable"
    
    # Metadata
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    

