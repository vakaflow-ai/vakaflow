"""
Predictive Analytics Service
"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.agent import Agent, AgentStatus
from app.models.review import Review
from app.models.policy import ComplianceCheck
import logging

logger = logging.getLogger(__name__)


class PredictiveAnalyticsService:
    """Service for predictive analytics"""
    
    @staticmethod
    async def predict_agent_success(
        db: Session,
        agent_id: str
    ) -> Dict[str, Any]:
        """
        Predict likelihood of agent approval success
        
        Args:
            db: Database session
            agent_id: Agent ID
        
        Returns:
            Prediction with confidence score
        """
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return {"error": "Agent not found"}
        
        # Calculate success probability based on:
        # 1. Compliance score
        # 2. Similar agents' success rate
        # 3. Review history patterns
        # 4. Vendor history
        
        score = 0.0
        factors = []
        
        # Factor 1: Compliance score
        if agent.compliance_score:
            compliance_factor = agent.compliance_score / 100.0
            score += compliance_factor * 0.4
            factors.append({
                "factor": "compliance_score",
                "value": agent.compliance_score,
                "weight": 0.4,
                "contribution": compliance_factor * 0.4
            })
        
        # Factor 2: Similar agents success rate
        similar_agents = db.query(Agent).filter(
            Agent.category == agent.category,
            Agent.type == agent.type,
            Agent.id != agent_id
        ).all()
        
        if similar_agents:
            approved_count = len([a for a in similar_agents if a.status == AgentStatus.APPROVED.value])
            success_rate = approved_count / len(similar_agents) if similar_agents else 0.5
            score += success_rate * 0.3
            factors.append({
                "factor": "similar_agents_success_rate",
                "value": success_rate,
                "weight": 0.3,
                "contribution": success_rate * 0.3
            })
        
        # Factor 3: Review patterns
        reviews = db.query(Review).filter(Review.agent_id == agent_id).all()
        if reviews:
            approved_reviews = len([r for r in reviews if r.status == "approved"])
            review_ratio = approved_reviews / len(reviews) if reviews else 0.5
            score += review_ratio * 0.2
            factors.append({
                "factor": "review_approval_ratio",
                "value": review_ratio,
                "weight": 0.2,
                "contribution": review_ratio * 0.2
            })
        
        # Factor 4: Compliance checks
        compliance_checks = db.query(ComplianceCheck).filter(
            ComplianceCheck.agent_id == agent_id
        ).all()
        if compliance_checks:
            passed_checks = len([c for c in compliance_checks if c.status == "pass"])
            compliance_ratio = passed_checks / len(compliance_checks) if compliance_checks else 0.5
            score += compliance_ratio * 0.1
            factors.append({
                "factor": "compliance_check_ratio",
                "value": compliance_ratio,
                "weight": 0.1,
                "contribution": compliance_ratio * 0.1
            })
        
        # Normalize to [0, 1]
        probability = min(1.0, max(0.0, score))
        
        return {
            "agent_id": agent_id,
            "success_probability": round(probability, 3),
            "confidence": "high" if len(factors) >= 3 else "medium" if len(factors) >= 2 else "low",
            "factors": factors,
            "prediction": "likely_approved" if probability >= 0.7 else "uncertain" if probability >= 0.4 else "likely_rejected"
        }
    
    @staticmethod
    async def predict_approval_likelihood(
        db: Session,
        agent_id: str
    ) -> Dict[str, Any]:
        """
        Predict approval likelihood for an agent
        
        Args:
            db: Database session
            agent_id: Agent ID
        
        Returns:
            Approval likelihood prediction
        """
        # Similar to success prediction but focused on approval
        prediction = await PredictiveAnalyticsService.predict_agent_success(db, agent_id)
        
        # Adjust for approval-specific factors
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if agent:
            # Check if all reviews are complete
            reviews = db.query(Review).filter(Review.agent_id == agent_id).all()
            required_stages = ["security", "compliance", "technical", "business"]
            completed_stages = {r.stage for r in reviews if r.status == "approved"}
            
            if len(completed_stages) == len(required_stages):
                prediction["approval_likelihood"] = "high"
                prediction["all_reviews_complete"] = True
            else:
                prediction["approval_likelihood"] = "pending_reviews"
                prediction["completed_stages"] = list(completed_stages)
                prediction["required_stages"] = required_stages
        
        return prediction
    
    @staticmethod
    async def predict_risk_level(
        db: Session,
        agent_id: str
    ) -> Dict[str, Any]:
        """
        Predict risk level for an agent
        
        Args:
            db: Database session
            agent_id: Agent ID
        
        Returns:
            Risk level prediction
        """
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return {"error": "Agent not found"}
        
        risk_score = 0.0
        risk_factors = []
        
        # Factor 1: Compliance score (lower = higher risk)
        if agent.compliance_score:
            compliance_risk = (100 - agent.compliance_score) / 100.0
            risk_score += compliance_risk * 0.4
            risk_factors.append({
                "factor": "low_compliance_score",
                "value": agent.compliance_score,
                "risk_contribution": compliance_risk * 0.4
            })
        
        # Factor 2: Risk score (if available)
        if agent.risk_score:
            risk_score += (agent.risk_score / 100.0) * 0.3
            risk_factors.append({
                "factor": "agent_risk_score",
                "value": agent.risk_score,
                "risk_contribution": (agent.risk_score / 100.0) * 0.3
            })
        
        # Factor 3: Failed compliance checks
        failed_checks = db.query(ComplianceCheck).filter(
            ComplianceCheck.agent_id == agent_id,
            ComplianceCheck.status == "fail"
        ).count()
        
        if failed_checks > 0:
            risk_score += min(0.3, failed_checks * 0.1)
            risk_factors.append({
                "factor": "failed_compliance_checks",
                "value": failed_checks,
                "risk_contribution": min(0.3, failed_checks * 0.1)
            })
        
        # Normalize to [0, 1]
        risk_score = min(1.0, max(0.0, risk_score))
        
        # Categorize risk
        if risk_score >= 0.7:
            risk_level = "high"
        elif risk_score >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "agent_id": agent_id,
            "risk_score": round(risk_score, 3),
            "risk_level": risk_level,
            "risk_factors": risk_factors
        }

