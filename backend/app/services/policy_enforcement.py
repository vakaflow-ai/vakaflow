"""
Policy enforcement and measurement logic
"""
from typing import Dict, List, Optional, Any
from app.models.agent import Agent, AgentMetadata
from app.models.policy import Policy, PolicyCategory
import logging

logger = logging.getLogger(__name__)


class PolicyEnforcementEngine:
    """Engine for enforcing policy rules and measuring compliance"""
    
    @staticmethod
    def get_enforcement_logic(policy: Policy) -> Dict[str, Any]:
        """
        Get the enforcement logic for a policy based on its category and rules
        
        Returns:
            Dictionary describing how the policy is enforced
        """
        enforcement = {
            "category": policy.category,
            "enforcement_methods": [],
            "measurement_criteria": [],
            "scoring_method": None
        }
        
        if policy.category == PolicyCategory.SECURITY.value:
            enforcement["enforcement_methods"] = [
                {
                    "method": "Keyword Analysis",
                    "description": "Scans agent capabilities and metadata for security-related keywords",
                    "keywords": ["encryption", "authentication", "authorization", "security", "mfa", "2fa", "ssl", "tls"]
                },
                {
                    "method": "RAG-Based Verification",
                    "description": "Uses knowledge base to verify security documentation and practices"
                },
                {
                    "method": "Rule-Based Checking",
                    "description": "Evaluates agent against specific security rules defined in policy"
                }
            ]
            
            enforcement["measurement_criteria"] = [
                {
                    "criterion": "Security Capabilities",
                    "weight": 0.4,
                    "description": "Presence of security-related capabilities in agent metadata"
                },
                {
                    "criterion": "Documentation Quality",
                    "weight": 0.3,
                    "description": "Quality and completeness of security documentation"
                },
                {
                    "criterion": "Rule Compliance",
                    "weight": 0.3,
                    "description": "Compliance with specific security rules defined in policy"
                }
            ]
            
            enforcement["scoring_method"] = {
                "type": "weighted_average",
                "description": "Weighted average of all measurement criteria",
                "pass_threshold": 0.7,
                "warning_threshold": 0.5
            }
        
        elif policy.category == PolicyCategory.COMPLIANCE.value:
            enforcement["enforcement_methods"] = [
                {
                    "method": "Description Analysis",
                    "description": "Analyzes agent description for compliance-related information",
                    "min_length": 50
                },
                {
                    "method": "RAG-Based Requirement Matching",
                    "description": "Matches agent documentation against policy requirements using RAG"
                },
                {
                    "method": "Rule-Based Evaluation",
                    "description": "Evaluates agent against regulatory compliance rules"
                }
            ]
            
            enforcement["measurement_criteria"] = [
                {
                    "criterion": "Description Completeness",
                    "weight": 0.2,
                    "description": "Minimum description length and detail level"
                },
                {
                    "criterion": "Requirement Coverage",
                    "weight": 0.5,
                    "description": "Percentage of policy requirements met by agent"
                },
                {
                    "criterion": "Documentation Relevance",
                    "weight": 0.3,
                    "description": "Relevance of agent documentation to policy requirements (RAG score)"
                }
            ]
            
            enforcement["scoring_method"] = {
                "type": "weighted_average",
                "description": "Weighted average of requirement coverage and documentation quality",
                "pass_threshold": 0.75,
                "warning_threshold": 0.6
            }
        
        elif policy.category == PolicyCategory.TECHNICAL.value:
            enforcement["enforcement_methods"] = [
                {
                    "method": "Technical Specification Review",
                    "description": "Reviews agent technical specifications and architecture"
                },
                {
                    "method": "Code and Artifact Analysis",
                    "description": "Analyzes uploaded code and technical artifacts"
                },
                {
                    "method": "Integration Compatibility Check",
                    "description": "Verifies integration capabilities and compatibility"
                }
            ]
            
            enforcement["measurement_criteria"] = [
                {
                    "criterion": "Technical Documentation",
                    "weight": 0.4,
                    "description": "Completeness of technical documentation"
                },
                {
                    "criterion": "Architecture Compliance",
                    "weight": 0.3,
                    "description": "Adherence to technical architecture standards"
                },
                {
                    "criterion": "Integration Readiness",
                    "weight": 0.3,
                    "description": "Readiness for integration with existing systems"
                }
            ]
            
            enforcement["scoring_method"] = {
                "type": "weighted_average",
                "description": "Weighted average of technical criteria",
                "pass_threshold": 0.65,
                "warning_threshold": 0.5
            }
        
        else:  # BUSINESS
            enforcement["enforcement_methods"] = [
                {
                    "method": "Business Value Assessment",
                    "description": "Evaluates business value and ROI potential"
                },
                {
                    "method": "Use Case Analysis",
                    "description": "Analyzes use cases and business scenarios"
                },
                {
                    "method": "Stakeholder Impact Review",
                    "description": "Reviews impact on business stakeholders"
                }
            ]
            
            enforcement["measurement_criteria"] = [
                {
                    "criterion": "Business Value",
                    "weight": 0.5,
                    "description": "Potential business value and ROI"
                },
                {
                    "criterion": "Use Case Clarity",
                    "weight": 0.3,
                    "description": "Clarity and completeness of use cases"
                },
                {
                    "criterion": "Stakeholder Alignment",
                    "weight": 0.2,
                    "description": "Alignment with stakeholder needs"
                }
            ]
            
            enforcement["scoring_method"] = {
                "type": "weighted_average",
                "description": "Weighted average of business criteria",
                "pass_threshold": 0.6,
                "warning_threshold": 0.45
            }
        
        # Add policy-specific rules if available
        if policy.rules:
            enforcement["policy_rules"] = policy.rules
            enforcement["rule_count"] = len(policy.rules) if isinstance(policy.rules, dict) else 0
        
        return enforcement
    
    @staticmethod
    def explain_measurement(policy: Policy) -> Dict[str, Any]:
        """
        Explain how compliance is measured for a policy
        
        Returns:
            Dictionary explaining measurement methodology
        """
        explanation = {
            "policy_name": policy.name,
            "category": policy.category,
            "measurement_steps": [],
            "scoring_breakdown": {}
        }
        
        # Step 1: Data Collection
        explanation["measurement_steps"].append({
            "step": 1,
            "name": "Data Collection",
            "description": "Collect agent information including metadata, description, capabilities, and uploaded artifacts"
        })
        
        # Step 2: Rule Evaluation
        if policy.rules:
            explanation["measurement_steps"].append({
                "step": 2,
                "name": "Rule Evaluation",
                "description": f"Evaluate agent against {len(policy.rules) if isinstance(policy.rules, dict) else 0} policy rules",
                "rules": list(policy.rules.keys()) if isinstance(policy.rules, dict) else []
            })
        
        # Step 3: RAG-Based Analysis
        explanation["measurement_steps"].append({
            "step": 3,
            "name": "RAG-Based Analysis",
            "description": "Query knowledge base for relevant documentation and match against policy requirements",
            "rag_query": f"Compliance requirements for {policy.category} in {policy.region or 'global'}"
        })
        
        # Step 4: Requirement Matching
        if policy.requirements:
            explanation["measurement_steps"].append({
                "step": 4,
                "name": "Requirement Matching",
                "description": f"Match agent capabilities against {len(policy.requirements)} policy requirements",
                "requirement_count": len(policy.requirements)
            })
        
        # Step 5: Scoring
        explanation["measurement_steps"].append({
            "step": 5,
            "name": "Compliance Scoring",
            "description": "Calculate weighted compliance score based on all criteria"
        })
        
        # Scoring breakdown
        if policy.category == PolicyCategory.SECURITY.value:
            explanation["scoring_breakdown"] = {
                "security_capabilities": {
                    "weight": 0.4,
                    "calculation": "Boolean check for security keywords in capabilities",
                    "max_score": 1.0
                },
                "documentation_quality": {
                    "weight": 0.3,
                    "calculation": "Average RAG relevance score (0-1)",
                    "max_score": 1.0
                },
                "rule_compliance": {
                    "weight": 0.3,
                    "calculation": "Percentage of policy rules satisfied",
                    "max_score": 1.0
                }
            }
        elif policy.category == PolicyCategory.COMPLIANCE.value:
            explanation["scoring_breakdown"] = {
                "description_completeness": {
                    "weight": 0.2,
                    "calculation": "Description length >= 50 characters: 1.0, else: length/50",
                    "max_score": 1.0
                },
                "requirement_coverage": {
                    "weight": 0.5,
                    "calculation": "Number of requirements matched / Total requirements",
                    "max_score": 1.0
                },
                "documentation_relevance": {
                    "weight": 0.3,
                    "calculation": "Average RAG relevance score (0-1)",
                    "max_score": 1.0
                }
            }
        
        explanation["final_score_calculation"] = {
            "formula": "Sum of (criterion_score × criterion_weight) for all criteria",
            "result_range": "0.0 to 1.0",
            "status_mapping": {
                "pass": "score >= pass_threshold",
                "warning": "warning_threshold <= score < pass_threshold",
                "fail": "score < warning_threshold"
            }
        }
        
        return explanation


# Global instance
policy_enforcement_engine = PolicyEnforcementEngine()

