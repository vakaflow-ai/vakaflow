#!/bin/bash
# Script to fix tenant assignment for admin user

echo "🔧 Fixing tenant assignment for admin@example.com"
echo ""

cd "$(dirname "$0")/backend"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run Python script to create tenant and assign user
python3 << 'EOF'
import sys
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.core.security import get_password_hash
from datetime import datetime

db = SessionLocal()

try:
    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.slug == "default-tenant").first()
    
    if not tenant:
        print("📦 Creating default tenant...")
        tenant = Tenant(
            name="Default Tenant",
            slug="default-tenant",
            status="active",
            contact_email="admin@example.com",
            contact_name="Admin",
            license_tier="enterprise",
            max_agents="unlimited",
            max_users="unlimited",
            onboarding_status="completed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        print(f"✅ Created tenant: {tenant.name} (slug: {tenant.slug})")
    else:
        print(f"✅ Tenant already exists: {tenant.name} (slug: {tenant.slug})")
    
    # Assign admin user to tenant
    user = db.query(User).filter(User.email == "admin@example.com").first()
    if user:
        if user.tenant_id:
            print(f"⚠️  User {user.email} already has tenant_id: {user.tenant_id}")
        else:
            user.tenant_id = tenant.id
            db.commit()
            print(f"✅ Assigned user {user.email} to tenant {tenant.name}")
            print(f"   User role: {user.role.value}")
            print(f"   Tenant ID: {tenant.id}")
    else:
        print("❌ User admin@example.com not found")
    
except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
finally:
    db.close()

print("")
print("✅ Done! You can now refresh the page and try again.")
EOF

