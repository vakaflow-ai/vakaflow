"""
Cross-Tenant Learning API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.cross_tenant_learning import CrossTenantLearningService

router = APIRouter(prefix="/cross-tenant", tags=["cross-tenant"])


@router.get("/approval-patterns")
async def get_approval_patterns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated approval patterns (anonymized)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    patterns = await CrossTenantLearningService.aggregate_approval_patterns(
        db,
        exclude_tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None
    )
    return patterns


@router.get("/rejection-reasons")
async def get_common_rejection_reasons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get common rejection reasons (anonymized)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    reasons = await CrossTenantLearningService.get_common_rejection_reasons(
        db,
        exclude_tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None
    )
    return reasons


@router.get("/best-practices")
async def get_best_practices(
    category: Optional[str] = None,
    agent_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get best practices from successful agents (anonymized)"""
    practices = await CrossTenantLearningService.get_best_practices(
        db,
        category=category,
        agent_type=agent_type
    )
    return practices

