"""
Offboarding API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.user import User
from app.models.offboarding import OffboardingRequest, OffboardingStatus, OffboardingReason, KnowledgeExtraction
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction
from app.services.rag_service import rag_service

router = APIRouter(prefix="/offboarding", tags=["offboarding"])


class OffboardingRequestCreate(BaseModel):
    """Offboarding request creation schema"""
    agent_id: UUID
    reason: str = Field(..., pattern="^(contract_end|security_incident|replacement|deprecated|other)$")
    reason_details: Optional[str] = None
    target_date: Optional[date] = None
    replacement_agent_id: Optional[UUID] = None


class KnowledgeExtractionResponse(BaseModel):
    """Knowledge extraction response schema"""
    id: str
    extraction_type: str
    content: str
    metadata: Optional[dict] = None
    source_type: Optional[str] = None
    extracted_at: str
    
    class Config:
        from_attributes = True


class OffboardingRequestResponse(BaseModel):
    """Offboarding request response schema"""
    id: str
    agent_id: str
    requested_by: str
    reason: str
    reason_details: Optional[str]
    target_date: Optional[str]
    replacement_agent_id: Optional[str]
    status: str
    impact_analysis: Optional[dict] = None
    dependency_mapping: Optional[dict] = None
    knowledge_extracted: Optional[dict] = None
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
    knowledge_extractions: List[KnowledgeExtractionResponse] = []
    
    class Config:
        from_attributes = True


class OffboardingListResponse(BaseModel):
    """Offboarding list response with pagination"""
    requests: List[OffboardingRequestResponse]
    total: int
    page: int
    limit: int


@router.post("/requests", response_model=OffboardingRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_offboarding_request(
    request_data: OffboardingRequestCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an offboarding request"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == request_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions (vendor can request for their agents, admin can request for any)
    if current_user.role.value == "vendor_user":
        # Check if agent belongs to vendor's tenant
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
        if vendor and vendor.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Check if agent is already being offboarded
    existing = db.query(OffboardingRequest).filter(
        OffboardingRequest.agent_id == request_data.agent_id,
        OffboardingRequest.status.in_([OffboardingStatus.INITIATED.value, OffboardingStatus.IN_PROGRESS.value])
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent is already being offboarded"
        )
    
    # Create offboarding request
    offboarding_request = OffboardingRequest(
        agent_id=request_data.agent_id,
        tenant_id=current_user.tenant_id,
        requested_by=current_user.id,
        reason=request_data.reason,
        reason_details=request_data.reason_details,
        target_date=request_data.target_date,
        replacement_agent_id=request_data.replacement_agent_id,
        status=OffboardingStatus.INITIATED.value
    )
    
    db.add(offboarding_request)
    db.commit()
    db.refresh(offboarding_request)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="offboarding_request",
        resource_id=str(offboarding_request.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "agent_id": str(request_data.agent_id),
            "reason": request_data.reason
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return OffboardingRequestResponse(
        id=str(offboarding_request.id),
        agent_id=str(offboarding_request.agent_id),
        requested_by=str(offboarding_request.requested_by),
        reason=offboarding_request.reason,
        reason_details=offboarding_request.reason_details,
        target_date=offboarding_request.target_date.isoformat() if offboarding_request.target_date else None,
        replacement_agent_id=str(offboarding_request.replacement_agent_id) if offboarding_request.replacement_agent_id else None,
        status=offboarding_request.status,
        impact_analysis=offboarding_request.impact_analysis,
        dependency_mapping=offboarding_request.dependency_mapping,
        knowledge_extracted=offboarding_request.knowledge_extracted,
        created_at=offboarding_request.created_at.isoformat(),
        updated_at=offboarding_request.updated_at.isoformat(),
        completed_at=offboarding_request.completed_at.isoformat() if offboarding_request.completed_at else None,
        knowledge_extractions=[]
    )


@router.post("/requests/{request_id}/analyze")
async def analyze_offboarding_impact(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run impact analysis for offboarding request"""
    offboarding_request = db.query(OffboardingRequest).filter(
        OffboardingRequest.id == request_id
    ).first()
    
    if not offboarding_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offboarding request not found"
        )
    
    # Get agent
    agent = db.query(Agent).filter(Agent.id == offboarding_request.agent_id).first()
    
    # Perform impact analysis (simplified - can be enhanced with RAG)
    impact_analysis = {
        "affected_systems": [],
        "dependencies": [],
        "users_affected": 0,
        "risk_level": "medium",
        "estimated_effort": "medium"
    }
    
    # Update request
    offboarding_request.impact_analysis = impact_analysis
    offboarding_request.status = OffboardingStatus.IN_PROGRESS.value
    db.commit()
    
    return {"impact_analysis": impact_analysis}


@router.post("/requests/{request_id}/extract-knowledge")
async def extract_knowledge(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Extract knowledge from agent using RAG"""
    offboarding_request = db.query(OffboardingRequest).filter(
        OffboardingRequest.id == request_id
    ).first()
    
    if not offboarding_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offboarding request not found"
        )
    
    # Extract knowledge using RAG
    try:
        # Query knowledge base for agent information
        results = await rag_service.search(
            query=f"agent {offboarding_request.agent_id} documentation integration operational knowledge",
            agent_id=str(offboarding_request.agent_id),
            limit=20
        )
        
        # Create knowledge extractions
        extractions = []
        for result in results:
            extraction = KnowledgeExtraction(
                offboarding_request_id=offboarding_request.id,
                agent_id=offboarding_request.agent_id,
                extraction_type="documentation",
                content=result.get("content", ""),
                extraction_metadata=result.get("metadata", {}),
                rag_context=result
            )
            db.add(extraction)
            extractions.append(extraction)
        
        db.commit()
        
        # Update request
        offboarding_request.knowledge_extracted = {
            "extraction_count": len(extractions),
            "extracted_at": datetime.utcnow().isoformat()
        }
        db.commit()
        
        return {
            "extractions_created": len(extractions),
            "knowledge_extracted": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Knowledge extraction failed: {str(e)}"
        )


class OffboardingListResponse(BaseModel):
    """Offboarding list response with pagination"""
    requests: List[OffboardingRequestResponse]
    total: int
    page: int
    limit: int


@router.get("/requests", response_model=OffboardingListResponse)
async def list_offboarding_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List offboarding requests"""
    try:
        query = db.query(OffboardingRequest)
        
        # Filter by tenant
        if current_user.tenant_id:
            query = query.filter(OffboardingRequest.tenant_id == current_user.tenant_id)
        
        # Filter by status
        if status_filter:
            query = query.filter(OffboardingRequest.status == status_filter)
        
        # Filter by user (vendors see their own, admins see all)
        if current_user.role.value == "vendor_user":
            query = query.filter(OffboardingRequest.requested_by == current_user.id)
        
        total = query.count()
        requests = query.order_by(OffboardingRequest.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        
        # Optimize: Get all knowledge extractions in one query (avoid N+1)
        request_ids = [req.id for req in requests]
        all_extractions = {}
        if request_ids:
            extractions = db.query(KnowledgeExtraction).filter(
                KnowledgeExtraction.offboarding_request_id.in_(request_ids)
            ).all()
            # Group by request_id
            for ext in extractions:
                if ext.offboarding_request_id not in all_extractions:
                    all_extractions[ext.offboarding_request_id] = []
                all_extractions[ext.offboarding_request_id].append(ext)
        
        # Build response
        result = []
        for req in requests:
            extractions = all_extractions.get(req.id, [])
            
            result.append(OffboardingRequestResponse(
                id=str(req.id),
                agent_id=str(req.agent_id),
                requested_by=str(req.requested_by),
                reason=req.reason,
                reason_details=req.reason_details,
                target_date=req.target_date.isoformat() if req.target_date else None,
                replacement_agent_id=str(req.replacement_agent_id) if req.replacement_agent_id else None,
                status=req.status,
                impact_analysis=req.impact_analysis,
                dependency_mapping=req.dependency_mapping,
                knowledge_extracted=req.knowledge_extracted,
                created_at=req.created_at.isoformat() if req.created_at else datetime.utcnow().isoformat(),
                updated_at=req.updated_at.isoformat() if req.updated_at else datetime.utcnow().isoformat(),
                completed_at=req.completed_at.isoformat() if req.completed_at else None,
                knowledge_extractions=[
                    KnowledgeExtractionResponse(
                        id=str(e.id),
                        extraction_type=e.extraction_type,
                        content=e.content,
                        metadata=e.extraction_metadata,
                        source_type=e.source_type,
                        extracted_at=e.extracted_at.isoformat() if e.extracted_at else datetime.utcnow().isoformat()
                    )
                    for e in extractions
                ]
            ))
        
        return OffboardingListResponse(
            requests=result,
            total=total,
            page=page,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list offboarding requests: {str(e)}"
        )


@router.get("/requests/{request_id}", response_model=OffboardingRequestResponse)
async def get_offboarding_request(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get offboarding request details"""
    request = db.query(OffboardingRequest).filter(
        OffboardingRequest.id == request_id
    ).first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offboarding request not found"
        )
    
    # Check permissions
    if current_user.tenant_id and request.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get knowledge extractions
    extractions = db.query(KnowledgeExtraction).filter(
        KnowledgeExtraction.offboarding_request_id == request.id
    ).all()
    
    return OffboardingRequestResponse(
        id=str(request.id),
        agent_id=str(request.agent_id),
        requested_by=str(request.requested_by),
        reason=request.reason,
        reason_details=request.reason_details,
        target_date=request.target_date.isoformat() if request.target_date else None,
        replacement_agent_id=str(request.replacement_agent_id) if request.replacement_agent_id else None,
        status=request.status,
        impact_analysis=request.impact_analysis,
        dependency_mapping=request.dependency_mapping,
        knowledge_extracted=request.knowledge_extracted,
        created_at=request.created_at.isoformat(),
        updated_at=request.updated_at.isoformat(),
        completed_at=request.completed_at.isoformat() if request.completed_at else None,
        knowledge_extractions=[
            KnowledgeExtractionResponse(
                id=str(e.id),
                extraction_type=e.extraction_type,
                content=e.content,
                metadata=e.extraction_metadata,
                source_type=e.source_type,
                extracted_at=e.extracted_at.isoformat()
            )
            for e in extractions
        ]
    )


@router.post("/requests/{request_id}/complete")
async def complete_offboarding(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete offboarding request"""
    # Check permissions (admin only)
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can complete offboarding"
        )
    
    request = db.query(OffboardingRequest).filter(
        OffboardingRequest.id == request_id
    ).first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offboarding request not found"
        )
    
    # Update agent status
    agent = db.query(Agent).filter(Agent.id == request.agent_id).first()
    if agent:
        agent.status = AgentStatus.OFFBOARDED.value
    
    # Update request
    request.status = OffboardingStatus.COMPLETED.value
    request.completed_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.UPDATE,
        resource_type="offboarding_request",
        resource_id=str(request_id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"status": "completed", "agent_id": str(request.agent_id)}
    )
    
    return {"status": "completed", "completed_at": request.completed_at.isoformat()}

