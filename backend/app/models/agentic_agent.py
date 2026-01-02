"""
Agentic AI Agent Models - Core models for AI agents in the platform
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class AgenticAgentType(str, enum.Enum):
    """Types of agentic AI agents"""
    AI_GRC = "ai_grc"
    ASSESSMENT = "assessment"
    VENDOR = "vendor"
    COMPLIANCE_REVIEWER = "compliance_reviewer"
    QUESTIONNAIRE_REVIEWER = "questionnaire_reviewer"  # Questionnaire review agent


class AgenticAgentStatus(str, enum.Enum):
    """Status of agentic AI agent"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    TRAINING = "training"
    ERROR = "error"


class AgentSkill(str, enum.Enum):
    """Skills that agents can have"""
    TPRM = "tprm"  # Third Party Risk Management
    VENDOR_QUALIFICATION = "vendor_qualification"
    ONBOARDING = "onboarding"
    OFFBOARDING = "offboarding"
    AI_AGENT_ONBOARDING = "ai_agent_onboarding"
    MARKETPLACE_REVIEWS = "marketplace_reviews"
    REALTIME_RISK_ANALYSIS = "realtime_risk_analysis"
    QUESTIONNAIRE_REVIEW = "questionnaire_review"  # Review questionnaire responses
    FLAG_RISKS = "flag_risks"  # Flag risks in responses
    SEND_FOLLOWUP = "send_followup"  # Send followup questions to vendor


class AgenticAgent(Base):
    """Agentic AI Agent model - represents an AI agent in the system"""
    __tablename__ = "agentic_agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Agent identification
    name = Column(String(255), nullable=False)
    agent_type = Column(String(50), nullable=False)  # AgenticAgentType
    description = Column(Text, nullable=True)
    version = Column(String(50), nullable=False, default="1.0.0")
    
    # Agent configuration
    status = Column(String(50), nullable=False, default=AgenticAgentStatus.ACTIVE.value)
    skills = Column(JSON, nullable=False, default=list)  # List of AgentSkill values
    capabilities = Column(JSON, nullable=True)  # Additional capabilities
    configuration = Column(JSON, nullable=True)  # Agent-specific configuration
    
    # RAG and AI settings
    rag_enabled = Column(Boolean, default=True)
    llm_provider = Column(String(100), nullable=True)  # openai, anthropic, etc.
    llm_model = Column(String(100), nullable=True)  # gpt-4, claude-3, etc.
    embedding_model = Column(String(100), nullable=True)
    
    # MCP settings
    mcp_enabled = Column(Boolean, default=True)
    mcp_server_url = Column(String(500), nullable=True)
    mcp_api_key = Column(String(500), nullable=True)
    
    # Performance metrics
    total_interactions = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    average_response_time = Column(Float, default=0.0)
    last_used_at = Column(DateTime, nullable=True)
    
    # Learning and improvement
    learning_enabled = Column(Boolean, default=True)
    feedback_count = Column(Integer, default=0)
    improvement_score = Column(Float, default=0.0)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sessions = relationship("AgenticAgentSession", back_populates="agent", cascade="all, delete-orphan")
    interactions = relationship("AgenticAgentInteraction", foreign_keys="[AgenticAgentInteraction.agent_id]", back_populates="agent", cascade="all, delete-orphan")


class AgenticAgentSession(Base):
    """Session for agent interactions"""
    __tablename__ = "agentic_agent_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agentic_agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Session context
    context_id = Column(String(255), nullable=True, index=True)  # e.g., agent_id, onboarding_request_id
    context_type = Column(String(50), nullable=True)  # agent_onboarding, vendor_qualification, etc.
    
    # Session state
    status = Column(String(50), nullable=False, default="active")  # active, completed, error
    current_step = Column(String(100), nullable=True)
    session_data = Column(JSON, nullable=True)  # Session-specific data
    
    # User interaction
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    agent = relationship("AgenticAgent", back_populates="sessions")
    interactions = relationship("AgenticAgentInteraction", back_populates="session", cascade="all, delete-orphan")


class AgenticAgentInteraction(Base):
    """Individual interaction with an agentic agent"""
    __tablename__ = "agentic_agent_interactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agentic_agents.id"), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("agentic_agent_sessions.id"), nullable=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Interaction details
    interaction_type = Column(String(50), nullable=False)  # query, action, skill_execution
    skill_used = Column(String(50), nullable=True)  # AgentSkill value
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    
    # RAG context
    rag_query = Column(Text, nullable=True)
    rag_results = Column(JSON, nullable=True)
    rag_context_used = Column(JSON, nullable=True)
    
    # Agent communication
    agent_called = Column(UUID(as_uuid=True), ForeignKey("agentic_agents.id"), nullable=True)  # If this agent called another
    communication_type = Column(String(50), nullable=True)  # "internal" or "external"
    target_tenant_id = Column(UUID(as_uuid=True), nullable=True)  # For external communication
    mcp_protocol_used = Column(Boolean, default=False)
    
    # Performance
    response_time_ms = Column(Float, nullable=True)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Learning feedback
    feedback_provided = Column(Boolean, default=False)
    feedback_score = Column(Integer, nullable=True)  # 1-5
    feedback_notes = Column(Text, nullable=True)
    
    # User context
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    agent = relationship("AgenticAgent", foreign_keys=[agent_id], back_populates="interactions")
    session = relationship("AgenticAgentSession", back_populates="interactions")


class AgenticAgentLearning(Base):
    """Learning data for agentic agents"""
    __tablename__ = "agentic_agent_learning"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agentic_agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Learning context
    learning_type = Column(String(50), nullable=False)  # compliance_pattern, questionnaire_pattern, workflow_pattern
    source_type = Column(String(50), nullable=False)  # compliance_check, questionnaire, review, assessment
    source_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to source (agent_id, assessment_id, etc.)
    
    # Learned patterns
    pattern_data = Column(JSON, nullable=False)  # The pattern learned
    pattern_signature = Column(String(500), nullable=True)  # Hash/signature for deduplication
    
    # Learning metadata
    confidence_score = Column(Float, default=0.0)
    usage_count = Column(Integer, default=1)
    success_count = Column(Integer, default=0)
    
    # Validation
    validated = Column(Boolean, default=False)
    validated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("AgenticAgent")


class MCPConnection(Base):
    """MCP (Model Context Protocol) connections for external platforms"""
    __tablename__ = "mcp_connections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Connection details
    connection_name = Column(String(255), nullable=False)
    platform_name = Column(String(255), nullable=False)  # External platform name
    mcp_server_url = Column(String(500), nullable=False)
    api_key = Column(String(500), nullable=False)
    
    # Configuration
    enabled = Column(Boolean, default=True)
    configuration = Column(JSON, nullable=True)
    
    # Capabilities
    supported_skills = Column(JSON, nullable=True)  # Skills this connection supports
    supported_agents = Column(JSON, nullable=True)  # Agent types this connection supports
    
    # Usage tracking
    total_requests = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)
    
    # Security
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
