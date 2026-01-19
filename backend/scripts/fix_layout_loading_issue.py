#!/usr/bin/env python3
"""
Fix Layout Loading Issue
Resets process mappings that are pointing to the wrong layout ID (2ee21961-13ab-4dd5-90c6-80fe0c6f8473)
and allows the system to properly select Agent Onboarding layouts.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.form_layout import FormType, FormLayout
from app.models.tenant import Tenant
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROBLEMATIC_LAYOUT_ID = "2ee21961-13ab-4dd5-90c6-80fe0c6f8473"

def fix_layout_mappings_for_tenant(db: Session, tenant_id: UUID):
    """
    Fix layout mappings for a tenant by resetting problematic stage mappings.
    """
    logger.info(f"🔍 Checking WorkflowLayoutGroups for tenant {tenant_id}...")
    
    # Find all workflow layout groups for this tenant
    groups = db.query(FormType).filter(
        FormType.tenant_id == tenant_id
    ).all()
    
    fixed_count = 0
    
    for group in groups:
        logger.info(f"  Processing group: {group.name} (request_type: {group.request_type})")
        
        # Check if this group has stage_mappings
        if hasattr(group, 'stage_mappings') and group.stage_mappings:
            stage_mappings = group.stage_mappings
            
            # Look for mappings that point to the problematic layout ID
            mappings_to_fix = []
            for stage_key, mapping in stage_mappings.items():
                if isinstance(mapping, dict) and 'layout_id' in mapping:
                    layout_id = mapping.get('layout_id')
                    if layout_id == PROBLEMATIC_LAYOUT_ID:
                        mappings_to_fix.append(stage_key)
                        logger.info(f"    ⚠️  Found problematic mapping: {stage_key} -> {layout_id}")
            
            # Reset the problematic mappings
            if mappings_to_fix:
                logger.info(f"    🛠️  Resetting {len(mappings_to_fix)} mappings...")
                
                # Reset each problematic mapping to None/placeholder
                for stage_key in mappings_to_fix:
                    stage_mappings[stage_key] = {
                        'layout_id': None,
                        'name': 'Default Form (Auto-select)'
                    }
                
                # Update the group
                group.stage_mappings = stage_mappings
                db.add(group)
                fixed_count += len(mappings_to_fix)
                logger.info(f"    ✅ Reset {len(mappings_to_fix)} mappings in {group.name}")
    
    if fixed_count > 0:
        db.commit()
        logger.info(f"✅ Fixed {fixed_count} layout mappings for tenant {tenant_id}")
    else:
        logger.info(f"✅ No problematic mappings found for tenant {tenant_id}")

def verify_layout_selection_works(db: Session, tenant_id: UUID):
    """
    Verify that the layout selection is now working properly by checking
    that we can get appropriate layouts for agent onboarding.
    """
    logger.info(f"🧪 Verifying layout selection for tenant {tenant_id}...")
    
    # Test getting an active layout for agent_onboarding_workflow
    from app.api.v1.form_layouts import _get_active_layout_internal
    
    try:
        layout = _get_active_layout_internal(
            db=db,
            effective_tenant_id=tenant_id,
            request_type='agent_onboarding_workflow',
            workflow_stage='new'
        )
        
        if layout:
            logger.info(f"✅ Layout selection working: Found {layout.name} (id: {layout.id})")
        else:
            logger.warning("⚠️  No active layout found for agent_onboarding_workflow")
            
    except Exception as e:
        logger.error(f"❌ Error testing layout selection: {e}")

def main():
    """Main function to fix layout loading issues across all tenants."""
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("🔧 FIXING LAYOUT LOADING ISSUE")
        logger.info("=" * 60)
        logger.info(f"Target Layout ID: {PROBLEMATIC_LAYOUT_ID}")
        logger.info("This script will reset process mappings pointing to this ID")
        logger.info("so the system can properly select Agent Onboarding layouts.")
        logger.info("=" * 60)
        
        # Get all tenants
        tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("No tenants found. Please seed tenants first.")
            return
            
        logger.info(f"Found {len(tenants)} tenant(s) to process")
        
        # Process each tenant
        for tenant in tenants:
            logger.info(f"\n🏢 Processing tenant: {tenant.name} ({tenant.id})")
            logger.info("-" * 40)
            
            fix_layout_mappings_for_tenant(db, tenant.id)
            verify_layout_selection_works(db, tenant.id)
        
        logger.info("\n" + "=" * 60)
        logger.info("🎉 ALL DONE!")
        logger.info("Layout loading issue should now be fixed.")
        logger.info("The system will now properly select Agent Onboarding layouts.")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Script failed: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()