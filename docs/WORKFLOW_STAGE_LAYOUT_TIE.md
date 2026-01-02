# How Form Layouts are Tied to Approver Workflow Stages

## Overview

Form layouts are directly tied to workflow stages through the `workflow_stage` field in the `FormLayout` model. This allows different form configurations to be displayed at different stages of the approval workflow.

## Architecture

### 1. Direct Stage Association

Each `FormLayout` has a `workflow_stage` field that directly associates it with a specific workflow stage:

```python
class FormLayout(Base):
    request_type = Column(String(50), nullable=False)  # e.g., "vendor_submission_workflow"
    workflow_stage = Column(String(50), nullable=False)  # e.g., "pending_approval"
    # ... other fields
```

**Available Workflow Stages:**
- `new` - Initial submission stage (vendor submits form)
- `in_progress` - Work in progress
- `pending_approval` - **Waiting for approver review** (key stage for approvers)
- `pending_review` - Waiting for review
- `needs_revision` - Needs revision/resubmission
- `approved` - Approved state
- `rejected` - Rejected state
- `closed` - Closed/complete state
- `cancelled` - Cancelled state

### 2. Layout Retrieval by Stage

The system retrieves layouts based on workflow stage using this API endpoint:

```
GET /api/v1/form-layouts/request-type/{request_type}/workflow-stage/{workflow_stage}/active
```

**Example:**
```typescript
// Get layout for approver review stage
const approverLayout = await formLayoutsApi.getActiveForScreen(
  'vendor_submission_workflow',
  'pending_approval'  // Workflow stage for approvers
)
```

### 3. Field-Level Access Control by Stage

`FormFieldAccess` also includes `workflow_stage` to control field visibility/editability per stage:

```python
class FormFieldAccess(Base):
    field_name = Column(String(100), nullable=False)
    request_type = Column(String(50), nullable=False)
    workflow_stage = Column(String(50), nullable=False)  # Stage-specific permissions
    role_permissions = Column(JSON, nullable=False)  # {"approver": {"view": true, "edit": true}}
```

## Workflow Flow

### Stage 1: Initial Submission (`new`)

**User:** Vendor/End User  
**Layout:** Submission form layout (`workflow_stage: "new"`)

```typescript
// AgentSubmission.tsx
const layout = await formLayoutsApi.getActiveForScreen(
  'vendor_submission_workflow',
  'new'  // Initial submission stage
)
```

**Fields Shown:**
- All submission fields (name, description, category, etc.)
- LLM configuration
- Data sharing scope
- Capabilities and use cases

### Stage 2: Pending Approval (`pending_approval`)

**User:** Approver/Reviewer  
**Layout:** Approver review form layout (`workflow_stage: "pending_approval"`)

```typescript
// ApprovalInterface.tsx
const approverLayout = await formLayoutsApi.getActiveForScreen(
  'vendor_submission_workflow',
  'pending_approval'  // Approver review stage
)
```

**Fields Shown:**
- Read-only view of submission data
- Approval/rejection notes field
- Review comments
- Compliance checkboxes
- Decision buttons (Approve/Reject)

### Stage 3: Needs Revision (`needs_revision`)

**User:** Vendor (resubmission)  
**Layout:** Revision form layout (`workflow_stage: "needs_revision"`)

**Fields Shown:**
- Editable fields based on revision requirements
- Revision notes from approver
- Updated submission fields

### Stage 4: Approved/Rejected (`approved`/`rejected`)

**User:** All roles (view-only)  
**Layout:** Final state layout (`workflow_stage: "approved"` or `"rejected"`)

**Fields Shown:**
- Read-only view of all data
- Approval/rejection notes
- Final status

## Implementation Example

### Creating an Approver Layout

1. **In Form Designer:**
   - Create a new layout
   - Set `request_type`: `"vendor_submission_workflow"`
   - Set `workflow_stage`: `"pending_approval"`
   - Configure sections with approver-specific fields:
     ```json
     {
       "sections": [
         {
           "id": "review-section",
           "title": "Review Information",
           "order": 1,
           "fields": ["approval_notes", "compliance_check", "risk_assessment"]
         },
         {
           "id": "submission-view",
           "title": "Submission Details (Read-Only)",
           "order": 2,
           "fields": ["name", "description", "category", "llm_vendor"]
         }
       ]
     }
     ```

2. **Configure Field Access:**
   ```python
   # Approver can view all fields, but only edit approval-specific fields
   FormFieldAccess(
       field_name="approval_notes",
       request_type="vendor_submission_workflow",
       workflow_stage="pending_approval",
       role_permissions={
           "approver": {"view": True, "edit": True},
           "vendor_user": {"view": True, "edit": False}
       }
   )
   ```

3. **Activate Layout:**
   ```python
   layout.is_active = True
   layout.is_default = True  # Make it the default for this stage
   ```

### Loading Layout in Approval Interface

```typescript
// ApprovalInterface.tsx
const { data: approverLayout } = useQuery({
  queryKey: ['form-layout', 'vendor_submission_workflow', 'pending_approval', 'active'],
  queryFn: () => formLayoutsApi.getActiveForScreen(
    'vendor_submission_workflow',
    'pending_approval'  // Key: Load layout for approver stage
  )
})

// Render form with approver layout
<DynamicForm
  layout={approverLayout}
  formData={agentData}
  readOnly={true}  // Most fields read-only for approvers
  editableFields={['approval_notes', 'compliance_check']}  // Only these editable
/>
```

## ServiceNow Integration

The `workflow_stage` values map to ServiceNow state values:

```python
servicenow_state_mapping = {
    "new": 1,              # ServiceNow state=1
    "in_progress": 2,      # ServiceNow state=2
    "pending_approval": 3,  # ServiceNow state=3 (approver stage)
    "approved": 4,         # ServiceNow state=4
    "rejected": -1,        # ServiceNow state=-1
    "closed": 7,           # ServiceNow state=7
    "cancelled": -2        # ServiceNow state=-2
}
```

## Best Practices

### 1. Stage-Specific Layouts

Create separate layouts for each workflow stage:
- **Submission Layout** (`workflow_stage: "new"`) - Full form for vendors
- **Approver Layout** (`workflow_stage: "pending_approval"`) - Review form for approvers
- **Revision Layout** (`workflow_stage: "needs_revision"`) - Resubmission form
- **Final Layout** (`workflow_stage: "approved"`) - Read-only view

### 2. Field Access Control

Configure field-level permissions per stage:
```python
# Submission stage: Vendor can edit all fields
FormFieldAccess(
    workflow_stage="new",
    role_permissions={"vendor_user": {"view": True, "edit": True}}
)

# Approval stage: Approver can only edit approval fields
FormFieldAccess(
    workflow_stage="pending_approval",
    role_permissions={"approver": {"view": True, "edit": False}}  # Most fields read-only
)
```

### 3. Default Layouts

Set `is_default=True` for one layout per stage to ensure a fallback:
```python
# Default approver layout
layout.workflow_stage = "pending_approval"
layout.is_default = True
layout.is_active = True
```

## Current Implementation Status

✅ **Implemented:**
- `FormLayout.workflow_stage` field
- API endpoint for stage-based layout retrieval
- `FormFieldAccess.workflow_stage` for field-level permissions
- ServiceNow state mapping support

🔄 **To Be Enhanced:**
- ApprovalInterface should load `pending_approval` layout
- Dynamic form rendering based on stage
- Stage transition logic with layout switching

## Next Steps

1. **Update ApprovalInterface** to load approver layout:
   ```typescript
   const { data: approverLayout } = useQuery({
     queryKey: ['approver-layout', agentId],
     queryFn: () => formLayoutsApi.getActiveForScreen(
       'vendor_submission_workflow',
       'pending_approval'
     )
   })
   ```

2. **Create Approver Layout Templates** in Form Designer:
   - Pre-configured layouts for `pending_approval` stage
   - Include approval notes, compliance checks, risk assessment fields

3. **Implement Stage Transitions**:
   - When agent moves to `pending_approval`, load approver layout
   - When approved/rejected, load final state layout

4. **Field Visibility Logic**:
   - Show/hide fields based on `workflow_stage` and `role_permissions`
   - Apply read-only restrictions based on stage
