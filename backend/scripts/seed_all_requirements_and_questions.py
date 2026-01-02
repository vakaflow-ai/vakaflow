#!/usr/bin/env python3
"""
Master seed script for Requirements and Questions
This script ensures proper mapping:
- Requirements (compliance/risk) -> submission_requirements table
- Questions -> question_library table with requirement_ids linking to requirements
- NO questionnaire-type requirements (those are questions)
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.tenant import Tenant
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import seed functions - using exec to avoid import path issues
import importlib.util
script_dir = os.path.dirname(os.path.abspath(__file__))

# Load and execute seed_submission_requirements
seed_submission_requirements_path = os.path.join(script_dir, "seed_submission_requirements.py")
with open(seed_submission_requirements_path, 'r') as f:
    seed_submission_requirements_code = f.read()
exec(seed_submission_requirements_code, globals())

# Load and execute seed_requirements_and_questions  
seed_requirements_and_questions_path = os.path.join(script_dir, "seed_requirements_and_questions.py")
with open(seed_requirements_and_questions_path, 'r') as f:
    seed_requirements_and_questions_code = f.read()
exec(seed_requirements_and_questions_code, globals())

# Load and execute seed_question_library
seed_question_library_path = os.path.join(script_dir, "seed_question_library.py")
with open(seed_question_library_path, 'r') as f:
    seed_question_library_code = f.read()
exec(seed_question_library_code, globals())


def seed_all_for_tenant(tenant_id, created_by=None):
    """Seed all requirements and questions for a tenant in the correct order"""
    import uuid
    
    # Convert to UUID if string
    if isinstance(tenant_id, str):
        tenant_id = uuid.UUID(tenant_id)
    if isinstance(created_by, str):
        created_by = uuid.UUID(created_by)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🌱 Seeding all Requirements and Questions for tenant {tenant_id}")
    logger.info(f"{'='*60}\n")
    
    # Step 1: Seed compliance and risk requirements (NOT questionnaires)
    logger.info("📋 Step 1: Seeding Requirements (Compliance & Risk)...")
    seed_submission_requirements_only(tenant_id, created_by)
    
    # Step 2: Seed structured requirements with questions (R-SEC-1, R-SEC-2, etc.)
    logger.info("\n📋 Step 2: Seeding Structured Requirements with Questions...")
    seed_requirements_and_questions(tenant_id, created_by)
    
    # Step 3: Seed additional question library items (if any)
    logger.info("\n📋 Step 3: Seeding Additional Question Library Items...")
    seed_question_library(tenant_id, created_by)
    
    logger.info(f"\n✅ All seeding complete for tenant {tenant_id}!")


def seed_all_tenants():
    """Seed requirements and questions for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("⚠️  No tenants found. Please create tenants first.")
            return
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🌱 Seeding All Requirements and Questions for {len(tenants)} tenant(s)")
        logger.info(f"{'='*60}\n")
        
        for tenant in tenants:
            logger.info(f"📋 Processing tenant: {tenant.name} (ID: {tenant.id})")
            
            # Get first admin user for created_by
            from app.models.user import User, UserRole
            admin = db.query(User).filter(
                User.tenant_id == tenant.id,
                User.role.in_([UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN])
            ).first()
            
            created_by = admin.id if admin else None
            
            seed_all_for_tenant(tenant.id, created_by)
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ All tenants processed!")
        logger.info(f"{'='*60}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        seed_all_tenants()
    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}")
        sys.exit(1)
