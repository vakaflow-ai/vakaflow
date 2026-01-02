# 🔐 Feature Gating & Licensing System

## Overview

The platform now includes a comprehensive feature gating and licensing system for multi-tenant SaaS operations.

## Components

### 1. Tenant Management ✅
- **Tenant Model**: Multi-tenant architecture with schema-per-tenant support
- **Tenant Status**: pending, active, suspended, cancelled
- **Onboarding Status**: not_started, in_progress, completed
- **License Tiers**: trial, basic, professional, enterprise

### 2. Feature Gating ✅
- **Feature Definitions**: 11+ features defined
- **Tier-Based Access**: Features assigned to license tiers
- **Tenant Overrides**: Platform admins can override features per tenant
- **Time-Limited Features**: Support for expiring features
- **Platform Admin Bypass**: Platform admins have access to all features

### 3. License Management ✅
- **License Tiers**: 
  - **Trial**: Basic features, limited agents/users
  - **Basic**: Core features
  - **Professional**: Advanced features (RAG, compliance, analytics)
  - **Enterprise**: All features, unlimited, white-label, SSO

### 4. Resource Limits ✅
- **Agent Limits**: Configurable per tenant
- **User Limits**: Configurable per tenant
- **Unlimited Feature**: Enterprise tier bypasses limits

### 5. Platform Admin APIs ✅
- **Tenant CRUD**: Create, read, update tenants
- **Feature Management**: Enable/disable features per tenant
- **Onboarding Control**: Complete tenant onboarding
- **Status Management**: Activate, suspend, cancel tenants

### 6. Customer Onboarding ✅
- **Onboarding Request**: Public endpoint for new customers
- **Onboarding Status**: Track progress through steps
- **Automated Setup**: Create vendor, configure features
- **Progress Tracking**: Step-by-step onboarding progress

## Feature Definitions

| Feature | Trial | Basic | Professional | Enterprise |
|---------|-------|-------|--------------|------------|
| RAG Search | ❌ | ❌ | ✅ | ✅ |
| Automated Compliance | ❌ | ❌ | ✅ | ✅ |
| AI Recommendations | ❌ | ❌ | ❌ | ✅ |
| Multi-Stage Review | ❌ | ❌ | ✅ | ✅ |
| Custom Workflows | ❌ | ❌ | ❌ | ✅ |
| Advanced Analytics | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ |
| SSO Integration | ❌ | ❌ | ❌ | ✅ |
| White Label | ❌ | ❌ | ❌ | ✅ |
| Unlimited Agents | ❌ | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ❌ | ✅ |

## API Endpoints

### Platform Admin Only
- `POST /api/v1/tenants` - Create tenant
- `GET /api/v1/tenants` - List tenants
- `GET /api/v1/tenants/{id}` - Get tenant
- `PATCH /api/v1/tenants/{id}` - Update tenant
- `POST /api/v1/tenants/{id}/features` - Update feature
- `POST /api/v1/tenants/{id}/complete-onboarding` - Complete onboarding

### Public/Customer
- `POST /api/v1/onboarding/request` - Request onboarding
- `GET /api/v1/onboarding/status/{id}` - Get onboarding status
- `POST /api/v1/onboarding/{id}/setup` - Complete setup

## Usage Examples

### Check Feature Access
```python
from app.core.feature_gating import FeatureGate

# Check if feature is enabled
enabled = FeatureGate.is_feature_enabled(
    db=db,
    tenant_id=str(tenant.id),
    feature_key="rag_search",
    user=current_user
)

# Check agent limit
can_create, count = FeatureGate.check_agent_limit(db, str(tenant.id))
```

### Platform Admin: Create Tenant
```bash
curl -X POST "http://localhost:8000/api/v1/tenants" \
  -H "Authorization: Bearer <platform_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp",
    "contact_email": "admin@acme.com",
    "license_tier": "professional",
    "max_agents": 100,
    "max_users": 50
  }'
```

### Customer: Request Onboarding
```bash
curl -X POST "http://localhost:8000/api/v1/onboarding/request" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "contact_email": "admin@acme.com",
    "contact_name": "John Doe",
    "license_tier": "professional"
  }'
```

## Integration Points

### Agent Creation
- Checks agent limit before creation
- Returns error if limit exceeded

### RAG Operations
- Checks "rag_search" feature before allowing
- Returns upgrade message if not available

### Review Workflow
- Checks "multi_stage_review" feature
- Enforces tier-based access

## Next Steps

1. **Database Migration**: Run migration to create tenant tables
2. **Platform Admin UI**: Build admin portal for tenant management
3. **Billing Integration**: Connect to payment processor
4. **Usage Tracking**: Track feature usage for billing
5. **License Expiration**: Handle license renewals

---

**Feature gating and licensing system is ready! 🎉**

