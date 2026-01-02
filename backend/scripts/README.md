# Database Scripts

## Overview

This directory contains scripts for database schema management and seeding.

## Scripts

### 1. `sync_schema.py`
**Purpose**: Creates all database tables from SQLAlchemy models

**Usage**:
```bash
cd backend
source venv/bin/activate
python3 scripts/sync_schema.py
```

**What it does**:
- Imports all model files to register them with SQLAlchemy
- Compares tables in metadata vs database
- Creates any missing tables
- Reports final schema status

**Output**: Creates all missing tables and reports status

---

### 2. `seed_database.py`
**Purpose**: Seeds initial data for the application

**Usage**:
```bash
cd backend
source venv/bin/activate
python3 scripts/seed_database.py
```

**What it does**:
- Creates platform admin user (if not exists)
- Creates default tenant (if not exists)
- Seeds default workflow configurations
- Seeds master data lists (Question Categories, Requirement Categories, Departments, Locations)

**Output**: Initial data seeded

---

### 2a. `seed_master_data.py`
**Purpose**: Seeds master data lists for all tenants (can be run independently)

**Usage**:
```bash
cd backend
source venv/bin/activate
python3 scripts/seed_master_data.py
```

**What it does**:
- Seeds Question Categories (10 categories: compliance, security, risk_management, etc.)
- Seeds Requirement Categories (10 categories: regulatory, security, privacy, etc.)
- Seeds Departments (15 departments: IT, Security, Compliance, Legal, etc.)
- Seeds Locations (17 locations: regions and countries)
- Updates existing lists if they already exist (merges new values)
- Creates lists as non-system (users can edit/delete them)

**Output**: Master data lists seeded for all active tenants

---

### 3. `init_database.py`
**Purpose**: Complete database initialization (schema sync + seeding)

**Usage**:
```bash
cd backend
source venv/bin/activate
python3 scripts/init_database.py
```

**What it does**:
1. Runs `sync_schema.py` to create all tables
2. Runs `seed_database.py` to seed initial data

**Output**: Complete database initialization

---

## Quick Start

For a fresh database setup:
```bash
cd backend
source venv/bin/activate
python3 scripts/init_database.py
```

This will:
1. ✅ Create all 51 tables from models
2. ✅ Seed platform admin user
3. ✅ Seed default tenant
4. ✅ Seed default workflows
5. ✅ Seed master data lists (Question Categories, Departments, Locations, etc.)

---

## Schema Details

### Total Tables: 51 (plus alembic_version = 52)

**Core (6)**:
- users, tenants, vendors, agents, agent_metadata, agent_artifacts

**Workflow & Tickets (4)**:
- workflow_configurations, onboarding_requests, tickets, ticket_activities

**Integrations & API (6)**:
- integrations, integration_events, api_tokens, scim_configurations, api_gateway_sessions, api_gateway_request_logs

**Vendor Management (3)**:
- vendor_invitations, vendor_ratings, vendor_reviews

**Multi-Tenancy (3)**:
- license_features, tenant_features

**Communication (1)**:
- messages

**MFA (2)**:
- mfa_configs, mfa_attempts

**Audit (1)**:
- audit_logs

**Reviews (2)**:
- reviews, review_stages

**Compliance & Policies (7)**:
- compliance_frameworks, framework_risks, framework_rules, agent_framework_links, requirement_responses, policies, compliance_checks

**Submissions (2)**:
- submission_requirements, submission_requirement_responses

**Master Data (1)**:
- master_data_lists

**Agent Connections (1)**:
- agent_connections

**Webhooks (2)**:
- webhooks, webhook_deliveries

**Adoption (2)**:
- adoption_metrics, adoption_events

**Offboarding (2)**:
- offboarding_requests, knowledge_extractions

**Approvals (3)**:
- approval_workflows, approval_instances, approval_steps

**Workflow (1)**:
- approver_groups

**Prompt Usage (2)**:
- prompt_usage, cost_aggregations

**Configuration (1)**:
- platform_configurations

**OTP (1)**:
- otp_codes

---

## Troubleshooting

### Tables Not Created
- Ensure all model files are imported in `sync_schema.py`
- Check database connection
- Verify SQLAlchemy models inherit from `Base`

### Seeding Fails
- Check if tables exist (run `sync_schema.py` first)
- Verify database connection
- Check for constraint violations

### Import Errors
- Ensure virtual environment is activated
- Verify all dependencies are installed
- Check Python path

---

## Maintenance

### Adding New Models
1. Create model file in `app/models/`
2. Add import to `sync_schema.py`
3. Run `sync_schema.py` to create table

### Updating Schema
- Use Alembic migrations for schema changes
- Use `sync_schema.py` only for initial setup or missing tables

---

**Last Updated**: 2025-12-07  
**Total Tables**: 51 (52 with alembic_version)

