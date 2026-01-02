"""
Business Rule Model
General-purpose rules that can be used across business flows, entities, and screens
"""
from sqlalchemy import Column, String, Text, Boolean, Integer, JSON, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import uuid
from datetime import datetime


class BusinessRule(Base):
    """General-purpose business rules with expression-based conditions"""
    __tablename__ = "business_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Rule Identification
    rule_id = Column(String(100), nullable=False)  # Human-readable rule ID (unique per tenant)
    name = Column(String(255), nullable=False)  # Rule name
    description = Column(Text, nullable=True)  # Rule description
    
    # Rule Expression
    # Expression format: "If condition then action"
    # Example: "If user.department = Agent.department then assign_to:user.department_manager"
    # Supported tokens: user.*, agent.*, entity.*, assessment.*, etc.
    condition_expression = Column(Text, nullable=False)  # The condition part (e.g., "user.department = Agent.department")
    action_expression = Column(Text, nullable=False)  # The action part (e.g., "assign_to:user.department_manager" or "step:approval_required")
    
    # Rule Configuration
    rule_type = Column(String(50), nullable=False, default="conditional")  # conditional, assignment, workflow, validation
    applicable_entities = Column(JSON, nullable=True)  # ["agent", "assessment", "workflow", "user"] - where this rule can be used
    applicable_screens = Column(JSON, nullable=True)  # ["agent_submission", "assessment_review", "workflow_builder"] - specific screens
    
    # Action Configuration
    action_type = Column(String(50), nullable=True)  # assign, route, validate, notify, execute_step
    action_config = Column(JSON, nullable=True)  # Configuration for the action (e.g., {"target": "user.department_manager", "step": "approval"})
    
    # Rule Priority and Status
    priority = Column(Integer, default=100)  # Lower number = higher priority
    is_active = Column(Boolean, default=True)
    is_automatic = Column(Boolean, default=True)  # If true, automatically applies; if false, suggests
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes and constraints
    __table_args__ = (
        Index('idx_business_rule_tenant_active', 'tenant_id', 'is_active'),
        Index('idx_business_rule_rule_id', 'rule_id'),
        # Unique constraint: rule_id must be unique per tenant
        UniqueConstraint('tenant_id', 'rule_id', name='uq_business_rules_tenant_rule_id'),
    )
