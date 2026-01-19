#!/usr/bin/env python3
"""
Fixed migration script for JSON column types
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

def fixed_migration():
    """Fixed migration handling JSON column types properly"""
    
    logger.info("Starting fixed migration: use_cases → skills")
    
    try:
        # Get database session
        db_gen = get_db()
        db = next(db_gen)
        
        # Direct SQL approach with proper JSON handling
        from sqlalchemy import text
        
        # Check current state
        check_query = text("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN use_cases IS NOT NULL THEN 1 END) as with_use_cases,
                   COUNT(CASE WHEN skills IS NOT NULL AND skills != 'null' AND skills != '[]' THEN 1 END) as with_skills
            FROM agent_metadata
        """)
        
        result = db.execute(check_query)
        stats = result.fetchone()
        logger.info(f"Current state - Total: {stats.total}, With use_cases: {stats.with_use_cases}, With skills: {stats.with_skills}")
        
        # Simple migration - copy use_cases to skills where skills is null or empty
        migrate_query = text("""
            UPDATE agent_metadata 
            SET skills = use_cases 
            WHERE use_cases IS NOT NULL 
            AND (skills IS NULL OR skills = 'null' OR skills = '[]')
        """)
        
        result = db.execute(migrate_query)
        affected_rows = result.rowcount
        db.commit()
        
        logger.info(f"Migration completed - {affected_rows} records updated")
        
        # Sync Agent model skills
        sync_query = text("""
            UPDATE agents 
            SET skills = am.skills::json
            FROM agent_metadata am
            WHERE agents.id = am.agent_id
            AND am.skills IS NOT NULL 
            AND am.skills != 'null' 
            AND am.skills != '[]'
            AND (agents.skills IS NULL OR agents.skills = 'null' OR agents.skills = '[]')
        """)
        
        result = db.execute(sync_query)
        sync_affected = result.rowcount
        db.commit()
        logger.info(f"Agent model sync completed - {sync_affected} agents updated")
        
        # Final verification
        final_check = text("""
            SELECT COUNT(CASE WHEN skills IS NOT NULL AND skills != 'null' AND skills != '[]' THEN 1 END) as final_skills_count
            FROM agent_metadata
        """)
        
        result = db.execute(final_check)
        final_count = result.scalar()
        logger.info(f"Final verification - Agents with skills data: {final_count}")
        
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
    logger.info("🚀 Starting Fixed Agent Skills Migration")
    
    success = fixed_migration()
    
    if success:
        logger.info("✅ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Migration failed!")
        sys.exit(1)