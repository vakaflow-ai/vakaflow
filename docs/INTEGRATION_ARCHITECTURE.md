# Integration Architecture - VAKA Platform

## Core Principle

**ALL integrations must be configured and managed through the Integration API system. No local files, hardcoded values, or environment variables for integration configuration.**

## Integration System

### Storage
- **Database Table**: `integrations`
- **API Endpoints**: `/api/v1/integrations`
- **UI**: `/integrations` page (`http://localhost:3000/integrations`)

### Integration Model
```python
class Integration(Base):
    id: UUID
    tenant_id: UUID (nullable - None = platform-wide)
    name: str
    integration_type: str  # "smtp", "sso", "webhook", etc.
    status: str  # "active", "inactive", "error", "configuring"
    config: JSON  # Integration-specific configuration
    is_active: bool
    health_status: str  # "healthy", "warning", "error"
```

## Integration Types

### SMTP Email
- **Type**: `"smtp"`
- **Config Fields**: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_use_tls`, `from_email`, `from_name`
- **API**: `/api/v1/smtp-settings` (creates/updates Integration)
- **Usage**: EmailService loads from Integration table

### SSO
- **Type**: `"sso"`
- **Config Fields**: Provider-specific (SAML, OAuth, etc.)
- **API**: `/api/v1/sso-settings`
- **Usage**: AuthService loads from Integration table

### Webhooks
- **Type**: `"webhook"`
- **Config Fields**: `url`, `method`, `headers`, `auth`
- **API**: `/api/v1/integrations`
- **Usage**: AgenticActionService uses for push_data actions

### External Services
- **Types**: `"servicenow"`, `"jira"`, `"slack"`, `"teams"`, etc.
- **Config Fields**: Service-specific
- **API**: `/api/v1/integrations`
- **Usage**: Service-specific integration handlers

## Implementation Rules

### ✅ DO

1. **Always Query Integration Table**
   ```python
   integration = db.query(Integration).filter(
       Integration.integration_type == IntegrationType.SMTP.value,
       Integration.is_active == True,
       Integration.status == IntegrationStatus.ACTIVE.value,
       Integration.tenant_id == tenant_id
   ).first()
   ```

2. **Load Config from Database**
   ```python
   if integration and integration.config:
       config = integration.config
       # Use config values
   ```

3. **Support Tenant Isolation**
   - Try tenant-specific integration first
   - Fallback to platform-wide (tenant_id == None)

4. **Return Clear Errors**
   ```python
   if not integration:
       return {
           "error": "SMTP integration not configured. Please configure in /integrations page."
       }
   ```

### ❌ DON'T

1. **Never Use Environment Variables**
   ```python
   # ❌ WRONG
   smtp_host = os.getenv("SMTP_HOST")
   ```

2. **Never Hardcode Values**
   ```python
   # ❌ WRONG
   smtp_host = "smtp.example.com"
   api_key = "hardcoded-key-123"
   ```

3. **Never Use Local Files**
   ```python
   # ❌ WRONG
   with open("config.json") as f:
       config = json.load(f)
   ```

4. **Never Bypass Integration System**
   ```python
   # ❌ WRONG
   # Direct service initialization with hardcoded values
   email_service = EmailService()
   email_service.smtp_host = "hardcoded"
   ```

## Service Implementation Pattern

### EmailService Example

```python
class EmailService:
    def load_config_from_db(self, db, tenant_id: Optional[str] = None):
        """Load SMTP configuration from Integration table"""
        # Query Integration table
        integration = db.query(Integration).filter(
            Integration.integration_type == IntegrationType.SMTP.value,
            Integration.is_active == True,
            Integration.status == IntegrationStatus.ACTIVE.value,
            Integration.tenant_id == tenant_id
        ).first()
        
        if integration and integration.config:
            config = integration.config
            self.smtp_host = config.get("smtp_host")
            self.smtp_port = config.get("smtp_port")
            # ... load all config values
            return True
        
        return False  # No fallback to env vars
```

### AgenticActionService Example

```python
class AgenticActionService:
    async def execute_email_action(self, email_config, ...):
        # Load email config from Integration table
        config_loaded = self.email_service.load_config_from_db(
            self.db, 
            str(self.tenant_id)
        )
        
        if not config_loaded:
            return {
                "sent": False,
                "reason": "SMTP integration not configured. Please configure in /integrations page."
            }
        
        # Send email using integration config
        # ...
```

## Integration Lookup Priority

1. **Tenant-Specific Integration**
   - `Integration.tenant_id == current_tenant_id`
   - `Integration.is_active == True`
   - `Integration.status == "active"`

2. **Platform-Wide Integration**
   - `Integration.tenant_id == None`
   - `Integration.is_active == True`
   - `Integration.status == "active"`

3. **Not Found**
   - Return error (no fallback to env vars)
   - Clear message: "Please configure in /integrations page"

## Benefits

### ✅ Single Source of Truth
- All integration configs in one place
- Easy to manage and update
- Consistent across all services

### ✅ Tenant Isolation
- Support tenant-specific configs
- Platform-wide fallback
- Proper multi-tenant architecture

### ✅ Security
- Credentials stored securely in database
- No hardcoded secrets in code
- Encrypted in production

### ✅ Maintainability
- Centralized configuration management
- Easy to update without code changes
- Clear error messages

### ✅ Scalability
- Support multiple integrations per type
- Easy to add new integration types
- Health monitoring and status tracking

## Migration Guide

### From Environment Variables

**Before:**
```python
smtp_host = os.getenv("SMTP_HOST")
smtp_user = os.getenv("SMTP_USER")
```

**After:**
```python
integration = db.query(Integration).filter(
    Integration.integration_type == IntegrationType.SMTP.value,
    Integration.is_active == True
).first()
if integration:
    config = integration.config
    smtp_host = config.get("smtp_host")
    smtp_user = config.get("smtp_user")
```

### From Local Config Files

**Before:**
```python
with open("config/smtp.json") as f:
    config = json.load(f)
```

**After:**
```python
integration = db.query(Integration).filter(
    Integration.integration_type == IntegrationType.SMTP.value
).first()
config = integration.config if integration else {}
```

## Testing

### Test Integration Configuration

1. **Configure in UI**
   - Go to `/integrations`
   - Configure SMTP/SSO/etc.
   - Verify status shows "active"

2. **Verify in Database**
   ```sql
   SELECT * FROM integrations 
   WHERE integration_type = 'smtp' 
   AND is_active = true;
   ```

3. **Test Service Usage**
   - Service should load config from Integration table
   - No fallback to env vars
   - Clear error if not configured

## Status

✅ **Integration-First Architecture Enforced**
- All services use Integration table
- No hardcoded configs
- No local files
- No env var fallbacks
- Clear error messages

---

**Remember**: When in doubt, use the Integration API. Never hardcode, never use local files, always query the Integration table.
