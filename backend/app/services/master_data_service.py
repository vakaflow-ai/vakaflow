"""
Master Data Service
Provides helper functions to validate and fetch master data values
"""
from sqlalchemy.orm import Session
from app.models.master_data_list import MasterDataList
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class MasterDataService:
    """Service for working with master data lists"""
    
    @staticmethod
    def get_master_data_list(db: Session, tenant_id: str, list_type: str) -> Optional[MasterDataList]:
        """Get a master data list by type for a tenant"""
        try:
            return db.query(MasterDataList).filter(
                MasterDataList.tenant_id == tenant_id,
                MasterDataList.list_type == list_type,
                MasterDataList.is_active == True
            ).first()
        except Exception as e:
            logger.error(f"Error fetching master data list {list_type} for tenant {tenant_id}: {e}")
            return None
    
    @staticmethod
    def get_master_data_values(db: Session, tenant_id: str, list_type: str) -> List[Dict[str, Any]]:
        """Get all active values from a master data list"""
        master_list = MasterDataService.get_master_data_list(db, tenant_id, list_type)
        if not master_list:
            return []
        
        # Filter to only active values
        return [
            v for v in master_list.values 
            if isinstance(v, dict) and v.get('is_active', True)
        ]
    
    @staticmethod
    def get_master_data_value(db: Session, tenant_id: str, list_type: str, value: str) -> Optional[Dict[str, Any]]:
        """Get a specific value from a master data list"""
        values = MasterDataService.get_master_data_values(db, tenant_id, list_type)
        for v in values:
            if isinstance(v, dict) and v.get('value') == value:
                return v
        return None
    
    @staticmethod
    def validate_value(db: Session, tenant_id: str, list_type: str, value: str) -> bool:
        """Validate that a value exists in the master data list"""
        master_list = MasterDataService.get_master_data_list(db, tenant_id, list_type)
        if not master_list:
            logger.warning(f"Master data list {list_type} not found for tenant {tenant_id}")
            return False
        
        # Check if value exists in the list
        for v in master_list.values:
            if isinstance(v, dict) and v.get('value') == value and v.get('is_active', True):
                return True
        
        return False
    
    @staticmethod
    def get_value_label(db: Session, tenant_id: str, list_type: str, value: str) -> Optional[str]:
        """Get the label for a master data value"""
        value_data = MasterDataService.get_master_data_value(db, tenant_id, list_type, value)
        if value_data:
            return value_data.get('label', value)
        return value
    
    @staticmethod
    def get_allowed_values(db: Session, tenant_id: str, list_type: str) -> List[str]:
        """Get list of allowed value strings from a master data list"""
        values = MasterDataService.get_master_data_values(db, tenant_id, list_type)
        return [v.get('value') for v in values if isinstance(v, dict) and v.get('value')]


# Convenience functions for common master data types
def get_user_roles(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get user roles from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "user_role")


def get_agent_types(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get agent types from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "agent_type")


def get_agent_statuses(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get agent statuses from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "agent_status")


def get_agent_skills(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get agent skills from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "agent_skill")


def get_assessment_types(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get assessment types from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "assessment_type")


def get_assessment_statuses(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get assessment statuses from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "assessment_status")


def get_schedule_frequencies(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get schedule frequencies from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "schedule_frequency")


def get_approval_statuses(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get approval statuses from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "approval_status")


def get_workflow_statuses(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get workflow statuses from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "workflow_status")


def get_workflow_engine_types(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get workflow engine types from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "workflow_engine_type")


def get_workflow_stages(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    """Get workflow stages from master data"""
    return MasterDataService.get_master_data_values(db, tenant_id, "workflow_stage")
