"""
Incident Report model for pushing incidents to third-party systems
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class IncidentType(str, enum.Enum):
    """Incident type"""
    CVE_TRACKING = "cve_tracking"  # CVE detected and matched to entity
    QUALIFICATION_FAILURE = "qualification_failure"  # Vendor/Product/Service qualification failed


class IncidentStatus(str, enum.Enum):
    """Incident status"""
    PENDING = "pending"  # Created but not yet pushed
    PUSHED = "pushed"  # Successfully pushed to external system
    FAILED = "failed"  # Failed to push to external system
    RESOLVED = "resolved"  # Incident resolved in external system


class IncidentReport(Base):
    """Incident report model - stores incidents before pushing to external systems"""
    __tablename__ = "incident_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Incident identification
    incident_type = Column(String(50), nullable=False)  # IncidentType
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(50), nullable=True)  # critical, high, medium, low
    
    # Linked entity (entity-agnostic)
    entity_type = Column(String(50), nullable=False, index=True)  # agent, product, service, vendor
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Related entities (for context)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True)
    related_entity_type = Column(String(50), nullable=True)  # Additional related entity type
    related_entity_id = Column(UUID(as_uuid=True), nullable=True)  # Additional related entity ID
    
    # Incident details (type-specific)
    incident_data = Column(JSON, nullable=True)  # Type-specific data
    # For CVE_TRACKING: {cve_id, cvss_score, affected_versions, remediation_notes}
    # For QUALIFICATION_FAILURE: {failure_reasons, compliance_gaps, risk_assessment, assessment_id}
    
    # External system integration
    external_system = Column(String(50), nullable=True)  # servicenow, jira
    external_ticket_id = Column(String(255), nullable=True, index=True)  # Ticket/incident ID in external system
    external_ticket_url = Column(Text, nullable=True)  # URL to external ticket
    push_status = Column(String(50), nullable=False, default=IncidentStatus.PENDING.value)  # IncidentStatus
    push_attempts = Column(Integer, default=0)  # Number of push attempts
    last_push_attempt = Column(DateTime, nullable=True)
    push_error = Column(Text, nullable=True)  # Error message if push failed
    
    # Status tracking
    status = Column(String(50), nullable=True)  # Status from external system (if synced)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # System or user who created
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # vendor = relationship("Vendor", foreign_keys=[vendor_id])
    # creator = relationship("User", foreign_keys=[created_by])
    # resolver = relationship("User", foreign_keys=[resolved_by])
