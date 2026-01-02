"""
Agent connection models - tracks apps/services agents connect to
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class ConnectionType(str, enum.Enum):
    """Connection type"""
    CLOUD = "cloud"
    ON_PREMISE = "on_premise"
    HYBRID = "hybrid"
    EDGE = "edge"


class ConnectionProtocol(str, enum.Enum):
    """Connection protocol"""
    API = "api"  # Generic API
    REST_API = "rest_api"
    GRAPHQL = "graphql"
    GRPC = "grpc"
    WEBSOCKET = "websocket"
    DB = "db"  # Database
    DATABASE = "database"
    FILE = "file"  # File transfer
    FILE_SYSTEM = "file_system"
    TCP_IP = "tcp_ip"
    UDP = "udp"
    HTTP = "http"
    HTTPS = "https"
    FTP = "ftp"
    SFTP = "sftp"
    MQTT = "mqtt"
    AMQP = "amqp"
    SMTP = "smtp"
    LDAP = "ldap"
    CUSTOM = "custom"


class AgentConnection(Base):
    """Agent connection model - tracks apps/services an agent connects to"""
    __tablename__ = "agent_connections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    
    # Connection details
    name = Column(String(255), nullable=False)  # e.g., "Salesforce API", "PostgreSQL DB"
    app_name = Column(String(255), nullable=False)  # e.g., "Salesforce", "PostgreSQL", "AWS S3"
    app_type = Column(String(100), nullable=False)  # e.g., "CRM", "Database", "Storage"
    connection_type = Column(String(50), nullable=False)  # CLOUD, ON_PREMISE, HYBRID, EDGE
    protocol = Column(String(50), nullable=True)  # REST_API, GRAPHQL, DATABASE, etc.
    
    # Connection metadata
    endpoint_url = Column(Text, nullable=True)  # API endpoint, database connection string, etc.
    authentication_method = Column(String(100), nullable=True)  # OAuth, API Key, Basic Auth, etc.
    description = Column(Text, nullable=True)
    
    # Additional metadata
    connection_metadata = Column(JSON, nullable=True)  # Additional connection-specific data
    # e.g., {"region": "us-east-1", "version": "v2.1", "rate_limit": "1000/hour"}
    
    # Status and configuration
    is_active = Column(Boolean, default=True)
    is_required = Column(Boolean, default=True)  # Is this connection required for agent to function?
    is_encrypted = Column(Boolean, default=True)  # Is the connection encrypted?
    
    # Security and compliance
    data_classification = Column(String(100), nullable=True)  # PII, PHI, Confidential, Public
    compliance_requirements = Column(JSON, nullable=True)  # ["HIPAA", "GDPR", "PCI-DSS"]
    
    # Data exchange information
    data_types_exchanged = Column(JSON, nullable=True)  # ["PII", "PHI", "financial", "transactional", "analytical"]
    data_flow_direction = Column(String(50), nullable=True)  # inbound, outbound, bidirectional
    data_format = Column(String(100), nullable=True)  # JSON, XML, CSV, Binary, Protocol Buffer, etc.
    data_volume = Column(String(100), nullable=True)  # e.g., "1GB/day", "1000 records/hour", "Low", "Medium", "High"
    exchange_frequency = Column(String(100), nullable=True)  # Real-time, Batch (hourly), Batch (daily), On-demand, etc.
    source_system = Column(String(255), nullable=True)  # Name of the source system/app
    destination_system = Column(String(255), nullable=True)  # Name of the destination system/app
    data_schema = Column(Text, nullable=True)  # JSON schema, table structure, or data model description
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # agent = relationship("Agent", back_populates="connections")

