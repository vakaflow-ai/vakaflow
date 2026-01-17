"""
Workflow Analytics API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id
from app.services.workflow_analytics import WorkflowAnalyticsService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow-analytics", tags=["workflow-analytics"])


@router.get("/performance", response_model=Dict[str, Any])
async def get_workflow_performance(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get workflow performance metrics"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view workflow analytics"
            )
        
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
        
        service = WorkflowAnalyticsService(db, effective_tenant_id)
        return service.get_workflow_performance_metrics(start, end, entity_type)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get workflow performance metrics"
        )


@router.get("/assessments", response_model=Dict[str, Any])
async def get_assessment_metrics(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get assessment workflow metrics"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view workflow analytics"
            )
        
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00')) if start_date else None
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00')) if end_date else None
        
        service = WorkflowAnalyticsService(db, effective_tenant_id)
        return service.get_assessment_workflow_metrics(start, end, entity_type)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting assessment metrics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get assessment metrics"
        )


@router.get("/bottlenecks", response_model=Dict[str, Any])
async def get_workflow_bottlenecks(
    workflow_id: Optional[UUID] = Query(None, description="Filter by workflow ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get workflow bottlenecks"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view workflow analytics"
            )
        
        service = WorkflowAnalyticsService(db, effective_tenant_id)
        return service.get_workflow_bottlenecks(workflow_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow bottlenecks: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get workflow bottlenecks"
        )


@router.get("/summary", response_model=Dict[str, Any])
async def get_workflow_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall workflow summary"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view workflow analytics"
            )
        
        service = WorkflowAnalyticsService(db, effective_tenant_id)
        return service.get_workflow_summary()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get workflow summary"
        )
