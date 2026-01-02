# Backend Restart Required

## Issue
The form-layouts API endpoints are returning 404 errors because the backend server needs to be restarted to load the new routes.

## Solution
Restart the backend server:

### Option 1: If running with uvicorn directly
```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd backend
source venv/bin/activate  # or your virtual environment
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 2: If running with a script
```bash
# Stop the current server
# Then run your startup script again
cd backend
./start_backend.sh  # or whatever script you use
```

### Option 3: Check if auto-reload is enabled
If you're running with `--reload` flag, the server should auto-reload on file changes. However, if there was an import error, it might have failed silently.

## Verify Routes Are Loaded
After restarting, check the API docs:
- Navigate to: http://localhost:8000/api/docs
- Look for "form-layouts" tag in the API documentation
- You should see endpoints like:
  - POST /api/v1/form-layouts
  - GET /api/v1/form-layouts
  - GET /api/v1/form-layouts/field-access
  - etc.

## Check for Import Errors
If routes still don't appear after restart, check for import errors:

```bash
cd backend
source venv/bin/activate
python3 -c "from app.api.v1.form_layouts import router; print('Router loaded successfully')"
```

If you see an error, fix it before restarting the server.

## Database Tables
Also ensure the database tables are created:

```bash
cd backend
source venv/bin/activate
python3 scripts/sync_schema.py
```

This will create the `form_layouts` and `form_field_access` tables if they don't exist.
