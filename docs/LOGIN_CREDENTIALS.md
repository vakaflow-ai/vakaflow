# 🔐 Login Credentials

## Default User

**Email:** `vendor@example.com`  
**Password:** `admin123`

## Login URL

**Frontend:** http://localhost:3000/login  
**API:** http://localhost:8000/api/v1/auth/login

## If Login Fails

### Option 1: Recreate User via API

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@example.com",
    "name": "Default Vendor",
    "password": "admin123",
    "role": "vendor_user"
  }'
```

### Option 2: Check Database

```bash
cd backend
source venv/bin/activate
python -c "
from app.core.database import SessionLocal
from app.models.user import User
db = SessionLocal()
user = db.query(User).filter(User.email == 'vendor@example.com').first()
if user:
    print(f'User exists: {user.email}')
    print(f'Active: {user.is_active}')
else:
    print('User does not exist')
db.close()
"
```

### Option 3: Reset Password

If the user exists but password doesn't work, you can reset it:

```bash
cd backend
source venv/bin/activate
python -c "
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
db = SessionLocal()
user = db.query(User).filter(User.email == 'vendor@example.com').first()
if user:
    user.hashed_password = get_password_hash('admin123')
    user.is_active = True
    db.commit()
    print('Password reset!')
db.close()
"
```

## Troubleshooting

1. **Backend not running?**
   ```bash
   ./manage.sh restart
   ```

2. **Database connection issue?**
   ```bash
   ./manage.sh status
   # Check if PostgreSQL is running
   ```

3. **User doesn't exist?**
   - Use Option 1 above to create the user

4. **Password incorrect?**
   - Use Option 3 above to reset the password

---

**Note:** The default password `admin123` meets all requirements:
- ✅ Minimum 8 characters
- ✅ Contains letters
- ✅ Contains numbers

