"""
API Gateway endpoints for third-party integrations
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.api_gateway import APIToken, APIGatewaySession, APIGatewayRequestLog, APITokenStatus
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
from app.core.cache import get_redis
import logging
import hashlib
import time
from typing import Tuple

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-gateway", tags=["api-gateway"])

# Fallback in-memory rate limiting (used if Redis is unavailable)
_fallback_rate_limit_store: Dict[str, Dict[str, tuple]] = {}


def check_api_token_rate_limit_redis(
    token_id: str, 
    limit_per_minute: int,
    limit_per_hour: int,
    limit_per_day: int
) -> Tuple[bool, str, int, int, int]:
    """
    Check API token rate limits using Redis (distributed rate limiting)
    
    Returns:
        Tuple of (is_allowed, limit_type, minute_count, hour_count, day_count)
        limit_type is empty string if allowed, otherwise "minute", "hour", or "day"
    """
    try:
        redis = get_redis()
        if not redis:
            # Redis not available, use fallback
            return check_api_token_rate_limit_fallback(
                token_id, limit_per_minute, limit_per_hour, limit_per_day
            )
        
        token_key = str(token_id)
        
        # Check per-minute limit
        minute_key = f"rate_limit:api_token:{token_key}:minute"
        minute_count = redis.incr(minute_key)
        if minute_count == 1:
            redis.expire(minute_key, 60)
        if minute_count > limit_per_minute:
            return False, "minute", minute_count, 0, 0
        
        # Check per-hour limit
        hour_key = f"rate_limit:api_token:{token_key}:hour"
        hour_count = redis.incr(hour_key)
        if hour_count == 1:
            redis.expire(hour_key, 3600)
        if hour_count > limit_per_hour:
            return False, "hour", minute_count, hour_count, 0
        
        # Check per-day limit
        day_key = f"rate_limit:api_token:{token_key}:day"
        day_count = redis.incr(day_key)
        if day_count == 1:
            redis.expire(day_key, 86400)
        if day_count > limit_per_day:
            return False, "day", minute_count, hour_count, day_count
        
        return True, "", minute_count, hour_count, day_count
    except Exception as e:
        logger.warning(f"Redis rate limiting failed for API token, falling back to in-memory: {e}")
        return check_api_token_rate_limit_fallback(
            token_id, limit_per_minute, limit_per_hour, limit_per_day
        )


def check_api_token_rate_limit_fallback(
    token_id: str,
    limit_per_minute: int,
    limit_per_hour: int,
    limit_per_day: int
) -> Tuple[bool, str, int, int, int]:
    """
    Fallback in-memory rate limiting for API tokens (used if Redis is unavailable)
    
    Returns:
        Tuple of (is_allowed, limit_type, minute_count, hour_count, day_count)
    """
    current_time = time.time()
    token_key = str(token_id)
    
    # Initialize or get existing counts
    if token_key not in _fallback_rate_limit_store:
        _fallback_rate_limit_store[token_key] = {
            "minute": (0, current_time),
            "hour": (0, current_time),
            "day": (0, current_time)
        }
    
    store = _fallback_rate_limit_store[token_key]
    
    # Check per-minute limit
    minute_count, minute_start = store["minute"]
    if current_time - minute_start > 60:
        minute_count = 0
        minute_start = current_time
    minute_count += 1
    store["minute"] = (minute_count, minute_start)
    if minute_count > limit_per_minute:
        return False, "minute", minute_count, 0, 0
    
    # Check per-hour limit
    hour_count, hour_start = store["hour"]
    if current_time - hour_start > 3600:
        hour_count = 0
        hour_start = current_time
    hour_count += 1
    store["hour"] = (hour_count, hour_start)
    if hour_count > limit_per_hour:
        return False, "hour", minute_count, hour_count, 0
    
    # Check per-day limit
    day_count, day_start = store["day"]
    if current_time - day_start > 86400:
        day_count = 0
        day_start = current_time
    day_count += 1
    store["day"] = (day_count, day_start)
    if day_count > limit_per_day:
        return False, "day", minute_count, hour_count, day_count
    
    return True, "", minute_count, hour_count, day_count


async def verify_api_token(
    authorization: Optional[str] = Header(None),
    request: Request = None,
    db: Session = Depends(get_db)
) -> APIToken:
    """Verify API token from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = authorization.replace("Bearer ", "").strip()
    
    # Hash the token to find it in database
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Find active token
    api_token = db.query(APIToken).filter(
        APIToken.token_hash == token_hash,
        APIToken.status == APITokenStatus.ACTIVE.value
    ).first()
    
    if not api_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Check expiration
    if api_token.expires_at and api_token.expires_at < datetime.utcnow():
        api_token.status = APITokenStatus.EXPIRED.value
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API token has expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Check rate limits using Redis (with fallback)
    is_allowed, limit_type, minute_count, hour_count, day_count = check_api_token_rate_limit_redis(
        str(api_token.id),
        api_token.rate_limit_per_minute,
        api_token.rate_limit_per_hour,
        api_token.rate_limit_per_day
    )
    
    if not is_allowed:
        # Determine which limit was exceeded and set appropriate headers
        if limit_type == "minute":
            limit_value = api_token.rate_limit_per_minute
            retry_after = 60
        elif limit_type == "hour":
            limit_value = api_token.rate_limit_per_hour
            retry_after = 3600
        else:  # day
            limit_value = api_token.rate_limit_per_day
            retry_after = 86400
        
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded (per {limit_type})",
            headers={
                "X-RateLimit-Limit": str(limit_value),
                "X-RateLimit-Remaining": "0",
                "Retry-After": str(retry_after)
            }
        )
    
    # Update token usage
    api_token.last_used_at = datetime.utcnow()
    api_token.last_used_ip = request.client.host if request and request.client else None
    api_token.request_count += 1
    api_token.last_request_at = datetime.utcnow()
    db.commit()
    
    return api_token


# API Gateway endpoints (protected by token)
@router.get("/agents", response_model=List[Dict[str, Any]])
async def list_agents_via_gateway(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    api_token: APIToken = Depends(verify_api_token),
    db: Session = Depends(get_db),
    request: Request = None
):
    """List agents via API Gateway (requires token)"""
    # Check scope
    if "read:agents" not in api_token.scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not have 'read:agents' scope"
        )
    
    # Log request
    start_time = time.time()
    try:
        from app.models.agent import Agent, AgentStatus
        
        query = db.query(Agent).filter(Agent.tenant_id == api_token.tenant_id)
        
        if status_filter:
            query = query.filter(Agent.status == status_filter)
        
        total = query.count()
        agents = query.offset((page - 1) * limit).limit(limit).all()
        
        response_time = int((time.time() - start_time) * 1000)
        
        # Log request
        log_request(
            db=db,
            api_token_id=api_token.id,
            tenant_id=api_token.tenant_id,
            method=request.method if request else "GET",
            path=request.url.path if request else "/api-gateway/agents",
            status_code=200,
            response_time_ms=response_time,
            client_ip=request.client.host if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        
        return [
            {
                "id": str(agent.id),
                "name": agent.name,
                "type": agent.type,
                "category": agent.category,
                "status": agent.status,
                "vendor_id": str(agent.vendor_id),
                "created_at": agent.created_at.isoformat() if agent.created_at else None
            }
            for agent in agents
        ]
    except Exception as e:
        logger.error(f"Error listing agents via API Gateway: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/agents/{agent_id}", response_model=Dict[str, Any])
async def get_agent_via_gateway(
    agent_id: UUID,
    api_token: APIToken = Depends(verify_api_token),
    db: Session = Depends(get_db),
    request: Request = None
):
    """Get agent details via API Gateway"""
    if "read:agents" not in api_token.scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token does not have 'read:agents' scope"
        )
    
    start_time = time.time()
    try:
        from app.models.agent import Agent
        
        agent = db.query(Agent).filter(
            Agent.id == agent_id,
            Agent.tenant_id == api_token.tenant_id
        ).first()
        
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        response_time = int((time.time() - start_time) * 1000)
        
        log_request(
            db=db,
            api_token_id=api_token.id,
            tenant_id=api_token.tenant_id,
            method=request.method if request else "GET",
            path=request.url.path if request else f"/api-gateway/agents/{agent_id}",
            status_code=200,
            response_time_ms=response_time,
            client_ip=request.client.host if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        
        return {
            "id": str(agent.id),
            "name": agent.name,
            "type": agent.type,
            "category": agent.category,
            "subcategory": agent.subcategory,
            "description": agent.description,
            "status": agent.status,
            "vendor_id": str(agent.vendor_id),
            "compliance_score": agent.compliance_score,
            "risk_score": agent.risk_score,
            "created_at": agent.created_at.isoformat() if agent.created_at else None,
            "updated_at": agent.updated_at.isoformat() if agent.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent via API Gateway: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def log_request(
    db: Session,
    api_token_id: UUID,
    tenant_id: UUID,
    method: str,
    path: str,
    status_code: int,
    response_time_ms: int,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log API Gateway request"""
    try:
        log_entry = APIGatewayRequestLog(
            tenant_id=tenant_id,
            api_token_id=api_token_id,
            method=method,
            path=path,
            status_code=status_code,
            response_time_ms=response_time_ms,
            client_ip=client_ip,
            user_agent=user_agent
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.error(f"Error logging API Gateway request: {e}", exc_info=True)
        db.rollback()

