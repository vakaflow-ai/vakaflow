#!/bin/bash

# Create platform admin user for VAKA Platform
# Usage: ./create_platform_admin.sh [email] [password] [name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Default values
EMAIL="${1:-platform-admin@vaka.com}"
PASSWORD="${2:-admin123}"
NAME="${3:-Platform Administrator}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Creating Platform Admin user...${NC}"
echo -e "Email: ${YELLOW}$EMAIL${NC}"
echo -e "Name: ${YELLOW}$NAME${NC}"
echo -e "Role: ${YELLOW}platform_admin${NC}"
echo ""

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Please run './manage.sh start' first.${NC}"
    exit 1
fi

source venv/bin/activate

# Create user via Python script
python3 << EOF
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash

db = SessionLocal()
try:
    # Check if user exists
    existing = db.query(User).filter(User.email == "$EMAIL").first()
    if existing:
        if existing.role == UserRole.PLATFORM_ADMIN:
            print(f"${YELLOW}⚠ Platform admin already exists: $EMAIL${NC}")
            print(f"To reset password, delete the user first or use a different email.")
            sys.exit(0)
        else:
            # Update existing user to platform admin
            existing.role = UserRole.PLATFORM_ADMIN
            existing.hashed_password = get_password_hash("$PASSWORD")
            existing.name = "$NAME"
            existing.is_active = True
            db.commit()
            print(f"${GREEN}✓ Updated user to Platform Admin!${NC}")
            print(f"Email: $EMAIL")
            print(f"Password: $PASSWORD")
            print(f"Role: platform_admin")
            sys.exit(0)
    
    # Create new platform admin user
    user = User(
        email="$EMAIL",
        name="$NAME",
        role=UserRole.PLATFORM_ADMIN,
        hashed_password=get_password_hash("$PASSWORD"),
        is_active=True,
        tenant_id=None  # Platform admins don't belong to a tenant
    )
    
    db.add(user)
    db.commit()
    
    print(f"${GREEN}✓ Platform Admin created successfully!${NC}")
    print(f"Email: $EMAIL")
    print(f"Password: $PASSWORD")
    print(f"Role: platform_admin")
    print("")
    print("You can now login at http://localhost:3000/login")
    print("")
    print("${BLUE}Platform Admin Capabilities:${NC}")
    print("  - Create and manage tenants")
    print("  - Assign tenant admins")
    print("  - Manage platform-wide settings")
    print("  - View all tenant data")
    print("  - Manage platform features and licensing")
    
except Exception as e:
    print(f"${RED}Error: {e}${NC}")
    db.rollback()
    sys.exit(1)
finally:
    db.close()
EOF

