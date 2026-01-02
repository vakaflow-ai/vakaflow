"""
Compliance checking service
"""
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.agent import Agent, AgentMetadata
from app.models.policy import Policy, ComplianceCheck, ComplianceCheckStatus, PolicyCategory
from app.models.user import User
from app.models.submission_requirement import SubmissionRequirementResponse
from app.services.rag_service import rag_service
import logging

logger = logging.getLogger(__name__)


class ComplianceService:
    """Service for automated compliance checking"""
    
    def __init__(self):
        """Initialize compliance service"""
        pass
    
    async def check_agent_compliance(
        self,
        db: Session,
        agent_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict:
        """
        Perform comprehensive compliance check for an agent
        
        Args:
            db: Database session
            agent_id: Agent ID
            tenant_id: Optional tenant ID for tenant-specific policies
        
        Returns:
            Compliance check results
        """
        # Get agent
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Get agent metadata
        metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
        
        # Build agent context
        agent_context = self._build_agent_context(agent, metadata)
        
        # Get relevant policies
        policies = self._get_relevant_policies(db, agent, tenant_id)
        
        # Perform compliance checks
        compliance_results = []
        gaps = []
        recommendations = []
        
        for policy in policies:
            # Query RAG for policy-specific information
            query = f"Compliance requirements for {policy.category} in {policy.region or 'global'}"
            rag_results = await rag_service.search(
                query=query,
                agent_id=agent_id,
                limit=5
            )
            
            # Perform compliance check
            check_result = await self._perform_compliance_check(
                db=db,
                agent=agent,
                metadata=metadata,
                policy=policy,
                rag_results=rag_results,
                agent_context=agent_context
            )
            
            compliance_results.append(check_result)
            
            # Store compliance check in database
            rag_context = {
                "query": query,
                "retrieved_documents": rag_results,
                "gap_description": check_result.get("gap_description"),
                "severity": check_result.get("severity"),
                "evaluation_rules": {
                    "policy_category": policy.category,
                    "policy_type": policy.type,
                    "checks_performed": self._get_checks_performed(policy, agent, metadata)
                }
            }
            
            compliance_check = ComplianceCheck(
                agent_id=agent.id,
                policy_id=policy.id,
                check_type="AUTOMATED",
                status=check_result["status"],
                details=check_result.get("details"),
                evidence=check_result.get("evidence"),
                rag_context=rag_context,
                confidence_score=check_result.get("confidence_score"),
                checked_at=datetime.utcnow()
            )
            db.add(compliance_check)
            
            # Collect gaps
            if check_result["status"] != ComplianceCheckStatus.PASS.value:
                gaps.append({
                    "policy_id": str(policy.id),
                    "policy_name": policy.name,
                    "category": policy.category,
                    "gap_description": check_result.get("gap_description"),
                    "severity": check_result.get("severity", "medium")
                })
        
        db.commit()
        
        # Get recommendations for gaps
        if gaps:
            recommendations = await self._get_recommendations(gaps, agent_context)
        
        # Calculate overall compliance score
        compliance_score = self._calculate_compliance_score(compliance_results)
        
        # Update agent compliance score
        agent.compliance_score = compliance_score
        db.commit()
        
        return {
            "agent_id": agent_id,
            "compliance_score": compliance_score,
            "checks": compliance_results,
            "gaps": gaps,
            "recommendations": recommendations,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _build_agent_context(self, agent: Agent, metadata: Optional[AgentMetadata]) -> str:
        """Build context string from agent information"""
        context_parts = [
            f"Agent Name: {agent.name}",
            f"Type: {agent.type}",
            f"Category: {agent.category or 'N/A'}",
            f"Version: {agent.version}",
            f"Description: {agent.description or 'N/A'}"
        ]
        
        if metadata:
            if metadata.capabilities:
                context_parts.append(f"Capabilities: {', '.join(metadata.capabilities)}")
            if metadata.data_types:
                context_parts.append(f"Data Types: {', '.join(metadata.data_types)}")
            if metadata.regions:
                context_parts.append(f"Regions: {', '.join(metadata.regions)}")
            if metadata.integrations:
                context_parts.append(f"Integrations: {', '.join(metadata.integrations)}")
        
        return "\n".join(context_parts)
    
    def _get_relevant_policies(
        self,
        db: Session,
        agent: Agent,
        tenant_id: Optional[str]
    ) -> List[Policy]:
        """
        Get relevant policies for an agent based on applicability criteria
        
        Policies are matched based on:
        - Data types (e.g., healthcare data -> HIPAA)
        - Industries/domains
        - Regions
        - Data classification levels
        - Other criteria defined in policy.applicability_criteria
        """
        query = db.query(Policy).filter(Policy.is_active == True)
        
        # Filter by tenant if provided
        if tenant_id:
            query = query.filter(
                (Policy.tenant_id == tenant_id) | (Policy.tenant_id.is_(None))
            )
        else:
            query = query.filter(Policy.tenant_id.is_(None))
        
        # Get agent metadata
        metadata = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent.id).first()
        
        # Get all active policies
        all_policies = query.all()
        
        # Filter policies based on applicability criteria
        applicable_policies = []
        
        for policy in all_policies:
            if self._is_policy_applicable(policy, agent, metadata, db):
                applicable_policies.append(policy)
        
        logger.info(
            f"Found {len(applicable_policies)} applicable policies out of {len(all_policies)} "
            f"for agent {agent.id} ({agent.name})"
        )
        
        return applicable_policies
    
    def _is_policy_applicable(
        self,
        policy: Policy,
        agent: Agent,
        metadata: Optional[AgentMetadata],
        db: Optional[Session] = None
    ) -> bool:
        """
        Determine if a policy is applicable to an agent
        
        Args:
            policy: Policy to check
            agent: Agent to check
            metadata: Agent metadata (optional)
        
        Returns:
            True if policy applies to agent, False otherwise
        """
        # If no applicability criteria defined, apply basic region matching
        if not policy.applicability_criteria:
            return self._check_basic_applicability(policy, agent, metadata)
        
        criteria = policy.applicability_criteria
        
        # Check data types
        if "data_types" in criteria and criteria["data_types"]:
            required_data_types = criteria["data_types"]
            if isinstance(required_data_types, list) and len(required_data_types) > 0:
                agent_data_types = []
                if metadata and metadata.data_types:
                    agent_data_types = metadata.data_types if isinstance(metadata.data_types, list) else []
                # Also check agent description and category for data type indicators
                agent_text = f"{agent.description or ''} {agent.category or ''}".lower()
                
                # Check if agent handles any of the required data types
                matches = False
                for required_type in required_data_types:
                    required_lower = required_type.lower()
                    # Check metadata
                    if any(required_lower in str(dt).lower() for dt in agent_data_types):
                        matches = True
                        break
                    # Check keywords in description/category
                    keywords_map = {
                        "healthcare": ["health", "medical", "patient", "phi", "hipaa", "clinical", "hospital"],
                        "financial": ["financial", "payment", "card", "pci", "transaction", "banking", "credit"],
                        "phi": ["phi", "protected health", "health information", "medical record"],
                        "pii": ["pii", "personally identifiable", "personal data", "individual"],
                        "payment": ["payment", "card", "pci", "transaction", "credit card"],
                    }
                    if required_lower in keywords_map:
                        if any(keyword in agent_text for keyword in keywords_map[required_lower]):
                            matches = True
                            break
                    # Direct match
                    if required_lower in agent_text:
                        matches = True
                        break
                
                if not matches:
                    logger.debug(
                        f"Policy {policy.name} not applicable: agent doesn't handle required data types {required_data_types}"
                    )
                    return False
        
        # Check industries/domains
        if "industries" in criteria and criteria["industries"]:
            required_industries = criteria["industries"]
            if isinstance(required_industries, list) and len(required_industries) > 0:
                agent_text = f"{agent.description or ''} {agent.category or ''}".lower()
                matches = any(
                    industry.lower() in agent_text 
                    for industry in required_industries
                )
                if not matches:
                    logger.debug(
                        f"Policy {policy.name} not applicable: agent doesn't match required industries {required_industries}"
                    )
                    return False
        
        # Check regions
        if "regions" in criteria and criteria["regions"]:
            required_regions = criteria["regions"]
            if isinstance(required_regions, list) and len(required_regions) > 0:
                agent_regions = []
                if metadata and metadata.regions:
                    agent_regions = metadata.regions if isinstance(metadata.regions, list) else []
                # Also check policy region
                if policy.region:
                    agent_regions.append(policy.region)
                
                matches = any(
                    region.lower() in [r.lower() for r in agent_regions] 
                    for region in required_regions
                ) if agent_regions else False
                
                if not matches:
                    logger.debug(
                        f"Policy {policy.name} not applicable: agent doesn't operate in required regions {required_regions}"
                    )
                    return False
        
        # Check data classification levels
        if "data_classification" in criteria and criteria["data_classification"]:
            required_classifications = criteria["data_classification"]
            if isinstance(required_classifications, list) and len(required_classifications) > 0:
                # Check submission requirement responses for data classification
                from app.models.submission_requirement import SubmissionRequirementResponse
                if db:
                    responses = db.query(SubmissionRequirementResponse).filter(
                        SubmissionRequirementResponse.agent_id == agent.id
                    ).all()
                else:
                    from app.core.database import SessionLocal
                    temp_db = SessionLocal()
                    try:
                        responses = temp_db.query(SubmissionRequirementResponse).filter(
                            SubmissionRequirementResponse.agent_id == agent.id
                        ).all()
                    finally:
                        temp_db.close()
                
                agent_classifications = []
                for response in responses:
                    if isinstance(response.value, dict):
                        if "data_classification" in response.value:
                            agent_classifications.append(str(response.value["data_classification"]).lower())
                    elif isinstance(response.value, str):
                        if "classification" in response.value.lower():
                            agent_classifications.append(response.value.lower())
                
                matches = any(
                    classification.lower() in agent_classifications
                    for classification in required_classifications
                ) if agent_classifications else False
                
                if not matches:
                    logger.debug(
                        f"Policy {policy.name} not applicable: agent doesn't handle required data classifications {required_classifications}"
                    )
                    return False
        
        # Check custom criteria (e.g., specific capabilities, integrations)
        if "custom_criteria" in criteria and criteria["custom_criteria"]:
            custom_criteria = criteria["custom_criteria"]
            if isinstance(custom_criteria, dict):
                for key, value in custom_criteria.items():
                    # Check agent metadata for custom criteria
                    if metadata:
                        metadata_dict = {
                            "capabilities": metadata.capabilities or [],
                            "integrations": metadata.integrations or [],
                            "data_types": metadata.data_types or [],
                        }
                        if key in metadata_dict:
                            if isinstance(value, list):
                                matches = any(v in metadata_dict[key] for v in value)
                            else:
                                matches = value in metadata_dict[key]
                            if not matches:
                                logger.debug(
                                    f"Policy {policy.name} not applicable: custom criteria {key}={value} not met"
                                )
                                return False
        
        # If all criteria pass, policy is applicable
        logger.debug(f"Policy {policy.name} is applicable to agent {agent.id}")
        return True
    
    def _check_basic_applicability(
        self,
        policy: Policy,
        agent: Agent,
        metadata: Optional[AgentMetadata]
    ) -> bool:
        """
        Basic applicability check when no explicit criteria are defined
        Uses region matching and policy name keywords
        """
        # Region matching
        if policy.region:
            if metadata and metadata.regions:
                agent_regions = metadata.regions if isinstance(metadata.regions, list) else []
                if policy.region not in agent_regions:
                    return False
        else:
            # Global policy - apply to all unless explicitly excluded
            pass
        
        # Policy name-based matching (fallback)
        policy_name_lower = policy.name.lower()
        agent_text = f"{agent.description or ''} {agent.category or ''}".lower()
        
        # HIPAA -> healthcare
        if "hipaa" in policy_name_lower:
            healthcare_keywords = ["health", "medical", "patient", "phi", "clinical", "hospital", "healthcare"]
            if not any(keyword in agent_text for keyword in healthcare_keywords):
                return False
        
        # PCI DSS -> payment/financial
        if "pci" in policy_name_lower:
            payment_keywords = ["payment", "card", "transaction", "financial", "credit"]
            if not any(keyword in agent_text for keyword in payment_keywords):
                return False
        
        # GDPR -> EU regions or personal data
        if "gdpr" in policy_name_lower:
            if metadata and metadata.regions:
                agent_regions = metadata.regions if isinstance(metadata.regions, list) else []
                if "EU" not in agent_regions and "Europe" not in agent_regions:
                    # Check if handles personal data
                    personal_data_keywords = ["personal", "pii", "data subject", "eu resident"]
                    if not any(keyword in agent_text for keyword in personal_data_keywords):
                        return False
        
        return True
    
    async def _perform_compliance_check(
        self,
        db: Session,
        agent: Agent,
        metadata: Optional[AgentMetadata],
        policy: Policy,
        rag_results: List[Dict],
        agent_context: str
    ) -> Dict:
        """
        Perform compliance check for a specific policy
        
        Evaluates agent against:
        - Enforcement controls (what controls are enforced)
        - Required attributes (what data must be gathered)
        - Qualification criteria (how agents are evaluated)
        """
        import json
        import re
        
        status = ComplianceCheckStatus.PASS.value
        gap_description = None
        severity = None
        confidence_score = 0.8
        evaluation_results = {
            "controls_evaluated": [],
            "attributes_checked": [],
            "qualification_checks": [],
            "overall_score": 0.0,
            "can_be_cleared": False
        }
        
        # Get agent submission requirement responses (if any)
        from app.models.submission_requirement import SubmissionRequirementResponse
        requirement_responses = {}
        responses = db.query(SubmissionRequirementResponse).filter(
            SubmissionRequirementResponse.agent_id == agent.id
        ).all()
        for response in responses:
            requirement_responses[response.requirement_id] = response.value
        
        # Evaluate against enforcement controls
        if policy.enforcement_controls:
            controls_passed = 0
            controls_total = len(policy.enforcement_controls)
            
            for control in policy.enforcement_controls:
                control_name = control.get("control", "Unknown")
                control_type = control.get("type", "required")
                validation_rule = control.get("validation_rule")
                
                # Evaluate control (simplified - in production would parse validation_rule)
                control_passed = False
                control_details = "Not evaluated"
                
                # Check if control is mentioned in agent context or metadata
                control_lower = control_name.lower()
                agent_text = f"{agent.description or ''} {agent_context}".lower()
                
                if control_lower in agent_text or any(
                    keyword in agent_text 
                    for keyword in control_lower.split()
                ):
                    control_passed = True
                    control_details = "Control mentioned in agent documentation"
                elif metadata:
                    # Check capabilities, data types, etc.
                    if metadata.capabilities:
                        capabilities_text = " ".join(metadata.capabilities).lower()
                        if any(kw in capabilities_text for kw in control_lower.split()):
                            control_passed = True
                            control_details = "Control found in agent capabilities"
                
                # Check requirement responses for control-related data
                for req_id, value in requirement_responses.items():
                    if isinstance(value, str) and control_lower in value.lower():
                        control_passed = True
                        control_details = f"Control verified via requirement response"
                        break
                
                if control_passed:
                    controls_passed += 1
                
                evaluation_results["controls_evaluated"].append({
                    "control": control_name,
                    "type": control_type,
                    "status": "pass" if control_passed else "fail",
                    "details": control_details,
                    "required": control_type == "required"
                })
                
                if control_type == "required" and not control_passed:
                    status = ComplianceCheckStatus.FAIL.value
                    gap_description = f"Required control '{control_name}' not verified"
                    severity = "high"
            
            # Calculate control score
            if controls_total > 0:
                control_score = controls_passed / controls_total
                evaluation_results["overall_score"] = control_score
        
        # Check required attributes
        if policy.required_attributes:
            attributes_found = 0
            attributes_total = len([a for a in policy.required_attributes if a.get("required", False)])
            
            for attr in policy.required_attributes:
                attr_name = attr.get("attribute", "unknown")
                attr_required = attr.get("required", False)
                
                # Check if attribute is in requirement responses
                attr_found = False
                attr_value = None
                attr_source = None
                
                for req_id, value in requirement_responses.items():
                    if attr_name in str(value).lower() or str(value):
                        attr_found = True
                        attr_value = value
                        attr_source = "submission_requirement"
                        break
                
                # Check agent metadata
                if not attr_found and metadata:
                    if hasattr(metadata, attr_name):
                        attr_found = True
                        attr_value = getattr(metadata, attr_name)
                        attr_source = "agent_metadata"
                
                if attr_found:
                    attributes_found += 1
                
                evaluation_results["attributes_checked"].append({
                    "attribute": attr_name,
                    "required": attr_required,
                    "found": attr_found,
                    "value": str(attr_value) if attr_value else None,
                    "source": attr_source
                })
                
                if attr_required and not attr_found:
                    if status == ComplianceCheckStatus.PASS.value:
                        status = ComplianceCheckStatus.WARNING.value
                    if not gap_description:
                        gap_description = f"Required attribute '{attr_name}' not found"
                        severity = "medium"
        
        # Evaluate qualification criteria
        if policy.qualification_criteria:
            criteria = policy.qualification_criteria
            pass_threshold = criteria.get("pass_threshold", 0.8)
            checks = criteria.get("checks", [])
            
            checks_passed = 0
            checks_total = len([c for c in checks if c.get("required", False)])
            
            for check in checks:
                check_name = check.get("check", "Unknown")
                check_required = check.get("required", False)
                
                # Simplified check evaluation
                check_passed = False
                check_details = "Not evaluated"
                
                # Check if mentioned in agent context
                check_lower = check_name.lower()
                if check_lower in agent_context.lower():
                    check_passed = True
                    check_details = "Check criteria mentioned in agent documentation"
                
                if check_passed:
                    checks_passed += 1
                
                evaluation_results["qualification_checks"].append({
                    "check": check_name,
                    "description": check.get("description", ""),
                    "required": check_required,
                    "status": "pass" if check_passed else "fail",
                    "details": check_details
                })
                
                if check_required and not check_passed:
                    if status == ComplianceCheckStatus.PASS.value:
                        status = ComplianceCheckStatus.WARNING.value
                    if not gap_description:
                        gap_description = f"Required qualification check '{check_name}' not passed"
                        severity = "medium"
            
            # Calculate overall qualification score
            if checks_total > 0:
                qualification_score = checks_passed / checks_total
                # Combine with control score
                if evaluation_results["overall_score"] > 0:
                    evaluation_results["overall_score"] = (
                        evaluation_results["overall_score"] * 0.6 + qualification_score * 0.4
                    )
                else:
                    evaluation_results["overall_score"] = qualification_score
            
            # Determine if agent can be cleared
            evaluation_results["can_be_cleared"] = (
                evaluation_results["overall_score"] >= pass_threshold and
                status != ComplianceCheckStatus.FAIL.value
            )
        
        # Use RAG results for additional context
        if rag_results:
            avg_score = sum(r.get("score", 0) for r in rag_results) / len(rag_results)
            if avg_score < 0.5:
                if status == ComplianceCheckStatus.PASS.value:
                    status = ComplianceCheckStatus.WARNING.value
                if not gap_description:
                    gap_description = "Limited documentation found for compliance review"
                    severity = "low"
        
        return {
            "policy_id": str(policy.id),
            "policy_name": policy.name,
            "category": policy.category,
            "status": status,
            "details": f"Compliance check for {policy.name}",
            "evidence": [r.get("id") for r in rag_results[:3]],
            "gap_description": gap_description,
            "severity": severity,
            "confidence_score": float(confidence_score),
            "evaluation_results": evaluation_results
        }
    
    async def _get_recommendations(
        self,
        gaps: List[Dict],
        agent_context: str
    ) -> List[Dict]:
        """Get recommendations for addressing compliance gaps"""
        recommendations = []
        
        for gap in gaps:
            # Query RAG for recommendations
            query = f"How to address compliance gap: {gap.get('gap_description')} for {gap.get('category')}"
            rag_results = await rag_service.search(query=query, limit=3)
            
            recommendations.append({
                "gap_id": gap.get("policy_id"),
                "gap_description": gap.get("gap_description"),
                "recommendations": [
                    {
                        "text": r.get("content", "")[:200],
                        "source": r.get("metadata", {}).get("content", "")[:100]
                    }
                    for r in rag_results
                ]
            })
        
        return recommendations
    
    def _get_checks_performed(
        self,
        policy: Policy,
        agent: Agent,
        metadata: Optional[AgentMetadata]
    ) -> List[Dict]:
        """Get list of checks performed for a policy"""
        checks = []
        
        if policy.category == PolicyCategory.SECURITY.value:
            checks.append({
                "check": "Security capabilities verification",
                "method": "Keyword matching in agent capabilities",
                "keywords_checked": ["encryption", "authentication", "authorization", "security"],
                "result": "Pass" if metadata and metadata.capabilities and any(
                    keyword in " ".join(metadata.capabilities).lower()
                    for keyword in ["encryption", "authentication", "authorization", "security"]
                ) else "Warning"
            })
        
        if policy.category == PolicyCategory.COMPLIANCE.value:
            checks.append({
                "check": "Description completeness",
                "method": "Length validation",
                "min_length": 50,
                "result": "Pass" if agent.description and len(agent.description) >= 50 else "Warning"
            })
        
        if policy.requirements:
            checks.append({
                "check": "Policy requirements verification",
                "method": "RAG-based requirement matching",
                "requirements_count": len(policy.requirements),
                "result": "Evaluated via RAG"
            })
        
        if policy.rules:
            checks.append({
                "check": "Policy rules evaluation",
                "method": "Rule-based checking",
                "rules_count": len(policy.rules),
                "rules": list(policy.rules.keys()) if isinstance(policy.rules, dict) else []
            })
        
        return checks
    
    def _calculate_compliance_score(self, compliance_results: List[Dict]) -> int:
        """Calculate overall compliance score (0-100)"""
        if not compliance_results:
            return 0
        
        total_weight = len(compliance_results)
        passed_weight = sum(
            1 for r in compliance_results
            if r["status"] == ComplianceCheckStatus.PASS.value
        )
        warning_weight = sum(
            0.5 for r in compliance_results
            if r["status"] == ComplianceCheckStatus.WARNING.value
        )
        
        score = int(((passed_weight + warning_weight) / total_weight) * 100)
        return min(100, max(0, score))


# Global instance
compliance_service = ComplianceService()

