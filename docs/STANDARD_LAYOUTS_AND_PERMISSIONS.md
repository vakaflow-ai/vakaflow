# Standard Layouts and Permissions

## Overview

Standard form layouts and entity-level permissions have been seeded for all tenants to ensure:
- **Approver views** are properly configured for all workflow stages
- **Role-based permissions** are set up for reviewers, approvers, and other roles
- **Consistent experience** across all tenants

---

## Standard Layouts Created

### For Each Request Type:
- `agent_onboarding_workflow`
- `vendor_submission_workflow`

### For Each Workflow Stage:

#### 1. **Submission Form** (`new` stage)
- **Purpose**: Initial submission by vendor/user
- **Sections**:
  - Basic Information (name, type, category, description, version)
  - AI Configuration (LLM vendor, model, deployment type)
  - Capabilities & Use Cases
  - Data & Operations (data types, regions, sharing scope)
  - Architecture & Connections

#### 2. **Approver Review** (`pending_approval` stage)
- **Purpose**: Layout for approvers to review and make decisions
- **Sections**:
  - Overview (quick summary with status)
  - Basic Information
  - AI Configuration
  - Security & Compliance
  - Data & Operations
  - Capabilities & Use Cases
  - Architecture & Connections
  - Review & Decision (review notes, approval notes, rejection reason)

#### 3. **Review** (`pending_review` stage)
- **Purpose**: Layout for reviewers to assess submissions
- **Sections**:
  - Overview
  - Basic Information
  - Security & Compliance
  - Review Notes

#### 4. **Revision Required** (`needs_revision` stage)
- **Purpose**: Layout for resubmission after revision request
- **Sections**:
  - Revision Request (what needs to be revised)
  - Basic Information
  - AI Configuration
  - Data & Operations

#### 5. **Approved** (`approved` stage)
- **Purpose**: View for approved submissions
- **Sections**:
  - Overview (with approval details)
  - Basic Information
  - AI Configuration

#### 6. **Rejected** (`rejected` stage)
- **Purpose**: View for rejected submissions
- **Sections**:
  - Overview (with rejection details)
  - Basic Information

#### 7. **In Progress** (`in_progress` stage)
- **Purpose**: View for submissions being processed
- **Sections**:
  - Overview (with current step)
  - Basic Information

#### 8. **Closed** (`closed` stage)
- **Purpose**: View for closed/completed submissions
- **Sections**:
  - Overview (with closure details)
  - Basic Information

---

## Entity-Level Permissions

### Default Permissions by Entity:

#### **Agents** Entity:
- **tenant_admin**: view + edit
- **platform_admin**: view + edit
- **policy_admin**: view + edit
- **integration_admin**: view + edit
- **user_admin**: view + edit
- **security_reviewer**: view + edit (can edit during review)
- **compliance_reviewer**: view + edit (can edit during review)
- **technical_reviewer**: view + edit (can edit during review)
- **business_reviewer**: view + edit (can edit during review)
- **approver**: view + edit (can approve/reject)
- **vendor_user**: view only (cannot edit after submission)
- **end_user**: view only

#### **Vendors** Entity:
- **tenant_admin**: view + edit
- **platform_admin**: view + edit
- **policy_admin**: view + edit
- **integration_admin**: view + edit
- **user_admin**: view + edit
- **security_reviewer**: view only
- **compliance_reviewer**: view only
- **technical_reviewer**: view only
- **business_reviewer**: view only
- **approver**: view only
- **vendor_user**: view + edit (can edit their own vendor)
- **end_user**: view only

#### **Assessments** Entity:
- **tenant_admin**: view + edit
- **platform_admin**: view + edit
- **policy_admin**: view + edit
- **security_reviewer**: view + edit
- **compliance_reviewer**: view + edit
- **vendor_user**: view only
- **end_user**: view only

#### **Users** Entity:
- **tenant_admin**: view + edit
- **platform_admin**: view + edit
- **user_admin**: view + edit
- **vendor_user**: no access (can't view other users)
- **end_user**: no access (can't view other users)

---

## How It Works

### Automatic View Generation

When a user accesses a workflow stage, the system:

1. **Determines Layout**: Gets the layout for the current workflow stage
   ```
   GET /api/v1/form-layouts/request-type/{request_type}/workflow-stage/{workflow_stage}/active
   ```

2. **Resolves Permissions**: Uses hierarchical permission resolution
   - Entity-level permissions (baseline)
   - Field-level permissions (override)
   - Layout-level permissions (override)

3. **Generates View**: Auto-generates tabs/sections from layout
   - Sections become tabs
   - Fields filtered by permissions
   - Input components rendered based on field type

### Example: Approver View

When an approver views an agent at `pending_approval` stage:

1. System loads: `Standard Agent Onboarding Workflow - Approver Review` layout
2. System resolves permissions for `approver` role:
   - Entity-level: `agents` → `approver`: view + edit ✅
   - Field-level: (any overrides)
   - Layout-level: (any overrides)
3. System generates view with 8 sections (tabs):
   - Overview
   - Basic Information
   - AI Configuration
   - Security & Compliance
   - Data & Operations
   - Capabilities & Use Cases
   - Architecture & Connections
   - Review & Decision
4. Approver can:
   - View all fields
   - Edit fields (based on permissions)
   - Add review notes
   - Approve/Reject

---

## Customization

### Modifying Layouts

Layouts can be customized via:
- **Screen Designer** (`/admin/screen-designer`)
- Edit existing layouts or create new ones
- Set as default for specific stages

### Modifying Permissions

Permissions can be customized via:
- **Entity and Fields Catalog** (`/admin/custom-fields`)
- Edit entity-level permissions
- Override field-level permissions
- Configure role-based access

---

## Seed Scripts

### Seed Standard Layouts
```bash
# For all tenants
python backend/scripts/seed_standard_layouts.py

# For specific tenant
python backend/scripts/seed_standard_layouts.py --tenant-id <tenant-id>
```

### Seed Entity Permissions
```bash
# For all tenants
python backend/scripts/seed_default_entity_permissions.py

# For specific tenant
python backend/scripts/seed_default_entity_permissions.py --tenant-id <tenant-id>
```

---

## Summary

✅ **Standard layouts created** for all workflow stages:
- Submission forms (`new`)
- Approver reviews (`pending_approval`)
- Reviews (`pending_review`)
- Revisions (`needs_revision`)
- Final states (`approved`, `rejected`, `closed`, `in_progress`)

✅ **Entity-level permissions configured** for:
- All approver roles (security_reviewer, compliance_reviewer, technical_reviewer, business_reviewer, approver)
- Admin roles (tenant_admin, platform_admin, etc.)
- User roles (vendor_user, end_user)

✅ **Automatic view generation** works out of the box:
- Layouts determine structure
- Permissions determine visibility/editability
- No hardcoding required

The system is now ready to automatically generate approver views and handle role-based access control!

