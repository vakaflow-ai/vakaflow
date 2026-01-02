"""
Service for managing platform configuration with secret encryption
"""
import json
import base64
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from app.models.platform_config import PlatformConfiguration, ConfigCategory, ConfigValueType
from datetime import datetime
import uuid
import logging

logger = logging.getLogger(__name__)

# Encryption key for secrets (should be stored securely in production)
# In production, this should come from environment or key management service
_encryption_key: Optional[bytes] = None
_cipher: Optional[Fernet] = None


def _get_encryption_key() -> bytes:
    """Get or generate encryption key for secrets"""
    global _encryption_key
    if _encryption_key is None:
        # Try to get from environment or generate
        import os
        key_str = os.getenv("CONFIG_ENCRYPTION_KEY")
        if key_str:
            _encryption_key = base64.urlsafe_b64decode(key_str)
        else:
            # Generate a key (in production, this should be set via environment)
            from cryptography.fernet import Fernet as FernetGen
            key = FernetGen.generate_key()
            _encryption_key = key
            logger.warning("Generated new encryption key. Set CONFIG_ENCRYPTION_KEY in production!")
    return _encryption_key


def _get_cipher() -> Fernet:
    """Get Fernet cipher instance"""
    global _cipher
    if _cipher is None:
        key = _get_encryption_key()
        _cipher = Fernet(key)
    return _cipher


def encrypt_secret(value: str) -> str:
    """Encrypt a secret value"""
    try:
        cipher = _get_cipher()
        encrypted = cipher.encrypt(value.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    except Exception as e:
        logger.error(f"Failed to encrypt secret: {e}")
        raise


def decrypt_secret(encrypted_value: str) -> str:
    """Decrypt a secret value"""
    try:
        cipher = _get_cipher()
        decoded = base64.urlsafe_b64decode(encrypted_value.encode())
        decrypted = cipher.decrypt(decoded)
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Failed to decrypt secret: {e}")
        raise


def mask_secret(value: str, show_chars: int = 4) -> str:
    """Mask a secret value for display"""
    if not value or len(value) <= show_chars:
        return "****"
    return value[:show_chars] + "*" * (len(value) - show_chars)


class ConfigService:
    """Service for managing platform configuration"""
    
    @staticmethod
    def get_config(db: Session, config_key: str, default: Any = None) -> Optional[Any]:
        """Get a configuration value"""
        config = db.query(PlatformConfiguration).filter(
            PlatformConfiguration.config_key == config_key
        ).first()
        
        if not config:
            return default
        
        # Decrypt if secret
        if config.is_secret and config.is_encrypted:
            try:
                return decrypt_secret(config.config_value)
            except Exception as e:
                logger.error(f"Failed to decrypt config {config_key}: {e}")
                return default
        
        # Parse based on value type
        if config.value_type == ConfigValueType.JSON:
            try:
                return json.loads(config.config_value)
            except:
                return config.config_value
        elif config.value_type == ConfigValueType.INTEGER:
            try:
                return int(config.config_value)
            except:
                return default
        elif config.value_type == ConfigValueType.BOOLEAN:
            return config.config_value.lower() in ("true", "1", "yes", "on")
        else:
            return config.config_value
    
    @staticmethod
    def set_config(
        db: Session,
        config_key: str,
        value: Any,
        category: ConfigCategory,
        value_type: ConfigValueType,
        description: Optional[str] = None,
        is_secret: bool = False,
        user_id: Optional[uuid.UUID] = None
    ) -> PlatformConfiguration:
        """Set a configuration value"""
        # Convert value to string
        if value_type == ConfigValueType.JSON:
            config_value = json.dumps(value)
        else:
            config_value = str(value)
        
        # Encrypt if secret
        display_value = None
        is_encrypted = False
        if is_secret:
            try:
                config_value = encrypt_secret(config_value)
                display_value = mask_secret(str(value))
                is_encrypted = True
            except Exception as e:
                logger.error(f"Failed to encrypt secret for {config_key}: {e}")
                raise
        
        # Get or create config
        config = db.query(PlatformConfiguration).filter(
            PlatformConfiguration.config_key == config_key
        ).first()
        
        if config:
            config.config_value = config_value
            config.display_value = display_value
            config.is_encrypted = is_encrypted
            config.updated_by = user_id
            config.updated_at = datetime.utcnow()
            if description:
                config.description = description
        else:
            config = PlatformConfiguration(
                config_key=config_key,
                category=category,
                value_type=value_type,
                config_value=config_value,
                display_value=display_value,
                description=description,
                is_secret=is_secret,
                is_encrypted=is_encrypted,
                created_by=user_id,
                updated_by=user_id
            )
            db.add(config)
        
        db.commit()
        db.refresh(config)
        return config
    
    @staticmethod
    def get_all_configs(db: Session, category: Optional[ConfigCategory] = None) -> Dict[str, Any]:
        """Get all configuration values as a dictionary"""
        query = db.query(PlatformConfiguration)
        if category:
            query = query.filter(PlatformConfiguration.category == category)
        
        configs = query.all()
        result = {}
        
        for config in configs:
            # For secrets, return masked value
            if config.is_secret:
                result[config.config_key] = config.display_value or "****"
            else:
                # Parse value based on type
                if config.value_type == ConfigValueType.JSON:
                    try:
                        result[config.config_key] = json.loads(config.config_value)
                    except:
                        result[config.config_key] = config.config_value
                elif config.value_type == ConfigValueType.INTEGER:
                    try:
                        result[config.config_key] = int(config.config_value)
                    except:
                        result[config.config_key] = config.config_value
                elif config.value_type == ConfigValueType.BOOLEAN:
                    result[config.config_key] = config.config_value.lower() in ("true", "1", "yes", "on")
                else:
                    result[config.config_key] = config.config_value
        
        return result
    
    @staticmethod
    def get_config_for_settings(db: Session) -> Dict[str, Any]:
        """Get all configuration values for Settings class (with decrypted secrets)"""
        configs = db.query(PlatformConfiguration).all()
        result = {}
        
        for config in configs:
            # Decrypt secrets for internal use
            if config.is_secret and config.is_encrypted:
                try:
                    result[config.config_key] = decrypt_secret(config.config_value)
                except Exception as e:
                    logger.error(f"Failed to decrypt {config.config_key}: {e}")
                    # Use fallback from environment
                    import os
                    result[config.config_key] = os.getenv(config.config_key, "")
            else:
                # Parse value based on type
                if config.value_type == ConfigValueType.JSON:
                    try:
                        result[config.config_key] = json.loads(config.config_value)
                    except:
                        result[config.config_key] = config.config_value
                elif config.value_type == ConfigValueType.INTEGER:
                    try:
                        result[config.config_key] = int(config.config_value)
                    except:
                        result[config.config_key] = 0
                elif config.value_type == ConfigValueType.BOOLEAN:
                    result[config.config_key] = config.config_value.lower() in ("true", "1", "yes", "on")
                else:
                    result[config.config_key] = config.config_value
        
        return result

