#!/usr/bin/env python3
"""
Test script to verify Agent Studio API endpoints with database connectivity
"""

import sys
import os
import asyncio
sys.path.insert(0, '/Users/vikasc/vaka/backend')

# Set database URL for testing
os.environ['DATABASE_URL'] = 'postgresql://vaka_user:vaka_password@localhost:5432/vaka'

async def test_database_connectivity():
    print("🧪 Testing Database Connectivity")
    print("=" * 40)
    
    try:
        from app.core.database import engine
        from sqlalchemy import text
        
        # Test basic connection
        with engine.connect() as conn:
            result = conn.execute(text('SELECT version();'))
            version = result.fetchone()
            print(f"✅ Database connected successfully")
            print(f"   Version: {version[0][:50]}...")
            
        # Test ecosystem tables exist
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT tablename 
                FROM pg_tables 
                WHERE tablename IN ('ecosystem_entities', 'entity_lifecycle_events', 'shared_governance_profiles')
                ORDER BY tablename;
            """))
            tables = [row[0] for row in result.fetchall()]
            
            expected_tables = ['ecosystem_entities', 'entity_lifecycle_events', 'shared_governance_profiles']
            for table in expected_tables:
                if table in tables:
                    print(f"✅ Table '{table}' exists")
                else:
                    print(f"❌ Table '{table}' missing")
                    
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_ecosystem_service():
    print("\n🧪 Testing Ecosystem Entity Service")
    print("=" * 35)
    
    try:
        from app.services.ecosystem_entity_service import EcosystemEntityService
        from app.core.database import SessionLocal
        from app.models.ecosystem_entity import EntityType, EntityStatus
        
        db = SessionLocal()
        service = EcosystemEntityService(db)
        
        print("✅ EcosystemEntityService instantiated successfully")
        
        # Test creating an entity
        test_entity = service.create_entity(
            tenant_id="00000000-0000-0000-0000-000000000001",
            vendor_id="d837abcd-0846-498c-9aa3-a5f81cf763f4",  # Existing vendor ID
            entity_type=EntityType.AGENT,
            name="Test Security Agent",
            category="Security",
            description="Test agent for verification",
            department="Security",
            organization="Engineering",
            skills=["threat_detection", "log_analysis"],
            compliance_standards=["SOC2", "ISO27001"],
            security_controls=["encryption", "access_control"]
        )
        
        print(f"✅ Created test entity: {test_entity.name} (ID: {test_entity.id})")
        
        # Test listing entities
        entities = service.list_entities(tenant_id="00000000-0000-0000-0000-000000000001")
        print(f"✅ Listed {len(entities)} entities for tenant")
        
        # Test updating entity status
        updated_entity = service.update_entity_status(
            entity_id=test_entity.id,
            new_status=EntityStatus.ACTIVE,
            triggered_by="28130429-8103-4d05-9fe0-1e37fa761711"  # Platform admin user ID
        )
        print(f"✅ Updated entity status to: {updated_entity.status}")
        
        # Test creating governance profile
        profile = service.create_governance_profile(
            tenant_id="00000000-0000-0000-0000-000000000001",
            name="Security Compliance Profile",
            profile_type="security",
            description="Standard security compliance requirements",
            security_controls=["firewall", "intrusion_detection", "vulnerability_scanning"],
            compliance_standards=["SOC2", "ISO27001", "GDPR"],
            monitoring_requirements=["daily_scans", "weekly_reports"]
        )
        print(f"✅ Created governance profile: {profile.name} (ID: {profile.id})")
        
        # Test applying profile
        applied_entity = service.apply_governance_profile(
            entity_id=test_entity.id,
            profile_id=profile.id,
            applied_by="28130429-8103-4d05-9fe0-1e37fa761711"
        )
        print(f"✅ Applied governance profile to entity")
        
        # Cleanup - delete test entity
        db.delete(test_entity)
        db.delete(profile)
        db.commit()
        print("✅ Test data cleaned up")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Ecosystem service test failed: {e}")
        import traceback
        traceback.print_exc()
        try:
            db.rollback()
            db.close()
        except:
            pass
        return False

async def main():
    print("🚀 Agent Studio Database Integration Test")
    print("=" * 50)
    
    results = []
    results.append(await test_database_connectivity())
    results.append(await test_ecosystem_service())
    
    print("\n" + "=" * 50)
    if all(results):
        print("🎉 All database integration tests passed!")
        print("\n✅ Agent Studio is ready for API testing")
        print("✅ Ecosystem entity tables are functional")
        print("✅ Service layer operations work correctly")
    else:
        print("❌ Some tests failed. Check the errors above.")
    
    return all(results)

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)