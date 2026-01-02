# Form Designer Implementation

## Overview

A comprehensive form designer system has been implemented that allows Tenant Admin users to configure form layouts and role-based field access control for admin, approver, and end user screens. The system supports dynamic form rendering based on layouts with role-based visibility and editing permissions.

## Features

### 1. Form Layout Management
- Create and manage form layouts for different screen types:
  - **Admin screens**: For tenant administrators
  - **Approver screens**: For approvers reviewing agent submissions
  - **End User screens**: For end users viewing agent information
  - **Vendor screens**: For vendor users submitting agents
- Organize fields into sections with custom ordering
- Set default layouts per screen type
- Filter layouts by agent type/category

### 2. Role-Based Field Access Control
- Configure view and edit permissions per field for each role:
  - `tenant_admin`
  - `approver`
  - `security_reviewer`
  - `compliance_reviewer`
  - `technical_reviewer`
  - `business_reviewer`
  - `vendor_user`
  - `end_user`
- Field access can be scoped to specific agent types/categories
- Supports both submission requirement fields and agent fields

### 3. Dynamic Form Rendering
- Forms are rendered dynamically based on configured layouts
- Fields are shown/hidden based on role permissions
- Fields are editable/read-only based on role permissions
- Supports all field types from submission requirements:
  - Text, Textarea, Number, Email, URL
  - Select, Multi-select, Checkbox, Radio
  - Date, File upload

## Backend Implementation

### Models

#### `FormLayout` (`backend/app/models/form_layout.py`)
- Stores form layout definitions
- Fields: `name`, `screen_type`, `sections` (JSON), `agent_type`, `agent_category`, `is_default`, `is_active`
- Sections contain ordered lists of field names

#### `FormFieldAccess` (`backend/app/models/form_layout.py`)
- Stores role-based access control for fields
- Fields: `field_name`, `field_source`, `screen_type`, `role_permissions` (JSON), `agent_type`, `agent_category`
- `role_permissions` structure: `{"role": {"view": bool, "edit": bool}}`

### API Endpoints (`backend/app/api/v1/form_layouts.py`)

#### Layout Management
- `POST /api/v1/form-layouts` - Create layout
- `GET /api/v1/form-layouts` - List layouts (filtered by screen_type, agent_type)
- `GET /api/v1/form-layouts/{id}` - Get layout
- `PATCH /api/v1/form-layouts/{id}` - Update layout
- `DELETE /api/v1/form-layouts/{id}` - Delete layout (soft delete)
- `GET /api/v1/form-layouts/screen/{screen_type}/active` - Get active layout for screen type

#### Field Access Control
- `POST /api/v1/form-layouts/field-access` - Create field access control
- `GET /api/v1/form-layouts/field-access` - List field access controls
- `PATCH /api/v1/form-layouts/field-access/{id}` - Update field access control
- `GET /api/v1/form-layouts/screen/{screen_type}/fields-with-access` - Get fields with access for role

### Permissions
- Layout management: `tenant_admin`, `platform_admin` only
- Field access viewing: All authenticated users (filtered by tenant)
- Form rendering: Based on role permissions configured in field access

## Frontend Implementation

### Components

#### `FormDesigner` (`frontend/src/pages/FormDesigner.tsx`)
- Main form designer interface
- Features:
  - Screen type selector (admin, approver, end_user, vendor)
  - Layout list and editor
  - Section management (add, edit, delete sections)
  - Field assignment to sections
  - Field access control configuration modal
  - Default layout setting

#### `DynamicForm` (`frontend/src/components/DynamicForm.tsx`)
- Dynamic form renderer component
- Features:
  - Fetches active layout for screen type
  - Fetches field access permissions for current user role
  - Renders fields based on layout sections
  - Applies role-based visibility (view permission)
  - Applies role-based editability (edit permission)
  - Supports all field types from submission requirements

### API Client (`frontend/src/lib/formLayouts.ts`)
- TypeScript interfaces and API client functions
- Methods for layout CRUD operations
- Methods for field access CRUD operations
- Methods for fetching layouts and field access for rendering

## Usage

### For Tenant Admins

1. **Access Form Designer**
   - Navigate to `/admin/form-designer` (accessible from Admin Dashboard)
   - Or go to Admin Dashboard → Overview → Quick Actions → Form Designer

2. **Create a Layout**
   - Select screen type (admin, approver, end_user, vendor)
   - Click "+ New" to create a new layout
   - Enter layout name and description
   - Add sections and assign fields to sections
   - Set as default if needed
   - Save layout

3. **Configure Field Access**
   - Click "Field Access Control" to expand
   - Click "+ Configure Field Access"
   - Select field name and source (submission_requirement or agent)
   - Configure view/edit permissions for each role
   - Save configuration

### For Developers

#### Using DynamicForm Component

```tsx
import DynamicForm from '../components/DynamicForm'

function MyScreen() {
  const [formData, setFormData] = useState({})
  
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value })
  }
  
  const handleSubmit = (data: Record<string, any>) => {
    // Save form data
  }
  
  return (
    <DynamicForm
      screenType="approver"
      agentType="ai_agent"
      formData={formData}
      onChange={handleFieldChange}
      onSubmit={handleSubmit}
      readOnly={false}
    />
  )
}
```

#### Using Form Layouts API

```typescript
import { formLayoutsApi } from '../lib/formLayouts'

// Get active layout for screen
const layout = await formLayoutsApi.getActiveForScreen('approver', 'ai_agent')

// Get field access for role
const fieldAccess = await formLayoutsApi.getFieldsWithAccessForRole('approver', 'approver', 'ai_agent')
```

## Database Schema

### Tables Created

1. **form_layouts**
   - Stores form layout definitions
   - Tenant-scoped
   - Supports multiple layouts per screen type

2. **form_field_access**
   - Stores role-based field access control
   - Tenant-scoped
   - One access control per field per screen type per tenant

### Migration

Run the schema sync script to create tables:
```bash
cd backend
source venv/bin/activate  # or your virtual environment
python3 scripts/sync_schema.py
```

The new model is already imported in `sync_schema.py`.

## Integration Points

### Admin Dashboard
- Added "Form Designer" quick action link in Overview tab
- Accessible to tenant_admin and platform_admin roles

### Routing
- Route added: `/admin/form-designer`
- Accessible from Admin Dashboard

### Future Integration Points
- **Approver Interface**: Replace static form with DynamicForm component
- **Admin Screens**: Use DynamicForm for agent management
- **End User Screens**: Use DynamicForm for agent catalog/details
- **Vendor Submission**: Use DynamicForm for agent submission form

## Security

- All endpoints require authentication
- Layout management restricted to tenant_admin and platform_admin
- Tenant isolation enforced on all operations
- Field access respects role permissions
- Forms render only fields user has permission to view
- Forms prevent editing fields user doesn't have edit permission for

## Example Workflow

1. **Tenant Admin configures layout:**
   - Creates "Approver Review Form" layout
   - Adds sections: "Basic Info", "Security Review", "Compliance Review"
   - Assigns fields to sections

2. **Tenant Admin configures field access:**
   - Sets `security_score` field: approver can view and edit
   - Sets `compliance_score` field: approver can view and edit
   - Sets `internal_notes` field: approver can view and edit, vendor_user cannot view

3. **Approver uses form:**
   - Opens approver screen
   - DynamicForm fetches "Approver Review Form" layout
   - DynamicForm fetches field access for "approver" role
   - Form renders only fields approver can view
   - Form allows editing only fields approver can edit
   - Form hides fields approver cannot view (e.g., internal_notes from vendor view)

## Next Steps

1. **Integration**: Replace static forms in existing screens with DynamicForm
2. **Agent Type Filtering**: Implement agent type-specific layouts in submission flow
3. **Field Validation**: Add client-side validation based on requirement definitions
4. **Preview Mode**: Add preview mode in Form Designer to see how form will look
5. **Layout Templates**: Add pre-built layout templates for common use cases
6. **Field Dependencies**: Add conditional field visibility based on other field values

## Files Created/Modified

### Backend
- `backend/app/models/form_layout.py` - New model file
- `backend/app/api/v1/form_layouts.py` - New API endpoints
- `backend/app/main.py` - Added router import and registration
- `backend/scripts/sync_schema.py` - Added model import

### Frontend
- `frontend/src/lib/formLayouts.ts` - New API client
- `frontend/src/pages/FormDesigner.tsx` - New form designer page
- `frontend/src/components/DynamicForm.tsx` - New dynamic form component
- `frontend/src/App.tsx` - Added route
- `frontend/src/pages/AdminDashboard.tsx` - Added Form Designer link

## Testing

To test the implementation:

1. **Backend**: Ensure database tables are created
2. **Frontend**: Navigate to `/admin/form-designer`
3. **Create Layout**: Create a test layout for "vendor" screen type
4. **Configure Access**: Set up field access for a test field
5. **Render Form**: Use DynamicForm component in a test page to verify rendering

## Notes

- Layouts are tenant-scoped - each tenant can have their own layouts
- Field access controls are tenant-scoped - each tenant configures their own permissions
- Default layouts are used when no specific layout matches agent type/category
- Forms automatically filter fields based on user's role and permissions
- All operations are audited via audit log service
