# Custom Forms Module - Design Document

## Executive Summary

The Custom Forms Module is a fully configurable, tenant-specific form layout system that enables dynamic agent onboarding forms based on runtime attributes. The system supports configuration by agent category, agent type, user attributes (department, business unit), and other business attributes, with zero hardcoded form structures. All forms are loaded dynamically at runtime based on configured layouts.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Configuration Model](#configuration-model)
4. [Runtime Form Selection](#runtime-form-selection)
5. [Form Rendering](#form-rendering)
6. [Field Access Control](#field-access-control)
7. [Tenant Isolation](#tenant-isolation)
8. [Extension Points](#extension-points)
9. [Data Flow](#data-flow)
10. [API Design](#api-design)
11. [Frontend Components](#frontend-components)
12. [Use Cases](#use-cases)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ FormDesigner │  │DynamicForm  │  │AgentSubmission│          │
│  │  (Config UI) │  │ (Renderer)  │  │   (Runtime)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────────┐
│         │                  │                  │                  │
│  ┌──────▼──────────────────▼──────────────────▼──────┐         │
│  │         Form Layouts API (Backend)                  │         │
│  │  • Layout Management                                │         │
│  │  • Field Access Control                             │         │
│  │  • Runtime Selection                                │         │
│  └──────┬──────────────────────────────────────────────┘         │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────┐         │
│  │              Database Layer                          │         │
│  │  • form_layouts (tenant-scoped)                     │         │
│  │  • form_field_access (tenant-scoped)                 │         │
│  │  • users (with department, BU, etc.)                │         │
│  │  • agents (with type, category, etc.)               │         │
│  └─────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Zero Hardcoding**: No form structures are hardcoded. All forms are dynamically generated from database configurations.
2. **Tenant Isolation**: Each tenant has completely independent form configurations.
3. **Runtime Selection**: Forms are selected at runtime based on multiple attributes.
4. **Role-Based Access**: Field visibility and editability are controlled by role-based permissions.
5. **Extensible**: New attributes can be added without code changes.

---

## Core Concepts

### 1. Form Layout

A **Form Layout** defines the structure of a form for a specific screen type. It contains:
- **Sections**: Ordered groups of fields
- **Fields**: References to actual form fields (from submission requirements or agent model)
- **Screen Type**: Which screen this layout applies to (vendor, admin, approver, end_user)
- **Filter Attributes**: Conditions for when this layout should be used (agent_type, agent_category, etc.)

### 2. Screen Types

- **vendor**: Form shown to vendors submitting agents
- **admin**: Form shown to tenant admins managing agents
- **approver**: Form shown to approvers reviewing submissions
- **end_user**: Form shown to end users viewing agent details

### 3. Field Sources

Fields can come from two sources:
- **submission_requirement**: Fields defined in submission requirements
- **agent**: Fields from the agent model itself

### 4. Field Access Control

Controls who can view and edit each field:
- **View Permission**: Can the user see this field?
- **Edit Permission**: Can the user modify this field?

---

## Configuration Model

### Form Layout Configuration

```typescript
interface FormLayout {
  id: string
  tenant_id: string
  name: string                    // e.g., "AI Agent Submission Form"
  screen_type: 'vendor' | 'admin' | 'approver' | 'end_user'
  description?: string
  
  // Structure
  sections: SectionDefinition[]   // Ordered sections with fields
  
  // Filtering Attributes (for runtime selection)
  agent_type?: string             // e.g., "AI_AGENT", "BOT", "AUTOMATION"
  agent_category?: string         // e.g., "Customer Service", "Analytics"
  
  // Advanced Features
  field_dependencies?: Record<string, FieldDependency>  // Conditional visibility
  custom_fields?: CustomField[]   // Custom field types (file upload, external link)
  
  // Status
  is_active: boolean
  is_default: boolean             // Default layout for this screen type
}
```

### Section Definition

```typescript
interface SectionDefinition {
  id: string                      // Unique section ID
  title: string                   // e.g., "Basic Information"
  description?: string            // Section description
  order: number                   // Display order
  fields: string[]                // Array of field names
}
```

### Field Dependency (Conditional Visibility)

```typescript
interface FieldDependency {
  depends_on: string              // Field name that triggers dependency
  condition: 'equals' | 'not_equals' | 'contains' | 'is_empty' | ...
  value?: any                     // Value to compare against
}
```

Example: Show `deployment_details` only when `deployment_type` equals `"on_premise"`.

### Custom Fields

```typescript
interface CustomField {
  field_name: string
  field_type: 'file_upload' | 'external_link' | 'text' | 'select' | ...
  label: string
  description?: string
  is_required?: boolean
  // Type-specific options
  accepted_file_types?: string
  link_text?: string
  master_data_list_id?: string    // For dropdowns bound to master data
  options?: Array<{value: string, label: string}>
}
```

---

## Runtime Form Selection

### Selection Logic

Forms are selected at runtime using a **priority-based matching algorithm**:

```
1. Match by agent_type + agent_category (if both provided)
2. Match by agent_type only (if category not provided)
3. Match by agent_category only (if type not provided)
4. Match default layout (is_default = true)
5. Match any active layout for screen type
6. Fallback to standard fields (if no layout configured)
```

### Current Implementation

The system currently supports filtering by:
- **agent_type**: Type of agent (AI_AGENT, BOT, AUTOMATION, API_SERVICE)
- **agent_category**: Category of agent (Customer Service, Analytics, etc.)

### Extended Selection (Future Enhancement)

To support user attributes (department, BU, etc.), the selection logic can be extended:

```python
# Extended selection algorithm
def select_layout(screen_type, agent_type, agent_category, user_attributes):
    """
    Select layout based on multiple attributes with priority:
    1. agent_type + agent_category + user.department + user.business_unit
    2. agent_type + agent_category + user.department
    3. agent_type + agent_category
    4. agent_type + user.department
    5. agent_type
    6. user.department + user.business_unit
    7. user.department
    8. default layout
    """
```

### Database Schema Extension

To support user attribute filtering, add JSON column to `form_layouts`:

```sql
ALTER TABLE form_layouts 
ADD COLUMN filter_attributes JSON;

-- Example filter_attributes:
-- {
--   "user_department": ["Engineering", "Sales"],
--   "user_business_unit": ["North America", "Europe"],
--   "user_role": ["tenant_admin", "business_reviewer"]
-- }
```

---

## Form Rendering

### Dynamic Form Component

The `DynamicForm` component renders forms at runtime:

```typescript
<DynamicForm
  screenType="vendor"
  agentType="AI_AGENT"
  agentCategory="Customer Service"
  formData={formData}
  onChange={handleChange}
  onSubmit={handleSubmit}
  readOnly={false}
/>
```

### Rendering Flow

```
1. Fetch Active Layout
   └─> GET /api/v1/form-layouts/screen/{screen_type}/active
       ?agent_type={type}&agent_category={category}

2. Fetch Field Access Permissions
   └─> GET /api/v1/form-layouts/screen/{screen_type}/fields-with-access
       ?role={user_role}&agent_type={type}

3. Fetch Field Definitions
   └─> GET /api/v1/submission-requirements (for field metadata)

4. Render Form
   ├─> Iterate through sections (in order)
   ├─> For each field in section:
   │   ├─> Check view permission → Show/Hide
   │   ├─> Check edit permission → Editable/Read-only
   │   ├─> Check field dependencies → Conditional visibility
   │   └─> Render appropriate input component
   └─> Apply validation rules
```

### Field Rendering

Fields are rendered based on their type:
- **Text/Textarea**: Standard input fields
- **Select/Multi-select**: Dropdowns (can be bound to master data lists)
- **Checkbox/Radio**: Boolean or choice fields
- **Date**: Date picker
- **File Upload**: File input (from custom fields)
- **External Link**: Link display (from custom fields)

---

## Field Access Control

### Access Control Model

```typescript
interface FieldAccess {
  id: string
  tenant_id: string
  field_name: string
  field_source: 'submission_requirement' | 'agent'
  screen_type: 'vendor' | 'admin' | 'approver' | 'end_user'
  
  // Role-based permissions
  role_permissions: {
    [role: string]: {
      view: boolean
      edit: boolean
    }
  }
  
  // Optional filtering
  agent_type?: string
  agent_category?: string
}
```

### Permission Evaluation

When rendering a form:
1. Get user's role
2. For each field, check `role_permissions[user_role]`
3. If `view: false` → Hide field completely
4. If `view: true, edit: false` → Show as read-only
5. If `view: true, edit: true` → Show as editable

### Supported Roles

- `tenant_admin`
- `platform_admin`
- `vendor_user`
- `approver`
- `security_reviewer`
- `compliance_reviewer`
- `technical_reviewer`
- `business_reviewer`
- `end_user`

---

## Tenant Isolation

### Complete Isolation

Each tenant has:
- **Independent layouts**: No sharing between tenants
- **Independent field access**: Each tenant configures their own permissions
- **Independent custom fields**: Custom fields are tenant-specific

### Database Level

All tables include `tenant_id`:
```sql
CREATE TABLE form_layouts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ...
);

CREATE TABLE form_field_access (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ...
);
```

### API Level

All queries automatically filter by `current_user.tenant_id`:
```python
query = db.query(FormLayout).filter(
    FormLayout.tenant_id == current_user.tenant_id
)
```

---

## Extension Points

### 1. Adding New Filter Attributes

To add user department/BU filtering:

**Step 1: Extend Database Schema**
```sql
ALTER TABLE form_layouts 
ADD COLUMN filter_attributes JSON;
```

**Step 2: Update Selection Logic**
```python
def get_active_layout_for_screen(
    screen_type: str,
    agent_type: Optional[str] = None,
    agent_category: Optional[str] = None,
    user_department: Optional[str] = None,
    user_business_unit: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enhanced matching logic with user attributes
    ...
```

**Step 3: Update Frontend**
```typescript
const layout = await formLayoutsApi.getActiveForScreen(
  'vendor',
  agentType,
  agentCategory,
  user.department,      // New
  user.business_unit    // New
);
```

### 2. Adding New Screen Types

1. Add to `LayoutScreenType` enum
2. Update API validation patterns
3. Add UI in Form Designer
4. Create default layouts if needed

### 3. Adding New Field Types

1. Add to `CustomField.field_type` enum
2. Implement renderer in `DynamicForm` component
3. Add validation logic
4. Update Form Designer UI

---

## Data Flow

### Configuration Flow (Tenant Admin)

```
1. Tenant Admin opens Form Designer
   └─> GET /api/v1/form-layouts?screen_type=vendor

2. Creates/Edits Layout
   ├─> Defines sections and fields
   ├─> Sets agent_type/agent_category filters
   └─> POST /api/v1/form-layouts (create)
       or PATCH /api/v1/form-layouts/{id} (update)

3. Configures Field Access
   ├─> Selects field
   ├─> Sets role permissions
   └─> POST /api/v1/form-layouts/field-access

4. Activates Layout
   └─> PATCH /api/v1/form-layouts/{id}
       { "is_active": true }
```

### Runtime Flow (Vendor/User)

```
1. User opens Agent Submission form
   └─> Component mounts

2. Fetch Layout
   ├─> Determine agent_type (if known)
   ├─> Determine agent_category (if known)
   ├─> Get user attributes (department, BU, etc.)
   └─> GET /api/v1/form-layouts/screen/vendor/active
       ?agent_type={type}&agent_category={category}

3. Fetch Permissions
   └─> GET /api/v1/form-layouts/screen/vendor/fields-with-access
       ?role={user_role}&agent_type={type}

4. Render Form
   ├─> Iterate sections
   ├─> Render fields (with permissions applied)
   └─> User fills form

5. Submit Form
   └─> POST /api/v1/agents
       (with form data)
```

---

## API Design

### Layout Management Endpoints

#### Create Layout
```
POST /api/v1/form-layouts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "AI Agent Submission Form",
  "screen_type": "vendor",
  "description": "Form for AI agent submissions",
  "sections": [...],
  "agent_type": "AI_AGENT",
  "agent_category": "Customer Service",
  "is_default": false
}
```

#### Get Active Layout (Runtime)
```
GET /api/v1/form-layouts/screen/{screen_type}/active
?agent_type={type}&agent_category={category}

Response: FormLayout
```

#### List Layouts
```
GET /api/v1/form-layouts
?screen_type={type}&agent_type={type}&is_active={bool}

Response: FormLayout[]
```

#### Update Layout
```
PATCH /api/v1/form-layouts/{layout_id}
{
  "sections": [...],
  "is_active": true
}
```

### Field Access Endpoints

#### Create Field Access
```
POST /api/v1/form-layouts/field-access
{
  "field_name": "llm_vendor",
  "field_source": "submission_requirement",
  "screen_type": "vendor",
  "role_permissions": {
    "vendor_user": {"view": true, "edit": true},
    "approver": {"view": true, "edit": false}
  },
  "agent_type": "AI_AGENT"
}
```

#### Get Fields with Access (Runtime)
```
GET /api/v1/form-layouts/screen/{screen_type}/fields-with-access
?role={user_role}&agent_type={type}

Response: FieldAccessForRole[]
```

### Available Fields Endpoint

```
GET /api/v1/form-layouts/available-fields

Response: {
  "submission_requirements": [...],
  "agent": [...],
  "agent_metadata": [...]
}
```

---

## Frontend Components

### FormDesigner Component

**Purpose**: Configuration UI for tenant admins

**Features**:
- Create/Edit/Delete layouts
- Manage sections and fields
- Configure field access
- Preview forms
- Set default layouts

**Location**: `frontend/src/pages/FormDesigner.tsx`

### DynamicForm Component

**Purpose**: Runtime form renderer

**Features**:
- Fetches layout at runtime
- Applies field access permissions
- Renders fields based on type
- Handles validation
- Supports conditional visibility

**Location**: `frontend/src/components/DynamicForm.tsx`

**Usage**:
```typescript
<DynamicForm
  screenType="vendor"
  agentType={agentType}
  agentCategory={agentCategory}
  formData={formData}
  onChange={handleChange}
  onSubmit={handleSubmit}
/>
```

### AgentSubmission Component

**Purpose**: Vendor submission form (uses DynamicForm)

**Features**:
- Multi-step form navigation
- Loads layout dynamically
- Saves form data
- Validates before submission

**Location**: `frontend/src/pages/AgentSubmission.tsx`

---

## Use Cases

### Use Case 1: Different Forms by Agent Category

**Scenario**: Tenant wants different submission forms for "Customer Service" vs "Analytics" agents.

**Configuration**:
1. Create Layout 1: "Customer Service Agent Form"
   - `agent_category: "Customer Service"`
   - Sections: Basic Info, Customer Service Fields, Support Metrics
2. Create Layout 2: "Analytics Agent Form"
   - `agent_category: "Analytics"`
   - Sections: Basic Info, Analytics Fields, Data Sources

**Runtime**:
- Vendor selects "Customer Service" category → Layout 1 loads
- Vendor selects "Analytics" category → Layout 2 loads

### Use Case 2: Department-Specific Forms

**Scenario**: Engineering department needs different fields than Sales department.

**Configuration** (Future):
1. Create Layout: "Engineering Agent Form"
   - `filter_attributes: {"user_department": ["Engineering"]}`
   - Sections: Technical Specs, Architecture, Code Review
2. Create Layout: "Sales Agent Form"
   - `filter_attributes: {"user_department": ["Sales"]}`
   - Sections: Business Value, ROI, Customer Impact

**Runtime**:
- Engineering user submits → Engineering form loads
- Sales user submits → Sales form loads

### Use Case 3: Role-Based Field Visibility

**Scenario**: Internal notes field should only be visible to approvers, not vendors.

**Configuration**:
1. Create Field Access for "internal_notes":
   - `role_permissions: {
       "vendor_user": {"view": false, "edit": false},
       "approver": {"view": true, "edit": true}
     }`

**Runtime**:
- Vendor sees form → "internal_notes" field hidden
- Approver sees form → "internal_notes" field visible and editable

### Use Case 4: Conditional Fields

**Scenario**: Show "deployment_details" only when "deployment_type" is "on_premise".

**Configuration**:
1. Add field dependency:
   ```json
   {
     "deployment_details": {
       "depends_on": "deployment_type",
       "condition": "equals",
       "value": "on_premise"
     }
   }
   ```

**Runtime**:
- User selects "deployment_type: cloud" → "deployment_details" hidden
- User selects "deployment_type: on_premise" → "deployment_details" shown

---

## Implementation Status

### ✅ Implemented

- Form layout management (CRUD)
- Section-based form structure
- Agent type/category filtering
- Role-based field access control
- Dynamic form rendering
- Tenant isolation
- Custom fields (file upload, external link)
- Field dependencies (conditional visibility)
- Form Designer UI
- DynamicForm component

### 🚧 Future Enhancements

- User attribute filtering (department, BU)
- Multi-attribute matching (agent_type + category + department)
- Layout templates
- Form validation rules configuration
- Field-level help text configuration
- Form versioning
- A/B testing for forms
- Analytics on form usage

---

## Security Considerations

1. **Tenant Isolation**: All queries filter by tenant_id
2. **Role-Based Access**: Field visibility enforced at API and UI level
3. **Permission Checks**: Layout management restricted to tenant_admin/platform_admin
4. **Input Validation**: All inputs validated against field definitions
5. **Audit Logging**: All layout/access changes are logged

---

## Performance Considerations

1. **Caching**: Layouts can be cached (tenant-scoped)
2. **Lazy Loading**: Field definitions loaded on demand
3. **Query Optimization**: Indexes on tenant_id, screen_type, agent_type, agent_category
4. **Pagination**: For large field lists

---

## Conclusion

The Custom Forms Module provides a fully configurable, tenant-specific form system with zero hardcoding. Forms are dynamically selected and rendered at runtime based on multiple attributes, ensuring flexibility and extensibility for future requirements.

The system supports:
- ✅ Multiple form layouts per screen type
- ✅ Attribute-based layout selection (agent type, category)
- ✅ Role-based field access control
- ✅ Conditional field visibility
- ✅ Custom field types
- ✅ Complete tenant isolation
- ✅ Extensible architecture for new attributes

Future enhancements can easily add user attribute filtering (department, BU) and other business attributes without requiring code changes to the core system.
