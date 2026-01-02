# Ecosystem Map - Breach Information Visualization

## Overview

This document describes the implementation of breach and security incident visualization in the Ecosystem Map for vendors.

## Changes Made

### 1. Backend API Updates (`backend/app/api/v1/analytics.py`)

Added security incident/breach information to vendor nodes in the ecosystem map API response:

```python
# Security incident/breach information added to vendor metadata
metadata = {
    # ... existing fields ...
    "security_incidents": security_incidents,  # List of security incidents
    "breach_count": breach_count,              # Number of data breaches
    "cve_count": cve_count,                    # Number of CVEs
    "has_critical_incidents": has_critical_incidents,  # Boolean
    "has_active_breaches": has_active_breaches,        # Boolean
    "latest_incident_date": latest_incident_date,      # ISO date string
    "security_status": "clean" | "monitoring" | "at_risk" | "breached" | "critical"
}
```

**Note**: Currently, this is a placeholder structure. When the security monitoring system is implemented (see `SECURITY_MONITORING_DESIGN.md`), the code will query `VendorSecurityTracking` and `SecurityIncident` models to populate this data.

### 2. Frontend Visual Indicators (`frontend/src/pages/EcosystemMap.tsx`)

#### A. Node Visual Indicators

- **Red Border/Glow**: Vendors with active breaches or critical incidents display a red border with a glow effect
- **Orange Border**: Vendors with monitoring/at-risk status display an orange border
- **Security Badge**: A red circular badge with "!" or "⚠" appears next to vendor labels with security issues

#### B. Vendor Details Panel

Added a new "Security Status" section in the vendor details panel that displays:

1. **Active Breach Alert** (Red)
   - Shows when `has_active_breaches` is true
   - Displays breach count
   - Red background with border

2. **Critical Security Incident Alert** (Orange)
   - Shows when `has_critical_incidents` is true (and no active breaches)
   - Orange background with border

3. **CVE Alert** (Yellow)
   - Shows when `cve_count > 0`
   - Displays CVE count
   - Yellow background with border

4. **Security Status**
   - Displays current security status (clean, monitoring, at_risk, breached, critical)

5. **Recent Incidents List**
   - Shows up to 5 most recent security incidents
   - Displays incident ID, type, severity, and published date
   - Scrollable list for vendors with many incidents

## Visual Design

### Color Scheme

- **Red (#ef4444)**: Active breaches, critical incidents
- **Orange (#f59e0b)**: Monitoring, at-risk status
- **Yellow (#fbbf24)**: CVEs detected
- **Green (#10b981)**: Clean status (default vendor color)

### Node Styling

- **Normal Vendor**: Green circle with white border
- **Vendor with Breaches**: Green circle with red border (4-5px) and red glow effect
- **Vendor at Risk**: Green circle with orange border (3px)
- **Security Badge**: Red circle with white "!" or "⚠" icon next to label

## Implementation Details

### SVG Glow Filter

Added an SVG filter definition for the glow effect on nodes with security issues:

```xml
<filter id="glow">
  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

### Badge Calculation

The security badge is positioned dynamically based on the estimated text width of the vendor label:

```typescript
const estimatedTextWidth = displayLabel.length * 7 // 7px per character
const badgeX = labelX + estimatedTextWidth + 8 // 8px padding
```

## Future Integration

When the security monitoring system is implemented, the backend code should:

1. Query `VendorSecurityTracking` for each vendor:
   ```python
   vendor_trackings = db.query(VendorSecurityTracking).filter(
       VendorSecurityTracking.vendor_id == vendor.id,
       VendorSecurityTracking.tenant_id == tenant_id,
       VendorSecurityTracking.status.in_(['monitoring', 'at_risk', 'breached'])
   ).all()
   ```

2. Query `SecurityIncident` for each tracking:
   ```python
   for tracking in vendor_trackings:
       incident = db.query(SecurityIncident).filter(
           SecurityIncident.id == tracking.incident_id
       ).first()
   ```

3. Populate the security incident data structure as shown in the placeholder comments.

## User Experience

### Visual Feedback

- Users can immediately see which vendors have security issues by the red/orange borders
- The security badge provides a quick visual indicator even when nodes are small
- Hovering over a vendor node shows the same visual indicators

### Detailed Information

- Clicking on a vendor node opens the details panel
- The Security Status section provides comprehensive information about:
  - Number of breaches and CVEs
  - Severity of incidents
  - Recent incident history
  - Overall security status

## Testing

To test the visualization:

1. **With Real Data** (after security monitoring is implemented):
   - Create security incidents for vendors
   - Verify red borders appear on affected vendor nodes
   - Verify security badges appear next to vendor labels
   - Verify security status section appears in details panel

2. **With Placeholder Data** (current state):
   - The structure is in place but will show empty/zero values
   - Visual indicators will not appear until security incidents are detected

## Related Documentation

- [SECURITY_MONITORING_DESIGN.md](./SECURITY_MONITORING_DESIGN.md) - Complete security monitoring system design
- [SECURITY_MONITORING_WORKFLOW.md](./SECURITY_MONITORING_WORKFLOW.md) - Workflow diagrams
- [SECURITY_MONITORING_SUMMARY.md](./SECURITY_MONITORING_SUMMARY.md) - Quick reference guide

