# Generic Workflow Framework Architecture

## Overview

This document describes a **generic, configuration-driven workflow system** where:
- **Entities** (agents, vendors, assessments, etc.) are treated as workflow processes
- **Views and forms** are automatically generated based on configuration
- **No hardcoding** - everything is driven by permissions, layouts, and workflow stages
- **Future-proof** - can load any workflow/process/entity without code changes

---

## Core Principles

### 1. **Entity = Workflow Process**
Any database entity can be treated as a workflow process:
- **Agents** → Agent Onboarding Workflow
- **Vendors** → Vendor Submission Workflow  
- **Assessments** → Assessment Review Workflow
- **Incidents** → Incident Management Workflow
- **Any future entity** → Automatically supported

### 2. **Configuration-Driven, Not Code-Driven**
Everything is determined by configuration:
- **Entity Fields** → Discovered from `EntityFieldRegistry`
- **Permissions** → Hierarchical (Entity → Field → Layout)
- **Layouts** → Defined in `FormLayout` (sections, fields, order)
- **Workflow Stages** → Defined in `WorkflowConfiguration`
- **Views** → Auto-generated from layouts + permissions

### 3. **Automatic View Generation**
Views are **automatically generated** based on:
- **User's Role** → Determines what they can see/edit
- **Permissions** → Hierarchical resolution (Entity baseline → Field override → Layout override)
- **Layouts** → Organizes fields into sections/tabs
- **Workflow Stage** → Determines which layout to use
- **Entity State** → Current stage of the workflow

**No hardcoding of tabs, sections, or fields!**

---

## Architecture Components

### 1. Entity Discovery (`EntityFieldRegistry`)

**Purpose**: Automatically discover all fields for any entity

```python
# All entities are auto-discovered
EntityFieldRegistry:
  - entity_name: "agents" | "vendors" | "assessments" | ...
  - field_name: "name" | "type" | "status" | ...
  - field_label: "Agent Name" | "Vendor Type" | ...
  - field_type: "text" | "select" | "textarea" | ...
  - is_enabled: true/false
  - is_required: true/false
```

**Benefits**:
- New entities automatically supported
- No code changes needed
- Fields auto-discovered from database schema

### 2. Hierarchical Permissions

**Purpose**: Define who can see/edit what at different levels

```
Level 1: Entity-Level Permissions (Baseline)
  └─> EntityPermission.role_permissions
      Example: All "agents" fields → tenant_admin: view+edit, vendor_user: view-only

Level 2: Field-Level Permissions (Override)
  └─> EntityFieldPermission.role_permissions
      Example: "agents.status" → vendor_user: view+edit (override)

Level 3: Layout-Level Permissions (Override)
  └─> FormFieldAccess.role_permissions
      Example: "agents.status" in "pending_approval" stage → vendor_user: view-only (override)
```

**Resolution Flow**:
```
1. Start with Entity-Level (baseline)
2. Merge Field-Level overrides
3. Merge Layout-Level overrides (most specific wins)
4. Final resolved permissions
```

### 3. Layout Configuration (`FormLayout`)

**Purpose**: Organize fields into sections/tabs for different workflow stages

```python
FormLayout:
  - request_type: "agent_onboarding_workflow" | "vendor_submission_workflow" | ...
  - workflow_stage: "new" | "pending_approval" | "approved" | ...
  - sections: [
      {
        "id": "basic-info",
        "title": "Basic Information",
        "order": 1,
        "fields": ["name", "type", "category"]
      },
      {
        "id": "security",
        "title": "Security Details",
        "order": 2,
        "fields": ["llm_vendor", "data_types", "regions"]
      }
    ]
```

**Benefits**:
- Different layouts for different stages
- Sections become tabs/sections in UI
- Fields organized logically
- No hardcoding of UI structure

### 4. Workflow Orchestration (`WorkflowConfiguration`)

**Purpose**: Define workflow process and stage transitions

```python
WorkflowConfiguration:
  - name: "Agent Onboarding Workflow"
  - workflow_steps: [
      {
        "step_number": 1,
        "step_type": "review",
        "step_name": "Security Review",
        "workflow_stage": "pending_approval",
        "assigned_role": "security_reviewer",
        "form_layout_id": "layout-id-for-security-review"
      },
      {
        "step_number": 2,
        "step_type": "review",
        "step_name": "Compliance Review",
        "workflow_stage": "pending_review",
        "assigned_role": "compliance_reviewer",
        "form_layout_id": "layout-id-for-compliance-review"
      }
    ]
```

---

## Automatic View Generation

### Submission Form (Vendor/User View)

**Flow**:
```
1. User initiates workflow (e.g., submit agent)
   └─> Entity created with workflow_stage = "new"

2. System determines layout:
   └─> GET /api/v1/form-layouts/request-type/{request_type}/workflow-stage/new/active
   └─> Returns layout for "new" stage

3. System resolves permissions:
   └─> resolve_field_permissions(
         entity_name="agents",
         field_name="name",
         request_type="agent_onboarding_workflow",
         workflow_stage="new",
         role="vendor_user"
       )
   └─> Returns: { "view": true, "edit": true }

4. System renders form:
   └─> Iterate through layout.sections
   └─> For each field in section:
       ├─> Check permission.view → Show/Hide
       ├─> Check permission.edit → Editable/Read-only
       └─> Render appropriate input component
```

**Result**: Form automatically rendered with correct fields, sections, and permissions!

### Approver View (Reviewer/Admin View)

**Flow**:
```
1. Workflow moves to "pending_approval" stage
   └─> Entity.workflow_stage = "pending_approval"

2. System determines layout:
   └─> GET /api/v1/form-layouts/request-type/{request_type}/workflow-stage/pending_approval/active
   └─> Returns layout for "pending_approval" stage

3. System resolves permissions for approver role:
   └─> resolve_field_permissions(
         entity_name="agents",
         field_name="name",
         request_type="agent_onboarding_workflow",
         workflow_stage="pending_approval",
         role="security_reviewer"  // Approver's role
       )
   └─> Returns: { "view": true, "edit": true }  // Approver can edit

4. System renders approver view:
   └─> Iterate through layout.sections (becomes tabs/sections)
   └─> For each field:
       ├─> Check permission.view → Show/Hide
       ├─> Check permission.edit → Editable/Read-only
       ├─> Show approval actions (Approve/Reject/Request Revision)
       └─> Render appropriate input component
```

**Result**: Approver view automatically rendered with correct fields, sections, permissions, and actions!

---

## Key Benefits

### ✅ **No Hardcoding**
- Tabs/sections auto-generated from layouts
- Fields auto-filtered by permissions
- Views auto-adjusted by role and stage
- No need to recode for each new entity

### ✅ **Generic & Extensible**
- Add new entity → Auto-discovered via `EntityFieldRegistry`
- Add new workflow → Configure in `WorkflowConfiguration`
- Add new stage → Create layout for that stage
- Add new role → Set permissions in hierarchy

### ✅ **Consistent Experience**
- Same framework for all entities
- Same permission model everywhere
- Same layout system everywhere
- Same workflow orchestration everywhere

### ✅ **Configuration-Driven**
- Admins configure workflows via UI
- No developer needed for new workflows
- Changes take effect immediately
- No code deployment needed

---

## Implementation Flow

### For Any Entity/Workflow:

```
1. Entity Created
   └─> EntityFieldRegistry auto-discovers fields
   └─> EntityPermission sets baseline permissions
   └─> WorkflowConfiguration determines workflow

2. User Views Entity
   └─> System determines current workflow_stage
   └─> System loads layout for that stage
   └─> System resolves permissions for user's role
   └─> System renders view automatically

3. User Submits/Approves
   └─> System validates based on permissions
   └─> System updates entity state
   └─> System moves to next workflow stage
   └─> System loads new layout for new stage
   └─> System renders new view automatically
```

---

## API Endpoints (Generic)

### Get Layout for Stage
```
GET /api/v1/form-layouts/request-type/{request_type}/workflow-stage/{workflow_stage}/active
```
Returns layout for specific workflow stage (auto-determines which layout to use)

### Get Fields with Permissions
```
GET /api/v1/form-layouts/request-type/{request_type}/fields-with-access
  ?workflow_stage={stage}
  &role={user_role}
```
Returns all fields with resolved permissions (hierarchical resolution)

### Resolve Permissions
```
POST /api/v1/permissions/resolve
{
  "entity_name": "agents",
  "field_name": "name",
  "request_type": "agent_onboarding_workflow",
  "workflow_stage": "pending_approval",
  "role": "security_reviewer"
}
```
Returns resolved permissions (Entity → Field → Layout hierarchy)

---

## Example: Adding New Entity "Contracts"

### Step 1: Entity Auto-Discovery
```python
# System automatically discovers "contracts" entity
EntityFieldRegistry:
  - entity_name: "contracts"
  - fields: ["contract_id", "vendor_id", "start_date", "end_date", "terms", ...]
```

### Step 2: Set Entity Permissions
```python
# Admin sets baseline permissions
EntityPermission:
  entity_name: "contracts"
  role_permissions: {
    "tenant_admin": {"view": true, "edit": true},
    "vendor_user": {"view": true, "edit": false}
  }
```

### Step 3: Create Layouts
```python
# Admin creates layouts for different stages
FormLayout:
  - request_type: "contract_review_workflow"
  - workflow_stage: "new"
  - sections: [
      {"title": "Contract Details", "fields": ["contract_id", "vendor_id", ...]},
      {"title": "Terms", "fields": ["start_date", "end_date", "terms", ...]}
    ]
```

### Step 4: Configure Workflow
```python
# Admin configures workflow
WorkflowConfiguration:
  - name: "Contract Review Workflow"
  - workflow_steps: [
      {"step_name": "Initial Review", "workflow_stage": "new", ...},
      {"step_name": "Legal Review", "workflow_stage": "pending_approval", ...}
    ]
```

### Step 5: System Auto-Generates Views
- ✅ Submission form automatically rendered
- ✅ Approver view automatically rendered
- ✅ All permissions automatically applied
- ✅ All layouts automatically used
- ✅ No code changes needed!

---

## Summary

### What You Described:
1. **Entity/Process as Workflow** → ✅ Supported via `EntityFieldRegistry` + `WorkflowConfiguration`
2. **Generic Framework** → ✅ Configuration-driven, no hardcoding
3. **Automatic View Generation** → ✅ Based on permissions + layouts + workflow stage
4. **No Manual Configuration** → ✅ Views adjust automatically based on role, permissions, layouts
5. **Future-Proof** → ✅ New entities/workflows automatically supported

### Current State:
- ✅ Entity discovery system (`EntityFieldRegistry`)
- ✅ Hierarchical permissions (`EntityPermission` → `EntityFieldPermission` → `FormFieldAccess`)
- ✅ Layout system (`FormLayout` with sections)
- ✅ Workflow orchestration (`WorkflowConfiguration`)
- ✅ Permission resolution service (`permission_resolution.py`)

### What's Needed:
1. **Generic View Renderer** → Auto-generate tabs/sections from layouts
2. **Workflow Engine Integration** → Wire layouts to workflow stages
3. **Dynamic Form Component** → Enhanced to use hierarchical permissions
4. **Approval Interface** → Auto-generate from layouts + permissions

---

## Next Steps

1. **Enhance Dynamic Form Component** to use hierarchical permission resolution
2. **Create Generic View Renderer** that auto-generates tabs/sections from layouts
3. **Wire Workflow Engine** to automatically load layouts based on workflow stage
4. **Update Approval Interface** to use automatic view generation
5. **Create Admin UI** for configuring workflows without code changes

This framework ensures that **any entity can become a workflow process** with **automatic view generation** based on **configuration only** - no hardcoding required!

