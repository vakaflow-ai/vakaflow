#!/usr/bin/env python3
"""
Verify that all questions from questionnaire Excel files are imported into the database.
Generate a report showing what's imported and what might be missing.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.submission_requirement import SubmissionRequirement
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def verify_imports():
    """Verify questionnaire imports and generate report"""
    db = SessionLocal()
    try:
        # Get all requirements
        all_requirements = db.query(SubmissionRequirement).all()
        total = len(all_requirements)
        
        logger.info(f"\n{'='*60}")
        logger.info("QUESTIONNAIRE IMPORT VERIFICATION REPORT")
        logger.info(f"{'='*60}\n")
        
        # Count by questionnaire type
        by_type = {}
        for q_type in ['TPRM- Questionnaire', 'Vendor Security Questionnaire', 'Sub Contractor Questionnaire', 'Vendor Qualification']:
            count = db.query(SubmissionRequirement).filter(SubmissionRequirement.questionnaire_type == q_type).count()
            by_type[q_type] = count
        
        logger.info(f"Total Requirements in Database: {total}\n")
        logger.info("Distribution by Questionnaire Type:")
        for k, v in sorted(by_type.items()):
            logger.info(f"  {k}: {v} requirements")
        
        # Count unmapped
        unmapped = db.query(SubmissionRequirement).filter(SubmissionRequirement.questionnaire_type.is_(None)).count()
        logger.info(f"\nUnmapped Requirements: {unmapped}")
        
        if unmapped > 0:
            logger.info("\nUnmapped Requirements List:")
            unmapped_reqs = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.questionnaire_type.is_(None)
            ).all()
            for req in unmapped_reqs[:10]:  # Show first 10
                logger.info(f"  - {req.label[:70]}... (field: {req.field_name})")
            if len(unmapped_reqs) > 10:
                logger.info(f"  ... and {len(unmapped_reqs) - 10} more")
        
        # Count by source (to see what came from Excel imports)
        logger.info("\n\nRequirements by Source:")
        sources = {}
        for req in all_requirements:
            source = req.source_name or 'Unknown'
            if 'Imported from' in source:
                filename = source.replace('Imported from ', '')
                if filename not in sources:
                    sources[filename] = 0
                sources[filename] += 1
        
        for filename, count in sorted(sources.items()):
            logger.info(f"  {filename}: {count} requirements")
        
        # Show sample questions from each type
        logger.info("\n\nSample Questions by Questionnaire Type:")
        for q_type in ['TPRM- Questionnaire', 'Vendor Security Questionnaire', 'Sub Contractor Questionnaire', 'Vendor Qualification']:
            samples = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.questionnaire_type == q_type
            ).limit(5).all()
            logger.info(f"\n{q_type}:")
            for req in samples:
                logger.info(f"  • {req.label[:80]}...")
        
        logger.info(f"\n{'='*60}")
        logger.info("VERIFICATION COMPLETE")
        logger.info(f"{'='*60}\n")
        
    except Exception as e:
        logger.error(f"Error verifying imports: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    verify_imports()
