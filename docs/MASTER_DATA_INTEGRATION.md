# Master Data Integration Guide

## Overview

This document describes the integration of master data lists to replace hardcoded enum values throughout the system. All entities (users, agents, assessments, approvals, workflows) now reference master data lists instead of hardcoded values.

## Master Data Lists Created

The following system master data lists have been created and seeded for all tenants:

1. **user_role** - User roles and permissions
2. **agent_type** - Types of AI agents
3. **agent_status** - Status values for AI agents
4. **agent_skill** - Skills that AI agents can have
5. **assessment_type** - Types of assessments
6. **assessment_status** - Status values for assessments
7. **schedule_frequency** - Assessment schedule frequency options
8. **approval_status** - Status values for approval workflows
9. **workflow_status** - Status values for workflow configurations
10. **workflow_engine_type** - Types of workflow engines
11. **workflow_stage** - Stages/states within workflow requests

## Backend Changes

### Master Data Service

A new service (`app/services/master_data_service.py`) provides helper functions:
- `MasterDataService.get_master_data_list()` - Get a master data list by type
- `MasterDataService.get_master_data_values()` - Get all active values from a list
- `MasterDataService.validate_value()` - Validate a value against master data
- `MasterDataService.get_value_label()` - Get the display label for a value

### API Endpoints

The existing endpoint `/api/v1/master-data-lists/by-type/{list_type}/values` returns active values for any list type.

### Validation

APIs should validate values against master data using:
```python
from app.services.master_data_service import MasterDataService

# Validate a value
if not MasterDataService.validate_value(db, str(tenant_id), "user_role", role_value):
    raise HTTPException(status_code=400, detail="Invalid role")
```

## Frontend Changes

### Using Master Data in Components

Replace hardcoded arrays with master data API calls:

```typescript
import { masterDataListsApi } from '../lib/masterDataLists'
import { useQuery } from '@tanstack/react-query'

// In component
const { data: userRoles = [] } = useQuery({
  queryKey: ['master-data', 'user_role'],
  queryFn: () => masterDataListsApi.getValuesByType('user_role'),
})

// Use in select dropdown
<select>
  {userRoles.map(role => (
    <option key={role.value} value={role.value}>
      {role.label}
    </option>
  ))}
</select>
```

### Migration Checklist

For each component using hardcoded values:

1. ✅ Identify hardcoded enum arrays (e.g., `const ROLES = [...]`)
2. ✅ Replace with `useQuery` to fetch from master data
3. ✅ Update select/option rendering to use `value` and `label` from master data
4. ✅ Update form validation to check against master data values
5. ✅ Test that values can be customized via master data UI

## Backward Compatibility

- Enums are still defined in models for type hints and backward compatibility
- Database columns remain as String (not Enum) to support custom values
- APIs validate against master data but accept enum values for compatibility
- Existing data continues to work without migration

## Customization

Tenant admins can:
- Edit labels for system master data values
- Add new values to system lists (except system-protected lists)
- Create custom master data lists for tenant-specific needs

System lists (is_system=true) cannot be deleted but can be edited by platform admins.

## Seeding Scripts

- `scripts/seed_system_master_data.py` - Seeds system master data lists for all tenants
- `scripts/seed_master_data.py` - Seeds regular master data lists (question categories, etc.)

Run these scripts after creating new tenants or when updating system values.

## Next Steps

1. Update all frontend components to use master data
2. Update API validation to use master data service
3. Add master data validation to all create/update endpoints
4. Update documentation and help text to reference master data
