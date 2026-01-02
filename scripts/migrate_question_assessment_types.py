#!/usr/bin/env python3
"""
Migration script to convert question_library.assessment_type from String to JSON array
"""
import sys
import os

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.question_library import QuestionLibrary
import json

def migrate_assessment_types():
    """Convert assessment_type from string to array for all questions"""
    db: Session = SessionLocal()
    
    try:
        print("Migrating question_library.assessment_type from String to JSON array...")
        print("=" * 60)
        
        # Get all questions
        questions = db.query(QuestionLibrary).all()
        
        migrated_count = 0
        skipped_count = 0
        
        for question in questions:
            # Check if assessment_type is already an array
            if isinstance(question.assessment_type, list):
                skipped_count += 1
                continue
            
            # Convert string to array
            if isinstance(question.assessment_type, str):
                question.assessment_type = [question.assessment_type]
                migrated_count += 1
                print(f"  ✓ Migrated question '{question.title}': '{question.assessment_type}' -> {question.assessment_type}")
            elif question.assessment_type is None:
                # Set default if None
                question.assessment_type = ['tprm']
                migrated_count += 1
                print(f"  ✓ Set default for question '{question.title}': ['tprm']")
        
        if migrated_count > 0:
            db.commit()
            print()
            print("=" * 60)
            print(f"Summary:")
            print(f"  - Migrated: {migrated_count} question(s)")
            print(f"  - Already arrays: {skipped_count} question(s)")
            print(f"  - Total: {len(questions)} question(s)")
            print()
            print("✅ Migration complete!")
        else:
            print()
            print("No questions needed migration. All assessment_type fields are already arrays.")
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_assessment_types()
