# Entity and Fields Catalog - Unification Plan

## Problem Statement

Currently, custom fields and permissions are duplicated across multiple places:

1. **Custom Fields Duplication:**
   - `CustomFieldCatalog` - Single source of truth (Entity and Fields Catalog)
   - `FormLayout.custom_fields` - Duplicate storage in form layouts (JSON column)

2. **Permissions Duplication:**
   - `CustomFieldCatalog.role_permissions` - Permissions in the catalog
   - `EntityFieldRegistry.role_permissions` - Permissions for entity fields
   - `EntityFieldPermission.role_permissions` - Field-level permission overrides
   - `FormFieldAccess.role_permissions` - Permissions in form layouts

## Solution

### 1. Custom Fields Unification

**Single Source of Truth:** `CustomFieldCatalog` (Entity and Fields Catalog)

**Changes:**
- `FormLayout.custom_field_ids` - Store only UUIDs referencing `CustomFieldCatalog` (no duplication)
- `FormLayout.custom_fields` - DEPRECATED (kept for backward compatibility during migration)
- API resolves custom fields from catalog when loading layouts
- Frontend works with references instead of duplicates

**Benefits:**
- No duplication - custom fields stored only once
- Changes to catalog fields automatically reflect in all layouts
- Consistent field definitions across platform

### 2. Permissions Unification

**Source of Truth:** Entity and Fields Catalog permissions

**Hierarchy:**
1. **Entity and Fields Catalog** (`CustomFieldCatalog.role_permissions`, `EntityFieldRegistry.role_permissions`) - Baseline permissions
2. **FormFieldAccess** - Layout-specific overrides (optional, for workflow-specific permissions)

**Changes:**
- `FormFieldAccess.role_permissions` - Optional overrides (if not set, inherit from catalog)
- API merges catalog permissions with layout-specific overrides
- Role & Permissions page maps to catalog permissions

**Benefits:**
- Single source of truth for field permissions
- Layout-specific overrides when needed
- Consistent permission model across platform

## Implementation Status

- [x] Updated `FormLayout` model to support `custom_field_ids`
- [x] Created `resolve_custom_fields_from_catalog()` helper function
- [x] Updated `create_layout` to store `custom_field_ids` instead of duplicates
- [ ] Updated `get_layout` to resolve custom fields from catalog
- [ ] Updated `update_layout` to resolve custom fields from catalog
- [ ] Updated `get_active_layout_for_stage` to resolve custom fields from catalog
- [ ] Updated frontend to work with `custom_field_ids` references
- [ ] Created migration to convert existing `custom_fields` to `custom_field_ids`
- [ ] Updated `FormFieldAccess` to use catalog permissions as baseline
- [ ] Updated Role & Permissions page to map to catalog permissions

## Migration Path

1. **Phase 1:** Support both `custom_field_ids` and `custom_fields` (backward compatible)
2. **Phase 2:** Create migration script to convert existing `custom_fields` to `custom_field_ids`
3. **Phase 3:** Update frontend to use `custom_field_ids`
4. **Phase 4:** Remove `custom_fields` column (after migration complete)

