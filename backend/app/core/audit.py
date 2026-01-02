"""
Audit trail service
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog, AuditAction
from app.models.user import User
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class AuditService:
    """Service for audit logging"""
    
    @staticmethod
    def log_action(
        db: Session,
        user_id: str,
        action: AuditAction,
        resource_type: str,
        resource_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log an audit action"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=action.value,
                resource_type=resource_type,
                resource_id=resource_id,
                tenant_id=tenant_id,
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent
            )
            db.add(audit_log)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log audit action: {e}")
            db.rollback()
    
    @staticmethod
    def get_audit_logs(
        db: Session,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ):
        """Get audit logs with filters"""
        query = db.query(AuditLog)
        
        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if resource_id:
            query = query.filter(AuditLog.resource_id == resource_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        total = query.count()
        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "logs": logs,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    
    @staticmethod
    def get_resource_history(
        db: Session,
        resource_type: str,
        resource_id: str,
        limit: int = 50
    ):
        """Get history for a specific resource"""
        return AuditService.get_audit_logs(
            db=db,
            resource_type=resource_type,
            resource_id=resource_id,
            limit=limit
        )


# Global instance
audit_service = AuditService()

