"""
Incident Reports API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.incident_report import IncidentReport, IncidentType, IncidentStatus
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id
from app.services.incident_push_service import IncidentPushService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incident-reports", tags=["incident-reports"])


class IncidentReportCreate(BaseModel):
    """Incident report creation schema"""
    incident_type: str = Field(..., description="cve_tracking or qualification_failure")
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[str] = Field(None, description="critical, high, medium, low")
    entity_type: str = Field(..., description="agent, product, service, vendor")
    entity_id: UUID
    vendor_id: Optional[UUID] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    incident_data: Optional[Dict[str, Any]] = None
    external_system: Optional[str] = Field(None, description="servicenow or jira - if provided, will push immediately")


class IncidentReportResponse(BaseModel):
    """Incident report response schema"""
    id: str
    incident_type: str
    title: str
    description: Optional[str]
    severity: Optional[str]
    entity_type: str
    entity_id: str
    vendor_id: Optional[str]
    related_entity_type: Optional[str]
    related_entity_id: Optional[str]
    incident_data: Optional[Dict[str, Any]]
    external_system: Optional[str]
    external_ticket_id: Optional[str]
    external_ticket_url: Optional[str]
    push_status: str
    push_attempts: int
    last_push_attempt: Optional[str]
    push_error: Optional[str]
    status: Optional[str]
    resolved_at: Optional[str]
    resolved_by: Optional[str]
    created_by: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class IncidentReportListResponse(BaseModel):
    """Incident report list response schema"""
    incidents: List[IncidentReportResponse]
    total: int
    page: int
    limit: int


@router.post("", response_model=IncidentReportResponse, status_code=status.HTTP_201_CREATED)
async def create_incident_report(
    incident_data: IncidentReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an incident report"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to create incident reports"
            )
        
        # Create incident report
        incident = IncidentReport(
            tenant_id=effective_tenant_id,
            incident_type=incident_data.incident_type,
            title=incident_data.title,
            description=incident_data.description,
            severity=incident_data.severity,
            entity_type=incident_data.entity_type,
            entity_id=incident_data.entity_id,
            vendor_id=incident_data.vendor_id,
            related_entity_type=incident_data.related_entity_type,
            related_entity_id=incident_data.related_entity_id,
            incident_data=incident_data.incident_data,
            created_by=current_user.id
        )
        
        db.add(incident)
        db.commit()
        db.refresh(incident)
        
        # If external_system is provided, push immediately
        if incident_data.external_system:
            push_result = IncidentPushService.push_incident(
                incident.id,
                incident_data.external_system,
                db
            )
            if not push_result.get('success'):
                logger.warning(f"Failed to push incident {incident.id} to {incident_data.external_system}: {push_result.get('error')}")
        
        return IncidentReportResponse(
            id=str(incident.id),
            incident_type=incident.incident_type,
            title=incident.title,
            description=incident.description,
            severity=incident.severity,
            entity_type=incident.entity_type,
            entity_id=str(incident.entity_id),
            vendor_id=str(incident.vendor_id) if incident.vendor_id else None,
            related_entity_type=incident.related_entity_type,
            related_entity_id=str(incident.related_entity_id) if incident.related_entity_id else None,
            incident_data=incident.incident_data,
            external_system=incident.external_system,
            external_ticket_id=incident.external_ticket_id,
            external_ticket_url=incident.external_ticket_url,
            push_status=incident.push_status,
            push_attempts=incident.push_attempts,
            last_push_attempt=incident.last_push_attempt.isoformat() if incident.last_push_attempt else None,
            push_error=incident.push_error,
            status=incident.status,
            resolved_at=incident.resolved_at.isoformat() if incident.resolved_at else None,
            resolved_by=str(incident.resolved_by) if incident.resolved_by else None,
            created_by=str(incident.created_by) if incident.created_by else None,
            created_at=incident.created_at.isoformat() if incident.created_at else datetime.utcnow().isoformat(),
            updated_at=incident.updated_at.isoformat() if incident.updated_at else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating incident report: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create incident report"
        )


@router.get("", response_model=IncidentReportListResponse)
async def list_incident_reports(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[UUID] = Query(None, description="Filter by entity ID"),
    incident_type: Optional[str] = Query(None, description="Filter by incident type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    push_status: Optional[str] = Query(None, description="Filter by push status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List incident reports (tenant-scoped)"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view incident reports"
            )
        
        query = db.query(IncidentReport).filter(IncidentReport.tenant_id == effective_tenant_id)
        
        # Apply filters
        if entity_type:
            query = query.filter(IncidentReport.entity_type == entity_type)
        if entity_id:
            query = query.filter(IncidentReport.entity_id == entity_id)
        if incident_type:
            query = query.filter(IncidentReport.incident_type == incident_type)
        if severity:
            query = query.filter(IncidentReport.severity == severity)
        if push_status:
            query = query.filter(IncidentReport.push_status == push_status)
        
        # Get total count
        total = query.count()
        
        # Paginate
        offset = (page - 1) * limit
        incidents = query.order_by(IncidentReport.created_at.desc()).offset(offset).limit(limit).all()
        
        incident_responses = []
        for incident in incidents:
            incident_responses.append(IncidentReportResponse(
                id=str(incident.id),
                incident_type=incident.incident_type,
                title=incident.title,
                description=incident.description,
                severity=incident.severity,
                entity_type=incident.entity_type,
                entity_id=str(incident.entity_id),
                vendor_id=str(incident.vendor_id) if incident.vendor_id else None,
                related_entity_type=incident.related_entity_type,
                related_entity_id=str(incident.related_entity_id) if incident.related_entity_id else None,
                incident_data=incident.incident_data,
                external_system=incident.external_system,
                external_ticket_id=incident.external_ticket_id,
                external_ticket_url=incident.external_ticket_url,
                push_status=incident.push_status,
                push_attempts=incident.push_attempts,
                last_push_attempt=incident.last_push_attempt.isoformat() if incident.last_push_attempt else None,
                push_error=incident.push_error,
                status=incident.status,
                resolved_at=incident.resolved_at.isoformat() if incident.resolved_at else None,
                resolved_by=str(incident.resolved_by) if incident.resolved_by else None,
                created_by=str(incident.created_by) if incident.created_by else None,
                created_at=incident.created_at.isoformat() if incident.created_at else datetime.utcnow().isoformat(),
                updated_at=incident.updated_at.isoformat() if incident.updated_at else None
            ))
        
        return IncidentReportListResponse(
            incidents=incident_responses,
            total=total,
            page=page,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing incident reports: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list incident reports"
        )


@router.get("/{incident_id}", response_model=IncidentReportResponse)
async def get_incident_report(
    incident_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get incident report details"""
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view incident reports"
        )
    
    incident = db.query(IncidentReport).filter(
        IncidentReport.id == incident_id,
        IncidentReport.tenant_id == effective_tenant_id
    ).first()
    
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident report not found"
        )
    
    return IncidentReportResponse(
        id=str(incident.id),
        incident_type=incident.incident_type,
        title=incident.title,
        description=incident.description,
        severity=incident.severity,
        entity_type=incident.entity_type,
        entity_id=str(incident.entity_id),
        vendor_id=str(incident.vendor_id) if incident.vendor_id else None,
        related_entity_type=incident.related_entity_type,
        related_entity_id=str(incident.related_entity_id) if incident.related_entity_id else None,
        incident_data=incident.incident_data,
        external_system=incident.external_system,
        external_ticket_id=incident.external_ticket_id,
        external_ticket_url=incident.external_ticket_url,
        push_status=incident.push_status,
        push_attempts=incident.push_attempts,
        last_push_attempt=incident.last_push_attempt.isoformat() if incident.last_push_attempt else None,
        push_error=incident.push_error,
        status=incident.status,
        resolved_at=incident.resolved_at.isoformat() if incident.resolved_at else None,
        resolved_by=str(incident.resolved_by) if incident.resolved_by else None,
        created_by=str(incident.created_by) if incident.created_by else None,
        created_at=incident.created_at.isoformat() if incident.created_at else datetime.utcnow().isoformat(),
        updated_at=incident.updated_at.isoformat() if incident.updated_at else None
    )


@router.post("/{incident_id}/push", response_model=Dict[str, Any])
async def push_incident_to_external(
    incident_id: UUID,
    external_system: str = Query(..., description="servicenow or jira"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Push incident to external system"""
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to push incidents"
        )
    
    incident = db.query(IncidentReport).filter(
        IncidentReport.id == incident_id,
        IncidentReport.tenant_id == effective_tenant_id
    ).first()
    
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident report not found"
        )
    
    result = IncidentPushService.push_incident(incident_id, external_system, db)
    
    if not result.get('success'):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get('error', 'Failed to push incident')
        )
    
    return result
