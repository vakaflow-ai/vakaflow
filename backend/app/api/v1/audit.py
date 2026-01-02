"""
Audit trail API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditLogResponse(BaseModel):
    """Audit log response schema"""
    id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[dict]
    ip_address: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Audit log list response"""
    logs: List[AuditLogResponse]
    total: int
    limit: int
    offset: int


@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    tenant_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get audit logs (Admin, Approver, and Reviewers only)"""
    # Check permissions - allow admins, approvers, and reviewers
    allowed_roles = [
        "tenant_admin", 
        "platform_admin", 
        "approver", 
        "security_reviewer", 
        "compliance_reviewer", 
        "technical_reviewer", 
        "business_reviewer"
    ]
    
    if current_user.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only admins, approvers, and reviewers can access audit logs."
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access audit logs"
        )
    
    # ALL users (including platform_admin) must filter by their tenant
    # If tenant_id parameter is provided, validate it matches current_user's effective tenant
    if tenant_id:
        if tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only view audit logs from your own tenant"
            )
        tenant_id = tenant_id
    else:
        tenant_id = effective_tenant_id
    
    result = audit_service.get_audit_logs(
        db=db,
        tenant_id=str(tenant_id) if tenant_id else None,
        user_id=str(user_id) if user_id else None,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        action=action,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )
    
    return AuditLogListResponse(
        logs=[
            AuditLogResponse(
                id=str(log.id),
                user_id=str(log.user_id),
                action=log.action,
                resource_type=log.resource_type,
                resource_id=str(log.resource_id) if log.resource_id else None,
                details=log.details,
                ip_address=log.ip_address,
                created_at=log.created_at.isoformat()
            )
            for log in result["logs"]
        ],
        total=result["total"],
        limit=result["limit"],
        offset=result["offset"]
    )


@router.get("/resources/{resource_type}/{resource_id}")
async def get_resource_history(
    resource_type: str,
    resource_id: UUID,
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get history for a specific resource (Admin, Approver, and Reviewers only)"""
    # Check permissions - allow admins, approvers, and reviewers
    allowed_roles = [
        "tenant_admin", 
        "platform_admin", 
        "approver", 
        "security_reviewer", 
        "compliance_reviewer", 
        "technical_reviewer", 
        "business_reviewer"
    ]
    
    if current_user.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only admins, approvers, and reviewers can access audit logs."
        )
    
    result = audit_service.get_resource_history(
        db=db,
        resource_type=resource_type,
        resource_id=str(resource_id),
        limit=limit
    )
    
    return {
        "resource_type": resource_type,
        "resource_id": str(resource_id),
        "history": [
            {
                "id": str(log.id),
                "action": log.action,
                "user_id": str(log.user_id),
                "details": log.details,
                "created_at": log.created_at.isoformat()
            }
            for log in result["logs"]
        ],
        "total": result["total"]
    }


class PurgeAuditRequest(BaseModel):
    """Purge audit data request schema"""
    tenant_id: Optional[UUID] = None  # If None, purge all tenants (platform admin only)
    older_than_days: Optional[int] = None  # 180, 365
    older_than_years: Optional[int] = None  # 1, 2, 3


class PurgeAuditResponse(BaseModel):
    """Purge audit data response schema"""
    message: str
    deleted_count: int
    tenant_id: Optional[str]
    cutoff_date: str


@router.delete("/purge", response_model=PurgeAuditResponse)
async def purge_audit_data(
    request: PurgeAuditRequest = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Purge old audit data (Platform Admin only)
    
    Options:
    - tenant_id: Optional tenant ID to purge (None = all tenants, platform admin only)
    - older_than_days: Purge data older than X days (180 or 365)
    - older_than_years: Purge data older than X years (1, 2, or 3)
    
    Note: Either older_than_days or older_than_years must be specified, not both.
    """
    # Check permissions - only platform admin can purge audit data
    if current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can purge audit data"
        )
    
    # Validate that exactly one age filter is provided
    if (request.older_than_days is None and request.older_than_years is None) or \
       (request.older_than_days is not None and request.older_than_years is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one of 'older_than_days' or 'older_than_years' must be specified"
        )
    
    # Validate days option (must be 180 or 365)
    if request.older_than_days is not None:
        if request.older_than_days not in [180, 365]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="older_than_days must be either 180 or 365"
            )
        cutoff_date = datetime.utcnow() - timedelta(days=request.older_than_days)
        age_description = f"{request.older_than_days} days"
    
    # Validate years option (must be 1, 2, or 3)
    if request.older_than_years is not None:
        if request.older_than_years not in [1, 2, 3]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="older_than_years must be 1, 2, or 3"
            )
        cutoff_date = datetime.utcnow() - timedelta(days=request.older_than_years * 365)
        age_description = f"{request.older_than_years} year(s)"
    
    try:
        # Build query to find audit logs to delete
        query = db.query(AuditLog).filter(AuditLog.created_at < cutoff_date)
        
        # Filter by tenant if specified
        if request.tenant_id:
            query = query.filter(AuditLog.tenant_id == request.tenant_id)
        
        # Count records to be deleted
        deleted_count = query.count()
        
        if deleted_count > 0:
            # Delete the records
            query.delete(synchronize_session=False)
            db.commit()
        
        # Log the purge action
        logger.info(
            f"Audit data purged by {current_user.email}: "
            f"{deleted_count} records deleted, older than {age_description}. "
            f"Tenant: {request.tenant_id or 'All tenants'}"
        )
        
        return PurgeAuditResponse(
            message=f"Successfully purged {deleted_count} audit log entries older than {age_description}",
            deleted_count=deleted_count,
            tenant_id=str(request.tenant_id) if request.tenant_id else None,
            cutoff_date=cutoff_date.isoformat()
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to purge audit data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge audit data: {str(e)}"
        )

