# Industry-Based Filtering Implementation

## Overview
Implemented industry-based filtering for requirements, compliance frameworks, and assessment templates to ensure tenants only see data relevant to their industry.

## Changes Made

### Backend Models

1. **SubmissionRequirement Model** (`backend/app/models/submission_requirement.py`)
   - Added `applicable_industries` JSON field
   - Array of industries: `["healthcare", "finance"]` or `["all"]` for all industries
   - If `null` or empty, applies to all industries (backward compatibility)

2. **ComplianceFramework Model** (`backend/app/models/compliance_framework.py`)
   - Added `applicable_industries` JSON field
   - Same structure as requirements

3. **AssessmentTemplate Model** (already implemented)
   - Already has `applicable_industries` field

### API Endpoints Updated

1. **GET /api/v1/submission-requirements**
   - Now filters by tenant's industry
   - Only returns requirements that:
     - Have no `applicable_industries` set (backward compatibility)
     - Include `"all"` in `applicable_industries`
     - Include tenant's industry in `applicable_industries`

2. **GET /api/v1/frameworks**
   - Now filters by tenant's industry
   - Same filtering logic as requirements

3. **GET /api/v1/assessment-templates**
   - Already filters by tenant's industry (implemented earlier)

### Migration

Created migration: `add_industry_filtering_to_requirements_frameworks.py`
- Adds `applicable_industries` to `submission_requirements` table
- Adds `applicable_industries` to `compliance_frameworks` table

### Filtering Logic

**For tenants WITH industry set:**
- Show items that:
  - Have no `applicable_industries` (backward compatibility)
  - Include `"all"` in `applicable_industries`
  - Include tenant's industry in `applicable_industries`

**For tenants WITHOUT industry set:**
- Show items that:
  - Have no `applicable_industries` (backward compatibility)
  - Include `"all"` in `applicable_industries`

### Example Usage

**Healthcare Tenant:**
- Industry: `"healthcare"`
- Sees:
  - HIPAA requirements (applicable_industries: `["healthcare"]`)
  - Patient data requirements (applicable_industries: `["healthcare"]`)
  - General requirements (applicable_industries: `["all"]` or `null`)
- Does NOT see:
  - SOX requirements (applicable_industries: `["finance"]`)
  - PCI-DSS requirements (applicable_industries: `["finance", "retail"]`)

**Finance Tenant:**
- Industry: `"finance"`
- Sees:
  - SOX requirements (applicable_industries: `["finance"]`)
  - PCI-DSS requirements (applicable_industries: `["finance", "retail"]`)
  - General requirements (applicable_industries: `["all"]` or `null`)
- Does NOT see:
  - HIPAA requirements (applicable_industries: `["healthcare"]`)

## Migration Required

Run the migration to add industry fields:
```bash
cd backend
alembic upgrade head
```

## Data Seeding

When creating requirements or frameworks, set `applicable_industries`:

```python
# Healthcare-specific requirement
requirement = SubmissionRequirement(
    label="HIPAA Compliance Statement",
    applicable_industries=["healthcare"],
    ...
)

# Finance-specific framework
framework = ComplianceFramework(
    name="SOX Compliance",
    applicable_industries=["finance"],
    ...
)

# Universal requirement (all industries)
requirement = SubmissionRequirement(
    label="General Security Policy",
    applicable_industries=["all"],  # or null/empty
    ...
)
```

## Frontend Impact

The frontend automatically respects the filtering since it calls the API endpoints which now filter by industry. No frontend changes needed - the filtering happens server-side.

## Benefits

1. **Cleaner UI**: Tenants only see relevant requirements and frameworks
2. **Reduced Confusion**: No healthcare-specific requirements shown to finance tenants
3. **Better UX**: Faster to find relevant items
4. **Backward Compatible**: Existing data without `applicable_industries` still shows (applies to all)

## Next Steps

1. Update existing requirements/frameworks to set appropriate `applicable_industries`
2. Update requirement auto-generation to set industry based on framework
3. Add industry filter UI in admin panels (optional - for platform admins to manage)
