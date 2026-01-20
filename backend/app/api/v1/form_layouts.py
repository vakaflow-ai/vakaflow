"""
Form layout API endpoints
Allows tenant admins to configure form layouts and role-based field access

IMPORTANT: Custom fields are stored ONLY in CustomFieldCatalog (Entity and Fields Catalog).
FormLayout.custom_field_ids stores only references (UUIDs) to avoid duplication.
Permissions come from Entity and Fields Catalog as the source of truth.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.form_layout import FormLayout, FormFieldAccess, RequestType, WorkflowStage, LayoutType, FormType
from app.models.forms import Form
from app.services.layout_type_mapper import get_layout_type_for_stage
from app.models.user import User, UserRole
from app.models.custom_field import CustomFieldCatalog
from app.models.master_data_list import MasterDataList
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)


def get_workflow_types_from_master_data(db: Session, tenant_id: UUID) -> List[str]:
    """Get active workflow types from master data"""
    try:
        master_list = db.query(MasterDataList).filter(
            MasterDataList.tenant_id == tenant_id,
            MasterDataList.list_type == "workflow_type",
            MasterDataList.is_active == True
        ).first()
        
        if not master_list or not master_list.values:
            return []
        
        # Extract active values
        active_values = [
            v.get('value') for v in master_list.values 
            if isinstance(v, dict) and v.get('is_active', True) and v.get('value')
        ]
        return active_values
    except Exception as e:
        logger.warning(f"Error fetching workflow types from master data: {e}")
        return []


def validate_workflow_type(db: Session, tenant_id: UUID, request_type: str) -> bool:
    """Validate that request_type is a valid workflow type from master data or has seeded layouts"""
    valid_types = get_workflow_types_from_master_data(db, tenant_id)
    
    # If master data has values, use strict validation
    if valid_types:
        return request_type in valid_types
    
    # If master data is empty, check if layouts exist for this request_type (seeded layouts)
    existing_layout = db.query(FormLayout).filter(
        FormLayout.tenant_id == tenant_id,
        FormLayout.request_type == request_type
    ).first()
    
    if existing_layout:
        logger.info(
            f"Allowing request_type '{request_type}' because layouts exist for it "
            f"(master data is empty for tenant {tenant_id})"
        )
        return True
    
    return False


def _get_active_layout_internal(
    db: Session,
    effective_tenant_id: UUID,
    request_type: str,
    workflow_stage: str,
    agent_type: Optional[str] = None,
    agent_category: Optional[str] = None,
    current_user: Optional[User] = None
) -> Optional[FormLayout]:
    """
    Internal helper function to get active layout for a stage.
    Returns FormLayout model (not FormLayoutResponse).
    Layouts must be seeded - no fallback logic.
    """
    # Map workflow stage to layout type
    layout_type = get_layout_type_for_stage(workflow_stage)
    
    # Baseline filters
    base_filter = [
        FormLayout.tenant_id == effective_tenant_id,
        FormLayout.request_type == request_type,
        FormLayout.is_active == True,
        FormLayout.is_template == False
    ]

    # Try to find layout by layout_type and workflow_stage
    from sqlalchemy import or_
    type_query = db.query(FormLayout).filter(
        *base_filter,
        or_(
            FormLayout.layout_type == layout_type,
            FormLayout.layout_type.like(f"%,{layout_type}%"),
            FormLayout.layout_type.like(f"%{layout_type},%"),
            FormLayout.workflow_stage == workflow_stage,
            FormLayout.workflow_stage.like(f"%{workflow_stage}%")
        )
    )
    
    if agent_type:
        # Try agent-specific first
        layout = type_query.filter(FormLayout.agent_type == agent_type).first()
        if not layout:
            # General layout for this type
            layout = type_query.filter(FormLayout.agent_type.is_(None)).first()
    else:
        layout = type_query.filter(FormLayout.agent_type.is_(None)).first()
    
    # If not found, try default layout for this request_type
    if not layout:
        layout = db.query(FormLayout).filter(
            *base_filter,
            FormLayout.is_default == True
        ).first()
    
    return layout


router = APIRouter(prefix="/form-layouts", tags=["form-layouts"])


class SectionDefinition(BaseModel):
    """Section definition schema"""
    id: str
    title: str
    order: int
    fields: List[str]  # List of field names
    description: Optional[str] = None
    required_fields: Optional[List[str]] = []  # List of required field names


class FieldDependency(BaseModel):
    """Field dependency schema - supports conditional visibility, loading, and mandatory fields"""
    depends_on: str  # Field name this field depends on
    condition: str = Field(..., pattern="^(equals|not_equals|contains|not_contains|greater_than|less_than|is_empty|is_not_empty|in|not_in)$")
    value: Optional[Any] = None  # Value to compare against
    action: str = Field(default="show", pattern="^(show|hide|load|mandatory|optional)$")  # Action: show/hide visibility, load conditionally, make mandatory/optional
    load_on_condition: Optional[bool] = False  # If True, field is only loaded when condition is met
    make_mandatory: Optional[bool] = False  # If True, field becomes required when condition is met


class AgentFieldDefinition(BaseModel):
    """Field definition schema - supports all entity types, master data, entity business owner, and logged-in user profile"""
    field_name: str
    field_type: str  # text, textarea, number, select, multi_select, checkbox, json, date, email, url
    label: str  # Human-readable label
    description: Optional[str] = None
    source: str = "agent"  # "agent", "agent_metadata", "entity:<entity_name>", "master_data:<list_type>", "entity_business_owner", "logged_in_user"
    entity_name: Optional[str] = None  # Entity name if from EntityFieldRegistry (e.g., "agents", "vendors", "users")
    entity_label: Optional[str] = None  # Human-readable entity label
    entity_user_level: Optional[str] = "business"  # "business", "advanced", or "system"
    master_data_list_id: Optional[str] = None  # Master data list ID if field is bound to master data
    master_data_list_type: Optional[str] = None  # Master data list type (e.g., "country", "industry")
    field_config: Optional[Dict[str, Any]] = None  # Field configuration from EntityFieldRegistry.field_config (options, placeholder, validation, etc.)
    # Conditional visibility based on LOGGED-IN USER attributes (the person filling the form)
    # These conditions check the current user's attributes, not the entity owner's attributes
    visible_if_user_position: Optional[List[str]] = None  # Show field only if logged-in user's position/role is in this list (e.g., ["Manager", "Director"])
    visible_if_user_role: Optional[List[str]] = None  # Show field only if logged-in user's role is in this list
    visible_if_user_department: Optional[List[str]] = None  # Show field only if logged-in user's department is in this list


class CustomField(BaseModel):
    """Custom field definition schema"""
    field_name: str
    field_type: str = Field(..., pattern="^(file_upload|external_link|text|textarea|select|multi_select|number|date|email|url|mermaid_diagram|json|rich_text|architecture_diagram|visualization|dependent_select|assessment_response_grid)$")
    label: str
    description: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: Optional[bool] = False
    accepted_file_types: Optional[str] = None
    link_text: Optional[str] = None
    master_data_list_id: Optional[str] = None  # ID of master data list to bind to
    options: Optional[List[Dict[str, str]]] = None  # Static options: [{"value": "opt1", "label": "Option 1"}]


class FormLayoutCreate(BaseModel):
    """Create form layout schema
    
    Note: custom_field_ids should be used instead of custom_fields.
    Custom fields are stored ONLY in CustomFieldCatalog to avoid duplication.
    
    layout_type and workflow_stage can be comma-separated strings to support multiple stages.
    Example: layout_type="submission,approver" or workflow_stage="new,pending_approval"
    
    If request_type is not provided or is_template is True, saves to Forms entity (forms library).
    Otherwise, saves to FormLayout entity (for processes).
    """
    name: str = Field(..., min_length=1, max_length=255)
    request_type: Optional[str] = None  # Optional - if not provided, saves to Forms entity
    workflow_stage: Optional[str] = Field(None, pattern="^((new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision)(,(new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision))*)?$")
    layout_type: Optional[str] = Field(None, pattern="^((submission|approver)(,(submission|approver))*)?$", description="Layout type: 'submission' (for submission/rejection stages) or 'approver' (for approval/completed stages). 'rejection' and 'completed' are deprecated and map to 'submission' and 'approver' respectively.")
    servicenow_table: Optional[str] = None  # ServiceNow table name (e.g., "sc_request", "change_request")
    servicenow_state_mapping: Optional[Dict[str, int]] = None  # Map workflow_stage to ServiceNow state value
    description: Optional[str] = None
    sections: List[SectionDefinition]
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None
    field_dependencies: Optional[Dict[str, FieldDependency]] = None
    custom_field_ids: Optional[List[str]] = None  # Array of CustomFieldCatalog UUIDs
    is_default: bool = False
    is_template: bool = False


class FormLayoutUpdate(BaseModel):
    """Update form layout schema
    
    Note: custom_field_ids should be used instead of custom_fields.
    Custom fields are stored ONLY in CustomFieldCatalog to avoid duplication.
    
    layout_type and workflow_stage can be comma-separated strings to support multiple stages.
    Example: layout_type="submission,approver" or workflow_stage="new,pending_approval"
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    layout_type: Optional[str] = Field(None, pattern="^((submission|approver)(,(submission|approver))*)?$", description="Layout type: 'submission' (for submission/rejection stages) or 'approver' (for approval/completed stages). 'rejection' and 'completed' are deprecated and map to 'submission' and 'approver' respectively.")  # NEW: Simplified layout type. Supports comma-separated values
    workflow_stage: Optional[str] = Field(None, pattern="^((new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision)(,(new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision))*)?$")  # Supports comma-separated values
    servicenow_table: Optional[str] = None
    servicenow_state_mapping: Optional[Dict[str, int]] = None
    sections: Optional[List[SectionDefinition]] = None
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None
    field_dependencies: Optional[Dict[str, FieldDependency]] = None
    custom_field_ids: Optional[List[str]] = None  # Array of CustomFieldCatalog UUIDs
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    is_template: Optional[bool] = None


class FormLayoutResponse(BaseModel):
    """Form layout response schema
    
    Note: custom_fields are resolved from CustomFieldCatalog using custom_field_ids.
    This ensures no duplication - custom fields are stored ONLY in the catalog.
    """
    id: Any
    tenant_id: Any
    name: str
    request_type: str
    workflow_stage: Optional[str] = "new"
    layout_type: Optional[str] = None
    description: Optional[str] = None
    servicenow_table: Optional[str] = None
    servicenow_state_mapping: Optional[Dict[str, int]] = None
    sections: List[Dict[str, Any]] = []
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None
    field_dependencies: Optional[Dict[str, Dict[str, Any]]] = None
    custom_field_ids: Optional[List[str]] = None  # Array of CustomFieldCatalog UUIDs
    custom_fields: Optional[List[Dict[str, Any]]] = None  # Resolved from catalog
    is_active: bool
    is_default: bool
    is_template: bool = False
    created_by: Optional[str] = None
    created_at: Any
    updated_at: Any
    
    class Config:
        from_attributes = True


class WorkflowLayoutGroupCreate(BaseModel):
    """Create a workflow layout group (FormType)"""
    name: str
    request_type: str
    description: Optional[str] = None
    covered_entities: List[str] = ["users", "agent", "vendor", "master_data", "workflow_ticket"]
    stage_mappings: Dict[str, Dict[str, Any]] = {}
    is_default: bool = False


class WorkflowLayoutGroupUpdate(BaseModel):
    """Update a workflow layout group"""
    name: Optional[str] = None
    request_type: Optional[str] = None  # Allow updating workflow context
    workflow_config_id: Optional[UUID] = None  # Business process to workflow mapping
    description: Optional[str] = None
    covered_entities: Optional[List[str]] = None
    stage_mappings: Optional[Dict[str, Dict[str, Any]]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class WorkflowLayoutGroupResponse(BaseModel):
    """Workflow layout group response"""
    id: Any
    tenant_id: Any
    name: str
    request_type: str
    workflow_config_id: Optional[str] = None  # Business process to workflow mapping
    description: Optional[str] = None
    covered_entities: List[str] = []
    stage_mappings: Dict[str, Any] = {}
    is_active: bool
    is_default: bool
    created_at: Any
    updated_at: Any

    class Config:
        from_attributes = True


class RolePermission(BaseModel):
    """Role permission schema"""
    view: bool
    edit: bool


class FieldAccessCreate(BaseModel):
    """Create field access control schema"""
    field_name: str = Field(..., min_length=1, max_length=100)
    field_source: str = Field(..., pattern="^(submission_requirement|agent)$")
    field_source_id: Optional[str] = None
    request_type: Any # Can be str or List[str]
    workflow_stage: Any # Can be str or List[str]
    role_permissions: Dict[str, Dict[str, bool]]  # {"role": {"view": bool, "edit": bool}}
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None


class FieldAccessUpdate(BaseModel):
    """Update field access control schema"""
    role_permissions: Optional[Dict[str, Dict[str, bool]]] = None
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None
    is_active: Optional[bool] = None


class FieldAccessResponse(BaseModel):
    """Field access response schema"""
    id: Any
    tenant_id: Any
    field_name: str
    field_source: str
    field_source_id: Optional[str]
    request_type: str
    workflow_stage: str = "new"
    role_permissions: Dict[str, Dict[str, bool]] = {}
    agent_type: Optional[str] = None
    agent_category: Optional[str] = None
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class FieldAccessForRole(BaseModel):
    """Field access information for a specific role"""
    field_name: str
    can_view: bool
    can_edit: bool
    field_source: str
    field_source_id: Optional[str]


class LayoutWithAccess(BaseModel):
    """Layout with field access information"""
    layout: FormLayoutResponse
    field_access: List[FieldAccessForRole]


def require_layout_management_permission(current_user: User = Depends(get_current_user)) -> User:
    """Require permission to manage form layouts"""
    allowed_roles = ["tenant_admin", "platform_admin"]
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Layout management access required. Your role: {user_role}"
        )
    return current_user


def resolve_custom_fields_from_catalog(
    db: Session,
    tenant_id: UUID,
    custom_field_ids: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Resolve custom fields from CustomFieldCatalog.
    
    Custom fields are stored ONLY in the catalog (no duplication).
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        custom_field_ids: Array of CustomFieldCatalog UUIDs
    
    Returns:
        List of resolved custom field definitions
    """
    resolved_fields = []
    
    if not tenant_id or not custom_field_ids:
        return resolved_fields
    
    for field_id_str in custom_field_ids:
        try:
            field_id = UUID(field_id_str)
            field = db.query(CustomFieldCatalog).filter(
                CustomFieldCatalog.id == field_id,
                CustomFieldCatalog.tenant_id == tenant_id,
                CustomFieldCatalog.is_enabled == True
            ).first()
            
            if field:
                resolved_fields.append({
                    "id": str(field.id),
                    "field_name": field.field_name,
                    "field_type": field.field_type,
                    "label": field.label,
                    "description": field.description,
                    "placeholder": field.placeholder,
                    "is_required": field.is_required,
                    "accepted_file_types": field.accepted_file_types,
                    "link_text": field.link_text,
                    "master_data_list_id": str(field.master_data_list_id) if field.master_data_list_id else None,
                    "options": field.options,
                    "role_permissions": field.role_permissions or {},
                    "created_at": field.created_at.isoformat() if field.created_at else None,
                    "updated_at": field.updated_at.isoformat() if field.updated_at else None,
                })
        except (ValueError, TypeError):
            logger.warning(f"Invalid custom field ID: {field_id_str}")
            continue
    
    return resolved_fields


@router.post("", response_model=FormLayoutResponse, status_code=status.HTTP_201_CREATED)
async def create_layout(
    layout_data: FormLayoutCreate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new form layout or form
    
    If request_type is not provided or is_template is True, saves to Forms entity (forms library).
    Otherwise, saves to FormLayout entity (for processes).
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Determine if this is a form (saved to Forms entity) or a process (saved to FormLayout)
    # Forms are workflow-agnostic and don't need request_type
    # Check if is_template is explicitly True, or if request_type is not provided or is empty
    is_template_value = layout_data.is_template
    request_type_value = layout_data.request_type
    
    # Check if this should be saved as a form (workflow-agnostic)
    # Forms have is_template=True OR no request_type
    is_form = (is_template_value is True) or (not request_type_value or (isinstance(request_type_value, str) and request_type_value.strip() == ""))
    
    # Debug logging
    logger.info(f"Creating layout - name: {layout_data.name}, is_template: {is_template_value} (type: {type(is_template_value)}), request_type: '{request_type_value}' (type: {type(request_type_value)}), is_form: {is_form}")
    
    if is_form:
        # Save to Forms entity (forms library) - skip request_type validation
        logger.info(f"✅ Saving to Forms entity (library): {layout_data.name}")
        pass
    else:
        # Validate request_type against master data for processes
        if not validate_workflow_type(db, effective_tenant_id, layout_data.request_type):
            valid_types = get_workflow_types_from_master_data(db, effective_tenant_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request_type: {layout_data.request_type}. Valid types: {', '.join(valid_types)}"
            )
    
    # Convert sections to JSON
    sections_json = [section.dict() if hasattr(section, 'dict') else section for section in layout_data.sections]
    
    # Convert field dependencies to JSON
    field_dependencies_json = None
    if layout_data.field_dependencies:
        field_dependencies_json = {
            k: v.dict() if hasattr(v, 'dict') else v
            for k, v in layout_data.field_dependencies.items()
        }
    
    # Handle custom fields - validate custom_field_ids exist and store only IDs
    custom_field_ids_json = None
    if layout_data.custom_field_ids:
        # Validate all custom field IDs exist and belong to tenant
        for field_id_str in layout_data.custom_field_ids:
            try:
                field_id = UUID(field_id_str)
                field = db.query(CustomFieldCatalog).filter(
                    CustomFieldCatalog.id == field_id,
                    CustomFieldCatalog.tenant_id == effective_tenant_id
                ).first()
                if not field:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Custom field {field_id_str} not found or does not belong to tenant"
                    )
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid custom field ID: {field_id_str}"
                )
        custom_field_ids_json = layout_data.custom_field_ids
    
    # Determine layout_type
    layout_type = layout_data.layout_type
    if not layout_type and layout_data.workflow_stage:
        layout_type = get_layout_type_for_stage(layout_data.workflow_stage)
    elif not layout_type:
        layout_type = "submission"
    
    if is_form:
        # Save to Forms entity (forms library)
        form = Form(
            tenant_id=effective_tenant_id,
            name=layout_data.name,
            layout_type=layout_type,
            description=layout_data.description,
            sections=sections_json,
            field_dependencies=field_dependencies_json,
            custom_field_ids=custom_field_ids_json,
            is_active=True,
            created_by=current_user.id
        )
        
        db.add(form)
        db.commit()
        db.refresh(form)
        
        logger.info(f"✅ Form saved to Forms entity (library) - ID: {form.id}, Name: {form.name}, Layout Type: {form.layout_type}")
        
        # Resolve custom fields for response
        resolved_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=form.custom_field_ids
        )
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.CREATE,
            resource_type="form",
            resource_id=str(form.id),
            tenant_id=str(effective_tenant_id),
            details={"name": form.name, "layout_type": form.layout_type},
            ip_address=None,
            user_agent=None
        )
        
        # Return as FormLayoutResponse for compatibility
        return FormLayoutResponse(
            id=str(form.id),
            tenant_id=str(form.tenant_id),
            name=form.name,
            request_type="",  # Forms don't have request_type
            workflow_stage="new",  # Default
            layout_type=form.layout_type,
            description=form.description,
            sections=form.sections,
            agent_type=None,
            agent_category=None,
            custom_field_ids=form.custom_field_ids,
            custom_fields=resolved_fields,
            is_active=form.is_active,
            is_default=False,
            is_template=False,
            created_by=str(form.created_by) if form.created_by else None,
            created_at=form.created_at.isoformat() if form.created_at else None,
            updated_at=form.updated_at.isoformat() if form.updated_at else None
        )
    else:
        # Save to FormLayout entity (for processes)
        # If setting as default, unset other defaults for this request type
        # Templates cannot be default layouts
        if layout_data.is_default:
            if layout_data.is_template:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Template layouts cannot be set as default"
                )
            db.query(FormLayout).filter(
                FormLayout.tenant_id == effective_tenant_id,
                FormLayout.request_type == layout_data.request_type,
                FormLayout.is_default == True
            ).update({"is_default": False})
        
        # Use workflow_stage from request or default to "new"
        workflow_stage = layout_data.workflow_stage or "new"
        
        layout = FormLayout(
            tenant_id=effective_tenant_id,
            name=layout_data.name,
            request_type=layout_data.request_type,
            workflow_stage=workflow_stage,
            layout_type=layout_type,
            description=layout_data.description,
            servicenow_table=layout_data.servicenow_table,
            servicenow_state_mapping=layout_data.servicenow_state_mapping,
            sections=sections_json,
            agent_type=layout_data.agent_type,
            agent_category=layout_data.agent_category,
            field_dependencies=field_dependencies_json,
            custom_field_ids=custom_field_ids_json,
            is_default=layout_data.is_default,
            is_active=True,
            is_template=layout_data.is_template,
            created_by=current_user.id
        )
        
        db.add(layout)
        db.commit()
        db.refresh(layout)
        
        # Resolve custom fields for response
        resolved_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=layout.custom_field_ids
        )
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.CREATE,
            resource_type="form_layout",
            resource_id=str(layout.id),
            tenant_id=str(effective_tenant_id),
            details={"name": layout.name, "request_type": layout.request_type, "workflow_stage": layout.workflow_stage},
            ip_address=None,
            user_agent=None
        )
        
        return FormLayoutResponse(
            id=str(layout.id),
            tenant_id=str(layout.tenant_id),
            name=layout.name,
            request_type=layout.request_type,
            workflow_stage=layout.workflow_stage,
            layout_type=getattr(layout, 'layout_type', None),  # Include layout_type
            description=layout.description,
            servicenow_table=layout.servicenow_table,
            servicenow_state_mapping=layout.servicenow_state_mapping,
            sections=layout.sections,
            agent_type=layout.agent_type,
            agent_category=layout.agent_category,
            custom_field_ids=layout.custom_field_ids,
            custom_fields=resolved_fields,
            is_active=layout.is_active,
            is_default=layout.is_default,
            is_template=layout.is_template,
            created_by=str(layout.created_by) if layout.created_by else None,
            created_at=layout.created_at.isoformat() if layout.created_at else None,
            updated_at=layout.updated_at.isoformat() if layout.updated_at else None
        )


@router.get("", response_model=List[FormLayoutResponse])
async def list_layouts(
    request_type: Optional[str] = Query(None),  # Validated dynamically against master data
    workflow_stage: Optional[str] = Query(None, pattern="^(new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision)$"),
    agent_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List form layouts for current tenant"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Validate request_type against master data if provided
    if request_type and not validate_workflow_type(db, effective_tenant_id, request_type):
        valid_types = get_workflow_types_from_master_data(db, effective_tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request_type: {request_type}. Valid types: {', '.join(valid_types)}"
        )
    
    query = db.query(FormLayout).filter(
        FormLayout.tenant_id == effective_tenant_id,
        FormLayout.is_template == False  # IMPORTANT: Always exclude templates from list
    )
    
    if request_type:
        query = query.filter(FormLayout.request_type == request_type)
    if workflow_stage:
        query = query.filter(FormLayout.workflow_stage == workflow_stage)
    if agent_type:
        query = query.filter(FormLayout.agent_type == agent_type)
    if is_active is not None:
        query = query.filter(FormLayout.is_active == is_active)
    
    layouts = query.order_by(
        FormLayout.request_type,
        FormLayout.workflow_stage,
        FormLayout.is_default.desc(),
        FormLayout.name
    ).all()
    
    # Ensure only one default per request_type (fix any inconsistencies)
    defaults_by_type: Dict[str, List[FormLayout]] = {}
    for layout in layouts:
        if layout.is_default:
            if layout.request_type not in defaults_by_type:
                defaults_by_type[layout.request_type] = []
            defaults_by_type[layout.request_type].append(layout)
    
    # For each request_type with multiple defaults, keep only the first one (by created_at)
    fixed_any = False
    for request_type, type_layouts in defaults_by_type.items():
        if len(type_layouts) > 1:
            # Sort by created_at, keep the oldest one as default
            type_layouts.sort(key=lambda x: x.created_at)
            # Unset all except the first one
            for layout in type_layouts[1:]:
                layout.is_default = False
                fixed_any = True
    
    if fixed_any:
        db.commit()
        logger.info(f"Fixed multiple defaults in list_layouts for tenant {current_user.tenant_id}")
        # Re-fetch layouts after fixing
    layouts = query.order_by(
        FormLayout.request_type,
        FormLayout.workflow_stage,
        FormLayout.is_default.desc(),
        FormLayout.name
    ).all()
    
    # Resolve custom fields for all layouts
    result = []
    for l in layouts:
        # Resolve custom fields from catalog
        layout_custom_field_ids = getattr(l, 'custom_field_ids', None)
        resolved_custom_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=layout_custom_field_ids
        )
        
        result.append(FormLayoutResponse(
            id=str(l.id),
            tenant_id=str(l.tenant_id),
            name=l.name,
            request_type=l.request_type,
            workflow_stage=l.workflow_stage,
            layout_type=getattr(l, 'layout_type', None),  # Include layout_type
            description=l.description,
            servicenow_table=l.servicenow_table,
            servicenow_state_mapping=l.servicenow_state_mapping,
            sections=l.sections,
            agent_type=l.agent_type,
            agent_category=l.agent_category,
            field_dependencies=l.field_dependencies,
            custom_field_ids=getattr(l, 'custom_field_ids', None),  # Store IDs (handle missing column)
            custom_fields=resolved_custom_fields,  # Resolved from catalog
            is_active=l.is_active,
            is_default=l.is_default,
            created_by=str(l.created_by) if l.created_by else None,
            created_at=l.created_at.isoformat(),
            updated_at=l.updated_at.isoformat()
        ))
    
    return result


# Workflow types endpoint - get from master data
@router.get("/workflow-types", response_model=List[Dict[str, Any]])
async def get_workflow_types(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available workflow types from master data, including selection_type"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.models.master_data_list import MasterDataList
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    try:
        master_list = db.query(MasterDataList).filter(
            MasterDataList.tenant_id == effective_tenant_id,
            MasterDataList.list_type == "workflow_type",
            MasterDataList.is_active == True
        ).first()
        
        if not master_list or not master_list.values:
            return []
        
        # Return active values, sorted by order, with selection_type from the master list
        active_values = [
            {**v, 'selection_type': getattr(master_list, 'selection_type', 'single')} 
            for v in master_list.values 
            if isinstance(v, dict) and v.get('is_active', True)
        ]
        active_values.sort(key=lambda x: x.get('order', 0))
        return active_values
    except Exception as e:
        logger.warning(f"Error fetching workflow types from master data: {e}")
        return []


# Available fields endpoint - MUST come before /{layout_id} route
@router.get("/available-fields")
async def get_available_fields(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all available fields from:
    - EntityFieldRegistry (all entity types: agents, vendors, users, assessments, etc.)
    - SubmissionRequirements
    - CustomFieldCatalog
    - MasterDataLists (as selectable fields)
    - Entity Business Owner attributes (owner/contact of the entity being submitted)
    - Logged-in User attributes (current user filling the form)
    
    Returns fields grouped by source (entity).
    Supports conditional visibility based on logged-in user's position/role/department.
    
    IMPORTANT: Conditional visibility checks match against the LOGGED-IN USER's attributes
    (the person filling the form), not the entity business owner's attributes.
    """
    from app.models.submission_requirement import SubmissionRequirement
    from app.models.entity_field import EntityFieldRegistry
    from app.models.custom_field import CustomFieldCatalog
    from app.models.master_data_list import MasterDataList
    from app.core.tenant_utils import get_effective_tenant_id
    
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    result: Dict[str, List[AgentFieldDefinition]] = {
        "submission_requirements": [],
        "agent": [],
        "agent_metadata": [],
        "custom_fields": [],
        "entity_fields": {},  # All other entity types grouped by entity_name
        "master_data": [],  # Master data lists as selectable fields
        "entity_business_owner": [],  # Entity business owner/contact attributes (vendor contact, agent owner, assessment owner, etc.)
        "logged_in_user": [],  # Logged-in user attributes (current user filling the form)
        "workflow_ticket": []  # NEW: Workflow ticket fields (ticket.id, ticket.status, etc.)
    }
    
    # Get submission requirements (these are entities, not fields in the registry)
    requirements = db.query(SubmissionRequirement).filter(
        SubmissionRequirement.tenant_id == effective_tenant_id,
        SubmissionRequirement.is_active == True,
        SubmissionRequirement.is_enabled == True
    ).all()
    
    for req in requirements:
        result["submission_requirements"].append(AgentFieldDefinition(
            field_name=req.field_name,  # Computed property from catalog_id
            field_type=req.field_type,
            label=req.label,  # Title
            description=req.description,  # Description
            source="submission_requirement"
        ))
    
    # Get agent fields from EntityFieldRegistry
    # Filter by visibility configuration - only show fields visible in Form Designer
    agent_fields_query = db.query(EntityFieldRegistry).filter(
        EntityFieldRegistry.entity_name == "agents",
        EntityFieldRegistry.visible_in_form_designer == True,  # Only show visible fields
        EntityFieldRegistry.is_enabled == True,
        EntityFieldRegistry.is_custom == False
    )
    
    # Filter by tenant_id - get tenant-specific and platform-wide fields
    agent_fields_query = agent_fields_query.filter(
        (EntityFieldRegistry.tenant_id == effective_tenant_id) | 
        (EntityFieldRegistry.tenant_id.is_(None))
    )
    
    agent_fields = agent_fields_query.order_by(EntityFieldRegistry.field_name).all()
    
    # Define hardcoded options for agent fields (should be synced with master data)
    AGENT_TYPE_OPTIONS = [
        {"value": "AI_AGENT", "label": "AI Agent"},
        {"value": "BOT", "label": "Bot"},
        {"value": "AUTOMATION", "label": "Automation"},
        {"value": "API_SERVICE", "label": "API Service"}
    ]
    
    AGENT_CATEGORY_OPTIONS = [
        {"value": "Security & Compliance", "label": "Security & Compliance"},
        {"value": "Financial Trading", "label": "Financial Trading"},
        {"value": "Healthcare", "label": "Healthcare"},
        {"value": "Customer Support", "label": "Customer Support"},
        {"value": "Sales & Marketing", "label": "Sales & Marketing"},
        {"value": "Human Resources", "label": "Human Resources"},
        {"value": "IT Operations", "label": "IT Operations"},
        {"value": "Data Analytics", "label": "Data Analytics"},
        {"value": "E-commerce", "label": "E-commerce"},
        {"value": "Education", "label": "Education"},
        {"value": "Legal", "label": "Legal"},
        {"value": "Real Estate", "label": "Real Estate"},
        {"value": "Manufacturing", "label": "Manufacturing"},
        {"value": "Supply Chain", "label": "Supply Chain"},
        {"value": "Energy & Utilities", "label": "Energy & Utilities"},
        {"value": "Telecommunications", "label": "Telecommunications"},
        {"value": "Transportation", "label": "Transportation"},
        {"value": "Government", "label": "Government"},
        {"value": "Non-Profit", "label": "Non-Profit"},
        {"value": "Research & Development", "label": "Research & Development"},
        {"value": "Entertainment", "label": "Entertainment"},
        {"value": "Media & Publishing", "label": "Media & Publishing"},
        {"value": "Insurance", "label": "Insurance"},
        {"value": "Banking", "label": "Banking"},
        {"value": "Retail", "label": "Retail"},
        {"value": "Hospitality", "label": "Hospitality"},
        {"value": "Agriculture", "label": "Agriculture"},
        {"value": "Construction", "label": "Construction"},
        {"value": "Aerospace", "label": "Aerospace"},
        {"value": "Defense", "label": "Defense"},
        {"value": "Automotive", "label": "Automotive"},
        {"value": "Pharmaceuticals", "label": "Pharmaceuticals"},
        {"value": "Biotechnology", "label": "Biotechnology"},
        {"value": "Other", "label": "Other"}
    ]
    
    # Category to subcategory mapping (for dependent select)
    AGENT_SUBCATEGORY_OPTIONS = {
        "Security & Compliance": [
            {"value": "IT Security", "label": "IT Security"},
            {"value": "OT Security", "label": "OT Security"},
            {"value": "Physical Security", "label": "Physical Security"},
            {"value": "Information Security", "label": "Information Security"},
            {"value": "Cybersecurity", "label": "Cybersecurity"},
            {"value": "Network Security", "label": "Network Security"},
            {"value": "Cloud Security", "label": "Cloud Security"},
            {"value": "Application Security", "label": "Application Security"},
            {"value": "Data Security", "label": "Data Security"},
            {"value": "Compliance Management", "label": "Compliance Management"},
            {"value": "Risk Management", "label": "Risk Management"},
            {"value": "Audit & Assessment", "label": "Audit & Assessment"},
            {"value": "Identity & Access Management", "label": "Identity & Access Management"},
            {"value": "Security Operations", "label": "Security Operations"},
            {"value": "Other", "label": "Other"}
        ],
        "Financial Trading": [
            {"value": "Algorithmic Trading", "label": "Algorithmic Trading"},
            {"value": "High-Frequency Trading", "label": "High-Frequency Trading"},
            {"value": "Risk Management", "label": "Risk Management"},
            {"value": "Portfolio Management", "label": "Portfolio Management"},
            {"value": "Market Analysis", "label": "Market Analysis"},
            {"value": "Trade Execution", "label": "Trade Execution"},
            {"value": "Regulatory Compliance", "label": "Regulatory Compliance"},
            {"value": "Other", "label": "Other"}
        ],
        "Healthcare": [
            {"value": "Clinical Decision Support", "label": "Clinical Decision Support"},
            {"value": "Patient Care", "label": "Patient Care"},
            {"value": "Medical Records", "label": "Medical Records"},
            {"value": "Telemedicine", "label": "Telemedicine"},
            {"value": "Medical Imaging", "label": "Medical Imaging"},
            {"value": "Pharmacy Management", "label": "Pharmacy Management"},
            {"value": "Health Data Analytics", "label": "Health Data Analytics"},
            {"value": "Regulatory Compliance", "label": "Regulatory Compliance"},
            {"value": "Other", "label": "Other"}
        ],
        "Customer Support": [
            {"value": "Help Desk", "label": "Help Desk"},
            {"value": "Live Chat", "label": "Live Chat"},
            {"value": "Ticket Management", "label": "Ticket Management"},
            {"value": "Customer Service", "label": "Customer Service"},
            {"value": "FAQ Management", "label": "FAQ Management"},
            {"value": "Customer Feedback", "label": "Customer Feedback"},
            {"value": "Other", "label": "Other"}
        ],
        "Sales & Marketing": [
            {"value": "Lead Generation", "label": "Lead Generation"},
            {"value": "CRM", "label": "CRM"},
            {"value": "Email Marketing", "label": "Email Marketing"},
            {"value": "Social Media Marketing", "label": "Social Media Marketing"},
            {"value": "Content Marketing", "label": "Content Marketing"},
            {"value": "Sales Automation", "label": "Sales Automation"},
            {"value": "Market Research", "label": "Market Research"},
            {"value": "Other", "label": "Other"}
        ],
        "Human Resources": [
            {"value": "Recruitment", "label": "Recruitment"},
            {"value": "Talent Management", "label": "Talent Management"},
            {"value": "Performance Management", "label": "Performance Management"},
            {"value": "Payroll", "label": "Payroll"},
            {"value": "Benefits Administration", "label": "Benefits Administration"},
            {"value": "Employee Engagement", "label": "Employee Engagement"},
            {"value": "Learning & Development", "label": "Learning & Development"},
            {"value": "Other", "label": "Other"}
        ],
        "IT Operations": [
            {"value": "Infrastructure Management", "label": "Infrastructure Management"},
            {"value": "DevOps", "label": "DevOps"},
            {"value": "Cloud Operations", "label": "Cloud Operations"},
            {"value": "Monitoring & Alerting", "label": "Monitoring & Alerting"},
            {"value": "Incident Management", "label": "Incident Management"},
            {"value": "Configuration Management", "label": "Configuration Management"},
            {"value": "Automation", "label": "Automation"},
            {"value": "Other", "label": "Other"}
        ],
        "Data Analytics": [
            {"value": "Business Intelligence", "label": "Business Intelligence"},
            {"value": "Data Visualization", "label": "Data Visualization"},
            {"value": "Predictive Analytics", "label": "Predictive Analytics"},
            {"value": "Machine Learning", "label": "Machine Learning"},
            {"value": "Data Warehousing", "label": "Data Warehousing"},
            {"value": "ETL", "label": "ETL"},
            {"value": "Reporting", "label": "Reporting"},
            {"value": "Other", "label": "Other"}
        ],
        "E-commerce": [
            {"value": "Online Store", "label": "Online Store"},
            {"value": "Payment Processing", "label": "Payment Processing"},
            {"value": "Inventory Management", "label": "Inventory Management"},
            {"value": "Order Management", "label": "Order Management"},
            {"value": "Shipping & Logistics", "label": "Shipping & Logistics"},
            {"value": "Product Recommendations", "label": "Product Recommendations"},
            {"value": "Other", "label": "Other"}
        ],
        "Education": [
            {"value": "Learning Management", "label": "Learning Management"},
            {"value": "Student Information Systems", "label": "Student Information Systems"},
            {"value": "Online Learning", "label": "Online Learning"},
            {"value": "Assessment & Testing", "label": "Assessment & Testing"},
            {"value": "Curriculum Management", "label": "Curriculum Management"},
            {"value": "Other", "label": "Other"}
        ],
        "Legal": [
            {"value": "Contract Management", "label": "Contract Management"},
            {"value": "Document Review", "label": "Document Review"},
            {"value": "Case Management", "label": "Case Management"},
            {"value": "Compliance", "label": "Compliance"},
            {"value": "Legal Research", "label": "Legal Research"},
            {"value": "Other", "label": "Other"}
        ],
        "Real Estate": [
            {"value": "Property Management", "label": "Property Management"},
            {"value": "Real Estate Listings", "label": "Real Estate Listings"},
            {"value": "Transaction Management", "label": "Transaction Management"},
            {"value": "Market Analysis", "label": "Market Analysis"},
            {"value": "Other", "label": "Other"}
        ],
        "Manufacturing": [
            {"value": "Production Planning", "label": "Production Planning"},
            {"value": "Quality Control", "label": "Quality Control"},
            {"value": "Supply Chain", "label": "Supply Chain"},
            {"value": "Inventory Management", "label": "Inventory Management"},
            {"value": "Equipment Management", "label": "Equipment Management"},
            {"value": "Other", "label": "Other"}
        ],
        "Supply Chain": [
            {"value": "Logistics", "label": "Logistics"},
            {"value": "Warehouse Management", "label": "Warehouse Management"},
            {"value": "Transportation", "label": "Transportation"},
            {"value": "Procurement", "label": "Procurement"},
            {"value": "Demand Planning", "label": "Demand Planning"},
            {"value": "Other", "label": "Other"}
        ],
        "Energy & Utilities": [
            {"value": "Grid Management", "label": "Grid Management"},
            {"value": "Energy Trading", "label": "Energy Trading"},
            {"value": "Renewable Energy", "label": "Renewable Energy"},
            {"value": "Smart Metering", "label": "Smart Metering"},
            {"value": "Other", "label": "Other"}
        ],
        "Telecommunications": [
            {"value": "Network Management", "label": "Network Management"},
            {"value": "Service Provisioning", "label": "Service Provisioning"},
            {"value": "Customer Management", "label": "Customer Management"},
            {"value": "Billing", "label": "Billing"},
            {"value": "Other", "label": "Other"}
        ],
        "Transportation": [
            {"value": "Fleet Management", "label": "Fleet Management"},
            {"value": "Route Optimization", "label": "Route Optimization"},
            {"value": "Logistics", "label": "Logistics"},
            {"value": "Public Transit", "label": "Public Transit"},
            {"value": "Other", "label": "Other"}
        ],
        "Government": [
            {"value": "Citizen Services", "label": "Citizen Services"},
            {"value": "Public Safety", "label": "Public Safety"},
            {"value": "Administration", "label": "Administration"},
            {"value": "Regulatory", "label": "Regulatory"},
            {"value": "Other", "label": "Other"}
        ],
        "Non-Profit": [
            {"value": "Donor Management", "label": "Donor Management"},
            {"value": "Volunteer Management", "label": "Volunteer Management"},
            {"value": "Program Management", "label": "Program Management"},
            {"value": "Fundraising", "label": "Fundraising"},
            {"value": "Other", "label": "Other"}
        ],
        "Research & Development": [
            {"value": "Research Management", "label": "Research Management"},
            {"value": "Innovation", "label": "Innovation"},
            {"value": "Product Development", "label": "Product Development"},
            {"value": "Other", "label": "Other"}
        ],
        "Entertainment": [
            {"value": "Content Management", "label": "Content Management"},
            {"value": "Streaming", "label": "Streaming"},
            {"value": "Gaming", "label": "Gaming"},
            {"value": "Other", "label": "Other"}
        ],
        "Media & Publishing": [
            {"value": "Content Management", "label": "Content Management"},
            {"value": "Digital Publishing", "label": "Digital Publishing"},
            {"value": "Media Production", "label": "Media Production"},
            {"value": "Other", "label": "Other"}
        ],
        "Insurance": [
            {"value": "Claims Processing", "label": "Claims Processing"},
            {"value": "Underwriting", "label": "Underwriting"},
            {"value": "Policy Management", "label": "Policy Management"},
            {"value": "Risk Assessment", "label": "Risk Assessment"},
            {"value": "Other", "label": "Other"}
        ],
        "Banking": [
            {"value": "Core Banking", "label": "Core Banking"},
            {"value": "Digital Banking", "label": "Digital Banking"},
            {"value": "Loan Management", "label": "Loan Management"},
            {"value": "Fraud Detection", "label": "Fraud Detection"},
            {"value": "Other", "label": "Other"}
        ],
        "Retail": [
            {"value": "Point of Sale", "label": "Point of Sale"},
            {"value": "Inventory Management", "label": "Inventory Management"},
            {"value": "Customer Management", "label": "Customer Management"},
            {"value": "Other", "label": "Other"}
        ],
        "Hospitality": [
            {"value": "Hotel Management", "label": "Hotel Management"},
            {"value": "Restaurant Management", "label": "Restaurant Management"},
            {"value": "Booking Systems", "label": "Booking Systems"},
            {"value": "Other", "label": "Other"}
        ],
        "Agriculture": [
            {"value": "Farm Management", "label": "Farm Management"},
            {"value": "Crop Monitoring", "label": "Crop Monitoring"},
            {"value": "Livestock Management", "label": "Livestock Management"},
            {"value": "Other", "label": "Other"}
        ],
        "Construction": [
            {"value": "Project Management", "label": "Project Management"},
            {"value": "Resource Planning", "label": "Resource Planning"},
            {"value": "Safety Management", "label": "Safety Management"},
            {"value": "Other", "label": "Other"}
        ],
        "Aerospace": [
            {"value": "Flight Operations", "label": "Flight Operations"},
            {"value": "Maintenance", "label": "Maintenance"},
            {"value": "Safety", "label": "Safety"},
            {"value": "Other", "label": "Other"}
        ],
        "Defense": [
            {"value": "Command & Control", "label": "Command & Control"},
            {"value": "Intelligence", "label": "Intelligence"},
            {"value": "Logistics", "label": "Logistics"},
            {"value": "Other", "label": "Other"}
        ],
        "Automotive": [
            {"value": "Manufacturing", "label": "Manufacturing"},
            {"value": "Supply Chain", "label": "Supply Chain"},
            {"value": "Quality Control", "label": "Quality Control"},
            {"value": "Other", "label": "Other"}
        ],
        "Pharmaceuticals": [
            {"value": "Research", "label": "Research"},
            {"value": "Manufacturing", "label": "Manufacturing"},
            {"value": "Regulatory Compliance", "label": "Regulatory Compliance"},
            {"value": "Other", "label": "Other"}
        ],
        "Biotechnology": [
            {"value": "Research", "label": "Research"},
            {"value": "Development", "label": "Development"},
            {"value": "Manufacturing", "label": "Manufacturing"},
            {"value": "Other", "label": "Other"}
        ],
        "Other": []
    }
    
    for field in agent_fields:
        # Skip system fields
        if field.is_primary_key or field.field_name in ['id', 'created_at', 'updated_at', 'tenant_id']:
            continue
        
        # Build field_config - merge with hardcoded options if field_config doesn't have options
        field_config = field.field_config.copy() if field.field_config else {}
        
        # Determine the correct field_type to return
        # IMPORTANT: Override field_type_display based on field_config, not just use what's in DB
        final_field_type = field.field_type_display
        
        # Add options for specific fields if not already in field_config
        if field.field_name == "type":
            if "options" not in field_config or not field_config.get("options"):
                field_config["options"] = AGENT_TYPE_OPTIONS
            # ALWAYS set field_type to 'select' if we have options (override DB value)
            if field_config.get("options") and len(field_config.get("options", [])) > 0:
                final_field_type = "select"
        elif field.field_name == "category":
            if "options" not in field_config or not field_config.get("options"):
                field_config["options"] = AGENT_CATEGORY_OPTIONS
            # ALWAYS set field_type to 'select' if we have options (override DB value)
            if field_config.get("options") and len(field_config.get("options", [])) > 0:
                final_field_type = "select"
        elif field.field_name == "subcategory":
            if "dependent_options" not in field_config or not field_config.get("dependent_options"):
                # Subcategory is a dependent select - depends on category
                field_config["depends_on"] = "category"
                field_config["depends_on_label"] = "Category"
                field_config["dependent_options"] = AGENT_SUBCATEGORY_OPTIONS
            # ALWAYS set field_type to 'dependent_select' for subcategory (override DB value)
            final_field_type = "dependent_select"
        
        result["agent"].append(AgentFieldDefinition(
            field_name=field.field_name,
            field_type=final_field_type,  # This will be 'select' for type/category, 'dependent_select' for subcategory
            label=field.field_label,
            description=field.field_description,
            source="agent",
            entity_name="agents",  # Set entity_name for grouping
            entity_label=field.entity_label or "Agents",  # Set entity_label for display
            entity_user_level=field.entity_user_level or "business",
            field_config=field_config if field_config else None  # Include field configuration with options
        ))

    # Get agent_metadata fields from EntityFieldRegistry
    # Filter by visibility configuration - only show fields visible in Form Designer
    agent_metadata_query = db.query(EntityFieldRegistry).filter(
        EntityFieldRegistry.entity_name == "agent_metadata",
        EntityFieldRegistry.visible_in_form_designer == True,  # Only show visible fields
        EntityFieldRegistry.is_enabled == True,
        EntityFieldRegistry.is_custom == False
    )

    # Filter by tenant_id - get tenant-specific and platform-wide fields
    agent_metadata_query = agent_metadata_query.filter(
        (EntityFieldRegistry.tenant_id == effective_tenant_id) | 
        (EntityFieldRegistry.tenant_id.is_(None))
    )

    agent_metadata_fields = agent_metadata_query.order_by(EntityFieldRegistry.field_name).all()

    for field in agent_metadata_fields:
        if field.is_primary_key or field.field_name in ['id', 'created_at', 'updated_at', 'agent_id']:
            continue
        result["agent_metadata"].append(AgentFieldDefinition(
            field_name=field.field_name,
            field_type=field.field_type_display,
            label=field.field_label,
            description=field.field_description,
            source="agent_metadata",
            entity_name="agent_metadata",  # Set entity_name for grouping
            entity_label=field.entity_label or "Agent Metadata",  # Set entity_label for display
            entity_user_level=field.entity_user_level or "business",
            field_config=field.field_config  # Include field configuration
        ))
    
    # Get custom fields from Entity and Fields Catalog (user-created reusable fields)
    custom_fields_query = db.query(CustomFieldCatalog).filter(
        CustomFieldCatalog.tenant_id == effective_tenant_id,
        CustomFieldCatalog.is_enabled == True
    )
    
    custom_fields = custom_fields_query.order_by(CustomFieldCatalog.label).all()
    
    for field in custom_fields:
        # Build field_config from CustomFieldCatalog properties
        field_config = {}
        if field.options:
            field_config["options"] = field.options
        if field.accepted_file_types:
            field_config["accepted_file_types"] = field.accepted_file_types
        if field.link_text:
            field_config["link_text"] = field.link_text
        if field.master_data_list_id:
            field_config["master_data_list_id"] = str(field.master_data_list_id)
        if field.placeholder:
            field_config["placeholder"] = field.placeholder
        if field.is_required is not None:
            field_config["is_required"] = field.is_required
        
        result["custom_fields"].append(AgentFieldDefinition(
            field_name=field.field_name,
            field_type=field.field_type,
            label=field.label,
            description=field.description,
            source="custom_field",  # Indicates it's from the catalog
            entity_user_level="business",
            field_config=field_config if field_config else None
        ))
    
    # Get ALL entity types from EntityFieldRegistry (not just agents/agent_metadata)
    # This includes assessments, vendors, users, and all other entities
    # Fields are dynamically pulled from EntityFieldRegistry based on what's in the registry
    # Filter by visibility configuration - only show fields visible in Form Designer
    all_entities_query = db.query(EntityFieldRegistry).filter(
        EntityFieldRegistry.is_enabled == True,
        EntityFieldRegistry.visible_in_form_designer == True,  # Only show fields visible in Form Designer
        EntityFieldRegistry.entity_name.notin_(["agents", "agent_metadata"])  # Exclude already processed
    )
    
    # Filter by tenant_id - get tenant-specific and platform-wide fields
    all_entities_query = all_entities_query.filter(
        (EntityFieldRegistry.tenant_id == effective_tenant_id) | 
        (EntityFieldRegistry.tenant_id.is_(None))
    )
    
    # Exclude system fields by default (unless explicitly enabled)
    all_entities_query = all_entities_query.filter(
        (EntityFieldRegistry.is_system == False) | 
        (EntityFieldRegistry.visible_in_form_designer == True)  # Allow system fields if explicitly visible
    )
    
    all_entity_fields = all_entities_query.order_by(
        EntityFieldRegistry.entity_name,
        EntityFieldRegistry.display_order,
        EntityFieldRegistry.field_name
    ).all()
    
    # Group by entity_name - this dynamically creates groups for all entities in the registry
    # including assessments, vendors, users, etc. based on what's actually in EntityFieldRegistry
    entity_groups: Dict[str, List[AgentFieldDefinition]] = {}
    for field in all_entity_fields:
        # Skip system fields
        if field.is_primary_key or field.field_name in ['id', 'created_at', 'updated_at', 'tenant_id']:
            continue
        
        entity_name = field.entity_name
        if entity_name not in entity_groups:
            entity_groups[entity_name] = []
        
        entity_groups[entity_name].append(AgentFieldDefinition(
            field_name=field.field_name,
            field_type=field.field_type_display,
            label=field.field_label,
            description=field.field_description,
            source=f"entity:{entity_name}",
            entity_name=entity_name,
            entity_label=field.entity_label,
            entity_user_level=field.entity_user_level or "business",
            field_config=field.field_config  # Include field configuration
        ))
    
    result["entity_fields"] = entity_groups
    
    # Add special LLM fields (llm_vendor and llm_model) using generic dependent_select field type
    # These demonstrate the generic dependent_select pattern that can be used for any dependent dropdowns
    LLM_VENDORS = [
        {"value": "OpenAI", "label": "OpenAI"},
        {"value": "Anthropic", "label": "Anthropic"},
        {"value": "Google", "label": "Google"},
        {"value": "Microsoft", "label": "Microsoft"},
        {"value": "Meta", "label": "Meta"},
        {"value": "Amazon", "label": "Amazon"},
        {"value": "Cohere", "label": "Cohere"},
        {"value": "Mistral AI", "label": "Mistral AI"},
        {"value": "Customer Choice", "label": "Customer Choice"},
        {"value": "Other", "label": "Other"}
    ]
    
    LLM_VENDOR_MODELS: Dict[str, List[Dict[str, str]]] = {
        "OpenAI": [
            {"value": "GPT-4", "label": "GPT-4"},
            {"value": "GPT-4 Turbo", "label": "GPT-4 Turbo"},
            {"value": "GPT-3.5-turbo", "label": "GPT-3.5-turbo"},
            {"value": "GPT-4o", "label": "GPT-4o"}
        ],
        "Anthropic": [
            {"value": "Claude-3-Opus", "label": "Claude-3-Opus"},
            {"value": "Claude-3-Sonnet", "label": "Claude-3-Sonnet"},
            {"value": "Claude-3-Haiku", "label": "Claude-3-Haiku"}
        ],
        "Google": [
            {"value": "Gemini-Pro", "label": "Gemini-Pro"},
            {"value": "Gemini-Ultra", "label": "Gemini-Ultra"},
            {"value": "Gemini-1.5-Pro", "label": "Gemini-1.5-Pro"}
        ],
        "Microsoft": [
            {"value": "Azure OpenAI", "label": "Azure OpenAI"}
        ],
        "Meta": [
            {"value": "Llama-3", "label": "Llama-3"},
            {"value": "Llama-2", "label": "Llama-2"}
        ],
        "Amazon": [
            {"value": "Bedrock", "label": "Bedrock"}
        ],
        "Cohere": [
            {"value": "Command", "label": "Command"}
        ],
        "Mistral AI": [
            {"value": "Mistral Large", "label": "Mistral Large"}
        ],
        "Customer Choice": [],  # Customer's own LLM - no predefined models
        "Other": []  # Other vendor - no predefined models
    }
    
    # Add LLM Vendor field as regular select field
    result["custom_fields"].append(AgentFieldDefinition(
        field_name="llm_vendor",
        field_type="select",
        label="LLM Vendor",
        description="Select the Large Language Model vendor",
        source="special_field",
        entity_user_level="business",
        field_config={
            "options": LLM_VENDORS
        }
    ))
    
    # Add LLM Model field as dependent_select field type (generic pattern)
    result["custom_fields"].append(AgentFieldDefinition(
        field_name="llm_model",
        field_type="dependent_select",  # Generic field type for dependent dropdowns
        label="LLM Model",
        description="Select the LLM model (depends on vendor selection)",
        source="special_field",
        entity_user_level="business",
        field_config={
            "depends_on": "llm_vendor",
            "depends_on_label": "LLM Vendor",
            "dependent_options": LLM_VENDOR_MODELS,  # Record<parentValue, Array<{value, label}>>
            "allow_custom": True,  # Allow custom input when no options or for specific parent values
            "clear_on_parent_change": True  # Clear this field when parent field changes
        }
    ))
    
    # Get Master Data Lists as selectable fields
    master_data_lists = db.query(MasterDataList).filter(
        MasterDataList.tenant_id == effective_tenant_id,
        MasterDataList.is_active == True
    ).all()
    
    for master_list in master_data_lists:
        # Create a field for each master data list
        result["master_data"].append(AgentFieldDefinition(
            field_name=f"master_data_{master_list.list_type}",
            field_type="select" if master_list.list_type != "multi_select" else "multi_select",
            label=master_list.name,
            description=master_list.description or f"Select from {master_list.name}",
            source=f"master_data:{master_list.list_type}",
            master_data_list_id=str(master_list.id),
            master_data_list_type=master_list.list_type
        ))
    
    # Get Entity Business Owner fields (owner/contact of the entity being submitted)
    # These are fields from entities that represent the business owner/contact person
    entity_business_owner_fields = [
        # Vendor contact fields
        AgentFieldDefinition(
            field_name="vendor_contact_email",
            field_type="email",
            label="Vendor Contact Email",
            description="Email address of the vendor contact person (entity business owner)",
            source="entity_business_owner",
            entity_name="vendors",
            entity_label="Vendor Business Owner"
        ),
        AgentFieldDefinition(
            field_name="vendor_contact_name",
            field_type="text",
            label="Vendor Contact Name",
            description="Name of the vendor contact person (entity business owner)",
            source="entity_business_owner",
            entity_name="vendors",
            entity_label="Vendor Business Owner"
        ),
        AgentFieldDefinition(
            field_name="vendor_contact_phone",
            field_type="text",
            label="Vendor Contact Phone",
            description="Phone number of the vendor contact person (entity business owner)",
            source="entity_business_owner",
            entity_name="vendors",
            entity_label="Vendor Business Owner"
        ),
        # Agent owner fields (from StudioAgent or Agent model)
        AgentFieldDefinition(
            field_name="agent_owner_id",
            field_type="select",
            label="Agent Owner",
            description="User ID of the agent owner (entity business owner)",
            source="entity_business_owner",
            entity_name="agents",
            entity_label="Agent Business Owner"
        ),
        AgentFieldDefinition(
            field_name="agent_owner_name",
            field_type="text",
            label="Agent Owner Name",
            description="Name of the agent owner (entity business owner)",
            source="entity_business_owner",
            entity_name="agents",
            entity_label="Agent Business Owner"
        ),
        AgentFieldDefinition(
            field_name="agent_owner_email",
            field_type="email",
            label="Agent Owner Email",
            description="Email of the agent owner (entity business owner)",
            source="entity_business_owner",
            entity_name="agents",
            entity_label="Agent Business Owner"
        ),
        AgentFieldDefinition(
            field_name="agent_owner_department",
            field_type="text",
            label="Agent Owner Department",
            description="Department of the agent owner (entity business owner)",
            source="entity_business_owner",
            entity_name="agents",
            entity_label="Agent Business Owner"
        ),
        AgentFieldDefinition(
            field_name="agent_owner_organization",
            field_type="text",
            label="Agent Owner Organization",
            description="Organization of the agent owner (entity business owner)",
            source="entity_business_owner",
            entity_name="agents",
            entity_label="Agent Business Owner"
        ),
        # Assessment owner fields
        AgentFieldDefinition(
            field_name="assessment_owner_id",
            field_type="select",
            label="Assessment Owner",
            description="User ID of the assessment owner (entity business owner)",
            source="entity_business_owner",
            entity_name="assessments",
            entity_label="Assessment Business Owner"
        ),
        AgentFieldDefinition(
            field_name="assessment_owner_name",
            field_type="text",
            label="Assessment Owner Name",
            description="Name of the assessment owner (entity business owner)",
            source="entity_business_owner",
            entity_name="assessments",
            entity_label="Assessment Business Owner"
        ),
        AgentFieldDefinition(
            field_name="assessment_owner_email",
            field_type="email",
            label="Assessment Owner Email",
            description="Email of the assessment owner (entity business owner)",
            source="entity_business_owner",
            entity_name="assessments",
            entity_label="Assessment Business Owner"
        ),
    ]
    
    result["entity_business_owner"] = entity_business_owner_fields
    
    # Get Logged-in User fields (current user filling the form)
    # These are attributes of the person currently filling out the form
    logged_in_user_query = db.query(EntityFieldRegistry).filter(
        EntityFieldRegistry.entity_name == "users",
        EntityFieldRegistry.is_enabled == True
    )
    
    # Filter by tenant_id - get tenant-specific and platform-wide fields
    logged_in_user_query = logged_in_user_query.filter(
        (EntityFieldRegistry.tenant_id == effective_tenant_id) | 
        (EntityFieldRegistry.tenant_id.is_(None))
    )
    
    logged_in_user_fields = logged_in_user_query.order_by(EntityFieldRegistry.display_order).all()
    
    for field in logged_in_user_fields:
        # Skip sensitive/system fields
        if field.is_primary_key or field.field_name in ['id', 'hashed_password', 'created_at', 'updated_at', 'tenant_id']:
            continue
        
        result["logged_in_user"].append(AgentFieldDefinition(
            field_name=field.field_name,
            field_type=field.field_type_display,
            label=field.field_label,
            description=field.field_description,
            source="logged_in_user",
            entity_name="users",
            entity_label="Logged-in User (Current User)",
            entity_user_level=field.entity_user_level or "business"
        ))
    
    # Also add common logged-in user fields if not in registry
    common_logged_in_user_fields = [
        {"field_name": "logged_in_user_name", "field_type": "text", "label": "Your Name", "description": "Name of the logged-in user (current user filling the form)"},
        {"field_name": "logged_in_user_email", "field_type": "email", "label": "Your Email", "description": "Email of the logged-in user (current user filling the form)"},
        {"field_name": "logged_in_user_department", "field_type": "text", "label": "Your Department", "description": "Department of the logged-in user (current user filling the form)"},
        {"field_name": "logged_in_user_organization", "field_type": "text", "label": "Your Organization", "description": "Organization of the logged-in user (current user filling the form)"},
        {"field_name": "logged_in_user_role", "field_type": "select", "label": "Your Role", "description": "Role of the logged-in user (current user filling the form)"},
    ]
    
    # Only add if not already in logged_in_user_fields
    existing_field_names = {f.field_name for f in logged_in_user_fields}
    for field_def in common_logged_in_user_fields:
        if field_def["field_name"] not in existing_field_names:
            result["logged_in_user"].append(AgentFieldDefinition(
                **field_def,
                source="logged_in_user",
                entity_name="users",
                entity_label="Logged-in User (Current User)"
            ))
    
    # Add workflow ticket fields (System-level fields for the workflow instance)
    workflow_ticket_fields = [
        {"field_name": "ticket_id", "field_type": "text", "label": "Ticket ID", "description": "Unique identifier for the workflow ticket"},
        {"field_name": "current_status", "field_type": "text", "label": "Current Status", "description": "Current status of the workflow ticket"},
        {"field_name": "business_owner", "field_type": "text", "label": "Business Owner", "description": "Business owner assigned to this ticket"},
        {"field_name": "created_at", "field_type": "date", "label": "Submission Date", "description": "Date when the ticket was created"},
        {"field_name": "priority", "field_type": "select", "label": "Priority", "description": "Priority level of the ticket"},
    ]
    
    for field_def in workflow_ticket_fields:
        result["workflow_ticket"].append(AgentFieldDefinition(
            **field_def,
            source="workflow_ticket",
            entity_name="workflow_ticket",
            entity_label="Workflow Ticket"
        ))
    
    # Note: Assessment fields (including assessment_response_grid if needed) should come from EntityFieldRegistry
    # To add assessment_response_grid or any other assessment field:
    # 1. Use the entity field management interface to add it to EntityFieldRegistry with entity_name="assessments"
    # 2. Or run entity field discovery to auto-discover assessment model fields
    # Fields are dynamically pulled based on what entities are in covered_entities of the layout group
    
    return result



# Workflow Layout Group (FormType) Endpoints

@router.get("/groups", response_model=List[WorkflowLayoutGroupResponse])
async def list_layout_groups(
    request_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),  # Allow filtering by active status
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List workflow layout groups. By default, only returns active groups."""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    query = db.query(FormType).filter(FormType.tenant_id == effective_tenant_id)
    
    # Default to active groups only if is_active not explicitly set
    if is_active is None:
        query = query.filter(FormType.is_active == True)
    elif is_active is not None:
        query = query.filter(FormType.is_active == is_active)
    
    if request_type:
        query = query.filter(FormType.request_type == request_type)
    
    groups = query.all()
    
    # Explicitly serialize to handle potential None values and date formatting
    results = []
    for g in groups:
        results.append(WorkflowLayoutGroupResponse(
            id=str(g.id),
            tenant_id=str(g.tenant_id),
            name=g.name,
            request_type=g.request_type,
            workflow_config_id=str(g.workflow_config_id) if g.workflow_config_id else None,
            description=g.description,
            covered_entities=g.covered_entities or [],
            stage_mappings=g.stage_mappings or {},
            is_active=g.is_active if g.is_active is not None else True,
            is_default=g.is_default if g.is_default is not None else False,
            created_at=g.created_at.isoformat() if g.created_at else None,
            updated_at=g.updated_at.isoformat() if g.updated_at else None
        ))
    
    return results


@router.post("/groups", response_model=WorkflowLayoutGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_layout_group(
    group_data: WorkflowLayoutGroupCreate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new workflow layout group"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Ensure default stage_mappings if empty or missing Submission/Approval
    stage_mappings = group_data.stage_mappings or {}
    
    # If stage_mappings is empty or missing Submission/Approval, try to find default layouts
    if not stage_mappings or 'submission' not in stage_mappings or 'approval' not in stage_mappings:
        # Try to find default layouts for missing stages
        from app.models.form_layout import FormLayout
        
        def get_default_layout_for_stage(stage_key: str) -> tuple[Optional[UUID], str]:
            """Get default layout for a stage"""
            stage_to_layout_type = {
                'submission': 'submission',
                'approval': 'approver',
                'rejection': 'rejection',
                'completion': 'completed'
            }
            layout_type = stage_to_layout_type.get(stage_key, 'submission')
            
            layout = db.query(FormLayout).filter(
                FormLayout.tenant_id == effective_tenant_id,
                FormLayout.request_type == group_data.request_type,
                FormLayout.layout_type == layout_type,
                FormLayout.is_active == True,
                FormLayout.is_template == False
            ).first()
            
            if layout:
                return (layout.id, layout.name)
            
            # Fallback: any active layout for this request_type
            fallback = db.query(FormLayout).filter(
                FormLayout.tenant_id == effective_tenant_id,
                FormLayout.request_type == group_data.request_type,
                FormLayout.is_active == True,
                FormLayout.is_template == False
            ).first()
            
            if fallback:
                return (fallback.id, fallback.name)
            
            return (None, 'Default Form')
        
        # Ensure all required stages have mappings
        required_stages = ['submission', 'approval', 'rejection', 'completion']
        for stage_key in required_stages:
            if stage_key not in stage_mappings:
                layout_id, layout_name = get_default_layout_for_stage(stage_key)
                if layout_id:
                    stage_mappings[stage_key] = {
                        'layout_id': str(layout_id),
                        'name': layout_name
                    }
                else:
                    # Placeholder if no layout found
                    stage_mappings[stage_key] = {
                        'layout_id': None,
                        'name': 'Default Form (Not Mapped)'
                    }
    
    # If setting as default, ensure only one default per request_type
    if group_data.is_default:
        # Unset other defaults for this request_type
        db.query(FormType).filter(
            FormType.tenant_id == effective_tenant_id,
            FormType.request_type == group_data.request_type,
            FormType.is_default == True
        ).update({"is_default": False})
    
    group = FormType(
        tenant_id=effective_tenant_id,
        name=group_data.name,
        request_type=group_data.request_type,
        description=group_data.description,
        covered_entities=group_data.covered_entities,
        stage_mappings=stage_mappings,
        is_default=group_data.is_default,
        created_by=current_user.id
    )
    
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.get("/groups/{group_id}", response_model=WorkflowLayoutGroupResponse)
async def get_layout_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get layout group by ID"""
    group = db.query(FormType).filter(FormType.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Layout group not found")
    
    # Serialize response to ensure workflow_config_id is properly converted to string
    return WorkflowLayoutGroupResponse(
        id=str(group.id),
        tenant_id=str(group.tenant_id),
        name=group.name,
        request_type=group.request_type,
        workflow_config_id=str(group.workflow_config_id) if group.workflow_config_id else None,
        description=group.description,
        covered_entities=group.covered_entities or [],
        stage_mappings=group.stage_mappings or {},
        is_active=group.is_active if group.is_active is not None else True,
        is_default=group.is_default if group.is_default is not None else False,
        created_at=group.created_at.isoformat() if group.created_at else None,
        updated_at=group.updated_at.isoformat() if group.updated_at else None
    )


@router.patch("/groups/{group_id}", response_model=WorkflowLayoutGroupResponse)
async def update_layout_group(
    group_id: UUID,
    group_data: WorkflowLayoutGroupUpdate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Update a workflow layout group"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    group = db.query(FormType).filter(FormType.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Layout group not found")
    
    # Validate request_type if provided
    if group_data.request_type:
        # Validate against master data
        if not validate_workflow_type(db, effective_tenant_id, group_data.request_type):
            valid_types = get_workflow_types_from_master_data(db, effective_tenant_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid request_type: {group_data.request_type}. Valid types: {', '.join(valid_types)}"
            )
        
        # If setting as default, ensure only one default per request_type
        if group_data.is_default is not False:  # If explicitly True or not set (and current is default)
            # Unset other defaults for this request_type
            db.query(FormType).filter(
                FormType.tenant_id == effective_tenant_id,
                FormType.request_type == group_data.request_type,
                FormType.id != group_id,
                FormType.is_default == True
            ).update({"is_default": False})
    
    update_data = group_data.dict(exclude_unset=True)
    
    # Validate workflow_config_id if provided
    if group_data.workflow_config_id is not None:
        from app.models.workflow_config import WorkflowConfiguration
        workflow = db.query(WorkflowConfiguration).filter(
            WorkflowConfiguration.id == group_data.workflow_config_id,
            WorkflowConfiguration.tenant_id == effective_tenant_id
        ).first()
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workflow configuration not found: {group_data.workflow_config_id}"
            )
    
    for key, value in update_data.items():
        setattr(group, key, value)
        # Explicitly flag JSON columns as modified to ensure SQLAlchemy detects changes
        if key in ['stage_mappings', 'covered_entities', 'servicenow_state_mapping']:
            flag_modified(group, key)
    
    db.commit()
    db.refresh(group)
    
    # Serialize response to ensure workflow_config_id is properly converted to string
    return WorkflowLayoutGroupResponse(
        id=str(group.id),
        tenant_id=str(group.tenant_id),
        name=group.name,
        request_type=group.request_type,
        workflow_config_id=str(group.workflow_config_id) if group.workflow_config_id else None,
        description=group.description,
        covered_entities=group.covered_entities or [],
        stage_mappings=group.stage_mappings or {},
        is_active=group.is_active if group.is_active is not None else True,
        is_default=group.is_default if group.is_default is not None else False,
        created_at=group.created_at.isoformat() if group.created_at else None,
        updated_at=group.updated_at.isoformat() if group.updated_at else None
    )


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout_group(
    group_id: UUID,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Delete a layout group"""
    group = db.query(FormType).filter(FormType.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Layout group not found")
    
    db.delete(group)
    db.commit()
    return None


@router.get("/library", response_model=List[FormLayoutResponse])
async def get_form_library(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all forms available in the library - loads from Forms entity (not processes)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Load forms from the Forms entity (new table for forms, separate from processes)
    # Platform admins can access all forms regardless of tenant
    query = db.query(Form).filter(Form.is_active == True)
    
    # Apply tenant filter only for non-platform admins
    if current_user.role.value != "platform_admin":
        query = query.filter(Form.tenant_id == effective_tenant_id)
    
    forms = query.all()
    
    results = []
    for form in forms:
        # Use the locally defined resolve_custom_fields_from_catalog function
        resolved_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=form.custom_field_ids
        )
        
        # Convert Form to FormLayoutResponse format
        results.append(FormLayoutResponse(
            id=str(form.id),
            tenant_id=str(form.tenant_id),
            name=form.name,
            request_type="",  # Forms don't have request_type (they're workflow-agnostic)
            workflow_stage="new",  # Default
            layout_type=form.layout_type,
            description=form.description,
            sections=form.sections,
            agent_type=None,  # Forms don't have agent_type
            agent_category=None,  # Forms don't have agent_category
            custom_field_ids=form.custom_field_ids,
            custom_fields=resolved_fields,
            is_active=form.is_active,
            is_default=False,  # Forms don't have is_default
            is_template=False,  # Forms are not templates
            created_by=str(form.created_by) if form.created_by else None,
            created_at=form.created_at.isoformat() if form.created_at else None,
            updated_at=form.updated_at.isoformat() if form.updated_at else None
        ))
    
    return results


@router.get("/{layout_id}", response_model=FormLayoutResponse)
async def get_layout(
    layout_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a form layout or form - checks both FormLayout and Form entities"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Check if it's a form (in Forms table) or a process (in FormLayout table)
    form = db.query(Form).filter(Form.id == layout_id).first()
    layout = db.query(FormLayout).filter(FormLayout.id == layout_id).first()
    
    if form:
        # Return form from Forms entity
        user_tenant_id = str(effective_tenant_id)
        form_tenant_id = str(form.tenant_id)
        
        if current_user.role.value != "platform_admin" and user_tenant_id != form_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Form belongs to a different tenant"
            )
        
        # Resolve custom fields
        resolved_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=form.custom_field_ids
        )
        
        return FormLayoutResponse(
            id=str(form.id),
            tenant_id=str(form.tenant_id),
            name=form.name,
            request_type="",  # Forms don't have request_type
            workflow_stage="new",  # Default
            layout_type=form.layout_type,
            description=form.description,
            sections=form.sections,
            agent_type=None,
            agent_category=None,
            custom_field_ids=form.custom_field_ids,
            custom_fields=resolved_fields,
            is_active=form.is_active,
            is_default=False,
            is_template=False,
            created_by=str(form.created_by) if form.created_by else None,
            created_at=form.created_at.isoformat() if form.created_at else None,
            updated_at=form.updated_at.isoformat() if form.updated_at else None
        )
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout not found"
        )
    
    # Continue with FormLayout (existing logic)
    
    # Tenant isolation - convert both to strings for comparison to handle UUID vs string issues
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    user_tenant_id = str(effective_tenant_id)
    layout_tenant_id = str(layout.tenant_id)
    
    # Allow platform admins to access any layout
    if current_user.role.value == "platform_admin":
        pass  # Platform admin can access any layout
    elif user_tenant_id != layout_tenant_id:
        logger.warning(
            f"Tenant mismatch for layout access: user_tenant={user_tenant_id}, "
            f"layout_tenant={layout_tenant_id}, layout_id={layout_id}, user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Layout belongs to a different tenant"
        )
    
    # Resolve custom fields from catalog
    resolved_custom_fields = resolve_custom_fields_from_catalog(
        db=db,
        tenant_id=effective_tenant_id,
        custom_field_ids=layout.custom_field_ids
    )
    
    return FormLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id),
        name=layout.name,
        request_type=layout.request_type,
        workflow_stage=layout.workflow_stage,
        layout_type=getattr(layout, 'layout_type', None),  # Include layout_type
        description=layout.description,
        servicenow_table=layout.servicenow_table,
        servicenow_state_mapping=layout.servicenow_state_mapping,
        sections=layout.sections,
        agent_type=layout.agent_type,
        agent_category=layout.agent_category,
        field_dependencies=layout.field_dependencies,
        custom_field_ids=layout.custom_field_ids,  # Store IDs
        custom_fields=resolved_custom_fields,  # Resolved from catalog
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


@router.patch("/{layout_id}", response_model=FormLayoutResponse)
async def update_layout(
    layout_id: UUID,
    layout_data: FormLayoutUpdate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Update a form layout or form
    
    Checks both FormLayout and Form entities to find the resource.
    If a form exists in FormLayout but should be in Forms (no request_type), migrate it.
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Check if it's a form (in Forms table) or a process (in FormLayout table)
    form = db.query(Form).filter(Form.id == layout_id).first()
    layout = db.query(FormLayout).filter(FormLayout.id == layout_id).first()
    
    if not form and not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout or form not found"
        )
    
    # If form exists in FormLayout but has no request_type (or empty request_type), it should be in Forms table
    # Migrate it to Forms table
    # Check if layout has no request_type or empty request_type
    layout_has_no_request_type = False
    if layout:
        layout_has_no_request_type = not layout.request_type or (isinstance(layout.request_type, str) and layout.request_type.strip() == "")
    
    # Also check if update payload indicates it's a form (is_template=True or no request_type in update)
    is_form_update = False
    if hasattr(layout_data, 'is_template') and layout_data.is_template is not None:
        is_form_update = layout_data.is_template is True
    
    has_no_request_type_in_update = True
    if hasattr(layout_data, 'request_type') and layout_data.request_type is not None:
        has_no_request_type_in_update = (isinstance(layout_data.request_type, str) and layout_data.request_type.strip() == "")
    
    should_migrate = layout and not form and (layout_has_no_request_type or is_form_update or has_no_request_type_in_update)
    
    logger.info(f"Migration check - layout exists: {layout is not None}, form exists: {form is not None}, layout.request_type: '{layout.request_type if layout else None}', layout_has_no_request_type: {layout_has_no_request_type}, is_form_update: {is_form_update}, should_migrate: {should_migrate}")
    
    if should_migrate:
        logger.info(f"Migrating form from FormLayout to Forms: {layout.name} (id: {layout_id})")
        try:
            # Create form in Forms table - preserve the original ID
            form = Form(
                id=layout_id,  # Preserve the original ID
                tenant_id=layout.tenant_id,
                name=layout.name,
                layout_type=getattr(layout, 'layout_type', None),
                description=layout.description,
                sections=layout.sections,
                field_dependencies=getattr(layout, 'field_dependencies', None),
                custom_field_ids=getattr(layout, 'custom_field_ids', None),
                is_active=layout.is_active,
                created_by=layout.created_by,
                created_at=layout.created_at,
                updated_at=layout.updated_at
            )
            db.add(form)
            # Delete from FormLayout
            db.delete(layout)
            db.commit()
            db.refresh(form)
            logger.info(f"✅ Migrated form to Forms table: {form.name} (id: {form.id})")
        except Exception as e:
            logger.error(f"❌ Failed to migrate form from FormLayout to Forms: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to migrate form to Forms table: {str(e)}"
            )
    
    if form:
        # Update form in Forms entity
        # Tenant isolation check
        user_tenant_id = str(effective_tenant_id)
        form_tenant_id = str(form.tenant_id)
        
        if current_user.role.value != "platform_admin" and user_tenant_id != form_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Form belongs to a different tenant"
            )
        
        # Update fields
        update_data = {}
        for key, value in layout_data.dict(exclude_unset=True).items():
            if key not in ["sections", "field_dependencies", "request_type", "workflow_stage", "is_default", "is_template"]:
                update_data[key] = value
        
        # Handle sections
        if layout_data.sections is not None:
            sections_json = [section.dict() if hasattr(section, 'dict') else section for section in layout_data.sections]
            update_data["sections"] = sections_json
        
        # Handle field_dependencies
        if layout_data.field_dependencies is not None:
            deps_json = {
                k: v.dict() if hasattr(v, 'dict') else v
                for k, v in layout_data.field_dependencies.items()
            }
            update_data["field_dependencies"] = deps_json
        
        # Handle custom_field_ids
        if layout_data.custom_field_ids is not None:
            # Validate all custom field IDs exist and belong to tenant
            for field_id_str in layout_data.custom_field_ids:
                try:
                    field_id = UUID(field_id_str)
                    field = db.query(CustomFieldCatalog).filter(
                        CustomFieldCatalog.id == field_id,
                        CustomFieldCatalog.tenant_id == effective_tenant_id
                    ).first()
                    if not field:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Custom field {field_id_str} not found or does not belong to tenant"
                        )
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid custom field ID: {field_id_str}"
                    )
            update_data["custom_field_ids"] = layout_data.custom_field_ids
        
        # Update the form object
        for field, value in update_data.items():
            setattr(form, field, value)
        
        form.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(form)
        
        # Resolve custom fields for response
        resolved_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=form.custom_field_ids
        )
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="form",
            resource_id=str(form.id),
            tenant_id=str(effective_tenant_id),
            details={"updated_fields": list(update_data.keys())},
            ip_address=None,
            user_agent=None
        )
        
        # Return as FormLayoutResponse for compatibility
        return FormLayoutResponse(
            id=str(form.id),
            tenant_id=str(form.tenant_id),
            name=form.name,
            request_type="",  # Forms don't have request_type
            workflow_stage="new",  # Default
            layout_type=form.layout_type,
            description=form.description,
            sections=form.sections,
            agent_type=None,
            agent_category=None,
            custom_field_ids=form.custom_field_ids,
            custom_fields=resolved_fields,
            is_active=form.is_active,
            is_default=False,
            is_template=False,
            created_by=str(form.created_by) if form.created_by else None,
            created_at=form.created_at.isoformat() if form.created_at else None,
            updated_at=form.updated_at.isoformat() if form.updated_at else None
        )
    
    # Continue with FormLayout update (existing logic)
    
    # Tenant isolation - convert both to strings for comparison to handle UUID vs string issues
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    user_tenant_id = str(effective_tenant_id)
    layout_tenant_id = str(layout.tenant_id)
    
    # Allow platform admins to update any layout
    if current_user.role.value == "platform_admin":
        pass  # Platform admin can update any layout
    elif user_tenant_id != layout_tenant_id:
        logger.warning(
            f"Tenant mismatch for layout update: user_tenant={user_tenant_id}, "
            f"layout_tenant={layout_tenant_id}, layout_id={layout_id}, user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Layout belongs to a different tenant"
        )
    
    # If setting as default, unset other defaults for this request type
    # Templates cannot be default layouts
    if layout_data.is_default is True:
        # Check if current layout is a template or is being set to one
        is_template = layout_data.is_template if layout_data.is_template is not None else layout.is_template
        if is_template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template layouts cannot be set as default"
            )
        db.query(FormLayout).filter(
            FormLayout.tenant_id == effective_tenant_id,
            FormLayout.request_type == layout.request_type,
            FormLayout.id != layout_id,
            FormLayout.is_default == True
        ).update({"is_default": False})
    
    # Update fields
    # Use dict(exclude_unset=True) to get only fields that were provided
    # Note: layout_data.dict() should recursively convert nested Pydantic models to dicts
    # However, we need to handle sections and custom_fields explicitly to ensure they're JSON-serializable
    update_data = {}
    
    # Copy all fields except sections and custom_fields
    for key, value in layout_data.dict(exclude_unset=True).items():
        if key not in ["sections", "custom_fields", "field_dependencies"]:
            update_data[key] = value
    
    # Handle sections - convert to list of dicts
    if layout_data.sections is not None:
        sections_json = []
        for section in layout_data.sections:
            # section is a Pydantic SectionDefinition model, convert to dict
            sections_json.append(section.dict())
        update_data["sections"] = sections_json
    
    # Handle custom_field_ids
    if layout_data.custom_field_ids is not None:
        # Validate all custom field IDs exist and belong to tenant
        for field_id_str in layout_data.custom_field_ids:
            try:
                field_id = UUID(field_id_str)
                field = db.query(CustomFieldCatalog).filter(
                    CustomFieldCatalog.id == field_id,
                    CustomFieldCatalog.tenant_id == effective_tenant_id
                ).first()
                if not field:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Custom field {field_id_str} not found or does not belong to tenant"
                    )
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid custom field ID: {field_id_str}"
                )
        update_data["custom_field_ids"] = layout_data.custom_field_ids
    
    # Handle field_dependencies - convert to dict of dicts
    if layout_data.field_dependencies is not None:
        deps_json = {}
        for k, v in layout_data.field_dependencies.items():
            if isinstance(v, FieldDependency):
                deps_json[k] = v.dict()
            else:
                deps_json[k] = v
        update_data["field_dependencies"] = deps_json
    
    # Update the layout object
    for field, value in update_data.items():
        setattr(layout, field, value)
    
    layout.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(layout)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="form_layout",
        resource_id=str(layout.id),
        tenant_id=str(effective_tenant_id),
        details={"updated_fields": list(update_data.keys())},
        ip_address=None,
        user_agent=None
    )
    
    # Resolve custom fields from catalog
    layout_custom_field_ids = getattr(layout, 'custom_field_ids', None)
    resolved_custom_fields = resolve_custom_fields_from_catalog(
        db=db,
        tenant_id=effective_tenant_id,
        custom_field_ids=layout_custom_field_ids
    )
    
    return FormLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id),
        name=layout.name,
        request_type=layout.request_type,
        workflow_stage=layout.workflow_stage,
        description=layout.description,
        servicenow_table=layout.servicenow_table,
        servicenow_state_mapping=layout.servicenow_state_mapping,
        sections=layout.sections,
        agent_type=layout.agent_type,
        agent_category=layout.agent_category,
        field_dependencies=layout.field_dependencies,
        custom_field_ids=layout_custom_field_ids,
        custom_fields=resolved_custom_fields,
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


@router.post("/cleanup-defaults", status_code=status.HTTP_200_OK)
async def cleanup_multiple_defaults(
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Cleanup multiple defaults - ensure only one default per request_type"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Get all layouts for this tenant
    layouts = db.query(FormLayout).filter(
        FormLayout.tenant_id == effective_tenant_id,
        FormLayout.is_default == True
    ).all()
    
    # Group by request_type
    defaults_by_type: Dict[str, List[FormLayout]] = {}
    for layout in layouts:
        if layout.request_type not in defaults_by_type:
            defaults_by_type[layout.request_type] = []
        defaults_by_type[layout.request_type].append(layout)
    
    # For each request_type with multiple defaults, keep only the first one (by created_at)
    fixed_count = 0
    for request_type, type_layouts in defaults_by_type.items():
        if len(type_layouts) > 1:
            # Sort by created_at, keep the oldest one as default
            type_layouts.sort(key=lambda x: x.created_at)
            # Unset all except the first one
            for layout in type_layouts[1:]:
                layout.is_default = False
                fixed_count += 1
    
    if fixed_count > 0:
        db.commit()
        logger.info(f"Fixed {fixed_count} duplicate defaults for tenant {effective_tenant_id}")
    
    return {
        "message": f"Cleanup complete. Fixed {fixed_count} duplicate default(s).",
        "fixed_count": fixed_count
    }


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: UUID,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Delete a form layout (soft delete)"""
    layout = db.query(FormLayout).filter(FormLayout.id == layout_id).first()
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layout not found"
        )
    
    # Tenant isolation - convert both to strings for comparison to handle UUID vs string issues
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    user_tenant_id = str(effective_tenant_id)
    layout_tenant_id = str(layout.tenant_id)
    
    # Allow platform admins to delete any layout
    if current_user.role.value == "platform_admin":
        pass  # Platform admin can delete any layout
    elif user_tenant_id != layout_tenant_id:
        logger.warning(
            f"Tenant mismatch for layout delete: user_tenant={user_tenant_id}, "
            f"layout_tenant={layout_tenant_id}, layout_id={layout_id}, user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Layout belongs to a different tenant"
        )
    
    # Soft delete
    layout.is_active = False
    layout.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.DELETE,
        resource_type="form_layout",
        resource_id=str(layout.id),
        tenant_id=str(effective_tenant_id),
        details={"name": layout.name},
        ip_address=None,
        user_agent=None
    )
    
    return None


@router.get("/request-type/{request_type}/workflow-stage/{workflow_stage}/active", response_model=FormLayoutResponse)
async def get_active_layout_for_stage(
    request_type: str = Path(...),  # Validated dynamically against master data
    workflow_stage: str = Path(..., pattern="^(new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision)$"),
    agent_type: Optional[str] = Query(None),
    agent_category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the active layout for a specific request type and workflow stage (for rendering forms)
    
    Uses layout_type system:
    - Maps workflow_stage to layout_type (submission, approver, completed)
    - Queries by layout_type only
    """
    logger.info(f"get_active_layout_for_stage called: request_type={request_type}, workflow_stage={workflow_stage}, agent_type={agent_type}")
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Validate request_type against master data
    if not validate_workflow_type(db, effective_tenant_id, request_type):
        valid_types = get_workflow_types_from_master_data(db, effective_tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request_type: {request_type}. Valid types: {', '.join(valid_types)}"
        )
    
    # Map workflow stage to layout type
    layout_type = get_layout_type_for_stage(workflow_stage)
    
    # Initialize variables
    layout = None
    form_from_mapping = None
    workflow_group = None
    action_name = None  # Initialize outside try block so it's accessible everywhere
    mapping = None  # Initialize outside try block to avoid UnboundLocalError
    
    # FIRST: Check process mapping (WorkflowLayoutGroup/FormType) to find form mapped to this workflow
    # Forms are workflow-agnostic and connected via process mapping
    # Wrap in try-catch to handle any exceptions gracefully
    try:
        from app.models.form_layout import FormType
        
        # Map workflow_stage to action name first (before querying processes)
        if workflow_stage == 'new':
            action_name = 'Submission'
        elif workflow_stage in ['pending_approval', 'pending_review']:
            action_name = 'Approval'
        elif workflow_stage == 'rejected':
            action_name = 'Rejection'
        elif workflow_stage in ['approved', 'closed']:
            action_name = 'Completion'
        
        # Also try layout_type-based mapping
        # Map workflow stages: rejection -> submission, completed -> approver
        if not action_name:
            if layout_type == 'submission':
                action_name = 'Submission'
            elif layout_type == 'approver':
                action_name = 'Approval'
            # Handle deprecated types for backward compatibility
            elif layout_type == 'rejection':
                action_name = 'Submission'  # Rejection uses submission view
            elif layout_type == 'completed':
                action_name = 'Approval'  # Completed uses approver view
        
        logger.info(f"Process mapping check - request_type: {request_type}, workflow_stage: {workflow_stage}, layout_type: {layout_type}, action_name: {action_name}")
        
        # Try to find a process that has the required action mapping
        # First try default, then try any active process that has the mapping
        if action_name:
            # Try default process first
            default_process = db.query(FormType).filter(
                FormType.tenant_id == effective_tenant_id,
                FormType.request_type == request_type,
                FormType.is_active == True,
                FormType.is_default == True
            ).first()
            
            # Check default process with case-insensitive matching
            if default_process and default_process.stage_mappings:
                action_lower = action_name.lower()
                if action_name in default_process.stage_mappings or any(key.lower() == action_lower for key in default_process.stage_mappings.keys()):
                    workflow_group = default_process
                    logger.info(f"Found default process with {action_name} mapping: {default_process.name}")
            
            # If default process doesn't have the mapping, try all processes
            if not workflow_group:
                # Try any active process that has the required mapping (case-insensitive)
                all_processes = db.query(FormType).filter(
                    FormType.tenant_id == effective_tenant_id,
                    FormType.request_type == request_type,
                    FormType.is_active == True
                ).order_by(FormType.is_default.desc()).all()
                action_lower = action_name.lower()
                for process in all_processes:
                    if process.stage_mappings:
                        # Try exact match first
                        if action_name in process.stage_mappings:
                            workflow_group = process
                            logger.info(f"Found process with {action_name} mapping: {process.name}")
                            break
                        # Try case-insensitive match
                        for key in process.stage_mappings.keys():
                            if key.lower() == action_lower:
                                workflow_group = process
                                logger.info(f"Found process with {action_name} mapping (case-insensitive): {process.name}, key: '{key}'")
                                break
                        if workflow_group:
                            break
                
                if not workflow_group:
                    logger.info(f"No process found with '{action_name}' mapping for {request_type}")
        else:
            logger.info(f"  ⚠️ Could not determine action_name from workflow_stage={workflow_stage}, layout_type={layout_type}")
        
        # Find mapping from workflow_group (mapping is already initialized above)
        if workflow_group and workflow_group.stage_mappings and action_name:
            # Find the mapped form in stage_mappings
            # Try exact match first, then case-insensitive match
            if action_name in workflow_group.stage_mappings:
                mapping = workflow_group.stage_mappings[action_name]
            else:
                # Try case-insensitive match (mapping keys are lowercase: 'submission', 'approval', etc.)
                action_lower = action_name.lower()
                for key, value in workflow_group.stage_mappings.items():
                    if key.lower() == action_lower:
                        mapping = value
                        logger.info(f"  Found mapping using case-insensitive match: '{key}' for '{action_name}'")
                        break
            
        if mapping:
            if mapping and mapping.get('layout_id'):
                form_id = None
                form_from_mapping = None
                try:
                    form_id = UUID(mapping['layout_id'])
                    logger.info(f"Looking for form with id: {form_id}, tenant_id: {effective_tenant_id}")
                    
                    # Try to load from Forms entity first (new system)
                    form_from_mapping = db.query(Form).filter(
                        Form.id == form_id,
                        Form.tenant_id == effective_tenant_id,
                        Form.is_active == True
                    ).first()
                    
                    if form_from_mapping:
                        logger.info(f"Found form from process mapping: {form_from_mapping.name} (id: {form_id}) for {request_type} at {workflow_stage}")
                        if form_from_mapping.sections:
                            for idx, section in enumerate(form_from_mapping.sections):
                                fields_count = len(section.get('fields', [])) if isinstance(section, dict) else 0
                                logger.info(f"  Section {idx + 1}: {section.get('title', 'Untitled')} - {fields_count} fields")
                except Exception as e:
                    logger.error(f"Exception loading form: {e}", exc_info=True)
                    form_from_mapping = None
                    
                    # If form not found in Forms entity, try FormLayout (only if form_id was successfully created)
                    if not form_from_mapping and form_id:
                        layout = db.query(FormLayout).filter(
                            FormLayout.id == form_id,
                            FormLayout.tenant_id == effective_tenant_id,
                            FormLayout.is_active == True
                        ).first()
                        if layout:
                            logger.info(f"Found layout from mapping: {layout.name} (id: {form_id}) for {request_type} at {workflow_stage}")
    except Exception as e:
        logger.error(f"Exception in process mapping lookup: {e}", exc_info=True)
        workflow_group = None
        form_from_mapping = None
        layout = None
        mapping = None  # Ensure mapping is reset in exception handler
    
    # If no form found from process mapping, try FormLayout (seeded layouts)
    if not layout and not form_from_mapping:
        layout = _get_active_layout_internal(
            db=db,
            effective_tenant_id=effective_tenant_id,
            request_type=request_type,
            workflow_stage=workflow_stage,
            agent_type=agent_type,
            agent_category=agent_category,
            current_user=current_user
        )
    
    user_tenant_id = str(effective_tenant_id)
    
    # If we found a form from process mapping, convert it to FormLayoutResponse
    if form_from_mapping:
        # Resolve custom fields for response
        resolved_fields = resolve_custom_fields_from_catalog(
            db=db,
            tenant_id=effective_tenant_id,
            custom_field_ids=form_from_mapping.custom_field_ids
        )
        
        # Log sections being returned
        sections_data = form_from_mapping.sections or []
        logger.info(f"📋 Returning form from process mapping: {form_from_mapping.name}")
        logger.info(f"  Sections count: {len(sections_data)}")
        for idx, section in enumerate(sections_data):
            fields_count = len(section.get('fields', [])) if isinstance(section, dict) else 0
            logger.info(f"    Section {idx + 1}: {section.get('title', 'Untitled')} - {fields_count} fields")
            if fields_count > 0:
                logger.info(f"      Fields: {section.get('fields', [])[:5]}{'...' if fields_count > 5 else ''}")
        
        # Convert Form to FormLayoutResponse format
        return FormLayoutResponse(
            id=str(form_from_mapping.id),
            tenant_id=str(form_from_mapping.tenant_id),
            name=form_from_mapping.name,
            request_type=request_type,  # Use the requested request_type (form is workflow-agnostic)
            workflow_stage=workflow_stage,  # Use the requested workflow_stage
            layout_type=form_from_mapping.layout_type,
            description=form_from_mapping.description,
            sections=sections_data,  # Ensure sections are included
            agent_type=None,  # Forms don't have agent_type
            agent_category=None,  # Forms don't have agent_category
            custom_field_ids=form_from_mapping.custom_field_ids,
            custom_fields=resolved_fields,
            is_active=form_from_mapping.is_active,
            is_default=False,  # Forms don't have is_default
            is_template=False,  # Forms are not templates
            created_by=str(form_from_mapping.created_by) if form_from_mapping.created_by else None,
            created_at=form_from_mapping.created_at.isoformat() if form_from_mapping.created_at else None,
            updated_at=form_from_mapping.updated_at.isoformat() if form_from_mapping.updated_at else None
        )
    
    # Layouts must be seeded - no auto-creation
    if not layout and not form_from_mapping:
        logger.error(f"No layout found for tenant {effective_tenant_id}, request_type {request_type}, workflow_stage {workflow_stage}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active layout found for {request_type} at {workflow_stage} stage. Please ensure layouts are seeded or create one in the Process Designer."
        )
    
    # Double-check tenant_id match (defensive programming)
    layout_tenant_id = str(layout.tenant_id)
    if user_tenant_id != layout_tenant_id and current_user.role.value != "platform_admin":
        logger.error(
            f"CRITICAL: Layout returned from tenant-filtered query has mismatched tenant_id! "
            f"user_tenant={user_tenant_id}, layout_tenant={layout_tenant_id}, layout_id={layout.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error: Layout tenant mismatch"
        )
    
    # Resolve custom fields from catalog
    layout_custom_field_ids = getattr(layout, 'custom_field_ids', None)
    resolved_custom_fields = resolve_custom_fields_from_catalog(
        db=db,
        tenant_id=effective_tenant_id,
        custom_field_ids=layout_custom_field_ids
    )
    
    return FormLayoutResponse(
        id=str(layout.id),
        tenant_id=str(layout.tenant_id),
        name=layout.name,
        request_type=layout.request_type,
        workflow_stage=layout.workflow_stage,
        description=layout.description,
        servicenow_table=layout.servicenow_table,
        servicenow_state_mapping=layout.servicenow_state_mapping,
        sections=layout.sections,
        agent_type=layout.agent_type,
        agent_category=layout.agent_category,
        field_dependencies=layout.field_dependencies,
        custom_field_ids=layout_custom_field_ids,
        custom_fields=resolved_custom_fields,
        is_active=layout.is_active,
        is_default=layout.is_default,
        created_by=str(layout.created_by) if layout.created_by else None,
        created_at=layout.created_at.isoformat(),
        updated_at=layout.updated_at.isoformat()
    )


# Field Access Control Endpoints

@router.post("/field-access", response_model=FieldAccessResponse, status_code=status.HTTP_201_CREATED)
async def create_field_access(
    access_data: FieldAccessCreate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Create field access control (idempotent - returns existing if already present)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Ensure request_type and workflow_stage are strings (handle lists from frontend)
    request_type = access_data.request_type
    if isinstance(request_type, list):
        request_type = ",".join(request_type)
    
    workflow_stage = access_data.workflow_stage
    if isinstance(workflow_stage, list):
        workflow_stage = ",".join(workflow_stage)

    # Check if access control already exists (active or inactive)
    existing = db.query(FormFieldAccess).filter(
        FormFieldAccess.tenant_id == effective_tenant_id,
        FormFieldAccess.field_name == access_data.field_name,
        FormFieldAccess.request_type == request_type,
        FormFieldAccess.workflow_stage == workflow_stage
    ).first()
    
    if existing:
        # Update existing record with new data (idempotent behavior)
        existing.field_source = access_data.field_source
        existing.field_source_id = UUID(access_data.field_source_id) if access_data.field_source_id else None
        existing.workflow_stage = workflow_stage
        existing.role_permissions = access_data.role_permissions
        existing.agent_type = access_data.agent_type
        existing.agent_category = access_data.agent_category
        existing.is_active = True  # Reactivate if it was inactive
        existing.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(existing)
        
        # Audit log for update
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.UPDATE,
            resource_type="form_field_access",
            resource_id=str(existing.id),
            tenant_id=str(effective_tenant_id),
            details={"field_name": existing.field_name, "request_type": existing.request_type, "workflow_stage": existing.workflow_stage, "updated_via": "create_endpoint"},
            ip_address=None,
            user_agent=None
        )
        
        return FieldAccessResponse(
            id=str(existing.id),
            tenant_id=str(existing.tenant_id),
            field_name=existing.field_name,
            field_source=existing.field_source,
            field_source_id=str(existing.field_source_id) if existing.field_source_id else None,
            request_type=existing.request_type,
            workflow_stage=existing.workflow_stage,
            role_permissions=existing.role_permissions,
            agent_type=existing.agent_type,
            agent_category=existing.agent_category,
            is_active=existing.is_active,
            created_by=str(existing.created_by) if existing.created_by else None,
            created_at=existing.created_at.isoformat(),
            updated_at=existing.updated_at.isoformat()
        )
    
    # Create new field access control
    field_access = FormFieldAccess(
        tenant_id=effective_tenant_id,
        field_name=access_data.field_name,
        field_source=access_data.field_source,
        field_source_id=UUID(access_data.field_source_id) if access_data.field_source_id else None,
        request_type=request_type,
        workflow_stage=workflow_stage,
        role_permissions=access_data.role_permissions,
        agent_type=access_data.agent_type,
        agent_category=access_data.agent_category,
        is_active=True,
        created_by=current_user.id
    )
    
    db.add(field_access)
    db.commit()
    db.refresh(field_access)
    
    # Audit log for create
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="form_field_access",
        resource_id=str(field_access.id),
        tenant_id=str(effective_tenant_id),
        details={"field_name": field_access.field_name, "request_type": field_access.request_type, "workflow_stage": field_access.workflow_stage},
        ip_address=None,
        user_agent=None
    )
    
    return FieldAccessResponse(
        id=str(field_access.id),
        tenant_id=str(field_access.tenant_id),
        field_name=field_access.field_name,
        field_source=field_access.field_source,
        field_source_id=str(field_access.field_source_id) if field_access.field_source_id else None,
        request_type=field_access.request_type,
        workflow_stage=field_access.workflow_stage,
        role_permissions=field_access.role_permissions,
        agent_type=field_access.agent_type,
        agent_category=field_access.agent_category,
        is_active=field_access.is_active,
        created_by=str(field_access.created_by) if field_access.created_by else None,
        created_at=field_access.created_at.isoformat(),
        updated_at=field_access.updated_at.isoformat()
    )


@router.get("/field-access", response_model=List[FieldAccessResponse])
async def list_field_access(
    request_type: Optional[str] = Query(None),
    workflow_stage: Optional[str] = Query(None),
    field_name: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List field access controls"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    query = db.query(FormFieldAccess).filter(
        FormFieldAccess.tenant_id == effective_tenant_id
    )
    
    if request_type:
        query = query.filter(FormFieldAccess.request_type == request_type)
    if workflow_stage:
        query = query.filter(FormFieldAccess.workflow_stage == workflow_stage)
    if field_name:
        query = query.filter(FormFieldAccess.field_name == field_name)
    if is_active is not None:
        query = query.filter(FormFieldAccess.is_active == is_active)
    
    access_list = query.order_by(
        FormFieldAccess.request_type,
        FormFieldAccess.workflow_stage,
        FormFieldAccess.field_name
    ).all()
    
    return [
        FieldAccessResponse(
            id=str(a.id),
            tenant_id=str(a.tenant_id),
            field_name=a.field_name,
            field_source=a.field_source,
            field_source_id=str(a.field_source_id) if a.field_source_id else None,
            request_type=a.request_type,
            workflow_stage=a.workflow_stage or 'new',
            role_permissions=a.role_permissions or {},
            agent_type=a.agent_type,
            agent_category=a.agent_category,
            is_active=a.is_active,
            created_by=str(a.created_by) if a.created_by else None,
            created_at=a.created_at.isoformat(),
            updated_at=a.updated_at.isoformat()
        )
        for a in access_list
    ]


@router.patch("/field-access/{access_id}", response_model=FieldAccessResponse)
async def update_field_access(
    access_id: UUID,
    access_data: FieldAccessUpdate,
    current_user: User = Depends(require_layout_management_permission),
    db: Session = Depends(get_db)
):
    """Update field access control"""
    field_access = db.query(FormFieldAccess).filter(FormFieldAccess.id == access_id).first()
    
    if not field_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field access not found"
        )
    
    # Tenant isolation - convert both to strings for comparison to handle UUID vs string issues
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    user_tenant_id = str(effective_tenant_id)
    field_access_tenant_id = str(field_access.tenant_id)
    
    # Allow platform admins to update any field access
    if current_user.role.value == "platform_admin":
        pass  # Platform admin can update any field access
    elif user_tenant_id != field_access_tenant_id:
        logger.warning(
            f"Tenant mismatch for field access update: user_tenant={user_tenant_id}, "
            f"field_access_tenant={field_access_tenant_id}, access_id={access_id}, user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Field access belongs to a different tenant"
        )
    
    # Update fields
    update_data = access_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(field_access, field, value)
    
    field_access.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(field_access)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="form_field_access",
        resource_id=str(field_access.id),
        tenant_id=str(effective_tenant_id),
        details={"updated_fields": list(update_data.keys())},
        ip_address=None,
        user_agent=None
    )
    
    return FieldAccessResponse(
        id=str(field_access.id),
        tenant_id=str(field_access.tenant_id),
        field_name=field_access.field_name,
        field_source=field_access.field_source,
        field_source_id=str(field_access.field_source_id) if field_access.field_source_id else None,
        request_type=field_access.request_type,
        workflow_stage=field_access.workflow_stage,
        role_permissions=field_access.role_permissions,
        agent_type=field_access.agent_type,
        agent_category=field_access.agent_category,
        is_active=field_access.is_active,
        created_by=str(field_access.created_by) if field_access.created_by else None,
        created_at=field_access.created_at.isoformat(),
        updated_at=field_access.updated_at.isoformat()
    )


@router.get("/request-type/{request_type}/fields-with-access", response_model=List[FieldAccessForRole])
async def get_fields_with_access_for_role(
    request_type: str = Path(...),  # Accept any request_type (e.g., vendor_submission_workflow, agent_onboarding_workflow)
    workflow_stage: str = Query("new", pattern="^(new|in_progress|pending_approval|approved|rejected|closed|cancelled|pending_review|needs_revision)$"),
    role: Optional[str] = Query(None),
    agent_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get fields with access information for a specific role (for rendering forms)
    
    Returns ALL fields from the active layout with their resolved permissions.
    Uses hierarchical permission resolution:
    1. Entity-level permissions (baseline)
    2. Field-level permissions (EntityFieldPermission or CustomFieldCatalog)
    3. Layout-specific overrides (FormFieldAccess) - highest precedence
    
    If no layout exists, returns empty list (frontend should handle gracefully).
    """
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    
    # Use current user's role if role not specified
    user_role = role or (current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role))
    
    # Import permission resolution service
    from app.services.permission_resolution import resolve_field_permissions
    
    # Get active layout for this request type and workflow stage
    layout = _get_active_layout_internal(
        db=db,
        effective_tenant_id=effective_tenant_id,
        request_type=request_type,
        workflow_stage=workflow_stage,
        agent_type=agent_type,
        agent_category=None,
        current_user=current_user
    )
    
    if not layout or not layout.sections:
        logger.debug(f"No layout found for request_type={request_type}, workflow_stage={workflow_stage}, returning empty field access list")
        return []
    
    # Collect all field names from layout sections
    all_field_names = set()
    for section in layout.sections:
        if section.get("fields"):
            all_field_names.update(section["fields"])
    
    # Get FormFieldAccess records for quick lookup (layout-specific overrides)
    access_records = {}
    query = db.query(FormFieldAccess).filter(
        FormFieldAccess.tenant_id == effective_tenant_id,
        FormFieldAccess.request_type == request_type,
        FormFieldAccess.workflow_stage == workflow_stage,
        FormFieldAccess.is_active == True,
        FormFieldAccess.field_name.in_(all_field_names)
    )
    
    if agent_type:
        access_list = query.filter(
            (FormFieldAccess.agent_type == agent_type) | (FormFieldAccess.agent_type.is_(None))
        ).all()
    else:
        access_list = query.filter(FormFieldAccess.agent_type.is_(None)).all()
    
    # Create lookup map
    for access in access_list:
        access_records[access.field_name] = access
    
    # Resolve permissions for each field in the layout
    result = []
    for field_name in all_field_names:
        # Get FormFieldAccess record if exists
        access = access_records.get(field_name)
        
        # Determine entity_name and field_source for permission resolution
        entity_name = None
        field_source = "agent"  # Default
        custom_field_id = None
        
        if access:
            field_source = access.field_source
            if access.field_source == "agent":
                entity_name = "agents"
            elif access.field_source == "agent_metadata":
                entity_name = "agent_metadata"
            elif access.field_source == "custom_field":
                field_source = "custom_field"
                if access.field_source_id:
                    custom_field_id = access.field_source_id
            elif access.field_source == "submission_requirement":
                entity_name = "submission_requirements"
        else:
            # No FormFieldAccess record - try to infer from field name
            # Check if it's a submission requirement field
            from app.models.submission_requirement import SubmissionRequirement
            req = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == effective_tenant_id,
                SubmissionRequirement.field_name == field_name,
                SubmissionRequirement.is_active == True
            ).first()
            if req:
                field_source = "submission_requirement"
                entity_name = "submission_requirements"
            else:
                # Assume it's an agent field
                entity_name = "agents"
        
        # Resolve permissions using hierarchical system
        resolved_permissions = resolve_field_permissions(
            db=db,
            tenant_id=effective_tenant_id,
            entity_name=entity_name,
            field_name=field_name,
            field_source=field_source,
            custom_field_id=custom_field_id,
            request_type=request_type,
            workflow_stage=workflow_stage,
            role=user_role
        )
        
        # Get permissions for this role (from resolved permissions)
        # Default to deny if no permissions defined (secure by default)
        role_perm = resolved_permissions.get(user_role, {})
        can_view = role_perm.get("view", False)
        can_edit = role_perm.get("edit", False)
        
        result.append(FieldAccessForRole(
            field_name=field_name,
            can_view=can_view,
            can_edit=can_edit,
            field_source=field_source,
            field_source_id=str(access.field_source_id) if access and access.field_source_id else None
        ))
    
    return result
