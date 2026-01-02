"""
Service to map compliance frameworks to default policy requirements, rules, and controls
"""
from typing import Dict, List, Optional
import logging
from app.services.comprehensive_framework_library import ComprehensiveFrameworkLibrary

logger = logging.getLogger(__name__)


class FrameworkPolicyMapper:
    """Maps compliance frameworks to default policy configurations"""
    
    # Use comprehensive framework library
    _library = ComprehensiveFrameworkLibrary()
    
    # Legacy framework library (kept for backward compatibility)
    FRAMEWORK_LIBRARY: Dict[str, Dict] = {
        "NERC_CIP": {
            "name": "NERC CIP",
            "requirements": [
                {"text": "BES-Contractor Access shall be Audited", "enabled": True},
                {"text": "Physical security controls for critical cyber assets", "enabled": True},
                {"text": "Electronic security perimeters for critical cyber assets", "enabled": True},
                {"text": "Access control and monitoring for critical cyber assets", "enabled": True},
                {"text": "Change control and configuration management", "enabled": True},
                {"text": "Incident response and recovery planning", "enabled": True},
                {"text": "Personnel and training for critical cyber assets", "enabled": True},
            ],
            "rules": {
                "access_audit": {
                    "description": "All BES-Contractor access must be audited and logged",
                    "required": True,
                    "retention_days": 90
                },
                "physical_security": {
                    "description": "Physical security controls must be implemented for critical cyber assets",
                    "required": True
                },
                "electronic_perimeter": {
                    "description": "Electronic security perimeters must be established",
                    "required": True
                },
                "access_control": {
                    "description": "Access control and monitoring required for all critical cyber assets",
                    "required": True,
                    "mfa_required": True
                },
                "change_control": {
                    "description": "Change control and configuration management procedures required",
                    "required": True
                },
                "incident_response": {
                    "description": "Incident response and recovery planning required",
                    "required": True,
                    "response_days": 1
                }
            },
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
                }
            ]
        },
        "HIPAA": {
            "name": "HIPAA",
            "requirements": [
                {"text": "Protected Health Information (PHI) encryption", "enabled": True},
                {"text": "Access controls and audit logs", "enabled": True},
                {"text": "Business Associate Agreements (BAA)", "enabled": True},
                {"text": "Minimum necessary rule", "enabled": True},
                {"text": "Patient rights and notifications", "enabled": True},
                {"text": "Breach notification procedures", "enabled": True},
                {"text": "Workforce training on HIPAA", "enabled": True},
            ],
            "rules": {
                "phi_encryption": {
                    "description": "All PHI must be encrypted using AES-256",
                    "required": True,
                    "algorithm": "AES-256"
                },
                "access_logging": {
                    "description": "All PHI access must be logged and auditable",
                    "required": True,
                    "retention_days": 365
                },
                "baa_required": {
                    "description": "Business Associate Agreements required for all third-party processors",
                    "required": True
                }
            },
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
                }
            ]
        },
        "GDPR": {
            "name": "GDPR",
            "requirements": [
                {"text": "Data encryption and pseudonymization", "enabled": True},
                {"text": "Right to be forgotten (data deletion)", "enabled": True},
                {"text": "Data breach notification within 72 hours", "enabled": True},
                {"text": "Data subject access rights", "enabled": True},
                {"text": "Privacy by design and default", "enabled": True},
                {"text": "Data processing agreements (DPA)", "enabled": True},
                {"text": "Data protection impact assessments (DPIA)", "enabled": True},
            ],
            "rules": {
                "data_encryption": {
                    "description": "Personal data must be encrypted",
                    "required": True,
                    "algorithm": "AES-256"
                },
                "data_retention": {
                    "description": "Data retention policies must be defined and enforced",
                    "required": True,
                    "max_days": 365
                },
                "right_to_be_forgotten": {
                    "description": "Data deletion requests must be processed within 30 days",
                    "required": True,
                    "response_days": 30
                },
                "breach_notification": {
                    "description": "Data breaches must be reported within 72 hours",
                    "required": True,
                    "response_days": 3
                }
            },
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
                }
            ]
        },
        "SOC2": {
            "name": "SOC 2 Type II",
            "requirements": [
                {"text": "Access controls and authentication", "enabled": True},
                {"text": "System monitoring and logging", "enabled": True},
                {"text": "Incident response procedures", "enabled": True},
                {"text": "Change management processes", "enabled": True},
                {"text": "Vulnerability management", "enabled": True},
                {"text": "Data backup and recovery", "enabled": True},
                {"text": "Availability and performance monitoring", "enabled": True},
            ],
            "rules": {
                "mfa_required": {
                    "description": "Multi-factor authentication required",
                    "required": True,
                    "mfa_required": True
                },
                "log_retention": {
                    "description": "Logs must be retained for 90 days minimum",
                    "required": True,
                    "retention_days": 90
                },
                "vulnerability_scanning": {
                    "description": "Vulnerability scanning must be performed monthly",
                    "required": True,
                    "frequency": "monthly"
                }
            },
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
                }
            ]
        },
        "ISO27001": {
            "name": "ISO 27001",
            "requirements": [
                {"text": "Information security policy", "enabled": True},
                {"text": "Risk assessment and treatment", "enabled": True},
                {"text": "Access control policy", "enabled": True},
                {"text": "Cryptography controls", "enabled": True},
                {"text": "Physical and environmental security", "enabled": True},
                {"text": "Operations security", "enabled": True},
                {"text": "Incident management", "enabled": True},
            ],
            "rules": {
                "risk_assessment": {
                    "description": "Annual risk assessment required",
                    "required": True,
                    "frequency": "annually"
                },
                "security_policy": {
                    "description": "Information security policy must be reviewed annually",
                    "required": True,
                    "frequency": "annually"
                },
                "incident_management": {
                    "description": "Incident management procedures must be documented",
                    "required": True
                }
            },
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
                }
            ]
        },
        "PCI_DSS": {
            "name": "PCI DSS",
            "requirements": [
                {"text": "Cardholder data encryption", "enabled": True},
                {"text": "Secure network architecture", "enabled": True},
                {"text": "Access control measures", "enabled": True},
                {"text": "Vulnerability management program", "enabled": True},
                {"text": "Network monitoring and testing", "enabled": True},
                {"text": "Information security policy", "enabled": True},
            ],
            "rules": {
                "cardholder_data_encryption": {
                    "description": "Cardholder data must be encrypted",
                    "required": True,
                    "algorithm": "AES-256"
                },
                "mfa_required": {
                    "description": "MFA required for all access to cardholder data",
                    "required": True,
                    "mfa_required": True
                },
                "vulnerability_scanning": {
                    "description": "Quarterly vulnerability scans required",
                    "required": True,
                    "frequency": "quarterly"
                }
            },
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
                }
            ]
        }
    }
    
    @classmethod
    def get_framework_config(cls, framework_code: str) -> Optional[Dict]:
        """Get default configuration for a compliance framework"""
        # Try comprehensive library first
        comprehensive_config = cls._library.get_framework(framework_code.upper())
        if comprehensive_config:
            return comprehensive_config
        
        # Fall back to legacy library
        return cls.FRAMEWORK_LIBRARY.get(framework_code.upper())
    
    @classmethod
    def get_requirements_for_framework(cls, framework_code: str) -> List[Dict]:
        """Get default requirements for a framework"""
        config = cls.get_framework_config(framework_code)
        if not config:
            return []
        
        # If using comprehensive library, convert rules to requirements format
        if "rules" in config and isinstance(config["rules"], list):
            requirements = []
            for rule in config["rules"]:
                requirements.append({
                    "text": rule.get("requirement_text", rule.get("name", "")),
                    "enabled": True
                })
            return requirements
        
        # Legacy format
        return config.get("requirements", [])
    
    @classmethod
    def get_rules_for_framework(cls, framework_code: str) -> Dict:
        """Get default rules for a framework"""
        config = cls.get_framework_config(framework_code)
        if not config:
            return {}
        
        # If using comprehensive library, convert rules list to dict format
        if "rules" in config and isinstance(config["rules"], list):
            rules_dict = {}
            for rule in config["rules"]:
                rule_key = rule.get("code", rule.get("name", "")).lower().replace("-", "_").replace(" ", "_")
                rules_dict[rule_key] = {
                    "description": rule.get("description", rule.get("requirement_text", "")),
                    "required": True,
                    "requirement_code": rule.get("requirement_code"),
                    "conditions": rule.get("conditions")
                }
            return rules_dict
        
        # Legacy format
        return config.get("rules", {})
    
    @classmethod
    def get_controls_for_framework(cls, framework_code: str) -> List[Dict]:
        """Get default enforcement controls for a framework"""
        config = cls.get_framework_config(framework_code)
        if config:
            return config.get("enforcement_controls", [])
        return []
    
    @classmethod
    def get_required_attributes_for_framework(cls, framework_code: str) -> List[Dict]:
        """Get required attributes for a framework"""
        config = cls.get_framework_config(framework_code)
        if config:
            return config.get("required_attributes", [])
        return []
    
    @classmethod
    def get_applicability_criteria_for_framework(cls, framework_code: str) -> Optional[Dict]:
        """Get applicability criteria for a framework"""
        config = cls.get_framework_config(framework_code)
        if config:
            return config.get("applicability_criteria")
        return None
    
    @classmethod
    def populate_policy_from_framework(cls, framework_code: str, policy_data: Dict) -> Dict:
        """Populate policy data with default framework requirements, rules, and controls"""
        config = cls.get_framework_config(framework_code)
        if not config:
            logger.warning(f"Framework {framework_code} not found in library")
            return policy_data
        
        # Only populate if not already set
        if not policy_data.get("requirements"):
            policy_data["requirements"] = cls.get_requirements_for_framework(framework_code)
        
        if not policy_data.get("rules"):
            policy_data["rules"] = cls.get_rules_for_framework(framework_code)
        
        if not policy_data.get("enforcement_controls"):
            policy_data["enforcement_controls"] = cls.get_controls_for_framework(framework_code)
        
        # Populate required attributes if not set
        if not policy_data.get("required_attributes"):
            policy_data["required_attributes"] = cls.get_required_attributes_for_framework(framework_code)
        
        # Populate applicability criteria if not set
        if not policy_data.get("applicability_criteria"):
            policy_data["applicability_criteria"] = cls.get_applicability_criteria_for_framework(framework_code)
        
        return policy_data
    
    @classmethod
    def list_available_frameworks(cls) -> List[str]:
        """List all available framework codes"""
        # Combine both libraries
        comprehensive_frameworks = cls._library.list_frameworks()
        legacy_frameworks = list(cls.FRAMEWORK_LIBRARY.keys())
        # Merge and deduplicate
        all_frameworks = list(set(comprehensive_frameworks + legacy_frameworks))
        return sorted(all_frameworks)

