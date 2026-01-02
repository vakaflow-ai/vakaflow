#!/usr/bin/env python3
"""Check user and password"""
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import verify_password

db = SessionLocal()
try:
    email = "platform-admin@vaka.com"
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        print(f"❌ User {email} not found")
    else:
        print(f"✅ User found: {user.email}")
        print(f"   Role: {user.role.value}")
        print(f"   Active: {user.is_active}")
        print(f"   Has password: {bool(user.hashed_password)}")
        if user.hashed_password:
            print(f"   Password hash: {user.hashed_password[:50]}...")
            # Test with common passwords
            test_passwords = ["admin123", "password123", "Admin123", "vaka123", "platform123"]
            for pwd in test_passwords:
                if verify_password(pwd, user.hashed_password):
                    print(f"   ✅ Password matches: {pwd}")
                    break
            else:
                print(f"   ❌ None of the test passwords matched")
        
    # List all users
    all_users = db.query(User).all()
    print(f"\n📋 All users ({len(all_users)}):")
    for u in all_users:
        print(f"   - {u.email} (role: {u.role.value}, active: {u.is_active})")
finally:
    db.close()

