#!/usr/bin/env python3
"""
Seed default submission requirements - GRC Controls Library
Organized by:
- Risks (Security, Operational, Compliance, Data Privacy)
- Compliance Frameworks (GDPR, SOC 2, ISO 27001, HIPAA, PCI DSS, NIST, CCPA)
- Functional Areas (IT, Security, HR, Finance, Legal, Operations)
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.submission_requirement import SubmissionRequirement
from app.models.tenant import Tenant
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# GRC Controls Library - Organized by Risks, Compliance Frameworks, and Functional Areas
DEFAULT_REQUIREMENTS = {
    "Risks": [
        {
            "label": "Data Privacy Risk Assessment",
            "field_name": "data_privacy_risk_assessment",
            "field_type": "textarea",
            "description": "Assess data privacy risks including PII/PHI exposure, data breach scenarios, and privacy impact analysis",
            "category": "security",
            "section": "Risks",
            "order": 1,
            "is_required": True,
            "source_type": "risk",
            "source_name": "Data Privacy Risk",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "Security Risk Assessment",
            "field_name": "security_risk_assessment",
            "field_type": "textarea",
            "description": "Comprehensive security risk assessment covering vulnerabilities, threats, attack vectors, and security controls effectiveness",
            "category": "security",
            "section": "Risks",
            "order": 2,
            "is_required": True,
            "requirement_type": "risk",
            "catalog_id": "R-RISK-02",
            "source_type": "risk",
            "source_name": "Security Risk",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "Third-Party Vendor Risk Management",
            "field_name": "third_party_vendor_risk",
            "field_type": "textarea",
            "description": "Third-party vendor risk assessment including due diligence, security questionnaires, and ongoing monitoring",
            "category": "security",
            "section": "Risks",
            "order": 3,
            "is_required": False,
            "source_type": "risk",
            "source_name": "Third-Party Risk",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "Operational Risk Assessment",
            "field_name": "operational_risk_assessment",
            "field_type": "textarea",
            "description": "Operational risks including availability, reliability, business continuity, and disaster recovery capabilities",
            "category": "business",
            "section": "Risks",
            "order": 4,
            "is_required": False,
            "source_type": "risk",
            "source_name": "Operational Risk",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "Regulatory Compliance Risk",
            "field_name": "regulatory_compliance_risk",
            "field_type": "textarea",
            "description": "Regulatory compliance risks and requirements mapping across applicable jurisdictions and regulations",
            "category": "compliance",
            "section": "Risks",
            "order": 5,
            "is_required": False,
            "source_type": "risk",
            "source_name": "Regulatory Compliance Risk",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "AI/ML Bias and Fairness Risk",
            "field_name": "ai_bias_fairness_risk",
            "field_type": "textarea",
            "description": "AI/ML model bias, fairness, ethical considerations, and algorithmic transparency assessment",
            "category": "technical",
            "section": "Risks",
            "order": 6,
            "is_required": False,
            "source_type": "risk",
            "source_name": "AI Bias Risk",
            "allowed_response_types": ["text", "file", "url"],
        },
    ],
    "Compliance Frameworks": [
        {
            "label": "GDPR Compliance Controls",
            "field_name": "gdpr_compliance_controls",
            "field_type": "textarea",
            "description": "GDPR Article 25 (Privacy by Design), Article 32 (Security), Article 33/34 (Breach Notification), Article 35 (DPIA), Right to be Forgotten implementation",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 1,
            "is_required": True,
            "requirement_type": "compliance",
            "catalog_id": "R-COM-01",
            "source_type": "framework",
            "source_name": "GDPR",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "SOC 2 Type II Controls",
            "field_name": "soc2_type2_controls",
            "field_type": "textarea",
            "description": "SOC 2 Trust Service Criteria: Security, Availability, Processing Integrity, Confidentiality, Privacy controls and evidence",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 2,
            "is_required": False,
            "source_type": "framework",
            "source_name": "SOC 2",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "ISO 27001 Information Security Controls",
            "field_name": "iso27001_security_controls",
            "field_type": "textarea",
            "description": "ISO 27001 Annex A controls: Access Control (A.9), Cryptography (A.10), Operations Security (A.12), Communications Security (A.13)",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 3,
            "is_required": False,
            "source_type": "framework",
            "source_name": "ISO 27001",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "HIPAA Security and Privacy Controls",
            "field_name": "hipaa_security_privacy_controls",
            "field_type": "textarea",
            "description": "HIPAA Security Rule (Administrative, Physical, Technical Safeguards) and Privacy Rule compliance for PHI handling",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 4,
            "is_required": False,
            "source_type": "framework",
            "source_name": "HIPAA",
            "allowed_response_types": ["text", "file", "url"],
            "filter_conditions": {"agent_category": ["Healthcare", "Health & Life Sciences"]},
        },
        {
            "label": "PCI DSS Compliance Controls",
            "field_name": "pci_dss_compliance_controls",
            "field_type": "textarea",
            "description": "PCI DSS Requirements: Secure network, protect cardholder data, vulnerability management, access control, monitoring, information security policy",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 5,
            "is_required": False,
            "source_type": "framework",
            "source_name": "PCI DSS",
            "allowed_response_types": ["text", "file", "url"],
            "filter_conditions": {"agent_category": ["Financial Services", "E-commerce", "Payment Processing"]},
        },
        {
            "label": "NIST Cybersecurity Framework Controls",
            "field_name": "nist_csf_controls",
            "field_type": "textarea",
            "description": "NIST CSF Functions: Identify, Protect, Detect, Respond, Recover - control implementation and maturity assessment",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 6,
            "is_required": False,
            "source_type": "framework",
            "source_name": "NIST CSF",
            "allowed_response_types": ["text", "file", "url"],
        },
        {
            "label": "CCPA/CPRA Compliance Controls",
            "field_name": "ccpa_cpra_compliance_controls",
            "field_type": "textarea",
            "description": "California Consumer Privacy Act controls: Right to know, delete, opt-out, non-discrimination, and data processing agreements",
            "category": "compliance",
            "section": "Compliance Frameworks",
            "order": 7,
            "is_required": False,
            "source_type": "framework",
            "source_name": "CCPA/CPRA",
            "allowed_response_types": ["text", "file", "url"],
        },
    ],
    "Functional Areas": {
        "IT": [
            {
                "label": "IT Infrastructure Security Controls",
                "field_name": "it_infrastructure_security",
                "field_type": "textarea",
                "description": "Network security, server hardening, patch management, configuration management, and infrastructure monitoring controls",
                "category": "technical",
                "section": "Functional Areas - IT",
                "order": 1,
                "is_required": True,
                "source_type": "library",
                "source_name": "IT Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Cloud Security Controls",
                "field_name": "cloud_security_controls",
                "field_type": "textarea",
                "description": "Cloud security posture, IAM policies, encryption, network segmentation, and cloud provider security assessments",
                "category": "technical",
                "section": "Functional Areas - IT",
                "order": 2,
                "is_required": True,
                "source_type": "library",
                "source_name": "IT Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "API Security Controls",
                "field_name": "api_security_controls",
                "field_type": "textarea",
                "description": "API authentication, authorization, rate limiting, input validation, and API security testing",
                "category": "technical",
                "section": "Functional Areas - IT",
                "order": 3,
                "is_required": True,
                "source_type": "library",
                "source_name": "IT Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Data Backup and Recovery Controls",
                "field_name": "data_backup_recovery_controls",
                "field_type": "textarea",
                "description": "Backup procedures, recovery time objectives (RTO), recovery point objectives (RPO), and disaster recovery testing",
                "category": "technical",
                "section": "Functional Areas - IT",
                "order": 4,
                "is_required": False,
                "source_type": "library",
                "source_name": "IT Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
        ],
        "Security": [
            {
                "label": "Identity and Access Management (IAM) Controls",
                "field_name": "iam_controls",
                "field_type": "textarea",
                "description": "User provisioning/deprovisioning, role-based access control (RBAC), privileged access management (PAM), and access reviews",
                "category": "security",
                "section": "Functional Areas - Security",
                "order": 1,
                "is_required": True,
                "source_type": "library",
                "source_name": "Security Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Authentication and Multi-Factor Authentication (MFA)",
                "field_name": "authentication_mfa_controls",
                "field_type": "textarea",
                "description": "Authentication mechanisms (OAuth 2.0, SAML, password policies), MFA implementation, and session management",
                "category": "security",
                "section": "Functional Areas - Security",
                "order": 2,
                "is_required": True,
                "source_type": "library",
                "source_name": "Security Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Data Encryption Controls",
                "field_name": "data_encryption_controls",
                "field_type": "textarea",
                "description": "Encryption at rest and in transit, key management, cryptographic controls, and encryption standards compliance",
                "category": "security",
                "section": "Functional Areas - Security",
                "order": 3,
                "is_required": True,
                "source_type": "library",
                "source_name": "Security Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Security Monitoring and Incident Response",
                "field_name": "security_monitoring_incident_response",
                "field_type": "textarea",
                "description": "SIEM, security event logging, intrusion detection, incident response procedures, and breach notification processes",
                "category": "security",
                "section": "Functional Areas - Security",
                "order": 4,
                "is_required": True,
                "source_type": "library",
                "source_name": "Security Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Vulnerability Management Controls",
                "field_name": "vulnerability_management_controls",
                "field_type": "textarea",
                "description": "Vulnerability scanning, penetration testing, patch management, and security update procedures",
                "category": "security",
                "section": "Functional Areas - Security",
                "order": 5,
                "is_required": False,
                "source_type": "library",
                "source_name": "Security Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
        ],
        "HR": [
            {
                "label": "Employee Access Management Controls",
                "field_name": "employee_access_management",
                "field_type": "textarea",
                "description": "Employee onboarding/offboarding procedures, access provisioning, background checks, and access termination",
                "category": "compliance",
                "section": "Functional Areas - HR",
                "order": 1,
                "is_required": False,
                "source_type": "library",
                "source_name": "HR Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Data Privacy and Employee Data Protection",
                "field_name": "employee_data_protection",
                "field_type": "textarea",
                "description": "Employee PII protection, data retention policies, consent management, and employee privacy rights",
                "category": "compliance",
                "section": "Functional Areas - HR",
                "order": 2,
                "is_required": False,
                "source_type": "library",
                "source_name": "HR Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Security Awareness and Training",
                "field_name": "security_awareness_training",
                "field_type": "textarea",
                "description": "Security awareness programs, phishing training, security policies acknowledgment, and ongoing education",
                "category": "security",
                "section": "Functional Areas - HR",
                "order": 3,
                "is_required": False,
                "source_type": "library",
                "source_name": "HR Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
        ],
        "Finance": [
            {
                "label": "Financial Data Protection Controls",
                "field_name": "financial_data_protection",
                "field_type": "textarea",
                "description": "Financial data encryption, access controls, audit trails, and financial information security",
                "category": "compliance",
                "section": "Functional Areas - Finance",
                "order": 1,
                "is_required": False,
                "source_type": "library",
                "source_name": "Finance Controls Library",
                "allowed_response_types": ["text", "file", "url"],
                "filter_conditions": {"agent_category": ["Financial Services", "E-commerce", "Payment Processing"]},
            },
            {
                "label": "Payment Card Data Security (PCI DSS)",
                "field_name": "payment_card_data_security",
                "field_type": "textarea",
                "description": "PCI DSS compliance for payment card data handling, storage, and processing",
                "category": "compliance",
                "section": "Functional Areas - Finance",
                "order": 2,
                "is_required": False,
                "source_type": "library",
                "source_name": "Finance Controls Library",
                "allowed_response_types": ["text", "file", "url"],
                "filter_conditions": {"agent_category": ["Financial Services", "E-commerce", "Payment Processing"]},
            },
        ],
        "Legal": [
            {
                "label": "Data Processing Agreements and Contracts",
                "field_name": "data_processing_agreements",
                "field_type": "textarea",
                "description": "Data processing agreements (DPAs), vendor contracts, and third-party data sharing agreements",
                "category": "compliance",
                "section": "Functional Areas - Legal",
                "order": 1,
                "is_required": False,
                "source_type": "library",
                "source_name": "Legal Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Regulatory Compliance Documentation",
                "field_name": "regulatory_compliance_documentation",
                "field_type": "textarea",
                "description": "Compliance documentation, regulatory filings, and legal compliance evidence",
                "category": "compliance",
                "section": "Functional Areas - Legal",
                "order": 2,
                "is_required": False,
                "source_type": "library",
                "source_name": "Legal Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
        ],
        "Operations": [
            {
                "label": "Business Continuity and Disaster Recovery",
                "field_name": "bc_dr_controls",
                "field_type": "textarea",
                "description": "Business continuity plans, disaster recovery procedures, RTO/RPO targets, and DR testing",
                "category": "business",
                "section": "Functional Areas - Operations",
                "order": 1,
                "is_required": False,
                "source_type": "library",
                "source_name": "Operations Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Change Management Controls",
                "field_name": "change_management_controls",
                "field_type": "textarea",
                "description": "Change management processes, change approval workflows, and change documentation",
                "category": "business",
                "section": "Functional Areas - Operations",
                "order": 2,
                "is_required": False,
                "source_type": "library",
                "source_name": "Operations Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
            {
                "label": "Service Level Agreements (SLAs) and Monitoring",
                "field_name": "sla_monitoring_controls",
                "field_type": "textarea",
                "description": "SLA definitions, performance monitoring, availability metrics, and service quality controls",
                "category": "business",
                "section": "Functional Areas - Operations",
                "order": 3,
                "is_required": False,
                "source_type": "library",
                "source_name": "Operations Controls Library",
                "allowed_response_types": ["text", "file", "url"],
            },
        ],
    },
}


def seed_submission_requirements_only(tenant_id: uuid.UUID, created_by: uuid.UUID = None):
    """Seed default submission requirements for a tenant"""
    db = SessionLocal()
    try:
        logger.info(f"🌱 Seeding GRC Controls Library for tenant {tenant_id}...")
        
        total_created = 0
        total_skipped = 0
        
        # Process Risks
        if "Risks" in DEFAULT_REQUIREMENTS:
            logger.info(f"\n📋 Seeding Risks ({len(DEFAULT_REQUIREMENTS['Risks'])} controls)...")
            for req_data in DEFAULT_REQUIREMENTS["Risks"]:
                existing = db.query(SubmissionRequirement).filter(
                    SubmissionRequirement.tenant_id == tenant_id,
                    SubmissionRequirement.field_name == req_data["field_name"]
                ).first()
                
                if existing:
                    logger.info(f"  ⏭️  Skipped (exists): {req_data['label']}")
                    total_skipped += 1
                    continue
                
                requirement = _create_requirement(db, tenant_id, req_data, created_by)
                db.add(requirement)
                logger.info(f"  ✅ Created: {req_data['label']}")
                total_created += 1
        
        # Process Compliance Frameworks
        if "Compliance Frameworks" in DEFAULT_REQUIREMENTS:
            logger.info(f"\n📋 Seeding Compliance Frameworks ({len(DEFAULT_REQUIREMENTS['Compliance Frameworks'])} controls)...")
            for req_data in DEFAULT_REQUIREMENTS["Compliance Frameworks"]:
                existing = db.query(SubmissionRequirement).filter(
                    SubmissionRequirement.tenant_id == tenant_id,
                    SubmissionRequirement.field_name == req_data["field_name"]
                ).first()
                
                if existing:
                    logger.info(f"  ⏭️  Skipped (exists): {req_data['label']}")
                    total_skipped += 1
                    continue
                
                requirement = _create_requirement(db, tenant_id, req_data, created_by)
                db.add(requirement)
                logger.info(f"  ✅ Created: {req_data['label']}")
                total_created += 1
        
        # Process Functional Areas
        if "Functional Areas" in DEFAULT_REQUIREMENTS:
            functional_areas = DEFAULT_REQUIREMENTS["Functional Areas"]
            total_func_controls = sum(len(controls) for controls in functional_areas.values())
            logger.info(f"\n📋 Seeding Functional Areas ({total_func_controls} controls across {len(functional_areas)} areas)...")
            
            for area_name, controls in functional_areas.items():
                logger.info(f"  📁 {area_name} ({len(controls)} controls)...")
                for req_data in controls:
                    existing = db.query(SubmissionRequirement).filter(
                        SubmissionRequirement.tenant_id == tenant_id,
                        SubmissionRequirement.field_name == req_data["field_name"]
                    ).first()
                    
                    if existing:
                        logger.info(f"    ⏭️  Skipped (exists): {req_data['label']}")
                        total_skipped += 1
                        continue
                    
                    requirement = _create_requirement(db, tenant_id, req_data, created_by)
                    db.add(requirement)
                    logger.info(f"    ✅ Created: {req_data['label']}")
                    total_created += 1
        
        db.commit()
        logger.info(f"\n✅ Seeding complete! Created: {total_created}, Skipped: {total_skipped}")
        return total_created
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error seeding submission requirements: {e}")
        raise
    finally:
        db.close()


def _create_requirement(db, tenant_id: uuid.UUID, req_data: dict, created_by: uuid.UUID = None):
    """Helper to create a requirement from data dictionary"""
    # Determine requirement_type: compliance, risk, or default to compliance
    # NEVER create questionnaire-type requirements - those go to question_library
    requirement_type = req_data.get("requirement_type")
    if not requirement_type:
        # Infer from source_type or category
        source_type = req_data.get("source_type", "")
        if "risk" in source_type.lower():
            requirement_type = RequirementType.RISK
        else:
            requirement_type = RequirementType.COMPLIANCE
    
    # Generate catalog_id if not provided
    catalog_id = req_data.get("catalog_id")
    if not catalog_id:
        # Generate based on category and order
        category_prefix = req_data.get("category", "GEN")[:3].upper()
        section = req_data.get("section", "General")
        if "security" in section.lower() or "security" in category_prefix.lower():
            prefix = "SEC"
        elif "compliance" in section.lower() or "compliance" in category_prefix.lower():
            prefix = "COM"
        elif "risk" in section.lower() or "risk" in category_prefix.lower():
            prefix = "RISK"
        else:
            prefix = category_prefix
        order = req_data.get("order", 0)
        catalog_id = f"R-{prefix}-{order:02d}"
    
    return SubmissionRequirement(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        label=req_data["label"],
        field_name=req_data["field_name"],
        field_type=req_data["field_type"],
        description=req_data.get("description"),
        placeholder=req_data.get("placeholder"),
        is_required=req_data.get("is_required", False),
        min_length=req_data.get("min_length"),
        max_length=req_data.get("max_length"),
        min_value=req_data.get("min_value"),
        max_value=req_data.get("max_value"),
        pattern=req_data.get("pattern"),
        options=req_data.get("options"),
        category=req_data.get("category", "general"),
        section=req_data.get("section", "General"),
        requirement_type=requirement_type,  # compliance or risk, NEVER questionnaires
        catalog_id=catalog_id,  # R-SEC-01, R-COM-02, etc.
        order=req_data.get("order", 0),
        allowed_response_types=req_data.get("allowed_response_types"),
        filter_conditions=req_data.get("filter_conditions"),
        source_type=req_data.get("source_type", "manual"),
        source_id=req_data.get("source_id"),
        source_name=req_data.get("source_name"),
        is_auto_generated=req_data.get("source_type") is not None,
        is_enabled=True,
        is_active=True,
        created_by=created_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


def seed_all_tenants():
    """Seed submission requirements for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("⚠️  No tenants found. Please create a tenant first.")
            return
        
        logger.info(f"🌱 Seeding GRC Controls Library for {len(tenants)} tenant(s)...")
        
        for tenant in tenants:
            logger.info(f"\n{'='*60}")
            logger.info(f"📋 Processing tenant: {tenant.name} (ID: {tenant.id})")
            logger.info(f"{'='*60}")
            
            # Get first admin user for created_by
            from app.models.user import User, UserRole
            admin = db.query(User).filter(
                User.tenant_id == tenant.id,
                User.role.in_([UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN])
            ).first()
            
            created_by = admin.id if admin else None
            
            seed_submission_requirements(tenant.id, created_by=created_by)
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ All tenants processed!")
        logger.info(f"{'='*60}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise
    finally:
        db.close()


# Alias for backward compatibility
seed_submission_requirements = seed_submission_requirements_only

if __name__ == "__main__":
    try:
        seed_all_tenants()
    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}")
        sys.exit(1)
