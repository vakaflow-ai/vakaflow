#!/bin/bash

# Create default user for VAKA Platform
# Usage: ./create_user.sh [email] [password] [role]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Default values
EMAIL="${1:-vendor@example.com}"
PASSWORD="${2:-admin123}"
ROLE="${3:-vendor_user}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Creating user...${NC}"
echo -e "Email: ${YELLOW}$EMAIL${NC}"
echo -e "Role: ${YELLOW}$ROLE${NC}"
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
        print(f"User already exists: $EMAIL")
        print(f"To reset password, delete the user first or use a different email.")
        sys.exit(1)
    
    # Create new user
    user = User(
        email="$EMAIL",
        name="Default User",
        role=UserRole.$ROLE,
        hashed_password=get_password_hash("$PASSWORD"),
        is_active=True
    )
    
    db.add(user)
    db.commit()
    
    print(f"${GREEN}✓ User created successfully!${NC}")
    print(f"Email: $EMAIL")
    print(f"Password: $PASSWORD")
    print(f"Role: $ROLE")
    print("")
    print("You can now login at http://localhost:3000/login")
    
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
    sys.exit(1)
finally:
    db.close()
EOF

