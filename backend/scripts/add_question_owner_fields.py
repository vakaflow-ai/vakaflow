#!/usr/bin/env python3
"""
Add owner fields to assessment_question_responses table
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text, inspect
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_owner_fields():
    """Add owner_id, assigned_at, and assigned_by columns to assessment_question_responses table"""
    logger.info("Checking assessment_question_responses table structure...")
    
    inspector = inspect(engine)
    columns = {col['name']: col for col in inspector.get_columns('assessment_question_responses')}
    
    with engine.connect() as conn:
        # Check and add owner_id
        if 'owner_id' not in columns:
            logger.info("Adding owner_id column...")
            conn.execute(text("""
                ALTER TABLE assessment_question_responses 
                ADD COLUMN owner_id UUID REFERENCES users(id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_assessment_question_responses_owner_id 
                ON assessment_question_responses(owner_id)
            """))
            logger.info("✅ owner_id column added")
        else:
            logger.info("✓ owner_id column already exists")
        
        # Check and add assigned_at
        if 'assigned_at' not in columns:
            logger.info("Adding assigned_at column...")
            conn.execute(text("""
                ALTER TABLE assessment_question_responses 
                ADD COLUMN assigned_at TIMESTAMP
            """))
            logger.info("✅ assigned_at column added")
        else:
            logger.info("✓ assigned_at column already exists")
        
        # Check and add assigned_by
        if 'assigned_by' not in columns:
            logger.info("Adding assigned_by column...")
            conn.execute(text("""
                ALTER TABLE assessment_question_responses 
                ADD COLUMN assigned_by UUID REFERENCES users(id)
            """))
            logger.info("✅ assigned_by column added")
        else:
            logger.info("✓ assigned_by column already exists")
        
        conn.commit()
    
    logger.info("✅ All owner fields added successfully!")


if __name__ == "__main__":
    try:
        add_owner_fields()
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Failed to add owner fields: {e}", exc_info=True)
        sys.exit(1)
