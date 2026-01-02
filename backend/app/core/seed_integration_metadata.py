"""
Seed integration metadata templates from environment variables
This loads integration configuration field definitions that users can edit
"""
import os
import json
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_integration_metadata_from_env() -> Dict[str, Dict[str, Any]]:
    """
    Load integration metadata from environment variables.
    Environment variables should be in format: INTEGRATION_METADATA_<TYPE>=<JSON>
    Example: INTEGRATION_METADATA_SERVICENOW='{"fields":[...],"description":"..."}'
    
    Returns:
        Dict mapping integration type to metadata
    """
    metadata = {}
    
    # Check for integration metadata in environment variables
    for key, value in os.environ.items():
        if key.startswith("INTEGRATION_METADATA_"):
            integration_type = key.replace("INTEGRATION_METADATA_", "").lower()
            try:
                metadata[integration_type] = json.loads(value)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse integration metadata for {integration_type}: {e}")
    
    return metadata


def seed_integration_metadata(db: Session) -> dict:
    """
    Seed integration metadata templates.
    Currently, integration metadata is stored in integration_help.py.
    This function can be extended to load metadata from environment variables
    and store them in a database table for user editing.
    
    For now, this is a placeholder that can be extended when we add
    an integration_metadata table.
    """
    stats = {
        "loaded": 0,
        "skipped": 0,
        "errors": 0
    }
    
    try:
        # Load metadata from environment variables
        env_metadata = get_integration_metadata_from_env()
        
        if env_metadata:
            logger.info(f"Loaded {len(env_metadata)} integration metadata templates from environment")
            stats["loaded"] = len(env_metadata)
            # TODO: Store in database table when integration_metadata table is created
        else:
            logger.debug("No integration metadata found in environment variables")
            stats["skipped"] = 1
        
    except Exception as e:
        stats["errors"] += 1
        logger.error(f"Failed to seed integration metadata: {e}", exc_info=True)
    
    return stats


def seed_on_startup():
    """Seed integration metadata on application startup"""
    try:
        from app.core.database import SessionLocal
        
        db = SessionLocal()
        try:
            seed_integration_metadata(db)
        finally:
            db.close()
    except Exception as e:
        # Don't fail startup if seeding fails
        logger.warning(f"Could not seed integration metadata on startup: {e}")
        logger.debug("This is normal if database is not yet initialized")
