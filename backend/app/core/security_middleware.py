"""
Security middleware and utilities
"""
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import logging
from typing import Dict, Tuple, Optional
from app.core.config import settings
from app.core.cache import get_redis

logger = logging.getLogger(__name__)

# Fallback in-memory rate limiting (used if Redis is unavailable)
_fallback_rate_limit_store: Dict[str, Tuple[int, float]] = {}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Don't override CORS headers - check if they exist
        cors_origin = response.headers.get("access-control-allow-origin")
        
        # Security headers (only add if they don't conflict with CORS)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Only add HSTS in production with HTTPS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Relax CSP for development to allow CORS
        if settings.ENVIRONMENT == "development":
            response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*;"
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response


def check_rate_limit_redis(client_ip: str, limit: int, window: int = 60) -> Tuple[bool, int]:
    """
    Check rate limit using Redis (distributed rate limiting)
    
    Returns:
        Tuple of (is_allowed, current_count)
    """
    try:
        redis = get_redis()
        if not redis:
            # Redis not available, use fallback
            return check_rate_limit_fallback(client_ip, limit, window)
        
        key = f"rate_limit:ip:{client_ip}"
        
        # Use Redis INCR with automatic expiration
        # INCR returns the new count
        count = redis.incr(key)
        
        # Set expiration on first request (count == 1)
        if count == 1:
            redis.expire(key, window)
        
        return count <= limit, count
    except Exception as e:
        logger.warning(f"Redis rate limiting failed, falling back to in-memory: {e}")
        # Fallback to in-memory rate limiting
        return check_rate_limit_fallback(client_ip, limit, window)


def check_rate_limit_fallback(client_ip: str, limit: int, window: int = 60) -> Tuple[bool, int]:
    """
    Fallback in-memory rate limiting (used if Redis is unavailable)
    
    Returns:
        Tuple of (is_allowed, current_count)
    """
    current_time = time.time()
    
    # Get current count and window start
    if client_ip in _fallback_rate_limit_store:
        count, window_start = _fallback_rate_limit_store[client_ip]
        # Reset window if expired
        if current_time - window_start > window:
            count = 0
            window_start = current_time
    else:
        count = 0
        window_start = current_time
    
    # Increment count
    count += 1
    _fallback_rate_limit_store[client_ip] = (count, window_start)
    
    return count <= limit, count


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with Redis support for clustering"""
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting in development for localhost
        if settings.ENVIRONMENT == "development":
            client_ip = request.client.host if request.client else "unknown"
            # Allow unlimited requests from localhost in development
            if client_ip in ["127.0.0.1", "localhost", "::1"] or "localhost" in str(client_ip):
                response = await call_next(request)
                response.headers["X-RateLimit-Limit"] = "unlimited"
                response.headers["X-RateLimit-Remaining"] = "unlimited"
                return response
        
        # Get client IP (consider X-Forwarded-For for load balancers)
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain (original client)
            client_ip = forwarded_for.split(",")[0].strip()
        
        # Check rate limit using Redis (with fallback)
        is_allowed, current_count = check_rate_limit_redis(
            client_ip, 
            self.requests_per_minute, 
            window=60
        )
        
        if not is_allowed:
            # Get origin for CORS
            origin = request.headers.get("origin")
            allowed_origins = settings.cors_origins_list
            
            headers = {
                "X-RateLimit-Limit": str(self.requests_per_minute),
                "X-RateLimit-Remaining": "0",
                "Retry-After": "60",
            }
            
            # Add CORS headers if origin is allowed
            if origin and origin in allowed_origins:
                headers["Access-Control-Allow-Origin"] = origin
                headers["Access-Control-Allow-Credentials"] = "true"
                headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
                headers["Access-Control-Allow-Headers"] = "*"
            
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers=headers
            )
        
        # Add rate limit headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(self.requests_per_minute - current_count)
        
        return response


def validate_file_upload(file_size: int, allowed_types: list = None) -> None:
    """Validate file upload"""
    # Check file size
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )
    
    # Check file type if specified
    if allowed_types:
        # This would be checked against file.content_type
        pass


def sanitize_input(input_str: str, max_length: int = 1000, allow_html: bool = False) -> str:
    """
    Sanitize user input using bleach
    
    Args:
        input_str: Input string to sanitize
        max_length: Maximum length of input
        allow_html: If True, allows safe HTML tags (default: False, strips all HTML)
    
    Returns:
        Sanitized string
    """
    if not input_str:
        return ""
    
    # Remove null bytes
    input_str = input_str.replace("\x00", "")
    
    # Truncate if too long
    if len(input_str) > max_length:
        input_str = input_str[:max_length]
    
    # Use bleach for proper HTML sanitization
    try:
        import bleach
        from bleach.css_sanitizer import CSSSanitizer
        
        if allow_html:
            # Allow safe HTML tags and attributes
            allowed_tags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a']
            allowed_attributes = {'a': ['href', 'title']}
            css_sanitizer = CSSSanitizer(allowed_css_properties=[])
            sanitized = bleach.clean(
                input_str,
                tags=allowed_tags,
                attributes=allowed_attributes,
                css_sanitizer=css_sanitizer,
                strip=True
            )
        else:
            # Strip all HTML tags (default)
            sanitized = bleach.clean(input_str, tags=[], strip=True)
        
        return sanitized.strip()
    except ImportError:
        # Fallback if bleach is not installed
        logger.warning("bleach not installed, using basic sanitization")
        # Basic sanitization: remove HTML-like tags
        import re
        sanitized = re.sub(r'<[^>]+>', '', input_str)
        return sanitized.strip()

