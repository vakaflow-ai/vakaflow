"""
Agent Execution Rate Limiting Service
"""
from typing import Optional, Tuple
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging

from app.models.agentic_agent import AgenticAgentInteraction
from app.core.cache import get_redis

logger = logging.getLogger(__name__)


class AgentRateLimiter:
    """Service for rate limiting agent executions"""
    
    # Default rate limits
    DEFAULT_AGENT_LIMIT_PER_MINUTE = 10
    DEFAULT_AGENT_LIMIT_PER_HOUR = 100
    DEFAULT_TENANT_LIMIT_PER_MINUTE = 50
    DEFAULT_TENANT_LIMIT_PER_HOUR = 500
    DEFAULT_USER_LIMIT_PER_MINUTE = 20
    DEFAULT_USER_LIMIT_PER_HOUR = 200
    
    def __init__(self, db: Session):
        self.db = db
    
    def check_agent_execution_rate_limit(
        self,
        agent_id: UUID,
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        agent_limit_per_minute: Optional[int] = None,
        agent_limit_per_hour: Optional[int] = None,
        tenant_limit_per_minute: Optional[int] = None,
        tenant_limit_per_hour: Optional[int] = None,
        user_limit_per_minute: Optional[int] = None,
        user_limit_per_hour: Optional[int] = None
    ) -> Tuple[bool, str, dict]:
        """
        Check if agent execution is allowed based on rate limits
        
        Args:
            agent_id: Agent ID
            tenant_id: Tenant ID
            user_id: Optional user ID
            agent_limit_per_minute: Per-agent limit per minute (default: 10)
            agent_limit_per_hour: Per-agent limit per hour (default: 100)
            tenant_limit_per_minute: Per-tenant limit per minute (default: 50)
            tenant_limit_per_hour: Per-tenant limit per hour (default: 500)
            user_limit_per_minute: Per-user limit per minute (default: 20)
            user_limit_per_hour: Per-user limit per hour (default: 200)
        
        Returns:
            Tuple of (is_allowed, limit_type, details)
            - is_allowed: True if execution is allowed
            - limit_type: Empty string if allowed, otherwise "agent_minute", "agent_hour", "tenant_minute", "tenant_hour", "user_minute", "user_hour"
            - details: Dictionary with current counts and limits
        """
        # Use defaults if not specified
        agent_limit_per_minute = agent_limit_per_minute or self.DEFAULT_AGENT_LIMIT_PER_MINUTE
        agent_limit_per_hour = agent_limit_per_hour or self.DEFAULT_AGENT_LIMIT_PER_HOUR
        tenant_limit_per_minute = tenant_limit_per_minute or self.DEFAULT_TENANT_LIMIT_PER_MINUTE
        tenant_limit_per_hour = tenant_limit_per_hour or self.DEFAULT_TENANT_LIMIT_PER_HOUR
        user_limit_per_minute = user_limit_per_minute or self.DEFAULT_USER_LIMIT_PER_MINUTE
        user_limit_per_hour = user_limit_per_hour or self.DEFAULT_USER_LIMIT_PER_HOUR
        
        # Try Redis first for distributed rate limiting
        redis = get_redis()
        if redis:
            return self._check_rate_limit_redis(
                redis, agent_id, tenant_id, user_id,
                agent_limit_per_minute, agent_limit_per_hour,
                tenant_limit_per_minute, tenant_limit_per_hour,
                user_limit_per_minute, user_limit_per_hour
            )
        else:
            # Fallback to database-based rate limiting
            return self._check_rate_limit_db(
                agent_id, tenant_id, user_id,
                agent_limit_per_minute, agent_limit_per_hour,
                tenant_limit_per_minute, tenant_limit_per_hour,
                user_limit_per_minute, user_limit_per_hour
            )
    
    def _check_rate_limit_redis(
        self,
        redis,
        agent_id: UUID,
        tenant_id: UUID,
        user_id: Optional[UUID],
        agent_limit_per_minute: int,
        agent_limit_per_hour: int,
        tenant_limit_per_minute: int,
        tenant_limit_per_hour: int,
        user_limit_per_minute: int,
        user_limit_per_hour: int
    ) -> Tuple[bool, str, dict]:
        """Check rate limits using Redis"""
        try:
            now = datetime.utcnow()
            minute_ago = now - timedelta(minutes=1)
            hour_ago = now - timedelta(hours=1)
            
            # Check per-agent limits
            agent_key_minute = f"rate_limit:agent:{agent_id}:minute"
            agent_key_hour = f"rate_limit:agent:{agent_id}:hour"
            
            agent_count_minute = redis.incr(agent_key_minute)
            if agent_count_minute == 1:
                redis.expire(agent_key_minute, 60)
            if agent_count_minute > agent_limit_per_minute:
                return False, "agent_minute", {
                    "agent_id": str(agent_id),
                    "limit": agent_limit_per_minute,
                    "current": agent_count_minute,
                    "window": "minute"
                }
            
            agent_count_hour = redis.incr(agent_key_hour)
            if agent_count_hour == 1:
                redis.expire(agent_key_hour, 3600)
            if agent_count_hour > agent_limit_per_hour:
                return False, "agent_hour", {
                    "agent_id": str(agent_id),
                    "limit": agent_limit_per_hour,
                    "current": agent_count_hour,
                    "window": "hour"
                }
            
            # Check per-tenant limits
            tenant_key_minute = f"rate_limit:tenant:{tenant_id}:minute"
            tenant_key_hour = f"rate_limit:tenant:{tenant_id}:hour"
            
            tenant_count_minute = redis.incr(tenant_key_minute)
            if tenant_count_minute == 1:
                redis.expire(tenant_key_minute, 60)
            if tenant_count_minute > tenant_limit_per_minute:
                return False, "tenant_minute", {
                    "tenant_id": str(tenant_id),
                    "limit": tenant_limit_per_minute,
                    "current": tenant_count_minute,
                    "window": "minute"
                }
            
            tenant_count_hour = redis.incr(tenant_key_hour)
            if tenant_count_hour == 1:
                redis.expire(tenant_key_hour, 3600)
            if tenant_count_hour > tenant_limit_per_hour:
                return False, "tenant_hour", {
                    "tenant_id": str(tenant_id),
                    "limit": tenant_limit_per_hour,
                    "current": tenant_count_hour,
                    "window": "hour"
                }
            
            # Check per-user limits (if user_id provided)
            if user_id:
                user_key_minute = f"rate_limit:user:{user_id}:minute"
                user_key_hour = f"rate_limit:user:{user_id}:hour"
                
                user_count_minute = redis.incr(user_key_minute)
                if user_count_minute == 1:
                    redis.expire(user_key_minute, 60)
                if user_count_minute > user_limit_per_minute:
                    return False, "user_minute", {
                        "user_id": str(user_id),
                        "limit": user_limit_per_minute,
                        "current": user_count_minute,
                        "window": "minute"
                    }
                
                user_count_hour = redis.incr(user_key_hour)
                if user_count_hour == 1:
                    redis.expire(user_key_hour, 3600)
                if user_count_hour > user_limit_per_hour:
                    return False, "user_hour", {
                        "user_id": str(user_id),
                        "limit": user_limit_per_hour,
                        "current": user_count_hour,
                        "window": "hour"
                    }
            
            # All checks passed
            return True, "", {
                "agent": {"minute": agent_count_minute, "hour": agent_count_hour},
                "tenant": {"minute": tenant_count_minute, "hour": tenant_count_hour},
                "user": {"minute": user_count_minute if user_id else None, "hour": user_count_hour if user_id else None} if user_id else None
            }
        except Exception as e:
            logger.warning(f"Redis rate limiting failed, falling back to database: {e}")
            return self._check_rate_limit_db(
                agent_id, tenant_id, user_id,
                agent_limit_per_minute, agent_limit_per_hour,
                tenant_limit_per_minute, tenant_limit_per_hour,
                user_limit_per_minute, user_limit_per_hour
            )
    
    def _check_rate_limit_db(
        self,
        agent_id: UUID,
        tenant_id: UUID,
        user_id: Optional[UUID],
        agent_limit_per_minute: int,
        agent_limit_per_hour: int,
        tenant_limit_per_minute: int,
        tenant_limit_per_hour: int,
        user_limit_per_minute: int,
        user_limit_per_hour: int
    ) -> Tuple[bool, str, dict]:
        """Check rate limits using database queries"""
        try:
            now = datetime.utcnow()
            minute_ago = now - timedelta(minutes=1)
            hour_ago = now - timedelta(hours=1)
            
            # Check per-agent limits
            agent_count_minute = self.db.query(func.count(AgenticAgentInteraction.id)).filter(
                AgenticAgentInteraction.agent_id == agent_id,
                AgenticAgentInteraction.created_at >= minute_ago,
                AgenticAgentInteraction.interaction_type == "skill_execution"
            ).scalar() or 0
            
            if agent_count_minute >= agent_limit_per_minute:
                return False, "agent_minute", {
                    "agent_id": str(agent_id),
                    "limit": agent_limit_per_minute,
                    "current": agent_count_minute,
                    "window": "minute"
                }
            
            agent_count_hour = self.db.query(func.count(AgenticAgentInteraction.id)).filter(
                AgenticAgentInteraction.agent_id == agent_id,
                AgenticAgentInteraction.created_at >= hour_ago,
                AgenticAgentInteraction.interaction_type == "skill_execution"
            ).scalar() or 0
            
            if agent_count_hour >= agent_limit_per_hour:
                return False, "agent_hour", {
                    "agent_id": str(agent_id),
                    "limit": agent_limit_per_hour,
                    "current": agent_count_hour,
                    "window": "hour"
                }
            
            # Check per-tenant limits
            tenant_count_minute = self.db.query(func.count(AgenticAgentInteraction.id)).filter(
                AgenticAgentInteraction.tenant_id == tenant_id,
                AgenticAgentInteraction.created_at >= minute_ago,
                AgenticAgentInteraction.interaction_type == "skill_execution"
            ).scalar() or 0
            
            if tenant_count_minute >= tenant_limit_per_minute:
                return False, "tenant_minute", {
                    "tenant_id": str(tenant_id),
                    "limit": tenant_limit_per_minute,
                    "current": tenant_count_minute,
                    "window": "minute"
                }
            
            tenant_count_hour = self.db.query(func.count(AgenticAgentInteraction.id)).filter(
                AgenticAgentInteraction.tenant_id == tenant_id,
                AgenticAgentInteraction.created_at >= hour_ago,
                AgenticAgentInteraction.interaction_type == "skill_execution"
            ).scalar() or 0
            
            if tenant_count_hour >= tenant_limit_per_hour:
                return False, "tenant_hour", {
                    "tenant_id": str(tenant_id),
                    "limit": tenant_limit_per_hour,
                    "current": tenant_count_hour,
                    "window": "hour"
                }
            
            # Check per-user limits (if user_id provided)
            user_count_minute = None
            user_count_hour = None
            if user_id:
                # Note: AgenticAgentInteraction doesn't have user_id, so we'd need to track this differently
                # For now, skip user-level rate limiting in DB mode
                # This could be enhanced by adding user_id to interactions or using a separate tracking table
                pass
            
            # All checks passed
            return True, "", {
                "agent": {"minute": agent_count_minute, "hour": agent_count_hour},
                "tenant": {"minute": tenant_count_minute, "hour": tenant_count_hour},
                "user": {"minute": user_count_minute, "hour": user_count_hour} if user_id else None
            }
        except Exception as e:
            logger.error(f"Database rate limiting failed: {e}", exc_info=True)
            # On error, allow execution (fail open)
            return True, "", {"error": str(e)}

