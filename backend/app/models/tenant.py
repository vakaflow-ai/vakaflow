"""
Tenant model for multi-tenancy
"""
from sqlalchemy import Column, String, DateTime, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class Tenant(Base):
    """Tenant model for multi-tenant architecture"""
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending")  # pending, active, suspended, cancelled
    
    # Contact information
    contact_email = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)  # Website URL
    
    # Subscription and licensing
    license_tier = Column(String(50), nullable=False, default="trial")  # trial, basic, professional, enterprise
    license_features = Column(JSON, nullable=True)  # Feature flags
    max_agents = Column(String(50), nullable=True)  # null = unlimited, or number
    max_users = Column(String(50), nullable=True)  # null = unlimited, or number
    
    # Onboarding
    onboarding_status = Column(String(50), nullable=False, default="not_started")  # not_started, in_progress, completed
    onboarding_completed_at = Column(DateTime, nullable=True)
    
    # Configuration
    settings = Column(JSON, nullable=True)  # Tenant-specific settings
    custom_branding = Column(JSON, nullable=True)  # Logo, colors, etc.
    
    # Tenant Profile (Onboarding)
    industry = Column(String(100), nullable=True, index=True)  # healthcare, finance, technology, etc.
    timezone = Column(String(50), nullable=True, default="UTC")  # Timezone (e.g., "America/New_York", "UTC")
    locale = Column(String(10), nullable=True, default="en")  # Locale code (e.g., "en", "en-US", "fr", "de")
    i18n_settings = Column(JSON, nullable=True)  # I18N settings: {"date_format": "MM/DD/YYYY", "time_format": "12h", "currency": "USD", etc.}
    
    # SSO and Domain Configuration
    allowed_email_domains = Column(JSON, nullable=True)  # List of email domains allowed for this tenant (e.g., ["company1.com", "company1.io"])
    sso_domain_mapping = Column(JSON, nullable=True)  # Map SSO provider domains to tenant (e.g., {"company1.com": "tenant-id"})
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), nullable=True)  # Platform admin who created
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # users = relationship("User", back_populates="tenant")
    # agents = relationship("Agent", back_populates="tenant")
    master_data_lists = relationship("MasterDataList", back_populates="tenant")


class LicenseFeature(Base):
    """License feature definitions"""
    __tablename__ = "license_features"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature_key = Column(String(100), unique=True, nullable=False, index=True)
    feature_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    default_enabled = Column(Boolean, default=False)
    tier_availability = Column(JSON, nullable=True)  # Which tiers have this feature
    created_at = Column(DateTime, default=datetime.utcnow)


class TenantFeature(Base):
    """Tenant-specific feature overrides"""
    __tablename__ = "tenant_features"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    feature_key = Column(String(100), nullable=False, index=True)
    enabled = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)  # For time-limited features
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

