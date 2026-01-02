# Configuration Guide - Generalizing Hardcoded Values

This document explains how we've generalized hardcoded values in the VAKA platform to make it more configurable and maintainable.

## Overview

Previously, the application had many hardcoded values scattered throughout the codebase:
- Step numbers (e.g., "Step 1", "Step 2")
- Field names (e.g., `['name', 'type', 'category']`)
- API URLs (e.g., `http://localhost:8000`)
- Step counts (e.g., "10 steps")
- Screen type configurations

These have been moved to centralized configuration files that can be:
1. **Environment-based**: Overridden via environment variables
2. **Tenant-specific**: Can be customized per tenant (future enhancement)
3. **Type-safe**: TypeScript interfaces ensure correctness

## Configuration Files

### 1. `frontend/src/config/formLayoutConfig.ts`

**Purpose**: Centralized configuration for form layouts and steps

**Key Exports**:
- `DEFAULT_VENDOR_STEPS`: Array of step definitions with metadata
- `SCREEN_TYPE_CONFIGS`: Configuration per screen type (vendor, admin, approver, end_user)
- `DEFAULT_KEYWORD_MAPPINGS`: Field keyword mappings for auto-assignment
- Helper functions:
  - `getScreenTypeConfig(screenType)`: Get config for a screen type
  - `getBasicInformationStepNumber(screenType)`: Get the step number for basic info
  - `getStandardFieldsForStep(screenType, stepNumber)`: Get standard fields for a step
  - `isBasicInformationStep(screenType, stepNumber)`: Check if step is basic info
  - `getKeywordMappings(tenantId?)`: Get keyword mappings (supports tenant override)

**Example Usage**:
```typescript
import { isBasicInformationStep, getStandardFieldsForStep } from '../config/formLayoutConfig'

// Check if current step is basic information
if (isBasicInformationStep('vendor', stepNumber)) {
  // Show standard fields
  const standardFields = getStandardFieldsForStep('vendor', stepNumber)
}
```

### 2. `frontend/src/config/appConfig.ts`

**Purpose**: Application-wide configuration (API URLs, timeouts, feature flags)

**Key Exports**:
- `API_CONFIG`: API base URL, timeout, retry attempts
- `BACKEND_URL`: Backend URL for asset access
- `FRONTEND_URL`: Frontend URL
- `FEATURE_FLAGS`: Feature toggles
- `UI_CONFIG`: UI-related settings (pagination, file upload limits)
- `FORM_CONFIG`: Form-related settings (max/min steps)

**Environment Variables**:
- `VITE_API_URL`: Override API base URL (default: `http://localhost:8000/api/v1`)
- `VITE_BACKEND_URL`: Override backend URL (default: `http://localhost:8000`)
- `VITE_FRONTEND_URL`: Override frontend URL (default: `http://localhost:3000`)
- `VITE_ENABLE_ANALYTICS`: Enable/disable analytics features

**Example Usage**:
```typescript
import { API_CONFIG, BACKEND_URL } from '../config/appConfig'

// Use configured API URL
const response = await fetch(`${API_CONFIG.baseURL}/agents`)

// Use configured backend URL for assets
const logoUrl = `${BACKEND_URL}${tenantBranding.logo_url}`
```

## Refactored Components

### FormDesignerEditor.tsx

**Before**:
```typescript
// Hardcoded step check
if (step.step_number === 1) {
  const standardFields = ['name', 'type', 'category', 'subcategory', 'version', 'description']
  // ...
}

// Hardcoded keyword mappings
const keywordMappings = {
  'basic information': ['name', 'type', ...],
  // ...
}
```

**After**:
```typescript
import { 
  isBasicInformationStep, 
  getStandardFieldsForStep,
  getKeywordMappings 
} from '../config/formLayoutConfig'

// Configurable step check
if (isBasicInformationStep(screenType, step.step_number)) {
  const standardFields = getStandardFieldsForStep(screenType, step.step_number)
  // ...
}

// Configurable keyword mappings
const keywordMappings = getKeywordMappings(tenantId)
```

### AgentSubmission.tsx

**Before**:
```typescript
// Hardcoded step number
if (currentStep === 1) {
  // Basic Information step
}

// Hardcoded section index calculation
const sectionIndex = currentStep - 2 // Assumes Step 1 is basic
```

**After**:
```typescript
import { getBasicInformationStepNumber } from '../config/formLayoutConfig'

// Configurable step number
const basicStepNumber = getBasicInformationStepNumber('vendor') || 1
if (currentStep === basicStepNumber) {
  // Basic Information step
}

// Dynamic section index calculation
const sectionIndex = currentStep - (basicStepNumber + 1)
```

### api.ts

**Before**:
```typescript
const API_BASE_URL = 'http://localhost:8000/api/v1'
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})
```

**After**:
```typescript
import { API_CONFIG } from '../config/appConfig'

export const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
})
```

## Benefits

1. **Maintainability**: Single source of truth for configuration
2. **Flexibility**: Easy to change defaults or add new screen types
3. **Testability**: Can mock configurations in tests
4. **Type Safety**: TypeScript ensures correct usage
5. **Environment Support**: Different configs for dev/staging/prod
6. **Future Tenant Customization**: Structure supports tenant-specific configs

## Future Enhancements

### Tenant-Specific Configuration

The structure supports loading tenant-specific configurations:

```typescript
// Future: Load from API
async function getTenantConfig(tenantId: string) {
  const response = await fetch(`/api/v1/tenants/${tenantId}/form-config`)
  return response.json()
}

// Use tenant-specific config
const config = await getTenantConfig(tenantId)
const steps = config.defaultSteps || DEFAULT_VENDOR_STEPS
```

### Dynamic Step Configuration

Steps can be configured per tenant via the platform configuration API:

```typescript
// Backend API endpoint
GET /api/v1/platform-config/form-layout-config?screen_type=vendor

// Response
{
  "defaultSteps": [...],
  "minSteps": 1,
  "maxSteps": 50,
  "allowStepDeletion": true,
  "basicInformationStepNumber": 1,
  "standardFields": {
    "1": ["name", "type", "category", ...]
  }
}
```

## Migration Checklist

- [x] Create `formLayoutConfig.ts` with step definitions
- [x] Create `appConfig.ts` for application-wide config
- [x] Refactor `FormDesignerEditor.tsx` to use config
- [x] Refactor `AgentSubmission.tsx` to use config
- [x] Refactor `api.ts` to use config
- [x] Refactor `Layout.tsx` to use config for backend URL
- [ ] Add backend API for tenant-specific form config (future)
- [ ] Add admin UI for configuring form layouts (future)
- [ ] Add migration script for existing tenants (future)

## Testing Configuration Changes

To test configuration changes:

1. **Modify `formLayoutConfig.ts`**:
   ```typescript
   // Change basic information step to step 2
   { 
     id: 2, 
     title: 'Basic Information', 
     isBasicInformation: true,
     // ...
   }
   ```

2. **Verify behavior**:
   - Form designer should show standard fields on step 2
   - Agent submission should render basic info on step 2
   - Section indexing should adjust automatically

3. **Test with different screen types**:
   ```typescript
   const adminConfig = getScreenTypeConfig('admin')
   // Verify admin-specific behavior
   ```

## Best Practices

1. **Always use config functions** instead of hardcoded values
2. **Provide sensible defaults** in configuration files
3. **Document configuration options** in code comments
4. **Use TypeScript types** to ensure type safety
5. **Test configuration changes** thoroughly
6. **Consider backward compatibility** when changing defaults

## Summary

By moving hardcoded values to configuration files, we've made the application:
- ✅ More maintainable
- ✅ More flexible
- ✅ Easier to test
- ✅ Ready for multi-tenancy
- ✅ Environment-aware
- ✅ Type-safe

All hardcoded step numbers, field names, URLs, and counts have been replaced with configurable alternatives that can be customized per environment or tenant.
