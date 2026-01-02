"""
Security Monitoring Scheduler - Scheduled jobs for CVE scanning and vendor matching
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
import logging
from app.models.security_incident import SecurityMonitoringConfig
from app.models.tenant import Tenant
from app.services.cve_scanner_service import CVEScannerService
from app.services.vendor_matching_service import VendorMatchingService
from app.services.security_incident_service import SecurityIncidentService

logger = logging.getLogger(__name__)


class SecurityMonitoringScheduler:
    """Service for scheduled security monitoring tasks"""
    
    def __init__(self, db: Session):
        self.db = db
        self.scanner = CVEScannerService(db)
        self.matcher = VendorMatchingService(db)
        self.incident_service = SecurityIncidentService(db)
    
    def run_cve_scan_for_all_tenants(self) -> Dict[str, Any]:
        """
        Run CVE scan for all tenants with CVE monitoring enabled
        
        Returns:
            Dictionary with scan results per tenant
        """
        results = {}
        
        # Get all tenants with CVE monitoring enabled
        configs = self.db.query(SecurityMonitoringConfig).filter(
            SecurityMonitoringConfig.cve_monitoring_enabled == True
        ).all()
        
        for config in configs:
            tenant_id = str(config.tenant_id)
            try:
                logger.info(f"Running CVE scan for tenant {tenant_id}")
                
                # Determine days_back based on scan frequency
                days_back = 7  # Default
                if config.cve_scan_frequency == "hourly":
                    days_back = 1
                elif config.cve_scan_frequency == "daily":
                    days_back = 7
                elif config.cve_scan_frequency == "weekly":
                    days_back = 30
                
                # Scan for new CVEs
                incidents = self.scanner.scan_new_cves(
                    tenant_id=tenant_id,
                    days_back=days_back,
                    config=config
                )
                
                # Match incidents to vendors
                matched_count = 0
                for incident in incidents:
                    trackings = self.matcher.match_incident_to_vendors(
                        incident=incident,
                        tenant_id=tenant_id,
                        config=config
                    )
                    matched_count += len(trackings)
                
                # Also match existing incidents that don't have vendor trackings
                from app.models.security_incident import SecurityIncident, VendorSecurityTracking
                recent_date = datetime.utcnow() - timedelta(days=days_back)
                existing_incidents = self.db.query(SecurityIncident).filter(
                    SecurityIncident.incident_type == "cve",
                    SecurityIncident.tenant_id == config.tenant_id,
                    SecurityIncident.created_at >= recent_date
                ).all()
                
                existing_matched = 0
                # Convert tenant_id to UUID for comparison
                from uuid import UUID as UUIDType
                tenant_uuid = UUIDType(tenant_id) if isinstance(tenant_id, str) else tenant_id
                for incident in existing_incidents:
                    existing_trackings = self.db.query(VendorSecurityTracking).filter(
                        VendorSecurityTracking.incident_id == incident.id,
                        VendorSecurityTracking.tenant_id == tenant_uuid
                    ).count()
                    if existing_trackings == 0:
                        trackings = self.matcher.match_incident_to_vendors(
                            incident=incident,
                            tenant_id=tenant_id,
                            config=config
                        )
                        existing_matched += len(trackings)
                
                results[tenant_id] = {
                    "new_cves": len(incidents),
                    "matched_vendors": matched_count + existing_matched,
                    "existing_matched": existing_matched
                }
                
                logger.info(f"CVE scan completed for tenant {tenant_id}: {len(incidents)} new CVEs, {matched_count + existing_matched} vendor matches")
                
            except Exception as e:
                logger.error(f"Error running CVE scan for tenant {tenant_id}: {str(e)}", exc_info=True)
                results[tenant_id] = {
                    "error": str(e),
                    "new_cves": 0,
                    "matched_vendors": 0
                }
        
        return results
    
    def run_cve_scan_for_tenant(self, tenant_id: str) -> Dict[str, Any]:
        """
        Run CVE scan for a specific tenant
        
        Args:
            tenant_id: Tenant ID to scan for
        
        Returns:
            Dictionary with scan results
        """
        config = self.incident_service.get_monitoring_config(tenant_id)
        
        if not config or not config.cve_monitoring_enabled:
            return {
                "error": "CVE monitoring not enabled for this tenant",
                "new_cves": 0,
                "matched_vendors": 0
            }
        
        try:
            # Determine days_back based on scan frequency
            days_back = 7  # Default
            if config.cve_scan_frequency == "hourly":
                days_back = 1
            elif config.cve_scan_frequency == "daily":
                days_back = 7
            elif config.cve_scan_frequency == "weekly":
                days_back = 30
            
            # Scan for new CVEs
            incidents = self.scanner.scan_new_cves(
                tenant_id=tenant_id,
                days_back=days_back,
                config=config
            )
            
            # Match incidents to vendors
            matched_count = 0
            for incident in incidents:
                trackings = self.matcher.match_incident_to_vendors(
                    incident=incident,
                    tenant_id=tenant_id,
                    config=config
                )
                matched_count += len(trackings)
            
            return {
                "new_cves": len(incidents),
                "matched_vendors": matched_count
            }
            
        except Exception as e:
            logger.error(f"Error running CVE scan for tenant {tenant_id}: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "new_cves": 0,
                "matched_vendors": 0
            }

