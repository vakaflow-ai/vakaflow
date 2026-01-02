#!/usr/bin/env python3
"""
Seed Requirements and Questions with proper mapping
Based on the structure:
- Requirements: High-level (R-SEC-1, R-SEC-2, etc.) - stored in submission_requirements
- Questions: Belong to requirements (1.1, 1.2, etc.) - stored in question_library with requirement_ids
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.submission_requirement import SubmissionRequirement, RequirementType
from app.models.question_library import QuestionLibrary
from app.models.tenant import Tenant
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Requirements and their associated questions
# Structure: requirement -> list of questions
REQUIREMENTS_AND_QUESTIONS = {
    "R-SEC-1": {
        "requirement": {
            "label": "Information Security Management Oversight",
            "field_name": "info_security_management_oversight",
            "field_type": "section",
            "description": "Requirement for information security management oversight",
            "category": "security",
            "section": "Security Requirements",
            "requirement_type": "compliance",
            "catalog_id": "R-SEC-1",
        },
        "questions": [
            {
                "ref": "1.1",
                "title": "Dedicated Security Officer",
                "question_text": "Does the organization have a dedicated information security officer and/or management position that oversees the program?",
                "description": "Assess if organization has dedicated security leadership",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "1.2",
                "title": "Security Policies",
                "question_text": "Does the organization have documented information security policies and procedures?",
                "description": "Assess documentation of security policies",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "1.3",
                "title": "Framework Alignment",
                "question_text": "Does the organization align with recognized security frameworks (e.g., NIST, ISO 27001)?",
                "description": "Assess framework alignment",
                "category": "compliance",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "1.4",
                "title": "Internal Risk Assessments",
                "question_text": "Does the organization conduct regular internal risk assessments?",
                "description": "Assess risk assessment practices",
                "category": "risk_management",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
        ],
    },
    "R-SEC-2": {
        "requirement": {
            "label": "Personnel Security",
            "field_name": "personnel_security",
            "field_type": "section",
            "description": "Requirement for personnel security controls",
            "category": "security",
            "section": "Security Requirements",
            "requirement_type": "compliance",
            "catalog_id": "R-SEC-2",
        },
        "questions": [
            {
                "ref": "2.1",
                "title": "Background Checks",
                "question_text": "Does the organization conduct background checks for employees with access to sensitive data?",
                "description": "Assess background check practices",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "2.2",
                "title": "Security Training",
                "question_text": "Is security training mandatory for all employees?",
                "description": "Assess security training requirements",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "2.3",
                "title": "Third-Party Access",
                "question_text": "Do third parties have access to sensitive data?",
                "description": "Assess third-party data access",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "2.4",
                "title": "Sensitive Data Processing",
                "question_text": "Does your organization process, store, transmit, access, and/or transmit sensitive data such as PII (Personally Identifiable Information), PHI (Protected Health Information), and/or CHD (Cardholder Data)?",
                "description": "Assess sensitive data handling",
                "category": "data_protection",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "2.4.1",
                "title": "Data Encryption",
                "question_text": "If the answer is 'Yes' to 2.4, is the information encrypted?",
                "description": "Assess encryption of sensitive data",
                "category": "data_protection",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}, {"value": "na", "label": "N/A"}],
            },
            {
                "ref": "2.5",
                "title": "Phishing Training",
                "question_text": "Does the organization provide phishing awareness training?",
                "description": "Assess phishing training",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "2.6",
                "title": "Phishing Campaign Metrics",
                "question_text": "Does the organization track metrics for phishing campaigns?",
                "description": "Assess phishing campaign tracking",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
        ],
    },
    "R-SEC-3": {
        "requirement": {
            "label": "Network Security",
            "field_name": "network_security",
            "field_type": "section",
            "description": "Requirement for network security controls",
            "category": "security",
            "section": "Security Requirements",
            "requirement_type": "compliance",
            "catalog_id": "R-SEC-3",
        },
        "questions": [
            {
                "ref": "3.1",
                "title": "Firewall Implementation",
                "question_text": "Does the organization use firewalls to protect network boundaries?",
                "description": "Assess firewall implementation",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "3.2",
                "title": "Web Application Firewall",
                "question_text": "Does the organization use a Web Application Firewall (WAF)?",
                "description": "Assess WAF implementation",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "3.3",
                "title": "Personal Device Access",
                "question_text": "Do employees access company systems from personal devices?",
                "description": "Assess BYOD policies",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "3.4",
                "title": "Intrusion Detection",
                "question_text": "Does the organization use Intrusion Detection/Prevention Systems (IDS/IPS)?",
                "description": "Assess IDS/IPS implementation",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "3.5",
                "title": "MFA for External Systems",
                "question_text": "Is multifactor authentication required for externally hosted systems?",
                "description": "Assess MFA requirements",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": True,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}],
            },
            {
                "ref": "3.6",
                "title": "VPN with MFA",
                "question_text": "Do you use a VPN? If yes, is multifactor authentication enabled?",
                "description": "Assess VPN and MFA implementation",
                "category": "security",
                "field_type": "radio",
                "response_type": "Text",
                "is_required": False,
                "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}, {"value": "na", "label": "N/A"}],
            },
        ],
    },
}


def seed_requirements_and_questions(tenant_id: uuid.UUID, created_by: uuid.UUID = None):
    """Seed requirements and questions with proper mapping"""
    db = SessionLocal()
    try:
        requirement_map = {}  # Map catalog_id to requirement UUID
        
        # Step 1: Create Requirements
        logger.info("  📋 Creating Requirements...")
        for catalog_id, data in REQUIREMENTS_AND_QUESTIONS.items():
            req_data = data["requirement"]
            
            # Check if requirement already exists
            existing = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == tenant_id,
                SubmissionRequirement.catalog_id == catalog_id
            ).first()
            
            if existing:
                logger.debug(f"  ⏭️  Skipping existing requirement: {catalog_id}")
                requirement_map[catalog_id] = existing.id
                continue
            
            requirement = SubmissionRequirement(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                label=req_data["label"],
                field_name=req_data["field_name"],
                field_type=req_data["field_type"],
                description=req_data.get("description"),
                category=req_data.get("category", "security"),
                section=req_data.get("section"),
                requirement_type=req_data.get("requirement_type", RequirementType.COMPLIANCE),
                catalog_id=catalog_id,
                is_required=True,
                is_active=True,
                created_by=created_by or tenant_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            db.add(requirement)
            db.flush()  # Get the ID
            requirement_map[catalog_id] = requirement.id
            logger.info(f"  ✅ Created requirement: {catalog_id} - {req_data['label']}")
        
        db.commit()
        
        # Step 2: Create Questions linked to Requirements
        logger.info("  📝 Creating Questions...")
        question_count = 0
        for catalog_id, data in REQUIREMENTS_AND_QUESTIONS.items():
            requirement_id = requirement_map[catalog_id]
            
            for question_data in data["questions"]:
                # Check if question already exists
                existing = db.query(QuestionLibrary).filter(
                    QuestionLibrary.tenant_id == tenant_id,
                    QuestionLibrary.title == question_data["title"],
                    QuestionLibrary.assessment_type == "tprm"
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
                    assessment_type="tprm",  # All these are TPRM questions
                    category=question_data.get("category"),
                    field_type=question_data["field_type"],
                    response_type=question_data["response_type"],
                    is_required=question_data.get("is_required", False),
                    options=question_data.get("options"),
                    validation_rules=None,
                    requirement_ids=None,  # No longer using JSON array - use junction table
                    compliance_framework_ids=None,
                    applicable_industries=None,
                    created_by=created_by or tenant_id,
                    updated_by=None,
                    is_active=True,
                    usage_count=0,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                
                db.add(question)
                db.flush()  # Get the question ID
                
                # Create junction table entry for many-to-many relationship
                from app.models.requirement_question import RequirementQuestion
                rq = RequirementQuestion(
                    id=uuid.uuid4(),
                    requirement_id=requirement_id,
                    question_id=question.id,
                    tenant_id=tenant_id,
                    order=question_count,  # Use question_count as order
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(rq)
                
                question_count += 1
                logger.info(f"  ✅ Created question: {question_data['ref']} - {question_data['title']} (linked to {catalog_id})")
        
        db.commit()
        logger.info(f"  📊 Created {len(requirement_map)} requirements and {question_count} questions")
        
    except Exception as e:
        db.rollback()
        logger.error(f"  ❌ Error seeding requirements and questions: {e}")
        raise
    finally:
        db.close()


def seed_all_tenants():
    """Seed requirements and questions for all tenants"""
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        
        if not tenants:
            logger.warning("⚠️  No tenants found. Please create tenants first.")
            return
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🌱 Seeding Requirements and Questions for {len(tenants)} tenant(s)")
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
            
            seed_requirements_and_questions(tenant.id, created_by=created_by)
        
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
