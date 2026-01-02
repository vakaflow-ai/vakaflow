# 🔐 Default Login Credentials

## Create Your First User

**There is no default user yet.** You need to create one first. Here's how:

### ✅ Easiest Method: Use API Documentation

1. **Open API Docs**: http://localhost:8000/api/docs

2. **Find**: `POST /api/v1/auth/register` 

3. **Click**: "Try it out"

4. **Paste this JSON**:
```json
{
  "email": "vendor@example.com",
  "name": "Default Vendor",
  "password": "admin123",
  "role": "vendor_user"
}
```

5. **Click**: "Execute"

6. **You should see**: A success response with user details

---

## After Registration

**Login Credentials:**
- **Email:** `vendor@example.com`
- **Password:** `admin123`

**Login at:** http://localhost:3000/login

---

## Alternative: Command Line

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@example.com",
    "name": "Default Vendor",
    "password": "admin123",
    "role": "vendor_user"
  }'
```

---

## Password Requirements

- ✅ Minimum 8 characters
- ✅ At least one letter  
- ✅ At least one number

The password `admin123` meets all requirements.

---

**⚠️ Important:** Change the password after first login for security!

