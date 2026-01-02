# Security Monitoring & CVE Tracking System Design

## Overview

This document outlines the design for a comprehensive security monitoring system that:
- Scans and tracks CVEs (Common Vulnerabilities and Exposures) for vendors
- Monitors security breaches and security communications
- Automatically generates risk qualification tasks when vendors are found in breaches
- Raises alerts and initiates TPRM/VRM/Risk processes
- Automatically sends assessments to affected vendors

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Monitoring System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ CVE Scanner  │    │ Breach       │    │ Security     │      │
│  │ Service      │    │ Monitor      │    │ Feed Monitor │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                    │                    │              │
│         └────────────────────┼────────────────────┘              │
│                              │                                    │
│                    ┌─────────▼─────────┐                        │
│                    │ Vendor Matching   │                        │
│                    │ Service           │                        │
│                    └─────────┬─────────┘                        │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐              │
│         │                    │                    │              │
│  ┌──────▼──────┐    ┌────────▼────────┐  ┌───────▼──────┐      │
│  │ Task        │    │ Alert          │  │ Assessment   │      │
│  │ Generator   │    │ Service        │  │ Trigger      │      │
│  └─────────────┘    └────────────────┘  └──────────────┘      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              TPRM/VRM/Risk Process Engine                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Database Models

### 1. Security Incident Model

```python
class SecurityIncidentType(str, enum.Enum):
    CVE = "cve"
    DATA_BREACH = "data_breach"
    SECURITY_ALERT = "security_alert"
    VULNERABILITY_DISCLOSURE = "vulnerability_disclosure"
    COMPLIANCE_VIOLATION = "compliance_violation"

class SecurityIncidentSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SecurityIncident(Base):
    """Security incidents (CVEs, breaches, alerts)"""
    __tablename__ = "security_incidents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    
    # Incident Identification
    incident_type = Column(SQLEnum(SecurityIncidentType), nullable=False, index=True)
    external_id = Column(String(255), nullable=True, unique=True, index=True)  # CVE ID, breach ID, etc.
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Severity and Risk
    severity = Column(SQLEnum(SecurityIncidentSeverity), nullable=False, index=True)
    cvss_score = Column(Float, nullable=True)  # CVSS score for CVEs
    risk_score = Column(Float, nullable=True)  # Calculated risk score
    
    # Source Information
    source = Column(String(255), nullable=True)  # "NVD", "CVE.org", "HaveIBeenPwned", etc.
    source_url = Column(Text, nullable=True)
    published_date = Column(DateTime, nullable=True, index=True)
    discovered_date = Column(DateTime, nullable=True)
    
    # Incident Details (JSON)
    incident_details = Column(JSON, nullable=True)  # CVE details, breach details, etc.
    affected_products = Column(JSON, nullable=True)  # List of affected products/software
    affected_versions = Column(JSON, nullable=True)  # Affected versions
    
    # Status
    status = Column(String(50), nullable=False, default="new", index=True)  # new, investigating, resolved, false_positive
    resolution_notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_scan_at = Column(DateTime, nullable=True)  # Last time vendor matching was performed
```

### 2. Vendor Security Tracking Model

```python
class VendorSecurityStatus(str, enum.Enum):
    CLEAN = "clean"
    MONITORING = "monitoring"
    AT_RISK = "at_risk"
    BREACHED = "breached"
    RESOLVED = "resolved"

class VendorSecurityTracking(Base):
    """Tracks security status and incidents for vendors"""
    __tablename__ = "vendor_security_tracking"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("security_incidents.id"), nullable=False, index=True)
    
    # Matching Information
    match_confidence = Column(Float, nullable=False)  # 0.0-1.0 confidence in match
    match_reason = Column(Text, nullable=True)  # Why this vendor was matched
    matched_fields = Column(JSON, nullable=True)  # Fields that matched (name, domain, product, etc.)
    
    # Status
    status = Column(SQLEnum(VendorSecurityStatus), nullable=False, default=VendorSecurityStatus.MONITORING, index=True)
    risk_qualification_status = Column(String(50), nullable=True)  # pending, in_progress, completed, not_required
    
    # Actions Taken
    task_created = Column(Boolean, default=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("action_items.id"), nullable=True)
    alert_sent = Column(Boolean, default=False)
    assessment_triggered = Column(Boolean, default=False)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=True)
    workflow_triggered = Column(Boolean, default=False)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configurations.id"), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    # vendor = relationship("Vendor", back_populates="security_tracking")
    # incident = relationship("SecurityIncident", back_populates="vendor_tracking")
```

### 3. Security Monitoring Configuration Model

```python
class SecurityMonitoringConfig(Base):
    """Configuration for security monitoring per tenant"""
    __tablename__ = "security_monitoring_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True, index=True)
    
    # Monitoring Settings
    cve_monitoring_enabled = Column(Boolean, default=True)
    breach_monitoring_enabled = Column(Boolean, default=True)
    security_feed_monitoring_enabled = Column(Boolean, default=True)
    
    # CVE Monitoring
    cve_scan_frequency = Column(String(50), default="daily")  # hourly, daily, weekly
    cve_severity_threshold = Column(SQLEnum(SecurityIncidentSeverity), default=SecurityIncidentSeverity.MEDIUM)
    cve_cvss_threshold = Column(Float, default=5.0)  # Minimum CVSS score to track
    
    # Breach Monitoring
    breach_scan_frequency = Column(String(50), default="daily")
    breach_sources = Column(JSON, nullable=True)  # List of breach data sources
    
    # Vendor Matching Rules
    matching_rules = Column(JSON, nullable=True)  # Custom matching rules
    # Example: {
    #   "match_by_domain": true,
    #   "match_by_name": true,
    #   "match_by_product": true,
    #   "fuzzy_match_threshold": 0.8,
    #   "exact_match_required": false
    # }
    
    # Auto-Actions Configuration
    auto_create_tasks = Column(Boolean, default=True)
    auto_send_alerts = Column(Boolean, default=True)
    auto_trigger_assessments = Column(Boolean, default=True)
    auto_start_workflows = Column(Boolean, default=True)
    
    # Assessment Configuration
    default_assessment_type = Column(String(50), nullable=True)  # "tprm", "vendor_qualification", "risk_assessment"
    default_assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=True)
    
    # Workflow Configuration
    default_workflow_type = Column(String(50), nullable=True)  # "tprm", "vrm", "risk_process"
    default_workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflow_configurations.id"), nullable=True)
    
    # Alert Configuration
    alert_recipients = Column(JSON, nullable=True)  # List of user IDs or roles to alert
    alert_channels = Column(JSON, nullable=True)  # ["email", "slack", "teams", "in_app"]
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_scan_at = Column(DateTime, nullable=True)
```

### 4. Security Alert Model

```python
class SecurityAlert(Base):
    """Alerts generated from security incidents"""
    __tablename__ = "security_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("security_incidents.id"), nullable=False, index=True)
    vendor_tracking_id = Column(UUID(as_uuid=True), ForeignKey("vendor_security_tracking.id"), nullable=True, index=True)
    
    # Alert Details
    alert_type = Column(String(50), nullable=False)  # "cve_detected", "breach_detected", "risk_qualification_required"
    severity = Column(SQLEnum(SecurityIncidentSeverity), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    
    # Recipients
    recipient_type = Column(String(50), nullable=False)  # "user", "role", "team"
    recipient_ids = Column(JSON, nullable=False)  # List of user IDs, role names, or team IDs
    
    # Status
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, sent, read, acknowledged
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Channels
    channels_sent = Column(JSON, nullable=True)  # ["email", "slack", "teams", "in_app"]
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

## Service Layer

### 1. Security Incident Service

```python
class SecurityIncidentService:
    """Service for managing security incidents"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_incident(self, incident_data: dict, tenant_id: UUID) -> SecurityIncident:
        """Create a new security incident"""
        pass
    
    def get_incident_by_external_id(self, external_id: str) -> Optional[SecurityIncident]:
        """Get incident by external ID (CVE ID, breach ID, etc.)"""
        pass
    
    def update_incident_status(self, incident_id: UUID, status: str, notes: str = None):
        """Update incident status"""
        pass
    
    def get_incidents_by_vendor(self, vendor_id: UUID, tenant_id: UUID) -> List[SecurityIncident]:
        """Get all incidents associated with a vendor"""
        pass
```

### 2. CVE Scanner Service

```python
class CVEScannerService:
    """Service for scanning and tracking CVEs"""
    
    def __init__(self, db: Session):
        self.db = db
        self.nvd_api = NVDAPIClient()  # NVD API client
        self.cve_org_client = CVEOrgClient()  # CVE.org client
    
    async def scan_new_cves(self, tenant_id: UUID, days_back: int = 7) -> List[SecurityIncident]:
        """
        Scan for new CVEs from NVD and CVE.org
        
        Args:
            tenant_id: Tenant ID
            days_back: Number of days to look back for CVEs
        
        Returns:
            List of new SecurityIncident records created
        """
        pass
    
    async def scan_cve_by_id(self, cve_id: str, tenant_id: UUID) -> Optional[SecurityIncident]:
        """Scan a specific CVE by ID"""
        pass
    
    async def get_cve_details(self, cve_id: str) -> dict:
        """Get CVE details from NVD API"""
        pass
```

### 3. Breach Monitor Service

```python
class BreachMonitorService:
    """Service for monitoring data breaches"""
    
    def __init__(self, db: Session):
        self.db = db
        self.hibp_client = HaveIBeenPwnedClient()  # HaveIBeenPwned API
        self.breach_data_sources = []  # Other breach data sources
    
    async def scan_breaches(self, tenant_id: UUID, days_back: int = 30) -> List[SecurityIncident]:
        """
        Scan for new data breaches
        
        Args:
            tenant_id: Tenant ID
            days_back: Number of days to look back
        
        Returns:
            List of new SecurityIncident records
        """
        pass
    
    async def check_vendor_breach(self, vendor_name: str, vendor_domain: str) -> List[dict]:
        """Check if a vendor appears in breach databases"""
        pass
```

### 4. Vendor Matching Service

```python
class VendorMatchingService:
    """Service for matching security incidents to vendors"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def match_incident_to_vendors(
        self,
        incident: SecurityIncident,
        tenant_id: UUID
    ) -> List[VendorSecurityTracking]:
        """
        Match a security incident to vendors in the tenant
        
        Matching strategies:
        1. Exact name match
        2. Domain match (from vendor website/email)
        3. Product/software name match
        4. Fuzzy name matching
        5. Vendor aliases
        
        Returns:
            List of VendorSecurityTracking records created
        """
        pass
    
    def calculate_match_confidence(
        self,
        vendor: Vendor,
        incident: SecurityIncident
    ) -> float:
        """Calculate confidence score for vendor-incident match"""
        pass
    
    def extract_vendor_identifiers(self, vendor: Vendor) -> dict:
        """Extract identifiers from vendor (name, domain, products, etc.)"""
        pass
    
    def extract_incident_identifiers(self, incident: SecurityIncident) -> dict:
        """Extract identifiers from incident (vendor names, products, domains, etc.)"""
        pass
```

### 5. Security Automation Service

```python
class SecurityAutomationService:
    """Service for automating security response actions"""
    
    def __init__(self, db: Session):
        self.db = db
        self.action_item_service = ActionItemService(db)
        self.alert_service = SecurityAlertService(db)
        self.assessment_service = AssessmentService(db)
        self.workflow_service = WorkflowService(db)
    
    async def process_vendor_security_incident(
        self,
        vendor_tracking: VendorSecurityTracking,
        config: SecurityMonitoringConfig
    ) -> dict:
        """
        Process a vendor security incident and trigger automated actions
        
        Actions:
        1. Create risk qualification task
        2. Send alerts
        3. Trigger assessment
        4. Start TPRM/VRM/Risk workflow
        
        Returns:
            Dictionary with action results
        """
        results = {
            "task_created": False,
            "alert_sent": False,
            "assessment_triggered": False,
            "workflow_started": False
        }
        
        # 1. Create risk qualification task
        if config.auto_create_tasks:
            task = await self._create_risk_qualification_task(vendor_tracking, config)
            if task:
                results["task_created"] = True
                vendor_tracking.task_created = True
                vendor_tracking.task_id = task.id
        
        # 2. Send alerts
        if config.auto_send_alerts:
            alert = await self._send_security_alert(vendor_tracking, config)
            if alert:
                results["alert_sent"] = True
                vendor_tracking.alert_sent = True
        
        # 3. Trigger assessment
        if config.auto_trigger_assessments:
            assessment = await self._trigger_security_assessment(vendor_tracking, config)
            if assessment:
                results["assessment_triggered"] = True
                vendor_tracking.assessment_triggered = True
                vendor_tracking.assessment_id = assessment.id
        
        # 4. Start workflow
        if config.auto_start_workflows:
            workflow = await self._start_security_workflow(vendor_tracking, config)
            if workflow:
                results["workflow_started"] = True
                vendor_tracking.workflow_triggered = True
                vendor_tracking.workflow_id = workflow.id
        
        self.db.commit()
        return results
    
    async def _create_risk_qualification_task(
        self,
        vendor_tracking: VendorSecurityTracking,
        config: SecurityMonitoringConfig
    ) -> Optional[ActionItem]:
        """Create a risk qualification task for the vendor"""
        from app.models.action_item import ActionItem, ActionItemType, ActionItemPriority, ActionItemStatus
        from app.models.vendor import Vendor
        from app.models.security_incident import SecurityIncident
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_tracking.vendor_id).first()
        incident = self.db.query(SecurityIncident).filter(SecurityIncident.id == vendor_tracking.incident_id).first()
        
        if not vendor or not incident:
            return None
        
        # Determine priority based on incident severity
        priority_map = {
            "critical": ActionItemPriority.URGENT,
            "high": ActionItemPriority.HIGH,
            "medium": ActionItemPriority.MEDIUM,
            "low": ActionItemPriority.LOW
        }
        priority = priority_map.get(incident.severity.value, ActionItemPriority.MEDIUM)
        
        # Get assignee (security reviewer or assessment owner)
        assignee = self._get_task_assignee(vendor_tracking.tenant_id, config)
        
        task = ActionItem(
            tenant_id=vendor_tracking.tenant_id,
            assigned_to=assignee.id,
            assigned_by=None,  # System-generated
            action_type=ActionItemType.REVIEW,
            title=f"Risk Qualification Required: {vendor.name} - {incident.title}",
            description=f"Security incident detected for vendor {vendor.name}. "
                       f"Incident: {incident.title} ({incident.external_id}). "
                       f"Severity: {incident.severity.value}. "
                       f"Please qualify the risk and determine appropriate actions.",
            priority=priority,
            status=ActionItemStatus.PENDING,
            source_type="vendor_security_incident",
            source_id=vendor_tracking.id,
            action_url=f"/vendors/{vendor.id}/security/{vendor_tracking.id}",
            item_metadata={
                "vendor_id": str(vendor.id),
                "vendor_name": vendor.name,
                "incident_id": str(incident.id),
                "incident_type": incident.incident_type.value,
                "incident_external_id": incident.external_id,
                "severity": incident.severity.value,
                "match_confidence": vendor_tracking.match_confidence
            },
            due_date=datetime.utcnow() + timedelta(days=3)  # 3 days to qualify risk
        )
        
        self.db.add(task)
        self.db.flush()
        return task
    
    async def _send_security_alert(
        self,
        vendor_tracking: VendorSecurityTracking,
        config: SecurityMonitoringConfig
    ) -> Optional[SecurityAlert]:
        """Send security alert to configured recipients"""
        from app.models.security_alert import SecurityAlert
        from app.models.vendor import Vendor
        from app.models.security_incident import SecurityIncident
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_tracking.vendor_id).first()
        incident = self.db.query(SecurityIncident).filter(SecurityIncident.id == vendor_tracking.incident_id).first()
        
        if not vendor or not incident:
            return None
        
        # Determine recipients
        recipients = self._get_alert_recipients(vendor_tracking.tenant_id, config)
        
        alert = SecurityAlert(
            tenant_id=vendor_tracking.tenant_id,
            incident_id=incident.id,
            vendor_tracking_id=vendor_tracking.id,
            alert_type="risk_qualification_required",
            severity=incident.severity,
            title=f"Security Alert: {vendor.name} - {incident.title}",
            message=f"A security incident has been detected for vendor {vendor.name}. "
                   f"Incident: {incident.title} ({incident.external_id}). "
                   f"Severity: {incident.severity.value}. "
                   f"Please review and qualify the risk.",
            recipient_type="role",
            recipient_ids=recipients,
            status="pending",
            channels_sent=config.alert_channels or ["email", "in_app"]
        )
        
        self.db.add(alert)
        self.db.flush()
        
        # Send alerts through configured channels
        await self._send_alert_notifications(alert, vendor, incident, config)
        
        alert.status = "sent"
        alert.sent_at = datetime.utcnow()
        self.db.commit()
        
        return alert
    
    async def _trigger_security_assessment(
        self,
        vendor_tracking: VendorSecurityTracking,
        config: SecurityMonitoringConfig
    ) -> Optional[AssessmentAssignment]:
        """Trigger security assessment for the vendor"""
        from app.models.assessment import Assessment
        from app.models.vendor import Vendor
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_tracking.vendor_id).first()
        
        if not vendor:
            return None
        
        # Get assessment to assign
        assessment_id = config.default_assessment_id
        if not assessment_id:
            # Find assessment by type
            assessment = self.db.query(Assessment).filter(
                Assessment.tenant_id == vendor_tracking.tenant_id,
                Assessment.assessment_type == config.default_assessment_type or "risk_assessment",
                Assessment.is_active == True
            ).first()
            
            if not assessment:
                logger.warning(f"No assessment found for vendor security incident")
                return None
            
            assessment_id = assessment.id
        
        # Create assessment assignment
        assignment_data = {
            "assignment_type": "security_incident",
            "status": "pending",
            "vendor_id": str(vendor.id),
            "due_date": datetime.utcnow() + timedelta(days=14),  # 14 days to complete
            "metadata": {
                "triggered_by": "security_monitoring",
                "incident_id": str(vendor_tracking.incident_id),
                "vendor_tracking_id": str(vendor_tracking.id)
            }
        }
        
        assignment = self.assessment_service.create_assignment(
            assessment_id=str(assessment_id),
            assignment_data=assignment_data,
            tenant_id=vendor_tracking.tenant_id,
            assigned_by=None  # System-assigned
        )
        
        return assignment
    
    async def _start_security_workflow(
        self,
        vendor_tracking: VendorSecurityTracking,
        config: SecurityMonitoringConfig
    ) -> Optional[WorkflowInstance]:
        """Start TPRM/VRM/Risk workflow for the vendor"""
        from app.models.workflow_config import WorkflowConfiguration
        from app.models.vendor import Vendor
        
        vendor = self.db.query(Vendor).filter(Vendor.id == vendor_tracking.vendor_id).first()
        
        if not vendor:
            return None
        
        # Get workflow to start
        workflow_id = config.default_workflow_id
        if not workflow_id:
            # Find workflow by type
            workflow = self.db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == vendor_tracking.tenant_id,
                WorkflowConfiguration.workflow_type == config.default_workflow_type or "tprm",
                WorkflowConfiguration.status == "active"
            ).first()
            
            if not workflow:
                logger.warning(f"No workflow found for vendor security incident")
                return None
            
            workflow_id = workflow.id
        
        # Start workflow
        workflow_instance = self.workflow_service.start_workflow(
            workflow_id=str(workflow_id),
            vendor_id=str(vendor.id),
            tenant_id=vendor_tracking.tenant_id,
            triggered_by=None,  # System-triggered
            trigger_reason=f"Security incident detected: {vendor_tracking.incident_id}"
        )
        
        return workflow_instance
```

### 6. Security Monitoring Scheduler

```python
class SecurityMonitoringScheduler:
    """Scheduler for periodic security monitoring tasks"""
    
    def __init__(self, db: Session):
        self.db = db
        self.cve_scanner = CVEScannerService(db)
        self.breach_monitor = BreachMonitorService(db)
        self.vendor_matcher = VendorMatchingService(db)
        self.automation = SecurityAutomationService(db)
    
    async def run_monitoring_cycle(self, tenant_id: UUID):
        """
        Run a complete monitoring cycle for a tenant
        
        1. Scan for new CVEs
        2. Scan for new breaches
        3. Match incidents to vendors
        4. Trigger automated actions
        """
        config = self._get_monitoring_config(tenant_id)
        if not config:
            logger.warning(f"No monitoring config for tenant {tenant_id}")
            return
        
        # 1. Scan CVEs
        if config.cve_monitoring_enabled:
            new_cves = await self.cve_scanner.scan_new_cves(tenant_id)
            logger.info(f"Found {len(new_cves)} new CVEs for tenant {tenant_id}")
        
        # 2. Scan breaches
        if config.breach_monitoring_enabled:
            new_breaches = await self.breach_monitor.scan_breaches(tenant_id)
            logger.info(f"Found {len(new_breaches)} new breaches for tenant {tenant_id}")
        
        # 3. Match incidents to vendors
        all_incidents = self._get_unmatched_incidents(tenant_id)
        for incident in all_incidents:
            vendor_trackings = await self.vendor_matcher.match_incident_to_vendors(incident, tenant_id)
            
            # 4. Trigger automated actions for each match
            for vendor_tracking in vendor_trackings:
                await self.automation.process_vendor_security_incident(vendor_tracking, config)
        
        # Update last scan time
        config.last_scan_at = datetime.utcnow()
        self.db.commit()
```

## API Endpoints

### 1. Security Incidents API

```python
@router.get("/security-incidents", response_model=List[SecurityIncidentResponse])
async def list_security_incidents(
    incident_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List security incidents for the tenant"""

@router.get("/security-incidents/{incident_id}", response_model=SecurityIncidentResponse)
async def get_security_incident(
    incident_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get security incident details"""

@router.post("/security-incidents", response_model=SecurityIncidentResponse)
async def create_security_incident(
    incident_data: SecurityIncidentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new security incident (manual entry)"""

@router.post("/security-incidents/{incident_id}/match-vendors")
async def match_incident_to_vendors(
    incident_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger vendor matching for an incident"""
```

### 2. Vendor Security Tracking API

```python
@router.get("/vendors/{vendor_id}/security", response_model=List[VendorSecurityTrackingResponse])
async def get_vendor_security_tracking(
    vendor_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get security tracking for a vendor"""

@router.post("/vendors/{vendor_id}/security/{tracking_id}/qualify-risk")
async def qualify_vendor_risk(
    vendor_id: UUID,
    tracking_id: UUID,
    qualification_data: RiskQualificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Qualify risk for a vendor security incident"""

@router.post("/vendors/{vendor_id}/security/{tracking_id}/resolve")
async def resolve_vendor_security_incident(
    vendor_id: UUID,
    tracking_id: UUID,
    resolution_data: SecurityIncidentResolutionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a vendor security incident as resolved"""
```

### 3. Security Monitoring Configuration API

```python
@router.get("/security-monitoring/config", response_model=SecurityMonitoringConfigResponse)
async def get_monitoring_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get security monitoring configuration for tenant"""

@router.put("/security-monitoring/config", response_model=SecurityMonitoringConfigResponse)
async def update_monitoring_config(
    config_data: SecurityMonitoringConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update security monitoring configuration"""

@router.post("/security-monitoring/scan")
async def trigger_manual_scan(
    scan_type: Optional[str] = Query(None, description="cve, breach, or all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger a security scan"""
```

### 4. Security Alerts API

```python
@router.get("/security-alerts", response_model=List[SecurityAlertResponse])
async def list_security_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List security alerts for the user/tenant"""

@router.post("/security-alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Acknowledge a security alert"""
```

## Integration Points

### 1. NVD (National Vulnerability Database) API

```python
class NVDAPIClient:
    """Client for NVD API"""
    
    BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    
    async def get_cves(self, days_back: int = 7, cvss_threshold: float = 5.0) -> List[dict]:
        """Get CVEs from NVD API"""
        pass
    
    async def get_cve_by_id(self, cve_id: str) -> dict:
        """Get specific CVE by ID"""
        pass
```

### 2. CVE.org API

```python
class CVEOrgClient:
    """Client for CVE.org API"""
    
    BASE_URL = "https://cveawg.mitre.org/api/cve"
    
    async def get_cves(self, days_back: int = 7) -> List[dict]:
        """Get CVEs from CVE.org"""
        pass
```

### 3. HaveIBeenPwned API

```python
class HaveIBeenPwnedClient:
    """Client for HaveIBeenPwned API"""
    
    BASE_URL = "https://haveibeenpwned.com/api/v3"
    
    async def search_breaches(self, domain: str) -> List[dict]:
        """Search for breaches by domain"""
        pass
    
    async def get_breach(self, breach_name: str) -> dict:
        """Get breach details"""
        pass
```

## Workflow Integration

### TPRM/VRM/Risk Process Triggers

When a vendor is matched to a security incident, the system can automatically:

1. **Start TPRM Workflow**: If configured, start a Third-Party Risk Management workflow
2. **Start VRM Workflow**: If configured, start a Vendor Risk Management workflow
3. **Start Risk Process**: If configured, start a general risk management process

The workflow receives:
- Vendor information
- Security incident details
- Match confidence score
- Risk qualification requirements

## Frontend Components

### 1. Security Monitoring Dashboard

- Overview of security incidents
- Vendor security status
- Recent alerts
- Risk trends

### 2. Vendor Security View

- List of security incidents for a vendor
- Risk qualification status
- Actions taken
- Assessment assignments

### 3. Security Incident Details

- Incident information
- Matched vendors
- Actions triggered
- Resolution status

### 4. Monitoring Configuration

- Enable/disable monitoring types
- Configure scan frequency
- Set thresholds
- Configure auto-actions
- Set alert recipients

## Implementation Phases

### Phase 1: Core Models & Services
1. Create database models
2. Create migration scripts
3. Implement basic services (SecurityIncidentService, VendorMatchingService)

### Phase 2: CVE Scanning
1. Integrate NVD API
2. Implement CVE scanner service
3. Create CVE scanning scheduler

### Phase 3: Breach Monitoring
1. Integrate breach data sources
2. Implement breach monitor service
3. Create breach scanning scheduler

### Phase 4: Vendor Matching
1. Implement vendor matching algorithms
2. Create confidence scoring
3. Test matching accuracy

### Phase 5: Automation
1. Implement task generation
2. Implement alert system
3. Implement assessment triggering
4. Implement workflow integration

### Phase 6: API & Frontend
1. Create API endpoints
2. Build frontend components
3. Create monitoring dashboard

### Phase 7: Testing & Optimization
1. Test with real CVE/breach data
2. Optimize matching algorithms
3. Performance testing
4. User acceptance testing

## Security Considerations

1. **API Rate Limiting**: Respect rate limits for external APIs (NVD, CVE.org, etc.)
2. **Data Privacy**: Ensure vendor data is handled securely
3. **Tenant Isolation**: All data must be tenant-isolated
4. **Access Control**: Only authorized users can view/configure security monitoring
5. **Audit Logging**: Log all security monitoring activities

## Future Enhancements

1. **Machine Learning**: Use ML to improve vendor matching accuracy
2. **Custom Data Sources**: Allow tenants to add custom security data sources
3. **Risk Scoring**: Advanced risk scoring based on multiple factors
4. **Predictive Analytics**: Predict which vendors are likely to have security issues
5. **Integration with SIEM**: Integrate with Security Information and Event Management systems
6. **Compliance Mapping**: Map security incidents to compliance requirements

