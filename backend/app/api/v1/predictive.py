"""
Predictive Analytics API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.agent import Agent
from app.api.v1.auth import get_current_user
from app.services.predictive_analytics import PredictiveAnalyticsService

router = APIRouter(prefix="/predictive", tags=["predictive"])


@router.get("/agents/{agent_id}/success")
async def predict_agent_success(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Predict agent approval success"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    prediction = await PredictiveAnalyticsService.predict_agent_success(db, str(agent_id))
    return prediction


@router.get("/agents/{agent_id}/approval")
async def predict_approval_likelihood(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Predict approval likelihood"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    prediction = await PredictiveAnalyticsService.predict_approval_likelihood(db, str(agent_id))
    return prediction


@router.get("/agents/{agent_id}/risk")
async def predict_risk_level(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Predict risk level"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    prediction = await PredictiveAnalyticsService.predict_risk_level(db, str(agent_id))
    return prediction

