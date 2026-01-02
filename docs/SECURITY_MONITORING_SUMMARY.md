# Security Monitoring & CVE Tracking - Summary

## Overview

This system provides automated security monitoring for vendors, tracking CVEs (Common Vulnerabilities and Exposures), data breaches, and security alerts. When a vendor is found in a security incident, the system automatically:

1. **Generates Risk Qualification Tasks** - Creates tasks for security reviewers to assess the risk
2. **Raises Alerts** - Sends alerts to security/compliance teams via email, Slack, Teams, and in-app notifications
3. **Triggers Assessments** - Automatically assigns security assessments to affected vendors
4. **Starts TPRM/VRM/Risk Processes** - Initiates risk management workflows

## Key Components

### 1. Database Models

- **SecurityIncident** - Stores CVEs, breaches, and security alerts
- **VendorSecurityTracking** - Links vendors to security incidents with match confidence
- **SecurityMonitoringConfig** - Tenant-specific monitoring configuration
- **SecurityAlert** - Alerts sent to users/teams

### 2. Services

- **CVEScannerService** - Scans NVD and CVE.org for new CVEs
- **BreachMonitorService** - Monitors data breach databases (HaveIBeenPwned, etc.)
- **VendorMatchingService** - Matches security incidents to vendors using name, domain, product matching
- **SecurityAutomationService** - Automates task creation, alerts, assessments, and workflows
- **SecurityMonitoringScheduler** - Runs periodic scans and triggers automated actions

### 3. API Endpoints

- `/api/v1/security-incidents` - Manage security incidents
- `/api/v1/vendors/{id}/security` - View vendor security tracking
- `/api/v1/security-monitoring/config` - Configure monitoring settings
- `/api/v1/security-alerts` - View and manage alerts

## Quick Start Implementation Guide

### Phase 1: Database Models (Priority: High)

1. Create migration for `security_incidents` table
2. Create migration for `vendor_security_tracking` table
3. Create migration for `security_monitoring_configs` table
4. Create migration for `security_alerts` table

### Phase 2: Core Services (Priority: High)

1. Implement `SecurityIncidentService` - Basic CRUD operations
2. Implement `VendorMatchingService` - Basic name/domain matching
3. Implement `SecurityAutomationService` - Task creation and alerts

### Phase 3: CVE Scanning (Priority: High)

1. Integrate NVD API client
2. Implement `CVEScannerService`
3. Create scheduled job for daily CVE scans
4. Test with real CVE data

### Phase 4: Breach Monitoring (Priority: Medium)

1. Integrate HaveIBeenPwned API client
2. Implement `BreachMonitorService`
3. Create scheduled job for daily breach scans

### Phase 5: Automation (Priority: High)

1. Implement task generation
2. Implement alert system (email, in-app)
3. Implement assessment triggering
4. Implement workflow integration

### Phase 6: API & Frontend (Priority: Medium)

1. Create API endpoints
2. Build security monitoring dashboard
3. Build vendor security view
4. Build configuration UI

## Key Features

### 1. Automated CVE Tracking

- Scans NVD and CVE.org daily/hourly (configurable)
- Filters by CVSS score and severity threshold
- Automatically matches CVEs to vendors
- Creates incidents with full CVE details

### 2. Breach Detection

- Monitors multiple breach databases
- Matches breaches to vendors by name/domain
- High-confidence matches trigger immediate alerts

### 3. Intelligent Vendor Matching

- **Exact Name Match** - Highest confidence
- **Domain Match** - High confidence
- **Product/Software Match** - Medium confidence
- **Fuzzy Name Match** - Lower confidence (configurable threshold)
- **Match Confidence Score** - 0.0 to 1.0

### 4. Automated Response

- **Task Generation** - Creates risk qualification tasks
- **Multi-Channel Alerts** - Email, Slack, Teams, In-App
- **Assessment Triggering** - Assigns security assessments
- **Workflow Initiation** - Starts TPRM/VRM/Risk processes

### 5. Risk Qualification

- Security reviewers assess vendor risk
- Update risk level (low/medium/high/critical)
- Document impact analysis
- Recommend actions
- Mark incidents as resolved/false positive

## Configuration Options

### Monitoring Settings

- **CVE Monitoring**: Enable/disable, scan frequency, severity threshold, CVSS threshold
- **Breach Monitoring**: Enable/disable, scan frequency, data sources
- **Auto-Actions**: Enable/disable task creation, alerts, assessments, workflows

### Alert Configuration

- **Recipients**: Users, roles, or teams
- **Channels**: Email, Slack, Teams, In-App
- **Severity Mapping**: Map incident severity to alert priority

### Assessment & Workflow

- **Default Assessment**: Select assessment to auto-assign
- **Default Workflow**: Select workflow to auto-start
- **Due Dates**: Configure default due dates

## Integration Points

### External APIs

1. **NVD API** - National Vulnerability Database
   - Endpoint: `https://services.nvd.nist.gov/rest/json/cves/2.0`
   - Rate Limit: 50 requests per 30 seconds (with API key)

2. **CVE.org API** - CVE database
   - Endpoint: `https://cveawg.mitre.org/api/cve`
   - Rate Limit: Varies

3. **HaveIBeenPwned API** - Data breach database
   - Endpoint: `https://haveibeenpwned.com/api/v3`
   - Rate Limit: 1 request per 1.5 seconds (free tier)

### Internal Integrations

1. **ActionItem System** - For task creation
2. **Assessment System** - For assessment triggering
3. **Workflow System** - For TPRM/VRM/Risk processes
4. **Email Service** - For email alerts (via Integration API)
5. **Integration Service** - For Slack/Teams alerts (via Integration API)
6. **Message Service** - For in-app notifications

## Security Considerations

1. **Tenant Isolation** - All data must be tenant-isolated
2. **API Rate Limiting** - Respect external API rate limits
3. **Data Privacy** - Secure handling of vendor data
4. **Access Control** - Only authorized users can view/configure
5. **Audit Logging** - Log all monitoring activities

## Example Use Cases

### Use Case 1: CVE Detected for Vendor Product

1. CVE published in NVD (CVE-2024-12345)
2. System scans and creates SecurityIncident
3. Vendor matching finds vendor "Acme Corp" (product match)
4. System creates:
   - Task: "Risk Qualification: Acme Corp - CVE-2024-12345"
   - Alert: Sent to security team
   - Assessment: "Security Risk Assessment" assigned to Acme Corp
   - Workflow: TPRM workflow started
5. Security reviewer qualifies risk and takes action

### Use Case 2: Vendor Data Breach Detected

1. Breach detected in HaveIBeenPwned for "acme.com"
2. System creates SecurityIncident (type: data_breach)
3. Vendor matching finds vendor "Acme Corp" (domain match, high confidence)
4. System creates:
   - Task: "URGENT: Data Breach - Acme Corp" (URGENT priority)
   - Alert: CRITICAL alert to all security/compliance team
   - Assessment: "Breach Impact Assessment" (7-day due date)
   - Workflow: VRM Breach Response workflow
5. Immediate action required from vendor

### Use Case 3: False Positive Resolution

1. Security incident matched to vendor (low confidence)
2. Security reviewer reviews and determines false positive
3. Reviewer marks incident as resolved (resolution_type: "false_positive")
4. System updates VendorSecurityTracking status
5. No further action required

## Metrics & Reporting

### Dashboard Metrics

- Total security incidents (by type, severity)
- Vendors at risk count
- Pending risk qualifications
- Resolved incidents
- Average time to resolution

### Vendor Security Report

- Security incidents for vendor
- Risk qualification status
- Assessment completion status
- Workflow progress
- Historical trends

## Future Enhancements

1. **Machine Learning Matching** - Improve vendor matching accuracy
2. **Custom Data Sources** - Allow tenants to add custom security feeds
3. **Advanced Risk Scoring** - Multi-factor risk calculation
4. **Predictive Analytics** - Predict vendors likely to have issues
5. **SIEM Integration** - Integrate with Security Information and Event Management
6. **Compliance Mapping** - Map incidents to compliance requirements

## Related Documentation

- [SECURITY_MONITORING_DESIGN.md](./SECURITY_MONITORING_DESIGN.md) - Detailed design document
- [SECURITY_MONITORING_WORKFLOW.md](./SECURITY_MONITORING_WORKFLOW.md) - Workflow diagrams
- [TPRM_EMAIL_INTEGRATION.md](./TPRM_EMAIL_INTEGRATION.md) - Email integration guide
- [INTEGRATIONS_EMAIL_FIX.md](./INTEGRATIONS_EMAIL_FIX.md) - Integration architecture

## Questions & Support

For questions about this design, please refer to:
- Design document: `docs/SECURITY_MONITORING_DESIGN.md`
- Workflow diagrams: `docs/SECURITY_MONITORING_WORKFLOW.md`
- Integration standards: `CODING_STANDARDS.md`

