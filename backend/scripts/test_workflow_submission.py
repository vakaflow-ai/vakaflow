#!/usr/bin/env python3
"""
Test script to verify agent submission workflow triggering
Creates test data and submits an agent to test workflow
"""
import sys
import os
import requests
import json
from datetime import datetime
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api/v1"

def print_step(message):
    print(f"\n{'='*60}")
    print(f"STEP: {message}")
    print('='*60)

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

def login(email="vendor@example.com", password="admin123"):
    """Login and get access token"""
    print_step("1. Logging in")
    
    login_data = {
        "email": email,
        "password": password
    }
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print_error(f"Login failed: {response.status_code}")
        print(response.text)
        return None
    
    token = response.json().get("access_token")
    if not token:
        print_error("No access token in response")
        return None
    
    print_success(f"Logged in successfully")
    print_info(f"Token: {token[:20]}...")
    return token

def get_headers(token):
    """Get headers with authorization"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def create_draft_agent(token):
    """Create a draft agent"""
    print_step("2. Creating draft agent")
    
    agent_data = {
        "name": f"Test Agent - {datetime.now().strftime('%Y%m%d-%H%M%S')}",
        "type": "chatbot",
        "category": "customer_service",
        "subcategory": "support",
        "description": "Test agent for workflow submission testing",
        "version": "1.0.0",
        "status": "draft",
        "capabilities": ["text_processing", "qna"],
        "data_types": ["text"],
        "regions": ["US"]
    }
    
    response = requests.post(
        f"{BASE_URL}/agents",
        json=agent_data,
        headers=get_headers(token)
    )
    
    if response.status_code not in [200, 201]:
        print_error(f"Failed to create agent: {response.status_code}")
        print(response.text)
        return None
    
    agent = response.json()
    agent_id = agent.get("id")
    print_success(f"Created draft agent: {agent_id}")
    print_info(f"Agent name: {agent.get('name')}")
    return agent_id

def create_agent_metadata(token, agent_id):
    """Create agent metadata (required for submission)"""
    print_step("3. Updating agent metadata")
    
    metadata = {
        "llm_vendor": "OpenAI",
        "llm_model": "GPT-4",
        "deployment_type": "public_cloud_saas",
        "use_cases": ["customer_support"],
        "features": ["chat", "qna"],
        "personas": [{"name": "Support Agent", "description": "Handles customer queries"}],
        "version_info": {"release_notes": "Initial version"}
    }
    
    response = requests.patch(
        f"{BASE_URL}/agents/{agent_id}",
        json=metadata,
        headers=get_headers(token)
    )
    
    if response.status_code not in [200, 201]:
        print_error(f"Failed to update metadata: {response.status_code}")
        print(response.text)
        return False
    
    print_success("Updated agent metadata")
    return True

def submit_agent(token, agent_id):
    """Submit the agent (this should trigger workflow)"""
    print_step("4. Submitting agent (should trigger workflow)")
    
    response = requests.post(
        f"{BASE_URL}/agents/{agent_id}/submit",
        headers=get_headers(token)
    )
    
    if response.status_code != 200:
        print_error(f"Failed to submit agent: {response.status_code}")
        print(response.text)
        return None
    
    agent = response.json()
    print_success("Agent submitted successfully!")
    
    # Check for workflow information
    onboarding_request_id = agent.get("onboarding_request_id")
    workflow_status = agent.get("workflow_status")
    workflow_current_step = agent.get("workflow_current_step")
    
    print_info(f"Agent Status: {agent.get('status')}")
    
    if onboarding_request_id:
        print_success(f"✅ Workflow triggered!")
        print_info(f"   Onboarding Request ID: {onboarding_request_id}")
        print_info(f"   Workflow Status: {workflow_status}")
        print_info(f"   Current Step: {workflow_current_step}")
        return {
            "success": True,
            "onboarding_request_id": onboarding_request_id,
            "workflow_status": workflow_status,
            "workflow_current_step": workflow_current_step
        }
    else:
        print_error("⚠️  No workflow request created!")
        print_info("   This means the workflow did not trigger")
        return {
            "success": False,
            "onboarding_request_id": None
        }

def verify_onboarding_request_in_db(agent_id):
    """Verify the onboarding request exists in database"""
    print_step("5. Verifying onboarding request in database")
    
    import psycopg2
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="vaka",
            user="vaka_user",
            password="vaka_password"
        )
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, status, current_step, workflow_config_id, assigned_to
            FROM onboarding_requests
            WHERE agent_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (agent_id,))
        
        result = cur.fetchone()
        if result:
            print_success("Onboarding request found in database!")
            print_info(f"   Request ID: {result[0]}")
            print_info(f"   Status: {result[1]}")
            print_info(f"   Current Step: {result[2]}")
            print_info(f"   Workflow Config ID: {result[3]}")
            print_info(f"   Assigned To: {result[4]}")
            
            # Check workflow config
            if result[3]:
                cur.execute("""
                    SELECT name, status, workflow_steps
                    FROM workflow_configurations
                    WHERE id = %s
                """, (result[3],))
                wf_result = cur.fetchone()
                if wf_result:
                    print_info(f"   Workflow Name: {wf_result[0]}")
                    print_info(f"   Workflow Status: {wf_result[1]}")
                    steps = wf_result[2]
                    if isinstance(steps, list):
                        print_info(f"   Workflow Steps: {len(steps)} steps")
                    else:
                        print_info(f"   Workflow Steps: {type(steps)}")
            
            cur.close()
            conn.close()
            return True
        else:
            print_error("No onboarding request found in database")
            cur.close()
            conn.close()
            return False
    except Exception as e:
        print_error(f"Database error: {str(e)}")
        return False

def main():
    print("\n" + "="*60)
    print("AGENT SUBMISSION WORKFLOW TEST")
    print("="*60)
    
    # Step 1: Login
    token = login()
    if not token:
        print_error("Cannot proceed without authentication")
        print_info("Try creating a user first with: ./create_user.sh")
        return 1
    
    # Step 2: Create draft agent
    agent_id = create_draft_agent(token)
    if not agent_id:
        print_error("Cannot proceed without agent")
        return 1
    
    # Step 3: Create metadata (required for submission)
    if not create_agent_metadata(token, agent_id):
        print_error("Cannot proceed without metadata")
        return 1
    
    # Step 4: Submit agent
    result = submit_agent(token, agent_id)
    if not result:
        print_error("Submission failed")
        return 1
    
    # Step 5: Verify onboarding request in database
    verify_onboarding_request_in_db(agent_id)
    
    # Summary
    print_step("TEST SUMMARY")
    if result.get("success"):
        print_success("✅ TEST PASSED: Workflow triggered successfully!")
        print_info(f"   Agent ID: {agent_id}")
        print_info(f"   Onboarding Request ID: {result.get('onboarding_request_id')}")
        print_info(f"   Workflow Status: {result.get('workflow_status')}")
        print_info(f"   Current Step: {result.get('workflow_current_step')}")
        return 0
    else:
        print_error("❌ TEST FAILED: Workflow did not trigger")
        print_info(f"   Agent ID: {agent_id}")
        print_info("   Check backend logs for details")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

