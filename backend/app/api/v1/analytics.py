"""
Analytics and reporting API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.agent import Agent, AgentStatus, AgentMetadata
from app.models.review import Review
from app.models.user import User
from app.models.policy import ComplianceCheck, ComplianceCheckStatus
from app.models.agent_connection import AgentConnection
from app.models.vendor import Vendor
from app.models.prompt_usage import PromptUsage, CostAggregation
from app.api.v1.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_agents: int
    agents_by_status: Dict[str, int]
    total_reviews: int
    reviews_by_stage: Dict[str, int]
    compliance_score_avg: Optional[float]
    agents_by_type: Dict[str, int]
    recent_activity: List[Dict]


class TimeSeriesData(BaseModel):
    """Time series data point"""
    date: str
    value: int


class AnalyticsResponse(BaseModel):
    """Analytics response"""
    stats: DashboardStats
    agent_trends: List[TimeSeriesData]
    review_trends: List[TimeSeriesData]
    compliance_trends: List[TimeSeriesData]


@router.get("/dashboard", response_model=AnalyticsResponse)
async def get_dashboard_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard analytics"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        return AnalyticsResponse(
            stats=DashboardStats(
                total_agents=0,
                agents_by_status={},
                total_reviews=0,
                reviews_by_stage={},
                compliance_score_avg=None,
                agents_by_type={},
                recent_activity=[]
            ),
            agent_trends=[],
            review_trends=[],
            compliance_trends=[]
        )
    
    # Base query filters
    agent_query = db.query(Agent)
    review_query = db.query(Review)
    
    # Filter by tenant - ALL users must filter by tenant
    from app.models.vendor import Vendor
    vendors = db.query(Vendor).filter(Vendor.tenant_id == effective_tenant_id).all()
    vendor_ids = [v.id for v in vendors]
    if vendor_ids:
        agent_query = agent_query.filter(Agent.vendor_id.in_(vendor_ids))
        review_query = review_query.join(Agent).filter(Agent.vendor_id.in_(vendor_ids))
    else:
        # No vendors in tenant, return empty analytics
        return AnalyticsResponse(
            stats=DashboardStats(
                total_agents=0,
                agents_by_status={},
                total_reviews=0,
                reviews_by_stage={},
                compliance_score_avg=None,
                agents_by_type={},
                recent_activity=[]
            ),
            agent_trends=[],
            review_trends=[],
            compliance_trends=[]
        )
    
    # Total agents
    total_agents = agent_query.count()
    
    # Agents by status
    agents_by_status = {}
    for status_val in AgentStatus:
        count = agent_query.filter(Agent.status == status_val.value).count()
        agents_by_status[status_val.value] = count
    
    # Total reviews
    total_reviews = review_query.count()
    
    # Reviews by stage
    reviews_by_stage = {}
    stages = ["security", "compliance", "technical", "business"]
    for stage in stages:
        count = review_query.filter(Review.stage == stage).count()
        reviews_by_stage[stage] = count
    
    # Average compliance score (filtered by tenant)
    compliance_avg_query = db.query(func.avg(Agent.compliance_score)).filter(
        Agent.compliance_score.isnot(None)
    )
    if vendor_ids:
        compliance_avg_query = compliance_avg_query.filter(Agent.vendor_id.in_(vendor_ids))
    compliance_avg = compliance_avg_query.scalar()
    
    # Agents by type (filtered by tenant)
    agents_by_type = {}
    type_query = db.query(Agent.type, func.count(Agent.id))
    if vendor_ids:
        type_query = type_query.filter(Agent.vendor_id.in_(vendor_ids))
    type_counts = type_query.group_by(Agent.type).all()
    for agent_type, count in type_counts:
        agents_by_type[agent_type] = count
    
    # Recent activity (last 10 agents)
    recent_agents = agent_query.order_by(Agent.updated_at.desc()).limit(10).all()
    recent_activity = [
        {
            "type": "agent",
            "id": str(a.id),
            "name": a.name,
            "action": a.status,
            "timestamp": a.updated_at.isoformat() if a.updated_at else a.created_at.isoformat()
        }
        for a in recent_agents
    ]
    
    # Time series data
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Agent trends
    agent_trends = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        next_date = date + timedelta(days=1)
        count = agent_query.filter(
            and_(Agent.created_at >= date, Agent.created_at < next_date)
        ).count()
        agent_trends.append(TimeSeriesData(date=date.date().isoformat(), value=count))
    
    # Review trends
    review_trends = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        next_date = date + timedelta(days=1)
        count = review_query.filter(
            and_(Review.created_at >= date, Review.created_at < next_date)
        ).count()
        review_trends.append(TimeSeriesData(date=date.date().isoformat(), value=count))
    
    # Compliance trends (filtered by tenant)
    compliance_trends = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        next_date = date + timedelta(days=1)
        compliance_query = db.query(func.avg(Agent.compliance_score)).filter(
            and_(
                Agent.compliance_score.isnot(None),
                Agent.updated_at >= date,
                Agent.updated_at < next_date
            )
        )
        if vendor_ids:
            compliance_query = compliance_query.filter(Agent.vendor_id.in_(vendor_ids))
        avg = compliance_query.scalar()
        compliance_trends.append(TimeSeriesData(
            date=date.date().isoformat(),
            value=int(avg) if avg else 0
        ))
    
    return AnalyticsResponse(
        stats=DashboardStats(
            total_agents=total_agents,
            agents_by_status=agents_by_status,
            total_reviews=total_reviews,
            reviews_by_stage=reviews_by_stage,
            compliance_score_avg=float(compliance_avg) if compliance_avg else None,
            agents_by_type=agents_by_type,
            recent_activity=recent_activity
        ),
        agent_trends=agent_trends,
        review_trends=review_trends,
        compliance_trends=compliance_trends
    )


@router.get("/reports/agents")
async def get_agent_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate agent report"""
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to generate agent reports"
        )
    
    query = db.query(Agent)
    
    # Filter by tenant - ALL users must filter by tenant
    from app.models.vendor import Vendor
    vendors = db.query(Vendor).filter(Vendor.tenant_id == effective_tenant_id).all()
    vendor_ids = [v.id for v in vendors]
    if vendor_ids:
        query = query.filter(Agent.vendor_id.in_(vendor_ids))
    else:
        # No vendors in tenant, return empty report
        return {
            "report_type": "agents",
            "generated_at": datetime.utcnow().isoformat(),
            "filters": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "status": status_filter
            },
            "total": 0,
            "agents": []
        }
    
    if start_date:
        query = query.filter(Agent.created_at >= start_date)
    if end_date:
        query = query.filter(Agent.created_at <= end_date)
    if status_filter:
        query = query.filter(Agent.status == status_filter)
    
    agents = query.all()
    
    return {
        "report_type": "agents",
        "generated_at": datetime.utcnow().isoformat(),
        "filters": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "status": status_filter
        },
        "total": len(agents),
        "agents": [
            {
                "id": str(a.id),
                "name": a.name,
                "type": a.type,
                "status": a.status,
                "compliance_score": a.compliance_score,
                "created_at": a.created_at.isoformat(),
                "submission_date": a.submission_date.isoformat() if a.submission_date else None
            }
            for a in agents
        ]
    }


class AIPostureDashboardResponse(BaseModel):
    """AI Posture Dashboard Response"""
    # Model usage
    model_usage: Dict[str, Any]  # {vendor: {model: count}}
    total_models_in_use: int
    unique_vendors: int
    
    # Risk analysis
    risk_distribution: Dict[str, int]  # {risk_level: count}
    risk_by_model: Dict[str, Dict[str, Any]]  # {model: {avg_risk, count, agents}}
    high_risk_agents: List[Dict[str, Any]]
    
    # Compliance analysis
    compliance_distribution: Dict[str, int]  # {compliance_level: count}
    compliance_by_model: Dict[str, Dict[str, Any]]
    compliance_checks_summary: Dict[str, int]  # {status: count}
    active_compliance_frameworks: List[str]
    
    # Deployment analysis
    deployment_distribution: Dict[str, int]  # {deployment_type: count}
    deployment_by_model: Dict[str, Dict[str, Any]]
    
    # Data sharing analysis
    data_sharing_analysis: Dict[str, Any]  # PII, PHI, financial data sharing
    data_classification_heatmap: List[Dict[str, Any]]  # For heatmap visualization
    
    # Integration analysis
    integration_connections: Dict[str, Any]
    connection_types: Dict[str, int]
    
    # Overall posture metrics
    overall_posture: Dict[str, Any]  # Overall risk score, compliance score, etc.
    posture_trends: List[Dict[str, Any]]  # Historical trends
    
    # Agent status breakdown
    agents_by_status: Dict[str, int]
    agents_by_category: Dict[str, int]
    
    # Cost and prompt analytics
    cost_analytics: Dict[str, Any]
    prompt_usage: Dict[str, Any]
    usage_by_role: Dict[str, Any]
    usage_by_department: Dict[str, Any]


@router.get("/ai-posture", response_model=AIPostureDashboardResponse)
async def get_ai_posture_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive AI posture dashboard data for CIO/CISO
    Shows model usage, risks, compliance, and overall runtime posture
    """
    # Check permissions - CIO/CISO roles
    allowed_roles = ["tenant_admin", "platform_admin", "security_reviewer", "compliance_reviewer"]
    if current_user.role.value not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This dashboard is for CIO/CISO roles only."
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to view AI posture dashboard"
        )
    
    # Base query - filter by tenant
    agent_query = db.query(Agent).join(AgentMetadata, Agent.id == AgentMetadata.agent_id)
    vendor_query = db.query(Vendor)
    
    # ALL users must filter by tenant
    vendors = vendor_query.filter(Vendor.tenant_id == effective_tenant_id).all()
    vendor_ids = [v.id for v in vendors]
    if vendor_ids:
        agent_query = agent_query.filter(Agent.vendor_id.in_(vendor_ids))
    else:
        # No vendors in tenant, return empty dashboard
        return AIPostureDashboardResponse(
            model_usage={},
            total_models_in_use=0,
            unique_vendors=0,
            risk_distribution={},
            risk_by_model={},
            high_risk_agents=[],
            compliance_distribution={},
            compliance_by_model={},
            compliance_checks_summary={},
            active_compliance_frameworks=[],
            deployment_distribution={},
            deployment_by_model={},
            data_sharing_analysis={},
            data_classification_heatmap=[],
            integration_connections={},
            connection_types={},
            overall_posture={},
            posture_trends=[],
            agents_by_status={},
            agents_by_category={},
            cost_analytics={},
            prompt_usage={},
            usage_by_role={},
            usage_by_department={}
        )
    
    # Get all agents with metadata
    agents_with_metadata = agent_query.all()
    
    # 1. MODEL USAGE ANALYSIS
    model_usage = {}
    model_risk_data = {}
    model_compliance_data = {}
    model_deployment_data = {}
    unique_vendors_set = set()
    total_models = 0
    
    for agent in agents_with_metadata:
        metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
        if not metadata or not metadata.llm_vendor:
            continue
        
        vendor = metadata.llm_vendor
        model = metadata.llm_model or "Unknown"
        unique_vendors_set.add(vendor)
        
        if vendor not in model_usage:
            model_usage[vendor] = {}
        if model not in model_usage[vendor]:
            model_usage[vendor][model] = 0
            model_risk_data[f"{vendor}/{model}"] = {"risks": [], "count": 0, "agents": []}
            model_compliance_data[f"{vendor}/{model}"] = {"scores": [], "count": 0, "agents": []}
            model_deployment_data[f"{vendor}/{model}"] = {}
        
        model_usage[vendor][model] += 1
        total_models += 1
        
        # Collect risk data
        if agent.risk_score is not None:
            model_risk_data[f"{vendor}/{model}"]["risks"].append(agent.risk_score)
            model_risk_data[f"{vendor}/{model}"]["agents"].append({
                "id": str(agent.id),
                "name": agent.name,
                "risk_score": agent.risk_score
            })
        model_risk_data[f"{vendor}/{model}"]["count"] += 1
        
        # Collect compliance data
        if agent.compliance_score is not None:
            model_compliance_data[f"{vendor}/{model}"]["scores"].append(agent.compliance_score)
            model_compliance_data[f"{vendor}/{model}"]["agents"].append({
                "id": str(agent.id),
                "name": agent.name,
                "compliance_score": agent.compliance_score
            })
        model_compliance_data[f"{vendor}/{model}"]["count"] += 1
        
        # Deployment type
        if metadata.deployment_type:
            if metadata.deployment_type not in model_deployment_data[f"{vendor}/{model}"]:
                model_deployment_data[f"{vendor}/{model}"][metadata.deployment_type] = 0
            model_deployment_data[f"{vendor}/{model}"][metadata.deployment_type] += 1
    
    # Calculate averages for model risk and compliance
    risk_by_model = {}
    for key, data in model_risk_data.items():
        if data["risks"]:
            avg_risk = sum(data["risks"]) / len(data["risks"])
            risk_by_model[key] = {
                "avg_risk": round(avg_risk, 2),
                "count": data["count"],
                "agents": data["agents"][:5]  # Top 5 agents
            }
    
    compliance_by_model = {}
    for key, data in model_compliance_data.items():
        if data["scores"]:
            avg_compliance = sum(data["scores"]) / len(data["scores"])
            compliance_by_model[key] = {
                "avg_compliance": round(avg_compliance, 2),
                "count": data["count"],
                "agents": data["agents"][:5]
            }
    
    # 2. RISK DISTRIBUTION
    risk_distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0, "unknown": 0}
    high_risk_agents = []
    
    for agent in agents_with_metadata:
        if agent.risk_score is None:
            risk_distribution["unknown"] += 1
            continue
        
        if agent.risk_score <= 3:
            risk_level = "low"
        elif agent.risk_score <= 6:
            risk_level = "medium"
        elif agent.risk_score <= 8:
            risk_level = "high"
        else:
            risk_level = "critical"
        
        risk_distribution[risk_level] += 1
        
        if agent.risk_score >= 7:
            metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
            high_risk_agents.append({
                "id": str(agent.id),
                "name": agent.name,
                "risk_score": agent.risk_score,
                "compliance_score": agent.compliance_score,
                "llm_vendor": metadata.llm_vendor if metadata else None,
                "llm_model": metadata.llm_model if metadata else None,
                "status": agent.status
            })
    
    # Sort by risk score descending
    high_risk_agents.sort(key=lambda x: x["risk_score"] or 0, reverse=True)
    high_risk_agents = high_risk_agents[:20]  # Top 20
    
    # 3. COMPLIANCE DISTRIBUTION
    compliance_distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "unknown": 0}
    
    for agent in agents_with_metadata:
        if agent.compliance_score is None:
            compliance_distribution["unknown"] += 1
            continue
        
        if agent.compliance_score >= 90:
            compliance_level = "excellent"
        elif agent.compliance_score >= 75:
            compliance_level = "good"
        elif agent.compliance_score >= 60:
            compliance_level = "fair"
        else:
            compliance_level = "poor"
        
        compliance_distribution[compliance_level] += 1
    
    # Compliance checks summary - filter by tenant
    compliance_checks_query = db.query(ComplianceCheck)
    if vendor_ids:
        compliance_checks_query = compliance_checks_query.join(Agent).filter(
            Agent.vendor_id.in_(vendor_ids)
        )
    
    compliance_checks_summary = {}
    for status in ComplianceCheckStatus:
        count = compliance_checks_query.filter(ComplianceCheck.status == status.value).count()
        compliance_checks_summary[status.value] = count
    
    # Active compliance frameworks (from ComplianceFramework model)
    try:
        from app.models.compliance_framework import ComplianceFramework
        active_frameworks = db.query(ComplianceFramework.code).filter(
            ComplianceFramework.is_active == True,
            ComplianceFramework.status == 'active',
            ComplianceFramework.code.isnot(None)
        ).distinct().all()
        active_compliance_frameworks = [f[0] for f in active_frameworks if f[0]]
    except Exception as e:
        logger.warning(f"Error querying compliance frameworks: {e}")
        # Fallback: try to get from agent framework links
        try:
            from app.models.compliance_framework import AgentFrameworkLink
            framework_links = db.query(AgentFrameworkLink.framework_id).distinct().all()
            if framework_links:
                from app.models.compliance_framework import ComplianceFramework
                framework_ids = [link[0] for link in framework_links]
                frameworks = db.query(ComplianceFramework.code).filter(
                    ComplianceFramework.id.in_(framework_ids),
                    ComplianceFramework.is_active == True
                ).all()
                active_compliance_frameworks = [f[0] for f in frameworks if f[0]]
            else:
                active_compliance_frameworks = []
        except Exception as e2:
            logger.warning(f"Error in fallback framework query: {e2}")
            active_compliance_frameworks = []
    
    # 4. DEPLOYMENT DISTRIBUTION
    deployment_distribution = {"cloud": 0, "on_premise": 0, "hybrid": 0, "unknown": 0}
    
    for agent in agents_with_metadata:
        metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
        if not metadata or not metadata.deployment_type:
            deployment_distribution["unknown"] += 1
            continue
        
        deployment_type = metadata.deployment_type.lower()
        if deployment_type in deployment_distribution:
            deployment_distribution[deployment_type] += 1
        else:
            deployment_distribution["unknown"] += 1
    
    # 5. DATA SHARING ANALYSIS
    data_sharing_analysis = {
        "pii_sharing": 0,
        "phi_sharing": 0,
        "financial_data_sharing": 0,
        "biometric_data_sharing": 0,
        "total_agents_with_data_sharing": 0
    }
    
    data_classification_heatmap = []
    
    for agent in agents_with_metadata:
        metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
        if not metadata or not metadata.data_sharing_scope:
            continue
        
        scope = metadata.data_sharing_scope
        if isinstance(scope, dict):
            has_data_sharing = False
            heatmap_entry = {
                "agent_id": str(agent.id),
                "agent_name": agent.name,
                "llm_vendor": metadata.llm_vendor,
                "llm_model": metadata.llm_model,
                "pii": scope.get("shares_pii", False),
                "phi": scope.get("shares_phi", False),
                "financial": scope.get("shares_financial_data", False),
                "biometric": scope.get("shares_biometric_data", False),
                "risk_score": agent.risk_score,
                "compliance_score": agent.compliance_score
            }
            
            if scope.get("shares_pii"):
                data_sharing_analysis["pii_sharing"] += 1
                has_data_sharing = True
            if scope.get("shares_phi"):
                data_sharing_analysis["phi_sharing"] += 1
                has_data_sharing = True
            if scope.get("shares_financial_data"):
                data_sharing_analysis["financial_data_sharing"] += 1
                has_data_sharing = True
            if scope.get("shares_biometric_data"):
                data_sharing_analysis["biometric_data_sharing"] += 1
                has_data_sharing = True
            
            if has_data_sharing:
                data_sharing_analysis["total_agents_with_data_sharing"] += 1
                data_classification_heatmap.append(heatmap_entry)
    
    # 6. INTEGRATION CONNECTIONS - filter by tenant
    connections_query = db.query(AgentConnection)
    if vendor_ids:
        connections_query = connections_query.join(Agent).filter(
            Agent.vendor_id.in_(vendor_ids)
        )
    
    total_connections = connections_query.count()
    connection_types = {}
    connection_type_counts = db.query(
        AgentConnection.connection_type,
        func.count(AgentConnection.id)
    ).group_by(AgentConnection.connection_type).all()
    
    for conn_type, count in connection_type_counts:
        connection_types[conn_type] = count
    
    integration_connections = {
        "total_connections": total_connections,
        "by_type": connection_types,
        "encrypted_connections": connections_query.filter(AgentConnection.is_encrypted == True).count(),
        "active_connections": connections_query.filter(AgentConnection.is_active == True).count()
    }
    
    # 7. AGENT STATUS AND CATEGORY BREAKDOWN
    agents_by_status = {}
    for status_val in AgentStatus:
        count = agent_query.filter(Agent.status == status_val.value).count()
        agents_by_status[status_val.value] = count
    
    agents_by_category = {}
    category_counts = db.query(Agent.category, func.count(Agent.id)).filter(
        Agent.category.isnot(None)
    ).group_by(Agent.category).all()
    for category, count in category_counts:
        agents_by_category[category or "uncategorized"] = count
    
    # 8. OVERALL POSTURE METRICS
    all_agents = agent_query.all()
    total_agents_count = len(all_agents)
    
    avg_risk = None
    avg_compliance = None
    if all_agents:
        risk_scores = [a.risk_score for a in all_agents if a.risk_score is not None]
        compliance_scores = [a.compliance_score for a in all_agents if a.compliance_score is not None]
        
        if risk_scores:
            avg_risk = sum(risk_scores) / len(risk_scores)
        if compliance_scores:
            avg_compliance = sum(compliance_scores) / len(compliance_scores)
    
    # Calculate overall posture score (0-100)
    posture_score = 0
    if avg_compliance is not None:
        posture_score += avg_compliance * 0.6  # 60% weight on compliance
    if avg_risk is not None:
        # Lower risk = higher posture (invert risk score, scale to 0-100)
        risk_component = (10 - avg_risk) * 10 * 0.4  # 40% weight on risk
        posture_score += risk_component
    
    overall_posture = {
        "posture_score": round(posture_score, 2),
        "avg_risk_score": round(avg_risk, 2) if avg_risk else None,
        "avg_compliance_score": round(avg_compliance, 2) if avg_compliance else None,
        "total_agents": total_agents_count,
        "approved_agents": agents_by_status.get("approved", 0),
        "in_review_agents": agents_by_status.get("in_review", 0) + agents_by_status.get("submitted", 0),
        "posture_level": (
            "excellent" if posture_score >= 85 else
            "good" if posture_score >= 70 else
            "fair" if posture_score >= 55 else
            "needs_improvement"
        )
    }
    
    # Posture trends (last 30 days)
    posture_trends = []
    end_date = datetime.utcnow()
    for i in range(30, 0, -1):
        date = end_date - timedelta(days=i)
        next_date = date + timedelta(days=1)
        
        day_agents = agent_query.filter(
            and_(Agent.created_at <= next_date)
        ).all()
        
        if day_agents:
            day_risk_scores = [a.risk_score for a in day_agents if a.risk_score is not None]
            day_compliance_scores = [a.compliance_score for a in day_agents if a.compliance_score is not None]
            
            day_avg_risk = sum(day_risk_scores) / len(day_risk_scores) if day_risk_scores else None
            day_avg_compliance = sum(day_compliance_scores) / len(day_compliance_scores) if day_compliance_scores else None
            
            day_posture = 0
            if day_avg_compliance:
                day_posture += day_avg_compliance * 0.6
            if day_avg_risk:
                day_posture += (10 - day_avg_risk) * 10 * 0.4
            
            posture_trends.append({
                "date": date.date().isoformat(),
                "posture_score": round(day_posture, 2),
                "avg_risk": round(day_avg_risk, 2) if day_avg_risk else None,
                "avg_compliance": round(day_avg_compliance, 2) if day_avg_compliance else None,
                "agent_count": len(day_agents)
            })
    
    # 9. COST AND PROMPT ANALYTICS
    cost_analytics = {
        "total_cost": 0.0,
        "cost_by_model": {},
        "cost_by_agent": {},
        "cost_trends": [],
        "monthly_cost": 0.0,
        "daily_cost": 0.0
    }
    
    prompt_usage_data = {
        "total_requests": 0,
        "total_tokens": 0,
        "requests_by_model": {},
        "tokens_by_model": {},
        "usage_trends": []
    }
    
    usage_by_role = {}
    usage_by_department = {}
    
    # Query prompt usage if table exists - filter by tenant
    try:
        prompt_query = db.query(PromptUsage)
        if effective_tenant_id:
            prompt_query = prompt_query.filter(PromptUsage.tenant_id == effective_tenant_id)
        
        # Get last 30 days of usage
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_prompts = prompt_query.filter(PromptUsage.created_at >= thirty_days_ago).all()
        
        # Calculate total cost
        total_cost = sum(float(p.total_cost or 0) for p in recent_prompts)
        cost_analytics["total_cost"] = round(total_cost, 2)
        
        # Cost by model
        cost_by_model = {}
        for prompt in recent_prompts:
            model_key = f"{prompt.model_vendor}/{prompt.model_name}"
            if model_key not in cost_by_model:
                cost_by_model[model_key] = 0.0
            cost_by_model[model_key] += float(prompt.total_cost or 0)
        cost_analytics["cost_by_model"] = {k: round(v, 2) for k, v in cost_by_model.items()}
        
        # Cost by agent
        cost_by_agent = {}
        for prompt in recent_prompts:
            agent_id = str(prompt.agent_id)
            if agent_id not in cost_by_agent:
                cost_by_agent[agent_id] = {"cost": 0.0, "requests": 0, "tokens": 0}
            cost_by_agent[agent_id]["cost"] += float(prompt.total_cost or 0)
            cost_by_agent[agent_id]["requests"] += 1
            cost_by_agent[agent_id]["tokens"] += prompt.total_tokens or 0
        
        # Get agent names
        agent_ids = [UUID(agent_id) for agent_id in cost_by_agent.keys()]
        agents_map = {str(a.id): a.name for a in db.query(Agent).filter(Agent.id.in_(agent_ids)).all()}
        cost_analytics["cost_by_agent"] = {
            agents_map.get(agent_id, agent_id): {
                "cost": round(data["cost"], 2),
                "requests": data["requests"],
                "tokens": data["tokens"]
            }
            for agent_id, data in cost_by_agent.items()
        }
        
        # Cost trends (last 30 days)
        cost_trends = []
        for i in range(30, 0, -1):
            date = datetime.utcnow() - timedelta(days=i)
            next_date = date + timedelta(days=1)
            day_prompts = [p for p in recent_prompts if date <= p.created_at < next_date]
            day_cost = sum(float(p.total_cost or 0) for p in day_prompts)
            cost_trends.append({
                "date": date.date().isoformat(),
                "cost": round(day_cost, 2),
                "requests": len(day_prompts)
            })
        cost_analytics["cost_trends"] = cost_trends
        
        # Monthly and daily costs
        today = datetime.utcnow().date()
        today_prompts = [p for p in recent_prompts if p.created_at.date() == today]
        cost_analytics["daily_cost"] = round(sum(float(p.total_cost or 0) for p in today_prompts), 2)
        
        this_month_start = datetime.utcnow().replace(day=1).date()
        month_prompts = [p for p in recent_prompts if p.created_at.date() >= this_month_start]
        cost_analytics["monthly_cost"] = round(sum(float(p.total_cost or 0) for p in month_prompts), 2)
        
        # Prompt usage statistics
        prompt_usage_data["total_requests"] = len(recent_prompts)
        prompt_usage_data["total_tokens"] = sum(p.total_tokens or 0 for p in recent_prompts)
        
        # Requests and tokens by model
        requests_by_model = {}
        tokens_by_model = {}
        for prompt in recent_prompts:
            model_key = f"{prompt.model_vendor}/{prompt.model_name}"
            requests_by_model[model_key] = requests_by_model.get(model_key, 0) + 1
            tokens_by_model[model_key] = tokens_by_model.get(model_key, 0) + (prompt.total_tokens or 0)
        
        prompt_usage_data["requests_by_model"] = requests_by_model
        prompt_usage_data["tokens_by_model"] = tokens_by_model
        
        # Usage trends
        usage_trends = []
        for i in range(30, 0, -1):
            date = datetime.utcnow() - timedelta(days=i)
            next_date = date + timedelta(days=1)
            day_prompts = [p for p in recent_prompts if date <= p.created_at < next_date]
            usage_trends.append({
                "date": date.date().isoformat(),
                "requests": len(day_prompts),
                "tokens": sum(p.total_tokens or 0 for p in day_prompts)
            })
        prompt_usage_data["usage_trends"] = usage_trends
        
        # Usage by role
        role_usage = {}
        for prompt in recent_prompts:
            if prompt.user_id:
                user = db.query(User).filter(User.id == prompt.user_id).first()
                if user:
                    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
                    if role not in role_usage:
                        role_usage[role] = {"requests": 0, "cost": 0.0, "tokens": 0}
                    role_usage[role]["requests"] += 1
                    role_usage[role]["cost"] += float(prompt.total_cost or 0)
                    role_usage[role]["tokens"] += prompt.total_tokens or 0
        usage_by_role = {k: {**v, "cost": round(v["cost"], 2)} for k, v in role_usage.items()}
        
        # Usage by department
        dept_usage = {}
        for prompt in recent_prompts:
            dept = prompt.department or "Unknown"
            if dept not in dept_usage:
                dept_usage[dept] = {"requests": 0, "cost": 0.0, "tokens": 0, "users": set()}
            dept_usage[dept]["requests"] += 1
            dept_usage[dept]["cost"] += float(prompt.total_cost or 0)
            dept_usage[dept]["tokens"] += prompt.total_tokens or 0
            if prompt.user_id:
                dept_usage[dept]["users"].add(str(prompt.user_id))
        
        usage_by_department = {
            k: {
                "requests": v["requests"],
                "cost": round(v["cost"], 2),
                "tokens": v["tokens"],
                "user_count": len(v["users"])
            }
            for k, v in dept_usage.items()
        }
        
    except Exception as e:
        logger.warning(f"Error fetching prompt usage data: {str(e)}")
        # Tables might not exist yet, return empty data
    
    return AIPostureDashboardResponse(
        model_usage=model_usage,
        total_models_in_use=total_models,
        unique_vendors=len(unique_vendors_set),
        risk_distribution=risk_distribution,
        risk_by_model=risk_by_model,
        high_risk_agents=high_risk_agents,
        compliance_distribution=compliance_distribution,
        compliance_by_model=compliance_by_model,
        compliance_checks_summary=compliance_checks_summary,
        active_compliance_frameworks=active_compliance_frameworks,
        deployment_distribution=deployment_distribution,
        deployment_by_model=model_deployment_data,
        data_sharing_analysis=data_sharing_analysis,
        data_classification_heatmap=data_classification_heatmap,
        integration_connections=integration_connections,
        connection_types=connection_types,
        overall_posture=overall_posture,
        posture_trends=posture_trends,
        agents_by_status=agents_by_status,
        agents_by_category=agents_by_category,
        cost_analytics=cost_analytics,
        prompt_usage=prompt_usage_data,
        usage_by_role=usage_by_role,
        usage_by_department=usage_by_department
    )


class EcosystemMapNode(BaseModel):
    """Ecosystem map node"""
    id: str
    label: str
    type: str  # customer, vendor, llm_provider, agent, system
    metadata: Dict[str, Any] = {}


class EcosystemMapLink(BaseModel):
    """Ecosystem map link"""
    source: str
    target: str
    type: str  # uses, connects_to, provides
    metadata: Dict[str, Any] = {}


class EcosystemMapResponse(BaseModel):
    """Ecosystem map visualization data"""
    nodes: List[EcosystemMapNode]
    links: List[EcosystemMapLink]


@router.get("/ecosystem-map", response_model=EcosystemMapResponse)
async def get_ecosystem_map(
    filter_by: Optional[str] = Query(None, description="Filter by: customer, agent, vendor, llm_type, llm_vendor, department, category"),
    filter_value: Optional[str] = Query(None, description="Value to filter by (e.g., agent name, vendor name, LLM model)"),
    load_step: Optional[int] = Query(1, ge=1, le=5, description="Progressive loading step: 1=customer, 2=vendors, 3=agents, 4=llm, 5=systems"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get ecosystem map data for interactive visualization with progressive loading and filtering
    Shows customer in center, connected to vendors, LLM providers, bots/agents, and systems
    
    Progressive loading steps:
    1. Customer/Tenant (always loaded)
    2. Vendors
    3. Agents/Bots
    4. LLM Providers
    5. Systems/Connections
    """
    nodes = []
    links = []
    node_ids = set()
    
    # Get tenant information
    tenant_id = current_user.tenant_id
    if not tenant_id:
        # Platform admin - show all or return empty
        return EcosystemMapResponse(nodes=[], links=[])
    
    from app.models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return EcosystemMapResponse(nodes=[], links=[])
    
    # 1. Add customer/tenant as center node (always step 1)
    customer_node_id = f"tenant_{tenant_id}"
    nodes.append(EcosystemMapNode(
        id=customer_node_id,
        label=tenant.name or "Customer",
        type="customer",
        metadata={
            "tenant_id": str(tenant_id),
            "slug": tenant.slug,
            "status": tenant.status
        }
    ))
    node_ids.add(customer_node_id)
    
    # Apply filters
    vendor_filter = None
    agent_filter = None
    llm_filter = None
    department_filter = None
    category_filter = None
    
    if filter_by and filter_value:
        if filter_by == "vendor":
            vendor_filter = filter_value
        elif filter_by == "agent":
            agent_filter = filter_value
        elif filter_by == "llm_vendor":
            llm_filter = filter_value
        elif filter_by == "llm_type":
            llm_filter = filter_value
        elif filter_by == "department":
            department_filter = filter_value
        elif filter_by == "category":
            category_filter = filter_value
    
    vendor_map = {}
    agents: List[Agent] = []
    llm_provider_map = {}
    system_map = {}
    
    # 2. Get vendors (step 2)
    if load_step >= 2:
        vendor_query = db.query(Vendor).filter(Vendor.tenant_id == tenant_id)
        if vendor_filter:
            vendor_query = vendor_query.filter(
                Vendor.name.ilike(f"%{vendor_filter}%")
            )
        vendors = vendor_query.all()
        
        # Get assessment data for vendors
        from app.models.assessment import AssessmentAssignment
        from app.models.assessment_review import AssessmentReview
        
        vendor_assessments = {}
        vendor_reviews = {}
        
        if vendors:
            vendor_ids = [v.id for v in vendors]
            
            # Get current (active/in_progress/completed) assessments
            assignments = db.query(AssessmentAssignment).filter(
                AssessmentAssignment.tenant_id == tenant_id,
                AssessmentAssignment.vendor_id.in_(vendor_ids),
                AssessmentAssignment.status.in_(['in_progress', 'completed'])
            ).all()
            
            # Get latest reviews for completed assessments
            completed_assignment_ids = [a.id for a in assignments if a.status == 'completed']
            if completed_assignment_ids:
                reviews = db.query(AssessmentReview).filter(
                    AssessmentReview.assignment_id.in_(completed_assignment_ids),
                    AssessmentReview.tenant_id == tenant_id
                ).order_by(AssessmentReview.created_at.desc()).all()
                
                # Get the latest review for each assignment
                for review in reviews:
                    assignment_id = str(review.assignment_id)
                    if assignment_id not in vendor_reviews:
                        vendor_reviews[assignment_id] = review
            
            # Group assessments by vendor
            for assignment in assignments:
                vendor_id_str = str(assignment.vendor_id)
                if vendor_id_str not in vendor_assessments:
                    vendor_assessments[vendor_id_str] = []
                vendor_assessments[vendor_id_str].append(assignment)
        
        for vendor in vendors:
            vendor_id_str = str(vendor.id)
            vendor_node_id = f"vendor_{vendor.id}"
            vendor_map[vendor_id_str] = vendor_node_id
            
            # Get assessments for this vendor
            vendor_assignment_list = vendor_assessments.get(vendor_id_str, [])
            current_assessments = []
            is_cleared = None  # None = pending, True = cleared, False = not cleared
            latest_risk_score = None
            latest_risk_level = None
            assessment_count = len(vendor_assignment_list)
            
            # Check if vendor is cleared based on assessments
            if vendor_assignment_list:
                # Find the latest completed assessment with review
                latest_completed = None
                latest_review = None
                
                for assignment in vendor_assignment_list:
                    if assignment.status == 'completed':
                        assignment_id_str = str(assignment.id)
                        review = vendor_reviews.get(assignment_id_str)
                        if review:
                            if not latest_completed or (review.created_at and latest_review and review.created_at > latest_review.created_at):
                                latest_completed = assignment
                                latest_review = review
                
                if latest_review:
                    latest_risk_score = latest_review.risk_score
                    latest_risk_level = latest_review.risk_level
                    
                    # Vendor is cleared if:
                    # 1. Risk level is low or medium (or risk_score < 30)
                    # 2. Human decision is approved (if exists)
                    if latest_review.human_decision:
                        is_cleared = latest_review.human_decision == 'approved'
                    else:
                        # Use risk score/level to determine cleared status
                        if latest_risk_level:
                            is_cleared = latest_risk_level in ['low', 'medium']
                        elif latest_risk_score is not None:
                            is_cleared = latest_risk_score < 30
                else:
                    # Has assessments but none completed yet - pending
                    is_cleared = None
                
                # Build assessment summary
                for assignment in vendor_assignment_list:
                    assignment_id_str = str(assignment.id)
                    review = vendor_reviews.get(assignment_id_str)
                    current_assessments.append({
                        "assignment_id": str(assignment.id),
                        "assessment_id": str(assignment.assessment_id),
                        "status": assignment.status,
                        "risk_score": review.risk_score if review else None,
                        "risk_level": review.risk_level if review else None,
                        "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None
                    })
            
            # Get security incidents/breaches for this vendor
            from app.models.security_incident import VendorSecurityTracking, SecurityIncident, IncidentType, IncidentSeverity
            security_incidents = []
            breach_count = 0
            cve_count = 0
            has_critical_incidents = False
            has_active_breaches = False
            has_active_cve_matches = False
            active_cve_count = 0
            latest_incident_date = None
            
            # Query VendorSecurityTracking for this vendor
            # Ensure tenant_id is UUID for comparison
            from uuid import UUID as UUIDType
            tenant_uuid = tenant_id if isinstance(tenant_id, UUIDType) else UUIDType(str(tenant_id))
            vendor_trackings = db.query(VendorSecurityTracking).filter(
                VendorSecurityTracking.vendor_id == vendor.id,
                VendorSecurityTracking.tenant_id == tenant_uuid
            ).all()
            
            for tracking in vendor_trackings:
                incident = db.query(SecurityIncident).filter(
                    SecurityIncident.id == tracking.incident_id
                ).first()
                if incident:
                    if incident.incident_type == IncidentType.DATA_BREACH:
                        breach_count += 1
                        if tracking.status == 'active':
                            has_active_breaches = True
                    elif incident.incident_type == IncidentType.CVE:
                        cve_count += 1
                        if tracking.status == 'active':
                            has_active_cve_matches = True
                            active_cve_count += 1
                    if incident.severity == IncidentSeverity.CRITICAL:
                        has_critical_incidents = True
                    security_incidents.append({
                        "incident_id": str(incident.id),
                        "external_id": incident.external_id,
                        "incident_type": incident.incident_type.value if hasattr(incident.incident_type, 'value') else str(incident.incident_type),
                        "title": incident.title,
                        "severity": incident.severity.value if hasattr(incident.severity, 'value') else str(incident.severity),
                        "cvss_score": incident.cvss_score,
                        "published_date": incident.published_date.isoformat() if incident.published_date else None,
                        "status": tracking.status,
                        "match_confidence": tracking.match_confidence
                    })
                    if incident.published_date and (not latest_incident_date or incident.published_date > latest_incident_date):
                        latest_incident_date = incident.published_date
            
            nodes.append(EcosystemMapNode(
                id=vendor_node_id,
                label=vendor.name,
                type="vendor",
                metadata={
                    "vendor_id": vendor_id_str,
                    "contact_email": vendor.contact_email,
                    "website": vendor.website,
                    "assessments": current_assessments,
                    "assessment_count": assessment_count,
                    "is_cleared": is_cleared,
                    "latest_risk_score": latest_risk_score,
                    "latest_risk_level": latest_risk_level,
                    # Security incident/breach information
                    "security_incidents": security_incidents,
                    "breach_count": breach_count,
                    "cve_count": cve_count,
                    "has_critical_incidents": has_critical_incidents,
                    "has_active_breaches": has_active_breaches,
                    "has_active_cve_matches": has_active_cve_matches,
                    "active_cve_count": active_cve_count,
                    "latest_incident_date": latest_incident_date.isoformat() if latest_incident_date else None,
                    "security_status": "clean" if not security_incidents else ("critical" if has_critical_incidents else ("breached" if has_active_breaches else ("at_risk" if has_active_cve_matches else "monitoring")))
                }
            ))
            node_ids.add(vendor_node_id)
            # Link vendor to customer
            links.append(EcosystemMapLink(
                source=customer_node_id,
                target=vendor_node_id,
                type="works_with",
                metadata={}
            ))
    
    # 3. Get agents (step 3)
    if load_step >= 3 and vendor_map:
        agent_ids = [UUID(vid) for vid in vendor_map.keys()]
        agent_query = db.query(Agent).filter(Agent.vendor_id.in_(agent_ids))
        
        if agent_filter:
            agent_query = agent_query.filter(Agent.name.ilike(f"%{agent_filter}%"))
        if category_filter:
            agent_query = agent_query.filter(Agent.category == category_filter)
        
        # Department filter - filter agents by users in that department
        if department_filter:
            from app.models.user import User
            # Get users in the department
            dept_users = db.query(User).filter(
                User.tenant_id == tenant_id,
                User.department == department_filter,
                User.is_active == True
            ).all()
            # Note: In a full implementation, you'd link agents to users via ownership/requested_by
            # For now, we'll apply the filter if there's a way to link them
            # This is a placeholder - you may need to add an ownership field to agents
            pass  # Department filtering would require agent ownership tracking
        
        agents = agent_query.all()
        
        for agent in agents:
            # Add agent/bot node
            agent_node_id = f"agent_{agent.id}"
            nodes.append(EcosystemMapNode(
                id=agent_node_id,
                label=agent.name,
                type="agent",
                metadata={
                    "agent_id": str(agent.id),
                    "type": agent.type,
                    "category": agent.category,
                    "subcategory": agent.subcategory,
                    "status": agent.status,
                    "version": agent.version
                }
            ))
            node_ids.add(agent_node_id)
            
            # Link agent to vendor
            vendor_node_id = vendor_map.get(str(agent.vendor_id))
            if vendor_node_id:
                links.append(EcosystemMapLink(
                    source=vendor_node_id,
                    target=agent_node_id,
                    type="provides",
                    metadata={}
                ))
    
    # 4. Get LLM providers (step 4)
    if load_step >= 4 and agents:
        agent_ids_for_llm = [a.id for a in agents]
        metadata_query = db.query(AgentMetadata).filter(
            AgentMetadata.agent_id.in_(agent_ids_for_llm),
            AgentMetadata.llm_vendor.isnot(None)
        )
        
        if llm_filter:
            metadata_query = metadata_query.filter(
                AgentMetadata.llm_vendor.ilike(f"%{llm_filter}%")
            )
        
        agent_metadata_list = metadata_query.all()
        
        for metadata in agent_metadata_list:
            agent = next((a for a in agents if a.id == metadata.agent_id), None)
            if not agent:
                continue
                
            agent_node_id = f"agent_{agent.id}"
            llm_vendor_name = metadata.llm_vendor
            llm_model = metadata.llm_model or "Unknown"
            llm_node_id = f"llm_{llm_vendor_name.lower().replace(' ', '_').replace('/', '_')}_{llm_model.lower().replace(' ', '_')}"
            
            if llm_node_id not in node_ids:
                nodes.append(EcosystemMapNode(
                    id=llm_node_id,
                    label=f"{llm_vendor_name} ({llm_model})",
                    type="llm_provider",
                    metadata={
                        "vendor": llm_vendor_name,
                        "model": llm_model,
                        "llm_type": metadata.llm_model
                    }
                ))
                node_ids.add(llm_node_id)
                llm_provider_map[llm_vendor_name] = llm_node_id
            
            # Link agent to LLM provider
            links.append(EcosystemMapLink(
                source=agent_node_id,
                target=llm_node_id,
                type="uses",
                metadata={
                    "model": llm_model
                }
            ))
    
    # 5. Get systems/connections (step 5)
    if load_step >= 5 and agents:
        from app.models.agent_connection import AgentConnection
        agent_ids_for_systems = [a.id for a in agents]
        connections = db.query(AgentConnection).filter(
            AgentConnection.agent_id.in_(agent_ids_for_systems),
            AgentConnection.is_active == True
        ).all()
        
        for connection in connections:
            agent = next((a for a in agents if a.id == connection.agent_id), None)
            if not agent:
                continue
                
            agent_node_id = f"agent_{agent.id}"
            system_name = connection.app_name or connection.name
            system_node_id = f"system_{system_name.lower().replace(' ', '_').replace('/', '_')}"
            
            if system_node_id not in node_ids:
                nodes.append(EcosystemMapNode(
                    id=system_node_id,
                    label=system_name,
                    type="system",
                    metadata={
                        "app_type": connection.app_type,
                        "connection_type": connection.connection_type,
                        "protocol": connection.protocol
                    }
                ))
                node_ids.add(system_node_id)
                system_map[system_name] = system_node_id
            
            # Link agent to system
            links.append(EcosystemMapLink(
                source=agent_node_id,
                target=system_node_id,
                type="connects_to",
                metadata={
                    "protocol": connection.protocol,
                    "app_type": connection.app_type
                }
            ))
    
    # Return response with metadata about loading progress
    return EcosystemMapResponse(
        nodes=nodes,
        links=links
    )

