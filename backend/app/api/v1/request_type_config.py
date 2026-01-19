"""
Request Type Configuration API
Endpoints for managing request type visibility and tenant mapping
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.request_type_config import RequestTypeConfig, RequestTypeTenantMapping, RequestTypeFormAssociation, VisibilityScope
from app.models.form_layout import FormLayout
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id

router = APIRouter(prefix="/request-type-config", tags=["request-type-config"])


class RequestTypeConfigCreate(BaseModel):
    """Create request type configuration"""
    request_type: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=255)
    visibility_scope: VisibilityScope = Field(default=VisibilityScope.BOTH)
    is_enabled: bool = Field(default=True)
    show_tenant_name: bool = Field(default=False)
    tenant_display_format: Optional[str] = Field(default=None, max_length=100)
    internal_portal_order: Optional[int] = None
    external_portal_order: Optional[int] = None
    allowed_roles: Optional[List[str]] = None
    description: Optional[str] = None
    icon_class: Optional[str] = None
    config_options: Optional[Dict[str, Any]] = None
    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)


class RequestTypeConfigUpdate(BaseModel):
    """Update request type configuration"""
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    visibility_scope: Optional[VisibilityScope] = None
    is_enabled: Optional[bool] = None
    show_tenant_name: Optional[bool] = None
    tenant_display_format: Optional[str] = Field(default=None, max_length=100)
    internal_portal_order: Optional[int] = None
    external_portal_order: Optional[int] = None
    allowed_roles: Optional[List[str]] = None
    description: Optional[str] = None
    icon_class: Optional[str] = None
    config_options: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class RequestTypeConfigResponse(BaseModel):
    """Request type configuration response"""
    id: str
    tenant_id: str
    request_type: str
    display_name: str
    visibility_scope: str
    is_enabled: bool
    show_tenant_name: bool
    tenant_display_format: Optional[str]
    internal_portal_order: Optional[int]
    external_portal_order: Optional[int]
    allowed_roles: Optional[List[str]]
    description: Optional[str]
    icon_class: Optional[str]
    config_options: Optional[Dict[str, Any]]
    is_active: bool
    is_default: bool
    created_by: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class TenantMappingCreate(BaseModel):
    """Create tenant mapping for request type"""
    tenant_id: UUID
    external_display_name: str = Field(..., min_length=1, max_length=255)
    external_description: Optional[str] = None
    is_visible_externally: bool = Field(default=True)
    external_order: Optional[int] = None


class TenantMappingResponse(BaseModel):
    """Tenant mapping response"""
    id: str
    request_type_config_id: str
    tenant_id: str
    tenant_name: str
    external_display_name: str
    external_description: Optional[str]
    is_visible_externally: bool
    external_order: Optional[int]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class OnboardingOption(BaseModel):
    """Onboarding option for display in hub"""
    request_type: str
    display_name: str
    description: Optional[str]
    icon_class: Optional[str]
    visibility_scope: str
    is_enabled: bool
    tenant_specific: bool
    tenant_display_name: Optional[str]
    portal_order: Optional[int]
    allowed_roles: Optional[List[str]]


class FormAssociationCreate(BaseModel):
    """Create form association with request type"""
    form_layout_id: UUID
    display_order: int = 0
    is_primary: bool = False
    form_variation_type: Optional[str] = None


class FormAssociationUpdate(BaseModel):
    """Update form association"""
    display_order: Optional[int] = None
    is_primary: Optional[bool] = None
    form_variation_type: Optional[str] = None


class FormAssociationResponse(BaseModel):
    """Form association response with form details"""
    id: str
    request_type_config_id: str
    form_layout_id: str
    display_order: int
    is_primary: bool
    form_variation_type: Optional[str]
    created_at: str
    updated_at: str
    
    # Form details
    form_name: str
    form_description: Optional[str]
    form_is_active: bool
    
    class Config:
        from_attributes = True


@router.post("/", response_model=RequestTypeConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_request_type_config(
    config_data: RequestTypeConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new request type configuration"""
    # Check permissions - only tenant_admin and platform_admin can create
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can create request type configurations"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Check if config already exists for this request type and tenant
    existing_config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.tenant_id == effective_tenant_id,
        RequestTypeConfig.request_type == config_data.request_type
    ).first()
    
    if existing_config:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request type configuration already exists for {config_data.request_type}"
        )
    
    # Create new config
    config = RequestTypeConfig(
        tenant_id=effective_tenant_id,
        request_type=config_data.request_type,
        display_name=config_data.display_name,
        visibility_scope=config_data.visibility_scope,
        is_enabled=config_data.is_enabled,
        show_tenant_name=config_data.show_tenant_name,
        tenant_display_format=config_data.tenant_display_format,
        internal_portal_order=config_data.internal_portal_order,
        external_portal_order=config_data.external_portal_order,
        allowed_roles=config_data.allowed_roles,
        description=config_data.description,
        icon_class=config_data.icon_class,
        config_options=config_data.config_options,
        is_active=config_data.is_active,
        is_default=config_data.is_default,
        created_by=current_user.id
    )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return config


@router.get("/", response_model=List[RequestTypeConfigResponse])
async def list_request_type_configs(
    is_active: Optional[bool] = Query(None),
    visibility_scope: Optional[VisibilityScope] = Query(None),
    limit: Optional[int] = Query(100, le=500),  # Add reasonable limit
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List request type configurations with performance optimization"""
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    # Build query with indexes
    query = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.tenant_id == effective_tenant_id
    )
    
    if is_active is not None:
        query = query.filter(RequestTypeConfig.is_active == is_active)
    
    if visibility_scope:
        query = query.filter(RequestTypeConfig.visibility_scope == visibility_scope)
    
    # Add limit for performance
    query = query.limit(limit)
    
    # Optimize ordering - use indexed column
    configs = query.order_by(RequestTypeConfig.created_at.desc()).all()
    return configs


@router.get("/{config_id}", response_model=RequestTypeConfigResponse)
async def get_request_type_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific request type configuration"""
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    return config


@router.put("/{config_id}", response_model=RequestTypeConfigResponse)
async def update_request_type_config(
    config_id: UUID,
    config_data: RequestTypeConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a request type configuration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can update request type configurations"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Update fields
    update_data = config_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    return config


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request_type_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a request type configuration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can delete request type configurations"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Delete related tenant mappings first
    db.query(RequestTypeTenantMapping).filter(
        RequestTypeTenantMapping.request_type_config_id == config_id
    ).delete()
    
    # Delete the config
    db.delete(config)
    db.commit()


@router.post("/{config_id}/tenant-mappings", response_model=TenantMappingResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant_mapping(
    config_id: UUID,
    mapping_data: TenantMappingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a tenant mapping for a request type configuration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can create tenant mappings"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Verify the config exists and belongs to the tenant
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Get tenant name
    from app.models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.id == mapping_data.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check if mapping already exists
    existing_mapping = db.query(RequestTypeTenantMapping).filter(
        RequestTypeTenantMapping.request_type_config_id == config_id,
        RequestTypeTenantMapping.tenant_id == mapping_data.tenant_id
    ).first()
    
    if existing_mapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tenant mapping already exists for tenant {tenant.name}"
        )
    
    # Create mapping
    mapping = RequestTypeTenantMapping(
        request_type_config_id=config_id,
        tenant_id=mapping_data.tenant_id,
        tenant_name=tenant.name,
        external_display_name=mapping_data.external_display_name,
        external_description=mapping_data.external_description,
        is_visible_externally=mapping_data.is_visible_externally,
        external_order=mapping_data.external_order
    )
    
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    
    return mapping


@router.get("/{config_id}/tenant-mappings", response_model=List[TenantMappingResponse])
async def list_tenant_mappings(
    config_id: UUID,
    is_visible_externally: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List tenant mappings for a request type configuration"""
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    # Verify the config exists and belongs to the tenant
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    query = db.query(RequestTypeTenantMapping).filter(
        RequestTypeTenantMapping.request_type_config_id == config_id
    )
    
    if is_visible_externally is not None:
        query = query.filter(RequestTypeTenantMapping.is_visible_externally == is_visible_externally)
    
    mappings = query.order_by(RequestTypeTenantMapping.external_order, RequestTypeTenantMapping.tenant_name).all()
    return mappings


@router.get("/hub/options", response_model=List[OnboardingOption])
async def get_onboarding_hub_options(
    portal_type: str = Query("internal", pattern="^(internal|external)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get request type options for onboarding hub display
    portal_type: "internal" or "external" to filter by visibility scope
    """
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    # Get tenant name for display purposes
    from app.models.tenant import Tenant
    current_tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
    current_tenant_name = current_tenant.name if current_tenant else "Unknown Tenant"
    
    # Query configurations based on portal type
    if portal_type == "internal":
        # Internal portal - show internal and both visibility scopes
        configs = db.query(RequestTypeConfig).filter(
            RequestTypeConfig.tenant_id == effective_tenant_id,
            RequestTypeConfig.is_active == True,
            RequestTypeConfig.is_enabled == True,
            RequestTypeConfig.visibility_scope.in_([VisibilityScope.INTERNAL, VisibilityScope.BOTH])
        ).order_by(RequestTypeConfig.internal_portal_order, RequestTypeConfig.display_name).all()
    else:
        # External portal - show external and both visibility scopes
        configs = db.query(RequestTypeConfig).filter(
            RequestTypeConfig.tenant_id == effective_tenant_id,
            RequestTypeConfig.is_active == True,
            RequestTypeConfig.is_enabled == True,
            RequestTypeConfig.visibility_scope.in_([VisibilityScope.EXTERNAL, VisibilityScope.BOTH])
        ).order_by(RequestTypeConfig.external_portal_order, RequestTypeConfig.display_name).all()
    
    # Build response options
    options = []
    for config in configs:
        # Check if this is a multi-tenant scenario (check for tenant mappings)
        tenant_mappings = db.query(RequestTypeTenantMapping).filter(
            RequestTypeTenantMapping.request_type_config_id == config.id,
            RequestTypeTenantMapping.is_visible_externally == True
        ).all()
        
        tenant_specific = len(tenant_mappings) > 1
        
        if portal_type == "external" and tenant_specific:
            # For external portal with multiple tenants, show tenant-specific options
            for mapping in tenant_mappings:
                options.append(OnboardingOption(
                    request_type=config.request_type,
                    display_name=mapping.external_display_name,
                    description=mapping.external_description or config.description,
                    icon_class=config.icon_class,
                    visibility_scope=config.visibility_scope.value,
                    is_enabled=config.is_enabled,
                    tenant_specific=True,
                    tenant_display_name=mapping.tenant_name,
                    portal_order=mapping.external_order,
                    allowed_roles=config.allowed_roles
                ))
        else:
            # Standard display
            display_name = config.display_name
            if portal_type == "external" and config.show_tenant_name:
                display_name = f"{config.display_name} - {current_tenant_name}"
            
            portal_order = config.internal_portal_order if portal_type == "internal" else config.external_portal_order
            
            options.append(OnboardingOption(
                request_type=config.request_type,
                display_name=display_name,
                description=config.description,
                icon_class=config.icon_class,
                visibility_scope=config.visibility_scope.value,
                is_enabled=config.is_enabled,
                tenant_specific=tenant_specific,
                tenant_display_name=current_tenant_name if config.show_tenant_name else None,
                portal_order=portal_order,
                allowed_roles=config.allowed_roles
            ))
    
    # Sort by portal order, then by display name
    options.sort(key=lambda x: (x.portal_order or 999, x.display_name))
    
    return options


# Form Association Endpoints

@router.get("/{config_id}/forms", response_model=List[FormAssociationResponse])
async def get_request_type_forms(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all forms associated with a request type configuration"""
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return []
    
    # Verify the request type config exists and belongs to tenant
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Get form associations with form details
    associations = db.query(RequestTypeFormAssociation, FormLayout).join(
        FormLayout, RequestTypeFormAssociation.form_layout_id == FormLayout.id
    ).filter(
        RequestTypeFormAssociation.request_type_config_id == config_id
    ).order_by(RequestTypeFormAssociation.display_order, RequestTypeFormAssociation.created_at).all()
    
    # Build response
    response = []
    for assoc, form in associations:
        response.append(FormAssociationResponse(
            id=str(assoc.id),
            request_type_config_id=str(assoc.request_type_config_id),
            form_layout_id=str(assoc.form_layout_id),
            display_order=assoc.display_order,
            is_primary=assoc.is_primary,
            form_variation_type=assoc.form_variation_type,
            created_at=assoc.created_at.isoformat(),
            updated_at=assoc.updated_at.isoformat() if assoc.updated_at else assoc.created_at.isoformat(),
            form_name=form.name,
            form_description=form.description,
            form_is_active=form.is_active
        ))
    
    return response


@router.post("/{config_id}/forms", response_model=FormAssociationResponse, status_code=status.HTTP_201_CREATED)
async def add_form_to_request_type(
    config_id: UUID,
    association_data: FormAssociationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Associate a form layout with a request type configuration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can manage form associations"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Verify the request type config exists and belongs to tenant
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Verify the form layout exists and belongs to same tenant
    form = db.query(FormLayout).filter(
        FormLayout.id == association_data.form_layout_id,
        FormLayout.tenant_id == effective_tenant_id
    ).first()
    
    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form layout not found or access denied"
        )
    
    # Check if association already exists
    existing_assoc = db.query(RequestTypeFormAssociation).filter(
        RequestTypeFormAssociation.request_type_config_id == config_id,
        RequestTypeFormAssociation.form_layout_id == association_data.form_layout_id
    ).first()
    
    if existing_assoc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Form is already associated with this request type"
        )
    
    # If setting as primary, unset other primary associations
    if association_data.is_primary:
        db.query(RequestTypeFormAssociation).filter(
            RequestTypeFormAssociation.request_type_config_id == config_id
        ).update({RequestTypeFormAssociation.is_primary: False})
    
    # Create new association
    association = RequestTypeFormAssociation(
        request_type_config_id=config_id,
        form_layout_id=association_data.form_layout_id,
        display_order=association_data.display_order,
        is_primary=association_data.is_primary,
        form_variation_type=association_data.form_variation_type
    )
    
    db.add(association)
    db.commit()
    db.refresh(association)
    
    # Return response with form details
    return FormAssociationResponse(
        id=str(association.id),
        request_type_config_id=str(association.request_type_config_id),
        form_layout_id=str(association.form_layout_id),
        display_order=association.display_order,
        is_primary=association.is_primary,
        form_variation_type=association.form_variation_type,
        created_at=association.created_at.isoformat(),
        updated_at=association.updated_at.isoformat() if association.updated_at else association.created_at.isoformat(),
        form_name=form.name,
        form_description=form.description,
        form_is_active=form.is_active
    )


@router.delete("/{config_id}/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_form_from_request_type(
    config_id: UUID,
    form_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove form association from request type configuration"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can manage form associations"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Verify the request type config exists and belongs to tenant
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Find and delete the association
    association = db.query(RequestTypeFormAssociation).filter(
        RequestTypeFormAssociation.request_type_config_id == config_id,
        RequestTypeFormAssociation.form_layout_id == form_id
    ).first()
    
    if not association:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form association not found"
        )
    
    db.delete(association)
    db.commit()


@router.patch("/{config_id}/forms/{form_id}", response_model=FormAssociationResponse)
async def update_form_association(
    config_id: UUID,
    form_id: UUID,
    update_data: FormAssociationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update form association details"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant administrators can manage form associations"
        )
    
    # Get effective tenant ID
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID required"
        )
    
    # Verify the request type config exists and belongs to tenant
    config = db.query(RequestTypeConfig).filter(
        RequestTypeConfig.id == config_id,
        RequestTypeConfig.tenant_id == effective_tenant_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type configuration not found"
        )
    
    # Find the association
    association = db.query(RequestTypeFormAssociation).filter(
        RequestTypeFormAssociation.request_type_config_id == config_id,
        RequestTypeFormAssociation.form_layout_id == form_id
    ).first()
    
    if not association:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form association not found"
        )
    
    # If setting as primary, unset other primary associations
    if update_data.is_primary is not None and update_data.is_primary:
        db.query(RequestTypeFormAssociation).filter(
            RequestTypeFormAssociation.request_type_config_id == config_id
        ).update({RequestTypeFormAssociation.is_primary: False})
    
    # Update fields
    update_dict = update_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(association, field, value)
    
    association.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(association)
    
    # Get form details for response
    form = db.query(FormLayout).filter(FormLayout.id == form_id).first()
    
    return FormAssociationResponse(
        id=str(association.id),
        request_type_config_id=str(association.request_type_config_id),
        form_layout_id=str(association.form_layout_id),
        display_order=association.display_order,
        is_primary=association.is_primary,
        form_variation_type=association.form_variation_type,
        created_at=association.created_at.isoformat(),
        updated_at=association.updated_at.isoformat() if association.updated_at else association.created_at.isoformat(),
        form_name=form.name if form else "Unknown",
        form_description=form.description if form else None,
        form_is_active=form.is_active if form else False
    )