"""
Adoption tracking API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.agent import Agent
from app.models.user import User
from app.models.adoption import AdoptionMetric, AdoptionEvent, AdoptionStatus
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/adoption", tags=["adoption"])


class AdoptionMetricResponse(BaseModel):
    """Adoption metric response schema"""
    id: str
    agent_id: str
    status: str
    user_count: int
    usage_count: int
    last_used_at: Optional[str]
    roi: Optional[float]
    cost_savings: Optional[float]
    efficiency_gain: Optional[float]
    user_satisfaction: Optional[float]
    feedback_count: int
    deployed_at: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class AdoptionEventCreate(BaseModel):
    """Adoption event creation schema"""
    agent_id: UUID
    event_type: str = Field(..., pattern="^(deployed|used|feedback|issue|upgrade)$")
    metadata: Optional[dict] = None


@router.get("/agents/{agent_id}/metrics", response_model=AdoptionMetricResponse)
async def get_agent_adoption_metrics(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get adoption metrics for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get or create adoption metric
    metric = db.query(AdoptionMetric).filter(
        AdoptionMetric.agent_id == agent_id
    ).first()
    
    if not metric:
        metric = AdoptionMetric(
            agent_id=agent_id,
            tenant_id=current_user.tenant_id,
            status=AdoptionStatus.NOT_STARTED.value
        )
        db.add(metric)
        db.commit()
        db.refresh(metric)
    
    return AdoptionMetricResponse(
        id=str(metric.id),
        agent_id=str(metric.agent_id),
        status=metric.status,
        user_count=metric.user_count,
        usage_count=metric.usage_count,
        last_used_at=metric.last_used_at.isoformat() if metric.last_used_at else None,
        roi=float(metric.roi) if metric.roi else None,
        cost_savings=float(metric.cost_savings) if metric.cost_savings else None,
        efficiency_gain=float(metric.efficiency_gain) if metric.efficiency_gain else None,
        user_satisfaction=float(metric.user_satisfaction) if metric.user_satisfaction else None,
        feedback_count=metric.feedback_count,
        deployed_at=metric.deployed_at.isoformat() if metric.deployed_at else None,
        created_at=metric.created_at.isoformat(),
        updated_at=metric.updated_at.isoformat()
    )


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def create_adoption_event(
    event_data: AdoptionEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an adoption event"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == event_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Create event
    event = AdoptionEvent(
        agent_id=event_data.agent_id,
        tenant_id=current_user.tenant_id,
        event_type=event_data.event_type,
        user_id=current_user.id,
        event_metadata=event_data.metadata
    )
    
    db.add(event)
    
    # Update adoption metrics
    metric = db.query(AdoptionMetric).filter(
        AdoptionMetric.agent_id == event_data.agent_id
    ).first()
    
    if not metric:
        metric = AdoptionMetric(
            agent_id=event_data.agent_id,
            tenant_id=current_user.tenant_id,
            status=AdoptionStatus.EVALUATING.value
        )
        db.add(metric)
    
    # Update metrics based on event type
    if event_data.event_type == "used":
        metric.usage_count += 1
        metric.last_used_at = datetime.utcnow()
        if metric.status == AdoptionStatus.NOT_STARTED.value:
            metric.status = AdoptionStatus.EVALUATING.value
    elif event_data.event_type == "deployed":
        metric.status = AdoptionStatus.DEPLOYED.value
        metric.deployed_at = datetime.utcnow()
    elif event_data.event_type == "feedback":
        metric.feedback_count += 1
        if event_data.metadata and "satisfaction" in event_data.metadata:
            # Update average satisfaction
            current_sat = metric.user_satisfaction or 0.0
            new_sat = event_data.metadata["satisfaction"]
            metric.user_satisfaction = (current_sat + new_sat) / 2
    
    db.commit()
    
    return {"event_id": str(event.id), "status": "created"}


@router.get("/agents/{agent_id}/events")
async def get_agent_adoption_events(
    agent_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get adoption events for an agent"""
    events = db.query(AdoptionEvent).filter(
        AdoptionEvent.agent_id == agent_id
    ).order_by(AdoptionEvent.occurred_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "metadata": e.event_metadata,
            "occurred_at": e.occurred_at.isoformat()
        }
        for e in events
    ]


@router.get("/dashboard")
async def get_adoption_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get adoption dashboard statistics"""
    # Get all adoption metrics for tenant
    query = db.query(AdoptionMetric)
    
    if current_user.tenant_id:
        query = query.filter(AdoptionMetric.tenant_id == current_user.tenant_id)
    
    metrics = query.all()
    
    # Calculate statistics
    total_agents = len(metrics)
    deployed_count = len([m for m in metrics if m.status == AdoptionStatus.DEPLOYED.value])
    total_usage = sum(m.usage_count for m in metrics)
    total_users = sum(m.user_count for m in metrics)
    avg_satisfaction = sum(m.user_satisfaction or 0 for m in metrics) / total_agents if total_agents > 0 else 0
    
    # Status breakdown
    status_breakdown = {}
    for status in AdoptionStatus:
        status_breakdown[status.value] = len([m for m in metrics if m.status == status.value])
    
    return {
        "total_agents": total_agents,
        "deployed_agents": deployed_count,
        "total_usage": total_usage,
        "total_users": total_users,
        "avg_satisfaction": round(avg_satisfaction, 2),
        "status_breakdown": status_breakdown
    }

