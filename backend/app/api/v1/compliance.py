"""
Compliance checking API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.agent import Agent
from app.models.policy import Policy, ComplianceCheck, ComplianceCheckStatus
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.compliance_service import compliance_service
from app.core.feature_gating import FeatureGate

router = APIRouter(prefix="/compliance", tags=["compliance"])


class ComplianceCheckResponse(BaseModel):
    """Compliance check response schema"""
    agent_id: str
    compliance_score: int
    checks: List[Dict]
    gaps: List[Dict]
    recommendations: List[Dict]
    timestamp: str


class PolicyCreate(BaseModel):
    """Policy creation schema"""
    name: str
    category: str  # security, compliance, technical, business
    type: str  # regulatory, internal, standard
    region: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    framework_code: Optional[str] = None  # Compliance framework code (e.g., "NERC_CIP", "HIPAA", "GDPR")
    rules: Optional[Dict] = None
    requirements: Optional[List] = None  # Can be List[str] or List[Dict] with {"text": str, "enabled": bool}
    # Enforcement controls - what controls are being enforced
    enforcement_controls: Optional[List[Dict]] = None  # [{"control": "encryption", "type": "required", "description": "..."}]
    # Required attributes - what data must be gathered from agents
    required_attributes: Optional[List[Dict]] = None  # [{"attribute": "data_classification", "type": "string", "required": true}]
    # Qualification criteria - how agents are evaluated
    qualification_criteria: Optional[Dict] = None  # {"pass_threshold": 0.8, "checks": [...]}
    # Applicability criteria - when this policy applies to an agent
    applicability_criteria: Optional[Dict] = None  # {"data_types": ["healthcare"], "regions": ["US"], ...}


class PolicyUpdate(BaseModel):
    """Policy update schema - all fields optional"""
    name: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    region: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    rules: Optional[Dict] = None
    requirements: Optional[List] = None  # Can be List[str] or List[Dict] with {"text": str, "enabled": bool}
    enforcement_controls: Optional[List[Dict]] = None
    required_attributes: Optional[List[Dict]] = None
    qualification_criteria: Optional[Dict] = None
    applicability_criteria: Optional[Dict] = None
    is_active: Optional[bool] = None


class PolicyResponse(BaseModel):
    """Policy response schema"""
    id: str
    name: str
    category: str
    type: str
    region: Optional[str]
    description: Optional[str]
    version: Optional[str]
    is_active: bool
    created_at: str
    requirements: Optional[List[str]] = None
    rules: Optional[Dict] = None
    enforcement_controls: Optional[List[Dict]] = None
    required_attributes: Optional[List[Dict]] = None
    qualification_criteria: Optional[Dict] = None
    applicability_criteria: Optional[Dict] = None
    
    class Config:
        from_attributes = True


@router.post("/agents/{agent_id}/check", response_model=ComplianceCheckResponse)
async def check_agent_compliance(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run compliance check for an agent"""
    # Check feature gate: automated compliance
    if current_user.tenant_id:
        if not FeatureGate.is_feature_enabled(
            db, str(current_user.tenant_id), "automated_compliance", current_user
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Automated compliance checking is not available in your plan. Please upgrade."
            )
    
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions
    if current_user.role.value == "vendor_user":
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not vendor or agent.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    try:
        result = await compliance_service.check_agent_compliance(
            db=db,
            agent_id=str(agent_id),
            tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None
        )
        
        return ComplianceCheckResponse(**result)
    except Exception as e:
        logger.error(f"Compliance check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compliance check failed: {str(e)}"
        )


@router.get("/agents/{agent_id}/checks")
async def get_agent_compliance_checks(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get compliance check history for an agent with full policy details"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get compliance checks
    checks = db.query(ComplianceCheck).filter(
        ComplianceCheck.agent_id == agent_id
    ).order_by(ComplianceCheck.checked_at.desc()).all()
    
    # Build detailed response
    checks_data = []
    for check in checks:
        policy = db.query(Policy).filter(Policy.id == check.policy_id).first()
        check_data = {
            "id": str(check.id),
            "policy_id": str(check.policy_id),
            "policy_name": policy.name if policy else "Unknown Policy",
            "policy_description": policy.description if policy else None,
            "policy_category": policy.category if policy else None,
            "policy_type": policy.type if policy else None,
            "policy_region": policy.region if policy else None,
            "policy_version": policy.version if policy else None,
            "policy_requirements": policy.requirements if policy else [],
            "policy_rules": policy.rules if policy else {},
            "policy_enforcement_controls": policy.enforcement_controls if policy and policy.enforcement_controls else [],
            "policy_required_attributes": policy.required_attributes if policy and policy.required_attributes else [],
            "policy_qualification_criteria": policy.qualification_criteria if policy and policy.qualification_criteria else {},
            "evaluation_results": check.rag_context.get("evaluation_results", {}) if check.rag_context else {},
            "status": check.status,
            "check_type": check.check_type,
            "details": check.details,
            "evidence": check.evidence if check.evidence else [],
            "rag_context": check.rag_context if check.rag_context else {},
            "confidence_score": float(check.confidence_score) if check.confidence_score else None,
            "checked_at": check.checked_at.isoformat() if check.checked_at else None,
            "notes": check.notes
        }
        
        # Extract gap description from rag_context or details
        if check.rag_context and isinstance(check.rag_context, dict):
            # Try to extract gap information
            if "gap_description" in check.rag_context:
                check_data["gap_description"] = check.rag_context["gap_description"]
            if "severity" in check.rag_context:
                check_data["severity"] = check.rag_context["severity"]
        
        checks_data.append(check_data)
    
    return {
        "agent_id": str(agent_id),
        "checks": checks_data,
        "total": len(checks_data)
    }


@router.post("/policies", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    policy_data: PolicyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new policy (Admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin", "policy_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Auto-populate from framework if framework_code is provided
    from app.services.framework_policy_mapper import FrameworkPolicyMapper
    
    policy_dict = policy_data.dict()
    if policy_data.framework_code:
        policy_dict = FrameworkPolicyMapper.populate_policy_from_framework(
            policy_data.framework_code,
            policy_dict
        )
    
    # Create policy
    policy = Policy(
        tenant_id=current_user.tenant_id if current_user.role.value != "platform_admin" else None,
        name=policy_dict["name"],
        category=policy_dict["category"],
        type=policy_dict["type"],
        region=policy_dict.get("region"),
        description=policy_dict.get("description"),
        version=policy_dict.get("version"),
        rules=policy_dict.get("rules"),
        requirements=policy_dict.get("requirements"),
        enforcement_controls=policy_dict.get("enforcement_controls"),
        required_attributes=policy_dict.get("required_attributes"),
        qualification_criteria=policy_dict.get("qualification_criteria")
    )
    
    db.add(policy)
    db.commit()
    db.refresh(policy)
    
    return PolicyResponse(
        id=str(policy.id),
        name=policy.name,
        category=policy.category,
        type=policy.type,
        region=policy.region,
        description=policy.description,
        version=policy.version,
        is_active=policy.is_active,
        created_at=policy.created_at.isoformat(),
        requirements=policy.requirements if policy.requirements else [],
        rules=policy.rules if policy.rules else {},
        enforcement_controls=policy.enforcement_controls if policy.enforcement_controls else [],
        required_attributes=policy.required_attributes if policy.required_attributes else [],
        qualification_criteria=policy.qualification_criteria if policy.qualification_criteria else {},
        applicability_criteria=policy.applicability_criteria if policy.applicability_criteria else None
    )


@router.get("/policies", response_model=List[PolicyResponse])
async def list_policies(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List policies"""
    query = db.query(Policy).filter(Policy.is_active == True)
    
    # Filter by tenant
    if current_user.tenant_id:
        query = query.filter(
            (Policy.tenant_id == current_user.tenant_id) | (Policy.tenant_id.is_(None))
        )
    else:
        query = query.filter(Policy.tenant_id.is_(None))
    
    # Filter by category
    if category:
        query = query.filter(Policy.category == category)
    
    policies = query.order_by(Policy.created_at.desc()).all()
    
    return [
        PolicyResponse(
            id=str(p.id),
            name=p.name,
            category=p.category,
            type=p.type,
            region=p.region,
            description=p.description,
            version=p.version,
            is_active=p.is_active,
            created_at=p.created_at.isoformat(),
            requirements=p.requirements if p.requirements else [],
            rules=p.rules if p.rules else {},
            enforcement_controls=p.enforcement_controls if p.enforcement_controls else [],
            required_attributes=p.required_attributes if p.required_attributes else [],
            qualification_criteria=p.qualification_criteria if p.qualification_criteria else {},
            applicability_criteria=p.applicability_criteria if p.applicability_criteria else None
        )
        for p in policies
    ]


@router.patch("/policies/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: UUID,
    policy_data: PolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a policy (Admin only)"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin", "policy_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found"
        )
    
    # Check tenant access
    if current_user.role.value != "platform_admin":
        if policy.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Update fields (only provided fields)
    update_data = policy_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)
    
    policy.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(policy)
    
    return PolicyResponse(
        id=str(policy.id),
        name=policy.name,
        category=policy.category,
        type=policy.type,
        region=policy.region,
        description=policy.description,
        version=policy.version,
        is_active=policy.is_active,
        created_at=policy.created_at.isoformat(),
        requirements=policy.requirements if policy.requirements else [],
        rules=policy.rules if policy.rules else {},
        enforcement_controls=policy.enforcement_controls if policy.enforcement_controls else [],
        required_attributes=policy.required_attributes if policy.required_attributes else [],
        qualification_criteria=policy.qualification_criteria if policy.qualification_criteria else {},
        applicability_criteria=policy.applicability_criteria if policy.applicability_criteria else None
    )


@router.get("/policies/{policy_id}/enforcement")
async def get_policy_enforcement(
    policy_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get policy enforcement logic and measurement details"""
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found"
        )
    
    from app.services.policy_enforcement import policy_enforcement_engine
    
    enforcement = policy_enforcement_engine.get_enforcement_logic(policy)
    measurement = policy_enforcement_engine.explain_measurement(policy)
    
    return {
        "policy_id": str(policy_id),
        "policy_name": policy.name,
        "enforcement": enforcement,
        "measurement": measurement
    }


import logging
logger = logging.getLogger(__name__)

