# Skill Input Form - Dynamic Field Binding

## Overview

The Skill Input Form component replaces manual JSON entry with business-friendly form fields that automatically bind to database entities. Users can configure skill inputs using dropdowns, checkboxes, and text fields instead of writing JSON.

## Features

### ✅ Database-Bound Fields
- **Agent Selection**: Dropdown populated from agents database
- **Vendor Selection**: Dropdown populated from vendors database
- **Assessment Types**: Predefined options from AssessmentType enum
- **Dynamic Options**: Options update based on available data

### ✅ Trigger Data Support
- **Toggle Option**: Checkbox to use trigger data instead of static values
- **Dynamic Values**: Support for `${trigger_data.field}` syntax
- **Visual Indicator**: Clear indication when using trigger data

### ✅ Skill-Specific Forms
- **Assessment**: Assessment type dropdown + agent/vendor selection
- **Vendor Qualification**: Vendor dropdown (required)
- **Marketplace Reviews**: Vendor dropdown (required) + agent dropdown (optional)
- **TPRM**: Vendor and/or agent selection (at least one required)
- **Real-time Risk Analysis**: Agent dropdown (required)
- **AI Agent Onboarding**: Agent dropdown (required)
- **Compliance Review**: Agent dropdown (required) + review type

### ✅ Auto-Generated JSON
- Form inputs automatically generate JSON
- JSON preview shown below form
- No manual JSON editing required

## How It Works

### 1. Skill Detection
When a skill is selected, the form looks up the field configuration for that skill:

```typescript
const skillFieldConfigs = {
  assessment: [
    { name: 'assessment_type', type: 'select', options: [...] },
    { name: 'agent_id', type: 'select', dataSource: 'agents' },
    { name: 'vendor_id', type: 'select', dataSource: 'vendors' }
  ],
  // ... other skills
}
```

### 2. Field Rendering
Based on field configuration:
- **Select fields**: Dropdown with options from database or predefined list
- **Text fields**: Input for free-form text
- **Number fields**: Numeric input
- **Boolean fields**: Checkbox
- **Trigger data**: Toggle to use `${trigger_data.field}` syntax

### 3. Data Binding
- **Agents**: Fetched from `/api/v1/agents` endpoint
- **Vendors**: Fetched from `/api/v1/vendors/list` endpoint
- **Assessment Types**: Predefined enum values

### 4. JSON Generation
Form inputs are automatically converted to JSON:
```json
{
  "assessment_type": "tprm",
  "agent_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

Or with trigger data:
```json
{
  "assessment_type": "tprm",
  "agent_id": "${trigger_data.agent_id}"
}
```

## Field Configurations

### Assessment Skill
```typescript
{
  name: 'assessment_type',
  label: 'Assessment Type',
  type: 'select',
  required: false,
  options: [
    { value: 'tprm', label: 'TPRM - Third-Party Risk Management' },
    { value: 'vendor_qualification', label: 'Vendor Qualification' },
    // ... more options
  ]
},
{
  name: 'agent_id',
  label: 'Agent to Assess',
  type: 'select',
  required: false,
  dataSource: 'agents'
},
{
  name: 'vendor_id',
  label: 'Vendor',
  type: 'select',
  required: false,
  dataSource: 'vendors'
}
```

### Vendor Qualification Skill
```typescript
{
  name: 'vendor_id',
  label: 'Vendor *',
  type: 'select',
  required: true,
  dataSource: 'vendors'
}
```

### Real-time Risk Analysis Skill
```typescript
{
  name: 'agent_id',
  label: 'Agent *',
  type: 'select',
  required: true,
  dataSource: 'agents'
}
```

## Usage in Flow Builder

### Step 1: Select Agent
Choose an agent from the dropdown (e.g., "Assessment Agent")

### Step 2: Select Skill
Choose a skill from the agent's available skills (e.g., "assessment")

### Step 3: Configure Input
The Skill Input Form appears automatically with relevant fields:
- Dropdowns for agents/vendors
- Select for assessment types
- Checkbox to use trigger data

### Step 4: Review Generated JSON
See the auto-generated JSON below the form

### Step 5: Save
The JSON is automatically included in the flow node configuration

## Trigger Data Usage

### Enable Trigger Data
1. Check "Use trigger data" checkbox next to a field
2. Field changes to text input with `${trigger_data.field}` placeholder
3. Can manually edit the trigger data path

### Example Trigger Data
```
${trigger_data.agent_id}
${trigger_data.vendor_id}
${trigger_data.assessment_type}
```

### When to Use Trigger Data
- **Flow Context**: When value comes from flow execution context
- **Previous Nodes**: When value comes from previous node results
- **Dynamic Values**: When value is determined at runtime

## Fallback Behavior

If a skill doesn't have a field configuration:
- Falls back to JSON textarea editor
- User can manually enter JSON
- Still supports trigger data syntax

## Adding New Skills

To add field configuration for a new skill:

1. **Add to `skillFieldConfigs`**:
```typescript
new_skill: [
  {
    name: 'field_name',
    label: 'Field Label',
    type: 'select' | 'text' | 'number' | 'boolean',
    required: true | false,
    dataSource: 'agents' | 'vendors' | undefined,
    options: [{ value: '...', label: '...' }],
    helpText: 'Help text for user'
  }
]
```

2. **Define Field Types**:
   - `select`: Dropdown (requires `options` or `dataSource`)
   - `text`: Text input
   - `number`: Number input
   - `boolean`: Checkbox

3. **Data Sources**:
   - `agents`: Populates from agents API
   - `vendors`: Populates from vendors API
   - `assessment_types`: Predefined options

## Benefits

### For Users
- ✅ No JSON knowledge required
- ✅ Visual form interface
- ✅ Dropdown selection from database
- ✅ Validation and help text
- ✅ Clear indication of required fields

### For Developers
- ✅ Centralized field configuration
- ✅ Easy to add new skills
- ✅ Type-safe field definitions
- ✅ Automatic JSON generation
- ✅ Consistent UX across skills

## Example Workflow

1. **User selects "Assessment Agent"**
2. **User selects "assessment" skill**
3. **Form appears with**:
   - Assessment Type dropdown (TPRM, Security, etc.)
   - Agent dropdown (populated from database)
   - Vendor dropdown (populated from database)
4. **User selects**:
   - Assessment Type: "TPRM"
   - Agent: "Agent ABC"
5. **JSON automatically generated**:
   ```json
   {
     "assessment_type": "tprm",
     "agent_id": "123e4567-e89b-12d3-a456-426614174000"
   }
   ```
6. **User can toggle to use trigger data** if needed
7. **Flow saved with proper configuration**

## Technical Details

### Component Props
```typescript
interface SkillInputFormProps {
  skill: string                    // Skill name (e.g., 'assessment')
  agentType?: string              // Agent type (e.g., 'assessment')
  value: Record<string, any>      // Current input data
  onChange: (value: Record<string, any>) => void  // Callback on change
}
```

### Data Flow
1. Component receives `skill` prop
2. Looks up field configuration
3. Fetches data from APIs if needed (agents, vendors)
4. Renders form fields based on configuration
5. User interacts with form
6. `onChange` callback updates parent component
7. JSON generated automatically

### API Integration
- **Agents API**: `GET /api/v1/agents?page=1&limit=100`
- **Vendors API**: `GET /api/v1/vendors/list?include_recent=true`

## Future Enhancements

- [ ] Field validation (required fields, format validation)
- [ ] Conditional fields (show/hide based on other field values)
- [ ] Multi-select for fields that accept arrays
- [ ] Date picker for date fields
- [ ] File upload for file fields
- [ ] Field dependencies (e.g., agent dropdown filtered by vendor)
- [ ] Custom field types (e.g., JSON editor for complex objects)
- [ ] Field templates (save common configurations)
