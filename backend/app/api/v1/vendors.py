"""
Vendor management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.api.v1.auth import get_current_user
from fastapi import Request
from app.core.security_middleware import validate_file_upload, sanitize_input
import os
import aiofiles
from app.core.config import settings
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vendors", tags=["vendors"])


class VendorWithDetailsResponse(BaseModel):
    """Vendor response with POCs and agents"""
    id: str
    name: str
    contact_email: str
    contact_phone: Optional[str]
    address: Optional[str]
    website: Optional[str]
    description: Optional[str]
    logo_url: Optional[str]
    registration_number: Optional[str]
    created_at: str
    updated_at: str
    # POCs (Points of Contact) - vendor users
    pocs: List[Dict[str, Any]] = []
    # Agents count and list
    agents_count: int = 0
    agents: List[Dict[str, Any]] = []
    # Invitation info
    invitation_id: Optional[str] = None
    invited_by: Optional[str] = None
    invited_by_name: Optional[str] = None
    invitation_date: Optional[str] = None


class VendorUpdate(BaseModel):
    """Vendor update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    branding: Optional[Dict[str, Any]] = None  # Branding configuration for portal and trust center


class VendorResponse(BaseModel):
    """Vendor response schema"""
    id: str
    name: str
    contact_email: str
    contact_phone: Optional[str]
    address: Optional[str]
    website: Optional[str]
    description: Optional[str]
    logo_url: Optional[str]
    registration_number: Optional[str]
    branding: Optional[Dict[str, Any]] = None  # Branding configuration
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.get("/me", response_model=VendorResponse)
async def get_my_vendor(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's vendor profile"""
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can access this endpoint"
        )
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    return VendorResponse(
        id=str(vendor.id),
        name=vendor.name,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        address=vendor.address,
        website=vendor.website,
        description=vendor.description,
        logo_url=vendor.logo_url,
        registration_number=vendor.registration_number,
        branding=vendor.branding,
        created_at=vendor.created_at.isoformat() if vendor.created_at else datetime.utcnow().isoformat(),
        updated_at=vendor.updated_at.isoformat() if vendor.updated_at else datetime.utcnow().isoformat()
    )


@router.put("/me", response_model=VendorResponse)
async def update_my_vendor(
    vendor_data: VendorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's vendor profile"""
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can update their profile"
        )
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Update fields
    if vendor_data.name is not None:
        vendor.name = vendor_data.name
    if vendor_data.contact_phone is not None:
        vendor.contact_phone = vendor_data.contact_phone
    if vendor_data.address is not None:
        vendor.address = vendor_data.address
    if vendor_data.website is not None:
        vendor.website = vendor_data.website
    if vendor_data.description is not None:
        vendor.description = vendor_data.description
    if vendor_data.branding is not None:
        from sqlalchemy.orm.attributes import flag_modified
        if not vendor.branding:
            vendor.branding = {}
        # Create new dict to ensure SQLAlchemy detects the change
        updated_branding = dict(vendor.branding) if vendor.branding else {}
        updated_branding.update(vendor_data.branding)
        vendor.branding = updated_branding
        flag_modified(vendor, "branding")
    
    db.commit()
    db.refresh(vendor)
    
    return VendorResponse(
        id=str(vendor.id),
        name=vendor.name,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        address=vendor.address,
        website=vendor.website,
        description=vendor.description,
        logo_url=vendor.logo_url,
        registration_number=vendor.registration_number,
        branding=vendor.branding,
        created_at=vendor.created_at.isoformat() if vendor.created_at else datetime.utcnow().isoformat(),
        updated_at=vendor.updated_at.isoformat() if vendor.updated_at else datetime.utcnow().isoformat()
    )


@router.get("/me/dashboard")
async def get_vendor_dashboard(
    days: int = Query(30, ge=1, le=365),
    department: Optional[str] = Query(None, description="Filter by department"),
    organization: Optional[str] = Query(None, description="Filter by organization/BU"),
    category: Optional[str] = Query(None, description="Filter by agent category"),
    subcategory: Optional[str] = Query(None, description="Filter by agent subcategory"),
    ownership: Optional[str] = Query(None, description="Filter by ownership (vendor name or ID)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vendor dashboard analytics"""
    from sqlalchemy import func, and_
    from datetime import datetime, timedelta
    from app.models.agent import Agent, AgentStatus, AgentMetadata
    from app.models.workflow_config import OnboardingRequest
    from app.models.user import User
    
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can access this endpoint"
        )
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Build base query for vendor's agents
    agent_query = db.query(Agent).filter(Agent.vendor_id == vendor.id)
    
    # Apply filters
    if category:
        agent_query = agent_query.filter(Agent.category == category)
    if subcategory:
        agent_query = agent_query.filter(Agent.subcategory == subcategory)
    if ownership:
        # Filter by vendor name or ID
        if ownership != str(vendor.id):
            # If ownership doesn't match current vendor, filter to empty (vendor can only see their own)
            agent_query = agent_query.filter(Agent.id == None)  # This will return empty
    
    # Apply department/organization filter through users who submitted/own agents
    # This requires joining with users through some relationship
    # For now, we'll filter by the vendor's tenant users if needed
    if department or organization:
        # Get users in the tenant with matching department/organization
        user_filters = []
        if department:
            user_filters.append(User.department == department)
        if organization:
            user_filters.append(User.organization == organization)
        
        if user_filters:
            # For vendor dashboard, we can't directly link agents to users by department
            # This would require an ownership/requested_by field on agents
            # For now, we'll note this limitation and return all vendor agents
            # In a full implementation, you'd add an ownership field to agents
            pass
    
    # Get filtered agents
    agents = agent_query.all()
    agent_ids = [a.id for a in agents]
    
    # Total agents
    total_agents = len(agents)
    
    # Agents by status
    agents_by_status = {}
    for status_val in AgentStatus:
        count = len([a for a in agents if a.status == status_val.value])
        agents_by_status[status_val.value] = count
    
    # Agents submitted in date range
    recent_submissions = db.query(Agent).filter(
        Agent.vendor_id == vendor.id,
        Agent.submission_date >= start_date,
        Agent.submission_date <= end_date
    ).count()
    
    # Active onboarding requests
    active_requests = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id.in_(agent_ids),
        OnboardingRequest.status.in_(["pending", "in_review"])
    ).count()
    
    # Approved agents
    approved_count = len([a for a in agents if a.status == AgentStatus.APPROVED.value])
    
    # Average compliance score
    compliance_scores = [a.compliance_score for a in agents if a.compliance_score is not None]
    avg_compliance = sum(compliance_scores) / len(compliance_scores) if compliance_scores else None
    
    # Average risk score
    risk_scores = [a.risk_score for a in agents if a.risk_score is not None]
    avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else None
    
    # Agents by type
    agents_by_type = {}
    for agent in agents:
        agent_type = agent.type or "Unknown"
        agents_by_type[agent_type] = agents_by_type.get(agent_type, 0) + 1
    
    # Get available filter options
    all_vendor_agents = db.query(Agent).filter(Agent.vendor_id == vendor.id).all()
    
    # Available departments (from users who might own/request agents)
    # In a full implementation, you'd track ownership on agents
    available_departments = db.query(User.department).filter(
        User.tenant_id == vendor.tenant_id,
        User.department.isnot(None),
        User.department != ''
    ).distinct().all()
    departments = [d[0] for d in available_departments if d[0]]
    
    # Available organizations/BUs
    available_organizations = db.query(User.organization).filter(
        User.tenant_id == vendor.tenant_id,
        User.organization.isnot(None),
        User.organization != ''
    ).distinct().all()
    organizations = [o[0] for o in available_organizations if o[0]]
    
    # Available categories
    available_categories = db.query(Agent.category).filter(
        Agent.vendor_id == vendor.id,
        Agent.category.isnot(None),
        Agent.category != ''
    ).distinct().all()
    categories = [c[0] for c in available_categories if c[0]]
    
    # Available subcategories
    available_subcategories = db.query(Agent.subcategory).filter(
        Agent.vendor_id == vendor.id,
        Agent.subcategory.isnot(None),
        Agent.subcategory != ''
    ).distinct().all()
    subcategories = [s[0] for s in available_subcategories if s[0]]
    
    # Submission trends (last 30 days)
    submission_trends = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        count = db.query(Agent).filter(
            Agent.vendor_id == vendor.id,
            func.date(Agent.submission_date) == date.date()
        ).count()
        submission_trends.append({
            "date": date.strftime("%Y-%m-%d"),
            "value": count
        })
    
    # Recent activity (last 10 submissions)
    recent_agents = db.query(Agent).filter(
        Agent.vendor_id == vendor.id
    ).order_by(Agent.created_at.desc()).limit(10).all()
    
    recent_activity = []
    for agent in recent_agents:
        recent_activity.append({
            "type": "agent",
            "name": agent.name,
            "action": agent.status,
            "timestamp": agent.created_at.isoformat() if agent.created_at else datetime.utcnow().isoformat()
        })
    
    # Return dashboard data with filter options
    return {
        "vendor": {
            "id": str(vendor.id),
            "name": vendor.name,
            "logo_url": vendor.logo_url
        },
        "stats": {
            "total_agents": total_agents,
            "agents_by_status": agents_by_status,
            "recent_submissions": recent_submissions,
            "active_requests": active_requests,
            "approved_count": approved_count,
            "avg_compliance": round(avg_compliance, 2) if avg_compliance else None,
            "avg_risk": round(avg_risk, 2) if avg_risk else None,
            "agents_by_type": agents_by_type
        },
        "submission_trends": submission_trends,
        "recent_activity": recent_activity,
        "filter_options": {
            "departments": departments,
            "organizations": organizations,
            "categories": categories,
            "subcategories": subcategories,
            "ownerships": [{"id": str(vendor.id), "name": vendor.name}]  # Vendor can only see their own
        }
    }


@router.post("/me/logo", response_model=VendorResponse)
async def upload_vendor_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload vendor logo"""
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can upload logos"
        )
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
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
    upload_dir = os.path.join(settings.UPLOAD_DIR, "vendors", str(vendor.id))
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
    
    # Update vendor record
    # In production, you'd upload to S3/cloud storage and store the URL
    vendor.logo_path = file_path
    vendor.logo_url = f"/uploads/vendors/{vendor.id}/{filename}"  # Relative URL for now
    db.commit()
    db.refresh(vendor)
    
    return VendorResponse(
        id=str(vendor.id),
        name=vendor.name,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        address=vendor.address,
        website=vendor.website,
        description=vendor.description,
        logo_url=vendor.logo_url,
        registration_number=vendor.registration_number,
        branding=vendor.branding,
        created_at=vendor.created_at.isoformat() if vendor.created_at else datetime.utcnow().isoformat(),
        updated_at=vendor.updated_at.isoformat() if vendor.updated_at else datetime.utcnow().isoformat()
    )


@router.post("/me/fetch-logo", response_model=VendorResponse)
async def fetch_vendor_logo_from_website(
    website: str = Query(..., description="Website URL to fetch logo from"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch logo from website and save it for current user's vendor (Vendor User only)"""
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can fetch logos"
        )
    
    from app.services.logo_fetcher import LogoFetcher
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Fetch logo URL from website
    logo_url = await LogoFetcher.fetch_logo_from_website(website)
    if not logo_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not find logo on the website. Please try uploading manually."
        )
    
    # Download the logo (tenant_id parameter is just for filename, we can use vendor.id)
    logo_data = await LogoFetcher.download_logo(logo_url, str(vendor.id))
    if not logo_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to download logo. Please try uploading manually."
        )
    
    filename, content = logo_data
    
    # Save logo file
    upload_dir = os.path.join(settings.UPLOAD_DIR, "vendors", str(vendor.id))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, filename)
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Update vendor logo and website
    vendor.logo_path = file_path
    vendor.logo_url = f"/uploads/vendors/{vendor.id}/{filename}"
    vendor.website = LogoFetcher.normalize_url(website)
    
    db.commit()
    db.refresh(vendor)
    
    return VendorResponse(
        id=str(vendor.id),
        name=vendor.name,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        address=vendor.address,
        website=vendor.website,
        description=vendor.description,
        logo_url=vendor.logo_url,
        registration_number=vendor.registration_number,
        branding=vendor.branding,
        created_at=vendor.created_at.isoformat() if vendor.created_at else datetime.utcnow().isoformat(),
        updated_at=vendor.updated_at.isoformat() if vendor.updated_at else datetime.utcnow().isoformat()
    )


@router.get("/list", response_model=List[VendorWithDetailsResponse])
async def list_vendors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_recent: bool = Query(True, description="Include recent vendors (last 30 days)")
):
    """List all vendors in the tenant with their POCs and agents (tenant admin or business user only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "business_reviewer", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tenant admins and business users can view vendors"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view vendors"
        )
    
    # Build query
    query = db.query(Vendor)
    
    # Filter by tenant - ALL users must filter by tenant
    query = query.filter(Vendor.tenant_id == effective_tenant_id)
    
    # Filter recent vendors if requested
    if include_recent:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        query = query.filter(Vendor.created_at >= cutoff_date)
    
    vendors = query.order_by(Vendor.created_at.desc()).all()
    
    # Get vendor IDs
    vendor_ids = [v.id for v in vendors]
    
    # Get all vendor users (POCs) in batch - filter by tenant
    from app.models.user import UserRole
    vendor_users = db.query(User).filter(
        User.role == UserRole.VENDOR_USER,
            User.tenant_id == effective_tenant_id
    ).all()
    
    # Map users to vendors by email
    vendor_pocs = {}
    for user in vendor_users:
        vendor = db.query(Vendor).filter(Vendor.contact_email == user.email).first()
        if vendor and vendor.id in vendor_ids:
            if vendor.id not in vendor_pocs:
                vendor_pocs[vendor.id] = []
            vendor_pocs[vendor.id].append({
                "id": str(user.id),
                "name": user.name,
                "email": user.email,
                "phone": getattr(user, 'phone', None),
                "department": getattr(user, 'department', None),
                "is_active": user.is_active
            })
    
    # Get all agents for these vendors in batch
    from app.models.agent import Agent
    agents = db.query(Agent).filter(Agent.vendor_id.in_(vendor_ids)).all()
    
    # Group agents by vendor
    vendor_agents = {}
    for agent in agents:
        if agent.vendor_id not in vendor_agents:
            vendor_agents[agent.vendor_id] = []
        vendor_agents[agent.vendor_id].append({
            "id": str(agent.id),
            "name": agent.name,
            "type": agent.type,
            "status": agent.status,
            "created_at": agent.created_at.isoformat() if agent.created_at else None
        })
    
    # Get invitation info for vendors
    from app.models.vendor_invitation import VendorInvitation, InvitationStatus
    invitations = db.query(VendorInvitation).filter(
        VendorInvitation.vendor_id.in_(vendor_ids),
        VendorInvitation.status == InvitationStatus.ACCEPTED
    ).order_by(VendorInvitation.accepted_at.desc()).all()
    
    # Map invitations to vendors (get most recent)
    vendor_invitations = {}
    inviter_ids = {inv.invited_by for inv in invitations if inv.invited_by}
    inviters = {str(u.id): u for u in db.query(User).filter(User.id.in_(inviter_ids)).all()} if inviter_ids else {}
    
    for inv in invitations:
        if inv.vendor_id not in vendor_invitations:
            inviter = inviters.get(str(inv.invited_by)) if inv.invited_by else None
            vendor_invitations[inv.vendor_id] = {
                "invitation_id": str(inv.id),
                "invited_by": str(inv.invited_by) if inv.invited_by else None,
                "invited_by_name": inviter.name if inviter else None,
                "invitation_date": inv.accepted_at.isoformat() if inv.accepted_at else inv.created_at.isoformat()
            }
    
    # Build response
    result = []
    for vendor in vendors:
        inv_info = vendor_invitations.get(vendor.id, {})
        result.append(VendorWithDetailsResponse(
            id=str(vendor.id),
            name=vendor.name,
            contact_email=vendor.contact_email,
            contact_phone=vendor.contact_phone,
            address=vendor.address,
            website=vendor.website,
            description=vendor.description,
            logo_url=vendor.logo_url,
            registration_number=vendor.registration_number,
            created_at=vendor.created_at.isoformat() if vendor.created_at else datetime.utcnow().isoformat(),
            updated_at=vendor.updated_at.isoformat() if vendor.updated_at else datetime.utcnow().isoformat(),
            pocs=vendor_pocs.get(vendor.id, []),
            agents_count=len(vendor_agents.get(vendor.id, [])),
            agents=vendor_agents.get(vendor.id, [])[:10],  # Limit to 10 most recent
            invitation_id=inv_info.get("invitation_id"),
            invited_by=inv_info.get("invited_by"),
            invited_by_name=inv_info.get("invited_by_name"),
            invitation_date=inv_info.get("invitation_date")
        ))
    
    return result


# Trust Center Endpoints

class TrustCenterResponse(BaseModel):
    """Public trust center response"""
    vendor_id: str
    vendor_name: str
    vendor_logo_url: Optional[str]
    vendor_website: Optional[str]
    vendor_description: Optional[str]
    branding: Optional[Dict[str, Any]] = None  # Vendor branding configuration
    trust_center_enabled: bool
    compliance_score: Optional[int]
    compliance_url: Optional[str]
    security_policy_url: Optional[str]
    privacy_policy_url: Optional[str]
    customer_logos: Optional[List[Dict[str, Any]]] = []
    compliance_certifications: Optional[List[Dict[str, Any]]] = []
    published_artifacts: Optional[List[Dict[str, Any]]] = []
    published_documents: Optional[List[Dict[str, Any]]] = []
    customers: List[Dict[str, Any]] = []  # Tenants using this vendor's agents
    public_url: str  # Shareable public URL


class TrustCenterUpdate(BaseModel):
    """Trust center update schema"""
    trust_center_enabled: Optional[bool] = None
    compliance_score: Optional[int] = Field(None, ge=0, le=100)
    compliance_url: Optional[str] = None
    security_policy_url: Optional[str] = None
    privacy_policy_url: Optional[str] = None
    customer_logos: Optional[List[Dict[str, Any]]] = None
    compliance_certifications: Optional[List[Dict[str, Any]]] = None
    published_artifacts: Optional[List[Dict[str, Any]]] = None
    published_documents: Optional[List[Dict[str, Any]]] = None
    trust_center_slug: Optional[str] = Field(None, min_length=3, max_length=100, pattern="^[a-z0-9-]+$")
    branding: Optional[Dict[str, Any]] = None  # Add branding to trust center update


@router.get("/trust-center/{vendor_identifier}", response_model=TrustCenterResponse)
async def get_trust_center(
    vendor_identifier: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to get vendor trust center data.
    Can be accessed by vendor_id (UUID) or trust_center_slug.
    No authentication required.
    """
    # Try to find vendor by ID or slug
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        # Not a UUID, try slug
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    if not vendor.trust_center_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trust center is not enabled for this vendor"
        )
    
    # Get customers (tenants) using this vendor's agents
    from app.models.agent import Agent
    from app.models.tenant import Tenant
    
    # Get all approved agents for this vendor
    agents = db.query(Agent).filter(
        Agent.vendor_id == vendor.id,
        Agent.status == "approved"
    ).all()
    
    # Get unique tenant IDs from vendors that have approved agents from this vendor
    # Each agent belongs to a vendor, and each vendor belongs to a tenant
    # So we get all vendors that have approved agents, then get their tenant_ids
    tenant_ids = set()
    if vendor.tenant_id:
        tenant_ids.add(vendor.tenant_id)
    
    # Also get tenant_ids from other vendors that might be using this vendor's agents
    # For now, we'll focus on the vendor's own tenant and any tenants that have agents from this vendor
    # Get all vendors that have approved agents from this vendor
    vendor_ids_with_agents = {agent.vendor_id for agent in agents}
    if vendor_ids_with_agents:
        vendors_with_agents = db.query(Vendor).filter(Vendor.id.in_(vendor_ids_with_agents)).all()
        for v in vendors_with_agents:
            if v.tenant_id:
                tenant_ids.add(v.tenant_id)
    
    # Get tenant details
    customers = []
    customer_logos_auto = []  # Auto-generated customer logos
    if tenant_ids:
        tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()
        for tenant in tenants:
            # Count approved agents for this vendor in this tenant
            tenant_agents = [a for a in agents if a.vendor_id == vendor.id]
            if tenant_agents:  # Only include tenants that actually have agents
                logo_url = None
                if tenant.custom_branding:
                    # Handle both dict and string JSON
                    if isinstance(tenant.custom_branding, dict):
                        logo_url = tenant.custom_branding.get("logo_url") or tenant.custom_branding.get("logo")
                    elif isinstance(tenant.custom_branding, str):
                        try:
                            import json
                            branding_dict = json.loads(tenant.custom_branding)
                            logo_url = branding_dict.get("logo_url") or branding_dict.get("logo")
                        except (json.JSONDecodeError, TypeError):
                            pass
                    
                    # Convert relative URLs to absolute URLs if needed
                    if logo_url and not logo_url.startswith(('http://', 'https://', 'data:')):
                        # If it's a relative path, make it absolute using the backend URL
                        # Images are served from the backend, not frontend
                        backend_url = os.getenv("BACKEND_URL", os.getenv("API_URL", "http://localhost:8000"))
                        if logo_url.startswith('/'):
                            logo_url = f"{backend_url}{logo_url}"
                        else:
                            logo_url = f"{backend_url}/{logo_url}"
                    
                    # Debug logging
                    logger.debug(f"Tenant {tenant.name} (ID: {tenant.id}) - custom_branding type: {type(tenant.custom_branding)}, logo_url: {logo_url}")
                
                customers.append({
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "logo_url": logo_url,
                    "agents_count": len(tenant_agents)
                })
                
                # Add to auto-generated customer logos (include even without logo)
                customer_logos_auto.append({
                    "name": tenant.name,
                    "logo_url": logo_url  # Can be None
                })
    
    # Build public URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    if vendor.trust_center_slug:
        public_url = f"{frontend_url}/trust-center/{vendor.trust_center_slug}"
    else:
        public_url = f"{frontend_url}/trust-center/{vendor.id}"
    
    return TrustCenterResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        vendor_logo_url=vendor.logo_url,
        vendor_website=vendor.website,
        vendor_description=vendor.description,
        branding=vendor.branding,  # Include vendor branding
        trust_center_enabled=vendor.trust_center_enabled,
        compliance_score=vendor.compliance_score,
        compliance_url=vendor.compliance_url,
        security_policy_url=vendor.security_policy_url,
        privacy_policy_url=vendor.privacy_policy_url,
        customer_logos=customer_logos_auto,  # Use auto-generated customer logos from tenants
        compliance_certifications=vendor.compliance_certifications or [],
        published_artifacts=vendor.published_artifacts or [],
        published_documents=vendor.published_documents or [],
        customers=customers,
        public_url=public_url
    )


@router.put("/me/trust-center", response_model=TrustCenterResponse)
async def update_trust_center(
    update_data: TrustCenterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update vendor trust center settings (vendor admin only)"""
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can update trust center settings"
        )
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Check if slug is unique (if provided)
    if update_data.trust_center_slug:
        existing = db.query(Vendor).filter(
            Vendor.trust_center_slug == update_data.trust_center_slug,
            Vendor.id != vendor.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trust center slug '{update_data.trust_center_slug}' is already taken"
            )
    
    # Update fields (exclude customer_logos as it's auto-generated)
    # Use model_dump for Pydantic v2, fallback to dict for v1
    if hasattr(update_data, 'model_dump'):
        update_dict = update_data.model_dump(exclude_unset=True, exclude={'customer_logos'})
    else:
        update_dict = update_data.dict(exclude_unset=True, exclude={'customer_logos'})
    
    from sqlalchemy.orm.attributes import flag_modified
    for field, value in update_dict.items():
        if field == "branding" and value is not None:
            if not vendor.branding:
                vendor.branding = {}
            # Create new dict to ensure SQLAlchemy detects the change
            updated_branding = dict(vendor.branding)
            updated_branding.update(value)
            vendor.branding = updated_branding
            flag_modified(vendor, "branding")
        elif hasattr(vendor, field):
            setattr(vendor, field, value)
    
    vendor.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(vendor)
    
    # Get customers and auto-generate customer logos from agent data
    from app.models.agent import Agent
    from app.models.tenant import Tenant
    
    agents = db.query(Agent).filter(
        Agent.vendor_id == vendor.id,
        Agent.status == "approved"
    ).all()
    
    tenant_ids = set()
    if vendor.tenant_id:
        tenant_ids.add(vendor.tenant_id)
    
    vendor_ids_with_agents = {agent.vendor_id for agent in agents}
    if vendor_ids_with_agents:
        vendors_with_agents = db.query(Vendor).filter(Vendor.id.in_(vendor_ids_with_agents)).all()
        for v in vendors_with_agents:
            if v.tenant_id:
                tenant_ids.add(v.tenant_id)
    
    customers = []
    customer_logos_auto = []
    if tenant_ids:
        tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()
        for tenant in tenants:
            tenant_agents = [a for a in agents if a.vendor_id == vendor.id]
            if tenant_agents:
                logo_url = None
                if tenant.custom_branding:
                    # Handle both dict and string JSON
                    if isinstance(tenant.custom_branding, dict):
                        logo_url = tenant.custom_branding.get("logo_url") or tenant.custom_branding.get("logo")
                    elif isinstance(tenant.custom_branding, str):
                        try:
                            import json
                            branding_dict = json.loads(tenant.custom_branding)
                            logo_url = branding_dict.get("logo_url") or branding_dict.get("logo")
                        except (json.JSONDecodeError, TypeError):
                            pass
                    
                    # Convert relative URLs to absolute URLs if needed
                    if logo_url and not logo_url.startswith(('http://', 'https://', 'data:')):
                        # If it's a relative path, make it absolute using the backend URL
                        # Images are served from the backend, not frontend
                        backend_url = os.getenv("BACKEND_URL", os.getenv("API_URL", "http://localhost:8000"))
                        if logo_url.startswith('/'):
                            logo_url = f"{backend_url}{logo_url}"
                        else:
                            logo_url = f"{backend_url}/{logo_url}"
                
                customers.append({
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "logo_url": logo_url,
                    "agents_count": len(tenant_agents)
                })
                
                # Add to auto-generated customer logos (include even without logo)
                customer_logos_auto.append({
                    "name": tenant.name,
                    "logo_url": logo_url  # Can be None
                })
    
    # Build public URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    if vendor.trust_center_slug:
        public_url = f"{frontend_url}/trust-center/{vendor.trust_center_slug}"
    else:
        public_url = f"{frontend_url}/trust-center/{vendor.id}"
    
    return TrustCenterResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        vendor_logo_url=vendor.logo_url,
        vendor_website=vendor.website,
        vendor_description=vendor.description,
        branding=vendor.branding,  # Include vendor branding
        trust_center_enabled=vendor.trust_center_enabled,
        compliance_score=vendor.compliance_score,
        compliance_url=vendor.compliance_url,
        security_policy_url=vendor.security_policy_url,
        privacy_policy_url=vendor.privacy_policy_url,
        customer_logos=customer_logos_auto,
        compliance_certifications=vendor.compliance_certifications or [],
        published_artifacts=vendor.published_artifacts or [],
        published_documents=vendor.published_documents or [],
        customers=customers,
        public_url=public_url
    )


@router.get("/me/trust-center", response_model=TrustCenterResponse)
async def get_my_trust_center(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current vendor's trust center data"""
    if current_user.role.value != "vendor_user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors can access trust center settings"
        )
    
    vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor profile not found"
        )
    
    # Get customers and auto-generate customer logos from agent data
    from app.models.agent import Agent
    from app.models.tenant import Tenant
    
    agents = db.query(Agent).filter(
        Agent.vendor_id == vendor.id,
        Agent.status == "approved"
    ).all()
    
    tenant_ids = set()
    if vendor.tenant_id:
        tenant_ids.add(vendor.tenant_id)
    
    vendor_ids_with_agents = {agent.vendor_id for agent in agents}
    if vendor_ids_with_agents:
        vendors_with_agents = db.query(Vendor).filter(Vendor.id.in_(vendor_ids_with_agents)).all()
        for v in vendors_with_agents:
            if v.tenant_id:
                tenant_ids.add(v.tenant_id)
    
    customers = []
    customer_logos_auto = []
    if tenant_ids:
        tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()
        for tenant in tenants:
            tenant_agents = [a for a in agents if a.vendor_id == vendor.id]
            if tenant_agents:
                logo_url = None
                if tenant.custom_branding:
                    # Handle both dict and string JSON
                    if isinstance(tenant.custom_branding, dict):
                        logo_url = tenant.custom_branding.get("logo_url") or tenant.custom_branding.get("logo")
                    elif isinstance(tenant.custom_branding, str):
                        try:
                            import json
                            branding_dict = json.loads(tenant.custom_branding)
                            logo_url = branding_dict.get("logo_url") or branding_dict.get("logo")
                        except (json.JSONDecodeError, TypeError):
                            pass
                    
                    # Convert relative URLs to absolute URLs if needed
                    if logo_url and not logo_url.startswith(('http://', 'https://', 'data:')):
                        # If it's a relative path, make it absolute using the backend URL
                        # Images are served from the backend, not frontend
                        backend_url = os.getenv("BACKEND_URL", os.getenv("API_URL", "http://localhost:8000"))
                        if logo_url.startswith('/'):
                            logo_url = f"{backend_url}{logo_url}"
                        else:
                            logo_url = f"{backend_url}/{logo_url}"
                
                customers.append({
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "logo_url": logo_url,
                    "agents_count": len(tenant_agents)
                })
                
                # Add to auto-generated customer logos (include even without logo)
                customer_logos_auto.append({
                    "name": tenant.name,
                    "logo_url": logo_url  # Can be None
                })
    
    # Build public URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    if vendor.trust_center_slug:
        public_url = f"{frontend_url}/trust-center/{vendor.trust_center_slug}"
    else:
        public_url = f"{frontend_url}/trust-center/{vendor.id}"
    
    return TrustCenterResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        vendor_logo_url=vendor.logo_url,
        vendor_website=vendor.website,
        vendor_description=vendor.description,
        branding=vendor.branding,  # Include vendor branding
        trust_center_enabled=vendor.trust_center_enabled,
        compliance_score=vendor.compliance_score,
        compliance_url=vendor.compliance_url,
        security_policy_url=vendor.security_policy_url,
        privacy_policy_url=vendor.privacy_policy_url,
        customer_logos=customer_logos_auto,
        compliance_certifications=vendor.compliance_certifications or [],
        published_artifacts=vendor.published_artifacts or [],
        published_documents=vendor.published_documents or [],
        customers=customers,
        public_url=public_url
    )


# Vendor Subscription, Follow, and Interest List Endpoints

class VendorSubscriptionResponse(BaseModel):
    """Vendor subscription response"""
    vendor_id: str
    vendor_name: str
    subscribed: bool
    subscribed_at: Optional[str] = None
    notification_preferences: Optional[Dict[str, Any]] = None


class VendorFollowResponse(BaseModel):
    """Vendor follow response"""
    vendor_id: str
    vendor_name: str
    following: bool
    followed_at: Optional[str] = None


class VendorInterestResponse(BaseModel):
    """Vendor interest list response"""
    vendor_id: str
    vendor_name: str
    in_interest_list: bool
    added_at: Optional[str] = None
    notes: Optional[str] = None


@router.post("/trust-center/{vendor_identifier}/subscribe", response_model=VendorSubscriptionResponse)
async def subscribe_to_vendor(
    vendor_identifier: str,
    notification_preferences: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe tenant to vendor updates"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be assigned to a tenant"
        )
    
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Check if already subscribed
    from app.models.vendor_subscription import VendorSubscription
    subscription = db.query(VendorSubscription).filter(
        VendorSubscription.vendor_id == vendor.id,
        VendorSubscription.tenant_id == effective_tenant_id
    ).first()
    
    if subscription:
        # Update notification preferences if provided
        if notification_preferences:
            subscription.notification_preferences = notification_preferences
            db.commit()
        return VendorSubscriptionResponse(
            vendor_id=str(vendor.id),
            vendor_name=vendor.name,
            subscribed=True,
            subscribed_at=subscription.subscribed_at.isoformat(),
            notification_preferences=subscription.notification_preferences
        )
    
    # Create new subscription
    subscription = VendorSubscription(
        vendor_id=vendor.id,
        tenant_id=current_user.tenant_id,
        notification_preferences=notification_preferences or {}
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    
    return VendorSubscriptionResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        subscribed=True,
        subscribed_at=subscription.subscribed_at.isoformat(),
        notification_preferences=subscription.notification_preferences
    )


@router.delete("/trust-center/{vendor_identifier}/subscribe", response_model=VendorSubscriptionResponse)
async def unsubscribe_from_vendor(
    vendor_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsubscribe tenant from vendor updates"""
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be assigned to a tenant"
        )
    
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    from app.models.vendor_subscription import VendorSubscription
    subscription = db.query(VendorSubscription).filter(
        VendorSubscription.vendor_id == vendor.id,
        VendorSubscription.tenant_id == effective_tenant_id
    ).first()
    
    if subscription:
        db.delete(subscription)
        db.commit()
    
    return VendorSubscriptionResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        subscribed=False
    )


@router.post("/trust-center/{vendor_identifier}/follow", response_model=VendorFollowResponse)
async def follow_vendor(
    vendor_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follow a vendor (user-level)"""
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Check if already following
    from app.models.vendor_subscription import VendorFollow
    follow = db.query(VendorFollow).filter(
        VendorFollow.vendor_id == vendor.id,
        VendorFollow.user_id == current_user.id
    ).first()
    
    if follow:
        return VendorFollowResponse(
            vendor_id=str(vendor.id),
            vendor_name=vendor.name,
            following=True,
            followed_at=follow.followed_at.isoformat()
        )
    
    # Create new follow
    follow = VendorFollow(
        vendor_id=vendor.id,
        user_id=current_user.id
    )
    db.add(follow)
    db.commit()
    db.refresh(follow)
    
    return VendorFollowResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        following=True,
        followed_at=follow.followed_at.isoformat()
    )


@router.delete("/trust-center/{vendor_identifier}/follow", response_model=VendorFollowResponse)
async def unfollow_vendor(
    vendor_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow a vendor"""
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    from app.models.vendor_subscription import VendorFollow
    follow = db.query(VendorFollow).filter(
        VendorFollow.vendor_id == vendor.id,
        VendorFollow.user_id == current_user.id
    ).first()
    
    if follow:
        db.delete(follow)
        db.commit()
    
    return VendorFollowResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        following=False
    )


@router.post("/trust-center/{vendor_identifier}/interest", response_model=VendorInterestResponse)
async def add_to_interest_list(
    vendor_identifier: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add vendor to user's interest list"""
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Check if already in interest list
    from app.models.vendor_subscription import VendorInterestList
    interest = db.query(VendorInterestList).filter(
        VendorInterestList.vendor_id == vendor.id,
        VendorInterestList.user_id == current_user.id
    ).first()
    
    if interest:
        # Update notes if provided
        if notes is not None:
            interest.notes = notes
            db.commit()
        return VendorInterestResponse(
            vendor_id=str(vendor.id),
            vendor_name=vendor.name,
            in_interest_list=True,
            added_at=interest.added_at.isoformat(),
            notes=interest.notes
        )
    
    # Create new interest entry
    interest = VendorInterestList(
        vendor_id=vendor.id,
        user_id=current_user.id,
        notes=notes
    )
    db.add(interest)
    db.commit()
    db.refresh(interest)
    
    return VendorInterestResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        in_interest_list=True,
        added_at=interest.added_at.isoformat(),
        notes=interest.notes
    )


@router.delete("/trust-center/{vendor_identifier}/interest", response_model=VendorInterestResponse)
async def remove_from_interest_list(
    vendor_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove vendor from user's interest list"""
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    from app.models.vendor_subscription import VendorInterestList
    interest = db.query(VendorInterestList).filter(
        VendorInterestList.vendor_id == vendor.id,
        VendorInterestList.user_id == current_user.id
    ).first()
    
    if interest:
        db.delete(interest)
        db.commit()
    
    return VendorInterestResponse(
        vendor_id=str(vendor.id),
        vendor_name=vendor.name,
        in_interest_list=False
    )


@router.get("/trust-center/{vendor_identifier}/status", response_model=Dict[str, Any])
async def get_vendor_status(
    vendor_identifier: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Get user's subscription, follow, and interest status for a vendor (optional auth)"""
    # Find vendor
    try:
        vendor_id = UUID(vendor_identifier)
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    except ValueError:
        vendor = db.query(Vendor).filter(Vendor.trust_center_slug == vendor_identifier).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    result = {
        "vendor_id": str(vendor.id),
        "vendor_name": vendor.name,
        "subscribed": False,
        "following": False,
        "in_interest_list": False
    }
    
    # Try to get current user if authenticated (optional)
    current_user = None
    try:
        authorization = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if payload:
                email = payload.get("sub")
                if email:
                    current_user = db.query(User).filter(User.email == email).first()
    except Exception:
        pass
    
    if current_user:
        from app.models.vendor_subscription import VendorSubscription, VendorFollow, VendorInterestList
        
        # Check subscription (tenant-level)
        if current_user.tenant_id:
            subscription = db.query(VendorSubscription).filter(
                VendorSubscription.vendor_id == vendor.id,
                VendorSubscription.tenant_id == effective_tenant_id
            ).first()
            if subscription:
                result["subscribed"] = True
                result["subscribed_at"] = subscription.subscribed_at.isoformat()
        
        # Check follow (user-level)
        follow = db.query(VendorFollow).filter(
            VendorFollow.vendor_id == vendor.id,
            VendorFollow.user_id == current_user.id
        ).first()
        if follow:
            result["following"] = True
            result["followed_at"] = follow.followed_at.isoformat()
        
        # Check interest list (user-level)
        interest = db.query(VendorInterestList).filter(
            VendorInterestList.vendor_id == vendor.id,
            VendorInterestList.user_id == current_user.id
        ).first()
        if interest:
            result["in_interest_list"] = True
            result["added_at"] = interest.added_at.isoformat()
            result["notes"] = interest.notes
    
    return result


@router.get("/me/interests", response_model=List[Dict[str, Any]])
async def get_my_interest_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's interest list"""
    from app.models.vendor_subscription import VendorInterestList
    
    interests = db.query(VendorInterestList).filter(
        VendorInterestList.user_id == current_user.id
    ).order_by(VendorInterestList.added_at.desc()).all()
    
    result = []
    for interest in interests:
        vendor = db.query(Vendor).filter(Vendor.id == interest.vendor_id).first()
        if vendor:
            result.append({
                "vendor_id": str(vendor.id),
                "vendor_name": vendor.name,
                "vendor_logo_url": vendor.logo_url,
                "vendor_website": vendor.website,
                "added_at": interest.added_at.isoformat(),
                "notes": interest.notes,
                "trust_center_url": f"/trust-center/{vendor.trust_center_slug or vendor.id}"
            })
    
    return result


@router.get("/me/following", response_model=List[Dict[str, Any]])
async def get_my_following(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vendors the current user is following"""
    from app.models.vendor_subscription import VendorFollow
    
    follows = db.query(VendorFollow).filter(
        VendorFollow.user_id == current_user.id
    ).order_by(VendorFollow.followed_at.desc()).all()
    
    result = []
    for follow in follows:
        vendor = db.query(Vendor).filter(Vendor.id == follow.vendor_id).first()
        if vendor:
            result.append({
                "vendor_id": str(vendor.id),
                "vendor_name": vendor.name,
                "vendor_logo_url": vendor.logo_url,
                "vendor_website": vendor.website,
                "followed_at": follow.followed_at.isoformat(),
                "trust_center_url": f"/trust-center/{vendor.trust_center_slug or vendor.id}"
            })
    
    return result
