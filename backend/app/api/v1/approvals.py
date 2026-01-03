"""
Approval workflow API endpoints
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
from app.models.review import Review
from app.models.approval import ApprovalInstance, ApprovalStatus, ApprovalStep
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/approvals", tags=["approvals"])


class ApprovalRequest(BaseModel):
    """Approval request schema"""
    agent_id: UUID
    notes: Optional[str] = None


class UserInfo(BaseModel):
    """User information schema"""
    id: str
    name: str
    email: str
    role: str


class ApprovalResponse(BaseModel):
    """Approval response schema"""
    id: str
    agent_id: str
    status: str
    current_step: int
    approved_by: Optional[str]
    approved_by_user: Optional[UserInfo] = None
    approval_notes: Optional[str]
    started_at: str
    completed_at: Optional[str]
    current_assignee: Optional[UserInfo] = None
    steps: List['ApprovalStepResponse'] = []
    
    class Config:
        from_attributes = True


class ApprovalStepResponse(BaseModel):
    """Approval step response schema"""
    id: str
    step_number: int
    step_type: str
    step_name: Optional[str]
    assigned_to: Optional[str]
    assigned_to_user: Optional[UserInfo] = None
    assigned_role: Optional[str]
    status: str
    completed_by: Optional[str]
    completed_by_user: Optional[UserInfo] = None
    completed_at: Optional[str]
    notes: Optional[str]
    
    class Config:
        from_attributes = True


ApprovalResponse.model_rebuild()


class ApproveRequest(BaseModel):
    """Approve request schema"""
    notes: Optional[str] = None


@router.post("/agents/{agent_id}/approve", response_model=ApprovalResponse)
async def approve_agent(
    agent_id: UUID,
    approve_data: ApproveRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve an agent (requires approver role)"""
    # Check permissions
    if current_user.role.value not in ["approver", "tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers can approve agents"
        )
    
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check if this is a workflow-based approval (has onboarding request)
    from app.models.workflow_config import OnboardingRequest, WorkflowConfiguration
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent_id,
        OnboardingRequest.status.in_(["pending", "in_review"])
    ).first()
    
    # If workflow-based, use workflow approval logic
    if onboarding_request:
        # Check if current step is an approval step and user is assigned
        if onboarding_request.workflow_config_id and onboarding_request.current_step:
            workflow_config = db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.id == onboarding_request.workflow_config_id
            ).first()
            
            if workflow_config and workflow_config.workflow_steps:
                import json
                steps = workflow_config.workflow_steps
                if isinstance(steps, str):
                    try:
                        steps = json.loads(steps)
                    except json.JSONDecodeError:
                        steps = []
                
                if isinstance(steps, list):
                    current_step_data = next(
                        (s for s in steps if s.get("step_number") == onboarding_request.current_step),
                        None
                    )
                    
                    if current_step_data:
                        step_type = current_step_data.get("step_type", "")
                        # Only allow approval if current step is an approval step
                        if step_type != "approval":
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Current workflow step ({current_step_data.get('step_name', 'Unknown')}) is not an approval step. Current step type: {step_type}"
                            )
                        
                        # Check if user is assigned to this step
                        is_assigned = (
                            onboarding_request.assigned_to == current_user.id or
                            current_step_data.get("assigned_user_id") == str(current_user.id) or
                            current_step_data.get("assigned_role") == current_user.role.value or
                            current_user.role.value in ["tenant_admin", "platform_admin"]
                        )
                        
                        if not is_assigned:
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="You are not assigned to approve this workflow step"
                            )
        
        # Step-by-step workflow approval logic
        # Find the next step after the current one
        sorted_steps = sorted(steps, key=lambda x: x.get("step_number", 999))
        next_step = None
        
        # Find the next step after current_step
        for step in sorted_steps:
            if step.get("step_number", 0) > onboarding_request.current_step:
                next_step = step
                break
        
        # If there's a next step, advance to it
        if next_step:
            next_step_number = next_step.get("step_number")
            onboarding_request.current_step = next_step_number
            onboarding_request.status = "in_review"
            
            # Auto-assign next step if configured
            if next_step.get("auto_assign", False):
                assigned_role = next_step.get("assigned_role")
                if assigned_role:
                    from app.models.user import UserRole
                    role_mapping = {
                        "security_reviewer": UserRole.SECURITY_REVIEWER,
                        "compliance_reviewer": UserRole.COMPLIANCE_REVIEWER,
                        "technical_reviewer": UserRole.TECHNICAL_REVIEWER,
                        "business_reviewer": UserRole.BUSINESS_REVIEWER,
                        "approver": UserRole.APPROVER,
                        "tenant_admin": UserRole.TENANT_ADMIN,
                    }
                    role_enum = role_mapping.get(assigned_role)
                    if role_enum:
                        assignee = db.query(User).filter(
                            User.tenant_id == current_user.tenant_id,
                            User.role == role_enum,
                            User.is_active.is_(True)
                        ).first()
                        if assignee:
                            onboarding_request.assigned_to = assignee.id
            
            # Keep status as "in_review" since there are more steps
            onboarding_request.approval_notes = approve_data.notes
        else:
            # This was the last step, approve the entire request
            onboarding_request.status = "approved"
            onboarding_request.approved_by = current_user.id
            onboarding_request.approved_at = datetime.utcnow()
            onboarding_request.approval_notes = approve_data.notes
            
            # Update agent status only when all steps are complete
            agent.status = AgentStatus.APPROVED.value
            agent.approval_date = datetime.utcnow()
        
        db.commit()
        db.refresh(onboarding_request)
        
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=str(current_user.id),
            action=AuditAction.WORKFLOW_APPROVED,
            resource_type="onboarding_request",
            resource_id=str(onboarding_request.id),
            tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
            details={
                "agent_id": str(agent_id),
                "step_number": onboarding_request.current_step,
                "step_name": current_step_data.get("step_name") if current_step_data else None,
                "is_final_step": next_step is None,
                "notes": approve_data.notes
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        # Return success response (workflow-based approval)
        return ApprovalResponse(
            id=str(onboarding_request.id),
            agent_id=str(agent_id),
            status=onboarding_request.status,
            current_step=onboarding_request.current_step or 0,
            approved_by=str(current_user.id) if onboarding_request.approved_by else None,
            approval_notes=approve_data.notes,
            started_at=onboarding_request.created_at.isoformat(),
            completed_at=onboarding_request.approved_at.isoformat() if onboarding_request.approved_at else None,
            steps=[]
        )
    
    # Legacy approval logic (requires all review stages)
    # Check if agent has completed all required reviews
    required_stages = ["security", "compliance", "technical", "business"]
    reviews = db.query(Review).filter(
        Review.agent_id == agent_id,
        Review.status == "approved"
    ).all()
    
    completed_stages = {r.stage for r in reviews}
    missing_stages = set(required_stages) - completed_stages
    
    if missing_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent must complete all review stages. Missing: {', '.join(missing_stages)}"
        )
    
    # Check if agent is in correct status
    if agent.status not in [AgentStatus.IN_REVIEW.value, AgentStatus.SUBMITTED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent status '{agent.status}' is not eligible for approval"
        )
    
    # Get or create approval instance
    approval = db.query(ApprovalInstance).filter(
        ApprovalInstance.agent_id == agent_id
    ).first()
    
    if not approval:
        approval = ApprovalInstance(
            agent_id=agent_id,
            status=ApprovalStatus.IN_PROGRESS.value,
            started_at=datetime.utcnow()
        )
        db.add(approval)
    
    # Approve agent
    approval.status = ApprovalStatus.APPROVED.value
    approval.approved_by = current_user.id
    approval.approval_notes = approve_data.notes
    approval.completed_at = datetime.utcnow()
    
    # Update agent status
    agent.status = AgentStatus.APPROVED.value
    agent.approval_date = datetime.utcnow()
    
    db.commit()
    db.refresh(approval)
    
    # Update ticket status
    from app.services.ticket_service import TicketService
    from app.models.ticket import TicketStage, TicketStatus
    try:
        ticket = TicketService.get_ticket_by_agent(db, agent_id)
        if ticket:
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
    except Exception as e:
        # Log error but don't fail the approval
        import logging
        logging.error(f"Failed to update ticket for agent {agent_id}: {str(e)}")
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.APPROVE,
        resource_type="agent",
        resource_id=str(agent_id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "approval_id": str(approval.id),
            "notes": approve_data.notes
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Get steps
    steps = db.query(ApprovalStep).filter(
        ApprovalStep.instance_id == approval.id
    ).order_by(ApprovalStep.step_number).all()
    
    # Get user details for approved_by
    approved_by_user = None
    if approval.approved_by:
        approver = db.query(User).filter(User.id == approval.approved_by).first()
        if approver:
            approved_by_user = UserInfo(
                id=str(approver.id),
                name=approver.name,
                email=approver.email,
                role=approver.role.value if hasattr(approver.role, 'value') else str(approver.role)
            )
    
    return ApprovalResponse(
        id=str(approval.id),
        agent_id=str(agent.id),
        status=approval.status,
        current_step=approval.current_step,
        approved_by=str(approval.approved_by) if approval.approved_by else None,
        approved_by_user=approved_by_user,
        approval_notes=approval.approval_notes,
        started_at=approval.started_at.isoformat(),
        completed_at=approval.completed_at.isoformat() if approval.completed_at else None,
        current_assignee=approved_by_user,  # After approval, the approver is the assignee
        steps=[
            ApprovalStepResponse(
                id=str(s.id),
                step_number=s.step_number,
                step_type=s.step_type,
                step_name=s.step_name,
                assigned_to=str(s.assigned_to) if s.assigned_to else None,
                assigned_to_user=UserInfo(
                    id=str(assignee.id),
                    name=assignee.name,
                    email=assignee.email,
                    role=assignee.role.value if hasattr(assignee.role, 'value') else str(assignee.role)
                ) if (s.assigned_to and (assignee := db.query(User).filter(User.id == s.assigned_to).first())) else None,
                assigned_role=s.assigned_role,
                status=s.status,
                completed_by=str(s.completed_by) if s.completed_by else None,
                completed_by_user=UserInfo(
                    id=str(completer.id),
                    name=completer.name,
                    email=completer.email,
                    role=completer.role.value if hasattr(completer.role, 'value') else str(completer.role)
                ) if (s.completed_by and (completer := db.query(User).filter(User.id == s.completed_by).first())) else None,
                completed_at=s.completed_at.isoformat() if s.completed_at else None,
                notes=s.notes
            )
            for s in steps
        ]
    )


class RejectRequest(BaseModel):
    """Reject request schema"""
    notes: str = Field(..., min_length=1)


@router.post("/agents/{agent_id}/reject", response_model=ApprovalResponse)
async def reject_agent(
    agent_id: UUID,
    reject_data: RejectRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject an agent (requires approver role)"""
    # Check permissions
    if current_user.role.value not in ["approver", "tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers can reject agents"
        )
    
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get or create approval instance
    approval = db.query(ApprovalInstance).filter(
        ApprovalInstance.agent_id == agent_id
    ).first()
    
    if not approval:
        approval = ApprovalInstance(
            agent_id=agent_id,
            status=ApprovalStatus.IN_PROGRESS.value,
            started_at=datetime.utcnow()
        )
        db.add(approval)
    
    # Reject agent
    approval.status = ApprovalStatus.REJECTED.value
    approval.approval_notes = reject_data.notes
    approval.completed_at = datetime.utcnow()
    
    # Update agent status
    agent.status = AgentStatus.REJECTED.value
    agent.rejection_date = datetime.utcnow()
    agent.rejection_reason = reject_data.notes
    
    db.commit()
    db.refresh(approval)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.REJECT,
        resource_type="agent",
        resource_id=str(agent_id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={
            "approval_id": str(approval.id),
            "notes": reject_data.notes
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Get steps
    steps = db.query(ApprovalStep).filter(
        ApprovalStep.instance_id == approval.id
    ).order_by(ApprovalStep.step_number).all()
    
    # Get user details for rejected by
    rejected_by_user = UserInfo(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    )
    
    return ApprovalResponse(
        id=str(approval.id),
        agent_id=str(agent.id),
        status=approval.status,
        current_step=approval.current_step,
        approved_by=str(approval.approved_by) if approval.approved_by else None,
        approved_by_user=rejected_by_user,  # The user who rejected
        approval_notes=approval.approval_notes,
        started_at=approval.started_at.isoformat(),
        completed_at=approval.completed_at.isoformat() if approval.completed_at else None,
        current_assignee=rejected_by_user,
        steps=[
            ApprovalStepResponse(
                id=str(s.id),
                step_number=s.step_number,
                step_type=s.step_type,
                step_name=s.step_name,
                assigned_to=str(s.assigned_to) if s.assigned_to else None,
                assigned_to_user=UserInfo(
                    id=str(assignee.id),
                    name=assignee.name,
                    email=assignee.email,
                    role=assignee.role.value if hasattr(assignee.role, 'value') else str(assignee.role)
                ) if (s.assigned_to and (assignee := db.query(User).filter(User.id == s.assigned_to).first())) else None,
                assigned_role=s.assigned_role,
                status=s.status,
                completed_by=str(s.completed_by) if s.completed_by else None,
                completed_by_user=UserInfo(
                    id=str(completer.id),
                    name=completer.name,
                    email=completer.email,
                    role=completer.role.value if hasattr(completer.role, 'value') else str(completer.role)
                ) if (s.completed_by and (completer := db.query(User).filter(User.id == s.completed_by).first())) else None,
                completed_at=s.completed_at.isoformat() if s.completed_at else None,
                notes=s.notes
            )
            for s in steps
        ]
    )


@router.get("/agents/{agent_id}", response_model=ApprovalResponse)
async def get_agent_approval(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get approval status for an agent - checks both OnboardingRequest (workflow-based) and ApprovalInstance (legacy)"""
    # First check for workflow-based onboarding request
    from app.models.workflow_config import OnboardingRequest, WorkflowConfiguration
    onboarding_request = db.query(OnboardingRequest).filter(
        OnboardingRequest.agent_id == agent_id,
        OnboardingRequest.status.in_(["pending", "in_review", "approved", "rejected"])
    ).order_by(OnboardingRequest.created_at.desc()).first()
    
    if onboarding_request:
        # Convert OnboardingRequest to ApprovalResponse format
        # Get workflow config to extract step information
        workflow_config = None
        steps_data = []
        if onboarding_request.workflow_config_id:
            workflow_config = db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.id == onboarding_request.workflow_config_id
            ).first()
            
            if workflow_config and workflow_config.workflow_steps:
                import json
                workflow_steps = workflow_config.workflow_steps
                if isinstance(workflow_steps, str):
                    try:
                        workflow_steps = json.loads(workflow_steps)
                    except json.JSONDecodeError:
                        workflow_steps = []
                
                if isinstance(workflow_steps, list):
                    # Create step responses from workflow steps
                    for step in workflow_steps:
                        step_number = step.get("step_number", 0)
                        step_type = step.get("step_type", "review")
                        step_name = step.get("step_name", "Unknown Step")
                        assigned_role = step.get("assigned_role")
                        
                        # Determine step status based on current_step
                        if step_number < onboarding_request.current_step:
                            step_status = "completed"
                        elif step_number == onboarding_request.current_step:
                            step_status = "in_progress" if onboarding_request.status == "in_review" else "pending"
                        else:
                            step_status = "pending"
                        
                        # Get assigned user if available
                        assigned_to_user = None
                        if onboarding_request.assigned_to and step_number == onboarding_request.current_step:
                            assigned_user = db.query(User).filter(User.id == onboarding_request.assigned_to).first()
                            if assigned_user:
                                assigned_to_user = UserInfo(
                                    id=str(assigned_user.id),
                                    name=assigned_user.name,
                                    email=assigned_user.email,
                                    role=assigned_user.role.value if hasattr(assigned_user.role, 'value') else str(assigned_user.role)
                                )
                        
                        steps_data.append(ApprovalStepResponse(
                            id=f"step-{step_number}",
                            step_number=step_number,
                            step_type=step_type,
                            step_name=step_name,
                            assigned_to=str(onboarding_request.assigned_to) if (step_number == onboarding_request.current_step and onboarding_request.assigned_to) else None,
                            assigned_to_user=assigned_to_user,
                            assigned_role=assigned_role,
                            status=step_status,
                            completed_by=str(onboarding_request.approved_by) if (step_status == "completed" and onboarding_request.approved_by) else None,
                            completed_by_user=None,  # Could be populated if needed
                            completed_at=onboarding_request.approved_at.isoformat() if (step_status == "completed" and onboarding_request.approved_at) else None,
                            notes=onboarding_request.approval_notes if step_status == "completed" else None
                        ))
        
        # Get current assignee
        current_assignee = None
        if onboarding_request.assigned_to:
            assigned_user = db.query(User).filter(User.id == onboarding_request.assigned_to).first()
            if assigned_user:
                current_assignee = UserInfo(
                    id=str(assigned_user.id),
                    name=assigned_user.name,
                    email=assigned_user.email,
                    role=assigned_user.role.value if hasattr(assigned_user.role, 'value') else str(assigned_user.role)
                )
        
        # Get approved_by user info
        approved_by_user = None
        if onboarding_request.approved_by:
            approved_user = db.query(User).filter(User.id == onboarding_request.approved_by).first()
            if approved_user:
                approved_by_user = UserInfo(
                    id=str(approved_user.id),
                    name=approved_user.name,
                    email=approved_user.email,
                    role=approved_user.role.value if hasattr(approved_user.role, 'value') else str(approved_user.role)
                )
        
        return ApprovalResponse(
            id=str(onboarding_request.id),
            agent_id=str(onboarding_request.agent_id),
            status=onboarding_request.status,
            current_step=onboarding_request.current_step or 0,
            approved_by=str(onboarding_request.approved_by) if onboarding_request.approved_by else None,
            approved_by_user=approved_by_user,
            approval_notes=onboarding_request.approval_notes,
            started_at=onboarding_request.created_at.isoformat(),
            completed_at=onboarding_request.approved_at.isoformat() if onboarding_request.approved_at else None,
            current_assignee=current_assignee,
            steps=steps_data
        )
    
    # Fall back to legacy ApprovalInstance
    approval = db.query(ApprovalInstance).filter(
        ApprovalInstance.agent_id == agent_id
    ).first()
    
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No approval instance found for this agent"
        )
    
    # Get steps
    steps = db.query(ApprovalStep).filter(
        ApprovalStep.instance_id == approval.id
    ).order_by(ApprovalStep.step_number).all()
    
    return ApprovalResponse(
        id=str(approval.id),
        agent_id=str(approval.agent_id),
        status=approval.status,
        current_step=approval.current_step,
        approved_by=str(approval.approved_by) if approval.approved_by else None,
        approval_notes=approval.approval_notes,
        started_at=approval.started_at.isoformat(),
        completed_at=approval.completed_at.isoformat() if approval.completed_at else None,
        steps=[
            ApprovalStepResponse(
                id=str(s.id),
                step_number=s.step_number,
                step_type=s.step_type,
                step_name=s.step_name,
                assigned_to=str(s.assigned_to) if s.assigned_to else None,
                assigned_role=s.assigned_role,
                status=s.status,
                completed_by=str(s.completed_by) if s.completed_by else None,
                completed_at=s.completed_at.isoformat() if s.completed_at else None,
                notes=s.notes
            )
            for s in steps
        ]
    )


@router.get("/pending", response_model=List[ApprovalResponse])
async def get_pending_approvals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending approvals for approver"""
    # Check permissions
    if current_user.role.value not in ["approver", "tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approvers can view pending approvals"
        )
    
    # Get agents that have completed all reviews but not yet approved
    required_stages = ["security", "compliance", "technical", "business"]
    
    # Query agents in review status
    agents_query = db.query(Agent).filter(
        Agent.status == AgentStatus.IN_REVIEW.value
    )
    
    # Get all agents first (we need to check reviews for each)
    all_agents = agents_query.all()
    
    # Filter agents that have completed all reviews
    eligible_agents = []
    for agent in all_agents:
        reviews = db.query(Review).filter(
            Review.agent_id == agent.id,
            Review.status == "approved"
        ).all()
        
        completed_stages = {r.stage for r in reviews}
        if completed_stages == set(required_stages):
            eligible_agents.append(agent)
    
    # Apply pagination to eligible agents
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    agents = eligible_agents[start_idx:end_idx]
    
    # Process eligible agents
    pending_approvals = []
    for agent in agents:
        # Get or create approval instance
        approval = db.query(ApprovalInstance).filter(
            ApprovalInstance.agent_id == agent.id
        ).first()
        
        if not approval:
            approval = ApprovalInstance(
                agent_id=agent.id,
                status=ApprovalStatus.PENDING.value,
                started_at=datetime.utcnow()
            )
            db.add(approval)
            db.commit()
            db.refresh(approval)
        elif approval.status != ApprovalStatus.PENDING.value:
            # Skip if already approved/rejected
            continue
        
        # Get steps
        steps = db.query(ApprovalStep).filter(
            ApprovalStep.instance_id == approval.id
        ).order_by(ApprovalStep.step_number).all()
        
        # Get user details for approved_by
        approved_by_user = None
        if approval.approved_by:
            approver = db.query(User).filter(User.id == approval.approved_by).first()
            if approver:
                approved_by_user = UserInfo(
                    id=str(approver.id),
                    name=approver.name,
                    email=approver.email,
                    role=approver.role.value if hasattr(approver.role, 'value') else str(approver.role)
                )
        
        # Get current assignee (from active step or find approver role user)
        current_assignee = None
        active_step = next((s for s in steps if s.status == "in_progress" or s.status == "pending"), None)
        if active_step and active_step.assigned_to:
            assignee = db.query(User).filter(User.id == active_step.assigned_to).first()
            if assignee:
                current_assignee = UserInfo(
                    id=str(assignee.id),
                    name=assignee.name,
                    email=assignee.email,
                    role=assignee.role.value if hasattr(assignee.role, 'value') else str(assignee.role)
                )
        elif not current_assignee and approval.status == ApprovalStatus.PENDING.value:
            # If no specific assignee, find any approver user
            approver_user = db.query(User).filter(
                User.role.in_([UserRole.APPROVER, UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN])
            ).first()
            if approver_user:
                current_assignee = UserInfo(
                    id=str(approver_user.id),
                    name=approver_user.name,
                    email=approver_user.email,
                    role=approver_user.role.value if hasattr(approver_user.role, 'value') else str(approver_user.role)
                )
        
        pending_approvals.append(ApprovalResponse(
            id=str(approval.id),
            agent_id=str(agent.id),
            status=approval.status,
            current_step=approval.current_step,
            approved_by=str(approval.approved_by) if approval.approved_by else None,
            approved_by_user=approved_by_user,
            approval_notes=approval.approval_notes,
            started_at=approval.started_at.isoformat(),
            completed_at=approval.completed_at.isoformat() if approval.completed_at else None,
            current_assignee=current_assignee,
            steps=[
                ApprovalStepResponse(
                    id=str(s.id),
                    step_number=s.step_number,
                    step_type=s.step_type,
                    step_name=s.step_name,
                    assigned_to=str(s.assigned_to) if s.assigned_to else None,
                    assigned_to_user=UserInfo(
                        id=str(assignee.id),
                        name=assignee.name,
                        email=assignee.email,
                        role=assignee.role.value if hasattr(assignee.role, 'value') else str(assignee.role)
                    ) if (s.assigned_to and (assignee := db.query(User).filter(User.id == s.assigned_to).first())) else None,
                    assigned_role=s.assigned_role,
                    status=s.status,
                    completed_by=str(s.completed_by) if s.completed_by else None,
                    completed_by_user=UserInfo(
                        id=str(completer.id),
                        name=completer.name,
                        email=completer.email,
                        role=completer.role.value if hasattr(completer.role, 'value') else str(completer.role)
                    ) if (s.completed_by and (completer := db.query(User).filter(User.id == s.completed_by).first())) else None,
                    completed_at=s.completed_at.isoformat() if s.completed_at else None,
                    notes=s.notes
                )
                for s in steps
            ]
        ))
    
    return pending_approvals
