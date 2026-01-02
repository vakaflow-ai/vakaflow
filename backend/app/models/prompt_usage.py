"""
Prompt usage and cost tracking models
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class PromptUsage(Base):
    """Prompt usage tracking for cost analysis"""
    __tablename__ = "prompt_usage"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    
    # Prompt details
    prompt_type = Column(String(50), nullable=False)  # completion, chat, embedding, etc.
    model_vendor = Column(String(100), nullable=False)  # OpenAI, Anthropic, Google, etc.
    model_name = Column(String(100), nullable=False)  # gpt-4, claude-3, etc.
    
    # Token usage
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    
    # Cost tracking
    input_cost = Column(Numeric(10, 6), nullable=True)  # Cost for input tokens
    output_cost = Column(Numeric(10, 6), nullable=True)  # Cost for output tokens
    total_cost = Column(Numeric(10, 6), nullable=True)  # Total cost
    
    # Usage context
    department = Column(String(100), nullable=True, index=True)
    use_case = Column(String(255), nullable=True)
    session_id = Column(String(255), nullable=True, index=True)
    
    # Additional context (renamed from metadata to avoid SQLAlchemy conflict)
    extra_data = Column(JSON, nullable=True)  # Additional context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_prompt_usage_agent_created', 'agent_id', 'created_at'),
        Index('idx_prompt_usage_tenant_created', 'tenant_id', 'created_at'),
        Index('idx_prompt_usage_user_created', 'user_id', 'created_at'),
        Index('idx_prompt_usage_model', 'model_vendor', 'model_name'),
    )


class CostAggregation(Base):
    """Daily/monthly cost aggregations for faster queries"""
    __tablename__ = "cost_aggregations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True, index=True)
    
    # Time period
    aggregation_type = Column(String(20), nullable=False)  # daily, monthly
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)
    
    # Aggregated metrics
    total_cost = Column(Numeric(12, 2), default=0)
    total_tokens = Column(Integer, default=0)
    total_requests = Column(Integer, default=0)
    
    # Breakdown by model
    model_breakdown = Column(JSON, nullable=True)  # {model: {cost, tokens, requests}}
    
    # Breakdown by department/role
    department_breakdown = Column(JSON, nullable=True)
    role_breakdown = Column(JSON, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_cost_agg_tenant_period', 'tenant_id', 'aggregation_type', 'period_start'),
        Index('idx_cost_agg_agent_period', 'agent_id', 'aggregation_type', 'period_start'),
    )

