# TPRM Questionnaire Setup Guide

## Issue: Vendor Not Receiving Email

If you're getting `questionnaire_sent: false` and the vendor is not receiving emails, here's how to fix it:

---

## Prerequisites

### 1. Create a TPRM Assessment

The TPRM agent needs an **active Assessment** in the database to send questionnaires.

**Steps:**
1. Navigate to **Assessment Management** in the platform
2. Create a new Assessment:
   - **Name**: "TPRM Assessment" (or any name containing "TPRM")
   - **Type**: TPRM
   - **Status**: Active
   - Add questions/requirements to the assessment
3. Save the assessment

**OR** use the API:
```bash
POST /api/v1/assessments
{
  "name": "TPRM Assessment",
  "assessment_type": "tprm",
  "status": "active",
  "description": "Third-Party Risk Management questionnaire"
}
```

### 2. Configure Email Service

The platform needs SMTP configuration to send emails.

**Steps:**
1. Navigate to **Integration Management** → **SMTP Settings**
2. Configure:
   - SMTP Host
   - SMTP Port (usually 587)
   - SMTP User
   - SMTP Password
   - From Email
3. Test the connection

**OR** set environment variables:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@vaka.ai
FRONTEND_URL=http://localhost:3000
```

---

## How to Use TPRM with Questionnaire

### Option 1: Via Studio (UI)

1. Navigate to **Studio** → **Agents**
2. Click **"Execute Agent"** on **AI GRC Agent**
3. Select skill: **"tprm"**
4. Configure input:
   - **Vendor**: Select vendor
   - **Send Questionnaire**: ✅ Check this box
5. Click **"Execute"**

### Option 2: Via API

```bash
POST /api/v1/studio/agents/{ai_grc_agent_id}/execute
{
  "source": "vaka",
  "skill": "tprm",
  "input_data": {
    "vendor_id": "1c3e207f-21ed-487a-8949-478bfbdc57d0",
    "send_questionnaire": true  // ← IMPORTANT: Set to true
  }
}
```

---

## Expected Response

When `send_questionnaire: true` and assessment exists:

```json
{
  "vendor_id": "...",
  "vendor_name": "...",
  "tprm_score": 75,
  "requirements_fetched": 15,
  "questionnaire_sent": true,  // ← Should be true
  "assessment_assignment_id": "abc-123-def-456",  // ← Assignment ID
  "recommendations": [...],
  "next_steps": [
    "Questionnaire sent to vendor",
    "Wait for vendor responses",
    "Review responses and update TPRM score"
  ]
}
```

---

## Troubleshooting

### Issue: `questionnaire_sent: false`

**Possible Causes:**
1. ❌ `send_questionnaire` not set to `true` in input
2. ❌ No active TPRM assessment found in database
3. ❌ Assessment exists but status is not "active"

**Solution:**
- Check `debug_info` in response for details
- Create/activate a TPRM assessment
- Ensure assessment name contains "TPRM" or type is "tprm"

### Issue: Vendor Not Receiving Email

**Possible Causes:**
1. ❌ Email service not configured (SMTP settings)
2. ❌ Vendor email address invalid
3. ❌ Email in spam folder
4. ❌ SMTP server blocking emails

**Solution:**
1. Check email service configuration in Integration Management
2. Verify vendor's `contact_email` is correct
3. Check backend logs for email errors
4. Test email service with a simple email first

### Issue: `requirements_fetched: 0`

**Possible Causes:**
1. ❌ No TPRM questionnaire requirements in database
2. ❌ Requirements not tagged with `questionnaire_type: "TPRM- Questionnaire"`

**Solution:**
1. Import TPRM requirements via **Submission Requirements Management**
2. Ensure requirements have `questionnaire_type: "TPRM- Questionnaire"`
3. Run the mapping script: `python backend/scripts/map_requirements_to_questionnaires.py`

---

## Complete Workflow

```
1. Setup (One-time)
   ├── Create TPRM Assessment
   ├── Configure SMTP/Email
   └── Import TPRM Requirements

2. Execute TPRM with Questionnaire
   ├── Set send_questionnaire=true
   ├── Agent creates Assessment Assignment
   ├── Agent sends email to vendor
   └── Returns assignment_id

3. Vendor Receives Email
   ├── Email with questionnaire link
   ├── Vendor clicks link
   └── Vendor completes questionnaire

4. Process Responses (Future)
   ├── Agent monitors assignment status
   ├── Processes responses when complete
   └── Updates TPRM score
```

---

## Quick Test

1. **Check if TPRM assessment exists:**
```bash
GET /api/v1/assessments?assessment_type=tprm&status=active
```

2. **Check vendor email:**
```bash
GET /api/v1/vendors/{vendor_id}
# Check contact_email field
```

3. **Test email service:**
```bash
# Check Integration Management → SMTP Settings
# Or check backend logs for email errors
```

4. **Execute TPRM with questionnaire:**
```bash
POST /api/v1/studio/agents/{agent_id}/execute
{
  "source": "vaka",
  "skill": "tprm",
  "input_data": {
    "vendor_id": "...",
    "send_questionnaire": true
  }
}
```

---

## Next Steps

Once questionnaire is sent:
1. ✅ Vendor receives email notification
2. ✅ Vendor completes questionnaire
3. ⏳ Agent processes responses (to be implemented)
4. ⏳ Agent updates TPRM score (to be implemented)

---

## Support

If issues persist:
1. Check backend logs: `backend/logs/application.log`
2. Check error logs: `backend/logs/errors.log`
3. Verify all prerequisites are met
4. Check `debug_info` in agent response
