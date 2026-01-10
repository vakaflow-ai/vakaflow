#!/usr/bin/env python3
"""
Seed Platform-Wide Question Library with comprehensive questions for:
- Various industries (Healthcare, Finance, Technology, Energy, Government, etc.)
- Various vendor types (AI Vendor, SaaS Vendor, Service Provider, Cloud Provider, etc.)
- Mapped to compliance frameworks (ISO 27001, SOC 2, HIPAA, PCI-DSS, NIST, GDPR, etc.)
- With pass/fail criteria for AI evaluation

Platform questions (tenant_id = NULL) are visible to all tenants by default.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.question_library import QuestionLibrary
from app.models.compliance_framework import ComplianceFramework
from app.models.user import User, UserRole
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Platform Admin User ID (will be set during seeding)
PLATFORM_ADMIN_USER_ID = None

# Compliance Framework Codes (will be resolved during seeding)
FRAMEWORK_IDS = {}

# Vendor Types
VENDOR_TYPES = {
    "ai_vendor": "AI Vendor",
    "saas_vendor": "SaaS Vendor",
    "service_provider": "Service Provider",
    "cloud_provider": "Cloud Provider",
    "data_processor": "Data Processor",
    "consulting": "Consulting",
    "all": "All Vendor Types"
}

# Industries
INDUSTRIES = {
    "healthcare": "Healthcare",
    "finance": "Finance",
    "technology": "Technology",
    "energy": "Energy",
    "government": "Government",
    "retail": "Retail",
    "manufacturing": "Manufacturing",
    "education": "Education",
    "all": "All Industries"
}

# Comprehensive Platform Questions
PLATFORM_QUESTIONS = [
    # ========== SECURITY QUESTIONS ==========
    {
        "title": "Information Security Management System",
        "question_text": "Do you have a documented Information Security Management System (ISMS) in place?",
        "description": "Assesses vendor's formal security management framework",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"},
            {"value": "partial", "label": "Partially Implemented"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST"],
        "risk_framework_ids": ["ISO27001", "NIST"],  # Information security risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes",
            "fail_condition": "no",
            "review_condition": "partial",
            "case_sensitive": False
        }
    },
    {
        "title": "Security Policy Documentation",
        "question_text": "Please provide your organization's security policy documentation.",
        "description": "Request for security policy documents",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "file",
        "response_type": "File",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST"],
        "risk_framework_ids": ["ISO27001", "NIST"],  # Information security risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "file_uploaded",
            "pass_condition": True,
            "fail_condition": False,
            "min_file_count": 1
        }
    },
    {
        "title": "Access Control Measures",
        "question_text": "Describe your access control measures including authentication, authorization, and access review processes.",
        "description": "Assesses access control implementation",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST", "PCI-DSS"],
        "risk_framework_ids": ["ISO27001", "NIST", "PCI-DSS"],  # Access control risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates comprehensive access control measures including authentication, authorization, and regular access reviews. Look for mentions of: multi-factor authentication, role-based access control, least privilege principle, regular access reviews, and access revocation procedures.",
            "pass_keywords": ["MFA", "multi-factor", "RBAC", "role-based", "least privilege", "access review", "access revocation"],
            "min_length": 100
        }
    },
    {
        "title": "Encryption Standards",
        "question_text": "What encryption standards do you use for data at rest and in transit?",
        "description": "Assesses encryption implementation",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2", "PCI-DSS", "HIPAA"],
        "risk_framework_ids": ["ISO27001", "PCI-DSS", "HIPAA"],  # Data protection risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response mentions encryption for both data at rest (e.g., AES-256) and in transit (e.g., TLS 1.2+). Look for specific encryption algorithms and key management practices.",
            "pass_keywords": ["AES", "TLS", "encryption", "at rest", "in transit", "key management"],
            "min_length": 50
        }
    },
    
    # ========== DATA PROTECTION QUESTIONS ==========
    {
        "title": "Data Classification Framework",
        "question_text": "Do you have a data classification framework that categorizes data by sensitivity level?",
        "description": "Assesses data classification practices",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "data_protection",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2", "GDPR"],
        "risk_framework_ids": ["ISO27001", "GDPR"],  # Data classification risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes",
            "fail_condition": "no"
        }
    },
    {
        "title": "Data Retention Policy",
        "question_text": "What is your data retention policy? Please specify retention periods for different data types.",
        "description": "Assesses data retention practices",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "data_protection",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["GDPR", "HIPAA", "SOC2"],
        "risk_framework_ids": ["GDPR", "HIPAA"],  # Data retention risk
        "applicable_industries": ["healthcare", "finance", "all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response provides specific retention periods for different data types and demonstrates compliance with regulatory requirements. Look for clear retention schedules and deletion procedures.",
            "pass_keywords": ["retention period", "data deletion", "retention schedule", "compliance"],
            "min_length": 80
        }
    },
    {
        "title": "Data Processing Location",
        "question_text": "In which geographic regions do you process and store customer data?",
        "description": "Assesses data residency and sovereignty",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "data_protection",
        "field_type": "multi_select",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "us", "label": "United States"},
            {"value": "eu", "label": "European Union"},
            {"value": "uk", "label": "United Kingdom"},
            {"value": "asia", "label": "Asia Pacific"},
            {"value": "other", "label": "Other"}
        ],
        "compliance_framework_ids": ["GDPR", "SOC2"],
        "risk_framework_ids": ["GDPR"],  # Data sovereignty risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "contains",
            "pass_condition": ["us", "eu", "uk"],
            "fail_condition": [],
            "case_sensitive": False
        }
    },
    
    # ========== COMPLIANCE QUESTIONS ==========
    {
        "title": "SOC 2 Certification",
        "question_text": "Do you have SOC 2 Type II certification?",
        "description": "Assesses SOC 2 compliance",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": False,
        "options": [
            {"value": "yes_type2", "label": "Yes, Type II"},
            {"value": "yes_type1", "label": "Yes, Type I"},
            {"value": "in_progress", "label": "In Progress"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["SOC2"],
        "risk_framework_ids": ["SOC2"],  # Service organization risk
        "applicable_industries": ["technology", "finance", "all"],
        "applicable_vendor_types": ["saas_vendor", "cloud_provider", "all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": ["yes_type2", "yes_type1"],
            "fail_condition": "no",
            "review_condition": "in_progress"
        }
    },
    {
        "title": "ISO 27001 Certification",
        "question_text": "Do you have ISO 27001 certification?",
        "description": "Assesses ISO 27001 compliance",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": False,
        "options": [
            {"value": "yes_certified", "label": "Yes, Certified"},
            {"value": "in_progress", "label": "In Progress"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["ISO27001"],
        "risk_framework_ids": ["ISO27001"],  # Information security risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes_certified",
            "fail_condition": "no",
            "review_condition": "in_progress"
        }
    },
    {
        "title": "HIPAA Compliance",
        "question_text": "Are you HIPAA compliant? Please provide your Business Associate Agreement (BAA) if applicable.",
        "description": "Assesses HIPAA compliance for healthcare vendors",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": False,
        "options": [
            {"value": "yes_baa", "label": "Yes, with BAA"},
            {"value": "yes_no_baa", "label": "Yes, but no BAA"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["HIPAA"],
        "risk_framework_ids": ["HIPAA"],  # Healthcare data risk
        "applicable_industries": ["healthcare"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes_baa",
            "fail_condition": "no",
            "review_condition": "yes_no_baa"
        }
    },
    {
        "title": "PCI-DSS Compliance",
        "question_text": "What is your PCI-DSS compliance level?",
        "description": "Assesses PCI-DSS compliance for payment processing",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "select",
        "response_type": "Text",
        "is_required": False,
        "options": [
            {"value": "level1", "label": "Level 1 (Highest)"},
            {"value": "level2", "label": "Level 2"},
            {"value": "level3", "label": "Level 3"},
            {"value": "level4", "label": "Level 4"},
            {"value": "not_applicable", "label": "Not Applicable"},
            {"value": "no", "label": "Not Compliant"}
        ],
        "compliance_framework_ids": ["PCI-DSS"],
        "risk_framework_ids": ["PCI-DSS"],  # Payment card data risk
        "applicable_industries": ["finance", "retail", "all"],
        "applicable_vendor_types": ["saas_vendor", "service_provider", "all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": ["level1", "level2", "level3", "level4"],
            "fail_condition": "no",
            "review_condition": "not_applicable"
        }
    },
    {
        "title": "GDPR Compliance",
        "question_text": "Describe your GDPR compliance measures including data subject rights, privacy notices, and data processing agreements.",
        "description": "Assesses GDPR compliance for EU data processing",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": False,
        "compliance_framework_ids": ["GDPR"],
        "risk_framework_ids": ["GDPR"],  # Privacy risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates GDPR compliance including: data subject rights (access, rectification, erasure, portability), privacy notices, data processing agreements (DPAs), data protection impact assessments (DPIAs), and breach notification procedures.",
            "pass_keywords": ["data subject rights", "privacy notice", "DPA", "data processing agreement", "DPIA", "breach notification", "GDPR"],
            "min_length": 150
        }
    },
    
    # ========== AI VENDOR SPECIFIC QUESTIONS ==========
    {
        "title": "AI Model Training Data",
        "question_text": "Describe the sources and composition of your AI model training data. How do you ensure data quality and bias mitigation?",
        "description": "Assesses AI vendor's training data practices",
        "assessment_type": ["ai_vendor_qualification", "tprm"],
        "category": "data_protection",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["GDPR", "SOC2"],
        "risk_framework_ids": ["GDPR"],  # Data sovereignty risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["ai_vendor"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates responsible AI practices including: transparent data sources, data quality measures, bias detection and mitigation, and ethical AI considerations.",
            "pass_keywords": ["training data", "bias", "data quality", "ethical AI", "fairness"],
            "min_length": 100
        }
    },
    {
        "title": "AI Model Explainability",
        "question_text": "Do you provide explainability features for your AI models?",
        "description": "Assesses AI model transparency",
        "assessment_type": ["ai_vendor_qualification", "tprm"],
        "category": "compliance",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "partial", "label": "Partially"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["GDPR", "SOC2"],
        "risk_framework_ids": ["GDPR"],  # Data sovereignty risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["ai_vendor"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes",
            "fail_condition": "no",
            "review_condition": "partial"
        }
    },
    {
        "title": "AI Model Versioning and Change Management",
        "question_text": "Describe your AI model versioning and change management process.",
        "description": "Assesses AI model governance",
        "assessment_type": ["ai_vendor_qualification", "tprm"],
        "category": "risk_management",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["SOC2", "ISO27001"],
        "risk_framework_ids": ["ISO27001"],  # AI governance risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["ai_vendor"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates proper model versioning, change management, rollback procedures, and impact assessment for model changes.",
            "pass_keywords": ["versioning", "change management", "rollback", "model version", "impact assessment"],
            "min_length": 80
        }
    },
    
    # ========== BUSINESS CONTINUITY QUESTIONS ==========
    {
        "title": "Business Continuity Plan",
        "question_text": "Do you have a documented Business Continuity Plan (BCP)?",
        "description": "Assesses business continuity preparedness",
        "assessment_type": ["tprm", "vendor_qualification", "risk_assessment"],
        "category": "business_continuity",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2"],
        "risk_framework_ids": ["ISO27001"],  # Operational risk / Business continuity risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes",
            "fail_condition": "no"
        }
    },
    {
        "title": "Disaster Recovery RTO and RPO",
        "question_text": "What are your Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?",
        "description": "Assesses disaster recovery capabilities",
        "assessment_type": ["tprm", "vendor_qualification", "risk_assessment"],
        "category": "business_continuity",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2"],
        "risk_framework_ids": ["ISO27001"],  # Operational risk / Business continuity risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["saas_vendor", "cloud_provider", "service_provider"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response provides specific RTO and RPO values and demonstrates realistic disaster recovery capabilities. Look for RTO < 24 hours and RPO < 4 hours as good practices.",
            "pass_keywords": ["RTO", "RPO", "recovery time", "recovery point"],
            "min_length": 50
        }
    },
    
    # ========== VENDOR MANAGEMENT QUESTIONS ==========
    {
        "title": "Subcontractor Management",
        "question_text": "Do you use subcontractors or third-party service providers? If yes, how do you assess and monitor their security and compliance?",
        "description": "Assesses vendor's own vendor management",
        "assessment_type": ["tprm", "vendor_qualification"],
        "category": "vendor_management",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": False,
        "compliance_framework_ids": ["ISO27001", "SOC2"],
        "risk_framework_ids": ["ISO27001"],  # Operational risk / Business continuity risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates proper subcontractor assessment and monitoring processes. Look for vendor assessment procedures, contract requirements, and ongoing monitoring.",
            "pass_keywords": ["subcontractor", "vendor assessment", "third-party", "monitoring", "due diligence"],
            "min_length": 80
        }
    },
    
    # ========== INCIDENT RESPONSE QUESTIONS ==========
    {
        "title": "Incident Response Plan",
        "question_text": "Do you have a documented Incident Response Plan?",
        "description": "Assesses incident response preparedness",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST"],
        "risk_framework_ids": ["ISO27001", "NIST"],  # Information security risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes",
            "fail_condition": "no"
        }
    },
    {
        "title": "Security Incident Notification",
        "question_text": "What is your process for notifying customers of security incidents?",
        "description": "Assesses incident notification procedures",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2", "GDPR", "HIPAA"],
        "risk_framework_ids": ["ISO27001", "GDPR", "HIPAA"],  # Breach notification risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates clear incident notification procedures including timelines (e.g., within 72 hours for GDPR), notification channels, and information provided to customers.",
            "pass_keywords": ["notification", "incident", "timeline", "customer", "breach"],
            "min_length": 60
        }
    },
    
    # ========== PRIVACY QUESTIONS ==========
    {
        "title": "Privacy Policy",
        "question_text": "Please provide a link to your privacy policy.",
        "description": "Request for privacy policy documentation",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "url",
        "response_type": "URL",
        "is_required": True,
        "compliance_framework_ids": ["GDPR", "CCPA"],
        "risk_framework_ids": ["GDPR", "CCPA"],  # Privacy risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "url_valid",
            "pass_condition": True,
            "fail_condition": False
        }
    },
    {
        "title": "Data Processing Agreement",
        "question_text": "Do you have a standard Data Processing Agreement (DPA) for GDPR compliance?",
        "description": "Assesses GDPR DPA availability",
        "assessment_type": ["tprm", "vendor_qualification", "compliance_assessment"],
        "category": "compliance",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": False,
        "options": [
            {"value": "yes", "label": "Yes"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["GDPR"],
        "risk_framework_ids": ["GDPR"],  # Privacy risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": "yes",
            "fail_condition": "no"
        }
    },
    
    # ========== PENETRATION TESTING QUESTIONS ==========
    {
        "title": "Penetration Testing Frequency",
        "question_text": "How often do you conduct penetration testing?",
        "description": "Assesses security testing frequency",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "select",
        "response_type": "Text",
        "is_required": False,
        "options": [
            {"value": "quarterly", "label": "Quarterly"},
            {"value": "annually", "label": "Annually"},
            {"value": "biannually", "label": "Bi-Annually"},
            {"value": "on_demand", "label": "On Demand"},
            {"value": "never", "label": "Never"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2", "PCI-DSS"],
        "risk_framework_ids": ["ISO27001", "PCI-DSS"],  # Security testing risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["saas_vendor", "cloud_provider", "all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": ["quarterly", "annually", "biannually"],
            "fail_condition": "never",
            "review_condition": "on_demand"
        }
    },
    {
        "title": "Penetration Testing Report",
        "question_text": "Please provide your most recent penetration testing report.",
        "description": "Request for penetration testing documentation",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "file",
        "response_type": "File",
        "is_required": False,
        "compliance_framework_ids": ["ISO27001", "SOC2", "PCI-DSS"],
        "risk_framework_ids": ["ISO27001", "PCI-DSS"],  # Security testing risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["saas_vendor", "cloud_provider", "all"],
        "pass_fail_criteria": {
            "type": "file_uploaded",
            "pass_condition": True,
            "fail_condition": False,
            "min_file_count": 1
        }
    },
    
    # ========== VULNERABILITY MANAGEMENT QUESTIONS ==========
    {
        "title": "Vulnerability Management Program",
        "question_text": "Describe your vulnerability management program including scanning frequency, patch management, and remediation timelines.",
        "description": "Assesses vulnerability management practices",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST", "PCI-DSS"],
        "risk_framework_ids": ["ISO27001", "NIST", "PCI-DSS"],  # Access control risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates a comprehensive vulnerability management program including: regular scanning (at least monthly), patch management process, prioritization (e.g., CVSS scoring), and remediation timelines (critical vulnerabilities within 30 days).",
            "pass_keywords": ["vulnerability scanning", "patch management", "remediation", "CVSS", "critical", "timeline"],
            "min_length": 100
        }
    },
    
    # ========== LOGGING AND MONITORING QUESTIONS ==========
    {
        "title": "Security Monitoring and Logging",
        "question_text": "Describe your security monitoring and logging capabilities including log retention, SIEM usage, and alerting mechanisms.",
        "description": "Assesses security monitoring practices",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "textarea",
        "response_type": "Text",
        "is_required": True,
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST", "PCI-DSS"],
        "risk_framework_ids": ["ISO27001", "NIST", "PCI-DSS"],  # Access control risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "ai_evaluation",
            "evaluation_prompt": "Evaluate if the response demonstrates comprehensive security monitoring including: centralized logging, SIEM or similar tools, real-time alerting, log retention (at least 1 year), and security event correlation.",
            "pass_keywords": ["SIEM", "logging", "monitoring", "alerting", "log retention", "security events"],
            "min_length": 80
        }
    },
    
    # ========== EMPLOYEE SECURITY QUESTIONS ==========
    {
        "title": "Background Checks",
        "question_text": "Do you conduct background checks for employees with access to customer data?",
        "description": "Assesses employee screening practices",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "radio",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "yes_all", "label": "Yes, for all employees"},
            {"value": "yes_sensitive", "label": "Yes, for sensitive roles"},
            {"value": "no", "label": "No"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2", "HIPAA"],
        "risk_framework_ids": ["SOC2", "HIPAA"],  # Personnel risk
        "applicable_industries": ["healthcare", "finance", "all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": ["yes_all", "yes_sensitive"],
            "fail_condition": "no"
        }
    },
    {
        "title": "Security Awareness Training",
        "question_text": "How often do you provide security awareness training to employees?",
        "description": "Assesses security training frequency",
        "assessment_type": ["tprm", "vendor_qualification", "security_assessment"],
        "category": "security",
        "field_type": "select",
        "response_type": "Text",
        "is_required": True,
        "options": [
            {"value": "quarterly", "label": "Quarterly"},
            {"value": "annually", "label": "Annually"},
            {"value": "biannually", "label": "Bi-Annually"},
            {"value": "onboarding_only", "label": "Onboarding Only"},
            {"value": "never", "label": "Never"}
        ],
        "compliance_framework_ids": ["ISO27001", "SOC2", "NIST"],
        "risk_framework_ids": ["ISO27001", "NIST"],  # Information security risk
        "applicable_industries": ["all"],
        "applicable_vendor_types": ["all"],
        "pass_fail_criteria": {
            "type": "exact_match",
            "pass_condition": ["quarterly", "annually", "biannually"],
            "fail_condition": "never",
            "review_condition": "onboarding_only"
        }
    },
]


def get_or_create_framework(db, code: str, name: str, category: str = None, region: str = None):
    """Get existing framework by code (case-insensitive) or return None if not found"""
    # Try exact match first
    framework = db.query(ComplianceFramework).filter(
        ComplianceFramework.code == code
    ).first()
    
    if not framework:
        # Try case-insensitive match
        from sqlalchemy import func
        framework = db.query(ComplianceFramework).filter(
            func.lower(ComplianceFramework.code) == func.lower(code)
        ).first()
    
    if not framework:
        # Try common variations (ISO27001 -> ISO_27001, SOC2 -> SOC_2, etc.)
        variations = [
            code.replace('-', '_'),
            code.replace('_', '-'),
            code.upper(),
            code.lower(),
        ]
        for variation in variations:
            framework = db.query(ComplianceFramework).filter(
                func.lower(ComplianceFramework.code) == func.lower(variation)
            ).first()
            if framework:
                break
    
    if not framework:
        logger.warning(f"Framework {code} ({name}) not found. Please seed frameworks first. Question will be created without framework mapping.")
        return None
    
    return framework


def get_platform_admin_user(db):
    """Get platform admin user"""
    admin = db.query(User).filter(
        User.role == UserRole.PLATFORM_ADMIN
    ).first()
    
    if not admin:
        logger.warning("Platform admin user not found. Please create a platform admin first.")
        return None
    
    return admin


def resolve_framework_ids(db, question_data: dict) -> dict:
    """Resolve framework codes to IDs"""
    resolved = {}
    
    # Resolve compliance frameworks
    if question_data.get("compliance_framework_ids"):
        framework_ids = []
        for code in question_data["compliance_framework_ids"]:
            framework = get_or_create_framework(db, code, code)
            if framework:
                framework_ids.append(str(framework.id))
        resolved["compliance_framework_ids"] = framework_ids if framework_ids else None
    else:
        resolved["compliance_framework_ids"] = None
    
    # Resolve risk frameworks (using same ComplianceFramework model for now)
    if question_data.get("risk_framework_ids"):
        framework_ids = []
        for code in question_data["risk_framework_ids"]:
            framework = get_or_create_framework(db, code, code)
            if framework:
                framework_ids.append(str(framework.id))
        resolved["risk_framework_ids"] = framework_ids if framework_ids else None
    else:
        resolved["risk_framework_ids"] = None
    
    return resolved


def seed_platform_question_library():
    """Seed platform-wide question library"""
    db = SessionLocal()
    try:
        # Get platform admin user
        admin_user = get_platform_admin_user(db)
        if not admin_user:
            logger.error("Cannot proceed without platform admin user")
            return
        
        logger.info(f"Using platform admin: {admin_user.email} (ID: {admin_user.id})")
        
        count = 0
        skipped = 0
        
        for question_data in PLATFORM_QUESTIONS:
            # Check if question already exists (by title and tenant_id IS NULL)
            existing = db.query(QuestionLibrary).filter(
                QuestionLibrary.title == question_data["title"],
                QuestionLibrary.tenant_id.is_(None)  # Platform-wide questions
            ).first()
            
            if existing:
                logger.debug(f"  ⏭️  Skipping existing platform question: {question_data['title']}")
                skipped += 1
                continue
            
            # Resolve framework IDs
            resolved = resolve_framework_ids(db, question_data)
            
            # Create question
            question = QuestionLibrary(
                id=uuid.uuid4(),
                tenant_id=None,  # Platform-wide question
                question_id=None,  # Will be generated if needed
                title=question_data["title"],
                question_text=question_data["question_text"],
                description=question_data.get("description"),
                assessment_type=question_data["assessment_type"],
                category=question_data.get("category"),
                field_type=question_data["field_type"],
                response_type=question_data["response_type"],
                is_required=question_data.get("is_required", False),
                options=question_data.get("options"),
                validation_rules=None,
                requirement_ids=None,
                compliance_framework_ids=resolved.get("compliance_framework_ids"),
                risk_framework_ids=resolved.get("risk_framework_ids"),
                applicable_industries=question_data.get("applicable_industries"),
                applicable_vendor_types=question_data.get("applicable_vendor_types"),
                pass_fail_criteria=question_data.get("pass_fail_criteria"),
                created_by=admin_user.id,
                updated_by=None,
                is_active=True,
                usage_count=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            db.add(question)
            count += 1
            logger.info(f"  ✅ Created platform question: {question_data['title']}")
        
        db.commit()
        logger.info(f"\n✅ Successfully created {count} platform questions")
        logger.info(f"  Skipped: {skipped} questions (already exist)")
        
        # Show summary by category
        logger.info("\n📊 Summary by category:")
        categories = {}
        for q in PLATFORM_QUESTIONS:
            cat = q.get("category", "uncategorized")
            categories[cat] = categories.get(cat, 0) + 1
        
        for cat, cnt in sorted(categories.items()):
            logger.info(f"  {cat}: {cnt} questions")
        
        # Show summary by assessment type
        logger.info("\n📊 Summary by assessment type:")
        assessment_types = {}
        for q in PLATFORM_QUESTIONS:
            for atype in q.get("assessment_type", []):
                assessment_types[atype] = assessment_types.get(atype, 0) + 1
        
        for atype, cnt in sorted(assessment_types.items()):
            logger.info(f"  {atype}: {cnt} questions")
        
    except Exception as e:
        logger.error(f"❌ Error seeding platform question library: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("🌱 Starting platform question library seeding...")
    logger.info("📝 Note: This creates platform-wide questions (tenant_id = NULL) visible to all tenants")
    seed_platform_question_library()
    logger.info("✅ Done!")
