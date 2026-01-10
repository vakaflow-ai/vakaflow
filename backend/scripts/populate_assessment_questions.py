#!/usr/bin/env python3
"""
Populate existing assessments with questions from question library
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.assessment import Assessment, AssessmentQuestion
from app.models.question_library import QuestionLibrary
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def populate_assessment_questions(assessment, tenant_id, db):
    """Populate an assessment with questions from question library"""
    # Check if already has questions
    existing_count = db.query(AssessmentQuestion).filter(
        AssessmentQuestion.assessment_id == assessment.id
    ).count()
    
    if existing_count > 0:
        logger.info(f"  ⊙ {assessment.name}: Already has {existing_count} questions")
        return existing_count
    
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
    
    # Filter questions based on assessment type
    questions = []
    for q in all_questions:
        if not q.assessment_type:
            continue
        
        # Normalize assessment_type to a list
        q_types = q.assessment_type
        if isinstance(q_types, str):
            try:
                import json
                q_types = json.loads(q_types)
            except:
                q_types = [q_types]
        elif not isinstance(q_types, list):
            q_types = [q_types] if q_types else []
        
        # Check if assessment type matches
        q_types_lower = [str(t).lower() if t else "" for t in q_types]
        if assessment.assessment_type.lower() in q_types_lower:
            questions.append(q)
    
    # Remove duplicates
    seen_ids = set()
    unique_questions = []
    for q in questions:
        if q.id not in seen_ids:
            seen_ids.add(q.id)
            unique_questions.append(q)
    
    questions_to_add = unique_questions[:50]  # Limit to 50
    
    if not questions_to_add:
        logger.warning(f"  ⚠️  {assessment.name}: No questions found")
        return 0
    
    # Add questions
    from datetime import datetime
    for order, question in enumerate(questions_to_add):
        assessment_question = AssessmentQuestion(
            id=uuid.uuid4(),
            assessment_id=assessment.id,
            tenant_id=tenant_id,
            question_type="new_question",
            question_text=question.question_text,
            title=question.title if hasattr(question, 'title') else None,
            description=question.description,
            field_type=question.field_type,
            response_type=question.response_type if hasattr(question, 'response_type') else None,
            category=question.category if hasattr(question, 'category') else None,
            is_required=question.is_required,
            options=question.options,
            validation_rules=question.validation_rules,
            order=order,
            section=question.category or "General",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(assessment_question)
    
    logger.info(f"  ✅ {assessment.name}: Added {len(questions_to_add)} questions")
    return len(questions_to_add)


def main():
    """Populate all assessments with questions"""
    db = SessionLocal()
    try:
        # Get all tenants
        from app.models.tenant import Tenant
        tenants = db.query(Tenant).all()
        
        total_populated = 0
        
        for tenant in tenants:
            logger.info(f"\n📋 Processing tenant: {tenant.name} (ID: {tenant.id})")
            
            assessments = db.query(Assessment).filter(
                Assessment.tenant_id == tenant.id
            ).all()
            
            tenant_populated = 0
            for assessment in assessments:
                count = populate_assessment_questions(assessment, tenant.id, db)
                if count > 0:
                    tenant_populated += count
            
            db.commit()
            total_populated += tenant_populated
            logger.info(f"  Total questions added: {tenant_populated}")
        
        logger.info(f"\n✅ Done! Total questions added: {total_populated}")
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
