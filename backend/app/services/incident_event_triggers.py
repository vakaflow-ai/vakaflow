"""
Incident Event Triggers - Automatic incident creation on events
"""
import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.incident_report import IncidentReport, IncidentType, IncidentStatus
from app.models.assessment import AssessmentAssignment
from app.models.user import User
from app.services.incident_push_service import IncidentPushService

logger = logging.getLogger(__name__)


class IncidentEventTriggers:
    """Service for triggering incident creation on events"""
    
    @staticmethod
    def create_cve_incident(
        cve_id: str,
        entity_type: str,
        entity_id: UUID,
        vendor_id: Optional[UUID],
        tenant_id: UUID,
        severity: str,
        cvss_score: Optional[str],
        affected_versions: Optional[list],
        db: Session,
        created_by: Optional[UUID] = None,
        auto_push: bool = True
    ) -> IncidentReport:
        """Create incident for CVE detection"""
        try:
            # Check if incident already exists for this CVE and entity
            existing = db.query(IncidentReport).filter(
                IncidentReport.incident_type == IncidentType.CVE_TRACKING.value,
                IncidentReport.entity_type == entity_type,
                IncidentReport.entity_id == entity_id,
                IncidentReport.tenant_id == tenant_id,
                IncidentReport.incident_data['cve_id'].astext == cve_id
            ).first()
            
            if existing:
                logger.info(f"CVE incident already exists for {cve_id} and {entity_type} {entity_id}")
                return existing
            
            # Create incident
            incident = IncidentReport(
                tenant_id=tenant_id,
                incident_type=IncidentType.CVE_TRACKING.value,
                title=f"CVE {cve_id} detected in {entity_type}",
                description=f"Common Vulnerability and Exposure {cve_id} has been detected and matched to {entity_type}",
                severity=severity,
                entity_type=entity_type,
                entity_id=entity_id,
                vendor_id=vendor_id,
                incident_data={
                    "cve_id": cve_id,
                    "cvss_score": cvss_score,
                    "affected_versions": affected_versions or [],
                    "detected_at": datetime.utcnow().isoformat()
                },
                created_by=created_by
            )
            
            db.add(incident)
            db.commit()
            db.refresh(incident)
            
            logger.info(f"Created CVE incident {incident.id} for {cve_id} and {entity_type} {entity_id}")
            
            # Auto-push if configured
            if auto_push:
                # Get configured external system from tenant settings or integration
                # For now, try both ServiceNow and Jira if available
                for external_system in ['servicenow', 'jira']:
                    try:
                        result = IncidentPushService.push_incident(incident.id, external_system, db)
                        if result.get('success'):
                            logger.info(f"Auto-pushed CVE incident {incident.id} to {external_system}")
                            break
                    except Exception as e:
                        logger.warning(f"Failed to auto-push to {external_system}: {e}")
                        continue
            
            return incident
            
        except Exception as e:
            logger.error(f"Error creating CVE incident: {e}", exc_info=True)
            db.rollback()
            raise
    
    @staticmethod
    def create_qualification_failure_incident(
        assignment_id: UUID,
        entity_type: str,
        entity_id: UUID,
        vendor_id: Optional[UUID],
        tenant_id: UUID,
        failure_reasons: list,
        compliance_gaps: Optional[list],
        risk_assessment: Optional[Dict[str, Any]],
        db: Session,
        created_by: Optional[UUID] = None,
        auto_push: bool = True
    ) -> IncidentReport:
        """Create incident for qualification failure"""
        try:
            # Get assignment details
            assignment = db.query(AssessmentAssignment).filter(
                AssessmentAssignment.id == assignment_id
            ).first()
            
            if not assignment:
                raise ValueError(f"Assessment assignment {assignment_id} not found")
            
            # Determine severity based on risk assessment
            severity = "medium"
            if risk_assessment:
                risk_score = risk_assessment.get('risk_score', 50)
                if risk_score >= 80:
                    severity = "critical"
                elif risk_score >= 60:
                    severity = "high"
                elif risk_score >= 40:
                    severity = "medium"
                else:
                    severity = "low"
            
            # Create incident
            incident = IncidentReport(
                tenant_id=tenant_id,
                incident_type=IncidentType.QUALIFICATION_FAILURE.value,
                title=f"{entity_type.title()} qualification failed",
                description=f"Qualification assessment failed for {entity_type}. Reasons: {', '.join(failure_reasons)}",
                severity=severity,
                entity_type=entity_type,
                entity_id=entity_id,
                vendor_id=vendor_id,
                related_entity_type="assessment",
                related_entity_id=assignment_id,
                incident_data={
                    "assessment_id": str(assignment.assessment_id),
                    "assignment_id": str(assignment_id),
                    "failure_reasons": failure_reasons,
                    "compliance_gaps": compliance_gaps or [],
                    "risk_assessment": risk_assessment,
                    "failed_at": datetime.utcnow().isoformat()
                },
                created_by=created_by
            )
            
            db.add(incident)
            db.commit()
            db.refresh(incident)
            
            logger.info(f"Created qualification failure incident {incident.id} for {entity_type} {entity_id}")
            
            # Auto-push if configured
            if auto_push:
                for external_system in ['servicenow', 'jira']:
                    try:
                        result = IncidentPushService.push_incident(incident.id, external_system, db)
                        if result.get('success'):
                            logger.info(f"Auto-pushed qualification failure incident {incident.id} to {external_system}")
                            break
                    except Exception as e:
                        logger.warning(f"Failed to auto-push to {external_system}: {e}")
                        continue
            
            return incident
            
        except Exception as e:
            logger.error(f"Error creating qualification failure incident: {e}", exc_info=True)
            db.rollback()
            raise
