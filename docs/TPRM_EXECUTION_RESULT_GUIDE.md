# TPRM Agent Execution Result Guide

## Understanding Your Result

Based on your execution result, here's what happened and what to do next:

### Current Status

```json
{
  "requirements_fetched": 0,           // ⚠️ No TPRM requirements in database
  "questionnaire_sent": false,         // ⚠️ Questionnaire not sent
  "assessment_assignment_id": null     // ⚠️ No assignment created
}
```

---

## What This Means

### 1. `requirements_fetched: 0`
**Meaning**: No TPRM questionnaire requirements were found in the database.

**Why**: The agent searches for `SubmissionRequirement` records with:
- `questionnaire_type == "TPRM- Questionnaire"`
- Matching `tenant_id`

**Impact**: The agent can still perform TPRM analysis, but won't have specific questionnaire requirements to reference.

**Solution**: 
- Import TPRM requirements via **Submission Requirements Management**
- Ensure requirements are tagged with `questionnaire_type: "TPRM- Questionnaire"`

### 2. `questionnaire_sent: false`
**Meaning**: The questionnaire was not sent to the vendor.

**Why**: `send_questionnaire` was not set to `true` in the input data.

**Impact**: No assessment assignment was created, and vendor won't receive email.

**Solution**: ✅ **Now Fixed!** The UI now includes a checkbox for "Send Questionnaire to Vendor"

---

## How to Send Questionnaire (Updated UI)

### Via Studio UI (Recommended)

1. Navigate to **Studio** → **Agents**
2. Click **"Execute Agent"** on **AI GRC Agent**
3. Select skill: **"tprm"**
4. Configure input:
   - **Vendor**: Select your vendor
   - ✅ **Send Questionnaire to Vendor**: **Check this box** ← NEW!
5. Click **"Execute"**

### Via API

```bash
POST /api/v1/studio/agents/{ai_grc_agent_id}/execute
{
  "source": "vaka",
  "skill": "tprm",
  "input_data": {
    "vendor_id": "1c3e207f-21ed-487a-8949-478bfbdc57d0",
    "send_questionnaire": true  // ← Set to true
  }
}
```

---

## Prerequisites for Questionnaire Sending

### ✅ Required: Active TPRM Assessment

The agent needs an **active Assessment** in the database.

**Check if exists:**
```bash
GET /api/v1/assessments?assessment_type=tprm&status=active
```

**Create if missing:**
1. Navigate to **Assessment Management**
2. Create new Assessment:
   - **Name**: "TPRM Assessment" (must contain "TPRM")
   - **Type**: TPRM
   - **Status**: Active
3. Add questions/requirements
4. Save

### ✅ Required: Email Service Configuration

SMTP settings must be configured for email delivery.

**Check configuration:**
- Navigate to **Integration Management** → **SMTP Settings**
- Or check environment variables:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
  - `SMTP_FROM`
  - `FRONTEND_URL`

---

## Expected Result When Questionnaire Sent

When `send_questionnaire: true` and prerequisites are met:

```json
{
  "vendor_id": "1c3e207f-21ed-487a-8949-478bfbdc57d0",
  "vendor_name": "Default Vendor's Company",
  "tprm_score": 75,
  "requirements_fetched": 15,  // ← Should be > 0 if requirements exist
  "questionnaire_sent": true,   // ← Should be true
  "assessment_assignment_id": "abc-123-def-456",  // ← Assignment ID
  "recommendations": [...],
  "next_steps": [
    "Questionnaire sent to vendor",  // ← Different message
    "Wait for vendor responses",
    "Review responses and update TPRM score"
  ],
  "error": null,
  "debug_info": {
    "send_questionnaire_requested": true,
    "assessment_found": true,
    "tenant_id": "..."
  }
}
```

---

## Troubleshooting

### Issue: `questionnaire_sent: false` even with `send_questionnaire: true`

**Check `debug_info` in response:**
```json
{
  "debug_info": {
    "send_questionnaire_requested": true,
    "assessment_found": false,  // ← Problem: No assessment found
    "tenant_id": "..."
  }
}
```

**Solutions:**
1. Create an active TPRM assessment (see Prerequisites above)
2. Ensure assessment name contains "TPRM" or type is "tprm"
3. Ensure assessment status is "active"

### Issue: `requirements_fetched: 0`

**Why**: No TPRM requirements in database.

**Solutions:**
1. Import TPRM requirements via **Submission Requirements Management**
2. Ensure `questionnaire_type: "TPRM- Questionnaire"` is set
3. Requirements are optional - agent can still work without them

### Issue: Vendor Not Receiving Email

**Check:**
1. Email service configured? (SMTP settings)
2. Vendor `contact_email` is valid?
3. Check backend logs: `backend/logs/application.log`
4. Check spam folder

---

## Next Steps

### Immediate Actions

1. ✅ **UI Updated**: "Send Questionnaire" checkbox now available
2. ⏳ **Create TPRM Assessment** (if not exists)
3. ⏳ **Configure Email Service** (if not configured)
4. ⏳ **Re-execute with `send_questionnaire: true`**

### After Questionnaire Sent

1. Vendor receives email with questionnaire link
2. Vendor completes questionnaire
3. Agent processes responses (future enhancement)
4. TPRM score updates based on responses (future enhancement)

---

## Summary

- ✅ **Migration completed**: Master data fields added to agents
- ✅ **Backend running**: Server is up and accessible
- ✅ **UI updated**: "Send Questionnaire" checkbox added to TPRM skill
- ⏳ **Next**: Create TPRM assessment and re-execute with questionnaire enabled

**To send questionnaire:**
1. Check the **"Send Questionnaire to Vendor"** box in the TPRM skill input form
2. Ensure an active TPRM assessment exists
3. Ensure email service is configured
4. Execute the agent

The system is ready to send questionnaires once prerequisites are met!
