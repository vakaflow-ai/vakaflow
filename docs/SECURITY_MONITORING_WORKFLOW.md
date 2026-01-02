# Security Monitoring Workflow

## High-Level Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Monitoring Workflow                   │
└─────────────────────────────────────────────────────────────────┘

1. SCHEDULED SCAN (Daily/Hourly)
   │
   ├─→ CVE Scanner Service
   │   │
   │   ├─→ Query NVD API (last 7 days)
   │   ├─→ Query CVE.org API
   │   └─→ Create SecurityIncident records
   │
   ├─→ Breach Monitor Service
   │   │
   │   ├─→ Query HaveIBeenPwned API
   │   ├─→ Query other breach databases
   │   └─→ Create SecurityIncident records
   │
   └─→ Security Feed Monitor
       │
       ├─→ Monitor RSS feeds
       ├─→ Monitor security bulletins
       └─→ Create SecurityIncident records

2. VENDOR MATCHING
   │
   └─→ Vendor Matching Service
       │
       ├─→ For each new SecurityIncident:
       │   │
       │   ├─→ Extract identifiers (vendor names, domains, products)
       │   │
       │   ├─→ Query vendors in tenant:
       │   │   ├─→ Match by exact name
       │   │   ├─→ Match by domain
       │   │   ├─→ Match by product/software
       │   │   └─→ Fuzzy name matching
       │   │
       │   └─→ Create VendorSecurityTracking records
       │       (with match confidence score)

3. AUTOMATED ACTIONS (Based on Configuration)
   │
   └─→ Security Automation Service
       │
       ├─→ For each VendorSecurityTracking:
       │   │
       │   ├─→ CREATE TASK (if auto_create_tasks = true)
       │   │   │
       │   │   └─→ ActionItem:
       │   │       - Type: REVIEW
       │   │       - Title: "Risk Qualification Required: {vendor} - {incident}"
       │   │       - Priority: Based on incident severity
       │   │       - Assignee: Security reviewer or assessment owner
       │   │       - Due Date: 3 days
       │   │
       │   ├─→ SEND ALERT (if auto_send_alerts = true)
       │   │   │
       │   │   └─→ SecurityAlert:
       │   │       - Recipients: Configured roles/users
       │   │       - Channels: Email, Slack, Teams, In-App
       │   │       - Severity: Based on incident severity
       │   │
       │   ├─→ TRIGGER ASSESSMENT (if auto_trigger_assessments = true)
       │   │   │
       │   │   └─→ AssessmentAssignment:
       │   │       - Assessment: Default security assessment
       │   │       - Vendor: Affected vendor
       │   │       - Due Date: 14 days
       │   │       - Metadata: Incident details
       │   │
       │   └─→ START WORKFLOW (if auto_start_workflows = true)
       │       │
       │       └─→ WorkflowInstance:
       │           - Type: TPRM/VRM/Risk Process
       │           - Vendor: Affected vendor
       │           - Trigger: Security incident
       │           - Context: Incident details

4. USER ACTIONS
   │
   ├─→ Review Security Alert
   │   └─→ Navigate to vendor security page
   │
   ├─→ Qualify Risk (from Task)
   │   │
   │   ├─→ Review incident details
   │   ├─→ Review vendor information
   │   ├─→ Assess impact
   │   └─→ Update VendorSecurityTracking:
   │       - risk_qualification_status: "completed"
   │       - risk_assessment: {details}
   │
   └─→ Resolve Incident
       │
       ├─→ Mark as false positive
       ├─→ Mark as resolved
       └─→ Update VendorSecurityTracking:
           - status: "resolved"
           - resolved_at: now()
```

## Detailed Workflow: CVE Detection & Response

```
1. CVE PUBLISHED
   │
   └─→ NVD API / CVE.org API
       │
       └─→ Security Monitoring Scheduler (runs daily)
           │
           └─→ CVEScannerService.scan_new_cves()
               │
               ├─→ Query API for CVEs published in last 7 days
               ├─→ Filter by CVSS threshold (default: 5.0)
               ├─→ Filter by severity (default: MEDIUM+)
               │
               └─→ For each CVE:
                   │
                   ├─→ Check if already exists (by external_id)
                   │
                   ├─→ If new, create SecurityIncident:
                   │   - incident_type: "cve"
                   │   - external_id: "CVE-2024-XXXXX"
                   │   - title: CVE title
                   │   - description: CVE description
                   │   - severity: Based on CVSS score
                   │   - cvss_score: CVSS score
                   │   - affected_products: Products from CVE
                   │   - source: "NVD" or "CVE.org"
                   │   - source_url: CVE URL
                   │
                   └─→ Trigger vendor matching

2. VENDOR MATCHING
   │
   └─→ VendorMatchingService.match_incident_to_vendors()
       │
       ├─→ Extract identifiers from CVE:
       │   ├─→ Vendor names (from affected products)
       │   ├─→ Product names
       │   └─→ Software versions
       │
       ├─→ Query vendors in tenant:
       │   ├─→ Match vendor name (exact/fuzzy)
       │   ├─→ Match vendor products
       │   └─→ Match vendor software
       │
       └─→ For each match:
           │
           └─→ Create VendorSecurityTracking:
               - vendor_id: Matched vendor
               - incident_id: CVE incident
               - match_confidence: Calculated confidence (0.0-1.0)
               - match_reason: "Matched by product name: {product}"
               - matched_fields: {name: true, product: true}
               - status: "monitoring"

3. AUTOMATED RESPONSE
   │
   └─→ SecurityAutomationService.process_vendor_security_incident()
       │
       ├─→ CREATE TASK
       │   │
       │   └─→ ActionItem:
       │       - assigned_to: Security reviewer
       │       - title: "Risk Qualification: Vendor X - CVE-2024-XXXXX"
       │       - priority: URGENT (if CVSS >= 9.0)
       │       - description: CVE details + vendor info
       │       - due_date: 3 days
       │
       ├─→ SEND ALERT
       │   │
       │   └─→ SecurityAlert:
       │       - recipients: Security team, Compliance team
       │       - channels: Email, Slack
       │       - title: "CVE Detected for Vendor X"
       │       - message: CVE details + impact assessment
       │
       ├─→ TRIGGER ASSESSMENT
       │   │
       │   └─→ AssessmentAssignment:
       │       - assessment: "Security Risk Assessment"
       │       - vendor: Vendor X
       │       - due_date: 14 days
       │       - metadata: {cve_id: "CVE-2024-XXXXX", ...}
       │
       └─→ START WORKFLOW
           │
           └─→ WorkflowInstance:
               - workflow: "TPRM Security Review"
               - vendor: Vendor X
               - context: {incident_id: ..., cve_id: "CVE-2024-XXXXX"}
```

## Detailed Workflow: Breach Detection & Response

```
1. BREACH DETECTED
   │
   └─→ Breach Monitor Service (runs daily)
       │
       └─→ BreachMonitorService.scan_breaches()
           │
           ├─→ Query HaveIBeenPwned API
           ├─→ Query other breach databases
           │
           └─→ For each new breach:
               │
               └─→ Create SecurityIncident:
                   - incident_type: "data_breach"
                   - external_id: Breach ID
                   - title: Breach name
                   - description: Breach details
                   - severity: Based on breach size/type
                   - affected_products: Breached services
                   - source: "HaveIBeenPwned" or other
                   - source_url: Breach URL

2. VENDOR MATCHING
   │
   └─→ VendorMatchingService.match_incident_to_vendors()
       │
       ├─→ Extract identifiers from breach:
       │   ├─→ Company name
       │   ├─→ Domain name
       │   └─→ Service names
       │
       ├─→ Query vendors in tenant:
       │   ├─→ Match vendor name (exact/fuzzy)
       │   ├─→ Match vendor domain
       │   └─→ Match vendor website
       │
       └─→ For each match:
           │
           └─→ Create VendorSecurityTracking:
               - vendor_id: Matched vendor
               - incident_id: Breach incident
               - match_confidence: Calculated confidence
               - match_reason: "Matched by domain: {domain}"
               - status: "breached" (if high confidence)

3. AUTOMATED RESPONSE
   │
   └─→ SecurityAutomationService.process_vendor_security_incident()
       │
       ├─→ CREATE TASK (URGENT priority)
       │   │
       │   └─→ ActionItem:
       │       - title: "URGENT: Data Breach Detected - Vendor X"
       │       - priority: URGENT
       │       - due_date: 1 day (immediate action required)
       │
       ├─→ SEND ALERT (all channels)
       │   │
       │   └─→ SecurityAlert:
       │       - severity: CRITICAL
       │       - recipients: All security/compliance team
       │       - channels: Email, Slack, Teams, SMS
       │
       ├─→ TRIGGER ASSESSMENT (immediate)
       │   │
       │   └─→ AssessmentAssignment:
       │       - assessment: "Breach Impact Assessment"
       │       - vendor: Vendor X
       │       - due_date: 7 days (urgent)
       │
       └─→ START WORKFLOW (immediate)
           │
           └─→ WorkflowInstance:
               - workflow: "VRM Breach Response"
               - vendor: Vendor X
               - priority: URGENT
```

## Risk Qualification Workflow

```
1. TASK CREATED
   │
   └─→ ActionItem: "Risk Qualification Required: Vendor X - Incident Y"
       │
       └─→ Assigned to: Security Reviewer / Assessment Owner

2. REVIEW INCIDENT
   │
   ├─→ View SecurityIncident details
   ├─→ View VendorSecurityTracking
   ├─→ Review match confidence
   └─→ Assess impact

3. QUALIFY RISK
   │
   └─→ POST /vendors/{vendor_id}/security/{tracking_id}/qualify-risk
       │
       ├─→ Input:
       │   ├─→ risk_level: "low" | "medium" | "high" | "critical"
       │   ├─→ risk_assessment: Detailed assessment
       │   ├─→ impact_analysis: Impact on tenant
       │   ├─→ recommended_actions: List of actions
       │   └─→ requires_followup: boolean
       │
       └─→ Update VendorSecurityTracking:
           - risk_qualification_status: "completed"
           - risk_assessment: {details}
           - status: Updated based on risk_level

4. TAKE ACTIONS
   │
   ├─→ If risk_level = "critical" or "high":
   │   │
   │   ├─→ Escalate to management
   │   ├─→ Require immediate vendor response
   │   ├─→ Consider vendor suspension
   │   └─→ Update vendor risk score
   │
   ├─→ If risk_level = "medium":
   │   │
   │   ├─→ Require vendor assessment
   │   ├─→ Schedule follow-up review
   │   └─→ Monitor vendor response
   │
   └─→ If risk_level = "low":
       │
       ├─→ Document for records
       └─→ Mark as resolved (if appropriate)

5. RESOLVE INCIDENT
   │
   └─→ POST /vendors/{vendor_id}/security/{tracking_id}/resolve
       │
       ├─→ Input:
       │   ├─→ resolution_type: "resolved" | "false_positive" | "mitigated"
       │   ├─→ resolution_notes: Notes
       │   └─→ followup_required: boolean
       │
       └─→ Update VendorSecurityTracking:
           - status: "resolved"
           - resolved_at: now()
           - resolution_notes: Notes
```

## Integration with Existing Systems

### Assessment Integration

When a security incident is detected and assessment is triggered:

```
SecurityAutomationService._trigger_security_assessment()
    │
    └─→ AssessmentService.create_assignment()
        │
        ├─→ Creates AssessmentAssignment
        ├─→ Links to vendor
        ├─→ Sets due date
        └─→ Notifies vendor (via email/in-app)
            │
            └─→ Vendor receives assessment
                │
                └─→ Vendor completes assessment
                    │
                    └─→ Assessment reviewed
                        │
                        └─→ Risk qualification updated
```

### Workflow Integration

When a security incident is detected and workflow is triggered:

```
SecurityAutomationService._start_security_workflow()
    │
    └─→ WorkflowService.start_workflow()
        │
        ├─→ Creates WorkflowInstance
        ├─→ Links to vendor
        ├─→ Sets workflow context (incident details)
        └─→ Starts workflow steps
            │
            ├─→ Step 1: Security Review
            ├─→ Step 2: Compliance Review
            ├─→ Step 3: Risk Assessment
            └─→ Step 4: Approval/Decision
```

### Alert Integration

Alerts are sent through configured channels:

```
SecurityAutomationService._send_security_alert()
    │
    ├─→ Creates SecurityAlert record
    │
    └─→ Sends through channels:
        │
        ├─→ Email (via EmailService)
        │   └─→ Uses Integration API for SMTP config
        │
        ├─→ Slack (via IntegrationService)
        │   └─→ Uses Integration API for Slack config
        │
        ├─→ Teams (via IntegrationService)
        │   └─→ Uses Integration API for Teams config
        │
        └─→ In-App (via MessageService)
            └─→ Creates Message record for users
```

## Configuration Examples

### Example 1: High-Security Tenant

```json
{
  "cve_monitoring_enabled": true,
  "cve_scan_frequency": "hourly",
  "cve_severity_threshold": "low",
  "cve_cvss_threshold": 3.0,
  "breach_monitoring_enabled": true,
  "breach_scan_frequency": "hourly",
  "auto_create_tasks": true,
  "auto_send_alerts": true,
  "auto_trigger_assessments": true,
  "auto_start_workflows": true,
  "alert_recipients": ["security_reviewer", "compliance_reviewer", "tenant_admin"],
  "alert_channels": ["email", "slack", "teams", "in_app"]
}
```

### Example 2: Standard Tenant

```json
{
  "cve_monitoring_enabled": true,
  "cve_scan_frequency": "daily",
  "cve_severity_threshold": "medium",
  "cve_cvss_threshold": 5.0,
  "breach_monitoring_enabled": true,
  "breach_scan_frequency": "daily",
  "auto_create_tasks": true,
  "auto_send_alerts": true,
  "auto_trigger_assessments": true,
  "auto_start_workflows": false,
  "alert_recipients": ["security_reviewer"],
  "alert_channels": ["email", "in_app"]
}
```

### Example 3: Minimal Monitoring

```json
{
  "cve_monitoring_enabled": true,
  "cve_scan_frequency": "weekly",
  "cve_severity_threshold": "high",
  "cve_cvss_threshold": 7.0,
  "breach_monitoring_enabled": false,
  "auto_create_tasks": true,
  "auto_send_alerts": false,
  "auto_trigger_assessments": false,
  "auto_start_workflows": false,
  "alert_recipients": ["tenant_admin"],
  "alert_channels": ["email"]
}
```

