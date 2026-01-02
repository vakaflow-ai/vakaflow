# Simplified Layout System

## Overview

The layout system has been simplified from **one layout per workflow stage** to **three reusable layout types** that work across all stages. This dramatically reduces configuration complexity while maintaining full flexibility through permissions.

## Layout Types

Instead of creating separate layouts for each workflow stage (new, pending_approval, approved, etc.), we now use **3 layout types**:

1. **`submission`** - For initial submission and resubmission
   - Used for: `new`, `needs_revision` stages
   - Purpose: Forms for vendors/users to submit or resubmit entities

2. **`approver`** - For review and approval
   - Used for: `pending_approval`, `pending_review`, `in_progress` stages
   - Purpose: Views for approvers/reviewers to assess and make decisions

3. **`completed`** - For final states
   - Used for: `approved`, `rejected`, `closed`, `cancelled` stages
   - Purpose: Read-only views of completed items

## How It Works

### Stage to Layout Type Mapping

The system automatically maps workflow stages to layout types:

```python
# From app/services/layout_type_mapper.py
STAGE_TO_LAYOUT_TYPE = {
    "new": "submission",
    "needs_revision": "submission",
    "pending_approval": "approver",
    "pending_review": "approver",
    "in_progress": "approver",
    "approved": "completed",
    "rejected": "completed",
    "closed": "completed",
    "cancelled": "completed",
}
```

### Permission-Based Visibility

**Permissions control what users see**, not separate layouts. The same layout is used for all stages of a given type, but:

- **Field visibility** is controlled by role permissions in Entity and Fields Catalog
- **Field editability** is controlled by role permissions and workflow stage
- **Section visibility** is automatically filtered based on field permissions

### Example

Instead of creating:
- "Agent Submission Layout - New"
- "Agent Submission Layout - Needs Revision"
- "Agent Approver Layout - Pending Approval"
- "Agent Approver Layout - Pending Review"
- "Agent Approver Layout - In Progress"
- "Agent Completed Layout - Approved"
- "Agent Completed Layout - Rejected"
- etc. (17+ layouts!)

You now create just **3 layouts per request type**:
- "Submission Layout - Agent Onboarding Workflow"
- "Approver Layout - Agent Onboarding Workflow"
- "Completed Items Layout - Agent Onboarding Workflow"

## Benefits

1. **Reduced Configuration**: 3 layouts instead of 17+ per request type
2. **Easier Maintenance**: Update one layout, affects all related stages
3. **Permission-Driven**: Visibility controlled by permissions, not layout duplication
4. **Ready to Run**: System works out of the box with minimal setup
5. **No Professional Services**: Business users can configure without technical help

## Database Schema

### FormLayout Model

```python
class FormLayout(Base):
    # ... existing fields ...
    workflow_stage = Column(String(50), nullable=False)  # DEPRECATED: kept for backward compatibility
    layout_type = Column(String(50), nullable=True)  # NEW: submission, approver, completed
    # ... other fields ...
```

### Migration

The `add_layout_type_to_form_layouts` migration:
1. Adds `layout_type` column to `form_layouts` table
2. Creates index for faster lookups
3. Populates `layout_type` based on existing `workflow_stage` values

## API Changes

### Layout Retrieval

The `get_active_layout_for_stage` endpoint now:
1. Maps `workflow_stage` to `layout_type` using `get_layout_type_for_stage()`
2. Tries to find layout by `layout_type` first (new simplified system)
3. Falls back to `workflow_stage` lookup (backward compatibility)

### Request/Response Models

- `FormLayoutCreate`: Added optional `layout_type` field
- `FormLayoutUpdate`: Added optional `layout_type` field
- `FormLayoutResponse`: Added `layout_type` field

## Seeding Simplified Layouts

The new `seed_simplified_layouts.py` script creates only **3 layouts per request type**:

```python
# For each request_type (agent_onboarding_workflow, vendor_submission_workflow):
# - Submission Layout
# - Approver Layout
# - Completed Items Layout
```

Run the seed script:
```bash
cd backend
python scripts/seed_simplified_layouts.py
```

## Backward Compatibility

The system maintains backward compatibility:
- Existing layouts with `workflow_stage` still work
- API falls back to `workflow_stage` lookup if no `layout_type` layout found
- `workflow_stage` column is kept (marked as DEPRECATED)

## Migration Path

1. **Run migration**: `alembic upgrade head` (adds `layout_type` column)
2. **Seed simplified layouts**: `python scripts/seed_simplified_layouts.py`
3. **Update existing layouts** (optional): Set `layout_type` on existing layouts
4. **Test**: Verify layouts work correctly for all workflow stages

## Permissions Integration

The simplified layout system works seamlessly with the permission system:

1. **Entity-level permissions** (baseline) - set in Entity and Fields Catalog
2. **Field-level permissions** (overrides) - set in Entity and Fields Catalog
3. **Layout-specific overrides** (highest precedence) - set in FormFieldAccess

Permissions automatically filter fields and sections based on:
- User's role
- Current workflow stage
- Entity type
- Field source (entity, custom field, submission requirement)

## Example: Agent Onboarding Workflow

### Before (17 layouts):
- Agent Submission - New
- Agent Submission - Needs Revision
- Agent Approver - Pending Approval
- Agent Approver - Pending Review
- Agent Approver - In Progress
- Agent Completed - Approved
- Agent Completed - Rejected
- Agent Completed - Closed
- Agent Completed - Cancelled
- ... (plus variations for different agent types)

### After (3 layouts):
- **Submission Layout** - Used for `new` and `needs_revision` stages
- **Approver Layout** - Used for `pending_approval`, `pending_review`, `in_progress` stages
- **Completed Layout** - Used for `approved`, `rejected`, `closed`, `cancelled` stages

Permissions control what each role sees in each layout, eliminating the need for separate layouts per stage.

