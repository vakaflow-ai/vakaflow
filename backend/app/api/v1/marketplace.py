"""
Marketplace API endpoints (ratings and reviews)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.agent import Agent
from app.models.vendor import Vendor
from app.models.marketplace import VendorRating, VendorReview
from sqlalchemy import Boolean
from app.api.v1.auth import get_current_user
from app.core.audit import audit_service, AuditAction

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class RatingCreate(BaseModel):
    """Rating creation schema"""
    vendor_id: UUID
    agent_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    ease_of_use: Optional[int] = Field(None, ge=1, le=5)
    reliability: Optional[int] = Field(None, ge=1, le=5)
    performance: Optional[int] = Field(None, ge=1, le=5)
    support: Optional[int] = Field(None, ge=1, le=5)


class ReviewCreate(BaseModel):
    """Review creation schema"""
    vendor_id: UUID
    agent_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=10)
    rating: int = Field(..., ge=1, le=5)


@router.post("/ratings", status_code=status.HTTP_201_CREATED)
async def create_rating(
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a vendor rating"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == rating_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check if user already rated
    existing = db.query(VendorRating).filter(
        VendorRating.user_id == current_user.id,
        VendorRating.agent_id == rating_data.agent_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already rated this agent"
        )
    
    # Create rating
    rating = VendorRating(
        vendor_id=rating_data.vendor_id,
        agent_id=rating_data.agent_id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        rating=rating_data.rating,
        comment=rating_data.comment,
        ease_of_use=rating_data.ease_of_use,
        reliability=rating_data.reliability,
        performance=rating_data.performance,
        support=rating_data.support
    )
    
    db.add(rating)
    db.commit()
    db.refresh(rating)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="vendor_rating",
        resource_id=str(rating.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"agent_id": str(rating_data.agent_id), "rating": rating_data.rating}
    )
    
    return {
        "id": str(rating.id),
        "rating": rating.rating,
        "message": "Rating created successfully"
    }


@router.post("/reviews", status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a vendor review"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == review_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Create review
    review = VendorReview(
        vendor_id=review_data.vendor_id,
        agent_id=review_data.agent_id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        title=review_data.title,
        content=review_data.content,
        rating=review_data.rating
    )
    
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=str(current_user.id),
        action=AuditAction.CREATE,
        resource_type="vendor_review",
        resource_id=str(review.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        details={"agent_id": str(review_data.agent_id), "rating": review_data.rating}
    )
    
    return {
        "id": str(review.id),
        "title": review.title,
        "message": "Review created successfully"
    }


@router.get("/agents/{agent_id}/ratings")
async def get_agent_ratings(
    agent_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ratings for an agent"""
    ratings = db.query(VendorRating).filter(
        VendorRating.agent_id == agent_id
    ).order_by(VendorRating.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Calculate average
    avg_result = db.query(func.avg(VendorRating.rating)).filter(
        VendorRating.agent_id == agent_id
    ).scalar()
    
    return {
        "average_rating": round(float(avg_result or 0), 2),
        "total_ratings": len(ratings),
        "ratings": [
            {
                "id": str(r.id),
                "rating": r.rating,
                "comment": r.comment,
                "ease_of_use": r.ease_of_use,
                "reliability": r.reliability,
                "performance": r.performance,
                "support": r.support,
                "created_at": r.created_at.isoformat()
            }
            for r in ratings
        ]
    }


@router.get("/agents/{agent_id}/reviews")
async def get_agent_reviews(
    agent_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get reviews for an agent"""
    reviews = db.query(VendorReview).filter(
        VendorReview.agent_id == agent_id,
        VendorReview.is_approved == True
    ).order_by(VendorReview.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return [
        {
            "id": str(r.id),
            "title": r.title,
            "content": r.content,
            "rating": r.rating,
            "is_verified": r.is_verified,
            "is_helpful": r.is_helpful,
            "created_at": r.created_at.isoformat()
        }
        for r in reviews
    ]


@router.get("/vendors/{vendor_id}/stats")
async def get_vendor_stats(
    vendor_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vendor statistics (ratings, reviews)"""
    # Average rating
    avg_rating = db.query(func.avg(VendorRating.rating)).filter(
        VendorRating.vendor_id == vendor_id
    ).scalar()
    
    # Total ratings
    total_ratings = db.query(VendorRating).filter(
        VendorRating.vendor_id == vendor_id
    ).count()
    
    # Total reviews
    total_reviews = db.query(VendorReview).filter(
        VendorReview.vendor_id == vendor_id,
        VendorReview.is_approved == True
    ).count()
    
    # Rating distribution
    rating_dist = {}
    for rating_val in range(1, 6):
        count = db.query(VendorRating).filter(
            VendorRating.vendor_id == vendor_id,
            VendorRating.rating == rating_val
        ).count()
        rating_dist[rating_val] = count
    
    return {
        "average_rating": round(float(avg_rating or 0), 2),
        "total_ratings": total_ratings,
        "total_reviews": total_reviews,
        "rating_distribution": rating_dist
    }

