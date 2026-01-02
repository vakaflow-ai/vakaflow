# Migration Instructions - Industry Filtering

## Error
```
ProgrammingError - (psycopg2.errors.UndefinedColumn) column tenants.industry does not exist
```

This error occurs because the database migrations haven't been run yet.

## Solution

Run the database migrations to add the new columns:

### Option 1: Using the migration script
```bash
cd backend
./run_migrations.sh
```

### Option 2: Manual migration
```bash
cd backend
source venv/bin/activate  # or: source .venv/bin/activate
alembic upgrade head
```

### Option 3: Using init_db.sh (if database needs full initialization)
```bash
cd backend
./init_db.sh
```

## Migrations to Run

The following migrations will be applied:

1. **add_tenant_profile_fields** - Adds `industry`, `timezone`, `locale`, `i18n_settings` to `tenants` table
2. **add_industry_filtering** - Adds `applicable_industries` to `submission_requirements` and `compliance_frameworks` tables

## Verify Migration

After running migrations, verify the columns exist:

```sql
-- Check tenants table
\d tenants

-- Should show:
-- industry | character varying(100) | nullable
-- timezone | character varying(50) | nullable
-- locale | character varying(10) | nullable
-- i18n_settings | json | nullable

-- Check submission_requirements table
\d submission_requirements

-- Should show:
-- applicable_industries | json | nullable

-- Check compliance_frameworks table
\d compliance_frameworks

-- Should show:
-- applicable_industries | json | nullable
```

## Temporary Fix

I've added safety checks in the code to handle missing columns gracefully. The application will work without the migrations, but industry filtering won't be active until migrations are run.

## After Migration

Once migrations are complete:
1. Restart the backend server
2. Industry filtering will automatically activate
3. Tenants will only see requirements/frameworks/templates applicable to their industry
