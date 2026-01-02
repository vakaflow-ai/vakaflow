"""
Logging filter to mask secrets and passwords in log messages
"""
import logging
import re
from typing import Any


class SecretFilter(logging.Filter):
    """Filter to mask secrets, passwords, and tokens in log messages"""
    
    # Patterns to match secrets
    SECRET_PATTERNS = [
        (r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?([^"\'\s]+)["\']?', r'\1: ****'),
        (r'(?i)(secret|secret_key|api_key|token|bearer)\s*[:=]\s*["\']?([^"\'\s]{8,})["\']?', r'\1: ****'),
        (r'(?i)(authorization)\s*[:=]\s*["\']?(bearer\s+)?([^"\'\s]+)["\']?', r'\1: ****'),
        (r'(?i)(apikey|api_key)\s*[:=]\s*["\']?([^"\'\s]+)["\']?', r'\1: ****'),
        (r'(?i)(access_token|refresh_token)\s*[:=]\s*["\']?([^"\'\s]+)["\']?', r'\1: ****'),
        # Database URLs with passwords
        (r'(postgresql|mysql|mongodb)://[^:]+:([^@]+)@', r'\1://****:****@'),
        (r'(redis)://([^:]+):([^@]+)@', r'\1://****:****@'),
        # JWT tokens (long base64 strings)
        (r'\b(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b', '****'),
    ]
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Filter log record to mask secrets"""
        if hasattr(record, 'msg') and record.msg:
            msg = str(record.msg)
            for pattern, replacement in self.SECRET_PATTERNS:
                msg = re.sub(pattern, replacement, msg)
            record.msg = msg
        
        if hasattr(record, 'args') and record.args:
            args = list(record.args)
            for i, arg in enumerate(args):
                if isinstance(arg, str):
                    for pattern, replacement in self.SECRET_PATTERNS:
                        args[i] = re.sub(pattern, replacement, arg)
            record.args = tuple(args)
        
        return True


def setup_secret_filter():
    """Add secret filter to root logger"""
    root_logger = logging.getLogger()
    secret_filter = SecretFilter()
    
    # Remove existing secret filters to avoid duplicates
    root_logger.filters = [f for f in root_logger.filters if not isinstance(f, SecretFilter)]
    
    # Add secret filter
    root_logger.addFilter(secret_filter)
    
    # Also add to all handlers
    for handler in root_logger.handlers:
        handler.filters = [f for f in handler.filters if not isinstance(f, SecretFilter)]
        handler.addFilter(secret_filter)

