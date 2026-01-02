"""
Cluster node models for infrastructure management
"""
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class NodeStatus(str, enum.Enum):
    """Cluster node status"""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    OFFLINE = "offline"


class NodeType(str, enum.Enum):
    """Cluster node type"""
    APPLICATION = "application"
    DATABASE = "database"
    REDIS = "redis"
    QDRANT = "qdrant"
    LOAD_BALANCER = "load_balancer"
    WORKER = "worker"


class NodeRole(str, enum.Enum):
    """Cluster node role"""
    PRIMARY = "primary"
    SECONDARY = "secondary"


class ClusterNode(Base):
    """Cluster node configuration and status"""
    __tablename__ = "cluster_nodes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Node identification
    hostname = Column(String(255), nullable=False, unique=True, index=True)
    ip_address = Column(String(45), nullable=False, index=True)  # Supports IPv6
    node_type = Column(SQLEnum(NodeType), nullable=False, index=True)
    
    # SSH connection details (encrypted in production)
    ssh_username = Column(String(100), nullable=False)
    ssh_password = Column(Text, nullable=True)  # Encrypted password
    ssh_port = Column(Integer, default=22, nullable=False)
    ssh_key_path = Column(Text, nullable=True)  # Path to SSH key file (optional)
    
    # Node metadata
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)  # Data center, region, etc.
    tags = Column(Text, nullable=True)  # JSON array of tags
    
    # Health status
    status = Column(SQLEnum(NodeStatus), default=NodeStatus.UNKNOWN, nullable=False, index=True)
    last_health_check = Column(DateTime, nullable=True)
    last_health_check_result = Column(Text, nullable=True)  # JSON with detailed results
    
    # Health metrics
    cpu_usage = Column(String(20), nullable=True)  # Percentage
    memory_usage = Column(String(20), nullable=True)  # Percentage
    disk_usage = Column(String(20), nullable=True)  # Percentage
    uptime = Column(String(100), nullable=True)  # System uptime
    
    # Service status
    services_status = Column(Text, nullable=True)  # JSON with service statuses
    
    # Error tracking
    error_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    
    # Configuration
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_monitored = Column(Boolean, default=True, nullable=False)
    is_current_node = Column(Boolean, default=False, nullable=False, index=True)  # Current node where user is logged in
    node_role = Column(SQLEnum(NodeRole), nullable=True, index=True)  # primary or secondary
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])


class ClusterHealthCheck(Base):
    """Cluster health check history"""
    __tablename__ = "cluster_health_checks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id = Column(UUID(as_uuid=True), ForeignKey("cluster_nodes.id"), nullable=False, index=True)
    
    # Check results
    status = Column(SQLEnum(NodeStatus), nullable=False)
    check_type = Column(String(50), nullable=False)  # ssh, service, resource, etc.
    check_result = Column(Text, nullable=False)  # JSON with detailed results
    
    # Metrics captured
    cpu_usage = Column(String(20), nullable=True)
    memory_usage = Column(String(20), nullable=True)
    disk_usage = Column(String(20), nullable=True)
    uptime = Column(String(100), nullable=True)
    
    # Error information
    error_message = Column(Text, nullable=True)
    
    # Timestamp
    checked_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    node = relationship("ClusterNode", foreign_keys=[node_id])
