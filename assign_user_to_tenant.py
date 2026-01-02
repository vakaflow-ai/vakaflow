#!/usr/bin/env python3
"""
Script to assign a user to a tenant
Usage: python assign_user_to_tenant.py <user_email> <tenant_slug>
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.tenant import Tenant

def assign_user_to_tenant(user_email: str, tenant_slug: str):
    """Assign a user to a tenant"""
    db = SessionLocal()
    try:
        # Get user
        user = db.query(User).filter(User.email == user_email.lower()).first()
        if not user:
            print(f"❌ User not found: {user_email}")
            return False
        
        # Get tenant
        tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
        if not tenant:
            print(f"❌ Tenant not found: {tenant_slug}")
            return False
        
        # Assign tenant
        user.tenant_id = tenant.id
        db.commit()
        
        print(f"✅ Successfully assigned user {user_email} to tenant {tenant.name} ({tenant_slug})")
        print(f"   User role: {user.role.value}")
        print(f"   Tenant ID: {tenant.id}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python assign_user_to_tenant.py <user_email> <tenant_slug>")
        print("\nExample:")
        print("  python assign_user_to_tenant.py admin@example.com my-tenant")
        sys.exit(1)
    
    user_email = sys.argv[1]
    tenant_slug = sys.argv[2]
    
    assign_user_to_tenant(user_email, tenant_slug)

