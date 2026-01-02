# Email Troubleshooting Guide

## Issue: No Email Received

### Step 1: Check Flow Configuration

**Problem**: Email is not configured in the flow's `agenticConfig`.

**Solution**: 
1. Open the flow in Flow Builder
2. Click on the TPRM agent node
3. Go to "Agentic Configuration" section
4. Enable Email:
   ```json
   {
     "email": {
       "enabled": true,
       "send_on": "after",
       "recipients": [
         {
           "type": "custom",
           "value": "${result.vendor_email}"
         }
       ],
       "subject": "TPRM Questionnaire: ${result.assessment_name}",
       "body_template": "..."
     }
   }
   ```

### Step 2: Verify SMTP Integration

**Check if SMTP is configured:**
1. Go to `http://localhost:3000/integrations`
2. Look for "SMTP Email Configuration"
3. Should show: "✓ SMTP is currently configured and active"

**If not configured:**
1. Click "Configure Email (SMTP)"
2. Enter SMTP settings
3. Click "Save Configuration"
4. Test connection

### Step 3: Check Execution Method

**Problem**: Agent executed directly (not through flow).

**Solution**: 
- Execute through a **flow** with email configured in `agenticConfig`
- Direct agent execution does NOT send emails automatically

### Step 4: Verify Recipient Resolution

**Check logs for:**
```
SMTP integration not found
No valid recipients found
Failed to send email
```

**Common issues:**
1. **Variable not resolved**: `${result.vendor_email}` not replaced
   - **Fix**: Ensure agent result includes `vendor_email` field
   
2. **Recipient type wrong**: Using wrong recipient type
   - **Fix**: Use `"type": "custom"` for direct email addresses or variables

3. **Email format invalid**: Resolved value doesn't contain "@"
   - **Fix**: Check that variable resolves to valid email address

### Step 5: Check Backend Logs

**Check for email-related logs:**
```bash
cd backend
tail -100 logs/application.log | grep -i email
```

**Look for:**
- `Email sent to ...` - Success
- `SMTP integration not found` - Integration not configured
- `No valid recipients found` - Recipient resolution failed
- `Failed to send email` - SMTP error

## Common Issues

### Issue 1: "SMTP integration not configured"

**Cause**: No SMTP integration in database.

**Solution**:
1. Go to `/integrations` page
2. Configure SMTP
3. Verify status is "active"

### Issue 2: "No valid recipients found"

**Cause**: Recipient variable not resolved or invalid.

**Solution**:
1. Check recipient configuration in flow
2. Verify variable syntax: `${result.vendor_email}`
3. Ensure agent result includes the field
4. Check logs for recipient resolution errors

### Issue 3: Email sent but not received

**Possible causes**:
1. **Spam folder**: Check spam/junk folder
2. **SMTP server issue**: Test SMTP connection in `/integrations`
3. **Wrong email address**: Verify recipient email is correct
4. **Email service error**: Check backend logs for SMTP errors

### Issue 4: Variable not replaced

**Cause**: Variable syntax incorrect or field missing in result.

**Solution**:
1. Use correct syntax: `${result.field_name}` or `${context.field_name}`
2. Ensure field exists in agent execution result
3. Check variable replacement in logs

## Testing Email Configuration

### Test 1: Verify SMTP Integration

```python
# In Python shell
from app.core.database import SessionLocal
from app.models.integration import Integration, IntegrationType

db = SessionLocal()
integration = db.query(Integration).filter(
    Integration.integration_type == IntegrationType.SMTP.value,
    Integration.is_active == True
).first()

if integration:
    print(f"SMTP Integration: {integration.name}")
    print(f"Status: {integration.status}")
    print(f"Config: {list(integration.config.keys())}")
else:
    print("No SMTP integration found")
```

### Test 2: Test Email Sending

1. Go to `/integrations`
2. Click "Test Connection" for SMTP
3. Should send test email to configured SMTP user

### Test 3: Check Flow Email Config

```python
# Check if flow has email configured
from app.core.database import SessionLocal
from app.models.agentic_flow import AgenticFlow

db = SessionLocal()
flow = db.query(AgenticFlow).filter(AgenticFlow.name == "Your Flow Name").first()

if flow:
    nodes = flow.flow_definition.get('nodes', [])
    for node in nodes:
        agentic_config = node.get('agenticConfig', {})
        email_config = agentic_config.get('email', {})
        print(f"Email enabled: {email_config.get('enabled')}")
        print(f"Recipients: {email_config.get('recipients')}")
```

## Debugging Steps

1. **Check Flow Execution Result**:
   - Look for `_email_sent` field in execution result
   - Should show: `{"sent": true, "results": [...]}` or error message

2. **Check Backend Logs**:
   ```bash
   tail -f backend/logs/application.log | grep -i email
   ```

3. **Verify Recipient Resolution**:
   - Check logs for: "Resolved recipient: ..."
   - Should show actual email address, not variable

4. **Test SMTP Connection**:
   - Use "Test Connection" in `/integrations`
   - Verify email is received

## Quick Checklist

- [ ] SMTP configured in `/integrations` page
- [ ] SMTP status is "active"
- [ ] Flow has email configured in `agenticConfig`
- [ ] Email `enabled: true` in flow
- [ ] `send_on: "after"` (or appropriate timing)
- [ ] Recipients configured correctly
- [ ] Recipient variables resolve to valid emails
- [ ] Agent executed through flow (not directly)
- [ ] Check spam folder
- [ ] Check backend logs for errors

## Still Not Working?

1. **Check execution result** for `_email_sent` field
2. **Review backend logs** for detailed error messages
3. **Test SMTP connection** in `/integrations` page
4. **Verify recipient email** is correct and valid
5. **Check variable resolution** in logs

---

**Remember**: Email is only sent when:
1. Executed through a **flow** (not direct agent execution)
2. Flow has **email enabled** in `agenticConfig`
3. SMTP integration is **configured and active**
4. Recipients are **resolved correctly**
