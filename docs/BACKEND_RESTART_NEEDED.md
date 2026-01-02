# Backend Restart Required

## Issue
The database tables (`api_tokens`, `integrations`, etc.) have been created successfully, but the backend server is still showing errors because it's using **cached database connections** from the connection pool that were established before the tables existed.

## Solution
**Restart the backend server** to refresh the connection pool and pick up the new tables.

## How to Restart

### Option 1: Manual Restart
1. Find the backend process:
   ```bash
   ps aux | grep uvicorn
   ```

2. Kill the process:
   ```bash
   pkill -f "uvicorn app.main:app"
   ```

3. Restart the backend:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Option 2: Use the Restart Script
```bash
cd backend
./restart_backend.sh
```

## Verification

After restarting, the errors should be resolved. You can verify by:
1. Checking the logs - no more "relation does not exist" errors
2. Testing the endpoints:
   - `/api/v1/vendor-invitations` - should return 200
   - `/api/v1/tickets` - should return 200
   - `/api/v1/integrations` - should return 200
   - `/api/v1/api-tokens` - should return 200

## Why This Happens

SQLAlchemy uses a connection pool to manage database connections. When the server starts, it creates a pool of connections. If tables are created after the server starts, the existing connections in the pool don't know about the new tables until the pool is refreshed (which happens on restart or when connections are recycled).

## Status

✅ **Tables Created**: All 23 tables exist in the database  
⏳ **Action Required**: Restart backend server  
✅ **After Restart**: All endpoints should work correctly

---

**Date**: 2025-12-07  
**Status**: Tables ready, restart needed

