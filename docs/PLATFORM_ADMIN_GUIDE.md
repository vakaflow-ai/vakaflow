# Platform Admin & User Management Guide

## Overview

The VAKA Platform uses a two-tier administration model:
1. **Platform Administrators** (Super Admins) - Can create tenants and manage the entire platform
2. **Tenant Administrators** - Can manage users and settings for their specific tenant/company

---

## Platform Admin (Super Admin)

### Creating a Platform Admin

Run the script to create the initial platform admin:

```bash
./create_platform_admin.sh [email] [password] [name]
```

**Default values:**
- Email: `platform-admin@vaka.com`
- Password: `admin123`
- Name: `Platform Administrator`

**Example:**
```bash
./create_platform_admin.sh admin@vaka.com SecurePass123 "Platform Admin"
```

### Platform Admin Capabilities

Platform admins can:
- ✅ Create and manage tenants
- ✅ Assign tenant admins when creating tenants
- ✅ View all tenant data across the platform
- ✅ Manage platform-wide settings
- ✅ Manage features and licensing for tenants
- ✅ Create users for any tenant
- ✅ Access all platform features

### Platform Admin API Endpoints

All tenant management endpoints require platform admin role:
- `POST /api/v1/tenants` - Create tenant
- `GET /api/v1/tenants` - List all tenants
- `GET /api/v1/tenants/{tenant_id}` - Get tenant details
- `PATCH /api/v1/tenants/{tenant_id}` - Update tenant
- `POST /api/v1/tenants/{tenant_id}/features` - Update tenant features
- `POST /api/v1/tenants/{tenant_id}/complete-onboarding` - Complete tenant onboarding

---

## Tenant Creation & Admin Assignment

### Creating a Tenant with Tenant Admin

When creating a tenant, you can assign a tenant admin in two ways:

#### Option 1: Assign Existing User as Tenant Admin

```json
POST /api/v1/tenants
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "contact_email": "admin@acme.com",
  "contact_name": "John Doe",
  "license_tier": "professional",
  "max_agents": 100,
  "max_users": 50,
  "tenant_admin_email": "admin@acme.com"  // Existing user email
}
```

#### Option 2: Create New User as Tenant Admin

```json
POST /api/v1/tenants
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "contact_email": "admin@acme.com",
  "contact_name": "John Doe",
  "license_tier": "professional",
  "max_agents": 100,
  "max_users": 50,
  "tenant_admin_email": "admin@acme.com",      // New user email
  "tenant_admin_name": "John Doe",             // Required for new user
  "tenant_admin_password": "SecurePass123"     // Required for new user
}
```

---

## Tenant Admin User Management

### Tenant Admin Capabilities

Tenant admins can:
- ✅ Create users for their tenant
- ✅ Update user roles (except platform_admin)
- ✅ Deactivate/activate users
- ✅ View all users in their tenant
- ✅ Manage tenant-specific settings
- ✅ Configure policies, integrations, and workflows

### User Management API

Tenant admins (and user admins) can use the user management API:

#### Create User

```json
POST /api/v1/users
{
  "email": "user@acme.com",
  "name": "Jane Doe",
  "password": "SecurePass123",
  "role": "security_reviewer"
}
```

**Available Roles:**
- `tenant_admin` - Full tenant access
- `policy_admin` - Policy management
- `integration_admin` - Integration management
- `user_admin` - User management
- `security_reviewer` - Security reviews
- `compliance_reviewer` - Compliance reviews
- `technical_reviewer` - Technical reviews
- `business_reviewer` - Business reviews
- `approver` - Final approval
- `vendor_user` - Vendor agent submissions
- `end_user` - End user access

**Note:** `platform_admin` role can only be assigned by platform admins.

#### List Users

```
GET /api/v1/users?tenant_id={uuid}&role_filter=security_reviewer
```

#### Update User

```json
PATCH /api/v1/users/{user_id}
{
  "name": "Jane Smith",
  "role": "compliance_reviewer",
  "is_active": true
}
```

#### Delete User

```
DELETE /api/v1/users/{user_id}
```

**Restrictions:**
- Cannot delete your own account
- Tenant admins cannot delete platform admins
- Tenant admins can only manage users in their tenant

---

## User Limit Checking

The system automatically checks user limits based on tenant license:

- **Trial**: Limited users (configurable)
- **Basic**: Limited users (configurable)
- **Professional**: Limited users (configurable)
- **Enterprise**: Unlimited users (if `unlimited_agents` feature enabled)

When creating a user, the system checks:
1. Current user count for the tenant
2. Maximum users allowed (`max_users` field on tenant)
3. Returns error if limit reached

---

## Workflow Example

### 1. Create Platform Admin

```bash
./create_platform_admin.sh admin@vaka.com SecurePass123 "Platform Admin"
```

### 2. Login as Platform Admin

Login at `http://localhost:3000/login` with:
- Email: `admin@vaka.com`
- Password: `SecurePass123`

### 3. Create Tenant with Tenant Admin

Use the tenant creation API or UI to create a tenant and assign a tenant admin.

### 4. Tenant Admin Creates Users

The tenant admin logs in and can now:
- Create users for their company
- Assign appropriate roles
- Manage user access

---

## Security Notes

1. **Platform Admin Role**: Only platform admins can create other platform admins
2. **Tenant Isolation**: Tenant admins can only see/manage users in their tenant
3. **User Limits**: Enforced based on tenant license tier
4. **Password Requirements**: Minimum 8 characters, must contain letters and numbers
5. **Role Restrictions**: Some roles (like `platform_admin`) have special restrictions

---

## API Documentation

Full API documentation available at:
- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

---

## Troubleshooting

### "Platform admin access required"
- Ensure you're logged in as a user with `platform_admin` role
- Check user role in database: `SELECT email, role FROM users WHERE email = 'your@email.com';`

### "User limit reached"
- Check tenant's `max_users` setting
- Upgrade license tier or contact platform admin to increase limit

### "Access denied" when creating users
- Ensure you're a `tenant_admin`, `user_admin`, or `platform_admin`
- Verify you belong to a tenant (for tenant admins)

