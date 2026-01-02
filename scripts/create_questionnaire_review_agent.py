#!/usr/bin/env python3
"""
Script to create the Questionnaire Review Agent for all tenants
"""
import sys
import os

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.agentic_agent import AgenticAgent, AgenticAgentType, AgentSkill, AgenticAgentStatus
from app.models.tenant import Tenant
import uuid
from datetime import datetime

def create_questionnaire_review_agent_for_tenant(db: Session, tenant_id: uuid.UUID):
    """Create Questionnaire Review Agent for a specific tenant"""
    
    # Check if agent already exists
    existing = db.query(AgenticAgent).filter(
        AgenticAgent.tenant_id == tenant_id,
        AgenticAgent.agent_type == AgenticAgentType.QUESTIONNAIRE_REVIEWER.value
    ).first()
    
    if existing:
        print(f"  ✓ Questionnaire Review Agent already exists for tenant {tenant_id}")
        return existing
    
    # Create the agent
    agent = AgenticAgent(
        tenant_id=tenant_id,
        name="Questionnaire Review Agent",
        agent_type=AgenticAgentType.QUESTIONNAIRE_REVIEWER.value,
        description="AI-powered questionnaire review agent that analyzes submitted assessment responses, calculates risk scores, flags risks, and assigns reviews to human reviewers. Integrates with policies and requirements for comprehensive review.",
        skills=[
            AgentSkill.QUESTIONNAIRE_REVIEW.value,
            AgentSkill.FLAG_RISKS.value,
            AgentSkill.SEND_FOLLOWUP.value
        ],
        capabilities={
            "risk_scoring": True,
            "policy_integration": True,
            "requirement_integration": True,
            "automated_review": True,
            "human_reviewer_assignment": True,
            "email_notifications": True,
            "audit_trail": True
        },
        configuration={
            "auto_review_on_submission": True,
            "risk_threshold_for_human_review": 50,
            "email_notifications_enabled": True,
            "audit_enabled": True
        },
        rag_enabled=True,
        status=AgenticAgentStatus.ACTIVE.value,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    print(f"  ✓ Created Questionnaire Review Agent (ID: {agent.id}) for tenant {tenant_id}")
    return agent


def main():
    """Create Questionnaire Review Agent for all tenants"""
    db: Session = SessionLocal()
    
    try:
        print("Creating Questionnaire Review Agent for all tenants...")
        print("=" * 60)
        
        # Get all tenants
        tenants = db.query(Tenant).all()
        
        if not tenants:
            print("No tenants found.")
            return
        
        print(f"Found {len(tenants)} tenant(s)")
        print()
        
        created_count = 0
        existing_count = 0
        
        for tenant in tenants:
            print(f"Processing tenant: {tenant.name} (ID: {tenant.id})")
            existing = db.query(AgenticAgent).filter(
                AgenticAgent.tenant_id == tenant.id,
                AgenticAgent.agent_type == AgenticAgentType.QUESTIONNAIRE_REVIEWER.value
            ).first()
            
            if existing:
                existing_count += 1
                print(f"  ✓ Agent already exists")
            else:
                create_questionnaire_review_agent_for_tenant(db, tenant.id)
                created_count += 1
            print()
        
        print("=" * 60)
        print(f"Summary:")
        print(f"  - Created: {created_count} agent(s)")
        print(f"  - Already existed: {existing_count} agent(s)")
        print(f"  - Total tenants: {len(tenants)}")
        print()
        print("✅ Questionnaire Review Agent setup complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
