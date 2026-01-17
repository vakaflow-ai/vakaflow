"""
Ecosystem Map API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id
from app.services.ecosystem_map_service import EcosystemMapService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ecosystem-map", tags=["ecosystem-map"])


@router.get("/network", response_model=Dict[str, Any])
async def get_network_graph(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get network graph data for ecosystem visualization"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view ecosystem map"
            )
        
        service = EcosystemMapService(db, effective_tenant_id)
        return service.get_network_graph_data()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting network graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get network graph data"
        )


@router.get("/landscape", response_model=Dict[str, Any])
async def get_landscape_quadrant(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get landscape quadrant data"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view ecosystem map"
            )
        
        service = EcosystemMapService(db, effective_tenant_id)
        return service.get_landscape_quadrant_data(category)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting landscape quadrant: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get landscape quadrant data"
        )


@router.get("/dependencies", response_model=Dict[str, Any])
async def get_dependency_graph(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dependency graph data"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view ecosystem map"
            )
        
        service = EcosystemMapService(db, effective_tenant_id)
        return service.get_dependency_graph_data()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dependency graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get dependency graph data"
        )


@router.get("/risk-heatmap", response_model=Dict[str, Any])
async def get_risk_heatmap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get risk heat map data"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view ecosystem map"
            )
        
        service = EcosystemMapService(db, effective_tenant_id)
        return service.get_risk_heatmap_data()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting risk heatmap: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get risk heatmap data"
        )


@router.get("/summary", response_model=Dict[str, Any])
async def get_ecosystem_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ecosystem summary statistics"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view ecosystem map"
            )
        
        service = EcosystemMapService(db, effective_tenant_id)
        return service.get_ecosystem_summary()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ecosystem summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get ecosystem summary"
        )
