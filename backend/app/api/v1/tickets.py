"""
Ticket tracking API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.ticket import Ticket, TicketActivity, TicketStatus, TicketStage
from app.models.agent import Agent
from app.api.v1.auth import get_current_user
from app.services.ticket_service import TicketService

router = APIRouter(prefix="/tickets", tags=["tickets"])


class TicketResponse(BaseModel):
    """Ticket response schema"""
    id: str
    ticket_number: str
    agent_id: str
    title: str
    description: Optional[str]
    status: str
    current_stage: str
    submitted_by: str
    submitted_by_name: Optional[str]
    submitted_by_email: Optional[str]
    assigned_to: Optional[str]
    assigned_to_name: Optional[str]
    assigned_to_email: Optional[str]
    approved_by: Optional[str]
    approved_by_name: Optional[str]
    stage_progress: Optional[dict]
    submitted_at: str
    last_updated_at: str
    completed_at: Optional[str]
    agent_name: Optional[str]
    agent_status: Optional[str]
    
    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    """Ticket list response with pagination"""
    tickets: List[TicketResponse]
    total: int
    page: int
    limit: int


class TicketActivityResponse(BaseModel):
    """Ticket activity response schema"""
    id: str
    activity_type: str
    description: Optional[str]
    user_id: str
    user_name: Optional[str]
    user_email: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


@router.get("", response_model=TicketListResponse)
async def list_tickets(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List tickets"""
    try:
        query = db.query(Ticket)
        
        # Tenant isolation - ALL users (including platform_admin) must filter by tenant
        # Platform admins without tenant_id use the default platform admin tenant
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to access tickets"
            )
        query = query.filter(Ticket.tenant_id == effective_tenant_id)
        
        # Filter by status
        if status_filter:
            query = query.filter(Ticket.status == status_filter)
        
        # Filter by user role
        if current_user.role.value == "vendor_user":
            query = query.filter(Ticket.submitted_by == current_user.id)
        elif current_user.role.value in ["security_reviewer", "compliance_reviewer", "technical_reviewer", "business_reviewer"]:
            # Reviewers see tickets assigned to them or in their stage
            query = query.filter(
                (Ticket.assigned_to == current_user.id) |
                (Ticket.assigned_to.is_(None))
            )
        
        total = query.count()
        tickets = query.order_by(Ticket.submitted_at.desc()).offset((page - 1) * limit).limit(limit).all()
        
        # Build response with user details
        result = []
        for ticket in tickets:
            # Get submitter
            submitter = db.query(User).filter(User.id == ticket.submitted_by).first()
            
            # Get assignee
            assignee = None
            if ticket.assigned_to:
                assignee = db.query(User).filter(User.id == ticket.assigned_to).first()
            
            # Get approver
            approver = None
            if ticket.approved_by:
                approver = db.query(User).filter(User.id == ticket.approved_by).first()
            
            # Get agent
            agent = db.query(Agent).filter(Agent.id == ticket.agent_id).first()
            
            result.append(TicketResponse(
                id=str(ticket.id),
                ticket_number=ticket.ticket_number,
                agent_id=str(ticket.agent_id),
                title=ticket.title,
                description=ticket.description,
                status=ticket.status,
                current_stage=ticket.current_stage,
                submitted_by=str(ticket.submitted_by),
                submitted_by_name=submitter.name if submitter else None,
                submitted_by_email=submitter.email if submitter else None,
                assigned_to=str(ticket.assigned_to) if ticket.assigned_to else None,
                assigned_to_name=assignee.name if assignee else None,
                assigned_to_email=assignee.email if assignee else None,
                approved_by=str(ticket.approved_by) if ticket.approved_by else None,
                approved_by_name=approver.name if approver else None,
                stage_progress=ticket.stage_progress,
                submitted_at=ticket.submitted_at.isoformat() if ticket.submitted_at else datetime.utcnow().isoformat(),
                last_updated_at=ticket.last_updated_at.isoformat() if ticket.last_updated_at else datetime.utcnow().isoformat(),
                completed_at=ticket.completed_at.isoformat() if ticket.completed_at else None,
                agent_name=agent.name if agent else None,
                agent_status=agent.status if agent else None
            ))
        
        return TicketListResponse(
            tickets=result,
            total=total,
            page=page,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list tickets: {str(e)}"
        )


@router.post("/sync", response_model=Dict[str, Any])
async def sync_tickets_with_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sync ticket status with agent approval status (cleanup stale data)"""
    from app.models.agent import Agent, AgentStatus
    from app.models.ticket import Ticket, TicketStage, TicketStatus
    from app.models.workflow_config import OnboardingRequest
    
    try:
        # Tenant isolation - ALL users (including platform_admin) must filter by tenant
        # Platform admins without tenant_id use the default platform admin tenant
        from app.core.tenant_utils import get_effective_tenant_id
        effective_tenant_id = get_effective_tenant_id(current_user, db)
        if not effective_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a tenant to sync tickets"
            )
        query = db.query(Ticket).filter(Ticket.tenant_id == effective_tenant_id)
        
        tickets = query.all()
        synced_count = 0
        errors = []
        
        for ticket in tickets:
            try:
                # Get agent
                agent = db.query(Agent).filter(Agent.id == ticket.agent_id).first()
                if not agent:
                    continue
                
                # Get onboarding request
                onboarding_request = db.query(OnboardingRequest).filter(
                    OnboardingRequest.agent_id == ticket.agent_id
                ).first()
                
                # If agent is approved but ticket is not, sync it
                if agent.status == AgentStatus.APPROVED.value:
                    if ticket.status != TicketStatus.APPROVED.value or ticket.current_stage != TicketStage.COMPLETED.value:
                        TicketService.update_ticket_stage(
                            db=db,
                            ticket_id=ticket.id,
                            new_stage=TicketStage.COMPLETED,
                            user_id=current_user.id,
                            status="completed"
                        )
                        TicketService.update_ticket_status(
                            db=db,
                            ticket_id=ticket.id,
                            new_status=TicketStatus.APPROVED,
                            user_id=current_user.id
                        )
                        synced_count += 1
                # If onboarding request is approved but ticket is not, sync it
                elif onboarding_request and onboarding_request.status == "approved":
                    if ticket.status != TicketStatus.APPROVED.value or ticket.current_stage != TicketStage.COMPLETED.value:
                        TicketService.update_ticket_stage(
                            db=db,
                            ticket_id=ticket.id,
                            new_stage=TicketStage.COMPLETED,
                            user_id=current_user.id,
                            status="completed"
                        )
                        TicketService.update_ticket_status(
                            db=db,
                            ticket_id=ticket.id,
                            new_status=TicketStatus.APPROVED,
                            user_id=current_user.id
                        )
                        synced_count += 1
            except Exception as e:
                errors.append(f"Failed to sync ticket {ticket.ticket_number}: {str(e)}")
        
        db.commit()
        
        return {
            "synced_count": synced_count,
            "total_tickets": len(tickets),
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync tickets: {str(e)}"
        )


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ticket details"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access tickets"
        )
    if ticket.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get related users
    submitter = db.query(User).filter(User.id == ticket.submitted_by).first()
    assignee = None
    if ticket.assigned_to:
        assignee = db.query(User).filter(User.id == ticket.assigned_to).first()
    approver = None
    if ticket.approved_by:
        approver = db.query(User).filter(User.id == ticket.approved_by).first()
    
    # Get agent
    agent = db.query(Agent).filter(Agent.id == ticket.agent_id).first()
    
    return TicketResponse(
        id=str(ticket.id),
        ticket_number=ticket.ticket_number,
        agent_id=str(ticket.agent_id),
        title=ticket.title,
        description=ticket.description,
        status=ticket.status,
        current_stage=ticket.current_stage,
        submitted_by=str(ticket.submitted_by),
        submitted_by_name=submitter.name if submitter else None,
        submitted_by_email=submitter.email if submitter else None,
        assigned_to=str(ticket.assigned_to) if ticket.assigned_to else None,
        assigned_to_name=assignee.name if assignee else None,
        assigned_to_email=assignee.email if assignee else None,
        approved_by=str(ticket.approved_by) if ticket.approved_by else None,
        approved_by_name=approver.name if approver else None,
        stage_progress=ticket.stage_progress,
        submitted_at=ticket.submitted_at.isoformat() if ticket.submitted_at else datetime.utcnow().isoformat(),
        last_updated_at=ticket.last_updated_at.isoformat() if ticket.last_updated_at else datetime.utcnow().isoformat(),
        completed_at=ticket.completed_at.isoformat() if ticket.completed_at else None,
        agent_name=agent.name if agent else None,
        agent_status=agent.status if agent else None
    )


@router.get("/agent/{agent_id}", response_model=TicketResponse)
async def get_ticket_by_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ticket for an agent"""
    ticket = TicketService.get_ticket_by_agent(db, agent_id)
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found for this agent"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access tickets"
        )
    if ticket.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get related users
    submitter = db.query(User).filter(User.id == ticket.submitted_by).first()
    assignee = None
    if ticket.assigned_to:
        assignee = db.query(User).filter(User.id == ticket.assigned_to).first()
    approver = None
    if ticket.approved_by:
        approver = db.query(User).filter(User.id == ticket.approved_by).first()
    
    # Get agent
    agent = db.query(Agent).filter(Agent.id == ticket.agent_id).first()
    
    return TicketResponse(
        id=str(ticket.id),
        ticket_number=ticket.ticket_number,
        agent_id=str(ticket.agent_id),
        title=ticket.title,
        description=ticket.description,
        status=ticket.status,
        current_stage=ticket.current_stage,
        submitted_by=str(ticket.submitted_by),
        submitted_by_name=submitter.name if submitter else None,
        submitted_by_email=submitter.email if submitter else None,
        assigned_to=str(ticket.assigned_to) if ticket.assigned_to else None,
        assigned_to_name=assignee.name if assignee else None,
        assigned_to_email=assignee.email if assignee else None,
        approved_by=str(ticket.approved_by) if ticket.approved_by else None,
        approved_by_name=approver.name if approver else None,
        stage_progress=ticket.stage_progress,
        submitted_at=ticket.submitted_at.isoformat() if ticket.submitted_at else datetime.utcnow().isoformat(),
        last_updated_at=ticket.last_updated_at.isoformat() if ticket.last_updated_at else datetime.utcnow().isoformat(),
        completed_at=ticket.completed_at.isoformat() if ticket.completed_at else None,
        agent_name=agent.name if agent else None,
        agent_status=agent.status if agent else None
    )


@router.get("/{ticket_id}/activities", response_model=List[TicketActivityResponse])
async def get_ticket_activities(
    ticket_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ticket activity log"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must be in same tenant
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to access tickets"
        )
    if ticket.tenant_id != effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    activities = db.query(TicketActivity).filter(
        TicketActivity.ticket_id == ticket_id
    ).order_by(TicketActivity.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    result = []
    for activity in activities:
        user = db.query(User).filter(User.id == activity.user_id).first()
        result.append(TicketActivityResponse(
            id=str(activity.id),
            activity_type=activity.activity_type,
            description=activity.description,
            user_id=str(activity.user_id),
            user_name=user.name if user else None,
            user_email=user.email if user else None,
            old_value=activity.old_value,
            new_value=activity.new_value,
            created_at=activity.created_at.isoformat() if activity.created_at else datetime.utcnow().isoformat()
        ))
    
    return result

