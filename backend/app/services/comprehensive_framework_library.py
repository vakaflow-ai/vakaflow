"""
Comprehensive Compliance Framework Library
Contains detailed requirements, rules, controls, attributes, applicability criteria, and risks
for all major compliance frameworks
"""
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)


class ComprehensiveFrameworkLibrary:
    """Comprehensive library of compliance frameworks with all details"""
    
    FRAMEWORKS: Dict[str, Dict[str, Any]] = {
        "NERC_CIP": {
            "name": "NERC CIP",
            "code": "NERC_CIP",
            "description": "North American Electric Reliability Corporation Critical Infrastructure Protection standards for bulk electric system cybersecurity",
            "region": "US",
            "category": "energy",
            "version": "CIP-014-3",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["critical_infrastructure", "energy", "BES"],
                "industries": ["energy", "utilities", "electric_power"],
                "regions": ["US", "Canada"],
                "data_classification": ["critical", "BES"],
                "description": "Applies to entities that own or operate bulk electric system (BES) cyber assets"
            },
            "risks": [
                {
                    "name": "Unauthorized Access to Critical Cyber Assets",
                    "code": "NERC_CIP_RISK_001",
                    "description": "Risk of unauthorized access to critical cyber assets leading to system compromise",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Physical Security Breach",
                    "code": "NERC_CIP_RISK_002",
                    "description": "Risk of physical security breach affecting critical cyber assets",
                    "severity": "high",
                    "category": "physical_security"
                },
                {
                    "name": "Electronic Security Perimeter Violation",
                    "code": "NERC_CIP_RISK_003",
                    "description": "Risk of electronic security perimeter being breached or bypassed",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Inadequate Change Management",
                    "code": "NERC_CIP_RISK_004",
                    "description": "Risk of unauthorized or unmanaged changes to critical cyber assets",
                    "severity": "high",
                    "category": "operational"
                },
                {
                    "name": "Insufficient Incident Response",
                    "code": "NERC_CIP_RISK_005",
                    "description": "Risk of inadequate incident response leading to extended system compromise",
                    "severity": "high",
                    "category": "operational"
                }
            ],
            "rules": [
                {
                    "name": "BES-Contractor Access Audit",
                    "code": "NERC_CIP_001",
                    "description": "All BES-Contractor access must be audited and logged",
                    "requirement_text": "BES-Contractor Access shall be Audited",
                    "requirement_code": "CIP-004-6",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"],
                        "regions": ["US", "Canada"]
                    },
                    "order": 1
                },
                {
                    "name": "Physical Security Controls",
                    "code": "NERC_CIP_002",
                    "description": "Physical security controls for critical cyber assets",
                    "requirement_text": "Physical security controls must be implemented for critical cyber assets",
                    "requirement_code": "CIP-006-6",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"]
                    },
                    "order": 2
                },
                {
                    "name": "Electronic Security Perimeter",
                    "code": "NERC_CIP_003",
                    "description": "Electronic security perimeters for critical cyber assets",
                    "requirement_text": "Electronic security perimeters must be established and maintained",
                    "requirement_code": "CIP-005-6",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"]
                    },
                    "order": 3
                },
                {
                    "name": "Access Control and Monitoring",
                    "code": "NERC_CIP_004",
                    "description": "Access control and monitoring for critical cyber assets",
                    "requirement_text": "Access control and monitoring must be implemented for all critical cyber assets",
                    "requirement_code": "CIP-007-6",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"]
                    },
                    "order": 4
                },
                {
                    "name": "Change Control and Configuration Management",
                    "code": "NERC_CIP_005",
                    "description": "Change control and configuration management procedures",
                    "requirement_text": "Change control and configuration management procedures must be documented and enforced",
                    "requirement_code": "CIP-010-3",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"]
                    },
                    "order": 5
                },
                {
                    "name": "Incident Response and Recovery Planning",
                    "code": "NERC_CIP_006",
                    "description": "Incident response and recovery planning",
                    "requirement_text": "Incident response and recovery planning procedures must be established and tested",
                    "requirement_code": "CIP-008-6",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"]
                    },
                    "order": 6
                },
                {
                    "name": "Personnel and Training",
                    "code": "NERC_CIP_007",
                    "description": "Personnel and training for critical cyber assets",
                    "requirement_text": "Personnel with access to critical cyber assets must be trained and authorized",
                    "requirement_code": "CIP-004-6",
                    "conditions": {
                        "agent_category": ["energy", "utilities"],
                        "data_types": ["BES", "critical_infrastructure"]
                    },
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "bes_classification",
                    "type": "string",
                    "required": True,
                    "description": "Bulk Electric System classification level",
                    "validation": "Must be one of: High, Medium, Low"
                },
                {
                    "attribute": "critical_cyber_asset_count",
                    "type": "number",
                    "required": True,
                    "description": "Number of critical cyber assets",
                    "validation": "Must be >= 0"
                },
                {
                    "attribute": "physical_security_controls",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether physical security controls are implemented",
                    "validation": "Must be true"
                },
                {
                    "attribute": "electronic_perimeter_established",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether electronic security perimeter is established",
                    "validation": "Must be true"
                },
                {
                    "attribute": "access_logging_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether access logging is enabled",
                    "validation": "Must be true"
                },
                {
                    "attribute": "log_retention_days",
                    "type": "number",
                    "required": True,
                    "description": "Number of days access logs are retained",
                    "validation": "Must be >= 90"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Access Logging",
                    "type": "required",
                    "description": "All access to critical cyber assets must be logged and audited"
                },
                {
                    "control": "Physical Security",
                    "type": "required",
                    "description": "Physical security controls for critical cyber assets"
                },
                {
                    "control": "Electronic Perimeter",
                    "type": "required",
                    "description": "Electronic security perimeters for critical cyber assets"
                },
                {
                    "control": "Multi-Factor Authentication",
                    "type": "required",
                    "description": "MFA required for access to critical cyber assets"
                },
                {
                    "control": "Change Management",
                    "type": "required",
                    "description": "Formal change control and configuration management procedures"
                },
                {
                    "control": "Incident Response Plan",
                    "type": "required",
                    "description": "Documented incident response and recovery procedures"
                }
            ]
        },
        "HIPAA": {
            "name": "HIPAA",
            "code": "HIPAA",
            "description": "Health Insurance Portability and Accountability Act - Standards for protection of Protected Health Information (PHI)",
            "region": "US",
            "category": "healthcare",
            "version": "2023",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["healthcare", "PHI", "medical"],
                "industries": ["healthcare", "medical", "health_insurance"],
                "regions": ["US"],
                "data_classification": ["PHI", "PII"],
                "description": "Applies to covered entities and business associates that handle Protected Health Information"
            },
            "risks": [
                {
                    "name": "Unauthorized PHI Disclosure",
                    "code": "HIPAA_RISK_001",
                    "description": "Risk of unauthorized disclosure of Protected Health Information",
                    "severity": "critical",
                    "category": "privacy"
                },
                {
                    "name": "Insufficient Access Controls",
                    "code": "HIPAA_RISK_002",
                    "description": "Risk of inadequate access controls leading to unauthorized PHI access",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Data Breach",
                    "code": "HIPAA_RISK_003",
                    "description": "Risk of data breach resulting in PHI exposure",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Missing Business Associate Agreements",
                    "code": "HIPAA_RISK_004",
                    "description": "Risk of processing PHI without proper Business Associate Agreements",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Inadequate Audit Logging",
                    "code": "HIPAA_RISK_005",
                    "description": "Risk of insufficient audit logging preventing breach detection",
                    "severity": "high",
                    "category": "security"
                }
            ],
            "rules": [
                {
                    "name": "PHI Encryption",
                    "code": "HIPAA_001",
                    "description": "All PHI must be encrypted using AES-256",
                    "requirement_text": "Protected Health Information (PHI) must be encrypted at rest and in transit using AES-256 or equivalent",
                    "requirement_code": "45 CFR 164.312(a)(2)(iv)",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 1
                },
                {
                    "name": "Access Controls and Audit Logs",
                    "code": "HIPAA_002",
                    "description": "Access controls and audit logs for PHI access",
                    "requirement_text": "Access controls and audit logs must be implemented for all PHI access",
                    "requirement_code": "45 CFR 164.312(a)(1)",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 2
                },
                {
                    "name": "Business Associate Agreements",
                    "code": "HIPAA_003",
                    "description": "Business Associate Agreements required for third-party processors",
                    "requirement_text": "Business Associate Agreements (BAA) must be executed with all third-party processors handling PHI",
                    "requirement_code": "45 CFR 164.314(a)",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 3
                },
                {
                    "name": "Minimum Necessary Rule",
                    "code": "HIPAA_004",
                    "description": "Minimum necessary rule for PHI access",
                    "requirement_text": "Access to PHI must be limited to the minimum necessary to accomplish the intended purpose",
                    "requirement_code": "45 CFR 164.502(b)",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 4
                },
                {
                    "name": "Patient Rights and Notifications",
                    "code": "HIPAA_005",
                    "description": "Patient rights and notification procedures",
                    "requirement_text": "Patient rights regarding PHI access, amendment, and accounting of disclosures must be supported",
                    "requirement_code": "45 CFR 164.524",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 5
                },
                {
                    "name": "Breach Notification Procedures",
                    "code": "HIPAA_006",
                    "description": "Breach notification procedures",
                    "requirement_text": "Breach notification procedures must be established and executed within 60 days of discovery",
                    "requirement_code": "45 CFR 164.400-414",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 6
                },
                {
                    "name": "Workforce Training",
                    "code": "HIPAA_007",
                    "description": "Workforce training on HIPAA requirements",
                    "requirement_text": "Workforce members must be trained on HIPAA requirements and security awareness",
                    "requirement_code": "45 CFR 164.308(a)(5)",
                    "conditions": {
                        "agent_category": ["healthcare", "medical"],
                        "data_types": ["PHI", "healthcare"],
                        "regions": ["US"]
                    },
                    "order": 7
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
            "enforcement_controls": [
                {
                    "control": "PHI Encryption",
                    "type": "required",
                    "description": "All PHI must be encrypted at rest and in transit"
                },
                {
                    "control": "Access Controls",
                    "type": "required",
                    "description": "Access controls and audit logs for PHI access"
                },
                {
                    "control": "Business Associate Agreements",
                    "type": "required",
                    "description": "BAA required for all third-party processors"
                },
                {
                    "control": "Audit Logging",
                    "type": "required",
                    "description": "All PHI access must be logged and auditable"
                },
                {
                    "control": "Breach Notification",
                    "type": "required",
                    "description": "Breach notification procedures within 60 days"
                }
            ]
        },
        "GDPR": {
            "name": "GDPR",
            "code": "GDPR",
            "description": "General Data Protection Regulation - EU data protection and privacy regulation",
            "region": "EU",
            "category": "data_privacy",
            "version": "2018",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["PII", "personal_data"],
                "industries": ["all"],
                "regions": ["EU", "Europe"],
                "data_classification": ["PII", "personal"],
                "description": "Applies to organizations processing personal data of EU residents, regardless of location"
            },
            "risks": [
                {
                    "name": "Unauthorized Data Processing",
                    "code": "GDPR_RISK_001",
                    "description": "Risk of processing personal data without lawful basis",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Data Breach",
                    "code": "GDPR_RISK_002",
                    "description": "Risk of personal data breach resulting in unauthorized access",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Insufficient Data Subject Rights",
                    "code": "GDPR_RISK_003",
                    "description": "Risk of not properly implementing data subject rights",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Inadequate Data Protection Impact Assessment",
                    "code": "GDPR_RISK_004",
                    "description": "Risk of not conducting required DPIA for high-risk processing",
                    "severity": "medium",
                    "category": "compliance"
                },
                {
                    "name": "Missing Data Processing Agreements",
                    "code": "GDPR_RISK_005",
                    "description": "Risk of processing data without proper Data Processing Agreements",
                    "severity": "high",
                    "category": "compliance"
                }
            ],
            "rules": [
                {
                    "name": "Data Encryption and Pseudonymization",
                    "code": "GDPR_001",
                    "description": "Personal data must be encrypted and pseudonymized",
                    "requirement_text": "Data encryption and pseudonymization must be implemented for personal data",
                    "requirement_code": "Art. 32(1)(a)",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 1
                },
                {
                    "name": "Right to be Forgotten",
                    "code": "GDPR_002",
                    "description": "Data deletion requests must be processed within 30 days",
                    "requirement_text": "Right to be forgotten (data deletion) must be implemented and requests processed within 30 days",
                    "requirement_code": "Art. 17",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 2
                },
                {
                    "name": "Data Breach Notification",
                    "code": "GDPR_003",
                    "description": "Data breaches must be reported within 72 hours",
                    "requirement_text": "Data breach notification must be provided to supervisory authority within 72 hours",
                    "requirement_code": "Art. 33",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 3
                },
                {
                    "name": "Data Subject Access Rights",
                    "code": "GDPR_004",
                    "description": "Data subject access rights must be supported",
                    "requirement_text": "Data subject access rights including access, rectification, and portability must be supported",
                    "requirement_code": "Art. 15-20",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 4
                },
                {
                    "name": "Privacy by Design and Default",
                    "code": "GDPR_005",
                    "description": "Privacy by design and default principles",
                    "requirement_text": "Privacy by design and default principles must be implemented in system design",
                    "requirement_code": "Art. 25",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 5
                },
                {
                    "name": "Data Processing Agreements",
                    "code": "GDPR_006",
                    "description": "Data Processing Agreements required for processors",
                    "requirement_text": "Data Processing Agreements (DPA) must be executed with all data processors",
                    "requirement_code": "Art. 28",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 6
                },
                {
                    "name": "Data Protection Impact Assessment",
                    "code": "GDPR_007",
                    "description": "DPIA required for high-risk processing",
                    "requirement_text": "Data Protection Impact Assessments (DPIA) must be conducted for high-risk processing activities",
                    "requirement_code": "Art. 35",
                    "conditions": {
                        "data_types": ["PII", "personal_data"],
                        "regions": ["EU", "Europe"]
                    },
                    "order": 7
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
                },
                {
                    "attribute": "data_retention_policy",
                    "type": "string",
                    "required": True,
                    "description": "Data retention policy and periods",
                    "validation": "Must be specified"
                },
                {
                    "attribute": "dpa_executed",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether Data Processing Agreement has been executed",
                    "validation": "Must be true"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Data Encryption",
                    "type": "required",
                    "description": "Personal data must be encrypted at rest and in transit"
                },
                {
                    "control": "Data Deletion",
                    "type": "required",
                    "description": "Right to be forgotten must be implemented"
                },
                {
                    "control": "Breach Notification",
                    "type": "required",
                    "description": "Data breach notification within 72 hours"
                },
                {
                    "control": "Consent Management",
                    "type": "required",
                    "description": "Explicit consent must be obtained and managed"
                },
                {
                    "control": "Data Processing Agreements",
                    "type": "required",
                    "description": "DPA required for all data processors"
                }
            ]
        },
        "SOC2": {
            "name": "SOC 2 Type II",
            "code": "SOC2",
            "description": "Service Organization Control 2 Type II - Security, availability, processing integrity, confidentiality, and privacy",
            "region": "Global",
            "category": "security",
            "version": "2017",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["all"],
                "industries": ["all"],
                "regions": ["Global"],
                "data_classification": ["all"],
                "description": "Applies to service organizations that provide services to other entities"
            },
            "risks": [
                {
                    "name": "Insufficient Access Controls",
                    "code": "SOC2_RISK_001",
                    "description": "Risk of inadequate access controls leading to unauthorized access",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Inadequate System Monitoring",
                    "code": "SOC2_RISK_002",
                    "description": "Risk of insufficient system monitoring preventing threat detection",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Weak Change Management",
                    "code": "SOC2_RISK_003",
                    "description": "Risk of unauthorized or unmanaged system changes",
                    "severity": "medium",
                    "category": "operational"
                },
                {
                    "name": "Insufficient Incident Response",
                    "code": "SOC2_RISK_004",
                    "description": "Risk of inadequate incident response procedures",
                    "severity": "high",
                    "category": "operational"
                },
                {
                    "name": "Inadequate Backup and Recovery",
                    "code": "SOC2_RISK_005",
                    "description": "Risk of data loss due to insufficient backup and recovery procedures",
                    "severity": "high",
                    "category": "operational"
                }
            ],
            "rules": [
                {
                    "name": "Access Controls and Authentication",
                    "code": "SOC2_001",
                    "description": "Multi-factor authentication required",
                    "requirement_text": "Access controls and authentication mechanisms must be implemented with MFA",
                    "requirement_code": "CC6.1",
                    "conditions": {},
                    "order": 1
                },
                {
                    "name": "System Monitoring and Logging",
                    "code": "SOC2_002",
                    "description": "Logs must be retained for 90 days minimum",
                    "requirement_text": "System monitoring and logging must be implemented with minimum 90-day retention",
                    "requirement_code": "CC7.2",
                    "conditions": {},
                    "order": 2
                },
                {
                    "name": "Incident Response Procedures",
                    "code": "SOC2_003",
                    "description": "Incident response procedures must be documented",
                    "requirement_text": "Incident response procedures must be established and tested",
                    "requirement_code": "CC7.3",
                    "conditions": {},
                    "order": 3
                },
                {
                    "name": "Change Management Process",
                    "code": "SOC2_004",
                    "description": "Change management process must be formalized",
                    "requirement_text": "Change management processes must be documented and enforced",
                    "requirement_code": "CC8.1",
                    "conditions": {},
                    "order": 4
                },
                {
                    "name": "Vulnerability Management",
                    "code": "SOC2_005",
                    "description": "Vulnerability scanning must be performed monthly",
                    "requirement_text": "Vulnerability management program must include regular scanning and remediation",
                    "requirement_code": "CC7.1",
                    "conditions": {},
                    "order": 5
                },
                {
                    "name": "Data Backup and Recovery",
                    "code": "SOC2_006",
                    "description": "Data backup and recovery procedures must be established",
                    "requirement_text": "Data backup and recovery procedures must be documented and tested",
                    "requirement_code": "CC7.4",
                    "conditions": {},
                    "order": 6
                },
                {
                    "name": "Availability and Performance Monitoring",
                    "code": "SOC2_007",
                    "description": "Availability and performance monitoring required",
                    "requirement_text": "Availability and performance monitoring must be implemented",
                    "requirement_code": "A1.1",
                    "conditions": {},
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "mfa_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether multi-factor authentication is enabled",
                    "validation": "Must be true"
                },
                {
                    "attribute": "log_retention_days",
                    "type": "number",
                    "required": True,
                    "description": "Number of days logs are retained",
                    "validation": "Must be >= 90"
                },
                {
                    "attribute": "vulnerability_scanning_frequency",
                    "type": "string",
                    "required": True,
                    "description": "Frequency of vulnerability scanning",
                    "validation": "Must be monthly or more frequent"
                },
                {
                    "attribute": "backup_frequency",
                    "type": "string",
                    "required": True,
                    "description": "Frequency of data backups",
                    "validation": "Must be specified"
                },
                {
                    "attribute": "incident_response_plan",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether incident response plan is documented",
                    "validation": "Must be true"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Access Controls",
                    "type": "required",
                    "description": "Access controls and authentication mechanisms"
                },
                {
                    "control": "System Monitoring",
                    "type": "required",
                    "description": "System monitoring and logging"
                },
                {
                    "control": "Incident Response",
                    "type": "required",
                    "description": "Incident response procedures"
                },
                {
                    "control": "Change Management",
                    "type": "required",
                    "description": "Formal change management process"
                },
                {
                    "control": "Vulnerability Management",
                    "type": "required",
                    "description": "Regular vulnerability scanning and remediation"
                }
            ]
        },
        "ISO27001": {
            "name": "ISO 27001",
            "code": "ISO27001",
            "description": "ISO/IEC 27001 - Information Security Management System (ISMS) standard",
            "region": "Global",
            "category": "security",
            "version": "2022",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["all"],
                "industries": ["all"],
                "regions": ["Global"],
                "data_classification": ["all"],
                "description": "Applies to any organization seeking to manage information security risks"
            },
            "risks": [
                {
                    "name": "Inadequate Risk Assessment",
                    "code": "ISO27001_RISK_001",
                    "description": "Risk of insufficient risk assessment leading to unidentified threats",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Weak Access Control",
                    "code": "ISO27001_RISK_002",
                    "description": "Risk of inadequate access controls",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Insufficient Cryptography",
                    "code": "ISO27001_RISK_003",
                    "description": "Risk of weak or missing cryptographic controls",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Inadequate Incident Management",
                    "code": "ISO27001_RISK_004",
                    "description": "Risk of insufficient incident management procedures",
                    "severity": "medium",
                    "category": "operational"
                },
                {
                    "name": "Weak Business Continuity",
                    "code": "ISO27001_RISK_005",
                    "description": "Risk of inadequate business continuity planning",
                    "severity": "high",
                    "category": "operational"
                }
            ],
            "rules": [
                {
                    "name": "Information Security Policy",
                    "code": "ISO27001_001",
                    "description": "Information security policy must be documented and reviewed annually",
                    "requirement_text": "Information security policy must be established, documented, and reviewed at planned intervals",
                    "requirement_code": "A.5.1.1",
                    "conditions": {},
                    "order": 1
                },
                {
                    "name": "Risk Assessment and Treatment",
                    "code": "ISO27001_002",
                    "description": "Annual risk assessment required",
                    "requirement_text": "Risk assessment and treatment must be performed at planned intervals",
                    "requirement_code": "A.6.1.2",
                    "conditions": {},
                    "order": 2
                },
                {
                    "name": "Access Control Policy",
                    "code": "ISO27001_003",
                    "description": "Access control policy must be implemented",
                    "requirement_text": "Access control policy must be established and enforced",
                    "requirement_code": "A.9.1.1",
                    "conditions": {},
                    "order": 3
                },
                {
                    "name": "Cryptography Controls",
                    "code": "ISO27001_004",
                    "description": "Cryptography controls must be implemented",
                    "requirement_text": "Cryptography controls must be implemented for protection of information",
                    "requirement_code": "A.10.1.1",
                    "conditions": {},
                    "order": 4
                },
                {
                    "name": "Physical and Environmental Security",
                    "code": "ISO27001_005",
                    "description": "Physical and environmental security controls required",
                    "requirement_text": "Physical and environmental security controls must be implemented",
                    "requirement_code": "A.11.1.1",
                    "conditions": {},
                    "order": 5
                },
                {
                    "name": "Operations Security",
                    "code": "ISO27001_006",
                    "description": "Operations security procedures required",
                    "requirement_text": "Operations security procedures must be documented and implemented",
                    "requirement_code": "A.12.1.1",
                    "conditions": {},
                    "order": 6
                },
                {
                    "name": "Incident Management",
                    "code": "ISO27001_007",
                    "description": "Incident management procedures must be documented",
                    "requirement_text": "Information security incident management procedures must be established",
                    "requirement_code": "A.16.1.1",
                    "conditions": {},
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "risk_assessment_frequency",
                    "type": "string",
                    "required": True,
                    "description": "Frequency of risk assessments",
                    "validation": "Must be annual or more frequent"
                },
                {
                    "attribute": "security_policy_review_frequency",
                    "type": "string",
                    "required": True,
                    "description": "Frequency of security policy review",
                    "validation": "Must be annual or more frequent"
                },
                {
                    "attribute": "access_control_implemented",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether access control is implemented",
                    "validation": "Must be true"
                },
                {
                    "attribute": "cryptography_controls",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether cryptography controls are implemented",
                    "validation": "Must be true"
                },
                {
                    "attribute": "incident_management_procedures",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether incident management procedures are documented",
                    "validation": "Must be true"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Risk Assessment",
                    "type": "required",
                    "description": "Risk assessment and treatment"
                },
                {
                    "control": "Access Control",
                    "type": "required",
                    "description": "Access control policy"
                },
                {
                    "control": "Cryptography",
                    "type": "required",
                    "description": "Cryptography controls"
                },
                {
                    "control": "Physical Security",
                    "type": "required",
                    "description": "Physical and environmental security"
                },
                {
                    "control": "Incident Management",
                    "type": "required",
                    "description": "Information security incident management"
                }
            ]
        },
        "PCI_DSS": {
            "name": "PCI DSS",
            "code": "PCI_DSS",
            "description": "Payment Card Industry Data Security Standard - Requirements for secure handling of cardholder data",
            "region": "Global",
            "category": "financial",
            "version": "4.0",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["payment_card", "cardholder_data"],
                "industries": ["financial", "retail", "ecommerce"],
                "regions": ["Global"],
                "data_classification": ["cardholder_data", "sensitive"],
                "description": "Applies to all entities involved in payment card processing"
            },
            "risks": [
                {
                    "name": "Cardholder Data Breach",
                    "code": "PCI_DSS_RISK_001",
                    "description": "Risk of cardholder data breach leading to financial fraud",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Insufficient Network Security",
                    "code": "PCI_DSS_RISK_002",
                    "description": "Risk of inadequate network security controls",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Weak Access Controls",
                    "code": "PCI_DSS_RISK_003",
                    "description": "Risk of insufficient access controls for cardholder data",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Inadequate Vulnerability Management",
                    "code": "PCI_DSS_RISK_004",
                    "description": "Risk of insufficient vulnerability scanning and patching",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Insufficient Network Monitoring",
                    "code": "PCI_DSS_RISK_005",
                    "description": "Risk of inadequate network monitoring and testing",
                    "severity": "high",
                    "category": "security"
                }
            ],
            "rules": [
                {
                    "name": "Cardholder Data Encryption",
                    "code": "PCI_DSS_001",
                    "description": "Cardholder data must be encrypted",
                    "requirement_text": "Cardholder data must be encrypted at rest and in transit using strong cryptography",
                    "requirement_code": "Req 3.4",
                    "conditions": {
                        "data_types": ["payment_card", "cardholder_data"],
                        "industries": ["financial", "retail", "ecommerce"]
                    },
                    "order": 1
                },
                {
                    "name": "Secure Network Architecture",
                    "code": "PCI_DSS_002",
                    "description": "Secure network architecture must be maintained",
                    "requirement_text": "Firewall configuration and secure network architecture must be maintained",
                    "requirement_code": "Req 1.1",
                    "conditions": {
                        "data_types": ["payment_card", "cardholder_data"],
                        "industries": ["financial", "retail", "ecommerce"]
                    },
                    "order": 2
                },
                {
                    "name": "Access Control Measures",
                    "code": "PCI_DSS_003",
                    "description": "MFA required for all access to cardholder data",
                    "requirement_text": "Multi-factor authentication required for all access to cardholder data",
                    "requirement_code": "Req 8.3",
                    "conditions": {
                        "data_types": ["payment_card", "cardholder_data"],
                        "industries": ["financial", "retail", "ecommerce"]
                    },
                    "order": 3
                },
                {
                    "name": "Vulnerability Management Program",
                    "code": "PCI_DSS_004",
                    "description": "Quarterly vulnerability scans required",
                    "requirement_text": "Vulnerability management program must include quarterly vulnerability scans",
                    "requirement_code": "Req 11.2",
                    "conditions": {
                        "data_types": ["payment_card", "cardholder_data"],
                        "industries": ["financial", "retail", "ecommerce"]
                    },
                    "order": 4
                },
                {
                    "name": "Network Monitoring and Testing",
                    "code": "PCI_DSS_005",
                    "description": "Network monitoring and testing required",
                    "requirement_text": "Network monitoring and testing must be performed regularly",
                    "requirement_code": "Req 11.4",
                    "conditions": {
                        "data_types": ["payment_card", "cardholder_data"],
                        "industries": ["financial", "retail", "ecommerce"]
                    },
                    "order": 5
                },
                {
                    "name": "Information Security Policy",
                    "code": "PCI_DSS_006",
                    "description": "Information security policy must be maintained",
                    "requirement_text": "Information security policy must be established and maintained",
                    "requirement_code": "Req 12.1",
                    "conditions": {
                        "data_types": ["payment_card", "cardholder_data"],
                        "industries": ["financial", "retail", "ecommerce"]
                    },
                    "order": 6
                }
            ],
            "required_attributes": [
                {
                    "attribute": "cardholder_data_encryption",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether cardholder data is encrypted",
                    "validation": "Must be true"
                },
                {
                    "attribute": "encryption_algorithm",
                    "type": "string",
                    "required": True,
                    "description": "Encryption algorithm used",
                    "validation": "Must be AES-256 or stronger"
                },
                {
                    "attribute": "mfa_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether multi-factor authentication is enabled",
                    "validation": "Must be true"
                },
                {
                    "attribute": "vulnerability_scanning_frequency",
                    "type": "string",
                    "required": True,
                    "description": "Frequency of vulnerability scanning",
                    "validation": "Must be quarterly or more frequent"
                },
                {
                    "attribute": "network_monitoring_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether network monitoring is enabled",
                    "validation": "Must be true"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Cardholder Data Encryption",
                    "type": "required",
                    "description": "Cardholder data must be encrypted"
                },
                {
                    "control": "Multi-Factor Authentication",
                    "type": "required",
                    "description": "MFA required for access to cardholder data"
                },
                {
                    "control": "Vulnerability Management",
                    "type": "required",
                    "description": "Vulnerability management program"
                },
                {
                    "control": "Network Monitoring",
                    "type": "required",
                    "description": "Network monitoring and testing"
                },
                {
                    "control": "Secure Network Architecture",
                    "type": "required",
                    "description": "Firewall configuration and secure network architecture"
                }
            ]
        },
        "CCPA": {
            "name": "CCPA",
            "code": "CCPA",
            "description": "California Consumer Privacy Act - Privacy rights for California residents",
            "region": "US-CA",
            "category": "data_privacy",
            "version": "2023",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["PII", "personal_information"],
                "industries": ["all"],
                "regions": ["US-CA", "California"],
                "data_classification": ["PII", "personal"],
                "description": "Applies to businesses that collect personal information of California residents"
            },
            "risks": [
                {
                    "name": "Consumer Rights Violation",
                    "code": "CCPA_RISK_001",
                    "description": "Risk of not properly implementing consumer privacy rights",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Insufficient Opt-Out Mechanisms",
                    "code": "CCPA_RISK_002",
                    "description": "Risk of inadequate opt-out mechanisms for data sale",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Inadequate Data Deletion",
                    "code": "CCPA_RISK_003",
                    "description": "Risk of not properly processing data deletion requests",
                    "severity": "medium",
                    "category": "compliance"
                },
                {
                    "name": "Missing Privacy Disclosures",
                    "code": "CCPA_RISK_004",
                    "description": "Risk of insufficient privacy policy disclosures",
                    "severity": "medium",
                    "category": "compliance"
                }
            ],
            "rules": [
                {
                    "name": "Consumer Privacy Rights Disclosure",
                    "code": "CCPA_001",
                    "description": "Privacy policy must disclose data collection and usage",
                    "requirement_text": "Consumer privacy rights disclosure must be provided in privacy policy",
                    "requirement_code": "1798.100",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 1
                },
                {
                    "name": "Opt-Out Mechanisms",
                    "code": "CCPA_002",
                    "description": "Clear opt-out mechanism must be provided",
                    "requirement_text": "Opt-out mechanisms for data sale must be provided and easily accessible",
                    "requirement_code": "1798.120",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 2
                },
                {
                    "name": "Data Deletion Requests",
                    "code": "CCPA_003",
                    "description": "Data deletion requests must be processed within 45 days",
                    "requirement_text": "Data deletion requests must be processed within 45 days",
                    "requirement_code": "1798.105",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 3
                },
                {
                    "name": "Non-Discrimination Policy",
                    "code": "CCPA_004",
                    "description": "Non-discrimination policy for exercising privacy rights",
                    "requirement_text": "Non-discrimination policy must be implemented for consumers exercising privacy rights",
                    "requirement_code": "1798.125",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 4
                },
                {
                    "name": "Data Sale Opt-Out",
                    "code": "CCPA_005",
                    "description": "Data sale opt-out mechanism required",
                    "requirement_text": "Data sale opt-out mechanism must be provided",
                    "requirement_code": "1798.120",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 5
                },
                {
                    "name": "Privacy Policy Updates",
                    "code": "CCPA_006",
                    "description": "Privacy policy must be updated and maintained",
                    "requirement_text": "Privacy policy must be updated to reflect current data practices",
                    "requirement_code": "1798.100",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 6
                },
                {
                    "name": "Third-Party Data Sharing Disclosure",
                    "code": "CCPA_007",
                    "description": "Third-party data sharing must be disclosed",
                    "requirement_text": "Third-party data sharing disclosure must be provided in privacy policy",
                    "requirement_code": "1798.115",
                    "conditions": {
                        "data_types": ["PII", "personal_information"],
                        "regions": ["US-CA", "California"]
                    },
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "consumer_residence",
                    "type": "string",
                    "required": True,
                    "description": "Residence of consumers (California, etc.)",
                    "validation": "Must be specified"
                },
                {
                    "attribute": "opt_out_mechanism",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether opt-out mechanism is provided",
                    "validation": "Must be true"
                },
                {
                    "attribute": "data_deletion_capability",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data deletion capability is implemented",
                    "validation": "Must be true"
                },
                {
                    "attribute": "privacy_policy_updated",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether privacy policy is up to date",
                    "validation": "Must be true"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Privacy Rights Disclosure",
                    "type": "required",
                    "description": "Consumer privacy rights disclosure in privacy policy"
                },
                {
                    "control": "Opt-Out Mechanism",
                    "type": "required",
                    "description": "Opt-out mechanism for data sale"
                },
                {
                    "control": "Data Deletion",
                    "type": "required",
                    "description": "Data deletion requests within 45 days"
                },
                {
                    "control": "Non-Discrimination",
                    "type": "required",
                    "description": "Non-discrimination policy for privacy rights"
                }
            ]
        },
        "SOX": {
            "name": "Sarbanes-Oxley Act",
            "code": "SOX",
            "description": "Sarbanes-Oxley Act - Financial reporting and corporate governance requirements",
            "region": "US",
            "category": "financial",
            "version": "2002",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["financial", "accounting", "audit"],
                "industries": ["public_company", "financial_services"],
                "regions": ["US"],
                "data_classification": ["financial", "sensitive"],
                "description": "Applies to publicly traded companies and their auditors"
            },
            "risks": [
                {
                    "name": "Financial Reporting Fraud",
                    "code": "SOX_RISK_001",
                    "description": "Risk of fraudulent financial reporting",
                    "severity": "critical",
                    "category": "financial"
                },
                {
                    "name": "Inadequate Internal Controls",
                    "code": "SOX_RISK_002",
                    "description": "Risk of insufficient internal controls over financial reporting",
                    "severity": "critical",
                    "category": "financial"
                },
                {
                    "name": "Insufficient Audit Trail",
                    "code": "SOX_RISK_003",
                    "description": "Risk of inadequate audit trail for financial transactions",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Weak Access Controls",
                    "code": "SOX_RISK_004",
                    "description": "Risk of inadequate access controls for financial systems",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Inadequate Change Management",
                    "code": "SOX_RISK_005",
                    "description": "Risk of unauthorized changes to financial systems",
                    "severity": "high",
                    "category": "operational"
                }
            ],
            "rules": [
                {
                    "name": "Internal Controls Over Financial Reporting",
                    "code": "SOX_001",
                    "description": "Internal controls over financial reporting must be established and maintained",
                    "requirement_text": "Management must establish and maintain adequate internal controls over financial reporting",
                    "requirement_code": "Section 404",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company", "financial_services"],
                        "regions": ["US"]
                    },
                    "order": 1
                },
                {
                    "name": "Financial Statement Certification",
                    "code": "SOX_002",
                    "description": "CEO and CFO must certify financial statements",
                    "requirement_text": "CEO and CFO must certify the accuracy of financial statements",
                    "requirement_code": "Section 302",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company"],
                        "regions": ["US"]
                    },
                    "order": 2
                },
                {
                    "name": "Audit Trail Requirements",
                    "code": "SOX_003",
                    "description": "Audit trail must be maintained for all financial transactions",
                    "requirement_text": "Audit trail must be maintained for all financial transactions and system changes",
                    "requirement_code": "Section 404",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company", "financial_services"],
                        "regions": ["US"]
                    },
                    "order": 3
                },
                {
                    "name": "Access Controls for Financial Systems",
                    "code": "SOX_004",
                    "description": "Access controls must be implemented for financial systems",
                    "requirement_text": "Access controls must be implemented to prevent unauthorized access to financial systems",
                    "requirement_code": "Section 404",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company", "financial_services"],
                        "regions": ["US"]
                    },
                    "order": 4
                },
                {
                    "name": "Change Management for Financial Systems",
                    "code": "SOX_005",
                    "description": "Change management procedures must be established for financial systems",
                    "requirement_text": "Change management procedures must be established and enforced for financial systems",
                    "requirement_code": "Section 404",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company", "financial_services"],
                        "regions": ["US"]
                    },
                    "order": 5
                },
                {
                    "name": "Data Retention and Backup",
                    "code": "SOX_006",
                    "description": "Financial data must be retained and backed up",
                    "requirement_text": "Financial data must be retained according to regulatory requirements and backed up regularly",
                    "requirement_code": "Section 404",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company", "financial_services"],
                        "regions": ["US"]
                    },
                    "order": 6
                },
                {
                    "name": "Independent Audit Requirements",
                    "code": "SOX_007",
                    "description": "Independent audit of internal controls required",
                    "requirement_text": "Independent audit of internal controls over financial reporting must be conducted annually",
                    "requirement_code": "Section 404",
                    "conditions": {
                        "data_types": ["financial", "accounting"],
                        "industries": ["public_company"],
                        "regions": ["US"]
                    },
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "financial_system_access_controls",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether access controls are implemented for financial systems",
                    "validation": "Must be true"
                },
                {
                    "attribute": "audit_trail_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether audit trail is enabled for financial transactions",
                    "validation": "Must be true"
                },
                {
                    "attribute": "change_management_procedures",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether change management procedures are established",
                    "validation": "Must be true"
                },
                {
                    "attribute": "data_retention_policy",
                    "type": "string",
                    "required": True,
                    "description": "Data retention policy for financial data",
                    "validation": "Must be specified"
                },
                {
                    "attribute": "backup_frequency",
                    "type": "string",
                    "required": True,
                    "description": "Frequency of financial data backups",
                    "validation": "Must be specified"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Internal Controls",
                    "type": "required",
                    "description": "Internal controls over financial reporting"
                },
                {
                    "control": "Audit Trail",
                    "type": "required",
                    "description": "Audit trail for financial transactions"
                },
                {
                    "control": "Access Controls",
                    "type": "required",
                    "description": "Access controls for financial systems"
                },
                {
                    "control": "Change Management",
                    "type": "required",
                    "description": "Change management procedures for financial systems"
                },
                {
                    "control": "Data Retention",
                    "type": "required",
                    "description": "Data retention and backup procedures"
                }
            ]
        },
        "ITAR": {
            "name": "ITAR",
            "code": "ITAR",
            "description": "International Traffic in Arms Regulations - Export control regulations for defense articles and services",
            "region": "US",
            "category": "export_control",
            "version": "2023",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["defense", "military", "technical_data", "defense_articles"],
                "industries": ["defense", "aerospace", "military"],
                "regions": ["US"],
                "data_classification": ["ITAR_controlled", "export_controlled", "restricted"],
                "description": "Applies to entities that manufacture, export, or broker defense articles, services, or technical data"
            },
            "risks": [
                {
                    "name": "Unauthorized Export of Defense Articles",
                    "code": "ITAR_RISK_001",
                    "description": "Risk of unauthorized export of ITAR-controlled items",
                    "severity": "critical",
                    "category": "compliance"
                },
                {
                    "name": "Insufficient Access Controls",
                    "code": "ITAR_RISK_002",
                    "description": "Risk of inadequate access controls for ITAR-controlled data",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Inadequate Data Classification",
                    "code": "ITAR_RISK_003",
                    "description": "Risk of improper classification of ITAR-controlled data",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Foreign Person Access",
                    "code": "ITAR_RISK_004",
                    "description": "Risk of unauthorized access by foreign persons to ITAR-controlled data",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Insufficient Export Documentation",
                    "code": "ITAR_RISK_005",
                    "description": "Risk of inadequate export documentation and recordkeeping",
                    "severity": "high",
                    "category": "compliance"
                }
            ],
            "rules": [
                {
                    "name": "Export License Requirements",
                    "code": "ITAR_001",
                    "description": "Export licenses required for ITAR-controlled items",
                    "requirement_text": "Export licenses must be obtained before exporting ITAR-controlled defense articles, services, or technical data",
                    "requirement_code": "22 CFR 120-130",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 1
                },
                {
                    "name": "Access Controls for ITAR Data",
                    "code": "ITAR_002",
                    "description": "Access controls must prevent unauthorized foreign person access",
                    "requirement_text": "Access controls must be implemented to prevent unauthorized foreign person access to ITAR-controlled data",
                    "requirement_code": "22 CFR 120.17",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 2
                },
                {
                    "name": "Data Classification and Marking",
                    "code": "ITAR_003",
                    "description": "ITAR-controlled data must be properly classified and marked",
                    "requirement_text": "ITAR-controlled data must be properly classified and marked with appropriate export control markings",
                    "requirement_code": "22 CFR 120.10",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 3
                },
                {
                    "name": "Foreign Person Screening",
                    "code": "ITAR_004",
                    "description": "Foreign persons must be screened before access",
                    "requirement_text": "Foreign persons must be screened and authorized before accessing ITAR-controlled data",
                    "requirement_code": "22 CFR 120.16",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 4
                },
                {
                    "name": "Export Recordkeeping",
                    "code": "ITAR_005",
                    "description": "Export records must be maintained",
                    "requirement_text": "Export records must be maintained for all ITAR-controlled exports",
                    "requirement_code": "22 CFR 123.22",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 5
                },
                {
                    "name": "Technical Data Protection",
                    "code": "ITAR_006",
                    "description": "Technical data must be protected from unauthorized access",
                    "requirement_text": "ITAR-controlled technical data must be protected from unauthorized access and disclosure",
                    "requirement_code": "22 CFR 120.10",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 6
                },
                {
                    "name": "Employee Training",
                    "code": "ITAR_007",
                    "description": "Employees must be trained on ITAR requirements",
                    "requirement_text": "Employees must be trained on ITAR requirements and export control procedures",
                    "requirement_code": "22 CFR 120.17",
                    "conditions": {
                        "data_types": ["defense", "military", "technical_data"],
                        "industries": ["defense", "aerospace", "military"],
                        "regions": ["US"]
                    },
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "itar_controlled_data",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether ITAR-controlled data is processed",
                    "validation": "Must be specified"
                },
                {
                    "attribute": "foreign_person_screening",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether foreign person screening is implemented",
                    "validation": "Must be true if ITAR data is processed"
                },
                {
                    "attribute": "export_license_obtained",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether export licenses are obtained when required",
                    "validation": "Must be true for exports"
                },
                {
                    "attribute": "data_classification_marking",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether ITAR data is properly classified and marked",
                    "validation": "Must be true"
                },
                {
                    "attribute": "access_controls_implemented",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether access controls prevent foreign person access",
                    "validation": "Must be true"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Export License Management",
                    "type": "required",
                    "description": "Export licenses must be obtained and managed"
                },
                {
                    "control": "Foreign Person Access Controls",
                    "type": "required",
                    "description": "Access controls to prevent unauthorized foreign person access"
                },
                {
                    "control": "Data Classification",
                    "type": "required",
                    "description": "ITAR data must be properly classified and marked"
                },
                {
                    "control": "Export Recordkeeping",
                    "type": "required",
                    "description": "Export records must be maintained"
                },
                {
                    "control": "Technical Data Protection",
                    "type": "required",
                    "description": "ITAR-controlled technical data must be protected"
                }
            ]
        },
        "PRIVACY": {
            "name": "General Privacy Framework",
            "code": "PRIVACY",
            "description": "General privacy and data protection framework - Universal privacy principles and best practices",
            "region": "Global",
            "category": "data_privacy",
            "version": "2023",
            "status": "active",
            "applicability_criteria": {
                "data_types": ["PII", "personal_data", "personal_information"],
                "industries": ["all"],
                "regions": ["Global"],
                "data_classification": ["PII", "personal", "sensitive"],
                "description": "Applies to all organizations processing personal data"
            },
            "risks": [
                {
                    "name": "Unauthorized Data Access",
                    "code": "PRIVACY_RISK_001",
                    "description": "Risk of unauthorized access to personal data",
                    "severity": "high",
                    "category": "security"
                },
                {
                    "name": "Data Breach",
                    "code": "PRIVACY_RISK_002",
                    "description": "Risk of personal data breach",
                    "severity": "critical",
                    "category": "security"
                },
                {
                    "name": "Insufficient Consent Management",
                    "code": "PRIVACY_RISK_003",
                    "description": "Risk of inadequate consent management",
                    "severity": "high",
                    "category": "compliance"
                },
                {
                    "name": "Inadequate Data Minimization",
                    "code": "PRIVACY_RISK_004",
                    "description": "Risk of collecting or processing more personal data than necessary",
                    "severity": "medium",
                    "category": "compliance"
                },
                {
                    "name": "Weak Data Subject Rights",
                    "code": "PRIVACY_RISK_005",
                    "description": "Risk of not properly implementing data subject rights",
                    "severity": "high",
                    "category": "compliance"
                }
            ],
            "rules": [
                {
                    "name": "Data Minimization",
                    "code": "PRIVACY_001",
                    "description": "Collect and process only necessary personal data",
                    "requirement_text": "Personal data must be collected and processed only to the extent necessary for the specified purpose",
                    "requirement_code": "Privacy Principle 1",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 1
                },
                {
                    "name": "Purpose Limitation",
                    "code": "PRIVACY_002",
                    "description": "Personal data must be used only for specified purposes",
                    "requirement_text": "Personal data must be used only for the purposes for which it was collected",
                    "requirement_code": "Privacy Principle 2",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 2
                },
                {
                    "name": "Consent Management",
                    "code": "PRIVACY_003",
                    "description": "Valid consent must be obtained for data processing",
                    "requirement_text": "Valid, informed consent must be obtained before processing personal data",
                    "requirement_code": "Privacy Principle 3",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 3
                },
                {
                    "name": "Data Security",
                    "code": "PRIVACY_004",
                    "description": "Personal data must be protected with appropriate security measures",
                    "requirement_text": "Personal data must be protected with appropriate technical and organizational security measures",
                    "requirement_code": "Privacy Principle 4",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 4
                },
                {
                    "name": "Data Subject Rights",
                    "code": "PRIVACY_005",
                    "description": "Data subject rights must be supported",
                    "requirement_text": "Data subject rights including access, rectification, deletion, and portability must be supported",
                    "requirement_code": "Privacy Principle 5",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 5
                },
                {
                    "name": "Data Retention and Deletion",
                    "code": "PRIVACY_006",
                    "description": "Data retention policies must be defined and enforced",
                    "requirement_text": "Data retention policies must be defined and personal data must be deleted when no longer needed",
                    "requirement_code": "Privacy Principle 6",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 6
                },
                {
                    "name": "Privacy by Design",
                    "code": "PRIVACY_007",
                    "description": "Privacy considerations must be built into system design",
                    "requirement_text": "Privacy by design and default principles must be implemented in system design and operations",
                    "requirement_code": "Privacy Principle 7",
                    "conditions": {
                        "data_types": ["PII", "personal_data", "personal_information"]
                    },
                    "order": 7
                }
            ],
            "required_attributes": [
                {
                    "attribute": "data_minimization_implemented",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data minimization is implemented",
                    "validation": "Must be true"
                },
                {
                    "attribute": "consent_management_system",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether consent management system is implemented",
                    "validation": "Must be true"
                },
                {
                    "attribute": "data_encryption_enabled",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data encryption is enabled",
                    "validation": "Must be true"
                },
                {
                    "attribute": "data_subject_rights_supported",
                    "type": "boolean",
                    "required": True,
                    "description": "Whether data subject rights are supported",
                    "validation": "Must be true"
                },
                {
                    "attribute": "data_retention_policy",
                    "type": "string",
                    "required": True,
                    "description": "Data retention policy",
                    "validation": "Must be specified"
                }
            ],
            "enforcement_controls": [
                {
                    "control": "Data Minimization",
                    "type": "required",
                    "description": "Collect and process only necessary personal data"
                },
                {
                    "control": "Consent Management",
                    "type": "required",
                    "description": "Valid consent must be obtained and managed"
                },
                {
                    "control": "Data Security",
                    "type": "required",
                    "description": "Personal data must be protected with appropriate security measures"
                },
                {
                    "control": "Data Subject Rights",
                    "type": "required",
                    "description": "Data subject rights must be supported"
                },
                {
                    "control": "Privacy by Design",
                    "type": "required",
                    "description": "Privacy by design and default principles"
                }
            ]
        }
    }
    
    @classmethod
    def get_framework(cls, code: str) -> Dict[str, Any]:
        """Get framework by code"""
        return cls.FRAMEWORKS.get(code.upper())
    
    @classmethod
    def list_frameworks(cls) -> List[str]:
        """List all framework codes"""
        return list(cls.FRAMEWORKS.keys())
    
    @classmethod
    def get_all_frameworks(cls) -> Dict[str, Dict[str, Any]]:
        """Get all frameworks"""
        return cls.FRAMEWORKS

