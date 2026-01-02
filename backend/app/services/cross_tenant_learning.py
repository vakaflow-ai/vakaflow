"""
Cross-Tenant Learning Service (Federated Learning Framework)
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import sqlalchemy as sa
import logging

logger = logging.getLogger(__name__)


class CrossTenantLearningService:
    """Service for cross-tenant learning (federated learning)"""
    
    @staticmethod
    async def aggregate_approval_patterns(
        db: Session,
        exclude_tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Aggregate approval patterns across tenants (anonymized)
        
        Args:
            db: Database session
            exclude_tenant_id: Tenant ID to exclude from aggregation
        
        Returns:
            Aggregated patterns (anonymized)
        """
        from app.models.agent import Agent, AgentStatus
        from app.models.review import Review
        
        # Get approval patterns (anonymized)
        query = db.query(
            Agent.category,
            Agent.type,
            func.avg(Agent.compliance_score).label('avg_compliance'),
            func.count(Agent.id).label('total_agents'),
            func.sum(func.cast(Agent.status == AgentStatus.APPROVED.value, sa.Integer)).label('approved_count')
        ).group_by(Agent.category, Agent.type)
        
        if exclude_tenant_id:
            # Exclude specific tenant (for privacy)
            from app.models.vendor import Vendor
            vendor_ids = db.query(Vendor.id).filter(Vendor.tenant_id == exclude_tenant_id).subquery()
            query = query.filter(~Agent.vendor_id.in_(db.query(vendor_ids.c.id)))
        
        patterns = query.all()
        
        # Aggregate review patterns
        review_patterns = db.query(
            Review.stage,
            Review.status,
            func.count(Review.id).label('count')
        ).group_by(Review.stage, Review.status).all()
        
        return {
            "approval_patterns": [
                {
                    "category": p.category,
                    "type": p.type,
                    "avg_compliance_score": float(p.avg_compliance or 0),
                    "total_agents": p.total_agents,
                    "approval_rate": float(p.approved_count) / p.total_agents if p.total_agents > 0 else 0
                }
                for p in patterns
            ],
            "review_patterns": [
                {
                    "stage": r.stage,
                    "status": r.status,
                    "count": r.count
                }
                for r in review_patterns
            ],
            "anonymized": True,
            "excluded_tenant": exclude_tenant_id
        }
    
    @staticmethod
    async def get_common_rejection_reasons(
        db: Session,
        exclude_tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get common rejection reasons across tenants (anonymized)
        
        Args:
            db: Database session
            exclude_tenant_id: Tenant ID to exclude
        
        Returns:
            Common rejection reasons
        """
        from app.models.review import Review
        
        query = db.query(
            Review.stage,
            func.count(Review.id).label('count')
        ).filter(
            Review.status == "rejected"
        ).group_by(Review.stage)
        
        if exclude_tenant_id:
            # Filter by tenant (anonymized)
            from app.models.agent import Agent
            from app.models.vendor import Vendor
            vendor_ids = db.query(Vendor.id).filter(Vendor.tenant_id == exclude_tenant_id).subquery()
            agent_ids = db.query(Agent.id).filter(Agent.vendor_id.in_(db.query(vendor_ids.c.id))).subquery()
            query = query.filter(~Review.agent_id.in_(db.query(agent_ids.c.id)))
        
        results = query.all()
        
        return [
            {
                "stage": r.stage,
                "rejection_count": r.count,
                "reason_category": "common_issue"  # Anonymized
            }
            for r in results
        ]
    
    @staticmethod
    async def get_best_practices(
        db: Session,
        category: Optional[str] = None,
        agent_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract best practices from successful agents (anonymized)
        
        Args:
            db: Database session
            category: Optional category filter
            agent_type: Optional type filter
        
        Returns:
            Best practices
        """
        from app.models.agent import Agent, AgentStatus
        from app.models.compliance import ComplianceCheck
        
        query = db.query(Agent).filter(
            Agent.status == AgentStatus.APPROVED.value
        )
        
        if category:
            query = query.filter(Agent.category == category)
        if agent_type:
            query = query.filter(Agent.type == agent_type)
        
        successful_agents = query.limit(100).all()
        
        # Analyze common patterns
        avg_compliance = sum(a.compliance_score or 0 for a in successful_agents) / len(successful_agents) if successful_agents else 0
        
        # Get compliance patterns
        compliance_patterns = []
        for agent in successful_agents[:10]:  # Sample
            checks = db.query(ComplianceCheck).filter(
                ComplianceCheck.agent_id == agent.id,
                ComplianceCheck.status == "pass"
            ).all()
            compliance_patterns.append({
                "policy_count": len(checks),
                "avg_confidence": sum(c.confidence_score or 0 for c in checks) / len(checks) if checks else 0
            })
        
        return {
            "category": category,
            "agent_type": agent_type,
            "sample_size": len(successful_agents),
            "average_compliance_score": round(avg_compliance, 2),
            "compliance_patterns": compliance_patterns,
            "best_practices": [
                "Maintain high compliance scores (>80)",
                "Complete all review stages",
                "Provide comprehensive documentation",
                "Address reviewer feedback promptly"
            ],
            "anonymized": True
        }

