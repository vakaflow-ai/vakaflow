"""
Performance optimization utilities
"""
from functools import wraps
from typing import Callable
import time
import logging

logger = logging.getLogger(__name__)


def measure_performance(func: Callable):
    """Decorator to measure function execution time"""
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            if execution_time > 1.0:  # Log slow queries (>1 second)
                logger.warning(
                    f"Slow query detected: {func.__name__} took {execution_time:.2f}s"
                )
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"Error in {func.__name__} after {execution_time:.2f}s: {str(e)}"
            )
            raise
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            if execution_time > 1.0:
                logger.warning(
                    f"Slow query detected: {func.__name__} took {execution_time:.2f}s"
                )
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"Error in {func.__name__} after {execution_time:.2f}s: {str(e)}"
            )
            raise
    
    if hasattr(func, '__code__') and func.__code__.co_flags & 0x80:  # Check if async
        return async_wrapper
    return sync_wrapper


def optimize_query(query, limit: int = 100):
    """Optimize database query"""
    # Add default limit if not present
    if not hasattr(query, '_limit'):
        query = query.limit(limit)
    
    # Use select_related/joinedload for relationships
    # This would be implemented based on specific query needs
    
    return query

