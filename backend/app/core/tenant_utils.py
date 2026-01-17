"""
Tenant utility functions
"""
from uuid import UUID
from app.models.user import User


def get_effective_tenant_id(user: User, db=None) -> UUID:
    """
    Get the tenant_id for a user.
    All users (including platform admins) must have a tenant_id.
    If platform admin has no tenant_id, try to use the first available tenant.
    """
    if user.tenant_id:
        return user.tenant_id
        
    # Handle platform admin without tenant_id
    is_platform_admin = False
    try:
        role_str = str(user.role.value) if hasattr(user.role, 'value') else str(user.role)
        is_platform_admin = role_str == "platform_admin"
    except:
        pass
        
    if is_platform_admin and db:
        # Try to find a default tenant or the first tenant
        try:
            from app.models.tenant import Tenant
            tenant = db.query(Tenant).first()
            if tenant:
                return tenant.id
        except Exception:
            pass
            
    if not user.tenant_id:
        raise ValueError(f"User {user.id} does not have a tenant_id assigned. All users must be assigned to a tenant.")
    return user.tenant_id
