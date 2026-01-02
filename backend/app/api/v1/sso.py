"""
SSO API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import secrets
from app.core.database import get_db
from app.models.user import User
from app.models.integration import Integration, IntegrationType
from app.api.v1.auth import get_current_user, create_access_token
from app.services.sso_service import SSOService
from app.core.config import settings
from datetime import timedelta

router = APIRouter(prefix="/sso", tags=["sso"])


class SSOInitiateRequest(BaseModel):
    """SSO initiation request"""
    integration_id: UUID
    return_url: Optional[str] = None


@router.post("/initiate")
async def initiate_sso(
    request_data: SSOInitiateRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Initiate SSO authentication"""
    # Get integration
    integration = db.query(Integration).filter(
        Integration.id == request_data.integration_id,
        Integration.integration_type == IntegrationType.SSO.value,
        Integration.status == "active"
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO integration not found or not active"
        )
    
    # Initialize SSO service
    sso_service = SSOService(integration.config)
    
    # Prepare request
    request_dict = {
        "https": "on" if request.url.scheme == "https" else "off",
        "http_host": request.url.hostname,
        "script_name": request.url.path,
        "server_port": str(request.url.port or (443 if request.url.scheme == "https" else 80)),
        "get_data": dict(request.query_params),
        "post_data": {}
    }
    
    if sso_service.sso_type == "saml":
        result = sso_service.prepare_saml_request(request_dict)
        return {"redirect_url": result["redirect_url"]}
    elif sso_service.sso_type == "oidc":
        # Generate state and nonce
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        
        # Store state and nonce in Redis for validation during callback
        from app.core.cache import get_redis
        import json
        
        redis = get_redis()
        if redis:
            session_data = {
                "integration_id": str(integration.id),
                "nonce": nonce,
                "return_url": request_data.return_url
            }
            # Store with 10 minute TTL (OIDC flow should complete quickly)
            redis.setex(
                f"sso_session:{state}",
                600,  # 10 minutes
                json.dumps(session_data)
            )
        else:
            # Fallback: log warning but continue (state will be in URL)
            logger.warning("Redis unavailable for SSO session storage, using URL-based state")
        
        auth_url = sso_service.get_oidc_authorization_url(state, nonce)
        return {"redirect_url": auth_url, "state": state, "nonce": nonce}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported SSO type"
        )


@router.get("/callback")
async def sso_callback(
    request: Request,
    integration_id: UUID = Query(...),
    db: Session = Depends(get_db)
):
    """Handle SSO callback"""
    # Get integration
    integration = db.query(Integration).filter(
        Integration.id == integration_id,
        Integration.integration_type == IntegrationType.SSO.value
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO integration not found"
        )
    
    sso_service = SSOService(integration.config)
    
    if sso_service.sso_type == "saml":
        # Process SAML response
        request_dict = {
            "https": "on" if request.url.scheme == "https" else "off",
            "http_host": request.url.hostname,
            "script_name": request.url.path,
            "server_port": str(request.url.port or (443 if request.url.scheme == "https" else 80)),
            "get_data": dict(request.query_params),
            "post_data": {}
        }
        
        result = sso_service.process_saml_response(request_dict)
        
        if not result.get("authenticated"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="SSO authentication failed"
            )
        
        # Map attributes
        attributes = result.get("attributes", {})
        mapping = integration.config.get("attribute_mapping", {
            "email": "email",
            "name": ["name", "displayName", "cn"]
        })
        
        user_attrs = sso_service.map_user_attributes(attributes, mapping)
        
    elif sso_service.sso_type == "oidc":
        # Process OIDC callback
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code missing"
            )
        
        if not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State parameter missing"
            )
        
        # Retrieve and validate state from Redis
        from app.core.cache import get_redis
        import json
        
        redis = get_redis()
        session_data = None
        if redis:
            session_data_str = redis.get(f"sso_session:{state}")
            if session_data_str:
                session_data = json.loads(session_data_str)
                # Delete session data after use (one-time use)
                redis.delete(f"sso_session:{state}")
        
        # Validate state matches integration
        if session_data:
            stored_integration_id = session_data.get("integration_id")
            if str(integration.id) != stored_integration_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="State validation failed: integration mismatch"
                )
            # Get nonce from stored session data
            stored_nonce = session_data.get("nonce")
        else:
            # Fallback: if Redis unavailable, log warning
            logger.warning(f"SSO session data not found in Redis for state: {state}")
            stored_nonce = None
        
        result = await sso_service.exchange_oidc_code(code, state, stored_nonce)
        
        if not result.get("authenticated"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OIDC authentication failed"
            )
        
        # Map user info
        user_info = result.get("user_info", {})
        mapping = integration.config.get("attribute_mapping", {
            "email": "email",
            "name": ["name", "display_name"]
        })
        
        user_attrs = sso_service.map_user_attributes(user_info, mapping)
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported SSO type"
        )
    
    # Find or create user
    email = user_attrs.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not found in SSO response"
        )
    
    email_lower = email.lower()
    email_domain = email_lower.split("@")[1] if "@" in email_lower else None
    
    # CRITICAL: Get tenant_id from integration (each SSO integration is tenant-specific)
    tenant_id = integration.tenant_id
    
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO integration is not associated with a tenant"
        )
    
    # Verify email domain matches tenant's allowed domains (if configured)
    from app.models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if tenant and tenant.allowed_email_domains:
        # Check if user's email domain is allowed for this tenant
        if email_domain not in tenant.allowed_email_domains:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Email domain {email_domain} is not allowed for this tenant"
            )
    
    # Find user - MUST be scoped to tenant to prevent cross-tenant access
    user = db.query(User).filter(
        User.email == email_lower,
        User.tenant_id == tenant_id  # CRITICAL: Tenant isolation
    ).first()
    
    if not user:
        # Check if user exists in another tenant (security check)
        existing_user_other_tenant = db.query(User).filter(
            User.email == email_lower,
            User.tenant_id != tenant_id
        ).first()
        
        if existing_user_other_tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User with this email already exists in a different tenant. Please contact your administrator."
            )
        
        # Create user from SSO - MUST assign tenant_id
        user = User(
            email=email_lower,
            name=user_attrs.get("name", email.split("@")[0]),
            role=UserRole.END_USER,  # Default role, can be mapped from SSO
            tenant_id=tenant_id,  # CRITICAL: Assign to correct tenant
            is_active=True,
            department=user_attrs.get("department"),
            organization=user_attrs.get("organization")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update user if tenant_id is missing (migration scenario)
        if user.tenant_id != tenant_id:
            # This should not happen, but handle it securely
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User tenant mismatch. Please contact your administrator."
            )
        
        # Update user attributes from SSO (if sync is enabled)
        if integration.config.get("sync_enabled", True):
            if user_attrs.get("name"):
                user.name = user_attrs.get("name")
            if user_attrs.get("department"):
                user.department = user_attrs.get("department")
            if user_attrs.get("organization"):
                user.organization = user_attrs.get("organization")
            db.commit()
            db.refresh(user)
    
    # Generate access token - MUST include tenant_id for tenant isolation
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role.value,
            "tenant_id": str(user.tenant_id)  # CRITICAL: Include tenant_id in token
        },
        expires_delta=access_token_expires
    )
    
    # Redirect to frontend with token
    frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"
    return RedirectResponse(
        url=f"{frontend_url}/auth/callback?token={access_token}"
    )

