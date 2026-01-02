#!/usr/bin/env python3
"""
Script to check if workflow tables exist and if workflows are created for tenants
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app.core.database import SessionLocal, engine
from app.models.workflow_config import WorkflowConfiguration, OnboardingRequest
from app.models.tenant import Tenant
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_tables_exist():
    """Check if workflow tables exist in the database"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    required_tables = [
        'workflow_configurations',
        'onboarding_requests',
        'approver_groups'
    ]
    
    print("\n=== Checking Database Tables ===")
    for table in required_tables:
        exists = table in tables
        status = "✓ EXISTS" if exists else "✗ MISSING"
        print(f"{status}: {table}")
        if not exists:
            print(f"  ⚠️  Table '{table}' is missing! Run migrations: alembic upgrade head")
    
    return all(table in tables for table in required_tables)


def check_workflows_for_tenants():
    """Check if workflows exist for each tenant"""
    db = SessionLocal()
    try:
        print("\n=== Checking Workflows for Tenants ===")
        
        # Get all tenants
        tenants = db.query(Tenant).all()
        
        if not tenants:
            print("⚠️  No tenants found in database")
            return False
        
        print(f"Found {len(tenants)} tenant(s)\n")
        
        all_have_workflows = True
        for tenant in tenants:
            # Check for default workflow
            default_workflow = db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == tenant.id,
                WorkflowConfiguration.is_default == True
            ).first()
            
            # Check for any workflow
            any_workflow = db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == tenant.id
            ).first()
            
            # Check for active workflow
            active_workflow = db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == tenant.id,
                WorkflowConfiguration.status == 'active'
            ).first()
            
            status_icon = "✓" if default_workflow else "✗"
            print(f"{status_icon} Tenant: {tenant.name} (ID: {tenant.id})")
            print(f"   Slug: {tenant.slug}")
            
            if default_workflow:
                steps_count = len(default_workflow.workflow_steps) if default_workflow.workflow_steps else 0
                print(f"   ✓ Default Workflow: {default_workflow.name} (ID: {default_workflow.id})")
                print(f"     Status: {default_workflow.status}")
                print(f"     Steps: {steps_count}")
                print(f"     Engine: {default_workflow.workflow_engine}")
            else:
                print(f"   ✗ No default workflow found")
                all_have_workflows = False
                
                if any_workflow:
                    print(f"   ⚠️  Has {db.query(WorkflowConfiguration).filter(WorkflowConfiguration.tenant_id == tenant.id).count()} workflow(s) but none marked as default")
                else:
                    print(f"   ⚠️  No workflows found for this tenant")
                    print(f"   💡 Run: python -m app.services.workflow_seeder (or use API to create)")
            
            print()
        
        return all_have_workflows
        
    except Exception as e:
        logger.error(f"Error checking workflows: {e}", exc_info=True)
        return False
    finally:
        db.close()


def check_onboarding_requests():
    """Check onboarding requests in the system"""
    db = SessionLocal()
    try:
        print("\n=== Checking Onboarding Requests ===")
        
        total_requests = db.query(OnboardingRequest).count()
        print(f"Total onboarding requests: {total_requests}")
        
        if total_requests > 0:
            # Group by status
            from sqlalchemy import func
            status_counts = db.query(
                OnboardingRequest.status,
                func.count(OnboardingRequest.id)
            ).group_by(OnboardingRequest.status).all()
            
            print("\nBy Status:")
            for status, count in status_counts:
                print(f"  {status}: {count}")
            
            # Recent requests
            recent = db.query(OnboardingRequest).order_by(
                OnboardingRequest.created_at.desc()
            ).limit(5).all()
            
            print("\nRecent Requests (last 5):")
            for req in recent:
                print(f"  - Agent: {req.agent_id}, Status: {req.status}, Step: {req.current_step}, Created: {req.created_at}")
        else:
            print("⚠️  No onboarding requests found")
        
        print()
        
    except Exception as e:
        logger.error(f"Error checking onboarding requests: {e}", exc_info=True)
    finally:
        db.close()


def main():
    """Main function"""
    print("=" * 60)
    print("Workflow Tables and Tenant Workflow Checker")
    print("=" * 60)
    
    # Check tables
    tables_exist = check_tables_exist()
    
    if not tables_exist:
        print("\n❌ Some required tables are missing!")
        print("   Run: alembic upgrade head")
        return 1
    
    # Check workflows
    workflows_exist = check_workflows_for_tenants()
    
    # Check onboarding requests
    check_onboarding_requests()
    
    # Summary
    print("=" * 60)
    print("Summary:")
    print(f"  Tables: {'✓ All exist' if tables_exist else '✗ Missing'}")
    print(f"  Workflows: {'✓ All tenants have workflows' if workflows_exist else '✗ Some tenants missing workflows'}")
    print("=" * 60)
    
    if not workflows_exist:
        print("\n💡 To create default workflows for all tenants:")
        print("   python -m backend.scripts.seed_default_workflows")
        print("\n   Or use the API endpoint to create workflows via UI")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
