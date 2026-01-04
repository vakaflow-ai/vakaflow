"""
Tenant utility functions
"""
from uuid import UUID
from app.models.user import User


def get_effective_tenant_id(user: User, db=None) -> UUID:
    """
    Get the tenant_id for a user.
    All users (including platform admins) must have a tenant_id.
    """
    if not user.tenant_id:
        raise ValueError(f"User {user.id} does not have a tenant_id assigned. All users must be assigned to a tenant.")
    return user.tenant_id

