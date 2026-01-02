#!/usr/bin/env python3
"""Create platform admin user"""
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from datetime import datetime
import uuid

db = SessionLocal()
try:
    email = "platform-admin@vaka.com"
    
    # Check if user already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"✅ User {email} already exists")
        print(f"   Role: {existing.role.value}")
        print(f"   Active: {existing.is_active}")
    else:
        # Create platform admin user
        password = "Admin123!"  # Change this in production!
        user = User(
            id=uuid.uuid4(),
            email=email,
            name="Platform Administrator",
            role=UserRole.PLATFORM_ADMIN,
            hashed_password=get_password_hash(password),
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅ Created platform admin user: {email}")
        print(f"   Password: Admin123!")
        print(f"   ⚠️  Please change the password after first login!")
        
    # List all users
    all_users = db.query(User).all()
    print(f"\n📋 All users ({len(all_users)}):")
    for u in all_users:
        print(f"   - {u.email} (role: {u.role.value}, active: {u.is_active})")
finally:
    db.close()

