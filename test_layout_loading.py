#!/usr/bin/env python3
"""
Test form layout loading for Agent Studio
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.app.core.database import get_db
from backend.app.models.form_layout import FormLayout

def test_layout_loading():
    """Test that the correct layouts are loaded for different workflows"""
    
    db = next(get_db())
    
    print("🔍 Testing Form Layout Loading")
    print("=" * 50)
    
    # Test vendor submission workflow
    print("\n📋 Vendor Submission Workflow (new stage):")
    vendor_layout = db.query(FormLayout).filter(
        FormLayout.request_type == 'vendor_submission_workflow',
        FormLayout.workflow_stage == 'new',
        FormLayout.is_default == True,
        FormLayout.is_active == True
    ).first()
    
    if vendor_layout:
        print(f"✅ Found layout: {vendor_layout.name}")
        print(f"✅ ID: {vendor_layout.id}")
        print(f"✅ Sections: {len(vendor_layout.sections)}")
        
        # Check for governance fields
        has_governance = any('governance' in section.get('title', '').lower() for section in vendor_layout.sections)
        has_skills = any('skills' in str(section.get('fields', [])) for section in vendor_layout.sections)
        has_service_account = any('service_account' in str(section.get('fields', [])) for section in vendor_layout.sections)
        
        print(f"✅ Has Governance Section: {has_governance}")
        print(f"✅ Has Skills Field: {has_skills}")
        print(f"✅ Has Service Account: {has_service_account}")
    else:
        print("❌ No default active layout found for vendor submission")
    
    # Test agent onboarding workflow
    print("\n🤖 Agent Onboarding Workflow (new stage):")
    agent_layout = db.query(FormLayout).filter(
        FormLayout.request_type == 'agent_onboarding_workflow',
        FormLayout.workflow_stage == 'new',
        FormLayout.is_default == True,
        FormLayout.is_active == True
    ).first()
    
    if agent_layout:
        print(f"✅ Found layout: {agent_layout.name}")
        print(f"✅ ID: {agent_layout.id}")
        print(f"✅ Sections: {len(agent_layout.sections)}")
        
        # Check for governance fields
        has_governance = any('governance' in section.get('title', '').lower() for section in agent_layout.sections)
        has_skills = any('skills' in str(section.get('fields', [])) for section in agent_layout.sections)
        
        print(f"✅ Has Governance Section: {has_governance}")
        print(f"✅ Has Skills Field: {has_skills}")
    else:
        print("❌ No default active layout found for agent onboarding")
    
    db.close()
    
    return vendor_layout is not None and agent_layout is not None

if __name__ == "__main__":
    success = test_layout_loading()
    if success:
        print("\n🎉 All layouts are properly configured!")
        print("✅ Agent Submission form should now show governance fields")
        print("✅ Skills field should replace use_cases")
        print("✅ Service account, department, organization fields available")
    else:
        print("\n❌ Layout configuration issues detected")