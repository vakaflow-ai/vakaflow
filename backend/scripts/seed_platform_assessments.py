#!/usr/bin/env python3
"""
Seed Platform-Wide Assessment Templates for Compliance Frameworks

Creates standard assessments for:
- ISO 27001 (Information Security Management)
- SOC 2 Type II (Security, Availability, Processing Integrity, Confidentiality, Privacy)
- HIPAA (Healthcare Data Protection)
- GDPR (Data Privacy and Protection)
- PCI-DSS (Payment Card Industry Data Security)
- NIST Cybersecurity Framework
- TPRM (Third-Party Risk Management)
- Vendor Qualification
- Security Assessment
- Compliance Assessment

These assessments are created for all existing tenants and can be used as templates.
New tenants will get these assessments automatically when created.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.assessment import Assessment, AssessmentType, AssessmentStatus
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.question_library import QuestionLibrary
from app.services.assessment_service import AssessmentService
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Platform Assessment Templates
PLATFORM_ASSESSMENTS = [
    {
        "name": "ISO 27001 Information Security Assessment",
        "assessment_type": AssessmentType.COMPLIANCE_ASSESSMENT.value,
        "description": "Comprehensive assessment for ISO 27001 Information Security Management System (ISMS) compliance. Covers access control, cryptography, operations security, and incident management.",
        "business_purpose": "Evaluate vendor's information security management system against ISO 27001 standards to ensure adequate security controls are in place.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["ISO27001"],
    },
    {
        "name": "SOC 2 Type II Compliance Assessment",
        "assessment_type": AssessmentType.COMPLIANCE_ASSESSMENT.value,
        "description": "Assessment for SOC 2 Type II compliance covering Security, Availability, Processing Integrity, Confidentiality, and Privacy trust service criteria.",
        "business_purpose": "Verify vendor's compliance with SOC 2 Type II requirements for service organizations handling customer data.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["SOC2"],
    },
    {
        "name": "HIPAA Security and Privacy Assessment",
        "assessment_type": AssessmentType.COMPLIANCE_ASSESSMENT.value,
        "description": "Healthcare-specific assessment for HIPAA Security Rule and Privacy Rule compliance. Covers PHI protection, access controls, and breach notification procedures.",
        "business_purpose": "Ensure vendors handling Protected Health Information (PHI) comply with HIPAA security and privacy requirements.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["HIPAA"],
        "applicable_industries": ["healthcare"],
    },
    {
        "name": "GDPR Data Protection Assessment",
        "assessment_type": AssessmentType.COMPLIANCE_ASSESSMENT.value,
        "description": "Assessment for GDPR compliance covering data subject rights, data processing agreements, privacy by design, and breach notification requirements.",
        "business_purpose": "Verify vendor's compliance with GDPR requirements for processing personal data of EU residents.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["GDPR"],
    },
    {
        "name": "PCI-DSS Compliance Assessment",
        "assessment_type": AssessmentType.COMPLIANCE_ASSESSMENT.value,
        "description": "Payment Card Industry Data Security Standard assessment covering cardholder data protection, secure network architecture, and access controls.",
        "business_purpose": "Ensure vendors handling payment card data comply with PCI-DSS requirements.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["PCI_DSS"],
    },
    {
        "name": "NIST Cybersecurity Framework Assessment",
        "assessment_type": AssessmentType.SECURITY_ASSESSMENT.value,
        "description": "Assessment based on NIST Cybersecurity Framework covering Identify, Protect, Detect, Respond, and Recover functions.",
        "business_purpose": "Evaluate vendor's cybersecurity posture using NIST Cybersecurity Framework standards.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["NIST"],
    },
    {
        "name": "TPRM Assessment",
        "assessment_type": AssessmentType.TPRM.value,
        "description": "Comprehensive Third-Party Risk Management assessment covering security, compliance, operational, and financial risks associated with vendor relationships.",
        "business_purpose": "Systematically evaluate and manage risks associated with third-party vendors and service providers.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["ISO27001", "SOC2", "NIST"],
    },
    {
        "name": "Vendor Qualification Assessment",
        "assessment_type": AssessmentType.VENDOR_QUALIFICATION.value,
        "description": "Standard vendor qualification assessment covering business viability, security posture, compliance status, and operational capabilities.",
        "business_purpose": "Qualify new vendors before onboarding to ensure they meet organizational standards and requirements.",
        "status": AssessmentStatus.ACTIVE.value,
    },
    {
        "name": "Security Assessment",
        "assessment_type": AssessmentType.SECURITY_ASSESSMENT.value,
        "description": "Comprehensive security assessment covering information security policies, access controls, encryption, incident response, and vulnerability management.",
        "business_purpose": "Evaluate vendor's security posture and identify potential security risks.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["ISO27001", "SOC2", "NIST"],
    },
    {
        "name": "AI Vendor Qualification Assessment",
        "assessment_type": AssessmentType.AI_VENDOR_QUALIFICATION.value,
        "description": "Specialized assessment for AI/ML vendors covering model explainability, data governance, bias detection, and AI ethics compliance.",
        "business_purpose": "Qualify AI vendors to ensure responsible AI practices, model transparency, and ethical AI deployment.",
        "status": AssessmentStatus.ACTIVE.value,
        "compliance_frameworks": ["ISO27001", "SOC2"],
    },
]


def get_platform_admin_user(db):
    """Get or create platform admin user"""
    admin = db.query(User).filter(
        User.email == "platform-admin@vaka.com",
        User.role == UserRole.PLATFORM_ADMIN.value
    ).first()
    
    if not admin:
        logger.warning("Platform admin user not found. Creating assessments without owner_id.")
        return None
    
    return admin




def create_assessment_for_tenant(db, tenant_id, assessment_data, admin_user):
    """Create an assessment for a specific tenant"""
    # Check if assessment already exists
    existing = db.query(Assessment).filter(
        Assessment.tenant_id == tenant_id,
        Assessment.name == assessment_data["name"],
        Assessment.assessment_type == assessment_data["assessment_type"]
    ).first()
    
    if existing:
        logger.info(f"  ⊙ Assessment already exists: {assessment_data['name']} (tenant: {tenant_id})")
        return existing
    
    # Get tenant admin as owner if admin_user not available
    owner_id = admin_user.id if admin_user else None
    if not owner_id:
        tenant_admin = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role == UserRole.TENANT_ADMIN.value
        ).first()
        if tenant_admin:
            owner_id = tenant_admin.id
        else:
            logger.warning(f"  ⚠️  No owner found for tenant {tenant_id}, skipping assessment creation")
            return None
    
    # Create assessment
    assessment_service = AssessmentService(db)
    
    try:
        # First, get questions before creating assessment
        # We'll create a temporary assessment to get questions, then create the real one
        questions_count = 0
        
        # Get questions from question library
        from app.models.question_library import QuestionLibrary
        from app.models.compliance_framework import ComplianceFramework
        
        # Get platform-wide questions (tenant_id = NULL)
        platform_questions = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id.is_(None),
            QuestionLibrary.is_active == True
        ).all()
        
        # Get tenant-specific questions
        tenant_questions = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id == tenant_id,
            QuestionLibrary.is_active == True
        ).all()
        
        all_questions = platform_questions + tenant_questions
        
        # Filter questions based on assessment type and frameworks
        assessment_type = assessment_data.get("assessment_type")
        frameworks = assessment_data.get("compliance_frameworks", [])
        
        matched_questions = []
        
        for question in all_questions:
            # Check if question matches assessment type
            question_types = question.assessment_type
            if isinstance(question_types, str):
                try:
                    import json
                    question_types = json.loads(question_types)
                except:
                    question_types = [question_types]
            elif not isinstance(question_types, list):
                question_types = [question_types] if question_types else []
            
            question_types_lower = [str(t).lower() for t in question_types]
            
            # Match by assessment type
            if assessment_type.lower() in question_types_lower:
                matched_questions.append(question)
                continue
            
            # Match by compliance framework
            if frameworks and question.compliance_framework_ids:
                question_frameworks = question.compliance_framework_ids
                if isinstance(question_frameworks, list):
                    for fw_id in question_frameworks:
                        try:
                            framework = db.query(ComplianceFramework).filter(
                                ComplianceFramework.id == (uuid.UUID(fw_id) if isinstance(fw_id, str) else fw_id)
                            ).first()
                            if framework and framework.code in frameworks:
                                matched_questions.append(question)
                                break
                        except:
                            pass
        
        # Remove duplicates
        seen_ids = set()
        unique_questions = []
        for q in matched_questions:
            if q.id not in seen_ids:
                seen_ids.add(q.id)
                unique_questions.append(q)
        
        questions_to_add = unique_questions[:50]  # Limit to 50
        
        if not questions_to_add:
            logger.warning(f"  ⚠️  No questions found for {assessment_data['name']}. Skipping assessment creation.")
            return None
        
        # Create assessment with questions
        assessment = assessment_service.create_assessment(
            assessment_data={
                "name": assessment_data["name"],
                "assessment_type": assessment_data["assessment_type"],
                "description": assessment_data.get("description"),
                "business_purpose": assessment_data.get("business_purpose"),
                "status": assessment_data.get("status", AssessmentStatus.ACTIVE.value),
            },
            tenant_id=tenant_id,
            created_by=owner_id
        )
        
        # Add questions to assessment
        from app.models.assessment_question import AssessmentQuestion
        questions_added = 0
        for order, question in enumerate(questions_to_add):
            assessment_question = AssessmentQuestion(
                id=uuid.uuid4(),
                assessment_id=assessment.id,
                tenant_id=tenant_id,  # Required field
                question_type="new_question",
                question_text=question.question_text,
                title=question.title if hasattr(question, 'title') else None,
                description=question.description,
                field_type=question.field_type,
                response_type=question.response_type,
                category=question.category,
                is_required=question.is_required,
                options=question.options,
                order=order + 1,
                section=question.category or "General",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(assessment_question)
            questions_added += 1
        
        db.flush()  # Flush to ensure questions are saved
        
        logger.info(f"  ✅ Created assessment: {assessment_data['name']} with {questions_added} questions (tenant: {tenant_id})")
        return assessment
        
    except Exception as e:
        logger.error(f"  ❌ Error creating assessment {assessment_data['name']} for tenant {tenant_id}: {e}")
        return None


def seed_platform_assessments():
    """Seed platform assessments for all tenants"""
    logger.info("🌱 Starting platform assessment seeding...")
    logger.info("📝 Note: Assessments are created per tenant (not platform-wide)")
    logger.info("      Each tenant gets their own copy of these standard assessments\n")
    
    db = SessionLocal()
    try:
        # Get platform admin
        admin_user = get_platform_admin_user(db)
        if admin_user:
            logger.info(f"Using platform admin: {admin_user.email} (ID: {admin_user.id})")
        else:
            logger.warning("Platform admin not found. Will use tenant admins as owners.")
        
        # Get all tenants
        tenants = db.query(Tenant).all()
        logger.info(f"Found {len(tenants)} tenants\n")
        
        if not tenants:
            logger.warning("No tenants found. Please create a tenant first.")
            return
        
        total_created = 0
        total_skipped = 0
        
        # Create assessments for each tenant
        for tenant in tenants:
            logger.info(f"📋 Processing tenant: {tenant.name} (ID: {tenant.id})")
            
            tenant_created = 0
            tenant_skipped = 0
            
            for assessment_data in PLATFORM_ASSESSMENTS:
                result = create_assessment_for_tenant(db, tenant.id, assessment_data, admin_user)
                if result:
                    if db.is_modified(result) or result.id not in [a.id for a in db.query(Assessment).filter(Assessment.tenant_id == tenant.id).all()]:
                        tenant_created += 1
                    else:
                        tenant_skipped += 1
                else:
                    tenant_skipped += 1
            
            total_created += tenant_created
            total_skipped += tenant_skipped
            
            logger.info(f"  Created: {tenant_created}, Skipped: {tenant_skipped}\n")
        
        db.commit()
        
        logger.info("=" * 60)
        logger.info("✅ Platform assessment seeding complete!")
        logger.info("=" * 60)
        logger.info(f"\n📊 Summary:")
        logger.info(f"  • Total assessments created: {total_created}")
        logger.info(f"  • Total assessments skipped (already exist): {total_skipped}")
        logger.info(f"  • Assessments per tenant: {len(PLATFORM_ASSESSMENTS)}")
        logger.info(f"\n📋 Available Assessments:")
        for assessment_data in PLATFORM_ASSESSMENTS:
            frameworks = assessment_data.get("compliance_frameworks", [])
            fw_str = f" ({', '.join(frameworks)})" if frameworks else ""
            logger.info(f"  • {assessment_data['name']}{fw_str}")
        
    except Exception as e:
        logger.error(f"Error seeding assessments: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_platform_assessments()
