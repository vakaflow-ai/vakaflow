# 🌱 Seed Data Guide

## Overview

The seed data script populates the database with essential policies, compliance rules, and review stage configurations needed for the platform to function.

## Quick Start

```bash
cd backend
source venv/bin/activate
python3 scripts/seed_data.py
```

## What Gets Seeded

### 1. Policies (8 policies)

#### Regulatory Policies
- **GDPR Compliance Policy** - EU data protection (EU region)
- **HIPAA Compliance Policy** - US healthcare data (US region)
- **CCPA Compliance Policy** - California privacy (US-CA region)
- **PCI DSS Compliance** - Payment card security (Global)

#### Standards
- **SOC 2 Type II Compliance** - Security and availability (Global)
- **ISO 27001 Security Controls** - Information security management (Global)

#### Internal Policies
- **Internal Security Policy** - Company security standards (Global)
- **Data Privacy Policy** - General privacy requirements (Global)

Each policy includes:
- Requirements list
- Rules (JSON) for automated compliance checking
- Region and version information

### 2. Review Stages (4 stages)

1. **Security Review** (order_index: 1)
   - Authentication, authorization, encryption
   - Vulnerability management
   - Security logging

2. **Compliance Review** (order_index: 2)
   - Regulatory compliance
   - Policy adherence
   - Data privacy

3. **Technical Review** (order_index: 3)
   - Architecture and design
   - Performance and scalability
   - Code quality

4. **Business Review** (order_index: 4)
   - Business value and ROI
   - Use cases and alignment
   - Risk assessment

### 3. Compliance Rules

Rules are embedded in policy definitions as JSON structures, including:
- Validation criteria
- Required vs optional requirements
- Automated checking logic
- Evidence requirements

## Usage

### First Time Setup

```bash
# Start services
./manage.sh start

# Run migrations (if needed)
cd backend
source venv/bin/activate
alembic upgrade head

# Seed data
python3 scripts/seed_data.py
```

### Re-running Seed Data

The script is idempotent - safe to run multiple times:
- Checks for existing records
- Skips duplicates
- Only creates new records

```bash
cd backend
source venv/bin/activate
python3 scripts/seed_data.py
```

## Output

The script provides detailed output:

```
============================================================
🌱 Seeding Policies, Compliance Rules, and Review Stages
============================================================

🌱 Seeding policies...
  ✓ Created policy: GDPR Compliance Policy
  ✓ Created policy: SOC 2 Type II Compliance
  ...
✅ Seeded 8 policies

🌱 Seeding review stages...
  ✓ Created review stage: security
  ✓ Created review stage: compliance
  ...
✅ Seeded 4 review stages

✅ Seed data creation complete!
```

## Verification

After seeding, verify the data:

```bash
# Check policies
curl http://localhost:8000/api/v1/compliance/policies

# Check review stages (via database or API)
```

## Customization

To add custom policies or modify existing ones:

1. Edit `backend/scripts/seed_data.py`
2. Add/modify policy data in `policies_data` list
3. Run the seed script again

## Troubleshooting

### Error: "Policy already exists"
- This is normal - the script skips existing records
- Safe to ignore

### Error: "Database connection failed"
- Ensure PostgreSQL is running: `./manage.sh status`
- Check database URL in `.env` file

### Error: "Table does not exist"
- Run migrations first: `alembic upgrade head`

## Integration with Project Rules

See `PROJECT_RULES.md` for:
- Seed data management rules
- Policy update procedures
- Compliance rule guidelines
- Review stage configuration

---

**Note**: Seed data is platform-wide (no tenant_id). For tenant-specific policies, create them via the API or admin interface.

