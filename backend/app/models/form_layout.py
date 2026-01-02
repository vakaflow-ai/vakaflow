"""
Form layout models for dynamic form designer
Supports role-based field access control and screen-specific layouts
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class RequestType(str, enum.Enum):
    """
    Request types - workflow types aligned with ServiceNow request types
    Maps to ServiceNow tables: sc_request, sc_req_item, change_request, etc.
    """
    AGENT_ONBOARDING_WORKFLOW = "agent_onboarding_workflow"  # Agent onboarding workflow (maps to sc_request or custom table)
    VENDOR_SUBMISSION_WORKFLOW = "vendor_submission_workflow"  # Vendor submission workflow
    ASSESSMENT_WORKFLOW = "assessment_workflow"  # Assessment workflow
    # Add more workflow types as needed
    # Examples for ServiceNow integration:
    # CHANGE_REQUEST = "change_request"  # Maps to ServiceNow change_request table
    # INCIDENT = "incident"  # Maps to ServiceNow incident table
    # TASK = "task"  # Maps to ServiceNow task table


class WorkflowStage(str, enum.Enum):
    """
    Workflow stages/states within a request type - aligned with ServiceNow state values
    Maps to ServiceNow state field values: new, in_progress, pending_approval, approved, rejected, closed, etc.
    """
    NEW = "new"  # Initial/new state (ServiceNow: state=1)
    IN_PROGRESS = "in_progress"  # Work in progress (ServiceNow: state=2)
    PENDING_APPROVAL = "pending_approval"  # Waiting for approval (ServiceNow: state=3)
    APPROVED = "approved"  # Approved state (ServiceNow: state=4)
    REJECTED = "rejected"  # Rejected state (ServiceNow: state=-1)
    CLOSED = "closed"  # Closed/complete state (ServiceNow: state=7)
    CANCELLED = "cancelled"  # Cancelled state (ServiceNow: state=-2)
    # Additional ServiceNow-compatible states
    NEEDS_REVISION = "needs_revision"  # Needs revision/resubmission
    # Add more stages as needed - these can map to ServiceNow state values


class FormTypeView(str, enum.Enum):
    """Form type views"""
    APPROVER_VIEW = "approver_view"  # Approver view form
    SUBMIT_VIEW = "submit_view"  # Submit view form
    REVIEW_VIEW = "review_view"  # Review view form
    EDIT_VIEW = "edit_view"  # Edit view form


class LayoutType(str, enum.Enum):
    """
    Simplified layout types - reduces configuration complexity
    Permissions control what users see based on their role
    """
    SUBMISSION = "submission"  # For initial submission and resubmission (new, needs_revision stages)
    APPROVER = "approver"  # For review and approval (pending_approval, pending_review, in_progress stages)
    COMPLETED = "completed"  # For final states (approved, rejected, closed, cancelled stages)


class FormLayout(Base):
    """Form layout definition for different screens"""
    __tablename__ = "form_layouts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Layout identification
    name = Column(String(255), nullable=False)  # e.g., "Agent Submission Form", "Approver Review Form"
    request_type = Column(String(50), nullable=False)  # RequestType: agent_onboarding_workflow, vendor_submission_workflow, etc.
    workflow_stage = Column(String(255), nullable=False)  # WorkflowStage: new, in_progress, pending_approval, approved, etc. (ServiceNow-compatible) - DEPRECATED: kept for backward compatibility. Supports comma-separated values for multiple stages
    layout_type = Column(String(255), nullable=True)  # LayoutType: submission, approver, completed - NEW: simplified layout system. Supports comma-separated values for multiple types
    description = Column(Text, nullable=True)
    
    # ServiceNow integration fields (optional)
    servicenow_table = Column(String(100), nullable=True)  # ServiceNow table name (e.g., "sc_request", "change_request")
    servicenow_state_mapping = Column(JSON, nullable=True)  # Map workflow_stage to ServiceNow state value: {"new": 1, "in_progress": 2, "approved": 4}
    
    # Layout configuration
    sections = Column(JSON, nullable=False)  # Array of section definitions
    # Example structure:
    # [
    #   {
    #     "id": "section-1",
    #     "title": "Basic Information",
    #     "order": 1,
    #     "fields": ["field_name_1", "field_name_2"]
    #   }
    # ]
    
    # Field dependencies for conditional visibility
    # JSON structure: {"field_name": {"depends_on": "other_field", "condition": "equals", "value": "expected_value"}}
    # Example: {"deployment_details": {"depends_on": "deployment_type", "condition": "equals", "value": "on_premise"}}
    field_dependencies = Column(JSON, nullable=True)
    
    # Custom field references - array of CustomFieldCatalog IDs
    # Custom fields are stored ONLY in CustomFieldCatalog (Entity and Fields Catalog)
    # This column stores only the IDs to reference fields from the catalog (no duplication)
    # Example: ["uuid-1", "uuid-2", "uuid-3"]
    custom_field_ids = Column(JSON, nullable=True)  # Array of UUID strings referencing CustomFieldCatalog
    
    # DEPRECATED: custom_fields column - kept for backward compatibility during migration
    # Will be removed after migration to custom_field_ids
    custom_fields = Column(JSON, nullable=True)
    
    # Agent type filtering (optional - if None, applies to all agent types)
    agent_type = Column(String(100), nullable=True)  # Filter by agent type
    agent_category = Column(String(100), nullable=True)  # Filter by agent category
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default layout for this request type and workflow stage
    is_template = Column(Boolean, default=False, nullable=False)  # If True, this is a template and cannot be used in workflows directly
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FormFieldAccess(Base):
    """Role-based access control for form fields"""
    __tablename__ = "form_field_access"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Field reference (can reference submission_requirement or agent field)
    field_name = Column(String(100), nullable=False, index=True)  # Internal field name
    field_source = Column(String(50), nullable=False)  # "submission_requirement" or "agent"
    field_source_id = Column(UUID(as_uuid=True), nullable=True)  # ID of the source (if applicable)
    
    # Request type and workflow stage this access control applies to
    request_type = Column(String(50), nullable=False)  # RequestType (e.g., agent_onboarding_workflow)
    workflow_stage = Column(String(50), nullable=False)  # WorkflowStage (e.g., new, in_progress, pending_approval) - ServiceNow-compatible
    
    # Role-based permissions
    # JSON structure: {"role": {"view": true/false, "edit": true/false}}
    # Example: {"approver": {"view": true, "edit": true}, "vendor_user": {"view": true, "edit": false}}
    role_permissions = Column(JSON, nullable=False)
    
    # Override for specific agent types/categories (optional)
    agent_type = Column(String(100), nullable=True)
    agent_category = Column(String(100), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one access control per field per request type per workflow stage per tenant
    __table_args__ = (
        {'comment': 'Role-based access control for form fields'}
    )


class FormType(Base):
    """Form type configuration that maps to RequestType with different views (Workflow Layout Group)"""
    __tablename__ = "form_types"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Form type identification
    name = Column(String(255), nullable=False)  # e.g., "Vendor Submission Layout"
    request_type = Column(String(50), nullable=False)  # RequestType: agent_onboarding_workflow, etc.
    description = Column(Text, nullable=True)
    
    # Business Process to Workflow Mapping
    workflow_config_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Link to WorkflowConfiguration
    
    # Covered Entities (Preselected in config)
    # List of entity names: ["users", "agent", "vendor", "master_data", "workflow_ticket"]
    covered_entities = Column(JSON, nullable=False, default=list)
    
    # Stage mappings: maps workflow stages to FormLayout IDs (the "Steps")
    # JSON structure: {
    #   "submission": {"layout_id": "uuid-1", "name": "Form 1"},
    #   "approval": {"layout_id": "uuid-2", "name": "Form 2"},
    #   "rejection": {"layout_id": "uuid-1", "name": "Form 1"},
    #   "completion": {"layout_id": "uuid-1", "name": "Form 1"}
    # }
    stage_mappings = Column(JSON, nullable=False, default=dict)
    
    # ServiceNow integration configuration
    servicenow_table = Column(String(100), nullable=True)
    servicenow_state_mapping = Column(JSON, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # Note: view_mappings contains FormLayout IDs, so we can query layouts separately
    
    __table_args__ = (
        {'comment': 'Form type configuration mapping request types (workflows) to form layouts for different workflow stages'}
    )
