# 🚀 Quick Start Guide

## Default Login Credentials

**Email:** `vendor@example.com`  
**Password:** `admin123`

**Login URL:** http://localhost:3000/login

---

## First Time Setup

### 1. Start Services
```bash
./manage.sh start
```

### 2. Create User (if not already created)

**Option A: Using API (Recommended)**
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

**Option B: Using API Docs**
1. Visit http://localhost:8000/api/docs
2. Find POST `/api/v1/auth/register`
3. Click "Try it out"
4. Use the JSON above
5. Click "Execute"

### 3. Login
1. Visit http://localhost:3000/login
2. Enter credentials:
   - Email: `vendor@example.com`
   - Password: `admin123`

### 4. Submit Your First Agent
1. Click "Submit New Agent"
2. Fill in the form
3. Submit!

---

## Service Management

```bash
# Start everything
./manage.sh start

# Stop everything
./manage.sh stop

# Restart everything
./manage.sh restart

# Check status
./manage.sh status
```

---

## URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs

---

**That's it! You're ready to go! 🎉**
