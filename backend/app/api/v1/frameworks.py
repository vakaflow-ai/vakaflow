"""
Compliance Framework API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.compliance_framework import (
    ComplianceFramework, FrameworkRule, FrameworkRisk, 
    AgentFrameworkLink, RequirementResponse
)
from app.models.agent import Agent, AgentMetadata
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.requirement_matching_service import requirement_matching_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/frameworks", tags=["compliance-frameworks"])


# Request/Response Models
class FrameworkCreate(BaseModel):
    """Create framework schema"""
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    region: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    status: str = "active"


class FrameworkResponse(BaseModel):
    """Framework response schema"""
    id: str
    name: str
    code: str
    description: Optional[str]
    region: Optional[str]
    category: Optional[str]
    version: Optional[str]
    status: str
    is_active: bool
    
    class Config:
        from_attributes = True


class RiskCreate(BaseModel):
    """Create risk schema"""
    name: str
    code: str
    description: Optional[str] = None
    severity: str
    category: Optional[str] = None
    order: int = 0


class RiskResponse(BaseModel):
    """Risk response schema"""
    id: str
    name: str
    code: str
    description: Optional[str]
    severity: str
    category: Optional[str]
    order: int
    
    class Config:
        from_attributes = True


class RuleCreate(BaseModel):
    """Create rule schema"""
    name: str
    code: str
    description: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    requirement_text: str
    requirement_code: Optional[str] = None
    parent_rule_id: Optional[str] = None
    risk_id: Optional[str] = None
    order: int = 0


class RuleResponse(BaseModel):
    """Rule response schema"""
    id: str
    name: str
    code: str
    description: Optional[str]
    requirement_text: str
    requirement_code: Optional[str]
    order: int
    children: List['RuleResponse'] = []
    
    class Config:
        from_attributes = True


class RequirementTreeResponse(BaseModel):
    """Requirement tree response"""
    framework_id: str
    framework_name: str
    requirements: List[Dict[str, Any]]


class RequirementResponseCreate(BaseModel):
    """Create requirement response schema"""
    rule_id: str
    response_text: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    compliance_status: Optional[str] = None


# Framework endpoints
@router.post("", response_model=FrameworkResponse, status_code=status.HTTP_201_CREATED)
async def create_framework(
    framework_data: FrameworkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new compliance framework"""
    # Check permissions (platform admin or tenant admin)
    if current_user.role.value not in ["platform_admin", "tenant_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create frameworks"
        )
    
    # Check if code already exists
    existing = db.query(ComplianceFramework).filter(
        ComplianceFramework.code == framework_data.code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Framework code already exists"
        )
    
    framework = ComplianceFramework(
        tenant_id=current_user.tenant_id if current_user.role.value == "tenant_admin" else None,
        name=framework_data.name,
        code=framework_data.code,
        description=framework_data.description,
        region=framework_data.region,
        category=framework_data.category,
        version=framework_data.version,
        status=framework_data.status,
    )
    
    db.add(framework)
    db.commit()
    db.refresh(framework)
    
    return framework


@router.get("", response_model=List[FrameworkResponse])
async def list_frameworks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all compliance frameworks, filtered by tenant industry"""
    query = db.query(ComplianceFramework).filter(
        ComplianceFramework.is_active == True
    )
    
    # Tenant isolation: Non-platform-admins see only their tenant's frameworks + platform-wide
    if current_user.role.value != "platform_admin":
        if current_user.tenant_id:
            query = query.filter(
                (ComplianceFramework.tenant_id == current_user.tenant_id) |
                (ComplianceFramework.tenant_id == None)
            )
        else:
            # Users without tenant_id can only see platform-wide frameworks
            query = query.filter(ComplianceFramework.tenant_id == None)
    
    frameworks = query.order_by(ComplianceFramework.name).all()
    
    # Convert to response models
    result = []
    for framework in frameworks:
        try:
            result.append(FrameworkResponse(
                id=str(framework.id),
                name=framework.name,
                code=framework.code,
                description=framework.description,
                region=framework.region,
                category=framework.category,
                version=framework.version,
                status=framework.status,
                is_active=framework.is_active,
            ))
        except Exception as e:
            logger.error(f"Error serializing framework {framework.id}: {e}", exc_info=True)
            continue
    
    # Filter by tenant industry
    if current_user.tenant_id:
        from app.models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        # Safely get industry - handle case where column doesn't exist yet (before migration)
        tenant_industry = None
        if tenant:
            try:
                tenant_industry = getattr(tenant, 'industry', None)
            except Exception:
                # Column doesn't exist yet - migration not run
                tenant_industry = None
        
        if tenant_industry:
            filtered_frameworks = []
            for framework in result:
                # Find the original framework object to check applicable_industries
                original_fw = next((fw for fw in frameworks if str(fw.id) == framework.id), None)
                if not original_fw:
                    continue
                # If framework has no applicable_industries set, show it (backward compatibility)
                if not original_fw.applicable_industries:
                    filtered_frameworks.append(framework)
                # If framework applies to all industries
                elif "all" in original_fw.applicable_industries:
                    filtered_frameworks.append(framework)
                # If framework applies to tenant's industry
                elif tenant_industry in original_fw.applicable_industries:
                    filtered_frameworks.append(framework)
            result = filtered_frameworks
        else:
            # If tenant has no industry set, only show frameworks that apply to all or have no industry filter
            filtered_frameworks = []
            for framework in result:
                # Find the original framework object to check applicable_industries
                original_fw = next((fw for fw in frameworks if str(fw.id) == framework.id), None)
                if not original_fw:
                    continue
                if not original_fw.applicable_industries or "all" in original_fw.applicable_industries:
                    filtered_frameworks.append(framework)
            result = filtered_frameworks
    
    return result


@router.get("/agents/{agent_id}/requirements", response_model=List[RequirementTreeResponse])
async def get_agent_requirements(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get applicable requirements for an agent based on category and attributes"""
    # Get agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get vendor to check tenant (for access control)
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if vendor:
        # Tenant isolation - allow admins, approvers, and reviewers
        allowed_roles = [
            "platform_admin", 
            "tenant_admin", 
            "approver", 
            "security_reviewer", 
            "compliance_reviewer", 
            "technical_reviewer", 
            "business_reviewer",
            "vendor_user"  # Vendors can see requirements for their own agents
        ]
        
        # Vendor users can only see their own agents
        if current_user.role.value == "vendor_user":
            if current_user.email != vendor.contact_email:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        elif current_user.tenant_id != vendor.tenant_id and current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Get agent metadata
    metadata = db.query(AgentMetadata).filter(
        AgentMetadata.agent_id == agent.id
    ).first()
    
    # Get agent connections
    from app.models.agent_connection import AgentConnection
    connections = db.query(AgentConnection).filter(
        AgentConnection.agent_id == agent.id,
        AgentConnection.is_active == True
    ).all()
    
    # Get applicable frameworks
    frameworks = requirement_matching_service.get_applicable_frameworks(
        db=db,
        agent=agent,
        metadata=metadata,
        connections=connections
    )
    
    result = []
    for framework in frameworks:
        requirements = requirement_matching_service.get_applicable_requirements(
            db=db,
            agent=agent,
            framework_id=str(framework.id),
            metadata=metadata,
            connections=connections
        )
        
        result.append({
            "framework_id": str(framework.id),
            "framework_name": framework.name,
            "requirements": requirements
        })
    
    return result


@router.post("/agents/{agent_id}/responses", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def submit_requirement_responses(
    agent_id: UUID,
    responses: List[RequirementResponseCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit responses to requirements for an agent"""
    # Get agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions (vendor can only submit for their own agents)
    if current_user.role.value == "vendor_user":
        from app.models.vendor import Vendor
        vendor = db.query(Vendor).filter(Vendor.contact_email == current_user.email).first()
        if not vendor or agent.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    created_count = 0
    updated_count = 0
    
    for response_data in responses:
        # Check if response already exists
        existing = db.query(RequirementResponse).filter(
            RequirementResponse.agent_id == agent_id,
            RequirementResponse.rule_id == response_data.rule_id
        ).first()
        
        if existing:
            # Update existing response
            existing.response_text = response_data.response_text
            existing.evidence = response_data.evidence
            existing.compliance_status = response_data.compliance_status
            existing.submitted_by = current_user.id
            updated_count += 1
        else:
            # Create new response
            response = RequirementResponse(
                agent_id=agent_id,
                rule_id=response_data.rule_id,
                response_text=response_data.response_text,
                evidence=response_data.evidence,
                compliance_status=response_data.compliance_status,
                submitted_by=current_user.id,
            )
            db.add(response)
            created_count += 1
    
    db.commit()
    
    return {
        "message": "Responses submitted successfully",
        "created": created_count,
        "updated": updated_count
    }


@router.get("/agents/{agent_id}/responses")
async def get_requirement_responses(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get requirement responses for an agent"""
    # Get agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get vendor to check tenant
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    if vendor:
        # Tenant isolation - allow admins, approvers, and reviewers
        allowed_roles = [
            "platform_admin", 
            "tenant_admin", 
            "approver", 
            "security_reviewer", 
            "compliance_reviewer", 
            "technical_reviewer", 
            "business_reviewer"
        ]
        
        if current_user.tenant_id != vendor.tenant_id and current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    responses = db.query(RequirementResponse).filter(
        RequirementResponse.agent_id == agent_id
    ).all()
    
    return [
        {
            "id": str(r.id),
            "rule_id": str(r.rule_id),
            "response_text": r.response_text,
            "evidence": r.evidence,
            "compliance_status": r.compliance_status,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in responses
    ]

