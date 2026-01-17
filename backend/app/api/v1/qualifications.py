"""
Unified Qualification API - Entity-agnostic qualification dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.assessment import AssessmentAssignment
from app.models.agent import Agent
from app.models.product import Product
from app.models.service import Service
from app.models.vendor import Vendor
from app.api.v1.auth import get_current_user
from app.core.tenant_utils import get_effective_tenant_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/qualifications", tags=["qualifications"])


class QualificationItem(BaseModel):
    """Qualification item response"""
    id: str
    entity_type: str
    entity_id: str
    entity_name: str
    assessment_id: str
    assessment_name: str
    status: str
    assigned_at: str
    due_date: Optional[str]
    completed_at: Optional[str]
    vendor_id: Optional[str]
    vendor_name: Optional[str]
    risk_score: Optional[int]
    compliance_score: Optional[int]


class QualificationListResponse(BaseModel):
    """Qualification list response"""
    qualifications: List[QualificationItem]
    total: int
    page: int
    limit: int
    summary: Dict[str, Any]


@router.get("", response_model=QualificationListResponse)
async def list_qualifications(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (agent, product, service, vendor)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all qualifications across all entity types"""
    try:
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to view qualifications"
            )
        
        # Build query
        query = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.tenant_id == effective_tenant_id
        )
        
        # Filter by entity_type if provided
        if entity_type:
            query = query.filter(AssessmentAssignment.entity_type == entity_type)
        
        # Filter by status if provided
        if status:
            query = query.filter(AssessmentAssignment.status == status)
        
        # Get total count
        total = query.count()
        
        # Paginate
        offset = (page - 1) * limit
        assignments = query.order_by(AssessmentAssignment.assigned_at.desc()).offset(offset).limit(limit).all()
        
        # Build response with entity details
        qualifications = []
        entity_cache = {}
        
        for assignment in assignments:
            entity_type_val = assignment.entity_type or (assignment.agent_id and "agent") or (assignment.vendor_id and "vendor")
            entity_id_val = assignment.entity_id or assignment.agent_id or assignment.vendor_id
            
            if not entity_type_val or not entity_id_val:
                continue
            
            # Get entity details
            entity_name = "Unknown"
            vendor_id = None
            vendor_name = None
            risk_score = None
            compliance_score = None
            
            cache_key = f"{entity_type_val}_{entity_id_val}"
            if cache_key not in entity_cache:
                if entity_type_val == "agent":
                    agent = db.query(Agent).filter(Agent.id == entity_id_val).first()
                    if agent:
                        entity_name = agent.name
                        vendor_id = str(agent.vendor_id)
                        risk_score = agent.risk_score
                        compliance_score = agent.compliance_score
                        # Get vendor name
                        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
                        if vendor:
                            vendor_name = vendor.name
                elif entity_type_val == "product":
                    product = db.query(Product).filter(Product.id == entity_id_val).first()
                    if product:
                        entity_name = product.name
                        vendor_id = str(product.vendor_id)
                        risk_score = product.risk_score
                        compliance_score = product.compliance_score
                        vendor = db.query(Vendor).filter(Vendor.id == product.vendor_id).first()
                        if vendor:
                            vendor_name = vendor.name
                elif entity_type_val == "service":
                    service = db.query(Service).filter(Service.id == entity_id_val).first()
                    if service:
                        entity_name = service.name
                        vendor_id = str(service.vendor_id)
                        risk_score = service.risk_score
                        compliance_score = service.compliance_score
                        vendor = db.query(Vendor).filter(Vendor.id == service.vendor_id).first()
                        if vendor:
                            vendor_name = vendor.name
                elif entity_type_val == "vendor":
                    vendor = db.query(Vendor).filter(Vendor.id == entity_id_val).first()
                    if vendor:
                        entity_name = vendor.name
                        vendor_id = str(vendor.id)
                        vendor_name = vendor.name
                        compliance_score = vendor.compliance_score
                
                entity_cache[cache_key] = {
                    "name": entity_name,
                    "vendor_id": vendor_id,
                    "vendor_name": vendor_name,
                    "risk_score": risk_score,
                    "compliance_score": compliance_score
                }
            else:
                cached = entity_cache[cache_key]
                entity_name = cached["name"]
                vendor_id = cached["vendor_id"]
                vendor_name = cached["vendor_name"]
                risk_score = cached["risk_score"]
                compliance_score = cached["compliance_score"]
            
            # Get assessment name
            assessment_name = "Unknown Assessment"
            if assignment.assessment:
                assessment_name = assignment.assessment.name
            
            qualifications.append(QualificationItem(
                id=str(assignment.id),
                entity_type=entity_type_val,
                entity_id=str(entity_id_val),
                entity_name=entity_name,
                assessment_id=str(assignment.assessment_id),
                assessment_name=assessment_name,
                status=assignment.status,
                assigned_at=assignment.assigned_at.isoformat() if assignment.assigned_at else datetime.utcnow().isoformat(),
                due_date=assignment.due_date.isoformat() if assignment.due_date else None,
                completed_at=assignment.completed_at.isoformat() if assignment.completed_at else None,
                vendor_id=vendor_id,
                vendor_name=vendor_name,
                risk_score=risk_score,
                compliance_score=compliance_score
            ))
        
        # Get summary statistics
        all_assignments = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.tenant_id == effective_tenant_id
        ).all()
        
        summary = {
            "total": len(all_assignments),
            "by_status": {},
            "by_entity_type": {},
            "pending": len([a for a in all_assignments if a.status == "pending"]),
            "in_progress": len([a for a in all_assignments if a.status == "in_progress"]),
            "completed": len([a for a in all_assignments if a.status == "completed"]),
            "overdue": len([a for a in all_assignments if a.status == "overdue"])
        }
        
        for assignment in all_assignments:
            # Count by status
            status_val = assignment.status
            summary["by_status"][status_val] = summary["by_status"].get(status_val, 0) + 1
            
            # Count by entity type
            entity_type_val = assignment.entity_type or (assignment.agent_id and "agent") or (assignment.vendor_id and "vendor")
            if entity_type_val:
                summary["by_entity_type"][entity_type_val] = summary["by_entity_type"].get(entity_type_val, 0) + 1
        
        return QualificationListResponse(
            qualifications=qualifications,
            total=total,
            page=page,
            limit=limit,
            summary=summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing qualifications: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list qualifications"
        )
