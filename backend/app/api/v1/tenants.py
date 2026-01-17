"""
Tenant management API endpoints (Platform Admin only)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from uuid import UUID
from datetime import datetime
import os
import re
import aiofiles
from app.core.database import get_db
from app.models.tenant import Tenant, TenantFeature
from app.models.user import User, UserRole
from app.api.v1.auth import get_current_user
from app.core.feature_gating import FeatureGate
from app.core.config import settings
from app.core.security_middleware import sanitize_input
from app.services.email_service import email_service

router = APIRouter(prefix="/tenants", tags=["tenants"])


def parse_max_value(value: Optional[str]) -> Optional[int]:
    """Parse max_agents or max_users value, handling 'unlimited' string"""
    if not value:
        return None
    if value.lower() == 'unlimited':
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


class TenantCreate(BaseModel):
    """Tenant creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern="^[a-z0-9-]+$")
    contact_email: str
    contact_name: Optional[str] = None
    license_tier: str = Field(default="trial", pattern="^(trial|basic|professional|enterprise)$")
    max_agents: Optional[int] = None
    max_users: Optional[int] = None
    tenant_admin_email: Optional[str] = None  # Email of user to assign as tenant admin
    tenant_admin_name: Optional[str] = None  # Name of tenant admin (if creating new user)
    tenant_admin_password: Optional[str] = None  # Password for new tenant admin (if creating)


class TenantUpdate(BaseModel):
    """Tenant update schema"""
    name: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(pending|active|suspended|cancelled)$")
    license_tier: Optional[str] = Field(None, pattern="^(trial|basic|professional|enterprise)$")
    max_agents: Optional[int] = None
    max_users: Optional[int] = None
    settings: Optional[Dict] = None
    custom_branding: Optional[Dict] = None  # Logo URL, colors, etc.
    # Tenant Profile Fields
    industry: Optional[str] = Field(None, max_length=100, description="Tenant industry (healthcare, finance, technology, etc.)")
    timezone: Optional[str] = Field(None, max_length=50, description="Timezone (e.g., 'America/New_York', 'UTC')")
    locale: Optional[str] = Field(None, max_length=10, description="Locale code (e.g., 'en', 'en-US', 'fr')")
    i18n_settings: Optional[Dict] = Field(None, description="I18N settings: date_format, time_format, currency, etc.")
    # Contact Fields
    contact_email: Optional[str] = Field(None, description="Contact email")
    contact_name: Optional[str] = Field(None, description="Contact name")
    contact_phone: Optional[str] = Field(None, description="Contact phone")
    website: Optional[str] = Field(None, max_length=500, description="Website URL")
    company_address: Optional[str] = Field(None, max_length=1000, description="Company address")
    tenant_admin_email: Optional[str] = Field(None, description="Email of the tenant admin user")


class TenantResponse(BaseModel):
    """Tenant response schema"""
    id: str
    name: str
    slug: str
    status: str
    license_tier: str
    max_agents: Optional[int]
    max_users: Optional[int]
    onboarding_status: str
    features: Dict[str, bool]
    custom_branding: Optional[Dict] = None  # Logo URL, colors, etc.
    # Tenant Profile Fields
    industry: Optional[str] = None
    timezone: Optional[str] = None
    locale: Optional[str] = None
    i18n_settings: Optional[Dict] = None
    # Contact Fields
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    company_address: Optional[str] = None
    created_at: datetime
    tenant_admin_email: Optional[str] = None
    
    class Config:
        from_attributes = True


class TenantFeatureUpdate(BaseModel):
    """Tenant feature update schema"""
    feature_key: str
    enabled: bool
    expires_at: Optional[datetime] = None


def require_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require platform admin role"""
    # Handle both enum and string role values
    role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required"
        )
    return current_user


def require_tenant_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require tenant admin or platform admin role"""
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    # Get role as string - handle enum, string, or any other type
    role_str = None
    role_allowed = False
    allowed_roles = ["tenant_admin", "platform_admin"]
    
    # First, try to get role value in multiple ways
    try:
        # Method 1: Check if it's a UserRole enum instance
        if isinstance(current_user.role, UserRole):
            role_str = current_user.role.value
            role_allowed = current_user.role in [UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN]
        # Method 2: Check if it has a value attribute
        elif hasattr(current_user.role, 'value'):
            role_str = current_user.role.value
        # Method 3: Check if it's already a string
        elif isinstance(current_user.role, str):
            role_str = current_user.role
        # Method 4: Convert to string
        else:
            role_str = str(current_user.role) if current_user.role else None
    except Exception as e:
        logger.error(f"Error extracting role: {e}", exc_info=True)
        role_str = None
    
    # Normalize role string to lowercase for comparison
    if role_str:
        role_str = str(role_str).strip().lower()
    
    # Check if role is allowed (multiple checks for robustness)
    if not role_allowed and role_str:
        # Check 1: Direct string comparison
        role_allowed = role_str in allowed_roles
        
        # Check 2: Compare with enum values
        if not role_allowed:
            try:
                if role_str == UserRole.TENANT_ADMIN.value.lower():
                    role_allowed = True
                elif role_str == UserRole.PLATFORM_ADMIN.value.lower():
                    role_allowed = True
            except Exception:
                pass
        
        # Check 3: Direct enum comparison (if role is still an enum)
        if not role_allowed and isinstance(current_user.role, UserRole):
            role_allowed = current_user.role in [UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN]
    
    # Final fallback: if we still don't have a match, try string comparison one more time
    if not role_allowed and role_str:
        role_allowed = role_str in allowed_roles
    
    # Log for debugging - use both logger and print to ensure we see it
    log_msg = (
        f"Tenant admin check - User: {current_user.email}, "
        f"Role object: {repr(current_user.role)}, "
        f"Role type: {type(current_user.role).__name__}, "
        f"Role string: '{role_str}', "
        f"Allowed: {role_allowed}, "
        f"Tenant ID: {current_user.tenant_id}"
    )
    logger.info(log_msg)
    print(f"[TENANT_ADMIN_CHECK] {log_msg}", file=sys.stderr)
    
    # If still not allowed, try one more direct check using the raw role attribute
    if not role_allowed:
        try:
            # Direct attribute access - sometimes SQLAlchemy returns the enum differently
            raw_role = getattr(current_user, 'role', None)
            if raw_role:
                # Try comparing directly
                if str(raw_role).lower() in allowed_roles or \
                   (hasattr(raw_role, 'value') and str(raw_role.value).lower() in allowed_roles) or \
                   (isinstance(raw_role, UserRole) and raw_role in [UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN]):
                    role_allowed = True
                    role_str = raw_role.value if hasattr(raw_role, 'value') else str(raw_role)
                    logger.info(f"Role check passed via direct attribute access: {role_str}")
        except Exception as e:
            logger.debug(f"Direct attribute check failed: {e}")
    
    if not role_allowed:
        error_msg = (
            f"Access denied - User: {current_user.email}, "
            f"Role: {repr(current_user.role)}, "
            f"Role string: '{role_str}', "
            f"Allowed roles: {allowed_roles}"
        )
        logger.warning(error_msg)
        print(f"[TENANT_ADMIN_CHECK] {error_msg}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant admin access required. Current role: {role_str or 'unknown'}"
        )
    
    # Check tenant_id (only for tenant_admin, platform_admin can access without tenant_id)
    if not current_user.tenant_id:
        # Check if user is platform_admin (they might not have tenant_id)
        is_platform_admin = (role_str == "platform_admin")
        
        if not is_platform_admin:
            logger.warning(f"Access denied - User: {current_user.email} has no tenant_id and is not platform_admin")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant access required"
            )
    
    logger.info(f"Access granted - User: {current_user.email}, Role: {role_str}, Tenant ID: {current_user.tenant_id}")
    return current_user


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Create a new tenant (Platform Admin only)"""
    # Check if slug exists
    existing = db.query(Tenant).filter(Tenant.slug == tenant_data.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant slug already exists"
        )
    
    # Create tenant
    tenant = Tenant(
        name=tenant_data.name,
        slug=tenant_data.slug,
        contact_email=tenant_data.contact_email,
        contact_name=tenant_data.contact_name,
        license_tier=tenant_data.license_tier,
        max_agents=str(tenant_data.max_agents) if tenant_data.max_agents else None,
        max_users=str(tenant_data.max_users) if tenant_data.max_users else None,
        created_by=current_user.id,
        status="pending",
        onboarding_status="not_started"
    )
    
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    # Create default workflow for the new tenant
    from app.services.workflow_seeder import create_default_workflow_for_tenant
    from app.services.role_permission_service import RolePermissionService
    try:
        create_default_workflow_for_tenant(db, tenant.id, current_user.id)
        # Also seed role permissions for the new tenant
        await RolePermissionService.seed_tenant_permissions(db, tenant.id)
        db.commit()
    except Exception as e:
        # Log error but don't fail tenant creation
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to seed defaults for tenant {tenant.id}: {str(e)}")
    
    # Assign tenant admin if provided
    if tenant_data.tenant_admin_email:
        from app.core.security import get_password_hash
        # Check if user exists
        existing_user = db.query(User).filter(User.email == tenant_data.tenant_admin_email.lower()).first()
        if existing_user:
            # Update existing user to tenant admin
            existing_user.role = UserRole.TENANT_ADMIN
            existing_user.tenant_id = tenant.id
            if tenant_data.tenant_admin_password:
                existing_user.hashed_password = get_password_hash(tenant_data.tenant_admin_password)
        else:
            # Create new tenant admin user
            if not tenant_data.tenant_admin_name or not tenant_data.tenant_admin_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="tenant_admin_name and tenant_admin_password required when creating new user"
                )
            new_admin = User(
                email=tenant_data.tenant_admin_email.lower(),
                name=tenant_data.tenant_admin_name,
                role=UserRole.TENANT_ADMIN,
                tenant_id=tenant.id,
                hashed_password=get_password_hash(tenant_data.tenant_admin_password),
                is_active=True
            )
            db.add(new_admin)
        db.commit()
    
    # Get features (optimized - pass tenant to avoid re-query)
    features = FeatureGate.get_tenant_features(db, str(tenant.id), tenant=tenant)
    
    # Send onboarding notification
    if tenant.contact_email:
        await email_service.send_tenant_onboarding_notification(
            to_email=tenant.contact_email,
            tenant_name=tenant.name,
            action="created",
            details={
                "License Tier": tenant.license_tier,
                "Status": tenant.status,
                "Max Agents": tenant.max_agents or "Unlimited",
                "Max Users": tenant.max_users or "Unlimited"
            }
        )

    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=features,
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at,
        tenant_admin_email=tenant_data.tenant_admin_email
    )


@router.get("", response_model=List[TenantResponse])
async def list_tenants(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all tenants (Platform Admin only) - Special exception: platform admins without tenant_id can view tenants to assign themselves"""
    # Allow platform admins even without tenant_id to view tenants (so they can assign themselves)
    if current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can view all tenants"
        )
    query = db.query(Tenant)
    
    if status_filter:
        query = query.filter(Tenant.status == status_filter)
    
    total = query.count()
    tenants = query.order_by(Tenant.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Get tenant admin emails
    tenant_ids = [t.id for t in tenants]
    admin_emails = {}
    if tenant_ids:
        # Use string comparison for robustness with Enums
        admins = db.query(User).filter(
            User.tenant_id.in_(tenant_ids),
            cast(User.role, String).in_(["tenant_admin", "UserRole.TENANT_ADMIN"])
        ).all()
        for admin in admins:
            if admin.tenant_id not in admin_emails:
                admin_emails[str(admin.tenant_id)] = admin.email

    return [
        TenantResponse(
            id=str(t.id),
            name=t.name,
            slug=t.slug,
            status=t.status,
            license_tier=t.license_tier,
            max_agents=parse_max_value(t.max_agents),
            max_users=parse_max_value(t.max_users),
            onboarding_status=t.onboarding_status,
            features=FeatureGate.get_tenant_features(db, str(t.id), tenant=t),
            custom_branding=t.custom_branding,
            industry=t.industry,
            timezone=t.timezone,
            locale=t.locale,
            i18n_settings=t.i18n_settings,
            contact_email=t.contact_email,
            contact_name=t.contact_name,
            contact_phone=t.contact_phone,
            website=t.website,
            created_at=t.created_at,
            tenant_admin_email=admin_emails.get(str(t.id))
        )
        for t in tenants
    ]


@router.get("/me", response_model=TenantResponse)
async def get_my_tenant(
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Get current user's tenant information (Tenant Admin only)"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Getting tenant for user {current_user.email}, tenant_id: {current_user.tenant_id}, role: {current_user.role}")
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Optimize: Pass tenant object to avoid re-querying
    features = FeatureGate.get_tenant_features(db, str(tenant.id), tenant=tenant)
    
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=features,
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at
    )


@router.patch("/me", response_model=TenantResponse)
async def update_my_tenant(
    tenant_data: TenantUpdate,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Update current user's tenant (Tenant Admin only)"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Updating tenant for user {current_user.email}, tenant_id: {current_user.tenant_id}")
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update fields (tenant admins can update profile fields, but not status/license_tier)
    if tenant_data.name is not None:
        tenant.name = tenant_data.name
    if tenant_data.industry is not None:
        tenant.industry = tenant_data.industry
    if tenant_data.timezone is not None:
        tenant.timezone = tenant_data.timezone
    if tenant_data.locale is not None:
        tenant.locale = tenant_data.locale
    if tenant_data.i18n_settings is not None:
        tenant.i18n_settings = tenant_data.i18n_settings
    if tenant_data.custom_branding is not None:
        from sqlalchemy.orm.attributes import flag_modified
        if not tenant.custom_branding:
            tenant.custom_branding = {}
        # Create new dict to ensure SQLAlchemy detects the change
        updated_branding = dict(tenant.custom_branding)
        updated_branding.update(tenant_data.custom_branding)
        tenant.custom_branding = updated_branding
        flag_modified(tenant, "custom_branding")
    
    # Contact fields (if provided)
    if tenant_data.contact_email is not None:
        tenant.contact_email = tenant_data.contact_email
    if tenant_data.contact_name is not None:
        tenant.contact_name = tenant_data.contact_name
    if tenant_data.contact_phone is not None:
        tenant.contact_phone = tenant_data.contact_phone
    if tenant_data.website is not None:
        tenant.website = tenant_data.website
    
    db.commit()
    db.refresh(tenant)
    
    # Send onboarding notification for updates
    if tenant.contact_email:
        await email_service.send_tenant_onboarding_notification(
            to_email=tenant.contact_email,
            tenant_name=tenant.name,
            action="updated",
            details={
                "License Tier": tenant.license_tier,
                "Status": tenant.status,
                "Max Agents": tenant.max_agents or "Unlimited",
                "Max Users": tenant.max_users or "Unlimited"
            }
        )

    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id)),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at
    )


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get tenant details (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Get tenant admin email
    admin_user = db.query(User).filter(
        User.tenant_id == tenant.id, 
        cast(User.role, String).in_(["tenant_admin", "UserRole.TENANT_ADMIN"])
    ).first()
    tenant_admin_email = admin_user.email if admin_user else None

    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id), tenant=tenant),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at,
        tenant_admin_email=tenant_admin_email
    )


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update tenant (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update fields
    if tenant_data.name is not None:
        tenant.name = tenant_data.name
    if tenant_data.status is not None:
        tenant.status = tenant_data.status
    if tenant_data.license_tier is not None:
        tenant.license_tier = tenant_data.license_tier
    if tenant_data.max_agents is not None:
        tenant.max_agents = str(tenant_data.max_agents) if tenant_data.max_agents else None
    if tenant_data.max_users is not None:
        tenant.max_users = str(tenant_data.max_users) if tenant_data.max_users else None
    if tenant_data.settings is not None:
        tenant.settings = tenant_data.settings
    if tenant_data.custom_branding is not None:
        tenant.custom_branding = tenant_data.custom_branding
    if tenant_data.industry is not None:
        tenant.industry = tenant_data.industry
    if tenant_data.timezone is not None:
        tenant.timezone = tenant_data.timezone
    if tenant_data.locale is not None:
        tenant.locale = tenant_data.locale
    if tenant_data.i18n_settings is not None:
        tenant.i18n_settings = tenant_data.i18n_settings
    if tenant_data.website is not None:
        tenant.website = tenant_data.website
    
    # Update tenant admin email if provided
    if tenant_data.tenant_admin_email:
        # Find current admin
        admin_user = db.query(User).filter(
            User.tenant_id == tenant.id, 
            cast(User.role, String).in_(["tenant_admin", "UserRole.TENANT_ADMIN"])
        ).first()
        if admin_user:
            # Check if email is already in use by another user
            existing_user = db.query(User).filter(User.email == tenant_data.tenant_admin_email.lower(), User.id != admin_user.id).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already in use by another user"
                )
            admin_user.email = tenant_data.tenant_admin_email.lower()
    
    db.commit()
    db.refresh(tenant)
    
    # Get updated tenant admin email
    admin_user = db.query(User).filter(
        User.tenant_id == tenant.id, 
        cast(User.role, String).in_(["tenant_admin", "UserRole.TENANT_ADMIN"])
    ).first()
    tenant_admin_email = admin_user.email if admin_user else None
    
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id)),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        created_at=tenant.created_at,
        tenant_admin_email=tenant_admin_email
    )


@router.post("/{tenant_id}/features", response_model=Dict[str, bool])
async def update_tenant_feature(
    tenant_id: UUID,
    feature_data: TenantFeatureUpdate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update tenant feature override (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check if feature exists
    if feature_data.feature_key not in FeatureGate.FEATURES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown feature: {feature_data.feature_key}"
        )
    
    # Update or create feature override
    tenant_feature = db.query(TenantFeature).filter(
        TenantFeature.tenant_id == tenant_id,
        TenantFeature.feature_key == feature_data.feature_key
    ).first()
    
    if tenant_feature:
        tenant_feature.enabled = feature_data.enabled
        tenant_feature.expires_at = feature_data.expires_at
    else:
        tenant_feature = TenantFeature(
            tenant_id=tenant_id,
            feature_key=feature_data.feature_key,
            enabled=feature_data.enabled,
            expires_at=feature_data.expires_at
        )
        db.add(tenant_feature)
    
    db.commit()
    
    return FeatureGate.get_tenant_features(db, str(tenant_id))


@router.post("/{tenant_id}/complete-onboarding")
async def complete_onboarding(
    tenant_id: UUID,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Mark tenant onboarding as complete (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    tenant.onboarding_status = "completed"
    tenant.onboarding_completed_at = datetime.utcnow()
    tenant.status = "active"
    
    db.commit()
    
    return {
        "tenant_id": str(tenant_id),
        "status": "onboarding_completed",
        "message": "Tenant onboarding completed successfully"
    }


@router.get("/me/branding", response_model=Dict)
async def get_my_tenant_branding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's tenant branding (for tenant admins and users)"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not assigned to a tenant"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return {
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "custom_branding": tenant.custom_branding or {}
    }


@router.get("/me/features", response_model=Dict[str, bool])
async def get_my_tenant_features(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's tenant features (for all authenticated users)"""
    from app.core.tenant_utils import get_effective_tenant_id
    from app.core.feature_gating import FeatureGate
    
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not assigned to a tenant"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Get tenant features (read-only, safe for all users)
    features = FeatureGate.get_tenant_features(db, str(tenant.id), tenant=tenant)
    
    return features


async def _upload_logo_for_tenant(tenant: Tenant, file: UploadFile, db: Session) -> TenantResponse:
    """Helper function to upload logo for a tenant"""
    # Validate file type (images only)
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Validate file size (max 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 5MB limit"
        )
    
    # Sanitize filename
    safe_filename = sanitize_input(file.filename or "logo", max_length=255)
    safe_filename = os.path.basename(safe_filename)
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', safe_filename)
    
    # Create upload directory
    upload_dir = os.path.join(settings.UPLOAD_DIR, "tenants", str(tenant.id))
    os.makedirs(upload_dir, exist_ok=True)
    
    # Determine file extension from content type
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg"
    }
    ext = ext_map.get(file.content_type, ".jpg")
    
    # Save file
    filename = f"logo{ext}"
    file_path = os.path.join(upload_dir, filename)
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Update tenant branding - preserve existing branding and only update logo fields
    from sqlalchemy.orm.attributes import flag_modified
    if not tenant.custom_branding:
        tenant.custom_branding = {}
    
    # Create new dict to ensure SQLAlchemy detects the change
    # Preserve all existing branding fields and only update logo-related fields
    updated_branding = dict(tenant.custom_branding)
    updated_branding["logo_url"] = f"/uploads/tenants/{tenant.id}/{filename}"
    updated_branding["logo_path"] = file_path
    tenant.custom_branding = updated_branding
    flag_modified(tenant, "custom_branding")
    
    db.commit()
    db.refresh(tenant)
    
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id)),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at
    )


@router.post("/me/logo", response_model=TenantResponse)
async def upload_my_tenant_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Upload logo for current user's tenant (Tenant Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return await _upload_logo_for_tenant(tenant, file, db)


@router.post("/{tenant_id}/logo", response_model=TenantResponse)
async def upload_tenant_logo(
    tenant_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Upload tenant logo (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return await _upload_logo_for_tenant(tenant, file, db)


@router.post("/me/fetch-logo", response_model=TenantResponse)
async def fetch_logo_from_website(
    website: str = Query(..., description="Website URL to fetch logo from"),
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Fetch logo from website and save it for current user's tenant (Tenant Admin only)"""
    from app.services.logo_fetcher import LogoFetcher
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Fetch logo URL from website
    logo_url = await LogoFetcher.fetch_logo_from_website(website)
    if not logo_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not find logo on the website. Please try uploading manually."
        )
    
    # Download the logo
    logo_data = await LogoFetcher.download_logo(logo_url, str(tenant.id))
    if not logo_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to download logo. Please try uploading manually."
        )
    
    filename, content = logo_data
    
    # Save logo file
    upload_dir = os.path.join(settings.UPLOAD_DIR, "tenants", str(tenant.id))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, filename)
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Update tenant branding and website - preserve existing branding
    from sqlalchemy.orm.attributes import flag_modified
    if not tenant.custom_branding:
        tenant.custom_branding = {}
    
    # Create new dict to ensure SQLAlchemy detects the change
    # Preserve all existing branding fields and only update logo-related fields
    updated_branding = dict(tenant.custom_branding)
    updated_branding["logo_url"] = f"/uploads/tenants/{tenant.id}/{filename}"
    updated_branding["logo_path"] = file_path
    tenant.custom_branding = updated_branding
    flag_modified(tenant, "custom_branding")
    
    tenant.website = LogoFetcher.normalize_url(website)
    
    db.commit()
    db.refresh(tenant)
    
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id)),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at
    )


@router.get("/me/debug")
async def debug_my_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check user role and tenant access"""
    import logging
    logger = logging.getLogger(__name__)
    
    role_info = {
        "role": str(current_user.role),
        "role_type": type(current_user.role).__name__,
        "role_value": current_user.role.value if hasattr(current_user.role, 'value') else None,
        "is_userrole": isinstance(current_user.role, UserRole),
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
        "email": current_user.email,
    }
    
    logger.info(f"Debug info: {role_info}")
    
    return {
        "user_id": str(current_user.id),
        "email": current_user.email,
        "role_info": role_info,
        "has_tenant": current_user.tenant_id is not None,
    }


@router.get("/me/debug")
async def debug_my_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check user role and tenant access"""
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    # Get role as string
    role_str = None
    try:
        if isinstance(current_user.role, UserRole):
            role_str = current_user.role.value
        elif hasattr(current_user.role, 'value'):
            role_str = current_user.role.value
        elif isinstance(current_user.role, str):
            role_str = current_user.role
        else:
            role_str = str(current_user.role) if current_user.role else None
    except Exception as e:
        role_str = f"ERROR: {e}"
    
    debug_info = {
        "email": current_user.email,
        "role_object": repr(current_user.role),
        "role_type": type(current_user.role).__name__,
        "role_string": role_str,
        "role_normalized": str(role_str).strip().lower() if role_str else None,
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
        "is_userrole_instance": isinstance(current_user.role, UserRole),
        "has_value_attr": hasattr(current_user.role, 'value'),
        "allowed_roles": ["tenant_admin", "platform_admin"],
        "would_pass_check": str(role_str).strip().lower() in ["tenant_admin", "platform_admin"] if role_str else False
    }
    
    log_msg = f"DEBUG /me - {debug_info}"
    logger.info(log_msg)
    print(f"[DEBUG_TENANT_ME] {log_msg}", file=sys.stderr)
    
    return debug_info


@router.patch("/me/branding", response_model=TenantResponse)
async def update_my_tenant_branding(
    branding_data: Dict,
    current_user: User = Depends(require_tenant_admin),
    db: Session = Depends(get_db)
):
    """Update current user's tenant branding (Tenant Admin only)"""
    from sqlalchemy.orm.attributes import flag_modified
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update branding - create new dict to ensure SQLAlchemy detects the change
    if not tenant.custom_branding:
        tenant.custom_branding = {}
    
    # Merge with existing branding (preserve logo_url if not provided)
    updated_branding = dict(tenant.custom_branding)  # Create a copy
    updated_branding.update(branding_data)  # Update the copy
    tenant.custom_branding = updated_branding  # Assign the new dict
    
    # Explicitly mark the JSON column as modified for SQLAlchemy
    flag_modified(tenant, "custom_branding")
    
    db.commit()
    db.refresh(tenant)
    
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id)),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at
    )


@router.patch("/{tenant_id}/branding", response_model=TenantResponse)
async def update_tenant_branding(
    tenant_id: UUID,
    branding_data: Dict,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update tenant branding (colors, etc.) (Platform Admin only)"""
    from sqlalchemy.orm.attributes import flag_modified
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update branding - create new dict to ensure SQLAlchemy detects the change
    if not tenant.custom_branding:
        tenant.custom_branding = {}
    
    # Merge with existing branding (preserve logo_url if not provided)
    updated_branding = dict(tenant.custom_branding)  # Create a copy
    updated_branding.update(branding_data)  # Update the copy
    tenant.custom_branding = updated_branding  # Assign the new dict
    
    # Explicitly mark the JSON column as modified for SQLAlchemy
    flag_modified(tenant, "custom_branding")
    
    db.commit()
    db.refresh(tenant)
    
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status,
        license_tier=tenant.license_tier,
        max_agents=parse_max_value(tenant.max_agents),
        max_users=parse_max_value(tenant.max_users),
        onboarding_status=tenant.onboarding_status,
        features=FeatureGate.get_tenant_features(db, str(tenant.id)),
        custom_branding=tenant.custom_branding,
        industry=tenant.industry,
        timezone=tenant.timezone,
        locale=tenant.locale,
        i18n_settings=tenant.i18n_settings,
        contact_email=tenant.contact_email,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        website=tenant.website,
        created_at=tenant.created_at
    )
