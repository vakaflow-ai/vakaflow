"""
Fine-Tuning API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.fine_tuning_service import FineTuningService

router = APIRouter(prefix="/fine-tuning", tags=["fine-tuning"])


@router.get("/training-data")
async def get_training_data(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get training data for fine-tuning (admin only)"""
    # Check permissions
    if current_user.role.value not in ["platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can access training data"
        )
    
    data = await FineTuningService.prepare_training_data(db, tenant_id)
    return data


@router.post("/compliance-model")
async def fine_tune_compliance_model(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fine-tune compliance checking model (admin only)"""
    # Check permissions
    if current_user.role.value not in ["platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can fine-tune models"
        )
    
    # Get training data
    training_data_info = await FineTuningService.prepare_training_data(db)
    
    # Prepare actual training data (simplified)
    training_data = []  # Would be populated from database
    
    result = await FineTuningService.fine_tune_compliance_model(db, training_data)
    return result


@router.post("/recommendation-model")
async def fine_tune_recommendation_model(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fine-tune recommendation model (admin only)"""
    # Check permissions
    if current_user.role.value not in ["platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can fine-tune models"
        )
    
    # Get training data
    training_data_info = await FineTuningService.prepare_training_data(db)
    
    # Prepare actual training data (simplified)
    training_data = []  # Would be populated from database
    
    result = await FineTuningService.fine_tune_recommendation_model(db, training_data)
    return result

