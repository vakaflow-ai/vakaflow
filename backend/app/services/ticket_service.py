"""
Ticket service for managing agent submission tickets
"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from app.models.ticket import Ticket, TicketStatus, TicketStage, TicketActivity
from app.models.agent import Agent
from app.models.user import User


class TicketService:
    """Service for managing tickets"""
    
    @staticmethod
    def generate_ticket_number(db: Session) -> str:
        """Generate unique ticket number (e.g., TKT-2024-001)"""
        year = datetime.utcnow().year
        # Get the last ticket number for this year
        last_ticket = db.query(Ticket).filter(
            Ticket.ticket_number.like(f"TKT-{year}-%")
        ).order_by(Ticket.ticket_number.desc()).first()
        
        if last_ticket:
            # Extract number and increment
            try:
                last_num = int(last_ticket.ticket_number.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return f"TKT-{year}-{next_num:03d}"
    
    @staticmethod
    def create_ticket(
        db: Session,
        agent_id: UUID,
        submitted_by: UUID,
        tenant_id: Optional[UUID] = None,
        title: Optional[str] = None,
        description: Optional[str] = None
    ) -> Ticket:
        """Create a new ticket for an agent submission"""
        # Get agent for title
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError("Agent not found")
        
        ticket_number = TicketService.generate_ticket_number(db)
        
        ticket = Ticket(
            agent_id=agent_id,
            tenant_id=tenant_id,
            ticket_number=ticket_number,
            title=title or f"Agent Submission: {agent.name}",
            description=description or f"Ticket for agent {agent.name} submission",
            status=TicketStatus.OPEN.value,
            current_stage=TicketStage.SUBMITTED.value,
            submitted_by=submitted_by,
            stage_progress={
                "submitted": {
                    "status": "completed",
                    "completed_at": datetime.utcnow().isoformat(),
                    "completed_by": str(submitted_by)
                }
            }
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        # Create activity log
        TicketService.log_activity(
            db=db,
            ticket_id=ticket.id,
            user_id=submitted_by,
            activity_type="ticket_created",
            description=f"Ticket {ticket_number} created for agent {agent.name}"
        )
        
        return ticket
    
    @staticmethod
    def update_ticket_stage(
        db: Session,
        ticket_id: UUID,
        new_stage: TicketStage,
        user_id: UUID,
        status: Optional[str] = None
    ) -> Ticket:
        """Update ticket stage and progress"""
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise ValueError("Ticket not found")
        
        old_stage = ticket.current_stage
        ticket.current_stage = new_stage.value
        ticket.last_updated_at = datetime.utcnow()
        
        # Update stage progress
        if not ticket.stage_progress:
            ticket.stage_progress = {}
        
        ticket.stage_progress[new_stage.value] = {
            "status": status or "in_progress",
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": str(user_id)
        }
        
        # Mark previous stage as completed if moving forward
        if old_stage != new_stage.value and old_stage in ticket.stage_progress:
            ticket.stage_progress[old_stage]["status"] = "completed"
            ticket.stage_progress[old_stage]["completed_at"] = datetime.utcnow().isoformat()
        
        db.commit()
        db.refresh(ticket)
        
        # Log activity
        TicketService.log_activity(
            db=db,
            ticket_id=ticket_id,
            user_id=user_id,
            activity_type="stage_change",
            description=f"Stage changed from {old_stage} to {new_stage.value}",
            old_value=old_stage,
            new_value=new_stage.value
        )
        
        return ticket
    
    @staticmethod
    def update_ticket_status(
        db: Session,
        ticket_id: UUID,
        new_status: TicketStatus,
        user_id: UUID,
        assigned_to: Optional[UUID] = None
    ) -> Ticket:
        """Update ticket status"""
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise ValueError("Ticket not found")
        
        old_status = ticket.status
        ticket.status = new_status.value
        ticket.last_updated_at = datetime.utcnow()
        
        if assigned_to:
            ticket.assigned_to = assigned_to
        
        if new_status == TicketStatus.APPROVED:
            ticket.approved_by = user_id
            ticket.completed_at = datetime.utcnow()
            ticket.current_stage = TicketStage.COMPLETED.value
        elif new_status == TicketStatus.REJECTED:
            ticket.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(ticket)
        
        # Log activity
        TicketService.log_activity(
            db=db,
            ticket_id=ticket_id,
            user_id=user_id,
            activity_type="status_change",
            description=f"Status changed from {old_status} to {new_status.value}",
            old_value=old_status,
            new_value=new_status.value
        )
        
        return ticket
    
    @staticmethod
    def get_ticket_by_agent(db: Session, agent_id: UUID) -> Optional[Ticket]:
        """Get ticket for an agent"""
        return db.query(Ticket).filter(Ticket.agent_id == agent_id).first()
    
    @staticmethod
    def log_activity(
        db: Session,
        ticket_id: UUID,
        user_id: UUID,
        activity_type: str,
        description: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        activity_metadata: Optional[Dict[str, Any]] = None
    ) -> TicketActivity:
        """Log ticket activity"""
        activity = TicketActivity(
            ticket_id=ticket_id,
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            old_value=old_value,
            new_value=new_value,
            activity_metadata=activity_metadata
        )
        
        db.add(activity)
        db.commit()
        db.refresh(activity)
        
        return activity

