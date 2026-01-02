"""
API Gateway and SCIM models for third-party integrations
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum
import secrets


class APITokenStatus(str, enum.Enum):
    """API Token status"""
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class APIToken(Base):
    """API Token for third-party integrations"""
    __tablename__ = "api_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Token details
    name = Column(String(255), nullable=False)  # Human-readable name
    token_hash = Column(String(255), nullable=False, unique=True, index=True)  # Hashed token
    token_prefix = Column(String(20), nullable=False)  # First 8 chars for identification
    
    # Permissions and scopes
    scopes = Column(JSON, nullable=False)  # List of allowed scopes: ["read:agents", "write:agents", "read:users", etc.]
    permissions = Column(JSON, nullable=True)  # Fine-grained permissions
    
    # Rate limiting
    rate_limit_per_minute = Column(Integer, default=60, nullable=False)
    rate_limit_per_hour = Column(Integer, default=1000, nullable=False)
    rate_limit_per_day = Column(Integer, default=10000, nullable=False)
    
    # Status and expiration
    status = Column(String(50), nullable=False, default=APITokenStatus.ACTIVE.value, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    last_used_at = Column(DateTime, nullable=True)
    last_used_ip = Column(String(45), nullable=True)  # IPv6 compatible
    
    # Usage tracking
    request_count = Column(Integer, default=0)
    last_request_at = Column(DateTime, nullable=True)
    
    # Metadata
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    revoker = relationship("User", foreign_keys=[revoked_by])
    
    @staticmethod
    def generate_token() -> tuple[str, str]:
        """Generate a new API token and return (token, hash)"""
        token = f"vaka_{secrets.token_urlsafe(32)}"
        import hashlib
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        token_prefix = token[:12]  # First 12 chars for identification
        return token, token_hash, token_prefix


class SCIMConfiguration(Base):
    """SCIM (System for Cross-domain Identity Management) configuration"""
    __tablename__ = "scim_configurations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    
    # SCIM settings
    enabled = Column(Boolean, default=False, nullable=False)
    base_url = Column(String(500), nullable=False)  # Base URL for SCIM endpoints
    bearer_token = Column(String(500), nullable=True)  # Deprecated: kept for migration, use bearer_token_hash
    bearer_token_hash = Column(String(500), nullable=True)  # Hashed bearer token for SCIM requests
    
    # User provisioning settings
    auto_provision_users = Column(Boolean, default=True, nullable=False)
    auto_update_users = Column(Boolean, default=True, nullable=False)
    auto_deactivate_users = Column(Boolean, default=True, nullable=False)
    
    # Field mappings
    field_mappings = Column(JSON, nullable=True)  # Map SCIM fields to internal fields
    
    # Webhook settings (for push updates)
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(500), nullable=True)  # Encrypted
    
    # Metadata
    last_sync_at = Column(DateTime, nullable=True)
    sync_status = Column(String(50), nullable=True)  # success, error, pending
    last_error = Column(Text, nullable=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])


class APIGatewaySession(Base):
    """Active API Gateway sessions for third-party apps"""
    __tablename__ = "api_gateway_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    api_token_id = Column(UUID(as_uuid=True), ForeignKey("api_tokens.id"), nullable=False, index=True)
    
    # Session details
    session_token = Column(String(500), nullable=False, unique=True, index=True)
    client_ip = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Session lifecycle
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    last_activity_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Usage tracking
    request_count = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    revoked_at = Column(DateTime, nullable=True)
    
    # Relationships
    api_token = relationship("APIToken")
    
    __table_args__ = (
        Index('idx_session_token_active', 'session_token', 'is_active'),
    )


class APIGatewayRequestLog(Base):
    """Log of API Gateway requests for auditing and rate limiting"""
    __tablename__ = "api_gateway_request_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    api_token_id = Column(UUID(as_uuid=True), ForeignKey("api_tokens.id"), nullable=True, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("api_gateway_sessions.id"), nullable=True, index=True)
    
    # Request details
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False)
    query_params = Column(JSON, nullable=True)
    
    # Client info
    client_ip = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Response details
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    
    # Rate limiting
    rate_limit_hit = Column(Boolean, default=False)
    
    # Timestamp
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    api_token = relationship("APIToken")
    session = relationship("APIGatewaySession")
    
    __table_args__ = (
        Index('idx_request_log_token_time', 'api_token_id', 'requested_at'),
        Index('idx_request_log_tenant_time', 'tenant_id', 'requested_at'),
    )

