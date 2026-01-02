"""
Security Incident models for CVE tracking and security monitoring
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, Boolean, JSON, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from enum import Enum
from app.core.database import Base


class IncidentType(str, Enum):
    """Security incident types"""
    CVE = "cve"
    DATA_BREACH = "data_breach"
    SECURITY_ALERT = "security_alert"
    VULNERABILITY = "vulnerability"


class IncidentSeverity(str, Enum):
    """Incident severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SecurityIncident(Base):
    """Security incident model - stores CVEs, breaches, and security alerts"""
    __tablename__ = "security_incidents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Multi-tenant support
    
    # Incident identification
    incident_type = Column(SQLEnum(IncidentType), nullable=False, index=True)
    external_id = Column(String(100), nullable=False, index=True)  # e.g., "CVE-2024-12345"
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Severity and scoring
    severity = Column(SQLEnum(IncidentSeverity), nullable=True, index=True)
    cvss_score = Column(Float, nullable=True)  # CVSS score (0.0-10.0)
    cvss_vector = Column(String(200), nullable=True)  # CVSS vector string
    
    # Affected products/vendors
    affected_products = Column(JSON, nullable=True)  # Array of product names
    affected_vendors = Column(JSON, nullable=True)  # Array of vendor names (from CVE data)
    
    # Source information
    source = Column(String(100), nullable=False)  # "NVD", "CVE.org", "HaveIBeenPwned", etc.
    source_url = Column(Text, nullable=True)
    published_date = Column(DateTime, nullable=True, index=True)
    
    # Additional metadata
    incident_metadata = Column(JSON, nullable=True)  # Additional CVE/incident data
    
    # Status
    status = Column(String(50), default="active", index=True)  # active, resolved, false_positive, ignored, cleared
    
    # User actions
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    ignored_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    ignored_at = Column(DateTime, nullable=True)
    cleared_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    cleared_at = Column(DateTime, nullable=True)
    action_notes = Column(Text, nullable=True)  # Notes for the last action taken
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    vendor_trackings = relationship("VendorSecurityTracking", back_populates="incident", cascade="all, delete-orphan")
    action_history = relationship("SecurityIncidentActionHistory", back_populates="incident", cascade="all, delete-orphan", order_by="desc(SecurityIncidentActionHistory.created_at)")
    acknowledger = relationship("User", foreign_keys=[acknowledged_by])
    ignorer = relationship("User", foreign_keys=[ignored_by])
    clearer = relationship("User", foreign_keys=[cleared_by])


class VendorSecurityTracking(Base):
    """Links vendors to security incidents with match confidence"""
    __tablename__ = "vendor_security_tracking"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Multi-tenant support
    
    # Foreign keys
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("security_incidents.id"), nullable=False, index=True)
    
    # Matching information
    match_confidence = Column(Float, nullable=False)  # 0.0-1.0
    match_method = Column(String(50), nullable=False)  # "exact_name", "domain", "product", "fuzzy"
    match_details = Column(JSON, nullable=True)  # Additional matching information
    
    # Risk qualification
    risk_qualification_status = Column(String(50), default="pending", index=True)  # pending, in_progress, completed
    risk_assessment = Column(JSON, nullable=True)  # Risk assessment details
    risk_level = Column(String(50), nullable=True)  # low, medium, high, critical
    qualified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    qualified_at = Column(DateTime, nullable=True)
    
    # Resolution
    status = Column(String(50), default="active", index=True)  # active, resolved, false_positive
    resolution_type = Column(String(50), nullable=True)  # resolved, false_positive, not_applicable
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    incident = relationship("SecurityIncident", back_populates="vendor_trackings")
    qualifier = relationship("User", foreign_keys=[qualified_by])
    resolver = relationship("User", foreign_keys=[resolved_by])


class SecurityMonitoringConfig(Base):
    """Tenant-specific security monitoring configuration"""
    __tablename__ = "security_monitoring_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)  # One config per tenant
    
    # CVE Monitoring
    cve_monitoring_enabled = Column(Boolean, default=True)
    cve_scan_frequency = Column(String(50), default="daily")  # hourly, daily, weekly
    cve_severity_threshold = Column(SQLEnum(IncidentSeverity), default=IncidentSeverity.MEDIUM)
    cve_cvss_threshold = Column(Float, default=5.0)  # Minimum CVSS score
    
    # Breach Monitoring
    breach_monitoring_enabled = Column(Boolean, default=True)
    breach_scan_frequency = Column(String(50), default="daily")
    
    # Automation settings
    auto_create_tasks = Column(Boolean, default=True)
    auto_send_alerts = Column(Boolean, default=True)
    auto_trigger_assessments = Column(Boolean, default=False)
    auto_start_workflows = Column(Boolean, default=False)
    
    # Alert configuration
    alert_recipients = Column(JSON, nullable=True)  # Array of user IDs or role names
    alert_channels = Column(JSON, nullable=True)  # ["email", "slack", "teams", "in_app"]
    alert_severity_mapping = Column(JSON, nullable=True)  # Map severity to alert priority
    
    # Assessment & Workflow
    default_assessment_id = Column(UUID(as_uuid=True), nullable=True)
    default_workflow_id = Column(UUID(as_uuid=True), nullable=True)
    assessment_due_days = Column(Integer, default=30)
    
    # Matching thresholds
    min_match_confidence = Column(Float, default=0.5)  # Minimum confidence for auto-matching
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SecurityAlert(Base):
    """Security alerts sent to users/teams"""
    __tablename__ = "security_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Multi-tenant support
    
    # Alert information
    alert_type = Column(String(50), nullable=False)  # "cve_detected", "breach_detected", "risk_qualification"
    priority = Column(String(50), nullable=False, index=True)  # low, medium, high, critical
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=True)
    
    # Related entities
    incident_id = Column(UUID(as_uuid=True), ForeignKey("security_incidents.id"), nullable=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True)
    tracking_id = Column(UUID(as_uuid=True), ForeignKey("vendor_security_tracking.id"), nullable=True)
    
    # Recipient
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recipient_role = Column(String(50), nullable=True)  # If sent to role instead of user
    
    # Delivery status
    channels = Column(JSON, nullable=True)  # ["email", "slack", "teams", "in_app"]
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="pending", index=True)  # pending, sent, read, failed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    incident = relationship("SecurityIncident", foreign_keys=[incident_id])
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    tracking = relationship("VendorSecurityTracking", foreign_keys=[tracking_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class IncidentActionType(str, Enum):
    """Types of actions that can be performed on incidents"""
    ACKNOWLEDGE = "acknowledge"
    TRACK = "track"
    IGNORE = "ignore"
    CLEAR = "clear"
    REOPEN = "reopen"  # Reopen a cleared/ignored incident


class SecurityIncidentActionHistory(Base):
    """Audit trail for all actions taken on security incidents"""
    __tablename__ = "security_incident_action_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("security_incidents.id"), nullable=False, index=True)
    
    # Action details
    action = Column(SQLEnum(IncidentActionType), nullable=False, index=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    performed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Action metadata
    notes = Column(Text, nullable=True)  # Optional notes for the action
    previous_status = Column(String(50), nullable=True)  # Status before action
    new_status = Column(String(50), nullable=True)  # Status after action
    action_metadata = Column(JSON, nullable=True)  # Additional action details
    
    # Context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    incident = relationship("SecurityIncident", back_populates="action_history")
    performer = relationship("User", foreign_keys=[performed_by])

