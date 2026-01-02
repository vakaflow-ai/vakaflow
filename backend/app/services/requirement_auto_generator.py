"""
Auto-generation service for submission requirements from frameworks, risks, and categories
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.submission_requirement import SubmissionRequirement
from app.models.compliance_framework import ComplianceFramework, FrameworkRule, FrameworkRisk
from app.models.user import User
from app.services.requirement_library import requirement_library
import logging

logger = logging.getLogger(__name__)


class RequirementAutoGenerator:
    """Service for auto-generating submission requirements"""
    
    def generate_from_frameworks(
        self,
        db: Session,
        tenant_id: str,
        framework_ids: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> List[SubmissionRequirement]:
        """
        Auto-generate requirements from compliance frameworks
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            framework_ids: Optional list of framework IDs to generate from (all if None)
            created_by: User ID who triggered the generation
            
        Returns:
            List of created requirements
        """
        # Get frameworks
        query = db.query(ComplianceFramework).filter(
            ComplianceFramework.is_active == True
        )
        
        if framework_ids:
            query = query.filter(ComplianceFramework.id.in_(framework_ids))
        
        frameworks = query.all()
        
        requirements = []
        for framework in frameworks:
            # Get all rules for this framework
            rules = db.query(FrameworkRule).filter(
                FrameworkRule.framework_id == framework.id,
                FrameworkRule.is_active == True
            ).all()
            
            for rule in rules:
                # Check if requirement already exists
                existing = db.query(SubmissionRequirement).filter(
                    SubmissionRequirement.tenant_id == tenant_id,
                    SubmissionRequirement.source_type == "framework",
                    SubmissionRequirement.source_id == str(rule.id),
                    SubmissionRequirement.is_active == True
                ).first()
                
                if existing:
                    continue
                
                # Generate catalog_id for requirement
                catalog_id = f"REQ-{framework.code.upper()}-{rule.code.upper()}"
                
                # Create requirement from rule
                # Note: field_name is now a computed property from catalog_id
                requirement = SubmissionRequirement(
                    tenant_id=tenant_id,
                    label=f"{framework.name} - {rule.name}",
                    catalog_id=catalog_id,
                    field_type="textarea",
                    description=rule.description or rule.requirement_text,
                    placeholder=f"Describe how your agent meets: {rule.requirement_text}",
                    is_required=False,
                    category="compliance",
                    section=f"Framework: {framework.name}",
                    order=rule.order,
                    source_type="framework",
                    source_id=str(rule.id),
                    source_name=framework.name,
                    is_auto_generated=True,
                    is_enabled=True,
                    created_by=created_by
                )
                
                db.add(requirement)
                requirements.append(requirement)
        
        db.commit()
        return requirements
    
    def generate_from_risks(
        self,
        db: Session,
        tenant_id: str,
        risk_ids: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> List[SubmissionRequirement]:
        """
        Auto-generate requirements from framework risks
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            risk_ids: Optional list of risk IDs to generate from (all if None)
            created_by: User ID who triggered the generation
            
        Returns:
            List of created requirements
        """
        # Get risks
        query = db.query(FrameworkRisk).filter(
            FrameworkRisk.is_active == True
        )
        
        if risk_ids:
            query = query.filter(FrameworkRisk.id.in_(risk_ids))
        
        risks = query.all()
        
        requirements = []
        for risk in risks:
            # Get framework for this risk
            framework = db.query(ComplianceFramework).filter(
                ComplianceFramework.id == risk.framework_id
            ).first()
            
            if not framework:
                continue
            
            # Check if requirement already exists
            existing = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == tenant_id,
                SubmissionRequirement.source_type == "risk",
                SubmissionRequirement.source_id == str(risk.id),
                SubmissionRequirement.is_active == True
            ).first()
            
            if existing:
                continue
            
            # Generate catalog_id for requirement
            catalog_id = f"REQ-RISK-{risk.code.upper()}"
            
            # Create requirement from risk
            # Note: field_name is now a computed property from catalog_id
            requirement = SubmissionRequirement(
                tenant_id=tenant_id,
                label=f"Risk Mitigation: {risk.name}",
                catalog_id=catalog_id,
                field_type="textarea",
                description=f"Risk: {risk.description or risk.name} (Severity: {risk.severity})",
                placeholder=f"Describe how your agent mitigates this risk: {risk.name}",
                is_required=False,
                category="compliance",
                section=f"Risk: {risk.name} ({framework.name})",
                order=risk.order,
                source_type="risk",
                source_id=str(risk.id),
                source_name=risk.name,
                is_auto_generated=True,
                is_enabled=True,
                created_by=created_by
            )
            
            db.add(requirement)
            requirements.append(requirement)
        
        db.commit()
        return requirements
    
    def generate_from_categories(
        self,
        db: Session,
        tenant_id: str,
        categories: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> List[SubmissionRequirement]:
        """
        Auto-generate requirements from predefined categories
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            categories: Optional list of categories to generate from (all if None)
            created_by: User ID who triggered the generation
            
        Returns:
            List of created requirements
        """
        # Predefined category requirements
        category_templates = {
            "security": [
                {
                    "label": "Security Architecture",
                    "field_name": "security_architecture",
                    "description": "Describe the security architecture of your agent",
                    "placeholder": "Explain encryption, authentication, access controls, etc."
                },
                {
                    "label": "Data Encryption",
                    "field_name": "data_encryption",
                    "description": "Describe data encryption methods used",
                    "placeholder": "Specify encryption algorithms, key management, etc."
                },
                {
                    "label": "Access Controls",
                    "field_name": "access_controls",
                    "description": "Describe access control mechanisms",
                    "placeholder": "Explain authentication, authorization, role-based access, etc."
                }
            ],
            "compliance": [
                {
                    "label": "Compliance Certifications",
                    "field_name": "compliance_certifications",
                    "description": "List compliance certifications your agent meets",
                    "placeholder": "e.g., SOC 2, ISO 27001, HIPAA, GDPR, etc."
                },
                {
                    "label": "Audit Trail",
                    "field_name": "audit_trail",
                    "description": "Describe audit trail capabilities",
                    "placeholder": "Explain logging, monitoring, audit capabilities"
                }
            ],
            "technical": [
                {
                    "label": "Technical Architecture",
                    "field_name": "technical_architecture",
                    "description": "Describe the technical architecture",
                    "placeholder": "Explain system design, components, integrations, etc."
                },
                {
                    "label": "Scalability",
                    "field_name": "scalability",
                    "description": "Describe scalability features",
                    "placeholder": "Explain horizontal/vertical scaling, load handling, etc."
                }
            ],
            "business": [
                {
                    "label": "Business Value",
                    "field_name": "business_value",
                    "description": "Describe the business value proposition",
                    "placeholder": "Explain ROI, benefits, use cases, etc."
                },
                {
                    "label": "Support & Maintenance",
                    "field_name": "support_maintenance",
                    "description": "Describe support and maintenance plans",
                    "placeholder": "Explain SLAs, support channels, maintenance windows, etc."
                }
            ]
        }
        
        categories_to_generate = categories or list(category_templates.keys())
        requirements = []
        
        for category in categories_to_generate:
            if category not in category_templates:
                continue
            
            templates = category_templates[category]
            for template in templates:
                # Generate catalog_id for requirement
                catalog_id = f"REQ-{category.upper()}-{template['field_name'].upper().replace('_', '-')}"
                
                # Check if requirement already exists (by catalog_id or source_id)
                existing = db.query(SubmissionRequirement).filter(
                    SubmissionRequirement.tenant_id == tenant_id,
                    SubmissionRequirement.source_type == "category",
                    SubmissionRequirement.source_id == category,
                    SubmissionRequirement.catalog_id == catalog_id,
                    SubmissionRequirement.is_active == True
                ).first()
                
                if existing:
                    continue
                
                # Create requirement from template
                # Note: field_name is now a computed property from catalog_id
                requirement = SubmissionRequirement(
                    tenant_id=tenant_id,
                    label=template["label"],
                    catalog_id=catalog_id,
                    field_type="textarea",
                    description=template["description"],
                    placeholder=template["placeholder"],
                    is_required=False,
                    category=category,
                    section=f"Category: {category.title()}",
                    order=0,
                    source_type="category",
                    source_id=category,
                    source_name=category.title(),
                    is_auto_generated=True,
                    is_enabled=True,
                    created_by=created_by
                )
                
                db.add(requirement)
                requirements.append(requirement)
        
        db.commit()
        return requirements
    
    def generate_from_library(
        self,
        db: Session,
        tenant_id: str,
        categories: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> Dict[str, List[SubmissionRequirement]]:
        """
        Generate requirements from the comprehensive library
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            categories: Optional list of categories to generate (all if None)
            created_by: User ID who triggered generation
            
        Returns:
            Dictionary with requirements by category
        """
        return requirement_library.generate_library_requirements(
            db=db,
            tenant_id=tenant_id,
            categories=categories,
            created_by=created_by
        )
    
    def generate_all(
        self,
        db: Session,
        tenant_id: str,
        created_by: Optional[str] = None,
        include_frameworks: bool = True,
        include_risks: bool = True,
        include_categories: bool = True,
        include_library: bool = True
    ) -> Dict[str, Any]:
        """
        Generate all requirements from all sources
        
        Returns:
            Dictionary with keys: frameworks, risks, categories, library
        """
        result = {
            "frameworks": [],
            "risks": [],
            "categories": [],
            "library": {}
        }
        
        if include_frameworks:
            result["frameworks"] = self.generate_from_frameworks(db, tenant_id, created_by=created_by)
        
        if include_risks:
            result["risks"] = self.generate_from_risks(db, tenant_id, created_by=created_by)
        
        if include_categories:
            result["categories"] = self.generate_from_categories(db, tenant_id, created_by=created_by)
        
        if include_library:
            result["library"] = self.generate_from_library(db, tenant_id, created_by=created_by)
        
        return result


# Singleton instance
requirement_auto_generator = RequirementAutoGenerator()

