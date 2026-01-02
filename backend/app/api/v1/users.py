"""
User management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from app.core.database import get_db
from app.models.user import User, UserRole
from app.api.v1.auth import get_current_user
from app.core.security import get_password_hash
from app.core.feature_gating import FeatureGate
from app.core.audit import audit_service, AuditAction
from app.services.master_data_service import MasterDataService
import logging
import csv
import io
import secrets
import string

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    """User creation schema"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=100)
    role: str
    tenant_id: Optional[UUID] = None  # Only platform admin can specify tenant_id


class UserUpdate(BaseModel):
    """User update schema"""
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    department: Optional[str] = None
    organization: Optional[str] = None
    tenant_id: Optional[UUID] = None  # Only platform_admin can update tenant_id


class UserCSVImport(BaseModel):
    """User CSV import schema"""
    users: List[dict]  # List of user dictionaries from CSV
    default_role: Optional[str] = "end_user"
    send_invitation: bool = Field(default=False, description="Send invitation email to new users")


class UserResponse(BaseModel):
    """User response schema"""
    id: str
    email: str
    name: str
    role: str
    tenant_id: Optional[str]
    department: Optional[str] = None
    organization: Optional[str] = None
    is_active: bool
    created_at: str
    
    class Config:
        from_attributes = True


def require_user_management_permission(current_user: User = Depends(get_current_user)) -> User:
    """Require user management permission (tenant_admin, user_admin, platform_admin, or vendor_coordinator)"""
    allowed_roles = ["tenant_admin", "user_admin", "platform_admin", "vendor_coordinator"]
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User management access required. Your role: {user_role}. Allowed roles: {', '.join(allowed_roles)}"
        )
    return current_user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_user_management_permission),
    db: Session = Depends(get_db)
):
    """Create a new user (Tenant Admin, User Admin, or Platform Admin only)"""
    # Check if user already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate role
    try:
        role = UserRole(user_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {user_data.role}"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to create users"
        )
    
    # Determine tenant_id - ALL users can only create users in their own tenant
    tenant_id = effective_tenant_id
    
    # Validate that if tenant_id is provided in request, it matches current_user's effective tenant
    if user_data.tenant_id and user_data.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Can only create users in your own tenant"
        )
    
    if current_user.role.value == "vendor_coordinator":
        # Vendor coordinator can only create vendor users in their tenant
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vendor coordinator must belong to a tenant"
            )
        # Vendor coordinators can only create vendor_user or vendor_coordinator roles
        if role not in [UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor coordinators can only create vendor_user or vendor_coordinator roles"
            )
    else:
        # Tenant admin/user admin can only create users for their own tenant
        tenant_id = current_user.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant admin must belong to a tenant"
            )
    
    # Check user limit if tenant_id is set
    if tenant_id:
        can_create, current_count, max_users = FeatureGate.check_user_limit(db, str(tenant_id))
        if not can_create:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User limit reached ({current_count}/{max_users}). Please upgrade your license."
            )
    
    # Platform admin role can only be assigned by platform admins
    if role == UserRole.PLATFORM_ADMIN and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can create platform admin users"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email.lower(),
        name=user_data.name,
        role=role,
        tenant_id=tenant_id,
        hashed_password=hashed_password,
        is_active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        department=user.department,
        organization=user.organization,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.get("", response_model=List[UserResponse])
async def list_users(
    tenant_id: Optional[UUID] = None,
    role_filter: Optional[str] = None,
    current_user: User = Depends(require_user_management_permission),
    db: Session = Depends(get_db)
):
    """List users (filtered by tenant and role)"""
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view users"
        )
    
    query = db.query(User)
    
    # ALL users (including platform_admin) must filter by their own tenant
    # If tenant_id parameter is provided, validate it matches current_user's effective tenant
    if tenant_id:
        if tenant_id != effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only view users from your own tenant"
            )
        query = query.filter(User.tenant_id == tenant_id)
    else:
        # Default to current user's effective tenant
        query = query.filter(User.tenant_id == effective_tenant_id)
    
    # Vendor coordinator can only see vendor users
    if current_user.role.value == "vendor_coordinator":
        query = query.filter(
            User.role.in_([UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR])
        )
    
    # Filter by role
    if role_filter:
        try:
            role = UserRole(role_filter)
            query = query.filter(User.role == role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role_filter}"
            )
    
    users = query.order_by(User.created_at.desc()).all()
    
    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            name=u.name,
            role=u.role.value,
            tenant_id=str(u.tenant_id) if u.tenant_id else None,
            department=u.department,
            organization=u.organization,
            is_active=u.is_active,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(require_user_management_permission),
    db: Session = Depends(get_db)
):
    """Get user details"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view users"
        )
    
    # Check permissions - ALL users can only view users from their own tenant
    if user.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User belongs to a different tenant"
        )
    
    if current_user.role.value == "vendor_coordinator":
        # Vendor coordinator can only view vendor users
        if user.role not in [UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor coordinators can only view vendor users"
            )
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        department=user.department,
        organization=user.organization,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user - allows self-update for profile fields, requires admin for role/is_active/password"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is updating themselves
    is_self_update = user.id == current_user.id
    
    # If not self-update, require user management permission
    if not is_self_update:
        # Check if user has management permissions
        allowed_roles = ["tenant_admin", "user_admin", "platform_admin", "vendor_coordinator"]
        user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User management access required. Your role: {user_role}. Allowed roles: {', '.join(allowed_roles)}"
            )
        
        # Vendor coordinator restrictions
        if current_user.role.value == "vendor_coordinator":
            if user.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
            if user.role not in [UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Vendor coordinators can only manage vendor users"
                )
            # Vendor coordinators cannot change roles to non-vendor roles
            if user_data.role is not None:
                try:
                    new_role = UserRole(user_data.role)
                    if new_role not in [UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR]:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Vendor coordinators can only assign vendor_user or vendor_coordinator roles"
                        )
                except ValueError:
                    pass  # Will be caught later
        # Tenant isolation check - but allow platform_admin without tenant_id to assign themselves
        # If updating tenant_id, allow platform_admin without tenant_id to assign themselves
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if user_data.tenant_id is None:
            # Not updating tenant_id - normal tenant isolation applies
            if not effective_tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User must be assigned to a tenant to update users"
                )
            
            # ALL users (including platform_admin) can only update users from their own tenant
            if user.tenant_id != effective_tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: User belongs to a different tenant"
                )
        else:
            # Updating tenant_id - special handling
            if current_user.role.value != "platform_admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only platform admins can update tenant_id"
                )
            # Platform admin can assign tenant_id (including to themselves)
            # If current_user already has tenant_id, they can only assign to their own tenant
            if current_user.tenant_id and user_data.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Can only assign users to your own tenant"
                )
    
    # Update fields
    if user_data.name is not None:
        user.name = user_data.name
    
    # Role, is_active, and password require admin permissions (not allowed in self-update)
    if user_data.role is not None:
        if is_self_update:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change your own role"
            )
        try:
            new_role = UserRole(user_data.role)
            # Platform admin role can only be assigned by platform admins
            if new_role == UserRole.PLATFORM_ADMIN and current_user.role.value != "platform_admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only platform admins can assign platform admin role"
                )
            user.role = new_role
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {user_data.role}"
            )
    
    if user_data.is_active is not None:
        if is_self_update:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change your own active status"
            )
        user.is_active = user_data.is_active
    
    if user_data.password is not None:
        if is_self_update:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Use the change password endpoint to update your password"
            )
        user.hashed_password = get_password_hash(user_data.password)
    
    # Department and organization can be updated by anyone (self or admin)
    if user_data.department is not None:
        user.department = user_data.department
    if user_data.organization is not None:
        user.organization = user_data.organization
    
    # Tenant_id can only be updated by platform_admin
    # Platform admins can assign themselves to a tenant if they don't have one
    # Or assign other users to tenants (but only within their own tenant once they have one)
    if user_data.tenant_id is not None:
        if current_user.role.value != "platform_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only platform admins can update tenant_id"
            )
        
        # Validate tenant exists
        from app.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == user_data.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        
            # If current_user already has an effective tenant_id, they can only assign users to their own tenant
            # Exception: If assigning to self and current_user has no tenant_id, allow it
            from app.core.tenant_utils import get_effective_tenant_id
            effective_tenant_id = get_effective_tenant_id(current_user, db)
            if effective_tenant_id and user_data.tenant_id != effective_tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Can only assign users to your own tenant"
                )
        
        # Allow assignment
        user.tenant_id = user_data.tenant_id
    
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        department=user.department,
        organization=user.organization,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_user_management_permission),
    db: Session = Depends(get_db)
):
    """Delete user (Tenant Admin, User Admin, Platform Admin, or Vendor Coordinator only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to delete users"
        )
    
    # ALL users (including platform_admin) can only delete users from their own tenant
    if user.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User belongs to a different tenant"
        )
    
    # Check vendor coordinator restrictions
    if current_user.role.value == "vendor_coordinator":
        if user.role not in [UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor coordinators can only delete vendor users"
            )
    
    # Prevent deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Prevent deleting platform admins (unless you're a platform admin)
    if user.role == UserRole.PLATFORM_ADMIN and current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete platform admin users"
        )
    
    db.delete(user)
    db.commit()
    
    return None


@router.post("/terminate/{user_id}", response_model=UserResponse)
async def terminate_user(
    user_id: UUID,
    current_user: User = Depends(require_user_management_permission),
    db: Session = Depends(get_db)
):
    """Terminate user (mark as inactive) - Tenant Admin, User Admin, Platform Admin, or Vendor Coordinator only"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to terminate users"
        )
    
    # ALL users (including platform_admin) can only terminate users from their own tenant
    if user.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User belongs to a different tenant"
        )
    
    # Check vendor coordinator restrictions
    if current_user.role.value == "vendor_coordinator":
        if user.role not in [UserRole.VENDOR_USER, UserRole.VENDOR_COORDINATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor coordinators can only terminate vendor users"
            )
    
    # Prevent terminating yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot terminate your own account"
        )
    
    # Mark user as inactive
    user.is_active = False
    db.commit()
    db.refresh(user)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=str(user.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"action": "terminate", "email": user.email}
    )
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
        department=user.department,
        organization=user.organization,
        is_active=user.is_active,
        created_at=user.created_at.isoformat()
    )


@router.post("/import-csv")
async def import_users_csv(
    file: UploadFile = File(...),
    default_role: str = Query("end_user", description="Default role for imported users"),
    send_invitation: bool = Query(False, description="Send invitation email to new users"),
    current_user: User = Depends(require_user_management_permission),
    db: Session = Depends(get_db)
):
    """Import users from CSV file (Tenant Admin, User Admin, or Platform Admin only)"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to import users"
        )
    
    # ALL users (including platform_admin) can only import users to their own tenant
    tenant_id = effective_tenant_id
    
    # Read CSV file
    contents = await file.read()
    csv_content = contents.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_content))
    
    # Expected columns: First Name, Last Name, Email, Department, Role (optional)
    results = {
        "success": [],
        "errors": [],
        "skipped": []
    }
    
    # Validate role
    try:
        default_role_enum = UserRole(default_role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid default role: {default_role}"
        )
    
    # Check user limit
    can_create, current_count, max_users = FeatureGate.check_user_limit(db, str(tenant_id))
    
    for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
        try:
            # Normalize column names (case-insensitive, handle spaces)
            normalized_row = {k.strip().lower().replace(' ', '_'): v.strip() if v else '' for k, v in row.items()}
            
            # Extract fields
            first_name = normalized_row.get('first_name', '').strip()
            last_name = normalized_row.get('last_name', '').strip()
            email = normalized_row.get('email', '').strip().lower()
            department = normalized_row.get('department', '').strip()
            organization = normalized_row.get('organization', '').strip()
            role_str = normalized_row.get('role', default_role).strip().lower()
            
            # Validate required fields
            if not email:
                results["errors"].append({
                    "row": row_num,
                    "email": email or "N/A",
                    "error": "Email is required"
                })
                continue
            
            if not email or '@' not in email:
                results["errors"].append({
                    "row": row_num,
                    "email": email,
                    "error": "Invalid email format"
                })
                continue
            
            # Build name from first_name and last_name, or use name field
            if first_name or last_name:
                name = f"{first_name} {last_name}".strip()
            else:
                name = normalized_row.get('name', email.split('@')[0]).strip()
            
            if not name:
                name = email.split('@')[0]
            
            # Validate role
            try:
                user_role = UserRole(role_str)
            except ValueError:
                user_role = default_role_enum
                results["skipped"].append({
                    "row": row_num,
                    "email": email,
                    "reason": f"Invalid role '{role_str}', using default '{default_role}'"
                })
            
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                # Update existing user
                existing_user.name = name
                existing_user.department = department or existing_user.department
                existing_user.organization = organization or existing_user.organization
                existing_user.role = user_role
                existing_user.is_active = True  # Reactivate if was inactive
                existing_user.tenant_id = tenant_id
                db.commit()
                
                results["success"].append({
                    "row": row_num,
                    "email": email,
                    "action": "updated"
                })
                continue
            
            # Check user limit
            if not can_create:
                results["errors"].append({
                    "row": row_num,
                    "email": email,
                    "error": f"User limit reached ({current_count}/{max_users})"
                })
                continue
            
            # Generate temporary password
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
            hashed_password = get_password_hash(temp_password)
            
            # Create user
            user = User(
                email=email,
                name=name,
                role=user_role,
                tenant_id=tenant_id,
                department=department,
                organization=organization,
                hashed_password=hashed_password,
                is_active=True
            )
            
            db.add(user)
            db.flush()  # Flush to get user ID
            
            # Send invitation email if requested
            if send_invitation:
                try:
                    from app.services.email_service import email_service
                    email_service.load_config_from_db(db, str(tenant_id) if tenant_id else None)
                    
                    # Get tenant name
                    from app.models.tenant import Tenant
                    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                    tenant_name = tenant.name if tenant else "Organization"
                    
                    await email_service.send_email(
                        to_email=email,
                        subject=f"Welcome to {tenant_name} - Account Created",
                        html_body=f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                                <h2 style="color: #2563eb;">Welcome to {tenant_name}!</h2>
                                <p>Your account has been created. Please use the following temporary password to log in:</p>
                                <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                                    <strong>Email:</strong> {email}<br>
                                    <strong>Temporary Password:</strong> {temp_password}
                                </div>
                                <p><strong>Important:</strong> Please change your password after your first login.</p>
                            </div>
                        </body>
                        </html>
                        """,
                        text_body=f"Welcome to {tenant_name}!\n\nYour account has been created.\n\nEmail: {email}\nTemporary Password: {temp_password}\n\nPlease change your password after your first login."
                    )
                except Exception as e:
                    logger.warning(f"Failed to send invitation email to {email}: {e}")
            
            results["success"].append({
                "row": row_num,
                "email": email,
                "action": "created"
            })
            
        except Exception as e:
            results["errors"].append({
                "row": row_num,
                "email": row.get('email', 'N/A'),
                "error": str(e)
            })
    
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="users",
        resource_id=None,
        tenant_id=str(tenant_id) if tenant_id else None,
        details={
            "action": "csv_import",
            "total_rows": len(list(csv.DictReader(io.StringIO(csv_content)))),
            "success": len(results["success"]),
            "errors": len(results["errors"]),
            "skipped": len(results["skipped"])
        }
    )
    
    return {
        "message": f"Import completed: {len(results['success'])} users processed",
        "results": results
    }

