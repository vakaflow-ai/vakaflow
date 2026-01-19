#!/usr/bin/env python3
"""
Cleanup Remaining Layout Mappings
Removes all references to the deleted problematic layout ID from WorkflowLayoutGroups.
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

def cleanup_remaining_mappings():
    """Clean up remaining mappings to the deleted layout."""
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("🧹 CLEANING UP REMAINING LAYOUT MAPPINGS")
        logger.info("=" * 60)
        
        # Find all WorkflowLayoutGroups with problematic mappings
        groups_with_issues = []
        all_groups = db.query(FormType).all()
        
        logger.info(f"Checking {len(all_groups)} WorkflowLayoutGroups...")
        
        for group in all_groups:
            has_problematic_mapping = False
            if hasattr(group, 'stage_mappings') and group.stage_mappings:
                for stage_key, mapping in group.stage_mappings.items():
                    if isinstance(mapping, dict) and 'layout_id' in mapping:
                        layout_id = mapping.get('layout_id')
                        if layout_id == PROBLEMATIC_LAYOUT_ID:
                            has_problematic_mapping = True
                            logger.info(f"❌ Found problematic mapping in group '{group.name}':")
                            logger.info(f"   {stage_key} -> {layout_id}")
                            
            if has_problematic_mapping:
                groups_with_issues.append(group)
        
        if not groups_with_issues:
            logger.info("✅ No groups with problematic mappings found")
            return
            
        logger.info(f"\nFound {len(groups_with_issues)} groups with problematic mappings")
        logger.info("Cleaning up mappings...")
        
        # Clean up the mappings
        cleaned_count = 0
        for group in groups_with_issues:
            logger.info(f"\n🔧 Cleaning group: {group.name}")
            
            # Create a copy of stage_mappings to modify
            updated_mappings = {}
            mappings_changed = False
            
            for stage_key, mapping in group.stage_mappings.items():
                if isinstance(mapping, dict) and 'layout_id' in mapping:
                    layout_id = mapping.get('layout_id')
                    if layout_id == PROBLEMATIC_LAYOUT_ID:
                        # Reset this mapping
                        updated_mappings[stage_key] = {
                            'layout_id': None,
                            'name': 'Default Form (Auto-select)'
                        }
                        mappings_changed = True
                        cleaned_count += 1
                        logger.info(f"   ✅ Reset mapping: {stage_key}")
                    else:
                        # Keep existing mapping
                        updated_mappings[stage_key] = mapping
                else:
                    # Keep non-dict mappings as-is
                    updated_mappings[stage_key] = mapping
            
            # Update the group if mappings changed
            if mappings_changed:
                group.stage_mappings = updated_mappings
                db.add(group)
                logger.info(f"   📦 Updated group '{group.name}' with cleaned mappings")
        
        # Commit all changes
        if cleaned_count > 0:
            db.commit()
            logger.info(f"\n✅ Successfully cleaned {cleaned_count} mappings across {len(groups_with_issues)} groups")
        else:
            logger.info("\nℹ️  No mappings needed cleaning (may have been cleaned already)")
            
        # Verify cleanup
        logger.info("\n🔍 Verifying cleanup...")
        remaining_issues = 0
        for group in db.query(FormType).all():
            if hasattr(group, 'stage_mappings') and group.stage_mappings:
                for stage_key, mapping in group.stage_mappings.items():
                    if isinstance(mapping, dict) and 'layout_id' in mapping:
                        layout_id = mapping.get('layout_id')
                        if layout_id == PROBLEMATIC_LAYOUT_ID:
                            remaining_issues += 1
                            logger.info(f"❌ Still found: {group.name} - {stage_key} -> {layout_id}")
        
        if remaining_issues == 0:
            logger.info("✅ Verification successful - all problematic mappings removed!")
        else:
            logger.info(f"❌ Verification failed - {remaining_issues} problematic mappings still remain")
            
        logger.info("\n" + "=" * 60)
        logger.info("🎉 CLEANUP COMPLETE!")
        logger.info("The system should now properly select Agent Onboarding layouts.")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_remaining_mappings()