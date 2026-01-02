#!/usr/bin/env python3
"""
Script to assign the current logged-in user to the default tenant
This will assign ALL users without a tenant_id to the default tenant
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.tenant import Tenant

def assign_users_to_default_tenant():
    """Assign all users without tenant_id to the default tenant"""
    db = SessionLocal()
    try:
        # Get default tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "default-tenant").first()
        if not tenant:
            print("❌ Default tenant not found. Please create it first.")
            return False
        
        # Find all users without tenant_id
        users_without_tenant = db.query(User).filter(User.tenant_id == None).all()
        
        if not users_without_tenant:
            print("✅ All users already have a tenant assigned.")
            return True
        
        print(f"📋 Found {len(users_without_tenant)} user(s) without tenant assignment:")
        for user in users_without_tenant:
            print(f"   - {user.email} (role: {user.role.value})")
        
        # Assign all to default tenant
        assigned_count = 0
        for user in users_without_tenant:
            user.tenant_id = tenant.id
            assigned_count += 1
        
        db.commit()
        
        print(f"\n✅ Successfully assigned {assigned_count} user(s) to tenant: {tenant.name}")
        print(f"   Tenant ID: {tenant.id}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Assigning users without tenant to default tenant...")
    print("")
    assign_users_to_default_tenant()
    print("")
    print("✅ Done! Please refresh the page and try again.")

