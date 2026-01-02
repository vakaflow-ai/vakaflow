# Hierarchical Permission System

## Overview

The platform implements a hierarchical permission system where permissions can be set at root/group level, and all children inherit the same permissions unless explicitly overridden.

## Permission Hierarchy

### 1. Root/Group Level (Baseline)
**Entity-Level Permissions** (`EntityPermission`)
- Set permissions for entire entities (e.g., "agents", "vendors", "users")
- All fields in the entity inherit these permissions by default
- Stored in `entity_permissions` table
- Example: All fields in "agents" entity inherit entity-level permissions

**Category-Level Permissions** (Future)
- Can set permissions for entity categories (e.g., "core", "compliance", "workflow")
- All entities in the category inherit these permissions

### 2. Field Level (Override)
**Entity Field Overrides** (`EntityFieldPermission`)
- Override entity-level permissions for specific fields
- Only stores overrides (empty = inherits from entity)
- Stored in `entity_field_permissions` table

**Custom Field Permissions** (`CustomFieldCatalog.role_permissions`)
- Permissions for custom fields from Entity and Fields Catalog
- Can override entity-level permissions if field belongs to an entity

### 3. Layout Level (Override)
**Form Field Access** (`FormFieldAccess`)
- Override permissions for specific workflows/layouts
- Most specific level - takes highest precedence
- Stored in `form_field_access` table

## Inheritance Rules

1. **Children inherit parent permissions by default**
   - Fields inherit from entity-level permissions
   - If no field override exists, entity permissions apply

2. **Explicit overrides take precedence**
   - Field-level overrides replace inherited permissions
   - Layout-level overrides replace field-level permissions

3. **Empty/null = inherit**
   - If `EntityFieldPermission.role_permissions` is empty/null, inherits from entity
   - If `FormFieldAccess.role_permissions` is empty/null, inherits from field/entity

## Permission Resolution Flow

```
1. Start with Entity-Level Permissions (baseline)
   ↓
2. Merge Field-Level Overrides (if any)
   ↓
3. Merge Layout-Level Overrides (if any)
   ↓
4. Final Resolved Permissions
```

## API Usage

### Get Field Permissions (with inheritance)

```python
GET /api/v1/entity-fields/{entity_name}/{field_name}/permissions?include_inherited=true
```

Returns:
- If `include_inherited=false`: Only field-level overrides (empty if none)
- If `include_inherited=true`: Full resolved permissions (entity baseline + field overrides)

### Resolve Permissions Programmatically

```python
from app.services.permission_resolution import resolve_field_permissions

permissions = resolve_field_permissions(
    db=db,
    tenant_id=tenant_id,
    entity_name="agents",
    field_name="name",
    field_source="entity",
    request_type="vendor_submission_workflow",
    workflow_stage="new",
    role="vendor_user"  # Optional: filter by role
)
```

## Examples

### Example 1: Entity-Level Baseline

**Entity Permission (agents):**
```json
{
  "tenant_admin": {"view": true, "edit": true},
  "vendor_user": {"view": true, "edit": false}
}
```

**Field: agents.name**
- No field override exists
- **Result:** Inherits entity permissions
  - `tenant_admin`: view=true, edit=true
  - `vendor_user`: view=true, edit=false

### Example 2: Field-Level Override

**Entity Permission (agents):**
```json
{
  "vendor_user": {"view": true, "edit": false}
}
```

**Field Override (agents.status):**
```json
{
  "vendor_user": {"view": true, "edit": true}  // Override: allow edit
}
```

**Result:**
- `agents.name`: Inherits entity (edit=false)
- `agents.status`: Uses override (edit=true)

### Example 3: Layout-Level Override

**Entity Permission (agents):**
```json
{
  "vendor_user": {"view": true, "edit": false}
}
```

**Field Override (agents.description):**
```json
{
  "vendor_user": {"view": true, "edit": true}
}
```

**Layout Override (FormFieldAccess for vendor_submission_workflow/new):**
```json
{
  "vendor_user": {"view": true, "edit": false}  // Override: deny edit in this workflow
}
```

**Result for agents.description in vendor_submission_workflow/new:**
- Final: view=true, edit=false (layout override takes precedence)

## Benefits

1. **DRY Principle**: Set permissions once at entity level, all fields inherit
2. **Flexibility**: Override specific fields when needed
3. **Workflow-Specific**: Different permissions for different workflows
4. **Maintainability**: Change entity permissions, all fields update automatically
5. **Consistency**: Ensures consistent permissions across related fields

## Migration Notes

- Existing field permissions remain as overrides
- New fields automatically inherit entity-level permissions
- Empty field permissions = inherit from entity (not "no access")

