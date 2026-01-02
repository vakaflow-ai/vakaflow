"""
Recommendations API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.agent import Agent
from app.api.v1.auth import get_current_user
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/agents/{agent_id}/similar")
async def get_similar_agents(
    agent_id: UUID,
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get similar agents"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    similar = await RecommendationService.find_similar_agents(db, str(agent_id), limit=limit)
    
    return [
        {
            "agent_id": str(item["agent"].id),
            "agent_name": item["agent"].name,
            "agent_type": item["agent"].type,
            "agent_category": item["agent"].category,
            "status": item["agent"].status,
            "compliance_score": item["agent"].compliance_score,
            "similarity_score": round(item["score"], 2),
            "reasons": [r for r in item["reasons"] if r]
        }
        for item in similar
    ]


@router.get("/agents/{agent_id}/historical")
async def get_historical_cases(
    agent_id: UUID,
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get historical cases"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    cases = await RecommendationService.get_historical_cases(db, str(agent_id), limit=limit)
    return cases


@router.get("/agents/{agent_id}/review")
async def get_review_recommendations(
    agent_id: UUID,
    review_stage: str = Query(..., pattern="^(security|compliance|technical|business)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recommendations for a reviewer"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    recommendations = await RecommendationService.get_recommendations_for_reviewer(
        db, str(agent_id), review_stage
    )
    
    return recommendations


@router.get("/agents/{agent_id}/compliance")
async def get_compliance_recommendations(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get compliance-specific recommendations"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    recommendations = await RecommendationService.get_compliance_recommendations(
        db, str(agent_id)
    )
    
    return recommendations

