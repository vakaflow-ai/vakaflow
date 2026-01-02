#!/usr/bin/env python3
"""
Schema Sync Script - Creates all database tables from SQLAlchemy models
This script ensures all models are imported and all tables are created.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from sqlalchemy import inspect
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import ALL models to register them with SQLAlchemy Base
# This ensures all tables are in Base.metadata
logger.info("Importing all models...")

# Import all model modules to register tables
import app.models.user
import app.models.vendor
import app.models.agent
import app.models.vendor_invitation
import app.models.otp
import app.models.platform_config
import app.models.workflow_config
import app.models.ticket
import app.models.integration
import app.models.api_gateway
import app.models.tenant
import app.models.message
import app.models.mfa
import app.models.audit
import app.models.review
import app.models.compliance_framework
import app.models.policy
import app.models.submission_requirement
import app.models.agent_connection
import app.models.marketplace
import app.models.webhook
import app.models.adoption
import app.models.offboarding
import app.models.approval
import app.models.prompt_usage
import app.models.form_layout
import app.models.assessment
import app.models.assessment_template
import app.models.master_data_list
import app.models.question_library
import app.models.action_item
import app.models.assessment_review

logger.info("All models imported successfully")


def sync_schema():
    """Create all tables from models"""
    logger.info("Starting schema sync...")
    
    # Get existing tables
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    
    # Get all tables from metadata
    all_metadata_tables = set(Base.metadata.tables.keys())
    
    logger.info(f"Tables in metadata: {len(all_metadata_tables)}")
    logger.info(f"Tables in database: {len(existing_tables)}")
    
    # Find missing tables
    missing_tables = all_metadata_tables - existing_tables
    
    if missing_tables:
        logger.info(f"Creating {len(missing_tables)} missing tables...")
        for table in sorted(missing_tables):
            logger.info(f"  - {table}")
        
        # Create all missing tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ All tables created successfully")
    else:
        logger.info("✅ All tables already exist")
    
    # Verify
    inspector = inspect(engine)
    final_tables = sorted(inspector.get_table_names())
    
    logger.info(f"\n📊 Final Schema Status:")
    logger.info(f"   Total tables: {len(final_tables)}")
    logger.info(f"   All tables: {', '.join(final_tables)}")
    
    # Check for any discrepancies
    metadata_set = set(Base.metadata.tables.keys())
    db_set = set(final_tables)
    
    still_missing = metadata_set - db_set
    if still_missing:
        logger.warning(f"⚠️  Tables still missing: {still_missing}")
        return False
    
    extra_tables = db_set - metadata_set
    if extra_tables:
        logger.info(f"ℹ️  Extra tables in DB (not in models): {extra_tables}")
    
    logger.info("✅ Schema sync complete!")
    return True


if __name__ == "__main__":
    try:
        success = sync_schema()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Schema sync failed: {e}", exc_info=True)
        sys.exit(1)

