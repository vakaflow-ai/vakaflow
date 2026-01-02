"""
Authentication API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.security_middleware import sanitize_input
from app.models.user import User, UserRole
from datetime import timedelta
from app.core.config import settings
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class UserCreate(BaseModel):
    """User creation schema"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=100)
    role: UserRole
    
    @validator('password')
    def validate_password(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @validator('name')
    def sanitize_name(cls, v):
        """Sanitize name input"""
        return sanitize_input(v, max_length=255)


class UserResponse(BaseModel):
    """User response schema"""
    id: str
    email: str
    name: str
    role: str
    tenant_id: Optional[str] = None
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm(cls, obj):
        """Convert ORM object to response, handling UUID conversion"""
        return cls(
            id=str(obj.id),
            email=obj.email,
            name=obj.name,
            role=obj.role.value if hasattr(obj.role, 'value') else str(obj.role)
        )


class Token(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token data schema"""
    email: Optional[str] = None


class LoginRequest(BaseModel):
    """Login request schema (for MFA support)"""
    email: EmailStr
    password: str
    mfa_code: Optional[str] = None


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user"""
    try:
        # Test connection first with a simple query
        db.execute(text("SELECT 1"))
    except Exception as conn_error:
        logger.error(f"Database connection error during authentication: {conn_error}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error. Please try again later."
        )
    
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not user.hashed_password:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    except Exception as query_error:
        logger.error(f"Database query error during authentication: {query_error}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database query error. Please try again later."
        )


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    try:
        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            return None
        token = authorization.replace("Bearer ", "")
        if not token:
            return None
        return get_current_user(token=token, db=db)
    except Exception:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user with tenant validation"""
    from app.core.security import decode_access_token
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    email: str = payload.get("sub")
    token_tenant_id = payload.get("tenant_id")  # Get tenant_id from token
    
    if email is None:
        raise credentials_exception
    
    # Find user - if token has tenant_id, use it for additional security
    if token_tenant_id:
        from uuid import UUID
        user = db.query(User).filter(
            User.email == email,
            User.tenant_id == UUID(token_tenant_id)  # Validate tenant_id matches
        ).first()
    else:
        # Fallback for old tokens without tenant_id (migration scenario)
        user = db.query(User).filter(User.email == email).first()
        # If user found but token doesn't have tenant_id, this is a security issue
        # Log it but allow for backward compatibility
        # Note: Platform admins may legitimately not have tenant_id, so don't warn for them
        if user and user.tenant_id:
            import logging
            logger = logging.getLogger(__name__)
            # Check role safely
            role_str = None
            try:
                if isinstance(user.role, UserRole):
                    role_str = user.role.value
                elif hasattr(user.role, 'value'):
                    role_str = user.role.value
                else:
                    role_str = str(user.role)
            except Exception:
                role_str = str(user.role) if user.role else None
            
            if role_str != "platform_admin":
                logger.warning(f"User {email} authenticated with token missing tenant_id")
    
    if user is None:
        raise credentials_exception
    
    # Ensure user is properly loaded with enum types
    # Refresh to ensure all attributes are loaded correctly
    try:
        db.refresh(user)
    except Exception:
        # If refresh fails, user might already be fresh - continue
        pass
    
    # Debug: Log user role information
    import logging
    import sys
    logger = logging.getLogger(__name__)
    logger.info(f"get_current_user - User: {user.email}, Role: {repr(user.role)}, Role type: {type(user.role).__name__}, Tenant ID: {user.tenant_id}")
    print(f"[GET_CURRENT_USER] User: {user.email}, Role: {repr(user.role)}, Role type: {type(user.role).__name__}, Tenant ID: {user.tenant_id}", file=sys.stderr)
    
    # Additional validation: ensure user's tenant_id matches token's tenant_id
    # Skip this check for platform_admin users who may not have tenant_id
    if token_tenant_id and user.tenant_id and str(user.tenant_id) != token_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant mismatch in authentication token"
        )
    
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Rate limiting: Prevent rapid registration attempts
    # In production, use Redis-based rate limiting
    
    # Check if user already exists (use index for performance)
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email.lower(),  # Normalize email
        name=user_data.name,
        role=user_data.role,
        hashed_password=hashed_password,
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login and get access token (supports JSON and MFA)"""
    try:
        # Get email and password from JSON request
        email = login_data.email.lower()
        password = login_data.password
        mfa_code = login_data.mfa_code
        
        logger.info(f"Login attempt for email: {email}")
        
        # Rate limiting: Prevent brute force attacks
        # In production, implement account lockout after N failed attempts
        
        logger.debug("Authenticating user...")
        try:
            user = authenticate_user(db, email, password)
        except HTTPException:
            # Re-raise HTTP exceptions (like database connection errors)
            raise
        except Exception as auth_error:
            logger.error(f"Authentication error: {auth_error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable. Please try again later."
            )
        if not user:
            logger.warning(f"Authentication failed for email: {email}")
            # Don't reveal if email exists (security best practice)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"User authenticated: {user.email}")
        
        if not user.is_active:
            logger.warning(f"Inactive user attempted login: {email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        # Check if MFA is enabled (with timeout protection)
        logger.debug("Checking MFA configuration...")
        mfa_config = None
        try:
            # Try to import MFAConfig, but don't fail if it doesn't exist
            try:
                from app.models.mfa import MFAConfig
            except ImportError:
                logger.debug("MFAConfig model not found, skipping MFA check")
                mfa_config = None
            else:
                # Use a simple query with timeout protection
                # If the table doesn't exist or query hangs, we'll skip MFA
                try:
                    # Direct query - if table doesn't exist, it will raise an exception
                    # Use a simple query without table inspection to avoid hanging
                        mfa_config = db.query(MFAConfig).filter(
                            MFAConfig.user_id == user.id,
                            MFAConfig.is_enabled == True
                        ).first()
                except Exception as query_error:
                    # Table might not exist or query failed - continue without MFA
                    logger.debug(f"MFA config query failed (table may not exist): {query_error}")
                    mfa_config = None
            logger.debug(f"MFA config check completed. Enabled: {mfa_config is not None}")
        except Exception as e:
            logger.warning(f"Error checking MFA config (continuing without MFA): {e}")
            # Continue without MFA if there's an error (table might not exist)
            mfa_config = None
        
        if mfa_config:
            # MFA is required
            if not mfa_code:
                logger.info(f"MFA required for user: {email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="MFA code required",
                    headers={"X-MFA-Required": "true"}
                )
            
            # Verify MFA code
            logger.debug("Verifying MFA code...")
            from app.services.mfa_service import MFAService
            is_valid = await MFAService.verify_mfa(
                db=db,
                user_id=str(user.id),
                code=mfa_code
            )
            
            if not is_valid:
                logger.warning(f"Invalid MFA code for user: {email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid MFA code",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        
        logger.debug("Creating access token...")
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Build token data - include tenant_id if user has one
        token_data = {
            "sub": user.email,
            "role": user.role.value
        }
        # Include tenant_id in token if user has one (for tenant isolation)
        # Platform admins may not have tenant_id, which is valid
        if user.tenant_id:
            token_data["tenant_id"] = str(user.tenant_id)
        
        access_token = create_access_token(
            data=token_data,
            expires_delta=access_token_expires
        )
        
        logger.info(f"Login successful for user: {email}")
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None
    )

