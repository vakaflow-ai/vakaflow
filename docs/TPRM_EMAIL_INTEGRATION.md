# TPRM Email Integration Guide

## Overview

The TPRM agent no longer sends emails directly. Instead, **email notifications are handled through the agentic configuration system (integrations)**. This provides:

- ✅ **Flexibility**: Configure email templates, recipients, and timing per flow
- ✅ **Consistency**: All integrations (email, push data, collect data) use the same system
- ✅ **Maintainability**: Email logic centralized in `AgenticActionService`
- ✅ **Reusability**: Same email configuration can be used across multiple flows

## How It Works

### 1. Agent Returns Integration-Ready Data

When the TPRM agent executes with `send_questionnaire=true`, it returns:

```json
{
  "vendor_id": "...",
  "vendor_name": "Vendor Name",
  "vendor_email": "vendor@example.com",
  "assessment_assignment_id": "...",
  "assessment_name": "TPRM Assessment",
  "assessment_url": "http://localhost:3000/assessments/...",
  "due_date": "2025-12-31T00:00:00",
  "questionnaire_sent": true,
  ...
}
```

### 2. Configure Email in Flow Node

In the **Flow Builder**, configure email for the TPRM agent node:

**Agentic Configuration → Email:**
- ✅ **Enabled**: `true`
- **Send On**: `after` (send after agent execution)
- **Recipients**:
  ```json
  [
    {
      "type": "vendor",
      "value": "${context.vendor_id}"
    }
  ]
  ```
  Or use custom email:
  ```json
  [
    {
      "type": "custom",
      "value": "${result.vendor_email}"
    }
  ]
  ```
- **Subject**: `TPRM Questionnaire Assignment: ${result.assessment_name}`
- **Body Template**:
  ```html
  <h2>TPRM Questionnaire Assignment</h2>
  <p>Dear ${result.vendor_name},</p>
  <p>You have been assigned a Third-Party Risk Management (TPRM) questionnaire.</p>
  <p><strong>Assessment:</strong> ${result.assessment_name}</p>
  <p><strong>Due Date:</strong> ${result.due_date}</p>
  <p><a href="${result.assessment_url}">Complete Questionnaire</a></p>
  ```

### 3. Email is Sent Automatically

When the flow executes:
1. TPRM agent creates the assessment assignment
2. Agent returns result with `vendor_email`, `assessment_url`, etc.
3. `AgenticActionService` processes the email configuration
4. Email is sent to the vendor using the configured template

## Example Flow Configuration

### Flow Node Configuration

```json
{
  "id": "tprm-node-1",
  "type": "agent",
  "agent_id": "ai-grc-agent-id",
  "skill": "tprm",
  "name": "TPRM Review",
  "agenticConfig": {
    "email": {
      "enabled": true,
      "send_on": "after",
      "recipients": [
        {
          "type": "custom",
          "value": "${result.vendor_email}"
        }
      ],
      "subject": "TPRM Questionnaire Assignment: ${result.assessment_name}",
      "body_template": "<h2>TPRM Questionnaire Assignment</h2><p>Dear ${result.vendor_name},</p><p>You have been assigned a TPRM questionnaire.</p><p><strong>Assessment:</strong> ${result.assessment_name}</p><p><a href=\"${result.assessment_url}\">Complete Questionnaire</a></p>"
    }
  }
}
```

## Recipient Types

The `AgenticActionService` supports multiple recipient types:

### 1. Custom Email
```json
{
  "type": "custom",
  "value": "${result.vendor_email}"
}
```
- Direct email address or variable reference

### 2. Vendor
```json
{
  "type": "vendor",
  "value": "${context.vendor_id}"
}
```
- Resolves to vendor's `contact_email`

### 3. User
```json
{
  "type": "user",
  "value": "${context.assigned_by}"
}
```
- Resolves to user's email address

## Variable Substitution

Variables are replaced using `${variable.path}` syntax:

- **From Result**: `${result.vendor_email}`, `${result.assessment_url}`, `${result.assessment_name}`
- **From Context**: `${context.vendor_id}`, `${context.execution_id}`, `${context.flow_id}`

## Benefits

### ✅ Separation of Concerns
- **Agent**: Focuses on business logic (creating assignments, analyzing risk)
- **Integration System**: Handles communication (email, webhooks, data push)

### ✅ Flexibility
- Different email templates per flow
- Multiple recipients per flow
- Conditional email sending (before/after/on error)

### ✅ Maintainability
- Email configuration in one place (agenticConfig)
- Easy to update templates without changing agent code
- Consistent email handling across all agents

## Troubleshooting

### Email Not Sent

1. **Check AgenticConfig**: Ensure email is enabled in flow node
2. **Check Recipients**: Verify recipient resolution (check logs)
3. **Check SMTP Config**: Ensure email service is configured in database
4. **Check Logs**: Look for `AgenticActionService` errors in backend logs

### Variables Not Resolved

- Ensure variable paths match result/context structure
- Use `${result.vendor_email}` not `${vendor_email}`
- Check execution result structure in logs

## Migration from Direct Email

If you have existing flows using direct email in agents:

1. **Remove direct email code** from agent (already done for TPRM)
2. **Add agenticConfig** to flow node with email configuration
3. **Test email sending** through flow execution
4. **Verify** email is received with correct content

## Next Steps

1. **Configure email in your TPRM flow** using Flow Builder
2. **Test the flow** to ensure email is sent correctly
3. **Customize email template** as needed for your organization
4. **Add additional recipients** (e.g., compliance team, account manager)

---

**Note**: Direct agent execution (not through flows) will not send emails automatically. To send emails when executing agents directly, either:
- Execute through a flow with agenticConfig
- Use the API to trigger email actions separately
- Configure email in the flow and execute the flow
