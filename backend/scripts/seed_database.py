#!/usr/bin/env python3
"""
Database Seeding Script - Seeds initial data for the application
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.models.submission_requirement import SubmissionRequirement
from app.models.master_data_list import MasterDataList
from app.core.security import get_password_hash
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_user_if_not_exists(db, email, name, role, password, tenant_id=None):
    """Helper to create user if it doesn't exist"""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        logger.info(f"✅ User already exists: {email}")
        return existing
    
    user = User(
        id=uuid.uuid4(),
        email=email,
        name=name,
        role=role,
        hashed_password=get_password_hash(password),
        tenant_id=tenant_id,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(user)
    logger.info(f"✅ Created user: {email} ({role.value}) / {password}")
    return user


def seed_database():
    """Seed initial database data"""
    db = SessionLocal()
    try:
        logger.info("Starting database seeding...")
        
        # Step 1: Create default tenant
        default_tenant = db.query(Tenant).filter(
            Tenant.slug == "default"
        ).first()
        
        if not default_tenant:
            logger.info("Creating default tenant...")
            default_tenant = Tenant(
                id=uuid.uuid4(),
                name="Default Tenant",
                slug="default",
                status="active",
                contact_email="admin@vaka.com",
                license_tier="enterprise",
                onboarding_status="completed",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(default_tenant)
            db.commit()
            db.refresh(default_tenant)
            logger.info("✅ Default tenant created")
        else:
            logger.info("✅ Default tenant already exists")
        
        tenant_id = default_tenant.id
        
        # Step 2: Create platform admin (no tenant)
        logger.info("\n📋 Creating platform admin...")
        platform_admin = create_user_if_not_exists(
            db, 
            "platform-admin@vaka.com",
            "Platform Administrator",
            UserRole.PLATFORM_ADMIN,
            "Admin123!",
            tenant_id=None
        )
        
        # Step 3: Create tenant admin
        logger.info("\n📋 Creating tenant admin...")
        tenant_admin = create_user_if_not_exists(
            db,
            "tenant-admin@vaka.com",
            "Tenant Administrator",
            UserRole.TENANT_ADMIN,
            "Admin123!",
            tenant_id=tenant_id
        )
        
        # Step 4: Create reviewers (using @example.com format)
        logger.info("\n📋 Creating reviewers...")
        create_user_if_not_exists(
            db,
            "security@example.com",
            "Security Reviewer",
            UserRole.SECURITY_REVIEWER,
            "reviewer123",
            tenant_id=tenant_id
        )
        create_user_if_not_exists(
            db,
            "compliance@example.com",
            "Compliance Reviewer",
            UserRole.COMPLIANCE_REVIEWER,
            "reviewer123",
            tenant_id=tenant_id
        )
        create_user_if_not_exists(
            db,
            "technical@example.com",
            "Technical Reviewer",
            UserRole.TECHNICAL_REVIEWER,
            "reviewer123",
            tenant_id=tenant_id
        )
        create_user_if_not_exists(
            db,
            "business@example.com",
            "Business Reviewer",
            UserRole.BUSINESS_REVIEWER,
            "reviewer123",
            tenant_id=tenant_id
        )
        
        # Step 5: Create approver
        logger.info("\n📋 Creating approver...")
        create_user_if_not_exists(
            db,
            "approver@example.com",
            "Approver",
            UserRole.APPROVER,
            "approver123",
            tenant_id=tenant_id
        )
        
        # Step 5b: Also create tenant admin with @example.com
        logger.info("\n📋 Creating tenant admin (example.com)...")
        create_user_if_not_exists(
            db,
            "admin@example.com",
            "Tenant Admin",
            UserRole.TENANT_ADMIN,
            "admin123",
            tenant_id=tenant_id
        )
        
        # Step 6: Create vendor user
        logger.info("\n📋 Creating vendor user...")
        create_user_if_not_exists(
            db,
            "vendor@example.com",
            "Default Vendor",
            UserRole.VENDOR_USER,
            "admin123",
            tenant_id=tenant_id
        )
        
        # Step 7: Create end user
        logger.info("\n📋 Creating end user...")
        create_user_if_not_exists(
            db,
            "user@example.com",
            "End User",
            UserRole.END_USER,
            "admin123",
            tenant_id=tenant_id
        )
        
        # Commit all users
        db.commit()
        logger.info("\n✅ All default users created!")
        
        # Step 8: Seed workflow configurations (if needed)
        logger.info("\n📋 Seeding workflows...")
        from app.models.workflow_config import WorkflowConfiguration
        from app.services.workflow_seeder import seed_default_workflows_for_all_tenants
        
        workflows = db.query(WorkflowConfiguration).count()
        if workflows == 0:
            logger.info("Seeding default workflows...")
            seed_default_workflows_for_all_tenants(db, created_by=platform_admin.id)
            logger.info("✅ Default workflows seeded")
        else:
            logger.info(f"✅ {workflows} workflows already exist")
        
        # Step 9: Seed submission requirements
        logger.info("\n📋 Seeding submission requirements...")
        import importlib.util
        seed_script_path = os.path.join(os.path.dirname(__file__), 'seed_submission_requirements.py')
        if os.path.exists(seed_script_path):
            spec = importlib.util.spec_from_file_location("seed_submission_requirements", seed_script_path)
            seed_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(seed_module)
            
            requirements_count = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == tenant_id
            ).count()
            
            if requirements_count == 0:
                logger.info("Seeding default submission requirements...")
                seed_module.seed_submission_requirements(tenant_id, created_by=tenant_admin.id)
                logger.info("✅ Default submission requirements seeded")
            else:
                logger.info(f"✅ {requirements_count} submission requirements already exist")
        else:
            logger.warning("⚠️  Seed script not found, skipping submission requirements")
        
        # Step 10: Seed master data lists
        logger.info("\n📋 Seeding master data lists...")
        seed_master_data_path = os.path.join(os.path.dirname(__file__), 'seed_master_data.py')
        if os.path.exists(seed_master_data_path):
            spec = importlib.util.spec_from_file_location("seed_master_data", seed_master_data_path)
            seed_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(seed_module)
            
            master_data_count = db.query(MasterDataList).filter(
                MasterDataList.tenant_id == tenant_id
            ).count()
            
            if master_data_count == 0:
                logger.info("Seeding default master data lists...")
                seed_module.seed_master_data_for_tenant(tenant_id, created_by=tenant_admin.id)
                logger.info("✅ Default master data lists seeded")
            else:
                logger.info(f"✅ {master_data_count} master data lists already exist (updating if needed)...")
                seed_module.seed_master_data_for_tenant(tenant_id, created_by=tenant_admin.id)
        else:
            logger.warning("⚠️  Seed script not found, skipping master data lists")
        
        # Step 11: Sync entity fields first (to ensure fields exist)
        logger.info("\n📋 Syncing entity fields...")
        from app.services.entity_field_discovery import sync_entity_fields
        try:
            sync_result = sync_entity_fields(
                db=db,
                tenant_id=tenant_id,
                entity_names=["agents"],
                created_by=tenant_admin.id
            )
            logger.info(f"✅ Synced {sync_result['fields_created']} new fields, updated {sync_result['fields_updated']} existing fields")
        except Exception as e:
            logger.warning(f"⚠️  Entity field sync failed: {e}")
        
        # Step 12: Seed field definitions with options
        logger.info("\n📋 Seeding field definitions...")
        seed_field_definitions_path = os.path.join(os.path.dirname(__file__), 'seed_field_definitions.py')
        if os.path.exists(seed_field_definitions_path):
            spec = importlib.util.spec_from_file_location("seed_field_definitions", seed_field_definitions_path)
            seed_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(seed_module)
            
            logger.info("Seeding field definitions with options...")
            seed_module.seed_field_definitions(tenant_id=tenant_id, created_by=tenant_admin.id)
            logger.info("✅ Field definitions seeded")
        else:
            logger.warning("⚠️  Seed script not found, skipping field definitions")
        
        # Step 13: Seed Workflow Layout Groups (ensure default groups have all stage_mappings)
        logger.info("\n📋 Seeding Workflow Layout Groups...")
        seed_workflow_layout_groups_path = os.path.join(os.path.dirname(__file__), 'seed_workflow_layout_groups.py')
        if os.path.exists(seed_workflow_layout_groups_path):
            spec = importlib.util.spec_from_file_location("seed_workflow_layout_groups", seed_workflow_layout_groups_path)
            seed_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(seed_module)
            
            logger.info("Seeding/updating Workflow Layout Groups...")
            seed_module.seed_workflow_layout_groups_for_tenant(db, tenant_id, created_by=tenant_admin.id)
            logger.info("✅ Workflow Layout Groups seeded")
        else:
            logger.warning("⚠️  Seed script not found, skipping Workflow Layout Groups")
        
        logger.info("\n" + "="*60)
        logger.info("✅ Database seeding complete!")
        logger.info("="*60)
        logger.info("\n📋 Default Users Created:")
        logger.info("\n   Platform Level:")
        logger.info("      Platform Admin: platform-admin@vaka.com / Admin123!")
        logger.info("\n   Tenant Level (@vaka.com):")
        logger.info("      Tenant Admin: tenant-admin@vaka.com / Admin123!")
        logger.info("\n   Reviewers & Approvers (@example.com):")
        logger.info("      Security Reviewer: security@example.com / reviewer123")
        logger.info("      Compliance Reviewer: compliance@example.com / reviewer123")
        logger.info("      Technical Reviewer: technical@example.com / reviewer123")
        logger.info("      Business Reviewer: business@example.com / reviewer123")
        logger.info("      Approver: approver@example.com / approver123")
        logger.info("      Tenant Admin: admin@example.com / admin123")
        logger.info("\n   Other Users (@example.com):")
        logger.info("      Vendor: vendor@example.com / admin123")
        logger.info("      End User: user@example.com / admin123")
        logger.info("="*60)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    try:
        success = seed_database()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Script failed: {e}", exc_info=True)
        sys.exit(1)

