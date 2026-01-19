#!/usr/bin/env python3
"""
Debug Layout Loading - Detailed Analysis
Analyzes why the wrong layout is being loaded and provides targeted fixes.
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

def analyze_layout_loading_issue():
    """Analyze the layout loading issue in detail."""
    db = SessionLocal()
    
    try:
        logger.info("=" * 60)
        logger.info("🔍 DETAILED LAYOUT LOADING ANALYSIS")
        logger.info("=" * 60)
        
        # 1. Check if the problematic layout still exists
        logger.info("\n1. Checking problematic layout existence...")
        problematic_layout = db.query(FormLayout).filter(
            FormLayout.id == UUID(PROBLEMATIC_LAYOUT_ID)
        ).first()
        
        if problematic_layout:
            logger.info(f"❌ Problematic layout STILL EXISTS:")
            logger.info(f"   ID: {problematic_layout.id}")
            logger.info(f"   Name: {problematic_layout.name}")
            logger.info(f"   Request Type: {problematic_layout.request_type}")
            logger.info(f"   Is Active: {problematic_layout.is_active}")
            logger.info(f"   Tenant ID: {problematic_layout.tenant_id}")
        else:
            logger.info("✅ Problematic layout has been deleted")
        
        # 2. Check all workflow layout groups and their mappings
        logger.info("\n2. Analyzing all WorkflowLayoutGroup mappings...")
        groups = db.query(FormType).all()
        
        for group in groups:
            logger.info(f"\n📝 Group: {group.name}")
            logger.info(f"   Request Type: {group.request_type}")
            logger.info(f"   Is Default: {group.is_default}")
            logger.info(f"   Stage Mappings: {group.stage_mappings}")
            
            # Check for any mappings to the problematic layout
            if hasattr(group, 'stage_mappings') and group.stage_mappings:
                for stage_key, mapping in group.stage_mappings.items():
                    if isinstance(mapping, dict) and 'layout_id' in mapping:
                        layout_id = mapping.get('layout_id')
                        if layout_id == PROBLEMATIC_LAYOUT_ID:
                            logger.info(f"   ⚠️  FOUND mapping: {stage_key} -> {layout_id}")
        
        # 3. Check active layouts for agent_onboarding_workflow
        logger.info("\n3. Checking active layouts for agent_onboarding_workflow...")
        tenants = db.query(Tenant).all()
        
        for tenant in tenants:
            logger.info(f"\n🏢 Tenant: {tenant.name}")
            
            # Check for active agent onboarding layouts
            active_layouts = db.query(FormLayout).filter(
                FormLayout.tenant_id == tenant.id,
                FormLayout.request_type == 'agent_onboarding_workflow',
                FormLayout.is_active == True
            ).all()
            
            if active_layouts:
                logger.info(f"   ✅ Found {len(active_layouts)} active agent onboarding layouts:")
                for layout in active_layouts:
                    logger.info(f"     - {layout.name} (ID: {layout.id})")
            else:
                logger.info(f"   ❌ No active agent onboarding layouts found")
        
        # 4. Check process mapping logic
        logger.info("\n4. Testing process mapping logic...")
        from app.api.v1.form_layouts import get_active_layout_for_stage
        
        for tenant in tenants[:1]:  # Test with first tenant
            logger.info(f"\n   Testing tenant: {tenant.name}")
            try:
                # Test getting layout for agent_onboarding_workflow
                layout = get_active_layout_for_stage(
                    db=db,
                    request_type='agent_onboarding_workflow',
                    workflow_stage='new',
                    current_user=None,  # Pass None for testing
                    effective_tenant_id=tenant.id
                )
                
                if layout:
                    logger.info(f"   ✅ Process mapping returns: {layout.name} (ID: {layout.id})")
                else:
                    logger.info(f"   ❌ Process mapping returns None")
                    
            except Exception as e:
                logger.error(f"   ❌ Error in process mapping: {e}")
        
        logger.info("\n" + "=" * 60)
        logger.info("💡 RECOMMENDATIONS:")
        logger.info("1. If problematic layout still exists, consider deleting it")
        logger.info("2. Verify process mapping logic isn't caching old results")
        logger.info("3. Check frontend navigation - might be hardcoded somewhere")
        logger.info("4. Clear browser cache/localStorage if needed")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Analysis failed: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    analyze_layout_loading_issue()