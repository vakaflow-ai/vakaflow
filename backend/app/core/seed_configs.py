"""
Seed platform configurations from environment variables
This runs on application startup to populate the database with existing configs.

IMPORTANT: NO HARDCODED DEFAULTS
- All configuration values must come from environment variables
- If an environment variable is not set, the config will NOT be created
- Users can add/edit configurations through the Platform Configuration UI
- This seeding only creates configs that don't already exist (idempotent)
"""
import os
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.platform_config import ConfigCategory, ConfigValueType
from app.services.config_service import ConfigService

logger = logging.getLogger(__name__)


# Configuration definitions - NO HARDCODED DEFAULTS
# All values must come from environment variables
# Users can add/edit configurations through the UI
# This list defines which environment variables to check and their metadata
CONFIG_DEFINITIONS = [
    # Database
    {
        "key": "DATABASE_URL",
        "category": ConfigCategory.DATABASE,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "PostgreSQL database connection URL. Format: postgresql://user:password@host:port/dbname",
    },
    # Security
    {
        "key": "SECRET_KEY",
        "category": ConfigCategory.SECURITY,
        "value_type": ConfigValueType.SECRET,
        "is_secret": True,
        "is_required": False,
        "description": "Secret key for JWT token signing and encryption. Must be a strong random string.",
    },
    {
        "key": "ALGORITHM",
        "category": ConfigCategory.SECURITY,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "JWT algorithm for token signing (HS256, RS256, etc.)",
    },
    {
        "key": "ACCESS_TOKEN_EXPIRE_MINUTES",
        "category": ConfigCategory.SECURITY,
        "value_type": ConfigValueType.INTEGER,
        "is_secret": False,
        "is_required": False,
        "description": "Access token expiration time in minutes",
    },
    # Application
    {
        "key": "APP_NAME",
        "category": ConfigCategory.APPLICATION,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Application name displayed in the platform",
    },
    {
        "key": "ENVIRONMENT",
        "category": ConfigCategory.APPLICATION,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Application environment (development, staging, production)",
    },
    {
        "key": "DEBUG",
        "category": ConfigCategory.APPLICATION,
        "value_type": ConfigValueType.BOOLEAN,
        "is_secret": False,
        "is_required": False,
        "description": "Enable debug mode for detailed error messages",
    },
    # Redis
    {
        "key": "REDIS_URL",
        "category": ConfigCategory.REDIS,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Redis connection URL. Format: redis://host:port or redis://:password@host:port",
    },
    # Qdrant
    {
        "key": "QDRANT_URL",
        "category": ConfigCategory.QDRANT,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Qdrant vector database URL",
    },
    {
        "key": "QDRANT_API_KEY",
        "category": ConfigCategory.QDRANT,
        "value_type": ConfigValueType.SECRET,
        "is_secret": True,
        "is_required": False,
        "description": "Qdrant API key for authentication (if required)",
    },
    # OpenAI
    {
        "key": "OPENAI_API_KEY",
        "category": ConfigCategory.OPENAI,
        "value_type": ConfigValueType.SECRET,
        "is_secret": True,
        "is_required": False,
        "description": "OpenAI API key for AI model access",
    },
    # Claude
    {
        "key": "CLAUDE_API_KEY",
        "category": ConfigCategory.CLAUDE,
        "value_type": ConfigValueType.SECRET,
        "is_secret": True,
        "is_required": False,
        "description": "Claude API key for AI model access",
    },
    {
        "key": "CLAUDE_MODEL_NAME",
        "category": ConfigCategory.CLAUDE,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Claude AI model name (e.g., claude-3-haiku-20240307)",
    },
    # File Storage
    {
        "key": "UPLOAD_DIR",
        "category": ConfigCategory.FILE_STORAGE,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Directory path for file uploads",
    },
    {
        "key": "MAX_UPLOAD_SIZE",
        "category": ConfigCategory.FILE_STORAGE,
        "value_type": ConfigValueType.INTEGER,
        "is_secret": False,
        "is_required": False,
        "description": "Maximum file upload size in bytes",
    },
    # API
    {
        "key": "API_V1_PREFIX",
        "category": ConfigCategory.API,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "API version 1 URL prefix",
    },
    # CORS
    {
        "key": "CORS_ORIGINS",
        "category": ConfigCategory.CORS,
        "value_type": ConfigValueType.STRING,
        "is_secret": False,
        "is_required": False,
        "description": "Comma-separated list of allowed CORS origins. Use '*' for all origins (not recommended for production)",
    },
]


def get_env_value(key: str) -> Optional[str]:
    """Get value from environment variable - NO DEFAULTS, only from env"""
    return os.getenv(key)


def convert_value(value: str, value_type: ConfigValueType) -> any:
    """Convert string value to appropriate type"""
    if value_type == ConfigValueType.BOOLEAN:
        return value.lower() in ("true", "1", "yes", "on")
    elif value_type == ConfigValueType.INTEGER:
        try:
            return int(value)
        except ValueError:
            return 0
    elif value_type == ConfigValueType.JSON:
        try:
            import json
            return json.loads(value)
        except:
            return value
    else:
        return value


def seed_configurations(db: Session, user_id: Optional[str] = None) -> dict:
    """
    Seed platform configurations from environment variables.
    Only creates configurations that don't already exist (idempotent).
    
    Returns:
        dict with counts of created, updated, and skipped configurations
    """
    from app.models.platform_config import PlatformConfiguration
    
    stats = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0
    }
    
    try:
        for config_def in CONFIG_DEFINITIONS:
            try:
                # Get value from environment variable ONLY - no defaults
                env_value = get_env_value(config_def["key"])
                
                # Skip if environment variable is not set
                if not env_value:
                    stats["skipped"] += 1
                    logger.debug(f"Configuration {config_def['key']} not found in environment, skipping")
                    continue
                
                # Check if config already exists
                existing = db.query(PlatformConfiguration).filter(
                    PlatformConfiguration.config_key == config_def["key"]
                ).first()
                
                if existing:
                    # Config exists, skip seeding (don't overwrite user changes)
                    stats["skipped"] += 1
                    logger.debug(f"Configuration {config_def['key']} already exists, skipping")
                    continue
                
                # Convert value to appropriate type
                value = convert_value(env_value, config_def["value_type"])
                
                # Create the configuration
                ConfigService.set_config(
                    db=db,
                    config_key=config_def["key"],
                    value=value,
                    category=config_def["category"],
                    value_type=config_def["value_type"],
                    description=config_def.get("description"),
                    is_secret=config_def.get("is_secret", False),
                    user_id=user_id
                )
                
                stats["created"] += 1
                logger.info(f"Seeded configuration: {config_def['key']} (category: {config_def['category'].value})")
                
            except Exception as e:
                stats["errors"] += 1
                logger.error(f"Failed to seed configuration {config_def['key']}: {e}", exc_info=True)
        
        db.commit()
        logger.info(
            f"Configuration seeding completed: {stats['created']} created, "
            f"{stats['skipped']} skipped, {stats['errors']} errors"
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed configurations: {e}", exc_info=True)
        raise
    
    return stats


def seed_on_startup():
    """Seed configurations on application startup"""
    try:
        from app.core.database import SessionLocal
        
        db = SessionLocal()
        try:
            # Get platform admin user ID if available
            from app.models.user import User
            platform_admin = db.query(User).filter(
                User.role == "platform_admin"
            ).first()
            user_id = str(platform_admin.id) if platform_admin else None
            
            seed_configurations(db, user_id)
        finally:
            db.close()
    except Exception as e:
        # Don't fail startup if seeding fails
        logger.warning(f"Could not seed configurations on startup: {e}")
        logger.debug("This is normal if database is not yet initialized or migrations not run")
