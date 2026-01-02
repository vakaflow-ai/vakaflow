"""
Caching utilities using Redis
"""
import json
import logging
from typing import Optional, Any
from redis import Redis
from app.core.config import settings
import functools

logger = logging.getLogger(__name__)
redis_client: Optional[Redis] = None


def get_redis() -> Optional[Redis]:
    """
    Get Redis client with error handling
    
    Returns:
        Redis client or None if connection fails
    """
    global redis_client
    if redis_client is None:
        try:
            redis_client = Redis.from_url(
                settings.REDIS_URL, 
                decode_responses=True,
                socket_connect_timeout=2,  # 2 second connection timeout
                socket_timeout=2,  # 2 second socket timeout
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            redis_client.ping()
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to connect to Redis: {e}. Rate limiting will use fallback.")
            redis_client = None
    return redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate cache key"""
    key_parts = [prefix]
    if args:
        key_parts.extend(str(arg) for arg in args)
    if kwargs:
        key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
    return ":".join(key_parts)


def cached(ttl: int = 300, key_prefix: str = None):
    """
    Decorator to cache function results
    
    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for cache key
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            prefix = key_prefix or f"{func.__module__}.{func.__name__}"
            cache_key_str = cache_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            try:
                redis = get_redis()
                if redis:
                    cached_value = redis.get(cache_key_str)
                    if cached_value:
                        return json.loads(cached_value)
            except Exception:
                # If Redis fails, continue without cache
                pass
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            try:
                redis = get_redis()
                if redis:
                    redis.setex(
                        cache_key_str,
                        ttl,
                        json.dumps(result, default=str)
                    )
            except Exception:
                # If Redis fails, continue without cache
                pass
            
            return result
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str):
    """Invalidate cache entries matching pattern"""
    try:
        redis = get_redis()
        if redis:
            keys = redis.keys(pattern)
            if keys:
                redis.delete(*keys)
    except Exception:
        pass

