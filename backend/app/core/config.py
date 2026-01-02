"""
Application configuration - loads from database with environment variable fallback
"""
from pydantic_settings import BaseSettings
from typing import List, Optional, Dict, Any
import os
import logging

logger = logging.getLogger(__name__)

# Cache for database-loaded config
_db_config_cache: Optional[Dict[str, Any]] = None


def _load_config_from_db() -> Dict[str, Any]:
    """Load configuration from database (with fallback to environment)"""
    global _db_config_cache
    
    # Try to load from database (lazy import to avoid circular dependencies)
    try:
        # Only import when needed to avoid circular imports
        from app.core.database import SessionLocal
        from app.services.config_service import ConfigService
        
        db = SessionLocal()
        try:
            config = ConfigService.get_config_for_settings(db)
            _db_config_cache = config
            return config
        except Exception as e:
            # Silently fail during startup (database might not be ready)
            if "partially initialized" not in str(e).lower():
                logger.warning(f"Failed to load config from database: {e}. Using environment variables.")
            db.close()
    except (ImportError, AttributeError) as e:
        # Silently handle circular import or missing database during startup
        if "partially initialized" not in str(e).lower():
            logger.debug(f"Database not available for config loading: {e}. Using environment variables.")
    except Exception as e:
        logger.warning(f"Database not available for config loading: {e}. Using environment variables.")
    
    # Fallback to environment variables
    return {}


def _get_config_value(key: str, default: Any, env_key: Optional[str] = None) -> Any:
    """Get configuration value from database or environment"""
    global _db_config_cache
    
    # Try database first
    if _db_config_cache is None:
        _db_config_cache = _load_config_from_db()
    
    if key in _db_config_cache:
        return _db_config_cache[key]
    
    # Fallback to environment variable
    env_key = env_key or key
    return os.getenv(env_key, default)


class Settings(BaseSettings):
    """Application settings - loads from database with environment fallback"""
    
    # Application
    @property
    def APP_NAME(self) -> str:
        return _get_config_value("APP_NAME", "VAKA Agent Platform")
    
    @property
    def ENVIRONMENT(self) -> str:
        return _get_config_value("ENVIRONMENT", os.getenv("ENVIRONMENT", "development"))
    
    @property
    def DEBUG(self) -> bool:
        return _get_config_value("DEBUG", os.getenv("DEBUG", "true").lower() == "true", "DEBUG")
    
    # API
    @property
    def API_V1_PREFIX(self) -> str:
        return _get_config_value("API_V1_PREFIX", "/api/v1")
    
    @property
    def CORS_ORIGINS(self) -> str:
        return _get_config_value("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000")
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        origins = self.CORS_ORIGINS
        return [origin.strip() for origin in origins.split(",") if origin.strip()]
    
    # Database
    @property
    def DATABASE_URL(self) -> str:
        return _get_config_value("DATABASE_URL", os.getenv("DATABASE_URL", "postgresql://vaka_user:vaka_password@localhost:5432/vaka"))
    
    # Redis
    @property
    def REDIS_URL(self) -> str:
        return _get_config_value("REDIS_URL", os.getenv("REDIS_URL", "redis://localhost:6379"))
    
    # Qdrant (Vector DB)
    @property
    def QDRANT_URL(self) -> str:
        return _get_config_value("QDRANT_URL", os.getenv("QDRANT_URL", "http://localhost:6333"))
    
    @property
    def QDRANT_API_KEY(self) -> str:
        return _get_config_value("QDRANT_API_KEY", os.getenv("QDRANT_API_KEY", ""))
    
    # OpenAI
    @property
    def OPENAI_API_KEY(self) -> str:
        return _get_config_value("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY", ""))
    
    # Security
    @property
    def SECRET_KEY(self) -> str:
        return _get_config_value("SECRET_KEY", os.getenv("SECRET_KEY", "change-this-in-production"))
    
    @property
    def ALGORITHM(self) -> str:
        return _get_config_value("ALGORITHM", "HS256")
    
    @property
    def ACCESS_TOKEN_EXPIRE_MINUTES(self) -> int:
        return int(_get_config_value("ACCESS_TOKEN_EXPIRE_MINUTES", os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")))
    
    # File Storage
    @property
    def UPLOAD_DIR(self) -> str:
        return _get_config_value("UPLOAD_DIR", "./uploads")
    
    @property
    def MAX_UPLOAD_SIZE(self) -> int:
        return int(_get_config_value("MAX_UPLOAD_SIZE", os.getenv("MAX_UPLOAD_SIZE", str(50 * 1024 * 1024))))
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env


settings = Settings()

# Refresh config cache on startup
try:
    _load_config_from_db()
except:
    pass  # Will use environment variables


# Default tenant ID for platform admins (hardcoded UUID)
# This is a reserved tenant_id that platform admins use when they don't have a specific tenant assigned
# The tenant with this ID should exist in the database (created via seed script)
PLATFORM_ADMIN_DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"  # Reserved UUID for platform admin default tenant

