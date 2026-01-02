# SSO Tenant Isolation Architecture

## Overview

This document explains how Single Sign-On (SSO) maintains tenant isolation in a multi-tenant environment, ensuring users from different companies can only access their own tenant's data.

## Architecture

### 1. **Tenant-Specific SSO Integrations**

Each tenant has their own SSO integration configuration:

```
Tenant A (Company A)
├── SSO Integration ID: abc-123
├── Tenant ID: tenant-a-uuid
├── Allowed Email Domains: ["companya.com", "companya.io"]
└── SSO Provider: Azure Entra ID

Tenant B (Company B)
├── SSO Integration ID: def-456
├── Tenant ID: tenant-b-uuid
├── Allowed Email Domains: ["companyb.com"]
└── SSO Provider: OKTA
```

**Key Point**: Each SSO integration is scoped to a single tenant via `integration.tenant_id`.

### 2. **Login Flow with Tenant Isolation**

```
┌─────────────┐
│ User clicks │
│ "Login with │
│  SSO"       │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Frontend: Identify Tenant│
│ - Subdomain: companya.   │
│   vaka.com              │
│ - Tenant slug in URL    │
│ - Tenant selector       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ POST /api/v1/sso/initiate│
│ {                       │
│   integration_id: abc-123│ ← Tenant A's SSO integration
│ }                       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Redirect to IdP         │
│ (Azure AD, OKTA, etc.)  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ User authenticates      │
│ at Identity Provider    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ GET /api/v1/sso/callback│
│ ?integration_id=abc-123 │ ← Still references Tenant A's integration
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Backend:                │
│ 1. Get integration      │
│    (tenant_id = A)      │
│ 2. Process SSO response │
│ 3. Extract email        │
│ 4. Validate domain      │
│ 5. Find/Create user     │
│    (tenant_id = A)      │ ← CRITICAL: User assigned to Tenant A
│ 6. Generate JWT         │
│    (includes tenant_id) │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ User logged in          │
│ - JWT includes tenant_id│
│ - All queries filtered  │
│   by tenant_id          │
└─────────────────────────┘
```

### 3. **Tenant Identification Mechanisms**

#### A. **Integration-Based (Primary)**
- Each SSO integration has `tenant_id`
- When callback is received, integration's `tenant_id` is used
- **Most Secure**: Direct mapping from integration to tenant

#### B. **Email Domain Mapping (Secondary)**
- Tenant can configure `allowed_email_domains`
- Example: `["companya.com", "companya.io"]`
- Validates user's email domain matches tenant's allowed domains
- **Security Layer**: Prevents cross-tenant access even if integration is misconfigured

#### C. **Subdomain Routing (Frontend)**
- Frontend can use subdomains: `companya.vaka.com`, `companyb.vaka.com`
- Subdomain maps to tenant slug
- Tenant slug maps to tenant_id
- **User Experience**: Users know which company they're logging into

### 4. **Security Controls**

#### **User Creation/Update**
```python
# CRITICAL: User MUST be assigned to integration's tenant
user = User(
    email=email.lower(),
    tenant_id=integration.tenant_id,  # ← From SSO integration
    ...
)

# CRITICAL: User lookup MUST be tenant-scoped
user = db.query(User).filter(
    User.email == email,
    User.tenant_id == tenant_id  # ← Tenant isolation
).first()
```

#### **Email Domain Validation**
```python
# Validate email domain is allowed for tenant
if tenant.allowed_email_domains:
    if email_domain not in tenant.allowed_email_domains:
        raise HTTPException(403, "Email domain not allowed")
```

#### **JWT Token Includes Tenant ID**
```python
access_token = create_access_token(
    data={
        "sub": user.email,
        "role": user.role.value,
        "tenant_id": str(user.tenant_id)  # ← CRITICAL for isolation
    }
)
```

#### **Token Validation**
```python
# When validating token, ensure tenant_id matches
if token_tenant_id and str(user.tenant_id) != token_tenant_id:
    raise HTTPException(403, "Tenant mismatch")
```

### 5. **Preventing Cross-Tenant Access**

#### **Scenario 1: User from Company A tries to use Company B's SSO**

**Prevention**:
1. User must know Company B's SSO integration ID
2. Even if they do, email domain validation will fail:
   - User email: `user@companya.com`
   - Company B's allowed domains: `["companyb.com"]`
   - Result: **403 Forbidden**

#### **Scenario 2: User exists in multiple tenants**

**Prevention**:
1. User lookup is tenant-scoped: `User.tenant_id == tenant_id`
2. If user exists in another tenant, creation fails:
   - Check: `User.email == email AND User.tenant_id != current_tenant_id`
   - Result: **403 Forbidden - User exists in different tenant**

#### **Scenario 3: Token manipulation**

**Prevention**:
1. JWT is signed with `SECRET_KEY`
2. Token includes `tenant_id`
3. On every request, `get_current_user()` validates:
   - Token signature
   - Token `tenant_id` matches user's `tenant_id`
   - Result: **403 Forbidden if mismatch**

### 6. **Database Queries - Automatic Tenant Filtering**

All queries automatically filter by tenant:

```python
# Example: Get agents
agents = db.query(Agent).filter(
    Agent.tenant_id == current_user.tenant_id  # ← Automatic filtering
).all()

# Example: Get users
users = db.query(User).filter(
    User.tenant_id == current_user.tenant_id  # ← Automatic filtering
).all()
```

### 7. **Configuration Example**

#### **Tenant A Configuration**
```json
{
  "tenant_id": "tenant-a-uuid",
  "name": "Company A",
  "allowed_email_domains": ["companya.com", "companya.io"],
  "sso_integration": {
    "id": "abc-123",
    "provider": "azure_entra_id",
    "tenant_id": "tenant-a-uuid"  // ← Links to Tenant A
  }
}
```

#### **Tenant B Configuration**
```json
{
  "tenant_id": "tenant-b-uuid",
  "name": "Company B",
  "allowed_email_domains": ["companyb.com"],
  "sso_integration": {
    "id": "def-456",
    "provider": "okta",
    "tenant_id": "tenant-b-uuid"  // ← Links to Tenant B
  }
}
```

### 8. **Login URLs**

#### **Option 1: Subdomain-Based**
```
https://companya.vaka.com/login
→ Identifies Tenant A
→ Uses Tenant A's SSO integration

https://companyb.vaka.com/login
→ Identifies Tenant B
→ Uses Tenant B's SSO integration
```

#### **Option 2: Tenant Selector**
```
https://vaka.com/login
→ User selects "Company A" or "Company B"
→ Frontend uses appropriate integration_id
```

#### **Option 3: Direct Integration ID**
```
https://vaka.com/login?integration_id=abc-123
→ Directly uses Tenant A's SSO integration
```

### 9. **Best Practices**

1. **Always use integration's tenant_id** - Never trust user input
2. **Validate email domains** - Additional security layer
3. **Include tenant_id in JWT** - Required for all subsequent requests
4. **Scope all queries** - Always filter by `tenant_id`
5. **Log tenant access** - Audit trail for security
6. **Use subdomains** - Better UX and security
7. **Separate SSO integrations** - One per tenant, never shared

### 10. **Migration Notes**

For existing users without `tenant_id`:
- Old tokens without `tenant_id` are logged as warnings
- Users should re-authenticate to get new tokens with `tenant_id`
- Backward compatibility maintained but logged

## Summary

**Tenant isolation in SSO is maintained through**:

1. ✅ **Integration-to-Tenant Mapping**: Each SSO integration belongs to one tenant
2. ✅ **Email Domain Validation**: Users can only login if their email domain matches tenant's allowed domains
3. ✅ **Tenant-Scoped User Lookup**: Users are found/created within their tenant context
4. ✅ **JWT Includes Tenant ID**: Token contains tenant_id for all subsequent requests
5. ✅ **Automatic Query Filtering**: All database queries filter by tenant_id
6. ✅ **Token Validation**: Every request validates tenant_id matches user's tenant_id

**Result**: Users from Company A can never access Company B's data, even if they somehow get Company B's SSO integration ID, because:
- Their email domain won't match Company B's allowed domains
- Their user account (if it exists) belongs to Tenant A
- Their JWT token contains Tenant A's ID
- All queries are filtered by tenant_id

