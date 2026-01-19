#!/usr/bin/env python3
"""
Manual test for Agent Studio API endpoints
This bypasses authentication for testing purposes
"""

import requests
import json

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_agent_studio_endpoints():
    """Test Agent Studio API endpoints"""
    
    print("🚀 Testing Agent Studio API Endpoints")
    print("=" * 50)
    
    # Test implemented endpoints
    endpoints_to_test = [
        ("/api/v1/agent-studio/dashboard", "GET"),
        ("/api/v1/agent-studio/entities", "GET"),
        ("/api/v1/agent-studio/entities", "POST"),
        ("/api/v1/agent-studio/profiles", "GET"),
        ("/api/v1/agent-studio/profiles", "POST"),
    ]
    
    results = []
    
    for endpoint, method in endpoints_to_test:
        try:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            else:
                response = requests.post(f"{BASE_URL}{endpoint}", timeout=10)
                
            print(f"✅ {method} {endpoint}: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"   Response keys: {list(data.keys())[:5]}")  # Show first 5 keys
                except:
                    print(f"   Response: {response.text[:100]}...")  # Show first 100 chars
            elif response.status_code == 401:
                print("   ⚠️  Authentication required (expected)")
            elif response.status_code == 404:
                print("   ❌ Endpoint not found")
            else:
                print(f"   ❌ Unexpected status: {response.status_code}")
                
            results.append(response.status_code != 404)  # Count as success if not 404
            
        except requests.exceptions.ConnectionError:
            print(f"❌ {method} {endpoint}: Connection failed - is the server running?")
            results.append(False)
        except Exception as e:
            print(f"❌ {method} {endpoint}: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    success_count = sum(results)
    total_count = len(results)
    
    if success_count == total_count:
        print(f"🎉 All {success_count}/{total_count} endpoints are accessible!")
        print("✅ Agent Studio API is properly registered and responding")
    else:
        print(f"⚠️  {success_count}/{total_count} endpoints are accessible")
        print("Some endpoints may need implementation or registration")
    
    return success_count == total_count

if __name__ == "__main__":
    # Check if server is running first
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        if health_response.status_code == 200:
            print("✅ Backend server is running")
            test_agent_studio_endpoints()
        else:
            print("❌ Backend server health check failed")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server")
        print("Please start the backend server first:")
        print("  cd /Users/vikasc/vaka/backend")
        print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")