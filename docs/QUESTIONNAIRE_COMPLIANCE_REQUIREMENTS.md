# Questionnaire-Style Compliance Requirements Implementation

## Overview

The submission requirements system has been enhanced to support questionnaire-style compliance requirements where vendors can respond with multiple response types: text explanations, file attachments (PDFs, documents, photos), or external links (Google Drive, SharePoint, etc.).

## Key Features

### 1. Multiple Response Types Per Question

Each requirement can now accept multiple response types:
- **Text**: Text-based explanations
- **File**: PDF, documents, images, photos (multiple files supported)
- **URL**: External links to Google Drive, SharePoint, or other storage

**Configuration:**
```typescript
allowed_response_types: ['text', 'file', 'url']  // Enable questionnaire mode
```

### 2. Filtering Based on Agent Metadata

Requirements can be filtered to show only for specific agent categories or types:

**Configuration:**
```json
{
  "filter_conditions": {
    "agent_category": ["Security & Compliance"],
    "agent_type": ["AI_AGENT"]
  }
}
```

### 3. Field Labels Always Displayed

All fields now show labels from the form designer configuration, ensuring clear identification of each field.

## Database Changes

### Migration: `8661ef4cb80d_add_questionnaire_response_types_and_filtering`

**New Columns in `submission_requirements`:**
- `allowed_response_types` (JSON): Array of allowed response types `["text", "file", "url"]`
- `filter_conditions` (JSON): Filter conditions `{"agent_category": ["Security"], "agent_type": ["AI_AGENT"]}`

## API Changes

### Updated Endpoints

1. **GET `/submission-requirements`**
   - Added `agent_category` and `agent_type` query parameters
   - Automatically filters requirements based on agent metadata

2. **POST `/submission-requirements`** (Create)
   - Accepts `allowed_response_types` and `filter_conditions`

3. **PATCH `/submission-requirements/{id}`** (Update)
   - Accepts `allowed_response_types` and `filter_conditions`

4. **POST `/submission-requirements/agents/{agent_id}/responses`**
   - Enhanced to handle questionnaire-style responses:
     ```json
     {
       "requirement_id": {
         "text": "Explanation text",
         "files": [{"name": "file.pdf", "size": 1234, "type": "application/pdf"}],
         "links": ["https://drive.google.com/..."]
       }
     }
     ```

## Frontend Changes

### 1. Agent Submission Form (`AgentSubmission.tsx`)

**Enhanced `renderRequirementField`:**
- Detects questionnaire-style requirements (multiple response types)
- Renders:
  - Text area for explanations
  - File upload input (multiple files)
  - URL input for external links
- Shows uploaded files and links with remove buttons
- Validates that at least one response type is provided for required fields

**Filtering:**
- Automatically filters requirements based on `formData.category` and `formData.type`
- Only shows requirements matching agent metadata

**Label Display:**
- All fields now show labels from `requirement.label`
- Labels styled with `text-sm font-medium text-gray-900`

### 2. Admin Interface (`SubmissionRequirementsManagement.tsx`)

**New Configuration Options:**
- **Response Types Section**: Checkboxes to enable text, file, and URL responses
- **Filter Conditions Section**: Inputs for agent category and type filtering
- Visual indicators for questionnaire-style requirements (📋 badge)
- Visual indicators for filtered requirements (🔍 badge)

## Usage Examples

### Creating a Questionnaire-Style Requirement

1. **In Admin Interface:**
   - Navigate to Submission Requirements Management
   - Click "+ Add Requirement"
   - Fill in basic details (label, field name, description)
   - **Enable Questionnaire Mode:**
     - Check "Text Explanation"
     - Check "File Attachments"
     - Check "External Links"
   - **Set Filter Conditions (Optional):**
     - Agent Category: "Security & Compliance"
     - Agent Type: "AI_AGENT"
   - Save

2. **Result:**
   - Requirement appears only for Security & Compliance AI Agents
   - Vendors can respond with text, upload files, or provide links
   - All response types are stored together

### Vendor Response Flow

1. Vendor fills agent submission form
2. System filters requirements based on agent category/type
3. Vendor sees questionnaire-style requirement:
   - Text area for explanation
   - File upload for documents
   - URL input for external links
4. Vendor can provide any combination of responses
5. Responses saved as:
   ```json
   {
     "text": "We use OAuth 2.0 and SAML for authentication...",
     "files": [
       {"name": "security_policy.pdf", "size": 123456, "type": "application/pdf"},
       {"name": "compliance_cert.jpg", "size": 234567, "type": "image/jpeg"}
     ],
     "links": [
       "https://drive.google.com/file/d/...",
       "https://sharepoint.company.com/..."
     ]
   }
   ```

## Admin Roles

**Who Can Configure:**
- `tenant_admin`
- `platform_admin`
- `security_reviewer`
- `compliance_reviewer`
- `policy_admin`

**Access:**
- Navigate to `/admin/submission-requirements` (or via Admin Panel menu)
- Create, edit, enable/disable requirements
- Configure questionnaire-style responses
- Set filter conditions

## Response Storage

### Database Structure

**`submission_requirement_responses.value` (JSON):**
```json
{
  "text": "Explanation text",
  "files": [
    {
      "name": "document.pdf",
      "size": 123456,
      "type": "application/pdf",
      "path": "/uploads/agent-123/req-456/document.pdf"
    }
  ],
  "links": [
    "https://drive.google.com/file/d/abc123"
  ]
}
```

### Validation

- **Required fields**: At least one response type must have a value
- **Text**: Validated for min/max length if specified
- **Files**: Validated for file type and size (future enhancement)
- **Links**: Validated as valid URLs

## Migration Steps

1. **Run Migration:**
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Update Existing Requirements (Optional):**
   - Existing requirements continue to work (single response type)
   - Can be updated to questionnaire-style via admin interface

## Future Enhancements

1. **File Upload Endpoint:**
   - Dedicated endpoint for file uploads
   - File storage in S3 or local filesystem
   - File preview/download functionality

2. **Enhanced Filtering:**
   - Support for more agent metadata fields
   - Complex filter conditions (AND/OR logic)

3. **Response Validation:**
   - File type validation
   - File size limits
   - Link validation (check if accessible)

4. **Response Review:**
   - Approver interface to review questionnaire responses
   - Download/view files
   - Verify external links

## Testing Checklist

- [x] Create questionnaire-style requirement with multiple response types
- [x] Filter requirements based on agent category
- [x] Filter requirements based on agent type
- [x] Render questionnaire UI in vendor submission form
- [x] Save text responses
- [x] Save file metadata (file upload endpoint pending)
- [x] Save external links
- [x] Validate required fields with multiple response types
- [x] Display labels for all fields
- [x] Admin interface for configuring questionnaires
