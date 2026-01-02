#!/usr/bin/env python3
"""
Seed default questions for Question Library
Questions are organized by assessment type (TPRM, Vendor Qualification, etc.)
These questions can be reused across multiple assessments.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.question_library import QuestionLibrary
from app.models.tenant import Tenant
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Default Questions by Assessment Type
DEFAULT_QUESTIONS = {
    "tprm": [
        {
            "title": "Vendor Security Controls",
            "question_text": "Describe your organization's security controls and measures in place.",
            "description": "This question helps assess the vendor's security posture",
            "category": "security",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Data Protection Measures",
            "question_text": "What data protection measures do you have in place?",
            "description": "Assess vendor's data protection capabilities",
            "category": "data_protection",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Compliance Certifications",
            "question_text": "List all compliance certifications and attestations your organization holds.",
            "description": "Identify vendor compliance certifications",
            "category": "compliance",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": False,
        },
        {
            "title": "Incident Response Plan",
            "question_text": "Describe your incident response plan and procedures.",
            "description": "Assess vendor's incident response capabilities",
            "category": "security",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Business Continuity Plan",
            "question_text": "Provide details about your business continuity and disaster recovery plans.",
            "description": "Assess vendor's business continuity capabilities",
            "category": "business_continuity",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": False,
        },
    ],
    "vendor_qualification": [
        {
            "title": "Company Overview",
            "question_text": "Provide an overview of your company, including history, size, and key services.",
            "description": "Basic vendor information",
            "category": "general",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Financial Stability",
            "question_text": "Provide information about your company's financial stability and references.",
            "description": "Assess vendor financial health",
            "category": "business",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Service Delivery Capabilities",
            "question_text": "Describe your service delivery capabilities and processes.",
            "description": "Assess vendor service capabilities",
            "category": "business",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
    ],
    "risk_assessment": [
        {
            "title": "Risk Identification",
            "question_text": "Identify and describe the key risks associated with this engagement.",
            "description": "Risk identification question",
            "category": "risk_management",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Risk Mitigation Strategies",
            "question_text": "What strategies are in place to mitigate identified risks?",
            "description": "Assess risk mitigation capabilities",
            "category": "risk_management",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
    ],
    "security_assessment": [
        {
            "title": "Security Architecture",
            "question_text": "Describe your security architecture and infrastructure.",
            "description": "Assess security architecture",
            "category": "security",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Access Controls",
            "question_text": "Describe your access control mechanisms and policies.",
            "description": "Assess access control capabilities",
            "category": "security",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
    ],
    "compliance_assessment": [
        {
            "title": "Compliance Framework Alignment",
            "question_text": "Which compliance frameworks does your organization align with?",
            "description": "Identify compliance frameworks",
            "category": "compliance",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
        {
            "title": "Compliance Monitoring",
            "question_text": "How do you monitor and maintain compliance?",
            "description": "Assess compliance monitoring capabilities",
            "category": "compliance",
            "field_type": "textarea",
            "response_type": "Text",
            "is_required": True,
        },
    ],
}


def seed_question_library(tenant_id: uuid.UUID, created_by: uuid.UUID = None):
    """Seed question library for a tenant"""
    db = SessionLocal()
    try:
        count = 0
        for assessment_type, questions in DEFAULT_QUESTIONS.items():
            for question_data in questions:
                # Check if question already exists
                existing = db.query(QuestionLibrary).filter(
                    QuestionLibrary.tenant_id == tenant_id,
                    QuestionLibrary.title == question_data["title"],
                    QuestionLibrary.assessment_type == assessment_type
                ).first()
                
                if existing:
                    logger.debug(f"  ⏭️  Skipping existing question: {question_data['title']}")
                    continue
                
                question = QuestionLibrary(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    title=question_data["title"],
                    question_text=question_data["question_text"],
                    description=question_data.get("description"),
                    assessment_type=assessment_type,
                    category=question_data.get("category"),
                    field_type=question_data["field_type"],
                    response_type=question_data["response_type"],
                    is_required=question_data.get("is_required", False),
                    options=None,
                    validation_rules=None,
                    requirement_ids=None,
                    compliance_framework_ids=None,
                    applicable_industries=None,
                    created_by=created_by or tenant_id,  # Fallback to tenant_id if no user
                    updated_by=None,
                    is_active=True,
                    usage_count=0,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                
                db.add(question)
                count += 1
                logger.info(f"  ✅ Created question: {question_data['title']} ({assessment_type})")
        
        db.commit()
        logger.info(f"  📊 Created {count} questions for assessment types: {', '.join(DEFAULT_QUESTIONS.keys())}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"  ❌ Error seeding questions: {e}")
        raise
    finally:
        db.close()


def seed_all_tenants():
    """Seed question library for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("⚠️  No tenants found. Please create tenants first.")
            return
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🌱 Seeding Question Library for {len(tenants)} tenant(s)")
        logger.info(f"{'='*60}\n")
        
        for tenant in tenants:
            logger.info(f"📋 Processing tenant: {tenant.name} (ID: {tenant.id})")
            logger.info(f"{'='*60}")
            
            # Get first admin user for created_by
            from app.models.user import User, UserRole
            admin = db.query(User).filter(
                User.tenant_id == tenant.id,
                User.role.in_([UserRole.TENANT_ADMIN, UserRole.PLATFORM_ADMIN])
            ).first()
            
            created_by = admin.id if admin else None
            
            seed_question_library(tenant.id, created_by=created_by)
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ All tenants processed!")
        logger.info(f"{'='*60}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        seed_all_tenants()
    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}")
        sys.exit(1)
