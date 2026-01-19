#!/usr/bin/env python3
"""
Script to update agent onboarding layout to match frontend expectations
"""

import sys
import os
from pathlib import Path
import json

# Add backend to Python path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.form_layout import FormLayout
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_agent_onboarding_layout():
    """Update the agent onboarding layout to match frontend expectations"""
    
    logger.info("Updating agent onboarding layout...")
    
    try:
        # Get database session
        db_gen = get_db()
        db = next(db_gen)
        
        # Find the agent onboarding submission layout
        layout = db.query(FormLayout).filter(
            FormLayout.request_type == 'agent_onboarding_workflow',
            FormLayout.workflow_stage == 'new',
            FormLayout.is_active == True
        ).first()
        
        if not layout:
            logger.error("No active agent onboarding layout found for 'new' stage")
            return False
            
        logger.info(f"Found layout: {layout.name}")
        logger.info(f"Current sections: {len(layout.sections)}")
        
        # Define new sections structure that matches frontend review display
        new_sections = [
            {
                "id": "basic-info",
                "title": "Basic Information",
                "order": 1,
                "description": "Essential details about the agent",
                "fields": ["name", "type", "category", "description", "version"]
            },
            {
                "id": "ai-config",
                "title": "AI & LLM Configuration",
                "order": 2,
                "description": "LLM vendor, model, and deployment details",
                "fields": ["llm_vendor", "llm_model", "llm_model_custom", "deployment_type", "data_sharing_scope", "data_usage_purpose"]
            },
            {
                "id": "capabilities-data",
                "title": "Capabilities & Data Types",
                "order": 3,
                "description": "Agent capabilities and data handling",
                "fields": ["capabilities", "data_types"]
            },
            {
                "id": "skills-regions",
                "title": "Skills & Operations",
                "order": 4,
                "description": "Agent skills, operational regions, and use cases",
                "fields": ["skills", "regions", "features", "personas"]
            },
            {
                "id": "governance",
                "title": "Governance Information",
                "order": 5,
                "description": "Service account and organizational details",
                "fields": ["service_account", "department", "organization", "kill_switch_enabled"]
            },
            {
                "id": "compliance",
                "title": "Compliance & Security",
                "order": 6,
                "description": "Compliance scores and security controls",
                "fields": ["compliance_score", "risk_score", "security_controls", "compliance_standards"]
            },
            {
                "id": "architecture",
                "title": "Architecture & Connections",
                "order": 7,
                "description": "System architecture and external connections",
                "fields": ["mermaid_diagram", "connection_diagram", "connections"]
            }
        ]
        
        # Update the layout
        layout.sections = new_sections
        db.commit()
        
        logger.info("✅ Layout updated successfully!")
        logger.info(f"New sections: {len(new_sections)}")
        for i, section in enumerate(new_sections):
            logger.info(f"  {i+1}. {section['title']} ({len(section['fields'])} fields)")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to update layout: {str(e)}")
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
    logger.info("🚀 Updating Agent Onboarding Layout")
    
    success = update_agent_onboarding_layout()
    
    if success:
        logger.info("✅ Layout update completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Layout update failed!")
        sys.exit(1)