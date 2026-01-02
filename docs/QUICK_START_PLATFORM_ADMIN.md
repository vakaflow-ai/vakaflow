# Quick Start: Platform Admin & User Management

## 🎯 Overview

The VAKA Platform now has a complete two-tier administration system:
- **Platform Administrators**: Create tenants and manage the entire platform
- **Tenant Administrators**: Manage users and settings for their company/tenant

---

## 🚀 Step-by-Step Setup

### Step 1: Create Platform Admin

Run the script to create your first platform admin:

```bash
./create_platform_admin.sh [email] [password] [name]
```

**Example:**
```bash
./create_platform_admin.sh admin@vaka.com SecurePass123 "Platform Admin"
```

**Default values (if not specified):**
- Email: `platform-admin@vaka.com`
- Password: `admin123`
- Name: `Platform Administrator`

### Step 2: Login as Platform Admin

1. Open your browser: `http://localhost:3000/login`
2. Enter the platform admin credentials you just created
3. You'll be redirected to the dashboard

### Step 3: Create a Tenant

1. Navigate to **"Tenant Management"** in the sidebar (🏢 icon)
   - Or go directly to: `http://localhost:3000/admin/tenants`
2. Click **"+ Create Tenant"**
3. Fill in the form:
   - **Company Name**: e.g., "Acme Corporation"
   - **Slug**: e.g., "acme-corp" (auto-generated from name)
   - **Contact Email**: e.g., "admin@acme.com"
   - **License Tier**: Select from Trial, Basic, Professional, Enterprise
   - **Max Agents/Users**: Set limits or leave blank for unlimited
4. **Optional: Assign Tenant Admin**
   - Enter tenant admin email
   - Enter admin name and password
   - This creates a new user and assigns them as tenant admin
5. Click **"Create Tenant"**

### Step 4: Activate Tenant

1. Find the newly created tenant in the list
2. Click **"Activate"** to change status from "pending" to "active"
3. Click **"Complete Onboarding"** to finalize setup

### Step 5: Tenant Admin Creates Users

1. **Login as Tenant Admin** (using credentials from Step 3)
2. Navigate to **"User Management"** in the sidebar (👥 icon)
   - Or go directly to: `http://localhost:3000/admin/users`
3. Click **"+ Add User"**
4. Fill in user details:
   - Name, Email, Password
   - Select Role (Security Reviewer, Compliance Reviewer, Vendor User, etc.)
5. Click **"Create User"**

---

## 📋 Available User Roles

### Admin Roles
- **Platform Admin**: Full platform access (can only be created by platform admins)
- **Tenant Admin**: Full tenant access
- **Policy Admin**: Policy management
- **Integration Admin**: Integration management
- **User Admin**: User management

### Reviewer Roles
- **Security Reviewer**: Security reviews
- **Compliance Reviewer**: Compliance reviews
- **Technical Reviewer**: Technical reviews
- **Business Reviewer**: Business reviews

### Other Roles
- **Approver**: Final approval authority
- **Vendor User**: Can submit agents
- **End User**: Basic access

---

## 🔐 Access Control

### Platform Admin Can:
- ✅ Create and manage all tenants
- ✅ Assign tenant admins
- ✅ View all tenant data
- ✅ Create users for any tenant
- ✅ Manage platform-wide settings

### Tenant Admin Can:
- ✅ Create users for their tenant only
- ✅ Manage tenant settings
- ✅ Configure policies and integrations
- ✅ View all data within their tenant
- ❌ Cannot access other tenants' data
- ❌ Cannot create platform admins

---

## 🛠️ API Endpoints

### Tenant Management (Platform Admin Only)
- `POST /api/v1/tenants` - Create tenant
- `GET /api/v1/tenants` - List all tenants
- `GET /api/v1/tenants/{id}` - Get tenant details
- `PATCH /api/v1/tenants/{id}` - Update tenant
- `POST /api/v1/tenants/{id}/complete-onboarding` - Complete onboarding

### User Management (Tenant Admin, User Admin, Platform Admin)
- `POST /api/v1/users` - Create user
- `GET /api/v1/users` - List users (filtered by tenant)
- `GET /api/v1/users/{id}` - Get user details
- `PATCH /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user

---

## 📍 Frontend Routes

- `/admin/tenants` - Tenant Management (Platform Admin)
- `/admin/users` - User Management (Admins)
- `/admin` - Admin Dashboard

---

## ⚠️ Important Notes

1. **Platform Admin Role**: Only existing platform admins can create other platform admins
2. **Tenant Isolation**: Tenant admins can only see/manage users in their tenant
3. **User Limits**: Enforced based on tenant license tier
4. **Password Requirements**: Minimum 8 characters, must contain letters and numbers
5. **Email Uniqueness**: Each email can only be used once across the platform

---

## 🐛 Troubleshooting

### "Platform admin access required"
- Ensure you're logged in as a user with `platform_admin` role
- Check user role: Run `./create_platform_admin.sh` again or check database

### "User limit reached"
- Check tenant's `max_users` setting
- Upgrade license tier or contact platform admin

### "Access denied" when creating users
- Ensure you're a `tenant_admin`, `user_admin`, or `platform_admin`
- Verify you belong to a tenant (for tenant admins)

### Can't see Tenant Management link
- Only visible to users with `platform_admin` role
- Check your role in the user menu

---

## 📚 Additional Resources

- Full documentation: `PLATFORM_ADMIN_GUIDE.md`
- API docs: `http://localhost:8000/api/docs`
- Backend logs: `backend/logs/application.log`

---

## ✅ Verification Checklist

- [ ] Platform admin created successfully
- [ ] Can login as platform admin
- [ ] Can access Tenant Management page
- [ ] Can create a new tenant
- [ ] Can assign tenant admin during tenant creation
- [ ] Tenant admin can login
- [ ] Tenant admin can access User Management
- [ ] Tenant admin can create users
- [ ] Users can login with their credentials

---

**Ready to go!** 🎉

