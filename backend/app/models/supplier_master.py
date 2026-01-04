"""
Supplier Master View models
Comprehensive supplier management with agreements, CVEs, investigations, and compliance tracking
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class AgreementType(str, enum.Enum):
    """Type of agreement"""
    NDA = "nda"  # Non-Disclosure Agreement
    MSA = "msa"  # Master Service Agreement
    SOW = "sow"  # Statement of Work
    SLA = "sla"  # Service Level Agreement
    CONTRACT = "contract"  # General contract
    LICENSE = "license"  # License agreement
    OTHER = "other"  # Other type


class AgreementStatus(str, enum.Enum):
    """Agreement status"""
    DRAFT = "draft"
    PENDING_SIGNATURE = "pending_signature"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    RENEWAL_PENDING = "renewal_pending"


class CVEStatus(str, enum.Enum):
    """CVE status"""
    OPEN = "open"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"
    MITIGATED = "mitigated"


class InvestigationStatus(str, enum.Enum):
    """Investigation status"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    ESCALATED = "escalated"


class ComplianceIssueStatus(str, enum.Enum):
    """Compliance issue status"""
    OPEN = "open"
    IN_REMEDIATION = "in_remediation"
    RESOLVED = "resolved"
    CLOSED = "closed"
    WAIVED = "waived"


class SupplierAgreement(Base):
    """Supplier agreements (NDAs, contracts, etc.) with PDF storage"""
    __tablename__ = "supplier_agreements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Agreement details
    agreement_type = Column(Enum(AgreementType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(AgreementStatus), nullable=False, default=AgreementStatus.DRAFT)
    
    # Dates
    effective_date = Column(DateTime, nullable=True)  # When agreement becomes effective
    expiry_date = Column(DateTime, nullable=True)  # When agreement expires
    signed_date = Column(DateTime, nullable=True)  # When agreement was signed
    renewal_date = Column(DateTime, nullable=True)  # When agreement should be renewed
    
    # Parties
    signed_by_vendor = Column(String(255), nullable=True)  # Vendor signatory name
    signed_by_tenant = Column(String(255), nullable=True)  # Tenant signatory name
    vendor_contact_email = Column(String(255), nullable=True)
    tenant_contact_email = Column(String(255), nullable=True)
    
    # PDF document storage
    pdf_file_path = Column(Text, nullable=True)  # Path to stored PDF file
    pdf_file_name = Column(String(255), nullable=True)  # Original filename
    pdf_file_size = Column(Integer, nullable=True)  # File size in bytes
    pdf_uploaded_at = Column(DateTime, nullable=True)
    
    # Additional metadata
    additional_metadata = Column(JSON, nullable=True)  # Additional agreement-specific data
    tags = Column(JSON, nullable=True)  # Tags for categorization
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_supplier_agreement_vendor_tenant', 'vendor_id', 'tenant_id'),
        Index('idx_supplier_agreement_status', 'status'),
        Index('idx_supplier_agreement_expiry', 'expiry_date'),
    )


class SupplierCVE(Base):
    """Common Vulnerabilities and Exposures (CVEs) for suppliers"""
    __tablename__ = "supplier_cves"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # CVE details
    cve_id = Column(String(50), nullable=False, index=True)  # e.g., "CVE-2024-1234"
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=True)  # CRITICAL, HIGH, MEDIUM, LOW
    cvss_score = Column(String(10), nullable=True)  # CVSS score (e.g., "9.8")
    
    # Status and tracking
    status = Column(Enum(CVEStatus), nullable=False, default=CVEStatus.OPEN)
    confirmed = Column(Boolean, default=False, nullable=False)  # Whether CVE is confirmed for this supplier
    confirmed_at = Column(DateTime, nullable=True)
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Affected components
    affected_products = Column(JSON, nullable=True)  # List of affected products/services
    affected_agents = Column(JSON, nullable=True)  # List of affected agent IDs
    
    # Remediation
    remediation_notes = Column(Text, nullable=True)
    remediation_date = Column(DateTime, nullable=True)
    mitigation_applied = Column(Boolean, default=False)
    mitigation_notes = Column(Text, nullable=True)
    
    # External references
    external_references = Column(JSON, nullable=True)  # Links to CVE databases, advisories, etc.
    
    # Metadata
    discovered_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_supplier_cve_vendor_tenant', 'vendor_id', 'tenant_id'),
        Index('idx_supplier_cve_status', 'status'),
        Index('idx_supplier_cve_confirmed', 'confirmed'),
    )


class SupplierInvestigation(Base):
    """Open investigations or compliance issues for suppliers"""
    __tablename__ = "supplier_investigations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Investigation details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    investigation_type = Column(String(50), nullable=False)  # security, compliance, quality, etc.
    status = Column(Enum(InvestigationStatus), nullable=False, default=InvestigationStatus.OPEN)
    priority = Column(String(20), nullable=True)  # CRITICAL, HIGH, MEDIUM, LOW
    
    # Assignment
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    assigned_at = Column(DateTime, nullable=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Dates
    opened_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    
    # Findings and resolution
    findings = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_action = Column(Text, nullable=True)
    
    # Related entities
    related_agents = Column(JSON, nullable=True)  # List of related agent IDs
    related_assessments = Column(JSON, nullable=True)  # List of related assessment IDs
    related_cves = Column(JSON, nullable=True)  # List of related CVE IDs
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_supplier_investigation_vendor_tenant', 'vendor_id', 'tenant_id'),
        Index('idx_supplier_investigation_status', 'status'),
        Index('idx_supplier_investigation_assigned', 'assigned_to'),
    )


class SupplierComplianceIssue(Base):
    """Compliance issues for suppliers"""
    __tablename__ = "supplier_compliance_issues"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Issue details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    compliance_framework = Column(String(100), nullable=True)  # e.g., "SOC2", "ISO27001", "GDPR"
    requirement = Column(String(255), nullable=True)  # Specific requirement that's not met
    severity = Column(String(20), nullable=True)  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(Enum(ComplianceIssueStatus), nullable=False, default=ComplianceIssueStatus.OPEN)
    
    # Dates
    identified_at = Column(DateTime, default=datetime.utcnow)
    target_resolution_date = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    
    # Remediation
    remediation_plan = Column(Text, nullable=True)
    remediation_notes = Column(Text, nullable=True)
    remediation_completed = Column(Boolean, default=False)
    
    # Assignment
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    assigned_at = Column(DateTime, nullable=True)
    
    # Related entities
    related_agents = Column(JSON, nullable=True)  # List of related agent IDs
    related_assessments = Column(JSON, nullable=True)  # List of related assessment IDs
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_supplier_compliance_vendor_tenant', 'vendor_id', 'tenant_id'),
        Index('idx_supplier_compliance_status', 'status'),
        Index('idx_supplier_compliance_framework', 'compliance_framework'),
    )


class SupplierDepartmentRelationship(Base):
    """Relationships between suppliers and tenant departments"""
    __tablename__ = "supplier_department_relationships"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Department relationship
    department = Column(String(255), nullable=False)  # Department name (from master data)
    relationship_type = Column(String(50), nullable=False)  # primary, secondary, backup, etc.
    contact_person = Column(String(255), nullable=True)  # Primary contact in department
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    # Relationship details
    engagement_start_date = Column(DateTime, nullable=True)
    engagement_end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Usage and spend (optional)
    annual_spend = Column(Integer, nullable=True)  # Annual spend in cents
    usage_notes = Column(Text, nullable=True)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_supplier_dept_vendor_tenant', 'vendor_id', 'tenant_id'),
        Index('idx_supplier_dept_active', 'is_active'),
    )


class SupplierOffering(Base):
    """Supplier offerings/products/services"""
    __tablename__ = "supplier_offerings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Offering details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # Product category
    offering_type = Column(String(50), nullable=True)  # product, service, software, etc.
    
    # Pricing (optional)
    pricing_model = Column(String(50), nullable=True)  # subscription, one-time, usage-based, etc.
    price = Column(Integer, nullable=True)  # Price in cents
    currency = Column(String(10), nullable=True, default="USD")
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)  # Approved for use in tenant
    
    # Related agents (if offering is an agent)
    related_agent_ids = Column(JSON, nullable=True)  # List of agent IDs
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_supplier_offering_vendor_tenant', 'vendor_id', 'tenant_id'),
        Index('idx_supplier_offering_active', 'is_active'),
    )

