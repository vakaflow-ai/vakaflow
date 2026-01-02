"""
OAuth 2.0 API endpoints - Authorization Server implementation
Supports OAuth 2.0 flows: Authorization Code, Client Credentials, Refresh Token
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, Form
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta
import secrets
import hashlib
import base64
import json
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user, create_access_token
from app.core.config import settings
from app.core.cache import get_redis
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


# OAuth 2.0 Models
class OAuth2ClientCreate(BaseModel):
    """OAuth 2.0 client registration request"""
    client_name: str = Field(..., min_length=1, max_length=255)
    redirect_uris: List[str] = Field(..., min_items=1)
    grant_types: List[str] = Field(default=["authorization_code"], min_items=1)
    response_types: List[str] = Field(default=["code"], min_items=1)
    scopes: List[str] = Field(default=["openid", "profile", "email"])
    description: Optional[str] = None
    tenant_id: Optional[UUID] = None


class OAuth2ClientResponse(BaseModel):
    """OAuth 2.0 client response"""
    client_id: str
    client_secret: str
    client_name: str
    redirect_uris: List[str]
    grant_types: List[str]
    response_types: List[str]
    scopes: List[str]
    created_at: str
    tenant_id: Optional[str] = None


class OAuth2TokenResponse(BaseModel):
    """OAuth 2.0 token response"""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    id_token: Optional[str] = None


class OAuth2TokenIntrospect(BaseModel):
    """OAuth 2.0 token introspection response"""
    active: bool
    scope: Optional[str] = None
    client_id: Optional[str] = None
    username: Optional[str] = None
    exp: Optional[int] = None
    iat: Optional[int] = None
    sub: Optional[str] = None


# In-memory client storage (in production, use database)
_oauth_clients: Dict[str, Dict[str, Any]] = {}


def generate_client_credentials() -> tuple[str, str]:
    """Generate OAuth 2.0 client ID and secret"""
    client_id = secrets.token_urlsafe(32)
    client_secret = secrets.token_urlsafe(48)
    return client_id, client_secret


def store_oauth_client(client_id: str, client_data: Dict[str, Any]) -> None:
    """Store OAuth client (in production, use database)"""
    redis = get_redis()
    if redis:
        redis.setex(
            f"oauth_client:{client_id}",
            86400 * 365,  # 1 year TTL
            json.dumps(client_data)
        )
    _oauth_clients[client_id] = client_data


def get_oauth_client(client_id: str) -> Optional[Dict[str, Any]]:
    """Get OAuth client"""
    redis = get_redis()
    if redis:
        client_data_str = redis.get(f"oauth_client:{client_id}")
        if client_data_str:
            return json.loads(client_data_str)
    
    return _oauth_clients.get(client_id)


def validate_client_credentials(client_id: str, client_secret: str) -> bool:
    """Validate OAuth client credentials"""
    client = get_oauth_client(client_id)
    if not client:
        return False
    return client.get("client_secret") == client_secret


def validate_redirect_uri(client_id: str, redirect_uri: str) -> bool:
    """Validate redirect URI against registered URIs"""
    client = get_oauth_client(client_id)
    if not client:
        return False
    return redirect_uri in client.get("redirect_uris", [])


def store_authorization_code(
    code: str,
    client_id: str,
    redirect_uri: str,
    user_id: str,
    scopes: List[str],
    nonce: Optional[str] = None
) -> None:
    """Store authorization code (10 minute TTL)"""
    redis = get_redis()
    code_data = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "user_id": user_id,
        "scopes": scopes,
        "nonce": nonce,
        "created_at": datetime.utcnow().isoformat()
    }
    if redis:
        redis.setex(f"oauth_code:{code}", 600, json.dumps(code_data))  # 10 minutes
    else:
        # Fallback to in-memory (not recommended for production)
        logger.warning("Redis unavailable, using in-memory storage for authorization codes")


def get_authorization_code(code: str) -> Optional[Dict[str, Any]]:
    """Get and delete authorization code (one-time use)"""
    redis = get_redis()
    if redis:
        code_data_str = redis.get(f"oauth_code:{code}")
        if code_data_str:
            redis.delete(f"oauth_code:{code}")  # One-time use
            return json.loads(code_data_str)
    return None


def store_refresh_token(
    refresh_token: str,
    client_id: str,
    user_id: str,
    scopes: List[str]
) -> None:
    """Store refresh token (30 days TTL)"""
    redis = get_redis()
    token_data = {
        "client_id": client_id,
        "user_id": user_id,
        "scopes": scopes,
        "created_at": datetime.utcnow().isoformat()
    }
    if redis:
        redis.setex(f"oauth_refresh:{refresh_token}", 86400 * 30, json.dumps(token_data))  # 30 days


def get_refresh_token(refresh_token: str) -> Optional[Dict[str, Any]]:
    """Get refresh token data"""
    redis = get_redis()
    if redis:
        token_data_str = redis.get(f"oauth_refresh:{refresh_token}")
        if token_data_str:
            return json.loads(token_data_str)
    return None


def revoke_refresh_token(refresh_token: str) -> None:
    """Revoke refresh token"""
    redis = get_redis()
    if redis:
        redis.delete(f"oauth_refresh:{refresh_token}")


@router.post("/register", response_model=OAuth2ClientResponse, status_code=status.HTTP_201_CREATED)
async def register_oauth_client(
    client_data: OAuth2ClientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register a new OAuth 2.0 client
    
    OAuth 2.0 Dynamic Client Registration (RFC 7591)
    """
    # Generate client credentials
    client_id, client_secret = generate_client_credentials()
    
    # Store client
    client_info = {
        "client_id": client_id,
        "client_secret": client_secret,
        "client_name": client_data.client_name,
        "redirect_uris": client_data.redirect_uris,
        "grant_types": client_data.grant_types,
        "response_types": client_data.response_types,
        "scopes": client_data.scopes,
        "description": client_data.description,
        "tenant_id": str(client_data.tenant_id) if client_data.tenant_id else str(current_user.tenant_id) if current_user.tenant_id else None,
        "created_by": str(current_user.id),
        "created_at": datetime.utcnow().isoformat()
    }
    
    store_oauth_client(client_id, client_info)
    
    logger.info(f"OAuth client registered: {client_id} by user {current_user.email}")
    
    return OAuth2ClientResponse(
        client_id=client_id,
        client_secret=client_secret,
        client_name=client_data.client_name,
        redirect_uris=client_data.redirect_uris,
        grant_types=client_data.grant_types,
        response_types=client_data.response_types,
        scopes=client_data.scopes,
        created_at=client_info["created_at"],
        tenant_id=client_info["tenant_id"]
    )


@router.get("/authorize")
async def authorize(
    request: Request,
    response_type: str = Query(...),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    nonce: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    OAuth 2.0 Authorization Endpoint
    
    Implements Authorization Code flow
    """
    # Validate client
    client = get_oauth_client(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client_id"
        )
    
    # Validate response type
    if response_type not in client.get("response_types", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported response_type: {response_type}"
        )
    
    # Validate redirect URI
    if not validate_redirect_uri(client_id, redirect_uri):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid redirect_uri"
        )
    
    # Parse scopes
    requested_scopes = scope.split() if scope else client.get("scopes", [])
    allowed_scopes = client.get("scopes", [])
    granted_scopes = [s for s in requested_scopes if s in allowed_scopes]
    
    if response_type == "code":
        # Authorization Code flow
        code = secrets.token_urlsafe(32)
        store_authorization_code(
            code=code,
            client_id=client_id,
            redirect_uri=redirect_uri,
            user_id=str(current_user.id),
            scopes=granted_scopes,
            nonce=nonce
        )
        
        # Build redirect URL
        params = {"code": code}
        if state:
            params["state"] = state
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        redirect_url = f"{redirect_uri}?{query_string}"
        
        logger.info(f"OAuth authorization granted: {client_id} for user {current_user.email}")
        return RedirectResponse(url=redirect_url)
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported response_type: {response_type}"
        )


@router.post("/token", response_model=OAuth2TokenResponse)
async def token(
    grant_type: str = Form(...),
    code: Optional[str] = Form(None),
    redirect_uri: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    client_secret: Optional[str] = Form(None),
    refresh_token: Optional[str] = Form(None),
    scope: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    OAuth 2.0 Token Endpoint
    
    Supports:
    - authorization_code grant
    - refresh_token grant
    - client_credentials grant
    """
    # Client authentication (Basic Auth or form params)
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Client authentication required"
        )
    
    if not validate_client_credentials(client_id, client_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client credentials"
        )
    
    client = get_oauth_client(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client"
        )
    
    if grant_type == "authorization_code":
        if not code or not redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="code and redirect_uri required for authorization_code grant"
            )
        
        # Validate authorization code
        code_data = get_authorization_code(code)
        if not code_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired authorization code"
            )
        
        # Validate client matches
        if code_data["client_id"] != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client mismatch"
            )
        
        # Validate redirect URI
        if code_data["redirect_uri"] != redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Redirect URI mismatch"
            )
        
        # Get user
        user = db.query(User).filter(User.id == code_data["user_id"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Generate tokens
        scopes = code_data.get("scopes", [])
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user.email,
                "role": user.role.value,
                "client_id": client_id,
                "scope": " ".join(scopes)
            },
            expires_delta=access_token_expires
        )
        
        # Generate refresh token
        refresh_token_value = secrets.token_urlsafe(32)
        store_refresh_token(refresh_token_value, client_id, str(user.id), scopes)
        
        # Generate ID token if OpenID Connect
        id_token = None
        if "openid" in scopes:
            base_url = settings.API_V1_PREFIX.rstrip("/v1")
            id_token = create_access_token(
                data={
                    "sub": user.email,
                    "email": user.email,
                    "name": user.name,
                    "nonce": code_data.get("nonce"),
                    "iss": f"{base_url}/oauth2",
                    "aud": client_id
                },
                expires_delta=access_token_expires
            )
        
        return OAuth2TokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=int(access_token_expires.total_seconds()),
            refresh_token=refresh_token_value,
            scope=" ".join(scopes),
            id_token=id_token
        )
    
    elif grant_type == "refresh_token":
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="refresh_token required"
            )
        
        # Validate refresh token
        token_data = get_refresh_token(refresh_token)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired refresh token"
            )
        
        # Validate client matches
        if token_data["client_id"] != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client mismatch"
            )
        
        # Get user
        user = db.query(User).filter(User.id == token_data["user_id"]).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Revoke old refresh token
        revoke_refresh_token(refresh_token)
        
        # Generate new tokens
        scopes = token_data.get("scopes", [])
        if scope:
            # Requested scopes must be subset of original scopes
            requested_scopes = scope.split()
            scopes = [s for s in requested_scopes if s in scopes]
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user.email,
                "role": user.role.value,
                "client_id": client_id,
                "scope": " ".join(scopes)
            },
            expires_delta=access_token_expires
        )
        
        # Generate new refresh token
        new_refresh_token = secrets.token_urlsafe(32)
        store_refresh_token(new_refresh_token, client_id, str(user.id), scopes)
        
        return OAuth2TokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=int(access_token_expires.total_seconds()),
            refresh_token=new_refresh_token,
            scope=" ".join(scopes)
        )
    
    elif grant_type == "client_credentials":
        # Client Credentials flow (no user, service-to-service)
        if "client_credentials" not in client.get("grant_types", []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="client_credentials grant not allowed for this client"
            )
        
        requested_scopes = scope.split() if scope else client.get("scopes", [])
        allowed_scopes = client.get("scopes", [])
        granted_scopes = [s for s in requested_scopes if s in allowed_scopes]
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": client_id,
                "client_id": client_id,
                "scope": " ".join(granted_scopes),
                "grant_type": "client_credentials"
            },
            expires_delta=access_token_expires
        )
        
        return OAuth2TokenResponse(
            access_token=access_token,
            token_type="Bearer",
            expires_in=int(access_token_expires.total_seconds()),
            scope=" ".join(granted_scopes)
        )
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported grant_type: {grant_type}"
        )


@router.get("/userinfo")
async def userinfo(
    current_user: User = Depends(get_current_user)
):
    """
    OAuth 2.0 UserInfo Endpoint (OpenID Connect)
    
    Returns user information for the authenticated user
    """
    return {
        "sub": current_user.email,
        "email": current_user.email,
        "name": current_user.name,
        "email_verified": True,
        "role": current_user.role.value,
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
        "department": current_user.department,
        "organization": current_user.organization
    }


@router.post("/introspect", response_model=OAuth2TokenIntrospect)
async def introspect_token(
    token: str = Form(...),
    token_type_hint: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    client_secret: Optional[str] = Form(None)
):
    """
    OAuth 2.0 Token Introspection Endpoint (RFC 7662)
    
    Returns information about an access token
    """
    # Client authentication (optional but recommended)
    if client_id and client_secret:
        if not validate_client_credentials(client_id, client_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid client credentials"
            )
    
    # Decode token
    from app.core.security import decode_access_token
    token_data = decode_access_token(token)
    
    if not token_data:
        return OAuth2TokenIntrospect(active=False)
    
    # Check expiration
    exp = token_data.get("exp")
    if exp:
        from datetime import datetime
        if datetime.utcnow().timestamp() > exp:
            return OAuth2TokenIntrospect(active=False)
    
    return OAuth2TokenIntrospect(
        active=True,
        scope=token_data.get("scope"),
        client_id=token_data.get("client_id"),
        username=token_data.get("sub"),
        exp=exp,
        iat=token_data.get("iat"),
        sub=token_data.get("sub")
    )


@router.post("/revoke")
async def revoke_token(
    token: str = Form(...),
    token_type_hint: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    client_secret: Optional[str] = Form(None)
):
    """
    OAuth 2.0 Token Revocation Endpoint (RFC 7009)
    
    Revokes an access token or refresh token
    """
    # Client authentication
    if client_id and client_secret:
        if not validate_client_credentials(client_id, client_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid client credentials"
            )
    
    # Try to revoke refresh token
    token_data = get_refresh_token(token)
    if token_data:
        revoke_refresh_token(token)
        logger.info(f"Refresh token revoked: {token[:8]}...")
        return {"status": "revoked"}
    
    # For access tokens, we can't revoke them directly (stateless JWT)
    # But we can add them to a revocation list
    redis = get_redis()
    if redis:
        # Store revoked token hash until expiration
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        redis.setex(f"oauth_revoked:{token_hash}", 86400, "1")  # 24 hours
    
    logger.info(f"Access token marked for revocation: {token[:8]}...")
    return {"status": "revoked"}


@router.get("/.well-known/oauth-authorization-server")
async def oauth_metadata():
    """
    OAuth 2.0 Authorization Server Metadata (RFC 8414)
    
    Returns server metadata for discovery
    """
    base_url = settings.API_V1_PREFIX.rstrip("/v1")
    return {
        "issuer": f"{base_url}/oauth2",
        "authorization_endpoint": f"{base_url}/oauth2/authorize",
        "token_endpoint": f"{base_url}/oauth2/token",
        "userinfo_endpoint": f"{base_url}/oauth2/userinfo",
        "introspection_endpoint": f"{base_url}/oauth2/introspect",
        "revocation_endpoint": f"{base_url}/oauth2/revoke",
        "registration_endpoint": f"{base_url}/oauth2/register",
        "scopes_supported": ["openid", "profile", "email", "offline_access"],
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        "code_challenge_methods_supported": ["S256", "plain"]
    }


@router.get("/.well-known/openid-configuration")
async def openid_configuration():
    """
    OpenID Connect Discovery (OpenID Connect Discovery 1.0)
    
    Returns OpenID Connect provider configuration
    """
    base_url = settings.API_V1_PREFIX.rstrip("/v1")
    return {
        "issuer": f"{base_url}/oauth2",
        "authorization_endpoint": f"{base_url}/oauth2/authorize",
        "token_endpoint": f"{base_url}/oauth2/token",
        "userinfo_endpoint": f"{base_url}/oauth2/userinfo",
        "introspection_endpoint": f"{base_url}/oauth2/introspect",
        "revocation_endpoint": f"{base_url}/oauth2/revoke",
        "registration_endpoint": f"{base_url}/oauth2/register",
        "jwks_uri": f"{base_url}/oauth2/.well-known/jwks.json",
        "scopes_supported": ["openid", "profile", "email", "offline_access"],
        "response_types_supported": ["code"],
        "response_modes_supported": ["query", "fragment"],
        "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256", "HS256"]
    }
