"""
SCIM 2.0 API endpoints for user provisioning
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.api_gateway import SCIMConfiguration
from app.models.user import User, UserRole
import logging
import hashlib
import hmac

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scim/v2", tags=["scim"])


# SCIM 2.0 Schemas
class SCIMUser(BaseModel):
    """SCIM User resource"""
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    id: Optional[str] = None
    externalId: Optional[str] = None
    userName: str
    name: Optional[Dict[str, str]] = None
    displayName: Optional[str] = None
    emails: List[Dict[str, Any]]
    active: bool = True
    meta: Optional[Dict[str, Any]] = None


class SCIMListResponse(BaseModel):
    """SCIM List response"""
    totalResults: int
    itemsPerPage: int
    startIndex: int
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:ListResponse"]
    Resources: List[SCIMUser]


class SCIMError(BaseModel):
    """SCIM Error response"""
    schemas: List[str] = ["urn:ietf:params:scim:api:messages:2.0:Error"]
    detail: str
    status: str


async def verify_scim_token(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> SCIMConfiguration:
    """Verify SCIM bearer token using hashed comparison"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = authorization.replace("Bearer ", "").strip()
    
    # Get all enabled SCIM configurations
    scim_configs = db.query(SCIMConfiguration).filter(
        SCIMConfiguration.enabled == True
    ).all()
    
    # Verify token against hashed versions
    from app.core.security import verify_password
    
    for scim_config in scim_configs:
        # Check hashed token (preferred)
        if scim_config.bearer_token_hash:
            if verify_password(token, scim_config.bearer_token_hash):
                return scim_config
        # Fallback to plain text (for migration period)
        elif scim_config.bearer_token and scim_config.bearer_token == token:
            # Migrate to hashed version
            from app.core.security import get_password_hash
            scim_config.bearer_token_hash = get_password_hash(token)
            scim_config.bearer_token = None  # Clear plain text
            db.commit()
            return scim_config
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid SCIM token",
        headers={"WWW-Authenticate": "Bearer"}
    )


@router.get("/ServiceProviderConfig", response_model=Dict[str, Any])
async def get_service_provider_config():
    """Get SCIM service provider configuration"""
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        "filter": {"supported": True, "maxResults": 200},
        "changePassword": {"supported": False},
        "sort": {"supported": False},
        "etag": {"supported": False},
        "authenticationSchemes": [
            {
                "type": "oauthbearertoken",
                "name": "OAuth Bearer Token",
                "description": "Authentication using OAuth Bearer Token"
            }
        ]
    }


@router.get("/Schemas", response_model=Dict[str, Any])
async def get_schemas():
    """Get SCIM schemas"""
    return {
        "totalResults": 1,
        "itemsPerPage": 1,
        "startIndex": 1,
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "Resources": [
            {
                "id": "urn:ietf:params:scim:schemas:core:2.0:User",
                "name": "User",
                "description": "User Account",
                "attributes": [
                    {
                        "name": "userName",
                        "type": "string",
                        "multiValued": False,
                        "required": True,
                        "caseExact": False
                    },
                    {
                        "name": "emails",
                        "type": "complex",
                        "multiValued": True,
                        "required": False
                    },
                    {
                        "name": "active",
                        "type": "boolean",
                        "multiValued": False,
                        "required": False
                    }
                ]
            }
        ]
    }


@router.get("/Users", response_model=SCIMListResponse)
async def list_users(
    startIndex: int = 1,
    count: int = 100,
    filter: Optional[str] = None,
    scim_config: SCIMConfiguration = Depends(verify_scim_token),
    db: Session = Depends(get_db)
):
    """List users via SCIM"""
    try:
        query = db.query(User).filter(User.tenant_id == scim_config.tenant_id)
        
        # Apply filter if provided (basic filter support)
        if filter:
            # Simple filter parsing (e.g., "userName eq \"user@example.com\"")
            if "userName eq" in filter:
                email = filter.split('"')[1] if '"' in filter else filter.split("'")[1]
                query = query.filter(User.email == email)
            elif "active eq true" in filter:
                query = query.filter(User.is_active == True)
        
        total = query.count()
        
        # Pagination
        users = query.offset(startIndex - 1).limit(count).all()
        
        scim_users = []
        for user in users:
            scim_user = SCIMUser(
                id=str(user.id),
                externalId=user.email,
                userName=user.email,
                displayName=user.name,
                name={"formatted": user.name},
                emails=[{"value": user.email, "primary": True, "type": "work"}],
                active=user.is_active,
                meta={
                    "resourceType": "User",
                    "created": user.created_at.isoformat(),
                    "lastModified": user.updated_at.isoformat()
                }
            )
            scim_users.append(scim_user)
        
        return SCIMListResponse(
            totalResults=total,
            itemsPerPage=count,
            startIndex=startIndex,
            Resources=scim_users
        )
    except Exception as e:
        logger.error(f"Error listing SCIM users: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/Users/{user_id}", response_model=SCIMUser)
async def get_user(
    user_id: str,
    scim_config: SCIMConfiguration = Depends(verify_scim_token),
    db: Session = Depends(get_db)
):
    """Get a user via SCIM"""
    try:
        user = db.query(User).filter(
            User.id == UUID(user_id),
            User.tenant_id == scim_config.tenant_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return SCIMUser(
            id=str(user.id),
            externalId=user.email,
            userName=user.email,
            displayName=user.name,
            name={"formatted": user.name},
            emails=[{"value": user.email, "primary": True, "type": "work"}],
            active=user.is_active,
            meta={
                "resourceType": "User",
                "created": user.created_at.isoformat(),
                "lastModified": user.updated_at.isoformat()
            }
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting SCIM user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/Users", response_model=SCIMUser, status_code=status.HTTP_201_CREATED)
async def create_user(
    scim_user: SCIMUser,
    scim_config: SCIMConfiguration = Depends(verify_scim_token),
    db: Session = Depends(get_db)
):
    """Create a user via SCIM"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(
            User.email == scim_user.userName,
            User.tenant_id == scim_config.tenant_id
        ).first()
        
        if existing_user:
            # Return existing user (idempotent)
            return SCIMUser(
                id=str(existing_user.id),
                externalId=existing_user.email,
                userName=existing_user.email,
                displayName=existing_user.name,
                name={"formatted": existing_user.name},
                emails=[{"value": existing_user.email, "primary": True, "type": "work"}],
                active=existing_user.is_active,
                meta={
                    "resourceType": "User",
                    "created": existing_user.created_at.isoformat(),
                    "lastModified": existing_user.updated_at.isoformat()
                }
            )
        
        # Extract email from emails array or userName
        email = scim_user.userName
        if scim_user.emails and len(scim_user.emails) > 0:
            email = scim_user.emails[0].get("value", email)
        
        # Create user
        user = User(
            email=email,
            name=scim_user.displayName or scim_user.userName,
            role=UserRole.END_USER,  # Default role for SCIM-provisioned users
            tenant_id=scim_config.tenant_id,
            is_active=scim_user.active,
            department=scim_user.name.get("department") if scim_user.name else None,
            organization=scim_user.name.get("organization") if scim_user.name else None
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Update SCIM config sync status
        scim_config.last_sync_at = datetime.utcnow()
        scim_config.sync_status = "success"
        db.commit()
        
        return SCIMUser(
            id=str(user.id),
            externalId=user.email,
            userName=user.email,
            displayName=user.name,
            name={"formatted": user.name},
            emails=[{"value": user.email, "primary": True, "type": "work"}],
            active=user.is_active,
            meta={
                "resourceType": "User",
                "created": user.created_at.isoformat(),
                "lastModified": user.updated_at.isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Error creating SCIM user: {e}", exc_info=True)
        db.rollback()
        scim_config.last_error = str(e)
        scim_config.sync_status = "error"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/Users/{user_id}", response_model=SCIMUser)
async def update_user(
    user_id: str,
    scim_user: SCIMUser,
    scim_config: SCIMConfiguration = Depends(verify_scim_token),
    db: Session = Depends(get_db)
):
    """Update a user via SCIM"""
    try:
        user = db.query(User).filter(
            User.id == UUID(user_id),
            User.tenant_id == scim_config.tenant_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user fields
        if scim_config.auto_update_users:
            if scim_user.displayName:
                user.name = scim_user.displayName
            if scim_user.emails and len(scim_user.emails) > 0:
                user.email = scim_user.emails[0].get("value", user.email)
            user.is_active = scim_user.active
        
        db.commit()
        db.refresh(user)
        
        # Update SCIM config sync status
        scim_config.last_sync_at = datetime.utcnow()
        scim_config.sync_status = "success"
        db.commit()
        
        return SCIMUser(
            id=str(user.id),
            externalId=user.email,
            userName=user.email,
            displayName=user.name,
            name={"formatted": user.name},
            emails=[{"value": user.email, "primary": True, "type": "work"}],
            active=user.is_active,
            meta={
                "resourceType": "User",
                "created": user.created_at.isoformat(),
                "lastModified": user.updated_at.isoformat()
            }
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating SCIM user: {e}", exc_info=True)
        db.rollback()
        scim_config.last_error = str(e)
        scim_config.sync_status = "error"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/Users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    scim_config: SCIMConfiguration = Depends(verify_scim_token),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a user via SCIM"""
    try:
        user = db.query(User).filter(
            User.id == UUID(user_id),
            User.tenant_id == scim_config.tenant_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if scim_config.auto_deactivate_users:
            user.is_active = False
            db.commit()
        
        # Update SCIM config sync status
        scim_config.last_sync_at = datetime.utcnow()
        scim_config.sync_status = "success"
        db.commit()
        
        return None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting SCIM user: {e}", exc_info=True)
        db.rollback()
        scim_config.last_error = str(e)
        scim_config.sync_status = "error"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

