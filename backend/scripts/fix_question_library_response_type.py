#!/usr/bin/env python3
"""
Fix existing questions in Question Library to ensure response_type is properly set
This script auto-maps response_type based on field_type for questions that are missing it
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.question_library import QuestionLibrary
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_response_types():
    """Fix response_type for all questions in the library"""
    db = SessionLocal()
    try:
        # Get all questions
        questions = db.query(QuestionLibrary).all()
        
        logger.info(f"Found {len(questions)} questions to check")
        
        # Mapping from field_type to response_type
        field_type_to_response_type = {
            'file': 'File',
            'number': 'Number',
            'date': 'Date',
            'url': 'URL',
        }
        
        fixed_count = 0
        skipped_count = 0
        
        for question in questions:
            # Check if response_type needs to be fixed
            needs_fix = False
            expected_response_type = None
            
            # If response_type is None or empty, we need to fix it
            if not question.response_type or question.response_type.strip() == '':
                needs_fix = True
                expected_response_type = field_type_to_response_type.get(question.field_type, 'Text')
            # If response_type doesn't match field_type for locked types
            elif question.field_type in ['file', 'number', 'date']:
                expected_response_type = field_type_to_response_type[question.field_type]
                if question.response_type != expected_response_type:
                    needs_fix = True
            # For url, recommend URL but allow Text
            elif question.field_type == 'url' and question.response_type not in ['URL', 'Text']:
                needs_fix = True
                expected_response_type = 'URL'
            
            if needs_fix:
                old_response_type = question.response_type or '(empty)'
                question.response_type = expected_response_type
                question.updated_at = datetime.utcnow()
                
                logger.info(
                    f"  ✅ Fixed question '{question.title}' (ID: {question.id}): "
                    f"field_type={question.field_type}, "
                    f"response_type: {old_response_type} → {expected_response_type}"
                )
                fixed_count += 1
            else:
                skipped_count += 1
        
        if fixed_count > 0:
            db.commit()
            logger.info(f"\n✅ Successfully fixed {fixed_count} questions")
        else:
            logger.info(f"\n✅ All questions already have correct response_type")
        
        logger.info(f"  Skipped: {skipped_count} questions (already correct)")
        
        # Show summary by field_type
        logger.info("\n📊 Summary by field_type:")
        field_type_counts = {}
        for question in questions:
            ft = question.field_type
            rt = question.response_type
            key = f"{ft} → {rt}"
            field_type_counts[key] = field_type_counts.get(key, 0) + 1
        
        for key, count in sorted(field_type_counts.items()):
            logger.info(f"  {key}: {count} questions")
        
    except Exception as e:
        logger.error(f"❌ Error fixing response types: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("🔧 Starting response_type fix for Question Library...")
    fix_response_types()
    logger.info("✅ Done!")
