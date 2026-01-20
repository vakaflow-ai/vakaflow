"""
Service management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.service import Service, ServiceStatus
from app.models.vendor import Vendor
from app.models.request_type_config import RequestTypeConfig
from app.models.workflow_config import WorkflowConfiguration, WorkflowConfigStatus
from app.api.v1.auth import get_current_user
from app.core.security_middleware import sanitize_input
from app.core.tenant_utils import get_effective_tenant_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/services", tags=["services"])


def validate_service_tenant_access(service: Service, current_user: User, db: Session) -> None:
    """
    Validate that the current user has access to the service based on tenant isolation.
    Raises HTTPException if access is denied.
    """
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access services"
        )
    
    # Get vendor for the service
    vendor = db.query(Vendor).filter(Vendor.id == service.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service vendor not found"
        )
    
    # Validate tenant access
    if vendor.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Service belongs to a different tenant"
        )
    
    # Vendor users can only access their own vendor's services
    if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
        user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not user_vendor or service.vendor_id != user_vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only access your own vendor's services"
            )


class ServiceCreate(BaseModel):
    """Service creation schema"""
    vendor_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    service_type: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    service_level: Optional[str] = Field(None, max_length=50)
    pricing_model: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, description="Service status (draft, active, etc.)")
    use_cases: Optional[str] = Field(None, description="Rich text area - list of use cases")
    integration_points: Optional[Dict[str, Any]] = None
    business_value: Optional[Dict[str, Any]] = None
    deployment_info: Optional[Dict[str, Any]] = None
    extra_metadata: Optional[Dict[str, Any]] = None
    
    @validator('name', 'description', 'use_cases')
    def sanitize_text(cls, v):
        """Sanitize text input"""
        if v:
            return sanitize_input(v)
        return v


class ServiceUpdate(BaseModel):
    """Service update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    service_type: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    service_level: Optional[str] = Field(None, max_length=50)
    pricing_model: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = None
    compliance_score: Optional[int] = Field(None, ge=0, le=100)
    risk_score: Optional[int] = Field(None, ge=0, le=100)
    use_cases: Optional[str] = None
    integration_points: Optional[Dict[str, Any]] = None
    business_value: Optional[Dict[str, Any]] = None
    deployment_info: Optional[Dict[str, Any]] = None
    extra_metadata: Optional[Dict[str, Any]] = None
    
    @validator('name', 'description', 'use_cases')
    def sanitize_text(cls, v):
        """Sanitize text input"""
        if v:
            return sanitize_input(v)
        return v


class ServiceResponse(BaseModel):
    """Service response schema"""
    id: str
    vendor_id: str
    tenant_id: Optional[str]
    name: str
    service_type: str
    category: Optional[str]
    description: Optional[str]
    service_level: Optional[str]
    pricing_model: Optional[str]
    status: str
    compliance_score: Optional[int]
    risk_score: Optional[int]
    use_cases: Optional[str]
    integration_points: Optional[Dict[str, Any]]
    business_value: Optional[Dict[str, Any]]
    deployment_info: Optional[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]]
    created_at: str
    updated_at: Optional[str]
    vendor_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ServiceListResponse(BaseModel):
    """Service list response schema"""
    services: List[ServiceResponse]
    total: int
    page: int
    limit: int


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    service_data: ServiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new service"""
    try:
        # Validate user role
        if current_user.role.value not in ["vendor_user", "tenant_admin", "vendor_coordinator"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only vendors and admins can create services"
            )
        
        # Get effective tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to create services"
            )
        
        # Validate vendor exists and belongs to tenant
        vendor = db.query(Vendor).filter(Vendor.id == service_data.vendor_id).first()
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        if vendor.tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Vendor belongs to a different tenant"
            )
        
        # Vendor users can only create services for their own vendor
        if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
            user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
            if not user_vendor or service_data.vendor_id != user_vendor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only create services for your own vendor"
                )
        
        # Create service
        service = Service(
            vendor_id=service_data.vendor_id,
            tenant_id=effective_tenant_id,
            name=service_data.name,
            service_type=service_data.service_type,
            category=service_data.category,
            description=service_data.description,
            service_level=service_data.service_level,
            pricing_model=service_data.pricing_model,
            status=service_data.status or ServiceStatus.DRAFT.value,
            use_cases=service_data.use_cases,
            integration_points=service_data.integration_points,
            business_value=service_data.business_value,
            deployment_info=service_data.deployment_info,
            extra_metadata=service_data.extra_metadata
        )
        
        db.add(service)
        db.commit()
        db.refresh(service)
        
        logger.info(f"Service {service.id} created by user {current_user.id}")
        
        # Auto-trigger workflow if matching workflow found
        try:
            from app.services.workflow_orchestration import WorkflowOrchestrationService
            orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
            
            entity_data = {
                "service_type": service.service_type,
                "category": service.category,
                "status": service.status
            }
            
            # Get the proper request type for services
            request_type_config = db.query(RequestTypeConfig).filter(
                RequestTypeConfig.tenant_id == effective_tenant_id,
                RequestTypeConfig.request_type == "service_onboarding_workflow",
                RequestTypeConfig.is_active == True
            ).first()
            
            if request_type_config and request_type_config.workflow_id:
                # Use the workflow associated with this request type
                workflow_config = db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.id == request_type_config.workflow_id,
                    WorkflowConfiguration.status == "active"
                ).first()
            else:
                # Fallback: try to find any active workflow for this tenant
                workflow_config = db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.tenant_id == effective_tenant_id,
                    WorkflowConfiguration.status == WorkflowConfigStatus.ACTIVE.value
                ).first()
            
            if workflow_config:
                # Store workflow info in metadata
                if not service.extra_metadata:
                    service.extra_metadata = {}
                service.extra_metadata["workflow_id"] = str(workflow_config.id)
                service.extra_metadata["workflow_stage"] = "new"
                db.commit()
                logger.info(f"Workflow {workflow_config.id} auto-triggered for service {service.id}")
        except Exception as e:
            # Don't fail service creation if workflow trigger fails
            logger.warning(f"Failed to auto-trigger workflow for service {service.id}: {e}", exc_info=True)
        
        return ServiceResponse(
            id=str(service.id),
            vendor_id=str(service.vendor_id),
            tenant_id=str(service.tenant_id) if service.tenant_id else None,
            name=service.name,
            service_type=service.service_type,
            category=service.category,
            description=service.description,
            service_level=service.service_level,
            pricing_model=service.pricing_model,
            status=service.status,
            compliance_score=service.compliance_score,
            risk_score=service.risk_score,
            use_cases=service.use_cases,
            integration_points=service.integration_points,
            business_value=service.business_value,
            deployment_info=service.deployment_info,
            metadata=service.extra_metadata,  # Map extra_metadata to metadata for response
            created_at=service.created_at.isoformat() if service.created_at else datetime.utcnow().isoformat(),
            updated_at=service.updated_at.isoformat() if service.updated_at else None,
            vendor_name=vendor.name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating service: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create service"
        )


@router.get("", response_model=ServiceListResponse)
async def list_services(
    vendor_id: Optional[UUID] = Query(None, description="Filter by vendor ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List services (tenant-scoped)"""
    try:
        logger.info(f"Listing services for user {current_user.id}, role: {current_user.role.value}")
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view services"
            )
        
        # Build query - filter by tenant through vendors
        vendors = db.query(Vendor).filter(Vendor.tenant_id == effective_tenant_id).all()
        vendor_ids = [v.id for v in vendors]
        
        if not vendor_ids:
            return ServiceListResponse(services=[], total=0, page=page, limit=limit)
        
        query = db.query(Service).filter(Service.vendor_id.in_(vendor_ids))
        
        # Vendor users can only see their own vendor's services
        if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
            user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
            if user_vendor:
                query = query.filter(Service.vendor_id == user_vendor.id)
            else:
                # No vendor found for user, return empty
                return ServiceListResponse(services=[], total=0, page=page, limit=limit)
        
        # Apply filters
        if vendor_id:
            if vendor_id not in vendor_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Vendor belongs to a different tenant"
                )
            query = query.filter(Service.vendor_id == vendor_id)
        
        if status:
            query = query.filter(Service.status == status)
        
        if category:
            query = query.filter(Service.category == category)
        
        # Get total count
        total = query.count()
        
        # Paginate
        offset = (page - 1) * limit
        services = query.order_by(Service.created_at.desc()).offset(offset).limit(limit).all()
        
        # Get vendor names
        vendor_map = {v.id: v.name for v in vendors}
        
        service_responses = []
        for service in services:
            service_responses.append(ServiceResponse(
                id=str(service.id),
                vendor_id=str(service.vendor_id),
                tenant_id=str(service.tenant_id) if service.tenant_id else None,
                name=service.name,
                service_type=service.service_type,
                category=service.category,
                description=service.description,
                service_level=service.service_level,
                pricing_model=service.pricing_model,
                status=service.status,
                compliance_score=service.compliance_score,
                risk_score=service.risk_score,
                use_cases=service.use_cases,
                integration_points=service.integration_points,
                business_value=service.business_value,
                deployment_info=service.deployment_info,
                metadata=service.extra_metadata,  # Map extra_metadata to metadata for response
                created_at=service.created_at.isoformat() if service.created_at else datetime.utcnow().isoformat(),
                updated_at=service.updated_at.isoformat() if service.updated_at else None,
                vendor_name=vendor_map.get(service.vendor_id)
            ))
        
        return ServiceListResponse(
            services=service_responses,
            total=total,
            page=page,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing services: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list services"
        )


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get service details"""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Validate tenant access
    validate_service_tenant_access(service, current_user, db)
    
    # Get vendor
    vendor = db.query(Vendor).filter(Vendor.id == service.vendor_id).first()
    
    return ServiceResponse(
        id=str(service.id),
        vendor_id=str(service.vendor_id),
        tenant_id=str(service.tenant_id) if service.tenant_id else None,
        name=service.name,
        service_type=service.service_type,
        category=service.category,
        description=service.description,
        service_level=service.service_level,
        pricing_model=service.pricing_model,
        status=service.status,
        compliance_score=service.compliance_score,
        risk_score=service.risk_score,
        use_cases=service.use_cases,
        integration_points=service.integration_points,
        business_value=service.business_value,
        deployment_info=service.deployment_info,
        metadata=service.extra_metadata,  # Map extra_metadata to metadata for response
        created_at=service.created_at.isoformat() if service.created_at else datetime.utcnow().isoformat(),
        updated_at=service.updated_at.isoformat() if service.updated_at else None,
        vendor_name=vendor.name if vendor else None
    )


@router.patch("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: UUID,
    service_data: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update service"""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Validate tenant access
    validate_service_tenant_access(service, current_user, db)
    
    # Update fields
    if service_data.name is not None:
        service.name = service_data.name
    if service_data.service_type is not None:
        service.service_type = service_data.service_type
    if service_data.category is not None:
        service.category = service_data.category
    if service_data.description is not None:
        service.description = service_data.description
    if service_data.service_level is not None:
        service.service_level = service_data.service_level
    if service_data.pricing_model is not None:
        service.pricing_model = service_data.pricing_model
    if service_data.status is not None:
        service.status = service_data.status
    if service_data.compliance_score is not None:
        service.compliance_score = service_data.compliance_score
    if service_data.risk_score is not None:
        service.risk_score = service_data.risk_score
    if service_data.use_cases is not None:
        service.use_cases = service_data.use_cases
    if service_data.integration_points is not None:
        from sqlalchemy.orm.attributes import flag_modified
        service.integration_points = service_data.integration_points
        flag_modified(service, "integration_points")
    if service_data.business_value is not None:
        from sqlalchemy.orm.attributes import flag_modified
        service.business_value = service_data.business_value
        flag_modified(service, "business_value")
    if service_data.deployment_info is not None:
        from sqlalchemy.orm.attributes import flag_modified
        service.deployment_info = service_data.deployment_info
        flag_modified(service, "deployment_info")
    if service_data.extra_metadata is not None:
        from sqlalchemy.orm.attributes import flag_modified
        service.extra_metadata = service_data.extra_metadata
        flag_modified(service, "extra_metadata")
    
    db.commit()
    db.refresh(service)
    
    # Get vendor
    vendor = db.query(Vendor).filter(Vendor.id == service.vendor_id).first()
    
    return ServiceResponse(
        id=str(service.id),
        vendor_id=str(service.vendor_id),
        tenant_id=str(service.tenant_id) if service.tenant_id else None,
        name=service.name,
        service_type=service.service_type,
        category=service.category,
        description=service.description,
        service_level=service.service_level,
        pricing_model=service.pricing_model,
        status=service.status,
        compliance_score=service.compliance_score,
        risk_score=service.risk_score,
        use_cases=service.use_cases,
        integration_points=service.integration_points,
        business_value=service.business_value,
        deployment_info=service.deployment_info,
        metadata=service.extra_metadata,  # Map extra_metadata to metadata for response
        created_at=service.created_at.isoformat() if service.created_at else datetime.utcnow().isoformat(),
        updated_at=service.updated_at.isoformat() if service.updated_at else None,
        vendor_name=vendor.name if vendor else None
    )


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete service"""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Validate tenant access
    validate_service_tenant_access(service, current_user, db)
    
    # Only admins can delete
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete services"
        )
    
    db.delete(service)
    db.commit()
    
    logger.info(f"Service {service_id} deleted by user {current_user.id}")
