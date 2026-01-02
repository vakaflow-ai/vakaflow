"""
Platform Configuration API endpoints (Platform Admin only)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.models.platform_config import ConfigCategory, ConfigValueType
from app.services.config_service import ConfigService, mask_secret
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/platform-config", tags=["platform-config"])


def require_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require platform admin role"""
    if current_user.role.value != "platform_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can manage platform configuration"
        )
    return current_user


class ConfigItemResponse(BaseModel):
    """Configuration item response (secrets are masked)"""
    id: str
    config_key: str
    category: str
    value_type: str
    value: Any  # Masked for secrets
    display_value: Optional[str] = None
    description: Optional[str] = None
    is_secret: bool
    is_required: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class ConfigItemCreate(BaseModel):
    """Create or update configuration item"""
    config_key: str = Field(..., min_length=1, max_length=100)
    value: Any = Field(...)  # Can be string, int, bool, or dict
    category: str = Field(...)
    value_type: str = Field(...)
    description: Optional[str] = None
    is_secret: bool = False


class ConfigItemUpdate(BaseModel):
    """Update configuration item"""
    value: Any = Field(...)
    description: Optional[str] = None


@router.get("", response_model=List[ConfigItemResponse])
async def list_configs(
    category: Optional[str] = None,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """List all platform configurations (platform admin only)"""
    from app.models.platform_config import PlatformConfiguration
    
    query = db.query(PlatformConfiguration)
    if category:
        try:
            category_enum = ConfigCategory(category)
            query = query.filter(PlatformConfiguration.category == category_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}"
            )
    
    configs = query.order_by(PlatformConfiguration.config_key).all()
    
    result = []
    for config in configs:
        # For secrets, use display_value (masked)
        if config.is_secret:
            value = config.display_value or "****"
        else:
            # Parse value based on type
            import json
            if config.value_type == ConfigValueType.JSON.value:
                try:
                    value = json.loads(config.config_value)
                except:
                    value = config.config_value
            elif config.value_type == ConfigValueType.INTEGER.value:
                try:
                    value = int(config.config_value)
                except:
                    value = config.config_value
            elif config.value_type == ConfigValueType.BOOLEAN.value:
                value = config.config_value.lower() in ("true", "1", "yes", "on")
            else:
                value = config.config_value
        
        result.append(ConfigItemResponse(
            id=str(config.id),
            config_key=config.config_key,
            category=config.category.value,
            value_type=config.value_type.value,
            value=value,
            display_value=config.display_value,
            description=config.description,
            is_secret=config.is_secret,
            is_required=config.is_required,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat()
        ))
    
    return result


@router.get("/{config_key}", response_model=ConfigItemResponse)
async def get_config(
    config_key: str,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get a specific configuration (platform admin only)"""
    from app.models.platform_config import PlatformConfiguration
    
    config = db.query(PlatformConfiguration).filter(
        PlatformConfiguration.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuration '{config_key}' not found"
        )
    
    # For secrets, use display_value (masked)
    if config.is_secret:
        value = config.display_value or "****"
    else:
        import json
        if config.value_type == ConfigValueType.JSON.value:
            try:
                value = json.loads(config.config_value)
            except:
                value = config.config_value
        elif config.value_type == ConfigValueType.INTEGER.value:
            try:
                value = int(config.config_value)
            except:
                value = config.config_value
        elif config.value_type == ConfigValueType.BOOLEAN.value:
            value = config.config_value.lower() in ("true", "1", "yes", "on")
        else:
            value = config.config_value
    
    return ConfigItemResponse(
        id=str(config.id),
        config_key=config.config_key,
        category=config.category.value,
        value_type=config.value_type.value,
        value=value,
        display_value=config.display_value,
        description=config.description,
        is_secret=config.is_secret,
        is_required=config.is_required,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.post("", response_model=ConfigItemResponse, status_code=status.HTTP_201_CREATED)
async def create_config(
    config_data: ConfigItemCreate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Create or update a platform configuration (platform admin only)"""
    try:
        category = ConfigCategory(config_data.category)
        value_type = ConfigValueType(config_data.value_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category or value_type: {e}"
        )
    
    config = ConfigService.set_config(
        db=db,
        config_key=config_data.config_key,
        value=config_data.value,
        category=category,
        value_type=value_type,
        description=config_data.description,
        is_secret=config_data.is_secret,
        user_id=current_user.id
    )
    
    # Return response with masked secret
    if config.is_secret:
        value = config.display_value or "****"
    else:
        import json
        if config.value_type == ConfigValueType.JSON:
            try:
                value = json.loads(config.config_value)
            except:
                value = config.config_value
        elif config.value_type == ConfigValueType.INTEGER:
            try:
                value = int(config.config_value)
            except:
                value = config.config_value
        elif config.value_type == ConfigValueType.BOOLEAN:
            value = config.config_value.lower() in ("true", "1", "yes", "on")
        else:
            value = config.config_value
    
    return ConfigItemResponse(
        id=str(config.id),
        config_key=config.config_key,
        category=config.category.value,
        value_type=config.value_type.value,
        value=value,
        display_value=config.display_value,
        description=config.description,
        is_secret=config.is_secret,
        is_required=config.is_required,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.put("/{config_key}", response_model=ConfigItemResponse)
async def update_config(
    config_key: str,
    config_data: ConfigItemUpdate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update a platform configuration (platform admin only)"""
    from app.models.platform_config import PlatformConfiguration
    
    config = db.query(PlatformConfiguration).filter(
        PlatformConfiguration.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuration '{config_key}' not found"
        )
    
    # Update value
    ConfigService.set_config(
        db=db,
        config_key=config_key,
        value=config_data.value,
        category=config.category,
        value_type=config.value_type,
        description=config_data.description or config.description,
        is_secret=config.is_secret,
        user_id=current_user.id
    )
    
    db.refresh(config)
    
    # Return response with masked secret
    if config.is_secret:
        value = config.display_value or "****"
    else:
        import json
        if config.value_type == ConfigValueType.JSON:
            try:
                value = json.loads(config.config_value)
            except:
                value = config.config_value
        elif config.value_type == ConfigValueType.INTEGER:
            try:
                value = int(config.config_value)
            except:
                value = config.config_value
        elif config.value_type == ConfigValueType.BOOLEAN:
            value = config.config_value.lower() in ("true", "1", "yes", "on")
        else:
            value = config.config_value
    
    return ConfigItemResponse(
        id=str(config.id),
        config_key=config.config_key,
        category=config.category.value,
        value_type=config.value_type.value,
        value=value,
        display_value=config.display_value,
        description=config.description,
        is_secret=config.is_secret,
        is_required=config.is_required,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat()
    )


@router.delete("/{config_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    config_key: str,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Delete a platform configuration (platform admin only)"""
    from app.models.platform_config import PlatformConfiguration
    
    config = db.query(PlatformConfiguration).filter(
        PlatformConfiguration.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuration '{config_key}' not found"
        )
    
    # Prevent deletion of required configs
    if config.is_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete required configuration '{config_key}'"
        )
    
    db.delete(config)
    db.commit()
    
    return None


@router.get("/categories/list", response_model=List[str])
async def list_categories(
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """List all configuration categories"""
    return [cat.value for cat in ConfigCategory]


@router.get("/value-types/list", response_model=List[str])
async def list_value_types(
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """List all value types"""
    return [vt.value for vt in ConfigValueType]

