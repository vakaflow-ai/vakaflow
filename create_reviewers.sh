#!/bin/bash

# Script to create reviewer users for testing the review workflow
# Usage: ./create_reviewers.sh

API_URL="${API_URL:-http://localhost:8000}"

echo "🔐 Creating Reviewer Users..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to create a user
create_user() {
    local email=$1
    local name=$2
    local password=$3
    local role=$4
    
    echo -n "Creating $role ($email)... "
    
    response=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$email\",
            \"name\": \"$name\",
            \"password\": \"$password\",
            \"role\": \"$role\"
        }")
    
    if echo "$response" | grep -q "\"email\""; then
        echo -e "${GREEN}✓ Created${NC}"
        return 0
    elif echo "$response" | grep -q "already exists\|already registered"; then
        echo -e "${YELLOW}⚠ Already exists${NC}"
        return 0
    else
        echo -e "${YELLOW}✗ Failed${NC}"
        echo "   Response: $response"
        return 1
    fi
}

# Create reviewer users
echo "Creating Security Reviewer..."
create_user "security@example.com" "Security Reviewer" "reviewer123" "security_reviewer"

echo ""
echo "Creating Compliance Reviewer..."
create_user "compliance@example.com" "Compliance Reviewer" "reviewer123" "compliance_reviewer"

echo ""
echo "Creating Technical Reviewer..."
create_user "technical@example.com" "Technical Reviewer" "reviewer123" "technical_reviewer"

echo ""
echo "Creating Business Reviewer..."
create_user "business@example.com" "Business Reviewer" "reviewer123" "business_reviewer"

echo ""
echo "Creating Approver..."
create_user "approver@example.com" "Approver" "approver123" "approver"

echo ""
echo "Creating Tenant Admin..."
create_user "admin@example.com" "Tenant Admin" "admin123" "tenant_admin"

echo ""
echo "================================"
echo -e "${GREEN}✅ Reviewer Users Ready!${NC}"
echo ""
echo "📋 Login Credentials:"
echo ""
echo "📝 Vendor (for submissions):"
echo "  Email: vendor@example.com"
echo "  Password: admin123"
echo ""
echo "🔍 Reviewers (for reviewing submitted agents):"
echo "  • Security Reviewer: security@example.com / reviewer123"
echo "  • Compliance Reviewer: compliance@example.com / reviewer123"
echo "  • Technical Reviewer: technical@example.com / reviewer123"
echo "  • Business Reviewer: business@example.com / reviewer123"
echo ""
echo "✅ Approver:"
echo "  Email: approver@example.com"
echo "  Password: approver123"
echo ""
echo "👤 Admin:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo ""
echo "📝 Review Workflow:"
echo "  1. Vendor submits agent → Status: 'submitted'"
echo "  2. Security Reviewer reviews → Stage: 'security'"
echo "  3. Compliance Reviewer reviews → Stage: 'compliance'"
echo "  4. Technical Reviewer reviews → Stage: 'technical'"
echo "  5. Business Reviewer reviews → Stage: 'business'"
echo "  6. If all approved → Status: 'approved'"
echo ""
echo "🔗 Login URL: http://localhost:3000/login"
echo ""
