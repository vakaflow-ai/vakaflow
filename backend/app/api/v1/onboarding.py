"""
Customer onboarding API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.api.v1.auth import get_current_user
from app.core.feature_gating import FeatureGate

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingRequest(BaseModel):
    """Onboarding request schema"""
    company_name: str = Field(..., min_length=1, max_length=255)
    contact_email: EmailStr
    contact_name: str = Field(..., min_length=1, max_length=255)
    contact_phone: Optional[str] = None
    license_tier: str = Field(default="trial", pattern="^(trial|basic|professional|enterprise)$")
    requirements: Optional[Dict] = None  # Integration requirements, etc.


class OnboardingStep(BaseModel):
    """Onboarding step schema"""
    step: str
    status: str  # pending, in_progress, completed, failed
    message: Optional[str] = None


class OnboardingStatus(BaseModel):
    """Onboarding status schema"""
    tenant_id: Optional[str]
    status: str  # not_started, in_progress, completed, failed
    current_step: Optional[str]
    steps: List[OnboardingStep]
    progress: int  # 0-100


@router.post("/request", status_code=status.HTTP_201_CREATED)
async def request_onboarding(
    request: OnboardingRequest,
    db: Session = Depends(get_db)
):
    """Request tenant onboarding (public endpoint)"""
    # Generate slug from company name
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', request.company_name.lower()).strip('-')
    
    # Ensure uniqueness
    base_slug = slug
    counter = 1
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Create tenant
    tenant = Tenant(
        name=request.company_name,
        slug=slug,
        contact_email=request.contact_email,
        contact_name=request.contact_name,
        contact_phone=request.contact_phone,
        license_tier=request.license_tier,
        status="pending",
        onboarding_status="in_progress",
        settings=request.requirements or {}
    )
    
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    return {
        "tenant_id": str(tenant.id),
        "slug": tenant.slug,
        "status": "onboarding_requested",
        "message": "Onboarding request submitted. Platform admin will review and activate your account."
    }


@router.get("/status/{tenant_id}", response_model=OnboardingStatus)
async def get_onboarding_status(
    tenant_id: UUID,
    db: Session = Depends(get_db)
):
    """Get onboarding status for a tenant"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Define onboarding steps
    steps = [
        {"step": "account_creation", "status": "completed" if tenant.id else "pending"},
        {"step": "admin_review", "status": "completed" if tenant.status != "pending" else "pending"},
        {"step": "initial_setup", "status": "completed" if tenant.onboarding_status == "completed" else "pending"},
        {"step": "integration_config", "status": "pending"},
        {"step": "user_creation", "status": "pending"},
    ]
    
    # Calculate progress
    completed = sum(1 for s in steps if s["status"] == "completed")
    progress = int((completed / len(steps)) * 100)
    
    return OnboardingStatus(
        tenant_id=str(tenant.id),
        status=tenant.onboarding_status,
        current_step=steps[completed]["step"] if completed < len(steps) else None,
        steps=[OnboardingStep(**s) for s in steps],
        progress=progress
    )


@router.post("/{tenant_id}/setup")
async def setup_tenant(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete tenant setup (after admin approval)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check permissions
    if current_user.role.value not in ["platform_admin", "tenant_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if tenant is active
    if tenant.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant status is {tenant.status}, must be active"
        )
    
    # Create default vendor for tenant
    vendor = db.query(Vendor).filter(
        Vendor.tenant_id == tenant_id,
        Vendor.contact_email == tenant.contact_email
    ).first()
    
    if not vendor:
        vendor = Vendor(
            name=tenant.name,
            contact_email=tenant.contact_email,
            contact_name=tenant.contact_name,
            contact_phone=tenant.contact_phone,
            tenant_id=tenant_id
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
    
    # Update onboarding status
    tenant.onboarding_status = "completed"
    tenant.onboarding_completed_at = datetime.utcnow()
    db.commit()
    
    return {
        "tenant_id": str(tenant_id),
        "vendor_id": str(vendor.id),
        "status": "setup_completed",
        "features": FeatureGate.get_tenant_features(db, str(tenant_id))
    }

