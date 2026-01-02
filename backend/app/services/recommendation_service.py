"""
AI Recommendations Service
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging
from app.models.agent import Agent, AgentStatus
from app.models.review import Review
from app.models.policy import ComplianceCheck
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)


class RecommendationService:
    """Service for generating AI-powered recommendations"""
    
    @staticmethod
    async def find_similar_agents(
        db: Session,
        agent_id: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find similar agents based on various criteria
        
        Args:
            db: Database session
            agent_id: Agent ID to find similar agents for
            limit: Maximum number of recommendations
        
        Returns:
            List of similar agents with similarity scores
        """
        # Get the target agent
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return []
        
        # Find similar agents based on:
        # 1. Same category
        # 2. Similar type
        # 3. Approved status (prefer approved agents)
        similar_agents = db.query(Agent).filter(
            and_(
                Agent.id != agent_id,
                Agent.category == agent.category,
                Agent.type == agent.type,
                Agent.status == AgentStatus.APPROVED.value
            )
        ).limit(limit * 2).all()
        
        # Score and rank agents
        scored_agents = []
        for similar in similar_agents:
            score = 0.0
            
            # Category match (already filtered)
            score += 0.3
            
            # Type match (already filtered)
            score += 0.2
            
            # Status: approved gets bonus
            if similar.status == AgentStatus.APPROVED.value:
                score += 0.2
            
            # Compliance score similarity
            if agent.compliance_score and similar.compliance_score:
                score_diff = abs(agent.compliance_score - similar.compliance_score)
                score += max(0, 0.3 - (score_diff / 100))
            
            scored_agents.append({
                "agent": similar,
                "score": score,
                "reasons": [
                    "Same category",
                    "Same type",
                    "Approved status" if similar.status == AgentStatus.APPROVED.value else None
                ]
            })
        
        # Sort by score and return top results
        scored_agents.sort(key=lambda x: x["score"], reverse=True)
        return scored_agents[:limit]
    
    @staticmethod
    async def get_historical_cases(
        db: Session,
        agent_id: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get historical cases similar to the current agent
        
        Args:
            db: Database session
            agent_id: Agent ID
            limit: Maximum number of cases
        
        Returns:
            List of historical cases with context
        """
        # Get the target agent
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return []
        
        # Find similar historical agents (approved or rejected)
        historical_agents = db.query(Agent).filter(
            and_(
                Agent.id != agent_id,
                Agent.category == agent.category,
                Agent.status.in_([AgentStatus.APPROVED.value, AgentStatus.REJECTED.value])
            )
        ).order_by(Agent.approval_date.desc()).limit(limit * 2).all()
        
        cases = []
        for hist_agent in historical_agents:
            # Get reviews for this agent
            reviews = db.query(Review).filter(
                Review.agent_id == hist_agent.id
            ).all()
            
            # Get compliance checks
            compliance_checks = db.query(ComplianceCheck).filter(
                ComplianceCheck.agent_id == hist_agent.id
            ).all()
            
            # Extract key insights
            review_summary = {
                "total_reviews": len(reviews),
                "approved_stages": [r.stage for r in reviews if r.status == "approved"],
                "rejected_stages": [r.stage for r in reviews if r.status == "rejected"],
                "common_issues": []
            }
            
            # Find common rejection reasons
            rejection_reasons = []
            for review in reviews:
                if review.status == "rejected" and review.notes:
                    rejection_reasons.append(review.notes[:100])  # First 100 chars
            
            cases.append({
                "agent_id": str(hist_agent.id),
                "agent_name": hist_agent.name,
                "status": hist_agent.status,
                "approval_date": hist_agent.approval_date.isoformat() if hist_agent.approval_date else None,
                "compliance_score": hist_agent.compliance_score,
                "review_summary": review_summary,
                "rejection_reasons": rejection_reasons[:3],  # Top 3
                "lessons_learned": f"Agent {hist_agent.status} with compliance score {hist_agent.compliance_score or 'N/A'}"
            })
        
        return cases[:limit]
    
    @staticmethod
    async def get_recommendations_for_reviewer(
        db: Session,
        agent_id: str,
        review_stage: str
    ) -> Dict[str, Any]:
        """
        Get recommendations for a reviewer based on agent and review stage
        
        Args:
            db: Database session
            agent_id: Agent ID
            review_stage: Review stage (security, compliance, technical, business)
        
        Returns:
            Recommendations dictionary
        """
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return {}
        
        recommendations = {
            "similar_agents": await RecommendationService.find_similar_agents(db, agent_id, limit=3),
            "historical_cases": await RecommendationService.get_historical_cases(db, agent_id, limit=3),
            "stage_specific": []
        }
        
        # Get stage-specific recommendations using RAG
        try:
            # Query knowledge base for stage-specific guidance
            query = f"{review_stage} review checklist requirements for {agent.category} {agent.type} agent"
            rag_results = await rag_service.search(
                query=query,
                agent_id=agent_id,
                limit=5
            )
            
            recommendations["stage_specific"] = [
                {
                    "source": result.get("source", "knowledge_base"),
                    "content": result.get("content", "")[:200],  # First 200 chars
                    "relevance_score": result.get("score", 0.0)
                }
                for result in rag_results
            ]
        except Exception as e:
            logger.error(f"Failed to get RAG recommendations: {e}")
        
        # Generate actionable recommendations
        recommendations["actionable"] = []
        
        # Based on similar agents
        if recommendations["similar_agents"]:
            top_similar = recommendations["similar_agents"][0]
            recommendations["actionable"].append({
                "type": "similar_agent",
                "message": f"Similar agent '{top_similar['agent'].name}' was approved. Review similar aspects.",
                "priority": "medium"
            })
        
        # Based on historical cases
        if recommendations["historical_cases"]:
            rejected_cases = [c for c in recommendations["historical_cases"] if c["status"] == "rejected"]
            if rejected_cases:
                top_rejected = rejected_cases[0]
                if top_rejected["rejection_reasons"]:
                    recommendations["actionable"].append({
                        "type": "avoid_issue",
                        "message": f"Previous similar agent was rejected: {top_rejected['rejection_reasons'][0]}",
                        "priority": "high"
                    })
        
        return recommendations
    
    @staticmethod
    async def get_compliance_recommendations(
        db: Session,
        agent_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get compliance-specific recommendations
        
        Args:
            db: Database session
            agent_id: Agent ID
        
        Returns:
            List of compliance recommendations
        """
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            return []
        
        recommendations = []
        
        # Get compliance checks
        compliance_checks = db.query(ComplianceCheck).filter(
            ComplianceCheck.agent_id == agent_id
        ).all()
        
        # Find failed checks
        failed_checks = [c for c in compliance_checks if not c.passed]
        
        for check in failed_checks:
            recommendations.append({
                "type": "compliance_gap",
                "policy": check.policy_name,
                "issue": check.issue_description,
                "severity": check.severity or "medium",
                "recommendation": f"Address compliance gap: {check.issue_description}",
                "priority": "high" if check.severity == "high" else "medium"
            })
        
        # Get similar approved agents for reference
        similar_approved = await RecommendationService.find_similar_agents(db, agent_id, limit=3)
        if similar_approved:
            recommendations.append({
                "type": "reference",
                "message": f"Review similar approved agents for compliance patterns",
                "reference_agents": [{"id": str(a["agent"].id), "name": a["agent"].name} for a in similar_approved],
                "priority": "low"
            })
        
        return recommendations

