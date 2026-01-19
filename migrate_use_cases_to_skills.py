#!/usr/bin/env python3
"""
Migration script to convert existing agent use_cases to skills
This addresses the data migration issue where existing agents still use the deprecated use_cases field
instead of the new skills field introduced in the skills-based model.
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

def migrate_use_cases_to_skills():
    """Migrate use_cases data to skills field for all agents"""
    
    logger.info("Starting migration: use_cases → skills")
    
    try:
        # Get database session
        db_gen = get_db()
        db = next(db_gen)
        
        # Count total agents
        total_agents = db.query(Agent).count()
        logger.info(f"Found {total_agents} total agents")
        
        # Count agents with use_cases data
        agents_with_use_cases = db.query(Agent).join(AgentMetadata).filter(
            AgentMetadata.use_cases.isnot(None)
        ).count()
        logger.info(f"Found {agents_with_use_cases} agents with use_cases data")
        
        # Count agents already having skills data
        agents_with_skills = db.query(Agent).join(AgentMetadata).filter(
            AgentMetadata.skills.isnot(None)
        ).count()
        logger.info(f"Found {agents_with_skills} agents already with skills data")
        
        # Find agents that have use_cases but no skills
        agents_to_migrate = db.query(Agent).join(AgentMetadata).filter(
            AgentMetadata.use_cases.isnot(None),
            AgentMetadata.skills.is_(None)
        ).all()
        
        logger.info(f"Found {len(agents_to_migrate)} agents to migrate")
        
        migrated_count = 0
        skipped_count = 0
        
        for agent in agents_to_migrate:
            try:
                # Get the metadata record
                metadata = db.query(AgentMetadata).filter(
                    AgentMetadata.agent_id == agent.id
                ).first()
                
                if not metadata:
                    logger.warning(f"No metadata found for agent {agent.id}")
                    skipped_count += 1
                    continue
                
                # Check if use_cases has data
                if not metadata.use_cases:
                    skipped_count += 1
                    continue
                
                # Convert use_cases to skills (they should be the same data structure)
                use_cases_data = metadata.use_cases
                
                # Update the skills field with use_cases data
                metadata.skills = use_cases_data
                
                # Optionally, you might want to clear use_cases or keep it for backward compatibility
                # For now, keeping it for safety
                # metadata.use_cases = None  # Uncomment if you want to remove the legacy field
                
                logger.info(f"Migrated agent {agent.id}: {len(use_cases_data)} use_cases → skills")
                migrated_count += 1
                
            except Exception as e:
                logger.error(f"Failed to migrate agent {agent.id}: {str(e)}")
                skipped_count += 1
                continue
        
        # Commit all changes
        db.commit()
        
        logger.info("=" * 50)
        logger.info("MIGRATION SUMMARY:")
        logger.info(f"Total agents processed: {len(agents_to_migrate)}")
        logger.info(f"Successfully migrated: {migrated_count}")
        logger.info(f"Skipped/failed: {skipped_count}")
        logger.info("=" * 50)
        
        # Verify results
        final_agents_with_skills = db.query(Agent).join(AgentMetadata).filter(
            AgentMetadata.skills.isnot(None)
        ).count()
        logger.info(f"Final count of agents with skills data: {final_agents_with_skills}")
        
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if 'db' in locals():
            db.rollback()
        return False
    finally:
        if 'db_gen' in locals():
            try:
                next(db_gen)  # Close the generator
            except StopIteration:
                pass

def migrate_agent_model_skills():
    """Also migrate the skills field from Agent model if needed"""
    logger.info("Checking Agent model skills migration...")
    
    try:
        db_gen = get_db()
        db = next(db_gen)
        
        # Count agents with skills in Agent model
        agents_with_model_skills = db.query(Agent).filter(
            Agent.skills.isnot(None)
        ).count()
        logger.info(f"Agents with skills in Agent model: {agents_with_model_skills}")
        
        # If there are agents without skills in Agent model but have them in metadata,
        # we might want to sync them
        agents_needing_sync = db.query(Agent).join(AgentMetadata).filter(
            Agent.skills.is_(None),
            AgentMetadata.skills.isnot(None)
        ).all()
        
        logger.info(f"Agents needing skills sync to Agent model: {len(agents_needing_sync)}")
        
        synced_count = 0
        for agent in agents_needing_sync:
            try:
                metadata = db.query(AgentMetadata).filter(
                    AgentMetadata.agent_id == agent.id
                ).first()
                
                if metadata and metadata.skills:
                    agent.skills = metadata.skills
                    logger.info(f"Synced skills for agent {agent.id}")
                    synced_count += 1
                    
            except Exception as e:
                logger.error(f"Failed to sync agent {agent.id}: {str(e)}")
                continue
        
        db.commit()
        logger.info(f"Synced {synced_count} agents' skills to Agent model")
        
        return True
        
    except Exception as e:
        logger.error(f"Agent model skills migration failed: {str(e)}")
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
    logger.info("🚀 Starting Agent Skills Migration")
    
    # Run main migration
    success1 = migrate_use_cases_to_skills()
    
    # Run Agent model sync
    success2 = migrate_agent_model_skills()
    
    if success1 and success2:
        logger.info("✅ All migrations completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Some migrations failed!")
        sys.exit(1)