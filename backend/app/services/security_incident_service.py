"""
Security Incident Service - Manages security incidents and vendor tracking
"""
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from datetime import datetime
import logging
from app.models.security_incident import (
    SecurityIncident,
    VendorSecurityTracking,
    SecurityMonitoringConfig,
    SecurityAlert,
    SecurityIncidentActionHistory,
    IncidentType,
    IncidentSeverity,
    IncidentActionType
)
from app.models.vendor import Vendor
from app.core.audit import audit_service, AuditAction

logger = logging.getLogger(__name__)


class SecurityIncidentService:
    """Service for managing security incidents"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_incidents(
        self,
        tenant_id: str,
        incident_type: Optional[IncidentType] = None,
        severity: Optional[IncidentSeverity] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[SecurityIncident], int]:
        """
        Get security incidents for a tenant
        
        Returns:
            Tuple of (incidents list, total count)
        """
        query = self.db.query(SecurityIncident).filter(
            SecurityIncident.tenant_id == tenant_id
        )
        
        if incident_type:
            query = query.filter(SecurityIncident.incident_type == incident_type)
        
        if severity:
            query = query.filter(SecurityIncident.severity == severity)
        
        if status:
            query = query.filter(SecurityIncident.status == status)
        
        total = query.count()
        
        incidents = query.order_by(desc(SecurityIncident.published_date)).offset(offset).limit(limit).all()
        
        return incidents, total
    
    def get_incident(self, incident_id: UUID, tenant_id: str) -> Optional[SecurityIncident]:
        """Get a specific security incident"""
        return self.db.query(SecurityIncident).filter(
            SecurityIncident.id == incident_id,
            SecurityIncident.tenant_id == tenant_id
        ).first()
    
    def get_vendor_trackings(
        self,
        tenant_id: str,
        vendor_id: Optional[UUID] = None,
        status: Optional[str] = None,
        risk_status: Optional[str] = None
    ) -> List[VendorSecurityTracking]:
        """Get vendor security trackings"""
        # Convert tenant_id to UUID for comparison
        tenant_uuid = UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        query = self.db.query(VendorSecurityTracking).filter(
            VendorSecurityTracking.tenant_id == tenant_uuid
        )
        
        if vendor_id:
            query = query.filter(VendorSecurityTracking.vendor_id == vendor_id)
        
        if status:
            query = query.filter(VendorSecurityTracking.status == status)
        
        if risk_status:
            query = query.filter(VendorSecurityTracking.risk_qualification_status == risk_status)
        
        return query.order_by(desc(VendorSecurityTracking.created_at)).all()
    
    def update_tracking_risk(
        self,
        tracking_id: UUID,
        tenant_id: str,
        risk_assessment: Dict[str, Any],
        risk_level: str,
        qualified_by: UUID
    ) -> Optional[VendorSecurityTracking]:
        """Update risk qualification for a tracking"""
        # Convert tenant_id to UUID for comparison
        tenant_uuid = UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        tracking = self.db.query(VendorSecurityTracking).filter(
            VendorSecurityTracking.id == tracking_id,
            VendorSecurityTracking.tenant_id == tenant_uuid
        ).first()
        
        if not tracking:
            return None
        
        tracking.risk_qualification_status = "completed"
        tracking.risk_assessment = risk_assessment
        tracking.risk_level = risk_level
        tracking.qualified_by = qualified_by
        tracking.qualified_at = datetime.utcnow()
        
        try:
            self.db.commit()
            audit_service.log(
                db=self.db,
                action=AuditAction.UPDATE,
                resource_type="vendor_security_tracking",
                resource_id=str(tracking_id),
                tenant_id=tenant_id,
                user_id=str(qualified_by),
                details={"risk_level": risk_level}
            )
            return tracking
        except Exception as e:
            logger.error(f"Error updating tracking risk: {str(e)}", exc_info=True)
            self.db.rollback()
            return None
    
    def resolve_tracking(
        self,
        tracking_id: UUID,
        tenant_id: str,
        resolution_type: str,
        resolution_notes: Optional[str],
        resolved_by: UUID
    ) -> Optional[VendorSecurityTracking]:
        """Resolve a vendor security tracking"""
        # Convert tenant_id to UUID for comparison
        tenant_uuid = UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        tracking = self.db.query(VendorSecurityTracking).filter(
            VendorSecurityTracking.id == tracking_id,
            VendorSecurityTracking.tenant_id == tenant_uuid
        ).first()
        
        if not tracking:
            return None
        
        tracking.status = "resolved"
        tracking.resolution_type = resolution_type
        tracking.resolution_notes = resolution_notes
        tracking.resolved_by = resolved_by
        tracking.resolved_at = datetime.utcnow()
        
        try:
            self.db.commit()
            audit_service.log(
                db=self.db,
                action=AuditAction.UPDATE,
                resource_type="vendor_security_tracking",
                resource_id=str(tracking_id),
                tenant_id=tenant_id,
                user_id=str(resolved_by),
                details={"resolution_type": resolution_type}
            )
            return tracking
        except Exception as e:
            logger.error(f"Error resolving tracking: {str(e)}", exc_info=True)
            self.db.rollback()
            return None
    
    def get_monitoring_config(self, tenant_id: str) -> Optional[SecurityMonitoringConfig]:
        """Get or create monitoring config for tenant"""
        config = self.db.query(SecurityMonitoringConfig).filter(
            SecurityMonitoringConfig.tenant_id == tenant_id
        ).first()
        
        if not config:
            # Create default config
            config = SecurityMonitoringConfig(
                tenant_id=tenant_id,
                cve_monitoring_enabled=True,
                cve_scan_frequency="daily",
                cve_severity_threshold=IncidentSeverity.MEDIUM,
                cve_cvss_threshold=5.0,
                breach_monitoring_enabled=True,
                breach_scan_frequency="daily",
                auto_create_tasks=True,
                auto_send_alerts=True,
                auto_trigger_assessments=False,
                auto_start_workflows=False,
                min_match_confidence=0.5
            )
            self.db.add(config)
            try:
                self.db.commit()
            except Exception as e:
                logger.error(f"Error creating monitoring config: {str(e)}", exc_info=True)
                self.db.rollback()
                return None
        
        return config
    
    def update_monitoring_config(
        self,
        tenant_id: str,
        config_data: Dict[str, Any]
    ) -> Optional[SecurityMonitoringConfig]:
        """Update monitoring configuration"""
        config = self.get_monitoring_config(tenant_id)
        if not config:
            return None
        
        # Update fields
        for key, value in config_data.items():
            if hasattr(config, key):
                setattr(config, key, value)
        
        try:
            self.db.commit()
            return config
        except Exception as e:
            logger.error(f"Error updating monitoring config: {str(e)}", exc_info=True)
            self.db.rollback()
            return None
    
    def perform_incident_action(
        self,
        incident_id: UUID,
        tenant_id: str,
        action: IncidentActionType,
        performed_by: UUID,
        notes: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[SecurityIncident]:
        """
        Perform an action on a security incident (acknowledge, track, ignore, clear)
        Creates an audit history entry for the action
        """
        incident = self.get_incident(incident_id, tenant_id)
        if not incident:
            return None
        
        previous_status = incident.status
        
        # Update incident based on action
        if action == IncidentActionType.ACKNOWLEDGE:
            incident.acknowledged_by = performed_by
            incident.acknowledged_at = datetime.utcnow()
            incident.status = "acknowledged"
            new_status = "acknowledged"
        elif action == IncidentActionType.TRACK:
            # Track means actively monitoring - keep status as active or set to tracked
            incident.status = "tracked" if incident.status == "active" else incident.status
            new_status = incident.status
        elif action == IncidentActionType.IGNORE:
            incident.ignored_by = performed_by
            incident.ignored_at = datetime.utcnow()
            incident.status = "ignored"
            new_status = "ignored"
        elif action == IncidentActionType.CLEAR:
            incident.cleared_by = performed_by
            incident.cleared_at = datetime.utcnow()
            incident.status = "cleared"
            new_status = "cleared"
        elif action == IncidentActionType.REOPEN:
            # Reopen a cleared/ignored incident
            incident.acknowledged_by = None
            incident.acknowledged_at = None
            incident.ignored_by = None
            incident.ignored_at = None
            incident.cleared_by = None
            incident.cleared_at = None
            incident.status = "active"
            new_status = "active"
        else:
            return None
        
        # Update action notes
        if notes:
            incident.action_notes = notes
        
        # Create action history entry
        action_history = SecurityIncidentActionHistory(
            tenant_id=incident.tenant_id,
            incident_id=incident.id,
            action=action,
            performed_by=performed_by,
            performed_at=datetime.utcnow(),
            notes=notes,
            previous_status=previous_status,
            new_status=new_status,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(action_history)
        
        try:
            self.db.commit()
            
            # Log to audit service
            audit_service.log(
                db=self.db,
                action=AuditAction.UPDATE,
                resource_type="security_incident",
                resource_id=str(incident_id),
                tenant_id=tenant_id,
                user_id=str(performed_by),
                details={
                    "action": action.value,
                    "previous_status": previous_status,
                    "new_status": new_status,
                    "notes": notes
                }
            )
            
            return incident
        except Exception as e:
            logger.error(f"Error performing incident action: {str(e)}", exc_info=True)
            self.db.rollback()
            return None
    
    def get_incident_action_history(
        self,
        incident_id: UUID,
        tenant_id: str,
        limit: int = 50
    ) -> List[SecurityIncidentActionHistory]:
        """Get action history for an incident"""
        return self.db.query(SecurityIncidentActionHistory).filter(
            SecurityIncidentActionHistory.incident_id == incident_id,
            SecurityIncidentActionHistory.tenant_id == tenant_id
        ).order_by(desc(SecurityIncidentActionHistory.performed_at)).limit(limit).all()

