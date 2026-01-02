# 🔐 Default User Accounts

## Overview

The seeding script creates a comprehensive set of default users for testing and development.

## Default Users

### Platform Level (No Tenant)

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| `platform-admin@vaka.com` | `Admin123!` | `platform_admin` | Platform super administrator |

### Tenant Level (Default Tenant)

#### @vaka.com Users
| Email | Password | Role | Description |
|-------|----------|------|-------------|
| `tenant-admin@vaka.com` | `Admin123!` | `tenant_admin` | Tenant administrator |

#### @example.com Users
| Email | Password | Role | Description |
|-------|----------|------|-------------|
| `admin@example.com` | `admin123` | `tenant_admin` | Tenant administrator |
| `security@example.com` | `reviewer123` | `security_reviewer` | Security reviewer |
| `compliance@example.com` | `reviewer123` | `compliance_reviewer` | Compliance reviewer |
| `technical@example.com` | `reviewer123` | `technical_reviewer` | Technical reviewer |
| `business@example.com` | `reviewer123` | `business_reviewer` | Business reviewer |
| `approver@example.com` | `approver123` | `approver` | Final approver |
| `vendor@example.com` | `admin123` | `vendor_user` | Vendor user (submits agents) |
| `user@example.com` | `admin123` | `end_user` | End user |

## Quick Reference

### Platform Admin
- **Email**: `platform-admin@vaka.com`
- **Password**: `Admin123!`
- **Access**: Full platform access, can create tenants

### Tenant Admin
- **Email**: `tenant-admin@vaka.com`
- **Password**: `Admin123!`
- **Access**: Full tenant management

### Reviewers (@example.com)
All reviewers use password `reviewer123`:
- Security: `security@example.com`
- Compliance: `compliance@example.com`
- Technical: `technical@example.com`
- Business: `business@example.com`

### Approver
- **Email**: `approver@example.com`
- **Password**: `approver123`
- **Access**: Final approval authority

### Vendor
- **Email**: `vendor@example.com`
- **Password**: `admin123`
- **Access**: Submit and manage agents

### End User
- **Email**: `user@example.com`
- **Password**: `admin123`
- **Access**: Basic user access

## Creating Users

### Automatic (Recommended)
Run the seeding script:
```bash
cd backend
source venv/bin/activate
python3 scripts/seed_database.py
```

### Manual
Use the API or create_user.sh script:
```bash
./create_user.sh email@example.com password role_name
```

## Password Requirements

- Minimum 8 characters
- At least one letter
- At least one number

## Security Note

⚠️ **Important**: Change all default passwords in production!

---

**Last Updated**: 2025-12-07  
**Total Default Users**: 10
- 1 Platform user (@vaka.com)
- 1 Tenant admin (@vaka.com)
- 8 Tenant users (@example.com)

