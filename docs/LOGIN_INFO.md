# 🔐 Login Information

## How to Create Your First User

Since there's no default user yet, you need to create one. Here are two easy ways:

### Method 1: Using API Documentation (Easiest)

1. **Visit the API Docs**: http://localhost:8000/api/docs

2. **Find the Register endpoint**: Look for `POST /api/v1/auth/register`

3. **Click "Try it out"**

4. **Enter this JSON**:
```json
{
  "email": "vendor@example.com",
  "name": "Test Vendor",
  "password": "admin123",
  "role": "vendor_user"
}
```

5. **Click "Execute"**

6. **You should see a success response** with user details

### Method 2: Using curl Command

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@example.com",
    "name": "Test Vendor",
    "password": "admin123",
    "role": "vendor_user"
  }'
```

---

## After Creating User

**Login Credentials:**
- **Email:** `vendor@example.com`
- **Password:** `admin123`

**Login URL:** http://localhost:3000/login

---

## Available Roles

- `vendor_user` - For vendors submitting agents
- `reviewer` - For reviewing agent submissions  
- `compliance_officer` - For compliance reviews
- `tenant_admin` - Tenant administrator
- `platform_admin` - Platform administrator

---

## Password Requirements

- Minimum 8 characters
- At least one letter
- At least one number

---

**Note:** The default password `admin123` meets these requirements. Change it after first login for security!

