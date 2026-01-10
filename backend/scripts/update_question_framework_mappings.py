#!/usr/bin/env python3
"""
Update existing platform questions with comprehensive compliance and risk framework mappings
This script maps questions to appropriate frameworks based on their content, category, and assessment type.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.question_library import QuestionLibrary
from app.models.compliance_framework import ComplianceFramework
from sqlalchemy import func
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Comprehensive mapping of questions to frameworks based on title, category, and content
QUESTION_FRAMEWORK_MAPPING = {
    # Security Questions
    "Information Security Management System": {
        "compliance": ["ISO27001", "SOC2", "NIST"],
        "risk": ["ISO27001", "NIST"]  # Information security risk
    },
    "Security Policy Documentation": {
        "compliance": ["ISO27001", "SOC2", "NIST"],
        "risk": ["ISO27001", "NIST"]
    },
    "Access Control Measures": {
        "compliance": ["ISO27001", "SOC2", "NIST", "PCI_DSS"],
        "risk": ["ISO27001", "NIST", "PCI_DSS"]  # Access control risk
    },
    "Encryption Standards": {
        "compliance": ["ISO27001", "SOC2", "PCI_DSS", "HIPAA"],
        "risk": ["ISO27001", "PCI_DSS", "HIPAA"]  # Data protection risk
    },
    "Data Classification Framework": {
        "compliance": ["ISO27001", "SOC2", "GDPR"],
        "risk": ["ISO27001", "GDPR"]  # Data classification risk
    },
    "Data Retention Policy": {
        "compliance": ["GDPR", "HIPAA", "SOC2"],
        "risk": ["GDPR", "HIPAA"]  # Data retention risk
    },
    "Data Processing Location": {
        "compliance": ["GDPR", "SOC2"],
        "risk": ["GDPR"]  # Data sovereignty risk
    },
    
    # Compliance Questions
    "SOC 2 Certification": {
        "compliance": ["SOC2"],
        "risk": ["SOC2"]  # Service organization risk
    },
    "ISO 27001 Certification": {
        "compliance": ["ISO27001"],
        "risk": ["ISO27001"]  # Information security risk
    },
    "HIPAA Compliance": {
        "compliance": ["HIPAA"],
        "risk": ["HIPAA"]  # Healthcare data risk
    },
    "PCI-DSS Compliance": {
        "compliance": ["PCI_DSS"],
        "risk": ["PCI_DSS"]  # Payment card data risk
    },
    "GDPR Compliance": {
        "compliance": ["GDPR"],
        "risk": ["GDPR"]  # Privacy risk
    },
    
    # Privacy Questions
    "Privacy Policy": {
        "compliance": ["GDPR", "CCPA"],
        "risk": ["GDPR", "CCPA"]  # Privacy risk
    },
    "Data Processing Agreement": {
        "compliance": ["GDPR"],
        "risk": ["GDPR"]  # Data processing risk
    },
    
    # Incident Response
    "Incident Response Plan": {
        "compliance": ["ISO27001", "SOC2", "NIST"],
        "risk": ["ISO27001", "NIST"]  # Incident response risk
    },
    "Security Incident Notification": {
        "compliance": ["ISO27001", "SOC2", "GDPR", "HIPAA", "PCI_DSS"],
        "risk": ["ISO27001", "GDPR", "HIPAA"]  # Breach notification risk
    },
    
    # Security Testing
    "Penetration Testing Frequency": {
        "compliance": ["ISO27001", "SOC2", "PCI_DSS"],
        "risk": ["ISO27001", "PCI_DSS"]  # Security testing risk
    },
    "Penetration Testing Report": {
        "compliance": ["ISO27001", "SOC2", "PCI_DSS"],
        "risk": ["ISO27001", "PCI_DSS"]
    },
    "Vulnerability Management Program": {
        "compliance": ["SOC2", "PCI_DSS", "ISO27001"],
        "risk": ["ISO27001", "NIST"]  # Vulnerability risk
    },
    "Security Monitoring and Logging": {
        "compliance": ["ISO27001", "SOC2", "PCI_DSS"],
        "risk": ["ISO27001", "NIST"]  # Monitoring risk
    },
    
    # Personnel Security
    "Background Checks": {
        "compliance": ["SOC2", "HIPAA"],
        "risk": ["SOC2", "HIPAA"]  # Personnel risk
    },
    "Security Awareness Training": {
        "compliance": ["ISO27001", "SOC2", "HIPAA", "GDPR", "PCI_DSS"],
        "risk": ["ISO27001", "SOC2"]  # Human risk
    },
    
    # Business Continuity
    "Business Continuity Plan": {
        "compliance": ["ISO27001", "SOC2"],
        "risk": ["ISO27001"]  # Operational risk
    },
    "Disaster Recovery RTO and RPO": {
        "compliance": ["ISO27001", "SOC2"],
        "risk": ["ISO27001"]  # Business continuity risk
    },
    
    # Vendor Management
    "Subcontractor Management": {
        "compliance": ["SOC2", "ISO27001", "GDPR"],
        "risk": ["ISO27001", "SOC2"]  # Third-party risk
    },
    "Third-Party Risk Assessment Process": {
        "compliance": ["SOC2", "ISO27001"],
        "risk": ["ISO27001", "SOC2"]  # Third-party risk
    },
    "Vendor Due Diligence": {
        "compliance": ["SOC2", "ISO27001"],
        "risk": ["ISO27001", "SOC2"]
    },
    "Contractual Agreements": {
        "compliance": ["SOC2", "ISO27001", "GDPR"],
        "risk": ["ISO27001", "GDPR"]  # Contractual risk
    },
    
    # AI Vendor Questions
    "AI Model Training Data": {
        "compliance": ["GDPR", "SOC2"],
        "risk": ["GDPR"]  # AI data risk
    },
    "AI Model Explainability": {
        "compliance": ["GDPR", "SOC2"],
        "risk": ["GDPR"]  # AI transparency risk
    },
    "AI Model Versioning and Change Management": {
        "compliance": ["SOC2", "ISO27001"],
        "risk": ["ISO27001"]  # AI governance risk
    },
}


def get_framework_ids_from_codes(db, codes: list) -> list:
    """Fetches framework UUIDs for given codes, handling variations."""
    if not codes:
        return []
    
    found_ids = []
    all_frameworks = db.query(ComplianceFramework).all()
    
    for code in codes:
        # Try exact match first
        framework = db.query(ComplianceFramework).filter(
            ComplianceFramework.code == code
        ).first()
        
        if not framework:
            # Try case-insensitive match
            framework = db.query(ComplianceFramework).filter(
                func.lower(ComplianceFramework.code) == func.lower(code)
            ).first()
        
        if not framework:
            # Try variations (e.g., ISO27001 vs ISO-27001 vs ISO_27001)
            variations = [
                code,
                code.replace('-', '_'),
                code.replace('_', '-'),
                code.replace('-', ''),
                code.replace('_', ''),
                code.upper(),
                code.lower(),
            ]
            for variation in set(variations):
                framework = db.query(ComplianceFramework).filter(
                    func.lower(ComplianceFramework.code) == func.lower(variation)
                ).first()
                if framework:
                    break
        
        if framework:
            found_ids.append(framework.id)
        else:
            logger.warning(f"Framework code '{code}' not found. Available codes: {[f.code for f in all_frameworks]}")
    
    return list(set(found_ids))  # Return unique IDs


def update_question_framework_mappings():
    """Update all platform questions with framework mappings"""
    db = SessionLocal()
    try:
        logger.info("🔄 Updating platform questions with framework mappings...")
        
        # Get all frameworks
        all_frameworks = db.query(ComplianceFramework).all()
        logger.info(f"Available frameworks: {[f.code for f in all_frameworks]}")
        
        # Get all platform questions AND tenant-specific questions
        platform_questions = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id.is_(None)
        ).all()
        
        tenant_questions = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id.isnot(None)
        ).all()
        
        all_questions = platform_questions + tenant_questions
        
        logger.info(f"Found {len(platform_questions)} platform questions")
        logger.info(f"Found {len(tenant_questions)} tenant-specific questions")
        logger.info(f"Total: {len(all_questions)} questions\n")
        
        updated_count = 0
        
        for question in all_questions:
            # Get mapping for this question
            mapping = QUESTION_FRAMEWORK_MAPPING.get(question.title)
            
            if mapping:
                compliance_codes = mapping.get("compliance", [])
                risk_codes = mapping.get("risk", [])
                
                compliance_framework_ids = get_framework_ids_from_codes(db, compliance_codes)
                risk_framework_ids = get_framework_ids_from_codes(db, risk_codes)
                
                # Convert to string list
                compliance_ids_str = [str(uid) for uid in compliance_framework_ids]
                risk_ids_str = [str(uid) for uid in risk_framework_ids]
                
                # Check if update is needed
                current_compliance = set(question.compliance_framework_ids or [])
                current_risk = set(question.risk_framework_ids or [])
                new_compliance = set(compliance_ids_str)
                new_risk = set(risk_ids_str)
                
                if current_compliance != new_compliance or current_risk != new_risk:
                    question.compliance_framework_ids = compliance_ids_str if compliance_ids_str else None
                    question.risk_framework_ids = risk_ids_str if risk_ids_str else None
                    db.add(question)
                    updated_count += 1
                    
                    compliance_names = [f.code for f in all_frameworks if f.id in compliance_framework_ids]
                    risk_names = [f.code for f in all_frameworks if f.id in risk_framework_ids]
                    logger.info(f"  ✓ {question.title[:60]}")
                    logger.info(f"    Compliance: {compliance_names}")
                    logger.info(f"    Risk: {risk_names}")
            else:
                # Try to infer frameworks from category and content
                category = (question.category or '').lower()
                title_lower = (question.title or '').lower()
                desc_lower = (question.description or '').lower()
                combined = f"{title_lower} {desc_lower} {category}"
                
                inferred_compliance = []
                inferred_risk = []
                
                # Security questions
                if 'security' in category or 'security' in title_lower:
                    inferred_compliance = ["ISO27001", "SOC2", "NIST"]
                    inferred_risk = ["ISO27001", "NIST"]
                
                # Data protection/privacy
                elif 'data' in category or 'privacy' in category or 'gdpr' in combined:
                    inferred_compliance = ["GDPR", "SOC2"]
                    inferred_risk = ["GDPR"]
                
                # Healthcare
                elif 'hipaa' in combined or 'healthcare' in combined:
                    inferred_compliance = ["HIPAA"]
                    inferred_risk = ["HIPAA"]
                
                # Payment/PCI
                elif 'pci' in combined or 'payment' in combined:
                    inferred_compliance = ["PCI_DSS"]
                    inferred_risk = ["PCI_DSS"]
                
                # Business continuity
                elif 'continuity' in category or 'disaster' in title_lower or 'rto' in combined or 'rpo' in combined:
                    inferred_compliance = ["ISO27001", "SOC2"]
                    inferred_risk = ["ISO27001"]
                
                # Risk management
                elif 'risk' in category:
                    inferred_compliance = ["ISO27001", "SOC2"]
                    inferred_risk = ["ISO27001", "SOC2"]
                
                if inferred_compliance or inferred_risk:
                    compliance_ids = get_framework_ids_from_codes(db, inferred_compliance)
                    risk_ids = get_framework_ids_from_codes(db, inferred_risk)
                    
                    compliance_ids_str = [str(uid) for uid in compliance_ids] if compliance_ids else None
                    risk_ids_str = [str(uid) for uid in risk_ids] if risk_ids else None
                    
                    current_compliance = set(question.compliance_framework_ids or [])
                    current_risk = set(question.risk_framework_ids or [])
                    new_compliance = set(compliance_ids_str or [])
                    new_risk = set(risk_ids_str or [])
                    
                    if current_compliance != new_compliance or current_risk != new_risk:
                        question.compliance_framework_ids = compliance_ids_str
                        question.risk_framework_ids = risk_ids_str
                        db.add(question)
                        updated_count += 1
                        
                        compliance_names = [f.code for f in all_frameworks if f.id in compliance_ids]
                        risk_names = [f.code for f in all_frameworks if f.id in risk_ids]
                        logger.info(f"  ✓ {question.title[:60]} (inferred)")
                        logger.info(f"    Compliance: {compliance_names}")
                        logger.info(f"    Risk: {risk_names}")
        
        db.commit()
        
        logger.info(f"\n✅ Updated {updated_count} questions with framework mappings")
        
        # Summary
        questions_with_compliance = db.query(QuestionLibrary).filter(
            QuestionLibrary.compliance_framework_ids.isnot(None)
        ).count()
        
        questions_with_risk = db.query(QuestionLibrary).filter(
            QuestionLibrary.risk_framework_ids.isnot(None)
        ).count()
        
        logger.info(f"📊 Questions with compliance frameworks: {questions_with_compliance}/{len(all_questions)}")
        logger.info(f"📊 Questions with risk frameworks: {questions_with_risk}/{len(all_questions)}")
        
    except Exception as e:
        logger.error(f"Error updating questions: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    update_question_framework_mappings()
