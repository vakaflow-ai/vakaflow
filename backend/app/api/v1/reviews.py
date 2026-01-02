"""
Review workflow API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.user import User, UserRole
from app.models.review import Review, ReviewStage, ReviewStatus
from app.api.v1.auth import get_current_user
from app.services.rag_service import rag_service
from datetime import datetime

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    """Review creation schema"""
    agent_id: UUID
    stage: str = Field(..., pattern="^(security|compliance|technical|business)$")
    comment: Optional[str] = None
    status: str = Field(..., pattern="^(approved|rejected|needs_revision)$")
    findings: Optional[List[str]] = None


class ReviewResponse(BaseModel):
    """Review response schema"""
    id: str
    agent_id: str
    reviewer_id: str
    reviewer_name: Optional[str] = None
    reviewer_email: Optional[str] = None
    reviewer_role: Optional[str] = None
    stage: str
    comment: Optional[str]
    status: str
    findings: Optional[List[str]]
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ReviewListResponse(BaseModel):
    """Review list response schema"""
    reviews: List[ReviewResponse]
    total: int
    page: int
    limit: int


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a review for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == review_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Tenant isolation: Check if agent belongs to user's tenant
    if current_user.role.value != "platform_admin":
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
        if vendor and current_user.tenant_id:
            if vendor.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Agent does not belong to your tenant."
                )
    
    # Check reviewer permissions
    allowed_roles = {
        "security": ["security_reviewer", "tenant_admin"],
        "compliance": ["compliance_reviewer", "tenant_admin"],
        "technical": ["technical_reviewer", "tenant_admin"],
        "business": ["business_reviewer", "tenant_admin"],
    }
    
    if current_user.role.value not in allowed_roles.get(review_data.stage, []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User role '{current_user.role.value}' not authorized for {review_data.stage} review"
        )
    
    # Create review record
    review = Review(
        agent_id=agent.id,
        reviewer_id=current_user.id,
        stage=review_data.stage,
        status=review_data.status,
        comment=review_data.comment,
        findings=review_data.findings or [],
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow() if review_data.status in ["approved", "rejected"] else None
    )
    
    db.add(review)
    
    # Update agent status based on review
    if review_data.status == "approved":
        # Move to next stage
        if agent.status == AgentStatus.SUBMITTED.value:
            agent.status = AgentStatus.IN_REVIEW.value
        
        # Check if all required reviews are complete
        required_stages = ["security", "compliance", "technical", "business"]
        approved_reviews = db.query(Review).filter(
            Review.agent_id == agent.id,
            Review.status == "approved"
        ).all()
        
        completed_stages = {r.stage for r in approved_reviews}
        if completed_stages == set(required_stages):
            # All reviews complete, but don't auto-approve - wait for approver
            # Agent stays in IN_REVIEW status until approver approves
            pass
    elif review_data.status == "rejected":
        agent.status = AgentStatus.REJECTED.value
        agent.rejection_date = datetime.utcnow()
        agent.rejection_reason = review_data.comment
    elif review_data.status == "needs_revision":
        # Move back to draft for vendor to fix
        agent.status = AgentStatus.DRAFT.value
    
    db.commit()
    db.refresh(review)
    db.refresh(agent)
    
    # Update ticket stage if ticket exists
    from app.services.ticket_service import TicketService
    from app.models.ticket import TicketStage, TicketStatus
    try:
        ticket = TicketService.get_ticket_by_agent(db, agent.id)
        if ticket:
            # Map review stage to ticket stage
            stage_mapping = {
                "security": TicketStage.SECURITY_REVIEW,
                "compliance": TicketStage.COMPLIANCE_REVIEW,
                "technical": TicketStage.TECHNICAL_REVIEW,
                "business": TicketStage.BUSINESS_REVIEW
            }
            
            if review_data.stage in stage_mapping:
                new_stage = stage_mapping[review_data.stage]
                TicketService.update_ticket_stage(
                    db=db,
                    ticket_id=ticket.id,
                    new_stage=new_stage,
                    user_id=current_user.id,
                    status="completed" if review_data.status == "approved" else review_data.status
                )
            
            # Update ticket status based on review result
            if review_data.status == "approved":
                # Check if all reviews are done
                required_stages = ["security", "compliance", "technical", "business"]
                approved_reviews = db.query(Review).filter(
                    Review.agent_id == agent.id,
                    Review.status == "approved"
                ).all()
                completed_stages = {r.stage for r in approved_reviews}
                
                if completed_stages == set(required_stages):
                    # All reviews complete, move to approval stage
                    TicketService.update_ticket_stage(
                        db=db,
                        ticket_id=ticket.id,
                        new_stage=TicketStage.APPROVAL,
                        user_id=current_user.id,
                        status="pending"
                    )
                    TicketService.update_ticket_status(
                        db=db,
                        ticket_id=ticket.id,
                        new_status=TicketStatus.PENDING_APPROVAL,
                        user_id=current_user.id
                    )
            elif review_data.status == "rejected":
                TicketService.update_ticket_status(
                    db=db,
                    ticket_id=ticket.id,
                    new_status=TicketStatus.REJECTED,
                    user_id=current_user.id
                )
    except Exception as e:
        # Log error but don't fail the review
        import logging
        logging.error(f"Failed to update ticket for agent {agent.id}: {str(e)}")
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.REVIEW,
        resource_type="review",
        resource_id=str(review.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "agent_id": str(agent.id),
            "stage": review.stage,
            "status": review.status
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ReviewResponse(
        id=str(review.id),
        agent_id=str(agent.id),
        reviewer_id=str(current_user.id),
        reviewer_name=current_user.name,
        reviewer_email=current_user.email,
        reviewer_role=current_user.role.value if current_user.role else None,
        stage=review.stage,
        comment=review.comment,
        status=review.status,
        findings=review.findings or [],
        created_at=review.created_at,
        completed_at=review.completed_at
    )


@router.get("/agents/{agent_id}", response_model=ReviewListResponse)
async def get_agent_reviews(
    agent_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get reviews for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Permission check: Allow platform admins, reviewers, approvers, tenant admins, and vendor users
    allowed_roles = [
        "platform_admin",
        "tenant_admin",
        "approver",
        "security_reviewer",
        "compliance_reviewer",
        "technical_reviewer",
        "business_reviewer",
        "vendor_user"
    ]
    
    if current_user.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Insufficient permissions to view reviews."
        )
    
    # Tenant isolation: Check if agent belongs to user's tenant
    if current_user.role.value != "platform_admin":
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
        
        if current_user.role.value == "vendor_user":
            # Vendor users can only see reviews for their own agents
            if not vendor or vendor.contact_email != current_user.email:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You can only view reviews for your own agents."
                )
        else:
            # Reviewers, approvers, and tenant admins can view reviews for agents in their tenant
            if vendor and current_user.tenant_id and vendor.tenant_id:
                if vendor.tenant_id != current_user.tenant_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied. Agent does not belong to your tenant."
                    )
            elif vendor and not vendor.tenant_id and current_user.tenant_id:
                # Vendor has no tenant, but user has tenant - deny access
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Agent vendor is not assigned to a tenant."
                )
    
    # Get reviews with reviewer details
    from sqlalchemy.orm import joinedload
    query = db.query(Review).filter(Review.agent_id == agent_id)
    total = query.count()
    reviews = query.order_by(Review.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Load reviewer details for each review
    review_responses = []
    for r in reviews:
        reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
        review_responses.append(
            ReviewResponse(
                id=str(r.id),
                agent_id=str(r.agent_id),
                reviewer_id=str(r.reviewer_id),
                reviewer_name=reviewer.name if reviewer else None,
                reviewer_email=reviewer.email if reviewer else None,
                reviewer_role=reviewer.role.value if reviewer and reviewer.role else None,
                stage=r.stage,
                comment=r.comment,
                status=r.status,
                findings=r.findings or [],
                created_at=r.created_at,
                completed_at=r.completed_at
            )
        )
    
    return ReviewListResponse(
        reviews=review_responses,
        total=total,
        page=page,
        limit=limit
    )


@router.post("/agents/{agent_id}/rag-query")
async def query_agent_knowledge(
    agent_id: UUID,
    query: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Query agent knowledge base using RAG"""
    # Check feature gate: RAG search
    if current_user.tenant_id:
        from app.core.feature_gating import FeatureGate
        if not FeatureGate.is_feature_enabled(db, str(current_user.tenant_id), "rag_search", current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="RAG knowledge search is not available in your plan. Please upgrade."
            )
    
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions (reviewers and admins can query)
    if current_user.role.value not in [
        "security_reviewer", "compliance_reviewer", "technical_reviewer",
        "business_reviewer", "tenant_admin", "platform_admin"
    ]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    try:
        results = await rag_service.search(
            query=query,
            agent_id=str(agent_id),
            limit=limit
        )
        
        return {
            "query": query,
            "agent_id": str(agent_id),
            "results": results,
            "total": len(results)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG query failed: {str(e)}"
        )

