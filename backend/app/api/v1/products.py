"""
Product management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.product import Product, ProductStatus
from app.models.vendor import Vendor
from app.models.agent import Agent, AgentProduct
from app.api.v1.auth import get_current_user
from app.core.security_middleware import sanitize_input
from app.core.tenant_utils import get_effective_tenant_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["products"])


def validate_product_tenant_access(product: Product, current_user: User, db: Session) -> None:
    """
    Validate that the current user has access to the product based on tenant isolation.
    Raises HTTPException if access is denied.
    """
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access products"
        )
    
    # Get vendor for the product
    vendor = db.query(Vendor).filter(Vendor.id == product.vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product vendor not found"
        )
    
    # Validate tenant access
    if vendor.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Product belongs to a different tenant"
        )
    
    # Vendor users can only access their own vendor's products
    if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
        user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not user_vendor or product.vendor_id != user_vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only access your own vendor's products"
            )


class ProductCreate(BaseModel):
    """Product creation schema"""
    vendor_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    product_type: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)
    sku: Optional[str] = Field(None, max_length=100)
    pricing_model: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, description="Product status (draft, active, etc.)")
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


class ProductUpdate(BaseModel):
    """Product update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    product_type: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)
    sku: Optional[str] = Field(None, max_length=100)
    pricing_model: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
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


class ProductResponse(BaseModel):
    """Product response schema"""
    id: str
    vendor_id: str
    tenant_id: Optional[str]
    name: str
    product_type: str
    category: Optional[str]
    subcategory: Optional[str]
    description: Optional[str]
    version: Optional[str]
    sku: Optional[str]
    pricing_model: Optional[str]
    website: Optional[str]
    status: str
    approval_date: Optional[str]
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


class ProductListResponse(BaseModel):
    """Product list response schema"""
    products: List[ProductResponse]
    total: int
    page: int
    limit: int


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new product"""
    try:
        # Validate user role
        if current_user.role.value not in ["vendor_user", "tenant_admin", "vendor_coordinator"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only vendors and admins can create products"
            )
        
        # Get effective tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to create products"
            )
        
        # Validate vendor exists and belongs to tenant
        vendor = db.query(Vendor).filter(Vendor.id == product_data.vendor_id).first()
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
        
        # Vendor users can only create products for their own vendor
        if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
            user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
            if not user_vendor or product_data.vendor_id != user_vendor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only create products for your own vendor"
                )
        
        # Create product
        product = Product(
            vendor_id=product_data.vendor_id,
            tenant_id=effective_tenant_id,
            name=product_data.name,
            product_type=product_data.product_type,
            category=product_data.category,
            subcategory=product_data.subcategory,
            description=product_data.description,
            version=product_data.version,
            sku=product_data.sku,
            pricing_model=product_data.pricing_model,
            website=product_data.website,
            status=product_data.status or ProductStatus.DRAFT.value,
            use_cases=product_data.use_cases,
            integration_points=product_data.integration_points,
            business_value=product_data.business_value,
            deployment_info=product_data.deployment_info,
            extra_metadata=product_data.extra_metadata
        )
        
        db.add(product)
        db.commit()
        db.refresh(product)
        
        logger.info(f"Product {product.id} created by user {current_user.id}")
        
        # Auto-trigger workflow if matching workflow found
        try:
            from app.services.workflow_orchestration import WorkflowOrchestrationService
            orchestration = WorkflowOrchestrationService(db, effective_tenant_id)
            
            entity_data = {
                "product_type": product.product_type,
                "category": product.category,
                "status": product.status
            }
            
            workflow_config = orchestration.get_workflow_for_entity(
                entity_type="product",
                entity_data=entity_data,
                request_type="product_qualification_workflow"
            )
            
            if workflow_config:
                # Store workflow info in metadata
                if not product.extra_metadata:
                    product.extra_metadata = {}
                product.extra_metadata["workflow_id"] = str(workflow_config.id)
                product.extra_metadata["workflow_stage"] = "new"
                db.commit()
                logger.info(f"Workflow {workflow_config.id} auto-triggered for product {product.id}")
        except Exception as e:
            # Don't fail product creation if workflow trigger fails
            logger.warning(f"Failed to auto-trigger workflow for product {product.id}: {e}", exc_info=True)
        
        return ProductResponse(
            id=str(product.id),
            vendor_id=str(product.vendor_id),
            tenant_id=str(product.tenant_id) if product.tenant_id else None,
            name=product.name,
            product_type=product.product_type,
            category=product.category,
            subcategory=product.subcategory,
            description=product.description,
            version=product.version,
            sku=product.sku,
            pricing_model=product.pricing_model,
            website=product.website,
            status=product.status,
            approval_date=product.approval_date.isoformat() if product.approval_date else None,
            compliance_score=product.compliance_score,
            risk_score=product.risk_score,
            use_cases=product.use_cases,
            integration_points=product.integration_points,
            business_value=product.business_value,
            deployment_info=product.deployment_info,
            metadata=product.extra_metadata,  # Map extra_metadata to metadata for response
            created_at=product.created_at.isoformat() if product.created_at else datetime.utcnow().isoformat(),
            updated_at=product.updated_at.isoformat() if product.updated_at else None,
            vendor_name=vendor.name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating product: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create product"
        )


@router.get("", response_model=ProductListResponse)
async def list_products(
    vendor_id: Optional[UUID] = Query(None, description="Filter by vendor ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List products (tenant-scoped)"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view products"
            )
        
        # Build query - filter by tenant through vendors
        vendors = db.query(Vendor).filter(Vendor.tenant_id == effective_tenant_id).all()
        vendor_ids = [v.id for v in vendors]
        
        if not vendor_ids:
            return ProductListResponse(products=[], total=0, page=page, limit=limit)
        
        query = db.query(Product).filter(Product.vendor_id.in_(vendor_ids))
        
        # Vendor users can only see their own vendor's products
        if current_user.role.value in ["vendor_user", "vendor_coordinator"]:
            user_vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
            if user_vendor:
                query = query.filter(Product.vendor_id == user_vendor.id)
            else:
                # No vendor found for user, return empty
                return ProductListResponse(products=[], total=0, page=page, limit=limit)
        
        # Apply filters
        if vendor_id:
            if vendor_id not in vendor_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Vendor belongs to a different tenant"
                )
            query = query.filter(Product.vendor_id == vendor_id)
        
        if status:
            query = query.filter(Product.status == status)
        
        if category:
            query = query.filter(Product.category == category)
        
        # Get total count
        total = query.count()
        
        # Paginate
        offset = (page - 1) * limit
        products = query.order_by(Product.created_at.desc()).offset(offset).limit(limit).all()
        
        # Get vendor names
        vendor_map = {v.id: v.name for v in vendors}
        
        product_responses = []
        for product in products:
            product_responses.append(ProductResponse(
                id=str(product.id),
                vendor_id=str(product.vendor_id),
                tenant_id=str(product.tenant_id) if product.tenant_id else None,
                name=product.name,
                product_type=product.product_type,
                category=product.category,
                subcategory=product.subcategory,
                description=product.description,
                version=product.version,
                sku=product.sku,
                pricing_model=product.pricing_model,
                website=product.website,
                status=product.status,
                approval_date=product.approval_date.isoformat() if product.approval_date else None,
                compliance_score=product.compliance_score,
                risk_score=product.risk_score,
                use_cases=product.use_cases,
                integration_points=product.integration_points,
                business_value=product.business_value,
                deployment_info=product.deployment_info,
                metadata=product.extra_metadata,  # Map extra_metadata to metadata for response
                created_at=product.created_at.isoformat() if product.created_at else datetime.utcnow().isoformat(),
                updated_at=product.updated_at.isoformat() if product.updated_at else None,
                vendor_name=vendor_map.get(product.vendor_id)
            ))
        
        return ProductListResponse(
            products=product_responses,
            total=total,
            page=page,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing products: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list products"
        )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get product details"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate tenant access
    validate_product_tenant_access(product, current_user, db)
    
    # Get vendor
    vendor = db.query(Vendor).filter(Vendor.id == product.vendor_id).first()
    
    return ProductResponse(
        id=str(product.id),
        vendor_id=str(product.vendor_id),
        tenant_id=str(product.tenant_id) if product.tenant_id else None,
        name=product.name,
        product_type=product.product_type,
        category=product.category,
        subcategory=product.subcategory,
        description=product.description,
        version=product.version,
        sku=product.sku,
        pricing_model=product.pricing_model,
        website=product.website,
        status=product.status,
        approval_date=product.approval_date.isoformat() if product.approval_date else None,
        compliance_score=product.compliance_score,
        risk_score=product.risk_score,
        use_cases=product.use_cases,
        integration_points=product.integration_points,
        business_value=product.business_value,
        deployment_info=product.deployment_info,
        extra_metadata=product.extra_metadata,
        created_at=product.created_at.isoformat() if product.created_at else datetime.utcnow().isoformat(),
        updated_at=product.updated_at.isoformat() if product.updated_at else None,
        vendor_name=vendor.name if vendor else None
    )


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate tenant access
    validate_product_tenant_access(product, current_user, db)
    
    # Update fields
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.product_type is not None:
        product.product_type = product_data.product_type
    if product_data.category is not None:
        product.category = product_data.category
    if product_data.subcategory is not None:
        product.subcategory = product_data.subcategory
    if product_data.description is not None:
        product.description = product_data.description
    if product_data.version is not None:
        product.version = product_data.version
    if product_data.sku is not None:
        product.sku = product_data.sku
    if product_data.pricing_model is not None:
        product.pricing_model = product_data.pricing_model
    if product_data.website is not None:
        product.website = product_data.website
    if product_data.status is not None:
        product.status = product_data.status
    if product_data.compliance_score is not None:
        product.compliance_score = product_data.compliance_score
    if product_data.risk_score is not None:
        product.risk_score = product_data.risk_score
    if product_data.use_cases is not None:
        product.use_cases = product_data.use_cases
    if product_data.integration_points is not None:
        from sqlalchemy.orm.attributes import flag_modified
        product.integration_points = product_data.integration_points
        flag_modified(product, "integration_points")
    if product_data.business_value is not None:
        from sqlalchemy.orm.attributes import flag_modified
        product.business_value = product_data.business_value
        flag_modified(product, "business_value")
    if product_data.deployment_info is not None:
        from sqlalchemy.orm.attributes import flag_modified
        product.deployment_info = product_data.deployment_info
        flag_modified(product, "deployment_info")
    if product_data.extra_metadata is not None:
        from sqlalchemy.orm.attributes import flag_modified
        product.extra_metadata = product_data.extra_metadata
        flag_modified(product, "extra_metadata")
    
    db.commit()
    db.refresh(product)
    
    # Get vendor
    vendor = db.query(Vendor).filter(Vendor.id == product.vendor_id).first()
    
    return ProductResponse(
        id=str(product.id),
        vendor_id=str(product.vendor_id),
        tenant_id=str(product.tenant_id) if product.tenant_id else None,
        name=product.name,
        product_type=product.product_type,
        category=product.category,
        subcategory=product.subcategory,
        description=product.description,
        version=product.version,
        sku=product.sku,
        pricing_model=product.pricing_model,
        website=product.website,
        status=product.status,
        approval_date=product.approval_date.isoformat() if product.approval_date else None,
        compliance_score=product.compliance_score,
        risk_score=product.risk_score,
        use_cases=product.use_cases,
        integration_points=product.integration_points,
        business_value=product.business_value,
        deployment_info=product.deployment_info,
        extra_metadata=product.extra_metadata,
        created_at=product.created_at.isoformat() if product.created_at else datetime.utcnow().isoformat(),
        updated_at=product.updated_at.isoformat() if product.updated_at else None,
        vendor_name=vendor.name if vendor else None
    )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate tenant access
    validate_product_tenant_access(product, current_user, db)
    
    # Only admins can delete
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete products"
        )
    
    db.delete(product)
    db.commit()
    
    logger.info(f"Product {product_id} deleted by user {current_user.id}")


@router.get("/{product_id}/agents", response_model=List[Dict[str, Any]])
async def get_product_agents(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get agents tagged under product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate tenant access
    validate_product_tenant_access(product, current_user, db)
    
    # Get agent-product relationships
    agent_products = db.query(AgentProduct).filter(AgentProduct.product_id == product_id).all()
    agent_ids = [ap.agent_id for ap in agent_products]
    
    if not agent_ids:
        return []
    
    # Get agents
    agents = db.query(Agent).filter(Agent.id.in_(agent_ids)).all()
    
    # Build response
    result = []
    for agent in agents:
        # Find relationship type
        relationship_type = None
        for ap in agent_products:
            if ap.agent_id == agent.id:
                relationship_type = ap.relationship_type
                break
        
        result.append({
            "id": str(agent.id),
            "name": agent.name,
            "type": agent.type,
            "category": agent.category,
            "version": agent.version,
            "status": agent.status,
            "relationship_type": relationship_type
        })
    
    return result


@router.post("/{product_id}/agents/{agent_id}", status_code=status.HTTP_201_CREATED)
async def tag_agent_to_product(
    product_id: UUID,
    agent_id: UUID,
    relationship_type: Optional[str] = Query(None, description="Relationship type: component, integration, dependency"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tag agent to product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Validate tenant access
    validate_product_tenant_access(product, current_user, db)
    
    # Check if relationship already exists
    existing = db.query(AgentProduct).filter(
        AgentProduct.agent_id == agent_id,
        AgentProduct.product_id == product_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent is already tagged to this product"
        )
    
    # Create relationship
    agent_product = AgentProduct(
        agent_id=agent_id,
        product_id=product_id,
        relationship_type=relationship_type
    )
    
    db.add(agent_product)
    db.commit()
    
    logger.info(f"Agent {agent_id} tagged to product {product_id} by user {current_user.id}")
    
    return {"message": "Agent tagged to product successfully"}


@router.delete("/{product_id}/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def untag_agent_from_product(
    product_id: UUID,
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Untag agent from product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate tenant access
    validate_product_tenant_access(product, current_user, db)
    
    # Find relationship
    agent_product = db.query(AgentProduct).filter(
        AgentProduct.agent_id == agent_id,
        AgentProduct.product_id == product_id
    ).first()
    
    if not agent_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent is not tagged to this product"
        )
    
    db.delete(agent_product)
    db.commit()
    
    logger.info(f"Agent {agent_id} untagged from product {product_id} by user {current_user.id}")
