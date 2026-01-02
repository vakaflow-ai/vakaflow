"""
Workflow configuration models for tenant-specific workflow management
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, JSON, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class WorkflowEngineType(str, enum.Enum):
    """Workflow engine types"""
    INTERNAL = "internal"  # Use platform's built-in workflow
    SERVICENOW = "servicenow"  # Integrate with ServiceNow
    JIRA = "jira"  # Integrate with Jira
    CUSTOM = "custom"  # Custom workflow engine via API


class WorkflowConfigStatus(str, enum.Enum):
    """Workflow configuration status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"


class WorkflowConfiguration(Base):
    """Workflow configuration for tenant"""
    __tablename__ = "workflow_configurations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Workflow details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Workflow engine selection
    workflow_engine = Column(String(50), nullable=False, default=WorkflowEngineType.INTERNAL.value)
    
    # Integration configuration (for external engines)
    # Note: Foreign key is optional - integration may not exist yet
    integration_id = Column(UUID(as_uuid=True), nullable=True)  # ForeignKey("integrations.id") - made optional to avoid import issues
    integration_config = Column(JSON, nullable=True)  # Engine-specific configuration
    
    # Workflow definition (for internal engine)
    workflow_steps = Column(JSON, nullable=True)  # Array of workflow steps
    # Example structure:
    # [
    #   {
    #     "step_number": 1,
    #     "step_type": "review",
    #     "step_name": "Security Review",
    #     "assigned_role": "security_reviewer",
    #     "required": true,
    #     "can_skip": false,
    #     "auto_assign": true,
    #     "stage_settings": {
    #       "visible_fields": ["name", "type", "llm_vendor", "data_sharing_scope", "capabilities"],
    #       "email_notifications": {
    #         "enabled": true,
    #         "recipients": ["user", "vendor", "next_approver"],
    #         "reminders": [1, 2]  # Days before reminder
    #       }
    #     }
    #   }
    # ]
    
    # Assignment rules
    assignment_rules = Column(JSON, nullable=True)  # Rules for assigning approvers/reviewers
    # Example structure:
    # {
    #   "approver_selection": "round_robin",  # round_robin, specific_user, role_based
    #   "specific_approver_id": null,
    #   "reviewer_auto_assign": true,
    #   "escalation_rules": {
    #     "timeout_hours": 48,
    #     "escalate_to": "tenant_admin"
    #   }
    # }
    
    # Conditions for applying this workflow
    conditions = Column(JSON, nullable=True)  # When to use this workflow
    # Example structure:
    # {
    #   "agent_types": ["ai", "automation"],
    #   "risk_levels": ["high", "critical"],
    #   "categories": ["security", "compliance"],
    #   "priority": 1  # Lower number = higher priority
    # }
    
    # Trigger rules for workflow routing
    trigger_rules = Column(JSON, nullable=True)  # Rules that trigger this workflow
    # Example structure:
    # {
    #   "sso_groups": ["security-team", "compliance-team"],
    #   "departments": ["IT", "Security", "Compliance"],
    #   "application_categories": ["security", "compliance", "data-processing"],
    #   "agent_types": ["AI_AGENT", "BOT"],
    #   "risk_levels": ["high", "critical"],
    #   "match_all": false  # true = all conditions must match, false = any condition matches
    # }
    
    # Status
    status = Column(String(50), nullable=False, default=WorkflowConfigStatus.DRAFT.value)
    is_default = Column(Boolean, default=False)  # Default workflow for tenant
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # tenant = relationship("Tenant", back_populates="workflow_configurations")
    # integration = relationship("Integration", foreign_keys=[integration_id])


class OnboardingRequest(Base):
    """Onboarding request for agents (can be approved/reviewed/denied)"""
    __tablename__ = "onboarding_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Human-readable request number (e.g., AI-1, AI-2, AI-3)
    request_number = Column(String(50), nullable=True, unique=True, index=True)
    
    # Request details
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    request_type = Column(String(50), nullable=False, default="onboarding")  # onboarding, renewal, update
    
    # Invitation tracking
    invitation_id = Column(UUID(as_uuid=True), ForeignKey("vendor_invitations.id"), nullable=True, index=True)
    business_contact_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # Person who invited the vendor
    
    # Workflow tracking
    workflow_config_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configurations.id"), nullable=True)
    workflow_engine = Column(String(50), nullable=False, default=WorkflowEngineType.INTERNAL.value)
    external_workflow_id = Column(String(255), nullable=True)  # ID in external system (ServiceNow/Jira)
    
    # Status
    status = Column(String(50), nullable=False, default="pending")  # pending, in_review, approved, rejected, cancelled
    
    # Current assignee
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    current_step = Column(Integer, default=0)
    
    # Decision details
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    rejected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Metadata
    request_metadata = Column(JSON, nullable=True)  # Additional request data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # agent = relationship("Agent", foreign_keys=[agent_id])
    # requester = relationship("User", foreign_keys=[requested_by])
    # workflow_config = relationship("WorkflowConfiguration", foreign_keys=[workflow_config_id])


class ApproverGroup(Base):
    """Approver groups for workflow assignment"""
    __tablename__ = "approver_groups"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    member_ids = Column(JSON, nullable=False)  # Array of user IDs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # tenant = relationship("Tenant", back_populates="approver_groups")

