#!/usr/bin/env python3
"""
Simple migration script to copy use_cases to skills field
This avoids accessing missing columns in the database schema
"""

import sys
import os
from pathlib import Path

# Add backend to Python path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.agent import Agent, AgentMetadata
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def simple_migration():
    """Simple migration that only copies use_cases to skills"""
    
    logger.info("Starting simple migration: use_cases → skills")
    
    try:
        # Get database session
        db_gen = get_db()
        db = next(db_gen)
        
        # Direct SQL approach to avoid model mismatches
        from sqlalchemy import text
        
        # First, check how many records have use_cases but no skills
        count_query = text("""
            SELECT COUNT(*) 
            FROM agent_metadata 
            WHERE use_cases IS NOT NULL 
            AND (skills IS NULL OR skills = 'null'::jsonb OR skills = '[]'::jsonb)
        """)
        
        result = db.execute(count_query)
        count = result.scalar()
        logger.info(f"Found {count} agent metadata records to migrate")
        
        if count == 0:
            logger.info("No records need migration")
            return True
            
        # Perform the migration with raw SQL
        migrate_query = text("""
            UPDATE agent_metadata 
            SET skills = use_cases 
            WHERE use_cases IS NOT NULL 
            AND (skills IS NULL OR skills = 'null'::jsonb OR skills = '[]'::jsonb)
        """)
        
        result = db.execute(migrate_query)
        db.commit()
        
        logger.info(f"Successfully migrated {result.rowcount} records")
        
        # Also sync Agent model skills if needed
        logger.info("Syncing Agent model skills...")
        sync_query = text("""
            UPDATE agents 
            SET skills = am.skills
            FROM agent_metadata am
            WHERE agents.id = am.agent_id
            AND am.skills IS NOT NULL
            AND (agents.skills IS NULL OR agents.skills = 'null'::jsonb OR agents.skills = '[]'::jsonb)
        """)
        
        result = db.execute(sync_query)
        db.commit()
        logger.info(f"Synced {result.rowcount} agents with skills data")
        
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if 'db' in locals():
            db.rollback()
        return False
    finally:
        if 'db_gen' in locals():
            try:
                next(db_gen)
            except StopIteration:
                pass

if __name__ == "__main__":
    logger.info("🚀 Starting Simple Agent Skills Migration")
    
    success = simple_migration()
    
    if success:
        logger.info("✅ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Migration failed!")
        sys.exit(1)