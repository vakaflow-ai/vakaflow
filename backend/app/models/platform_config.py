"""
Platform Configuration model for managing all application settings
"""
from sqlalchemy import Column, String, DateTime, Boolean, JSON, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import enum
from app.core.database import Base


class ConfigCategory(str, enum.Enum):
    """Configuration categories"""
    APPLICATION = "application"
    SECURITY = "security"
    DATABASE = "database"
    REDIS = "redis"
    QDRANT = "qdrant"
    OPENAI = "openai"
    FILE_STORAGE = "file_storage"
    API = "api"
    CORS = "cors"
    RATE_LIMITING = "rate_limiting"
    LOGGING = "logging"


class ConfigValueType(str, enum.Enum):
    """Configuration value types"""
    STRING = "string"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    JSON = "json"
    SECRET = "secret"  # For passwords, API keys, tokens


class PlatformConfiguration(Base):
    """Platform-wide configuration settings"""
    __tablename__ = "platform_configurations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Configuration key (e.g., "SECRET_KEY", "CORS_ORIGINS", "MAX_UPLOAD_SIZE")
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    
    # Configuration category
    category = Column(SQLEnum(ConfigCategory), nullable=False, index=True)
    
    # Value type
    value_type = Column(SQLEnum(ConfigValueType), nullable=False)
    
    # Configuration value (JSON for complex types, string for simple)
    # For SECRET type, value is encrypted/hashed
    config_value = Column(Text, nullable=True)  # Store as JSON string for complex types
    
    # Display value (for secrets, this is masked)
    display_value = Column(String(500), nullable=True)  # Masked version for secrets
    
    # Metadata
    description = Column(Text, nullable=True)  # Human-readable description
    is_secret = Column(Boolean, default=False, nullable=False)  # Whether this is a secret
    is_required = Column(Boolean, default=False, nullable=False)  # Whether this is required
    is_encrypted = Column(Boolean, default=False, nullable=False)  # Whether value is encrypted
    
    # Change tracking
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

