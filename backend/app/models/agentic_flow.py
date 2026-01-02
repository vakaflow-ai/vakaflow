"""
Agentic AI Flow Models - For creating and executing agentic AI workflows
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class FlowStatus(str, enum.Enum):
    """Flow execution status"""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FlowNodeType(str, enum.Enum):
    """Types of flow nodes"""
    AGENT = "agent"  # Execute an agent skill
    CONDITION = "condition"  # Conditional branching
    DELAY = "delay"  # Wait/delay
    TRIGGER = "trigger"  # External trigger
    ACTION = "action"  # Custom action
    PARALLEL = "parallel"  # Parallel execution
    MERGE = "merge"  # Merge parallel branches


class FlowExecutionStatus(str, enum.Enum):
    """Flow execution instance status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class AgenticFlow(Base):
    """Agentic AI Flow definition"""
    __tablename__ = "agentic_flows"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Flow identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # e.g., "i18n", "assessment", "questionnaire"
    
    # Flow definition
    flow_definition = Column(JSON, nullable=False)  # Flow graph/nodes
    # Structure:
    # {
    #   "nodes": [
    #     {
    #       "id": "node1",
    #       "type": "agent",
    #       "agent_id": "...",
    #       "skill": "realtime_risk_analysis",
    #       "input": {...},
    #       "position": {"x": 100, "y": 100}
    #     }
    #   ],
    #   "edges": [
    #     {"from": "node1", "to": "node2", "condition": null}
    #   ]
    # }
    
    # Flow configuration
    status = Column(String(50), nullable=False, default=FlowStatus.DRAFT.value)
    is_template = Column(Boolean, default=False)  # Can be used as template
    tags = Column(JSON, nullable=True)  # Tags for categorization
    
    # Execution settings
    max_concurrent_executions = Column(Integer, default=10)
    timeout_seconds = Column(Integer, nullable=True)
    retry_on_failure = Column(Boolean, default=False)
    retry_count = Column(Integer, default=0)
    
    # Context configuration (for automatic execution)
    context_id_template = Column(String(255), nullable=True)  # Template or fixed value for context_id (e.g., "agent_id", "{{agent_id}}", or a specific UUID)
    context_type_default = Column(String(50), nullable=True)  # Default context type (e.g., "agent", "vendor", "assessment")
    
    # Sharing configuration
    is_shared = Column(Boolean, default=False)  # Whether flow is shared with other tenants
    shared_with_tenants = Column(JSON, nullable=True)  # List of tenant IDs this flow is shared with (null = all tenants)
    
    # Versioning
    version = Column(Integer, default=1)  # Flow version number
    parent_flow_id = Column(UUID(as_uuid=True), ForeignKey("agentic_flows.id"), nullable=True)  # Parent flow for versioning
    is_current_version = Column(Boolean, default=True)  # Whether this is the current version
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    executions = relationship("FlowExecution", back_populates="flow", cascade="all, delete-orphan")
    versions = relationship("AgenticFlow", remote_side=[id], backref="parent_flow")  # All versions of this flow


class FlowExecution(Base):
    """Flow execution instance"""
    __tablename__ = "flow_executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flow_id = Column(UUID(as_uuid=True), ForeignKey("agentic_flows.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Execution context
    context_id = Column(String(255), nullable=True, index=True)  # e.g., agent_id, assessment_id
    context_type = Column(String(50), nullable=True)  # e.g., "agent_onboarding", "assessment"
    
    # Execution state
    status = Column(String(50), nullable=False, default=FlowExecutionStatus.PENDING.value)
    current_node_id = Column(String(100), nullable=True)  # Current executing node
    execution_data = Column(JSON, nullable=True)  # Runtime data
    
    # Results
    result = Column(JSON, nullable=True)  # Final result
    error_message = Column(Text, nullable=True)
    
    # Performance
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # Trigger
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    trigger_data = Column(JSON, nullable=True)  # Data that triggered execution
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    flow = relationship("AgenticFlow", back_populates="executions")
    node_executions = relationship("FlowNodeExecution", back_populates="execution", cascade="all, delete-orphan")


class FlowNodeExecution(Base):
    """Individual node execution within a flow"""
    __tablename__ = "flow_node_executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("flow_executions.id"), nullable=False, index=True)
    node_id = Column(String(100), nullable=False, index=True)
    
    # Execution state
    status = Column(String(50), nullable=False, default=FlowExecutionStatus.PENDING.value)
    
    # Retry tracking
    retry_attempt = Column(Integer, default=0)  # Current retry attempt (0 = first attempt)
    
    # Input/Output
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Agent execution (if node is agent type)
    agent_id = Column(UUID(as_uuid=True), nullable=True)
    skill_used = Column(String(100), nullable=True)
    interaction_id = Column(UUID(as_uuid=True), nullable=True)  # Link to AgenticAgentInteraction
    
    # Performance
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    execution = relationship("FlowExecution", back_populates="node_executions")


class AgentSource(str, enum.Enum):
    """Source of agent (VAKA or external)"""
    VAKA = "vaka"  # Built-in VAKA agent
    EXTERNAL = "external"  # External agent via MCP
    MARKETPLACE = "marketplace"  # From marketplace


class StudioAgent(Base):
    """Studio view of agents (aggregates VAKA and external agents)"""
    __tablename__ = "studio_agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Agent identification
    name = Column(String(255), nullable=False)
    agent_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    
    # Source information
    source = Column(String(50), nullable=False)  # AgentSource
    source_agent_id = Column(UUID(as_uuid=True), nullable=True)  # ID in source system
    mcp_connection_id = Column(UUID(as_uuid=True), ForeignKey("mcp_connections.id"), nullable=True)  # If external
    
    # Agent capabilities
    skills = Column(JSON, nullable=False, default=list)
    capabilities = Column(JSON, nullable=True)
    
    # Display information
    icon_url = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    tags = Column(JSON, nullable=True)
    
    # Availability
    is_available = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    # Usage statistics
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    
    # Master data attributes
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    department = Column(String(100), nullable=True, index=True)
    organization = Column(String(255), nullable=True, index=True)
    master_data_attributes = Column(JSON, nullable=True)  # Custom master data mappings
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
