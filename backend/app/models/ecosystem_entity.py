"""
Unified Ecosystem Entity model for Agents, Products, and Services
This provides common governance fields and lifecycle management across all entity types
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List
from app.core.database import Base
import enum


class EntityType(str, enum.Enum):
    """Type of ecosystem entity"""
    AGENT = "agent"
    PRODUCT = "product" 
    SERVICE = "service"
    
    def __str__(self):
        return self.value


class EntityStatus(str, enum.Enum):
    """Unified status for all ecosystem entities"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    PAUSED = "paused"
    OFFBOARDED = "offboarded"
    ARCHIVED = "archived"
    
    def __str__(self):
        return self.value


class EcosystemEntity(Base):
    """
    Unified model for all ecosystem entities (Agents, Products, Services)
    Provides common governance, compliance, and lifecycle management
    """
    __tablename__ = "ecosystem_entities"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    tenant_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)  # type: ignore
    vendor_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)  # type: ignore
    
    # Entity identification
    name: str = Column(String(255), nullable=False)  # type: ignore
    entity_type: EntityType = Column(Enum(EntityType), nullable=False, index=True)  # type: ignore
    category: Optional[str] = Column(String(100), nullable=True)  # type: ignore
    subcategory: Optional[str] = Column(String(100), nullable=True)  # type: ignore
    description: Optional[str] = Column(Text, nullable=True)  # type: ignore
    
    # Version and lifecycle
    version: Optional[str] = Column(String(50), nullable=True)  # type: ignore
    status: EntityStatus = Column(Enum(EntityStatus), nullable=False, default=EntityStatus.DRAFT, index=True)  # type: ignore
    
    # Governance fields (shared across all entity types)
    service_account: Optional[str] = Column(String(255), nullable=True)  # type: ignore  # Service account used
    department: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # Owning department
    organization: Optional[str] = Column(String(255), nullable=True)  # type: ignore  # Using organization
    kill_switch_enabled: bool = Column(Boolean, default=False, nullable=False)  # type: ignore  # Emergency disable
    last_governance_review: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore  # Last review date
    governance_owner_id: Optional[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # type: ignore  # Governance responsible
    
    # Skills-based approach (replaces use_cases)
    skills: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # What this entity can do
    
    # Compliance and risk
    compliance_score: Optional[int] = Column(Integer, nullable=True)  # type: ignore  # 0-100
    risk_score: Optional[int] = Column(Integer, nullable=True)  # type: ignore  # 1-10
    security_controls: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Security measures
    compliance_standards: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Standards met
    
    # Documentation and artifacts
    documentation_urls: Optional[Dict[str, str]] = Column(JSON, nullable=True)  # type: ignore  # Docs, diagrams, specs
    architecture_diagrams: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # Architecture diagrams
    landscape_diagrams: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore  # System landscapes
    
    # Ecosystem relationships
    related_entity_ids: Optional[List[uuid.UUID]] = Column(JSON, nullable=True)  # type: ignore  # Related entities
    integration_points: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Integration details
    
    # Lifecycle timestamps
    submission_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    approval_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    activation_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    deactivation_date: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    
    # Metadata
    extra_metadata: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Additional data
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="entities")
    # tenant = relationship("Tenant", back_populates="entities")
    # governance_owner = relationship("User", foreign_keys=[governance_owner_id])


class EntityLifecycleEvent(Base):
    """
    Track lifecycle events for ecosystem entities
    Provides audit trail and automation triggers
    """
    __tablename__ = "entity_lifecycle_events"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    entity_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("ecosystem_entities.id"), nullable=False, index=True)  # type: ignore
    tenant_id: uuid.UUID = Column(UUID(as_uuid=True), nullable=False, index=True)  # type: ignore
    
    # Event details
    event_type: str = Column(String(50), nullable=False, index=True)  # type: ignore  # created, submitted, approved, activated, paused, etc.
    from_status: Optional[EntityStatus] = Column(Enum(EntityStatus), nullable=True)  # type: ignore
    to_status: EntityStatus = Column(Enum(EntityStatus), nullable=False)  # type: ignore
    triggered_by: Optional[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # type: ignore
    
    # Event context
    reason: Optional[str] = Column(Text, nullable=True)  # type: ignore  # Why the change occurred
    automated: bool = Column(Boolean, default=False, nullable=False)  # type: ignore  # Was this automated?
    workflow_step: Optional[str] = Column(String(100), nullable=True)  # type: ignore  # Which workflow step
    
    # Metadata
    event_data: Optional[Dict[str, Any]] = Column(JSON, nullable=True)  # type: ignore  # Additional event data
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    
    # Relationships
    # entity = relationship("EcosystemEntity", back_populates="lifecycle_events")


class SharedGovernanceProfile(Base):
    """
    Shared governance profiles that can be applied to multiple entities
    Enables reuse of common governance configurations
    """
    __tablename__ = "shared_governance_profiles"
    
    id: uuid.UUID = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # type: ignore
    tenant_id: uuid.UUID = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)  # type: ignore
    
    # Profile identification
    name: str = Column(String(255), nullable=False)  # type: ignore
    description: Optional[str] = Column(Text, nullable=True)  # type: ignore
    profile_type: str = Column(String(50), nullable=False, index=True)  # type: ignore  # security, compliance, operational
    
    # Shared governance fields
    security_controls: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore
    compliance_standards: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore
    monitoring_requirements: Optional[List[str]] = Column(JSON, nullable=True)  # type: ignore
    documentation_templates: Optional[Dict[str, str]] = Column(JSON, nullable=True)  # type: ignore
    
    # Usage tracking
    entity_count: int = Column(Integer, default=0, nullable=False)  # type: ignore  # How many entities use this profile
    last_applied: Optional[datetime] = Column(DateTime, nullable=True)  # type: ignore
    
    # Metadata
    created_by: Optional[uuid.UUID] = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # type: ignore
    created_at: datetime = Column(DateTime, default=datetime.utcnow)  # type: ignore
    updated_at: Optional[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore