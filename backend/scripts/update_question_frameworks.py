#!/usr/bin/env python3
"""
Update existing platform questions with framework mappings from seed data
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

# Framework code mappings from seed script
FRAMEWORK_CODE_MAPPINGS = {
    'ISO27001': ['ISO27001', 'ISO_27001'],
    'SOC2': ['SOC2', 'SOC_2'],
    'NIST': ['NIST'],
    'HIPAA': ['HIPAA'],
    'GDPR': ['GDPR'],
    'PCI-DSS': ['PCI_DSS', 'PCI-DSS', 'PCI'],
    'PCI_DSS': ['PCI_DSS', 'PCI-DSS', 'PCI'],
}

def update_question_frameworks():
    """Update existing questions with framework mappings"""
    db = SessionLocal()
    try:
        # Get all frameworks
        all_frameworks = db.query(ComplianceFramework).all()
        framework_map = {}
        for f in all_frameworks:
            framework_map[f.code.upper()] = str(f.id)
            framework_map[f.code.lower()] = str(f.id)
            framework_map[f.code] = str(f.id)
        
        logger.info(f'Available frameworks: {[f.code for f in all_frameworks]}')
        
        # Read seed data to get expected mappings
        seed_file = os.path.join(os.path.dirname(__file__), 'seed_platform_question_library.py')
        with open(seed_file, 'r') as f:
            content = f.read()
        
        # Extract PLATFORM_QUESTIONS data (simplified - just get the structure)
        # For now, we'll use a heuristic approach based on question titles and categories
        
        questions = db.query(QuestionLibrary).filter(QuestionLibrary.tenant_id.is_(None)).all()
        logger.info(f'Found {len(questions)} platform questions')
        
        updated = 0
        for q in questions:
            compliance_ids = []
            risk_ids = []
            
            title_lower = (q.title or '').lower()
            category = (q.category or '').lower()
            desc_lower = (q.description or '').lower()
            combined = f'{title_lower} {desc_lower} {category}'
            
            # Security questions -> ISO27001, SOC2, NIST
            if 'security' in category or 'security' in title_lower:
                # Try ISO27001
                for code in FRAMEWORK_CODE_MAPPINGS.get('ISO27001', []):
                    if code.upper() in framework_map:
                        compliance_ids.append(framework_map[code.upper()])
                        break
                # Try SOC2
                for code in FRAMEWORK_CODE_MAPPINGS.get('SOC2', []):
                    if code.upper() in framework_map and framework_map[code.upper()] not in compliance_ids:
                        compliance_ids.append(framework_map[code.upper()])
                        break
                # Try NIST (if mentioned)
                if 'nist' in combined:
                    for code in FRAMEWORK_CODE_MAPPINGS.get('NIST', []):
                        if code.upper() in framework_map and framework_map[code.upper()] not in compliance_ids:
                            compliance_ids.append(framework_map[code.upper()])
                            break
            
            # Specific framework mentions
            if 'hipaa' in combined:
                for code in FRAMEWORK_CODE_MAPPINGS.get('HIPAA', []):
                    if code.upper() in framework_map and framework_map[code.upper()] not in compliance_ids:
                        compliance_ids.append(framework_map[code.upper()])
                        break
            
            if 'gdpr' in combined or 'data processing' in combined or 'data protection' in combined:
                for code in FRAMEWORK_CODE_MAPPINGS.get('GDPR', []):
                    if code.upper() in framework_map and framework_map[code.upper()] not in compliance_ids:
                        compliance_ids.append(framework_map[code.upper()])
                        break
            
            if 'pci' in combined or 'cardholder' in combined:
                for code in FRAMEWORK_CODE_MAPPINGS.get('PCI_DSS', []):
                    if code.upper() in framework_map and framework_map[code.upper()] not in compliance_ids:
                        compliance_ids.append(framework_map[code.upper()])
                        break
            
            # Data protection category -> GDPR, Privacy
            if 'data protection' in category:
                if 'GDPR' in framework_map and framework_map['GDPR'] not in compliance_ids:
                    compliance_ids.append(framework_map['GDPR'])
                if 'PRIVACY' in framework_map and framework_map['PRIVACY'] not in compliance_ids:
                    compliance_ids.append(framework_map['PRIVACY'])
            
            # Compliance category -> add common frameworks
            if 'compliance' in category and not compliance_ids:
                # Default to ISO27001 and SOC2 for general compliance
                for code in FRAMEWORK_CODE_MAPPINGS.get('ISO27001', []):
                    if code.upper() in framework_map:
                        compliance_ids.append(framework_map[code.upper()])
                        break
                for code in FRAMEWORK_CODE_MAPPINGS.get('SOC2', []):
                    if code.upper() in framework_map and framework_map[code.upper()] not in compliance_ids:
                        compliance_ids.append(framework_map[code.upper()])
                        break
            
            # Remove duplicates
            compliance_ids = list(dict.fromkeys(compliance_ids))
            
            # Update if we have mappings
            if compliance_ids:
                current_compliance = q.compliance_framework_ids or []
                if set(compliance_ids) != set(current_compliance):
                    q.compliance_framework_ids = compliance_ids
                    updated += 1
                    framework_names = [f.code for f in all_frameworks if str(f.id) in compliance_ids]
                    logger.info(f'  ✓ {q.title[:60]}: {framework_names}')
        
        db.commit()
        logger.info(f'\n✅ Updated {updated} questions with framework mappings')
        
        # Summary
        questions_with_frameworks = db.query(QuestionLibrary).filter(
            QuestionLibrary.tenant_id.is_(None),
            QuestionLibrary.compliance_framework_ids.isnot(None)
        ).count()
        logger.info(f'📊 Questions with frameworks: {questions_with_frameworks}/{len(questions)}')
        
    except Exception as e:
        logger.error(f'Error updating questions: {e}', exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("🔄 Updating platform questions with framework mappings...")
    update_question_frameworks()
    logger.info("✅ Done!")
