"""
Seed data script for policies, compliance rules, and review rules
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.policy import Policy, ComplianceCheck
from app.models.review import ReviewStage
from app.models.tenant import Tenant
from app.models.user import User
from datetime import datetime, date
import uuid

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

def seed_policies(db: Session):
    """Seed compliance policies"""
    print("🌱 Seeding policies...")
    
    policies_data = [
        {
            "name": "GDPR Compliance Policy",
            "description": "General Data Protection Regulation compliance requirements for EU data processing",
            "category": "compliance",
            "type": "regulatory",
            "region": "EU",
            "version": "1.0",
            "is_active": True,
            "requirements": [
                "Data encryption at rest and in transit",
                "Right to be forgotten implementation",
                "Data breach notification within 72 hours",
                "Privacy by design principles",
                "Data processing agreements with third parties",
                "Consent management system",
                "Data minimization practices"
            ],
            "rules": {
                "data_encryption": {
                    "required": True,
                    "description": "All personal data must be encrypted using AES-256 or equivalent"
                },
                "data_retention": {
                    "max_days": 365,
                    "description": "Personal data must not be retained longer than necessary"
                },
                "consent": {
                    "required": True,
                    "description": "Explicit consent must be obtained before processing personal data"
                }
            },
            "enforcement_controls": [
                {
                    "control": "Data Encryption",
                    "type": "required",
                    "description": "All personal data must be encrypted at rest and in transit using AES-256 or equivalent",
                    "validation_rule": "encryption_enabled == true AND encryption_standard >= 'AES-256'"
                },
                {
                    "control": "Right to be Forgotten",
                    "type": "required",
                    "description": "System must support data deletion requests from data subjects",
                    "validation_rule": "data_deletion_capability == true"
                },
                {
                    "control": "Consent Management",
                    "type": "required",
                    "description": "Explicit consent must be obtained and managed for data processing",
                    "validation_rule": "consent_management_system == true"
                }
            ],
            "required_attributes": [
                {
                    "attribute": "data_subject_type",
                    "type": "string",
                    "required": True,
                    "description": "Type of data subject (EU resident, etc.)",
                    "validation": "Must be specified"
                },
                {
                    "attribute": "encryption_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data encryption is enabled",
                    "validation": "Must be true"
                },
                {
                    "attribute": "encryption_standard",
                    "type": "string",
                    "required": True,
                    "description": "Encryption standard used (must be AES-256 or stronger)",
                    "validation": "Must be AES-256 or stronger"
                },
                {
                    "attribute": "consent_obtained",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether explicit consent has been obtained",
                    "validation": "Must be true"
                }
            ],
            "qualification_criteria": {
                "pass_threshold": 0.80,
                "checks": [
                    {
                        "check": "Data Encryption Verification",
                        "description": "Verify encryption is enabled and meets AES-256 standard",
                        "required": True
                    },
                    {
                        "check": "Consent Management Review",
                        "description": "Verify consent management system is implemented",
                        "required": True
                    },
                    {
                        "check": "Right to be Forgotten Capability",
                        "description": "Verify system can handle data deletion requests",
                        "required": True
                    }
                ],
                "scoring_method": "All required checks must pass (80% threshold)"
            },
            "applicability_criteria": {
                "data_types": ["PII", "personal data"],
                "regions": ["EU", "Europe"],
                "data_classification": ["PII", "personal"],
                "description": "Applies to agents that process personal data of EU residents"
            }
        },
        {
            "name": "SOC 2 Type II Compliance",
            "description": "Service Organization Control 2 Type II security and availability requirements",
            "category": "security",
            "type": "standard",
            "region": "Global",
            "version": "2.0",
            "effective_date": date.today(),
            "is_active": True,
            "requirements": [
                "Access controls and authentication",
                "System monitoring and logging",
                "Change management process",
                "Incident response procedures",
                "Backup and recovery procedures",
                "Vulnerability management",
                "Security awareness training"
            ],
            "rules": {
                "access_control": {
                    "required": True,
                    "mfa_required": True,
                    "description": "Multi-factor authentication required for all system access"
                },
                "logging": {
                    "required": True,
                    "retention_days": 90,
                    "description": "All security events must be logged and retained for 90 days"
                },
                "vulnerability_scanning": {
                    "frequency": "monthly",
                    "description": "Regular vulnerability scanning required"
                }
            }
        },
        {
            "name": "HIPAA Compliance Policy",
            "description": "Health Insurance Portability and Accountability Act requirements for healthcare data",
            "category": "compliance",
            "type": "regulatory",
            "region": "US",
            "version": "1.0",
            "is_active": True,
            "requirements": [
                "Protected Health Information (PHI) encryption",
                "Access controls and audit logs",
                "Business Associate Agreements (BAA)",
                "Minimum necessary rule",
                "Patient rights and notifications",
                "Breach notification procedures",
                "Workforce training on HIPAA"
            ],
            "rules": {
                "phi_encryption": {
                    "required": True,
                    "algorithm": "AES-256",
                    "description": "All PHI must be encrypted using AES-256"
                },
                "access_logging": {
                    "required": True,
                    "description": "All PHI access must be logged and auditable"
                },
                "baa_required": {
                    "required": True,
                    "description": "Business Associate Agreements required for all third-party processors"
                }
            },
            "enforcement_controls": [
                {
                    "control": "PHI Encryption",
                    "type": "required",
                    "description": "All Protected Health Information must be encrypted at rest and in transit using AES-256 or equivalent",
                    "validation_rule": "encryption_method == 'AES-256' AND encryption_at_rest == true AND encryption_in_transit == true"
                },
                {
                    "control": "Access Controls",
                    "type": "required",
                    "description": "Role-based access controls must be implemented with least privilege principle",
                    "validation_rule": "access_control_type == 'RBAC' AND least_privilege == true"
                },
                {
                    "control": "Audit Logging",
                    "type": "required",
                    "description": "All PHI access must be logged with user, timestamp, and action details",
                    "validation_rule": "audit_logging_enabled == true AND log_retention_days >= 90"
                },
                {
                    "control": "Business Associate Agreement",
                    "type": "required",
                    "description": "BAA must be executed with all third-party processors handling PHI",
                    "validation_rule": "baa_executed == true AND baa_expiry_date > current_date"
                }
            ],
            "required_attributes": [
                {
                    "attribute": "data_classification",
                    "type": "string",
                    "required": True,
                    "description": "Classification of data being processed (e.g., PHI, PII, Public)",
                    "validation": "Must be one of: PHI, PII, Public, Internal"
                },
                {
                    "attribute": "encryption_method",
                    "type": "string",
                    "required": True,
                    "description": "Encryption algorithm used (must be AES-256 or equivalent)",
                    "validation": "Must be AES-256 or stronger"
                },
                {
                    "attribute": "encryption_at_rest",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data is encrypted at rest",
                    "validation": "Must be true"
                },
                {
                    "attribute": "encryption_in_transit",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data is encrypted in transit (TLS/SSL)",
                    "validation": "Must be true"
                },
                {
                    "attribute": "access_control_type",
                    "type": "string",
                    "required": True,
                    "description": "Type of access control implemented",
                    "validation": "Must be RBAC, ABAC, or equivalent"
                },
                {
                    "attribute": "audit_logging_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether audit logging is enabled",
                    "validation": "Must be true"
                },
                {
                    "attribute": "log_retention_days",
                    "type": "number",
                    "required": True,
                    "description": "Number of days audit logs are retained",
                    "validation": "Must be >= 90"
                },
                {
                    "attribute": "baa_executed",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether Business Associate Agreement has been executed",
                    "validation": "Must be true"
                }
            ],
            "qualification_criteria": {
                "pass_threshold": 0.85,
                "checks": [
                    {
                        "check": "PHI Encryption Verification",
                        "description": "Verify that PHI is encrypted using AES-256 at rest and in transit",
                        "required": True
                    },
                    {
                        "check": "Access Control Review",
                        "description": "Review access control implementation and verify least privilege",
                        "required": True
                    },
                    {
                        "check": "Audit Logging Verification",
                        "description": "Verify audit logging is enabled and logs are retained for minimum 90 days",
                        "required": True
                    },
                    {
                        "check": "BAA Documentation",
                        "description": "Verify Business Associate Agreement is executed and current",
                        "required": True
                    },
                    {
                        "check": "Data Classification",
                        "description": "Verify data classification is properly documented",
                        "required": True
                    }
                ],
                "scoring_method": "Weighted average: All required checks must pass (100% weight) + optional checks (bonus points)"
            },
            "applicability_criteria": {
                "data_types": ["healthcare", "PHI", "medical"],
                "industries": ["healthcare", "medical"],
                "regions": ["US"],
                "data_classification": ["PHI", "PII"],
                "description": "Applies to agents that handle Protected Health Information (PHI) or operate in healthcare industry"
            }
        },
        {
            "name": "CCPA Compliance Policy",
            "description": "California Consumer Privacy Act requirements for California residents",
            "category": "compliance",
            "type": "regulatory",
            "region": "US-CA",
            "version": "1.0",
            "is_active": True,
            "requirements": [
                "Consumer privacy rights disclosure",
                "Opt-out mechanisms",
                "Data deletion requests",
                "Non-discrimination policy",
                "Data sale opt-out",
                "Privacy policy updates",
                "Third-party data sharing disclosure"
            ],
            "rules": {
                "opt_out": {
                    "required": True,
                    "description": "Clear opt-out mechanism must be provided"
                },
                "data_deletion": {
                    "response_days": 45,
                    "description": "Data deletion requests must be processed within 45 days"
                },
                "privacy_disclosure": {
                    "required": True,
                    "description": "Privacy policy must disclose data collection and usage"
                }
            }
        },
        {
            "name": "ISO 27001 Security Controls",
            "description": "Information Security Management System controls based on ISO 27001",
            "category": "security",
            "type": "standard",
            "region": "Global",
            "version": "2022",
            "effective_date": date.today(),
            "is_active": True,
            "requirements": [
                "Information security policy",
                "Organization of information security",
                "Human resource security",
                "Asset management",
                "Access control",
                "Cryptography",
                "Physical and environmental security",
                "Operations security",
                "Communications security",
                "System acquisition and maintenance",
                "Supplier relationships",
                "Information security incident management",
                "Business continuity management",
                "Compliance"
            ],
            "rules": {
                "risk_assessment": {
                    "frequency": "annual",
                    "description": "Annual risk assessment required"
                },
                "security_policy": {
                    "required": True,
                    "review_frequency": "annual",
                    "description": "Information security policy must be documented and reviewed annually"
                },
                "incident_response": {
                    "required": True,
                    "description": "Formal incident response procedure must be established"
                }
            }
        },
        {
            "name": "PCI DSS Compliance",
            "description": "Payment Card Industry Data Security Standard for payment card data",
            "category": "security",
            "type": "regulatory",
            "region": "Global",
            "version": "4.0",
            "effective_date": date.today(),
            "is_active": True,
            "requirements": [
                "Firewall configuration",
                "Default password changes",
                "Protect stored cardholder data",
                "Encrypt transmission of cardholder data",
                "Use and regularly update anti-virus software",
                "Develop and maintain secure systems",
                "Restrict access to cardholder data",
                "Assign unique ID to each person",
                "Restrict physical access",
                "Track and monitor network access",
                "Regularly test security systems",
                "Maintain information security policy"
            ],
            "rules": {
                "cardholder_data": {
                    "encryption_required": True,
                    "description": "Cardholder data must be encrypted at rest and in transit"
                },
                "access_control": {
                    "mfa_required": True,
                    "description": "Multi-factor authentication required for all access"
                },
                "vulnerability_scanning": {
                    "frequency": "quarterly",
                    "description": "Quarterly vulnerability scans required"
                }
            }
        },
        {
            "name": "Internal Security Policy",
            "description": "Company internal security standards and best practices",
            "category": "security",
            "type": "internal",
            "region": "Global",
            "version": "1.0",
            "is_active": True,
            "requirements": [
                "Password complexity requirements",
                "Session timeout policies",
                "API rate limiting",
                "Input validation and sanitization",
                "Error handling and logging",
                "Secure coding practices",
                "Dependency management"
            ],
            "rules": {
                "password_policy": {
                    "min_length": 12,
                    "complexity": True,
                    "expiration_days": 90,
                    "description": "Passwords must be at least 12 characters with complexity requirements"
                },
                "session_timeout": {
                    "minutes": 30,
                    "description": "User sessions must timeout after 30 minutes of inactivity"
                },
                "api_rate_limit": {
                    "requests_per_minute": 100,
                    "description": "API rate limiting of 100 requests per minute"
                }
            }
        },
        {
            "name": "Data Privacy Policy",
            "description": "General data privacy and protection requirements",
            "category": "compliance",
            "type": "internal",
            "region": "Global",
            "version": "1.0",
            "is_active": True,
            "requirements": [
                "Data classification",
                "Data retention policies",
                "Data deletion procedures",
                "Privacy impact assessments",
                "Data subject rights",
                "Third-party data sharing controls",
                "Privacy by design"
            ],
            "rules": {
                "data_classification": {
                    "required": True,
                    "levels": ["public", "internal", "confidential", "restricted"],
                    "description": "All data must be classified according to sensitivity"
                },
                "retention_policy": {
                    "required": True,
                    "description": "Data retention periods must be defined and enforced"
                },
                "privacy_by_design": {
                    "required": True,
                    "description": "Privacy considerations must be built into system design"
                }
            }
        }
    ]
    
    for policy_data in policies_data:
        # Check if policy already exists
        existing = db.query(Policy).filter(
            Policy.name == policy_data["name"],
            Policy.version == policy_data["version"]
        ).first()
        
        if not existing:
            policy = Policy(**policy_data)
            db.add(policy)
            print(f"  ✓ Created policy: {policy_data['name']}")
        else:
            print(f"  ⊙ Policy already exists: {policy_data['name']}")
    
    db.commit()
    print(f"✅ Seeded {len(policies_data)} policies\n")


def seed_review_stages(db: Session):
    """Seed review stages configuration"""
    print("🌱 Seeding review stages...")
    
    stages_data = [
        {
            "name": "security",
            "order_index": 1,
            "description": "Review agent security aspects including authentication, authorization, encryption, and vulnerability management",
            "is_required": True,
            "auto_assign": False
        },
        {
            "name": "compliance",
            "order_index": 2,
            "description": "Review agent compliance with regulatory requirements and internal policies",
            "is_required": True,
            "auto_assign": False
        },
        {
            "name": "technical",
            "order_index": 3,
            "description": "Review agent technical implementation, architecture, performance, and scalability",
            "is_required": True,
            "auto_assign": False
        },
        {
            "name": "business",
            "order_index": 4,
            "description": "Review agent business value, ROI, use cases, and alignment with business goals",
            "is_required": True,
            "auto_assign": False
        }
    ]
    
    for stage_data in stages_data:
        # Check if stage already exists
        existing = db.query(ReviewStage).filter(
            ReviewStage.name == stage_data["name"]
        ).first()
        
        if not existing:
            stage = ReviewStage(**stage_data)
            db.add(stage)
            print(f"  ✓ Created review stage: {stage_data['name']}")
        else:
            print(f"  ⊙ Review stage already exists: {stage_data['name']}")
    
    db.commit()
    print(f"✅ Seeded {len(stages_data)} review stages\n")


def seed_compliance_rules(db: Session):
    """Seed compliance checking rules"""
    print("🌱 Seeding compliance rules...")
    
    # Get policies
    policies = db.query(Policy).all()
    
    if not policies:
        print("  ⚠ No policies found. Please seed policies first.")
        return
    
    print(f"  ℹ Found {len(policies)} policies for rule generation")
    print("  ✓ Compliance rules are embedded in policy definitions")
    print("✅ Compliance rules ready\n")


def main():
    """Main seed function"""
    print("=" * 60)
    print("🌱 Seeding Policies, Compliance Rules, and Review Stages")
    print("=" * 60)
    print()
    
    db = SessionLocal()
    try:
        seed_policies(db)
        seed_review_stages(db)
        seed_compliance_rules(db)
        
        print("=" * 60)
        print("✅ Seed data creation complete!")
        print("=" * 60)
        print()
        print("📊 Summary:")
        policy_count = db.query(Policy).count()
        stage_count = db.query(ReviewStage).count()
        print(f"  • Policies: {policy_count}")
        print(f"  • Review Stages: {stage_count}")
        print()
        
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()

