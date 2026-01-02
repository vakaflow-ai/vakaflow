# 🔐 Default Credentials

## Default User (Created Automatically)

**Email:** `vendor@example.com`  
**Password:** `admin123`  
**Role:** `vendor_user`

## Login

Visit: http://localhost:3000/login

## Create Additional Users

### Option 1: Using the Script
```bash
# Create default user
./create_user.sh

# Create custom user
./create_user.sh your@email.com yourpassword vendor_user
```

### Option 2: Using API Docs
1. Visit http://localhost:8000/api/docs
2. Use POST `/api/v1/auth/register`
3. Request body:
```json
{
  "email": "your@email.com",
  "name": "Your Name",
  "password": "yourpassword123",
  "role": "vendor_user"
}
```

## Available Roles

- `vendor_user` - Vendor submitting agents
- `reviewer` - Reviews agent submissions
- `compliance_officer` - Compliance reviews
- `tenant_admin` - Tenant administrator
- `platform_admin` - Platform administrator

## Password Requirements

- Minimum 8 characters
- At least one letter
- At least one number

---

**Note:** Change the default password after first login for security!

