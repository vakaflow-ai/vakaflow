"""
API endpoints for Security Incident and CVE management
Feature-gated: Requires 'cve_tracking' feature
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.api.v1.auth import get_current_user
from app.core.feature_gating import FeatureGate
from app.services.security_incident_service import SecurityIncidentService
from app.services.cve_scanner_service import CVEScannerService
from app.services.vendor_matching_service import VendorMatchingService
from app.models.security_incident import (
    SecurityIncident,
    VendorSecurityTracking,
    SecurityMonitoringConfig,
    SecurityIncidentActionHistory,
    IncidentType,
    IncidentSeverity,
    IncidentActionType
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security-incidents", tags=["security-incidents"])


# Pydantic Schemas
class SecurityIncidentResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID]
    incident_type: str
    external_id: str
    title: str
    description: Optional[str]
    severity: Optional[str]
    cvss_score: Optional[float]
    cvss_vector: Optional[str]
    affected_products: Optional[List[str]]
    affected_vendors: Optional[List[str]]
    source: str
    source_url: Optional[str]
    published_date: Optional[datetime]
    status: str
    incident_metadata: Optional[Dict[str, Any]]  # Include metadata with product_details
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    ignored_by: Optional[UUID] = None
    ignored_at: Optional[datetime] = None
    cleared_by: Optional[UUID] = None
    cleared_at: Optional[datetime] = None
    action_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class VendorSecurityTrackingResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID]
    vendor_id: UUID
    incident_id: UUID
    match_confidence: float
    match_method: str
    match_details: Optional[Dict[str, Any]] = None
    risk_qualification_status: str
    risk_level: Optional[str]
    risk_assessment: Optional[Dict[str, Any]] = None
    status: str
    resolution_type: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    vendor_name: Optional[str] = None  # Added for convenience in frontend
    
    class Config:
        from_attributes = True


class RiskAssessmentUpdate(BaseModel):
    risk_assessment: Dict[str, Any]
    risk_level: str = Field(..., description="low, medium, high, critical")


class ResolutionUpdate(BaseModel):
    resolution_type: str = Field(..., description="resolved, false_positive, not_applicable")
    resolution_notes: Optional[str] = None


class MonitoringConfigResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    cve_monitoring_enabled: bool
    cve_scan_frequency: str
    cve_severity_threshold: str
    cve_cvss_threshold: float
    breach_monitoring_enabled: bool
    auto_create_tasks: bool
    auto_send_alerts: bool
    auto_trigger_assessments: bool
    auto_start_workflows: bool
    min_match_confidence: float
    
    class Config:
        from_attributes = True


class MonitoringConfigUpdate(BaseModel):
    cve_monitoring_enabled: Optional[bool] = None
    cve_scan_frequency: Optional[str] = None
    cve_severity_threshold: Optional[str] = None
    cve_cvss_threshold: Optional[float] = None
    breach_monitoring_enabled: Optional[bool] = None
    auto_create_tasks: Optional[bool] = None
    auto_send_alerts: Optional[bool] = None
    auto_trigger_assessments: Optional[bool] = None
    auto_start_workflows: Optional[bool] = None
    min_match_confidence: Optional[float] = None


class IncidentActionRequest(BaseModel):
    """Request model for incident actions"""
    action: str  # acknowledge, track, ignore, clear, reopen
    notes: Optional[str] = None


class IncidentActionHistoryResponse(BaseModel):
    """Response model for incident action history"""
    id: UUID
    incident_id: UUID
    action: str
    performed_by: UUID
    performed_at: datetime
    notes: Optional[str]
    previous_status: Optional[str]
    new_status: Optional[str]
    action_metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Feature gate dependency
def require_cve_feature(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Require CVE tracking feature to be enabled"""
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(status_code=403, detail="Tenant required")
    
    if not FeatureGate.is_feature_enabled(
        db=db,
        tenant_id=str(effective_tenant_id),
        feature_key="cve_tracking",
        user=current_user
    ):
        raise HTTPException(
            status_code=403,
            detail="CVE Tracking feature is not enabled for your tenant. Please contact your administrator."
        )
    
    return current_user


# Endpoints
@router.get("", response_model=Dict[str, Any])
async def get_incidents(
    incident_type: Optional[str] = Query(None, description="cve, data_breach, security_alert"),
    severity: Optional[str] = Query(None, description="low, medium, high, critical"),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Get security incidents for tenant"""
    service = SecurityIncidentService(db)
    
    incident_type_enum = None
    if incident_type:
        try:
            incident_type_enum = IncidentType(incident_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid incident_type: {incident_type}")
    
    severity_enum = None
    if severity:
        try:
            severity_enum = IncidentSeverity(severity)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid severity: {severity}")
    
    incidents, total = service.get_incidents(
        tenant_id=str(current_user.tenant_id),
        incident_type=incident_type_enum,
        severity=severity_enum,
        status=status,
        limit=limit,
        offset=offset
    )
    
    return {
        "incidents": [SecurityIncidentResponse.from_orm(i) for i in incidents],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{incident_id}", response_model=SecurityIncidentResponse)
async def get_incident(
    incident_id: UUID,
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Get a specific security incident"""
    service = SecurityIncidentService(db)
    incident = service.get_incident(incident_id, str(current_user.tenant_id))
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return SecurityIncidentResponse.from_orm(incident)


@router.get("/vendors/{vendor_id}/trackings", response_model=List[VendorSecurityTrackingResponse])
async def get_vendor_trackings(
    vendor_id: UUID,
    status: Optional[str] = Query(None),
    risk_status: Optional[str] = Query(None),
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Get security trackings for a vendor"""
    service = SecurityIncidentService(db)
    
    # Verify vendor belongs to tenant
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.tenant_id == current_user.tenant_id
    ).first()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    trackings = service.get_vendor_trackings(
        tenant_id=str(current_user.tenant_id),
        vendor_id=vendor_id,
        status=status,
        risk_status=risk_status
    )
    
    return [VendorSecurityTrackingResponse.from_orm(t) for t in trackings]


@router.get("/{incident_id}/trackings", response_model=List[VendorSecurityTrackingResponse])
async def get_incident_trackings(
    incident_id: UUID,
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Get vendor trackings for a specific incident"""
    service = SecurityIncidentService(db)
    
    # Verify incident belongs to tenant
    incident = service.get_incident(incident_id, str(current_user.tenant_id))
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Get trackings for this incident
    # Convert tenant_id to UUID for comparison
    tenant_uuid = current_user.tenant_id if isinstance(current_user.tenant_id, UUID) else UUID(str(current_user.tenant_id))
    trackings = db.query(VendorSecurityTracking).filter(
        VendorSecurityTracking.incident_id == incident_id,
        VendorSecurityTracking.tenant_id == tenant_uuid
    ).all()
    
    # Include vendor names in response
    result = []
    for tracking in trackings:
        vendor = db.query(Vendor).filter(Vendor.id == tracking.vendor_id).first()
        tracking_dict = VendorSecurityTrackingResponse.from_orm(tracking).model_dump()
        tracking_dict['vendor_name'] = vendor.name if vendor else "Unknown Vendor"
        result.append(VendorSecurityTrackingResponse(**tracking_dict))
    
    return result


@router.post("/trackings/{tracking_id}/risk", response_model=VendorSecurityTrackingResponse)
async def update_tracking_risk(
    tracking_id: UUID,
    risk_data: RiskAssessmentUpdate,
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Update risk qualification for a vendor tracking"""
    service = SecurityIncidentService(db)
    
    tracking = service.update_tracking_risk(
        tracking_id=tracking_id,
        tenant_id=str(current_user.tenant_id),
        risk_assessment=risk_data.risk_assessment,
        risk_level=risk_data.risk_level,
        qualified_by=current_user.id
    )
    
    if not tracking:
        raise HTTPException(status_code=404, detail="Tracking not found")
    
    return VendorSecurityTrackingResponse.from_orm(tracking)


@router.post("/trackings/{tracking_id}/resolve", response_model=VendorSecurityTrackingResponse)
async def resolve_tracking(
    tracking_id: UUID,
    resolution_data: ResolutionUpdate,
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Resolve a vendor security tracking"""
    service = SecurityIncidentService(db)
    
    tracking = service.resolve_tracking(
        tracking_id=tracking_id,
        tenant_id=str(current_user.tenant_id),
        resolution_type=resolution_data.resolution_type,
        resolution_notes=resolution_data.resolution_notes,
        resolved_by=current_user.id
    )
    
    if not tracking:
        raise HTTPException(status_code=404, detail="Tracking not found")
    
    return VendorSecurityTrackingResponse.from_orm(tracking)


@router.get("/monitoring/config", response_model=MonitoringConfigResponse)
async def get_monitoring_config(
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Get security monitoring configuration"""
    service = SecurityIncidentService(db)
    config = service.get_monitoring_config(str(current_user.tenant_id))
    
    if not config:
        raise HTTPException(status_code=500, detail="Failed to get monitoring config")
    
    return MonitoringConfigResponse.from_orm(config)


@router.put("/monitoring/config", response_model=MonitoringConfigResponse)
async def update_monitoring_config(
    config_data: MonitoringConfigUpdate,
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Update security monitoring configuration"""
    service = SecurityIncidentService(db)
    
    config = service.update_monitoring_config(
        tenant_id=str(current_user.tenant_id),
        config_data=config_data.dict(exclude_unset=True)
    )
    
    if not config:
        raise HTTPException(status_code=500, detail="Failed to update monitoring config")
    
    return MonitoringConfigResponse.from_orm(config)


@router.post("/scan", response_model=Dict[str, Any])
async def scan_cves(
    days_back: int = Query(7, ge=1, le=30),
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Manually trigger CVE scan (admin only)"""
    try:
        # Check if user is admin
        if current_user.role.value not in ["tenant_admin", "platform_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        scanner = CVEScannerService(db)
        matcher = VendorMatchingService(db)
        
        # Get config
        service = SecurityIncidentService(db)
        config = service.get_monitoring_config(str(current_user.tenant_id))
        
        # Scan for CVEs
        incidents = scanner.scan_new_cves(
            tenant_id=str(current_user.tenant_id),
            days_back=days_back,
            config=config
        )
        
        # Match new incidents to vendors and trigger automation
        from app.services.security_automation_service import SecurityAutomationService
        automation_service = SecurityAutomationService(db)
        
        matched_count = 0
        for incident in incidents:
            try:
                trackings = matcher.match_incident_to_vendors(
                    incident=incident,
                    tenant_id=str(current_user.tenant_id),
                    config=config
                )
                matched_count += len(trackings)
                
                # Trigger automation for each matched tracking
                for tracking in trackings:
                    try:
                        automation_service.process_vendor_tracking(
                            tracking=tracking,
                            config=config,
                            incident=incident
                        )
                    except Exception as e:
                        logger.error(f"Error processing automation for tracking {tracking.id}: {str(e)}", exc_info=True)
            except Exception as e:
                logger.error(f"Error matching incident {incident.id} to vendors: {str(e)}", exc_info=True)
        
        # Also match existing incidents that don't have vendor trackings yet
        from datetime import datetime, timedelta
        
        recent_date = datetime.utcnow() - timedelta(days=days_back)
        existing_incidents = db.query(SecurityIncident).filter(
            SecurityIncident.incident_type == "cve",
            SecurityIncident.tenant_id == current_user.tenant_id,
            SecurityIncident.created_at >= recent_date
        ).all()
        
        # Get incidents that don't have vendor trackings
        incidents_without_trackings = []
        tenant_uuid_for_query = current_user.tenant_id if isinstance(current_user.tenant_id, UUID) else UUID(str(current_user.tenant_id))
        for incident in existing_incidents:
            existing_trackings = db.query(VendorSecurityTracking).filter(
                VendorSecurityTracking.incident_id == incident.id,
                VendorSecurityTracking.tenant_id == tenant_uuid_for_query
            ).count()
            if existing_trackings == 0:
                incidents_without_trackings.append(incident)
        
        # Match existing incidents that don't have trackings and trigger automation
        existing_matched_count = 0
        for incident in incidents_without_trackings:
            try:
                trackings = matcher.match_incident_to_vendors(
                    incident=incident,
                    tenant_id=str(current_user.tenant_id),
                    config=config
                )
                existing_matched_count += len(trackings)
                
                # Trigger automation for each matched tracking
                for tracking in trackings:
                    try:
                        automation_service.process_vendor_tracking(
                            tracking=tracking,
                            config=config,
                            incident=incident
                        )
                    except Exception as e:
                        logger.error(f"Error processing automation for tracking {tracking.id}: {str(e)}", exc_info=True)
            except Exception as e:
                logger.error(f"Error matching existing incident {incident.id} to vendors: {str(e)}", exc_info=True)
        
        total_matched = matched_count + existing_matched_count
        
        return {
            "scanned": len(incidents),
            "matched_vendors": total_matched,
            "new_cves": len(incidents),
            "existing_matched": existing_matched_count,
            "message": f"Scan completed: {len(incidents)} new CVEs found, {total_matched} vendor matches ({existing_matched_count} from existing CVEs)"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in CVE scan: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{incident_id}/actions", response_model=SecurityIncidentResponse)
async def perform_incident_action(
    incident_id: UUID,
    action_data: IncidentActionRequest,
    request: Request,
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Perform an action on a security incident (acknowledge, track, ignore, clear, reopen)"""
    service = SecurityIncidentService(db)
    
    # Validate action
    try:
        action_type = IncidentActionType(action_data.action.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action: {action_data.action}. Must be one of: acknowledge, track, ignore, clear, reopen"
        )
    
    # Get client IP and user agent
    client_ip = request.client.host if request.client else None
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "")
    
    # Perform action
    incident = service.perform_incident_action(
        incident_id=incident_id,
        tenant_id=str(current_user.tenant_id),
        action=action_type,
        performed_by=current_user.id,
        notes=action_data.notes,
        ip_address=client_ip,
        user_agent=user_agent
    )
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return SecurityIncidentResponse.from_orm(incident)


@router.get("/{incident_id}/history", response_model=List[IncidentActionHistoryResponse])
async def get_incident_action_history(
    incident_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_cve_feature),
    db: Session = Depends(get_db)
):
    """Get action history for a security incident"""
    service = SecurityIncidentService(db)
    
    # Verify incident belongs to tenant
    incident = service.get_incident(incident_id, str(current_user.tenant_id))
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    history = service.get_incident_action_history(
        incident_id=incident_id,
        tenant_id=str(current_user.tenant_id),
        limit=limit
    )
    
    return [IncidentActionHistoryResponse.from_orm(h) for h in history]

