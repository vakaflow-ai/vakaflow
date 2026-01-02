# Quick Fix: Studio Not Showing Agents

## ✅ What's Fixed

1. **Navigation Menu**: Studio link added back to "Operations" section
2. **Error Handling**: Added error display in Studio page
3. **Debug Logging**: Added console logs to help diagnose issues

## 🔍 How to Debug

### Step 1: Open Browser Console

1. Open your browser DevTools (F12 or Cmd+Option+I)
2. Go to **Console** tab
3. Navigate to `/studio` page
4. Look for debug logs starting with `=== Studio Debug Info ===`

### Step 2: Check Network Tab

1. Go to **Network** tab in DevTools
2. Filter by "studio" or "agents"
3. Find the request to `/api/v1/studio/agents`
4. Check:
   - **Status**: Should be 200 (green)
   - **Response**: Should show array of agents
   - **Headers**: Should include `Authorization: Bearer ...`

### Step 3: Common Issues

#### Issue: 401 Unauthorized
**Cause**: Not logged in or token expired  
**Fix**: Log out and log back in

#### Issue: 403 Forbidden
**Cause**: User doesn't have tenant_id or not admin  
**Fix**: Make sure you're logged in as admin with tenant assigned

#### Issue: Empty Array []
**Cause**: No agents for your tenant  
**Fix**: Run seed script or create agents via API

#### Issue: Network Error
**Cause**: Backend not running or CORS issue  
**Fix**: Check backend is running at http://localhost:8000

## 🚀 Quick Test

In browser console, run:
```javascript
// Test API directly
fetch('/api/v1/studio/agents', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
})
.then(r => {
  console.log('Status:', r.status)
  return r.json()
})
.then(data => {
  console.log('Agents:', data)
  console.log('Count:', data.length)
})
.catch(err => console.error('Error:', err))
```

## 📋 Expected Result

You should see 4 agents:
1. AI GRC Agent
2. Assessment Agent  
3. Vendor Agent
4. Compliance Reviewer Agent

Each with their skills displayed as badges.

## 🔧 If Still Not Working

1. **Check backend logs**: `tail -f backend/logs/application.log`
2. **Verify database**: Agents exist and are active
3. **Check authentication**: Token is valid
4. **Hard refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

Share the console output or network response if you need more help!
