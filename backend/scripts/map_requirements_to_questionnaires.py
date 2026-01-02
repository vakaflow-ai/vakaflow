#!/usr/bin/env python3
"""
Map unmapped submission requirements to questionnaire types:
- TPRM- Questionnaire
- Vendor Security Questionnaire
- Sub Contractor Questionnaire
- Vendor Qualification
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.submission_requirement import SubmissionRequirement
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mapping of requirements to questionnaire types based on their content
QUESTIONNAIRE_MAPPING = {
    "TPRM- Questionnaire": [
        # Third-party risk management focused
        "third_party_vendor_risk",
        "third_party_risk",
        "third_party_security",
        "vendor_ratings",
        "vendor_reviews",
        "operational_risk_assessment",
        "operational_risk",
        "regulatory_compliance_risk",
    ],
    "Vendor Security Questionnaire": [
        # Security-focused requirements
        "authentication_mechanisms",
        "authorization_access_control",
        "iam_capabilities",
        "iam_details",
        "iam_controls",
        "api_security",
        "api_security_controls",
        "data_encryption",
        "data_encryption_controls",
        "encryption_at_rest",
        "encryption_in_transit",
        "security_architecture",
        "security_monitoring",
        "security_monitoring_incident_response",
        "vulnerability_management",
        "vulnerability_management_controls",
        "incident_response",
        "incident_response_plan",
        "penetration_testing",
        "audit_trail",
        "audit_logging_monitoring",
        "secure_sdlc",
        "it_infrastructure_security",
        "cloud_security_controls",
        "authentication_mfa_controls",
        "security_risk_assessment",
        "data_privacy_risk",
        "data_privacy_risk_assessment",
        "breach_notification",
        "security_awareness_training",
    ],
    "Sub Contractor Questionnaire": [
        # Sub-contractor specific requirements
        "data_processing_agreements",
        "employee_access_management",
        "employee_data_protection",
        "financial_data_protection",
        "payment_card_data_security",
        "support_maintenance",
        "sla_monitoring_controls",
        "pricing_licensing",
        "training_documentation",
        "integration_capabilities",
        "integration_details",
        "api_documentation",
    ],
    "Vendor Qualification": [
        # General vendor qualification
        "compliance_certifications",
        "regulatory_reporting",
        "regulatory_compliance_documentation",
        "gdpr_compliance",
        "gdpr_compliance_controls",
        "soc2_controls",
        "soc2_type2_controls",
        "iso27001_alignment",
        "iso27001_security_controls",
        "hipaa_compliance",
        "hipaa_security_privacy_controls",
        "pci_dss_compliance",
        "pci_dss_compliance_controls",
        "nist_cybersecurity",
        "nist_csf_controls",
        "ccpa_compliance",
        "ccpa_cpra_compliance_controls",
        "data_privacy_controls",
        "data_retention_policies",
        "data_retention_deletion",
        "data_subject_rights",
        "data_classification",
        "version_control_releases",
        "deployment_architecture",
        "ha_disaster_recovery",
        "bc_dr_controls",
        "change_management_controls",
    ],
}


def map_requirements_to_questionnaires():
    """Map unmapped requirements to questionnaire types"""
    db = SessionLocal()
    try:
        # Get all requirements that don't have questionnaire_type set
        unmapped_requirements = db.query(SubmissionRequirement).filter(
            SubmissionRequirement.questionnaire_type.is_(None)
        ).all()
        
        logger.info(f"Found {len(unmapped_requirements)} unmapped requirements")
        
        mapped_count = 0
        for requirement in unmapped_requirements:
            # Try to find matching questionnaire type based on field_name
            questionnaire_type = None
            for q_type, field_names in QUESTIONNAIRE_MAPPING.items():
                if requirement.field_name in field_names:
                    questionnaire_type = q_type
                    break
            
            # If not found by field_name, try to match by label/keywords
            if not questionnaire_type:
                label_lower = requirement.label.lower()
                if any(keyword in label_lower for keyword in ['third-party', 'vendor risk', 'tprm', 'third party']):
                    questionnaire_type = "TPRM- Questionnaire"
                elif any(keyword in label_lower for keyword in ['security', 'authentication', 'authorization', 'encryption', 'vulnerability', 'incident']):
                    questionnaire_type = "Vendor Security Questionnaire"
                elif any(keyword in label_lower for keyword in ['sub-contractor', 'subcontractor', 'sub contractor', 'employee', 'support', 'maintenance']):
                    questionnaire_type = "Sub Contractor Questionnaire"
                elif any(keyword in label_lower for keyword in ['compliance', 'certification', 'regulatory', 'gdpr', 'soc', 'iso', 'hipaa', 'pci', 'nist']):
                    questionnaire_type = "Vendor Qualification"
            
            if questionnaire_type:
                requirement.questionnaire_type = questionnaire_type
                requirement.updated_at = datetime.utcnow()
                mapped_count += 1
                logger.info(f"Mapped '{requirement.label}' to '{questionnaire_type}'")
        
        db.commit()
        logger.info(f"Successfully mapped {mapped_count} requirements to questionnaire types")
        
        # Show summary
        remaining_unmapped = db.query(SubmissionRequirement).filter(
            SubmissionRequirement.questionnaire_type.is_(None)
        ).count()
        logger.info(f"Remaining unmapped requirements: {remaining_unmapped}")
        
        # Show distribution by questionnaire type
        for q_type in QUESTIONNAIRE_MAPPING.keys():
            count = db.query(SubmissionRequirement).filter(
                SubmissionRequirement.questionnaire_type == q_type
            ).count()
            logger.info(f"  {q_type}: {count} requirements")
        
    except Exception as e:
        logger.error(f"Error mapping requirements: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    map_requirements_to_questionnaires()
