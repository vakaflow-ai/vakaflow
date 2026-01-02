"""
CSRF (Cross-Site Request Forgery) protection utilities
"""
import secrets
import hashlib
from typing import Optional
from fastapi import Request, HTTPException, status
from app.core.cache import get_redis
import logging

logger = logging.getLogger(__name__)


def generate_csrf_token() -> str:
    """Generate a random CSRF token"""
    return secrets.token_urlsafe(32)


def get_csrf_token_from_request(request: Request) -> Optional[str]:
    """Get CSRF token from request (header or form data)"""
    # Check X-CSRF-Token header first
    token = request.headers.get("X-CSRF-Token")
    if token:
        return token
    
    # Check form data
    if hasattr(request, "form"):
        form_data = request.form()
        if isinstance(form_data, dict):
            return form_data.get("csrf_token")
    
    return None


def validate_csrf_token(request: Request, token: Optional[str] = None) -> bool:
    """
    Validate CSRF token
    
    Args:
        request: FastAPI request object
        token: CSRF token to validate (if None, extracted from request)
    
    Returns:
        True if token is valid, False otherwise
    """
    # Skip CSRF for GET, HEAD, OPTIONS (safe methods)
    if request.method in ["GET", "HEAD", "OPTIONS"]:
        return True
    
    # Get token from request if not provided
    if token is None:
        token = get_csrf_token_from_request(request)
    
    if not token:
        return False
    
    # Get session ID from cookie
    session_id = request.cookies.get("session_id")
    if not session_id:
        return False
    
    # Validate token against stored token in Redis
    try:
        redis = get_redis()
        if not redis:
            # If Redis unavailable, skip CSRF (degraded mode)
            logger.warning("Redis unavailable, skipping CSRF validation")
            return True
        
        stored_token = redis.get(f"csrf_token:{session_id}")
        if not stored_token:
            return False
        
        # Use constant-time comparison to prevent timing attacks
        return secrets.compare_digest(token, stored_token)
    except Exception as e:
        logger.error(f"CSRF validation error: {e}")
        # Fail secure: reject if validation fails
        return False


def store_csrf_token(session_id: str, token: str, ttl: int = 3600) -> bool:
    """
    Store CSRF token in Redis
    
    Args:
        session_id: Session identifier
        token: CSRF token to store
        ttl: Time to live in seconds (default: 1 hour)
    
    Returns:
        True if stored successfully, False otherwise
    """
    try:
        redis = get_redis()
        if not redis:
            return False
        
        redis.setex(f"csrf_token:{session_id}", ttl, token)
        return True
    except Exception as e:
        logger.error(f"Failed to store CSRF token: {e}")
        return False


class CSRFMiddleware:
    """CSRF protection middleware"""
    
    async def __call__(self, request: Request, call_next):
        # Skip CSRF for safe methods
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return await call_next(request)
        
        # Skip CSRF for API endpoints that use token-based auth
        if request.url.path.startswith("/api/v1/"):
            # Check if request has Authorization header (token-based auth)
            if request.headers.get("Authorization"):
                # Token-based auth doesn't need CSRF protection
                return await call_next(request)
        
        # Validate CSRF token for state-changing operations
        if not validate_csrf_token(request):
            return HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing CSRF token"
            )
        
        return await call_next(request)

