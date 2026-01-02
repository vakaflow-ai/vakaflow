# Studio Troubleshooting Guide

## Current Status

✅ **Database**: 4 agentic agents exist  
✅ **Route**: `/studio` route exists in App.tsx  
✅ **Navigation**: Studio link added to Operations menu  
⚠️ **Issue**: Agents not showing in Studio page

## Debugging Steps

### 1. Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab**: Look for errors from Studio page
- **Network tab**: Check if `/api/v1/studio/agents` request is being made
  - Status code should be 200
  - Response should contain array of agents

### 2. Verify Authentication

The Studio API requires authentication. Make sure:
- You're logged in as an admin user
- Your session token is valid
- Check Network tab for 401/403 errors

### 3. Direct URL Access

Try accessing Studio directly:
```
http://localhost:3000/studio
```

### 4. Check API Response

In browser console, run:
```javascript
// Check if API is accessible
fetch('/api/v1/studio/agents', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### 5. Verify Agents in Database

Agents should have:
- `status = 'active'`
- `tenant_id` matching your tenant
- `skills` array populated

## Common Issues

### Issue: "No agents available" but agents exist in DB

**Possible causes:**
1. **Authentication failure**: API returns 401/403
2. **Tenant mismatch**: User's tenant_id doesn't match agent's tenant_id
3. **Status filter**: Agents might not have `status = 'active'`
4. **API error**: Check Network tab for error response

**Solution:**
- Check browser console for errors
- Verify user is logged in with correct tenant
- Check Network tab for API response

### Issue: Studio page shows loading forever

**Possible causes:**
1. API request hanging
2. CORS issue
3. Backend not responding

**Solution:**
- Check Network tab - is request pending?
- Check backend logs for errors
- Verify backend is running: `curl http://localhost:8000/health`

### Issue: Navigation link missing

**Solution:**
- Studio link is in "Operations" section
- Only visible to admins (`isAdmin = true`)
- Make sure you're logged in as `tenant_admin` or `platform_admin`

## Quick Fixes

### Re-seed Agents (if needed)

```bash
cd backend
source venv/bin/activate
python scripts/seed_agentic_agents.py
```

### Check Agent Status

```bash
cd backend
source venv/bin/activate
python -c "
from app.core.database import SessionLocal
from app.models.agentic_agent import AgenticAgent
db = SessionLocal()
agents = db.query(AgenticAgent).all()
for a in agents:
    print(f'{a.name}: status={a.status}, tenant={a.tenant_id}')
db.close()
"
```

### Restart Frontend

```bash
cd frontend
npm run dev
```

Then hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

## Expected Behavior

When Studio page loads successfully:
1. **Agents Tab** should show 4 agent cards:
   - AI GRC Agent
   - Assessment Agent
   - Vendor Agent
   - Compliance Reviewer Agent

2. Each card shows:
   - Agent name
   - Agent type
   - Description
   - Skills (as badges)
   - Source badge (blue "vaka")

3. **Flows Tab** should show empty state (no flows created yet)

## Next Steps

1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to `/studio`
4. Check for errors or debug logs
5. Go to Network tab
6. Find `/api/v1/studio/agents` request
7. Check response status and body

Share the console errors or network response if agents still don't show!
