# Assessment Management Screen Redesign

## Overview
Redesigned the Assessments & Evaluations screen to simplify the user experience by:
1. Removing nested modals
2. Using pre-bundled templates based on tenant industry
3. Simplifying question selection with lookup lists
4. Streamlining the overall workflow

## Key Changes

### Backend Changes

1. **Tenant Model Enhancement** (`backend/app/models/tenant.py`)
   - Added `industry` field (healthcare, finance, technology, etc.)
   - Added `timezone` field (default: UTC)
   - Added `locale` field (default: en)
   - Added `i18n_settings` JSON field for internationalization

2. **Assessment Template Model** (`backend/app/models/assessment_template.py`)
   - New model for pre-bundled assessment templates
   - Templates have `applicable_industries` array
   - Templates store question definitions as JSON
   - Templates can be instantiated for tenants

3. **Assessment Template Service** (`backend/app/services/assessment_template_service.py`)
   - `get_applicable_templates()` - Returns templates for tenant's industry
   - `instantiate_template()` - Creates assessment from template with questions

4. **API Endpoints**
   - `GET /api/v1/assessment-templates` - List applicable templates
   - `POST /api/v1/assessment-templates/instantiate` - Create assessment from template
   - Updated `PATCH /api/v1/tenants/{id}` - Support profile fields

### Frontend Changes

1. **Template Selection First**
   - Show applicable templates based on tenant industry
   - "Create from Template" button for each template
   - Templates show preview of included questions

2. **Simplified Question Selection**
   - Single modal/drawer instead of nested modals
   - Searchable requirement lookup list
   - Multi-select for adding multiple requirements at once
   - Visual indicators for requirement references vs new questions

3. **Streamlined Workflow**
   - Create Assessment → Select Template → Customize Name → Add Questions → Save
   - Questions can be added from requirement lookup or manually
   - No nested modals - everything in one view

## Migration Required

Run migration to add tenant profile fields:
```bash
cd backend
alembic upgrade head
```

## Usage

### For Healthcare Tenant
- Only sees templates applicable to healthcare (HIPAA, Patient Data, etc.)
- Can instantiate templates with pre-configured questions
- Can add additional questions from requirement library

### For Finance Tenant
- Only sees templates applicable to finance (SOX, PCI-DSS, etc.)
- Same streamlined workflow

## Next Steps

1. Create seed data for assessment templates (HIPAA, SOX, etc.)
2. Update tenant onboarding flow to capture industry
3. Add template management UI for platform admins
4. Add bulk question import from requirements
