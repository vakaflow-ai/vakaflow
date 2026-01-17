"""
Incident Configuration model - Rules for automatic incident creation
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class IncidentTriggerType(str, enum.Enum):
    """Incident trigger type"""
    CVE_DETECTED = "cve_detected"
    QUALIFICATION_FAILED = "qualification_failed"
    RISK_THRESHOLD_EXCEEDED = "risk_threshold_exceeded"
    COMPLIANCE_GAP_DETECTED = "compliance_gap_detected"


class IncidentConfig(Base):
    """Incident creation rules and field mapping configuration"""
    __tablename__ = "incident_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Configuration name
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Trigger configuration
    trigger_type = Column(String(50), nullable=False)  # IncidentTriggerType
    trigger_conditions = Column(JSON, nullable=True)  # Conditions for triggering
    # Example: {"risk_score_threshold": 70, "severity_levels": ["high", "critical"]}
    
    # Entity filters
    entity_types = Column(JSON, nullable=True)  # ["agent", "product", "service", "vendor"]
    entity_categories = Column(JSON, nullable=True)  # Filter by categories
    
    # External system configuration
    external_system = Column(String(50), nullable=False)  # servicenow, jira
    auto_push = Column(Boolean, default=True)  # Automatically push when incident created
    
    # Field mapping configuration
    field_mapping = Column(JSON, nullable=True)  # Map VAKA fields to external system fields
    # Example for ServiceNow:
    # {
    #   "short_description": "{{incident.title}}",
    #   "description": "{{incident.description}}\nEntity: {{entity.type}} ({{entity.id}})",
    #   "urgency": "{{incident.severity}}",
    #   "category": "{{incident.incident_type}}"
    # }
    # Example for Jira:
    # {
    #   "summary": "{{incident.title}}",
    #   "description": "{{incident.description}}",
    #   "priority": "{{incident.severity}}",
    #   "project": {"key": "VAKA"},
    #   "issuetype": {"name": "Bug"}
    # }
    
    # Severity mapping
    severity_mapping = Column(JSON, nullable=True)  # Map VAKA severity to external system
    # Example: {"critical": "1", "high": "2", "medium": "3", "low": "4"}
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    
    # Priority (lower number = higher priority, first matching config is used)
    priority = Column(Integer, default=100)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # creator = relationship("User", foreign_keys=[created_by])
