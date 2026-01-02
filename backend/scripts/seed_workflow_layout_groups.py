#!/usr/bin/env python3
"""
Seed Workflow Layout Groups (FormType)
Ensures default WorkflowLayoutGroups have all required stage_mappings (Submission, Approval, Rejection, Completion)
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
from typing import Optional, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_default_layout_for_stage(
    db: Session,
    tenant_id: UUID,
    request_type: str,
    stage_key: str
) -> Tuple[Optional[UUID], str]:
    """
    Get default layout ID and name for a stage.
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        request_type: Request type (e.g., 'vendor_submission_workflow')
        stage_key: Stage key ('submission', 'approval', 'rejection', 'completion')
    
    Returns:
        Tuple of (layout_id, layout_name) or (None, 'Default Form') if not found
    """
    # Map stage_key to layout_type
    stage_to_layout_type = {
        'submission': 'submission',
        'approval': 'approver',
        'rejection': 'rejection',
        'completion': 'completed'
    }
    
    layout_type = stage_to_layout_type.get(stage_key, 'submission')
    
    # Try to find a layout with matching layout_type
    layout = db.query(FormLayout).filter(
        FormLayout.tenant_id == tenant_id,
        FormLayout.request_type == request_type,
        FormLayout.layout_type == layout_type,
        FormLayout.is_active == True,
        FormLayout.is_template == False
    ).first()
    
    if layout:
        return (layout.id, layout.name)
    
    # Fallback: try to find any active layout for this request_type
    fallback_layout = db.query(FormLayout).filter(
        FormLayout.tenant_id == tenant_id,
        FormLayout.request_type == request_type,
        FormLayout.is_active == True,
        FormLayout.is_template == False
    ).first()
    
    if fallback_layout:
        return (fallback_layout.id, fallback_layout.name)
    
    # Last resort: return None (will use placeholder)
    return (None, 'Default Form')


def ensure_default_stage_mappings(
    db: Session,
    tenant_id: UUID,
    request_type: str
) -> dict[str, dict[str, any]]:
    """
    Ensure default stage_mappings are created for a request_type.
    
    Returns:
        Dictionary with default stage_mappings structure
    """
    stage_mappings = {}
    
    # Required stages
    required_stages = ['submission', 'approval', 'rejection', 'completion']
    
    for stage_key in required_stages:
        layout_id, layout_name = get_default_layout_for_stage(
            db, tenant_id, request_type, stage_key
        )
        
        if layout_id:
            stage_mappings[stage_key] = {
                'layout_id': str(layout_id),
                'name': layout_name
            }
        else:
            # Use placeholder if no layout found
            logger.warning(
                f"No layout found for {request_type} stage '{stage_key}', "
                f"using placeholder. Please map a layout in Workflow Layout Manager."
            )
            stage_mappings[stage_key] = {
                'layout_id': None,
                'name': 'Default Form (Not Mapped)'
            }
    
    return stage_mappings


def seed_workflow_layout_groups_for_tenant(
    db: Session,
    tenant_id: UUID,
    created_by: UUID = None
):
    """
    Seed or update WorkflowLayoutGroups for a tenant.
    Ensures default groups have all required stage_mappings.
    
    Args:
        db: Database session
        tenant_id: Tenant ID
        created_by: User ID who creates the groups (optional)
    """
    request_types = [
        'vendor_submission_workflow',
        'agent_onboarding_workflow'
    ]
    
    for request_type in request_types:
        logger.info(f"\n📋 Processing request_type: {request_type}")
        
        # Get or create default group
        default_group = db.query(FormType).filter(
            FormType.tenant_id == tenant_id,
            FormType.request_type == request_type,
            FormType.is_default == True
        ).first()
        
        if not default_group:
            logger.info(f"  Creating default WorkflowLayoutGroup for {request_type}...")
            
            # Get default stage_mappings
            stage_mappings = ensure_default_stage_mappings(
                db, tenant_id, request_type
            )
            
            default_group = FormType(
                tenant_id=tenant_id,
                name=f"{request_type.replace('_', ' ').title()} Layout (Default)",
                request_type=request_type,
                description=f"Standard workflow for {request_type.replace('_', ' ')}",
                covered_entities=['vendor', 'agent', 'users', 'workflow_ticket', 'master_data'],
                stage_mappings=stage_mappings,
                is_default=True,
                is_active=True,
                created_by=created_by
            )
            
            db.add(default_group)
            db.commit()
            db.refresh(default_group)
            
            logger.info(f"  ✅ Created default group: {default_group.name}")
            logger.info(f"     Stage mappings: {list(stage_mappings.keys())}")
        else:
            logger.info(f"  Found existing default group: {default_group.name}")
            
            # Check if stage_mappings are missing Submission or Approval
            stage_mappings = default_group.stage_mappings or {}
            missing_stages = []
            
            if 'submission' not in stage_mappings:
                missing_stages.append('submission')
            if 'approval' not in stage_mappings:
                missing_stages.append('approval')
            
            if missing_stages:
                logger.info(f"  ⚠️  Missing stage mappings: {missing_stages}")
                logger.info(f"  Updating stage_mappings...")
                
                # Get default mappings for missing stages
                for stage_key in missing_stages:
                    layout_id, layout_name = get_default_layout_for_stage(
                        db, tenant_id, request_type, stage_key
                    )
                    
                    if layout_id:
                        stage_mappings[stage_key] = {
                            'layout_id': str(layout_id),
                            'name': layout_name
                        }
                        logger.info(f"    ✅ Added '{stage_key}' mapping: {layout_name}")
                    else:
                        logger.warning(
                            f"    ⚠️  No layout found for '{stage_key}', "
                            f"please map manually in Workflow Layout Manager"
                        )
                
                # Update the group
                default_group.stage_mappings = stage_mappings
                db.commit()
                logger.info(f"  ✅ Updated default group with missing mappings")
            else:
                logger.info(f"  ✅ All required stage mappings present: {list(stage_mappings.keys())}")
    
    logger.info("\n✅ Workflow Layout Groups seeding complete!")


def seed_workflow_layout_groups_all_tenants(created_by: UUID = None):
    """Seed WorkflowLayoutGroups for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("No tenants found. Please seed tenants first.")
            return
        
        for tenant in tenants:
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing tenant: {tenant.name} ({tenant.id})")
            logger.info(f"{'='*60}")
            
            seed_workflow_layout_groups_for_tenant(
                db, tenant.id, created_by
            )
        
        logger.info("\n" + "="*60)
        logger.info("✅ All tenants processed!")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import uuid
    
    # Use a system user ID (or None)
    system_user_id = None
    
    try:
        seed_workflow_layout_groups_all_tenants(created_by=system_user_id)
        logger.info("\n✅ Script completed successfully!")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Script failed: {e}", exc_info=True)
        sys.exit(1)

