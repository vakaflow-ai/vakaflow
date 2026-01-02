"""
Comprehensive Requirement Library - Repository of all requirement types
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.submission_requirement import SubmissionRequirement
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class RequirementLibrary:
    """Comprehensive library of requirement templates"""
    
    # Security Requirements Library
    SECURITY_REQUIREMENTS = [
        {
            "label": "Security Architecture Overview",
            "field_name": "security_architecture",
            "description": "Provide a comprehensive overview of your agent's security architecture",
            "placeholder": "Describe security layers, defense-in-depth strategies, security zones, etc.",
            "category": "security",
            "section": "Security Architecture"
        },
        {
            "label": "Data Encryption at Rest",
            "field_name": "encryption_at_rest",
            "description": "Describe encryption methods used for data at rest",
            "placeholder": "Specify encryption algorithms (AES-256, etc.), key management approach, encryption scope",
            "category": "security",
            "section": "Data Protection"
        },
        {
            "label": "Data Encryption in Transit",
            "field_name": "encryption_in_transit",
            "description": "Describe encryption methods used for data in transit",
            "placeholder": "Specify TLS/SSL versions, cipher suites, certificate management",
            "category": "security",
            "section": "Data Protection"
        },
        {
            "label": "Authentication Mechanisms",
            "field_name": "authentication_mechanisms",
            "description": "Describe authentication methods and protocols",
            "placeholder": "OAuth 2.0, SAML, MFA, password policies, session management",
            "category": "security",
            "section": "Access Control"
        },
        {
            "label": "Authorization and Access Control",
            "field_name": "authorization_access_control",
            "description": "Describe authorization model and access control mechanisms",
            "placeholder": "RBAC, ABAC, least privilege, role definitions, permission model",
            "category": "security",
            "section": "Access Control"
        },
        {
            "label": "Identity and Access Management (IAM)",
            "field_name": "iam_capabilities",
            "description": "Describe IAM capabilities and integration",
            "placeholder": "User provisioning, deprovisioning, SSO integration, directory services",
            "category": "security",
            "section": "Access Control"
        },
        {
            "label": "Network Security",
            "field_name": "network_security",
            "description": "Describe network security measures",
            "placeholder": "Firewalls, network segmentation, VPN, DDoS protection, intrusion detection",
            "category": "security",
            "section": "Network Security"
        },
        {
            "label": "Vulnerability Management",
            "field_name": "vulnerability_management",
            "description": "Describe vulnerability scanning and management processes",
            "placeholder": "Scanning frequency, remediation SLAs, CVE tracking, patch management",
            "category": "security",
            "section": "Security Operations"
        },
        {
            "label": "Security Monitoring and Logging",
            "field_name": "security_monitoring",
            "description": "Describe security monitoring and logging capabilities",
            "placeholder": "SIEM integration, log retention, alerting, incident detection",
            "category": "security",
            "section": "Security Operations"
        },
        {
            "label": "Incident Response Plan",
            "field_name": "incident_response_plan",
            "description": "Describe incident response procedures and capabilities",
            "placeholder": "Response team, escalation procedures, containment strategies, recovery plans",
            "category": "security",
            "section": "Security Operations"
        },
        {
            "label": "Penetration Testing",
            "field_name": "penetration_testing",
            "description": "Describe penetration testing practices",
            "placeholder": "Testing frequency, scope, third-party testers, remediation process",
            "category": "security",
            "section": "Security Testing"
        },
        {
            "label": "Secure Development Lifecycle (SDLC)",
            "field_name": "secure_sdlc",
            "description": "Describe secure development practices",
            "placeholder": "Security training, code reviews, threat modeling, security testing in CI/CD",
            "category": "security",
            "section": "Development Security"
        },
        {
            "label": "Third-Party Security",
            "field_name": "third_party_security",
            "description": "Describe third-party security assessment and management",
            "placeholder": "Vendor assessments, supply chain security, dependency scanning",
            "category": "security",
            "section": "Third-Party Security"
        }
    ]
    
    # Compliance Requirements Library
    COMPLIANCE_REQUIREMENTS = [
        {
            "label": "Compliance Certifications",
            "field_name": "compliance_certifications",
            "description": "List all compliance certifications and attestations",
            "placeholder": "SOC 2 Type II, ISO 27001, HIPAA, GDPR, PCI-DSS, FedRAMP, etc.",
            "category": "compliance",
            "section": "Certifications"
        },
        {
            "label": "Audit Trail Capabilities",
            "field_name": "audit_trail",
            "description": "Describe audit trail and logging capabilities",
            "placeholder": "Event logging, log retention periods, tamper protection, audit log access",
            "category": "compliance",
            "section": "Audit & Monitoring"
        },
        {
            "label": "Data Retention Policies",
            "field_name": "data_retention_policies",
            "description": "Describe data retention and deletion policies",
            "placeholder": "Retention periods by data type, automated deletion, data lifecycle management",
            "category": "compliance",
            "section": "Data Governance"
        },
        {
            "label": "Data Privacy Controls",
            "field_name": "data_privacy_controls",
            "description": "Describe privacy controls and data protection measures",
            "placeholder": "Data minimization, purpose limitation, consent management, privacy by design",
            "category": "compliance",
            "section": "Data Governance"
        },
        {
            "label": "Right to Access and Portability",
            "field_name": "data_subject_rights",
            "description": "Describe capabilities for data subject rights requests",
            "placeholder": "Data export, access requests, deletion requests, portability features",
            "category": "compliance",
            "section": "Data Subject Rights"
        },
        {
            "label": "Data Processing Agreements",
            "field_name": "data_processing_agreements",
            "description": "Describe data processing agreement capabilities",
            "placeholder": "DPA templates, processor obligations, sub-processor management",
            "category": "compliance",
            "section": "Legal & Contracts"
        },
        {
            "label": "Breach Notification Procedures",
            "field_name": "breach_notification",
            "description": "Describe data breach notification procedures",
            "placeholder": "Detection procedures, notification timelines, regulatory reporting",
            "category": "compliance",
            "section": "Incident Management"
        },
        {
            "label": "Compliance Monitoring",
            "field_name": "compliance_monitoring",
            "description": "Describe ongoing compliance monitoring and assessment",
            "placeholder": "Compliance dashboards, automated checks, compliance reporting",
            "category": "compliance",
            "section": "Compliance Operations"
        },
        {
            "label": "Regulatory Reporting",
            "field_name": "regulatory_reporting",
            "description": "Describe regulatory reporting capabilities",
            "placeholder": "Report generation, submission processes, regulatory change management",
            "category": "compliance",
            "section": "Compliance Operations"
        }
    ]
    
    # Technical Requirements Library
    TECHNICAL_REQUIREMENTS = [
        {
            "label": "Technical Architecture",
            "field_name": "technical_architecture",
            "description": "Describe the overall technical architecture",
            "placeholder": "System design, components, microservices, APIs, data flow, integration points",
            "category": "technical",
            "section": "Architecture"
        },
        {
            "label": "Scalability and Performance",
            "field_name": "scalability_performance",
            "description": "Describe scalability and performance characteristics",
            "placeholder": "Horizontal/vertical scaling, load handling, performance benchmarks, capacity planning",
            "category": "technical",
            "section": "Performance"
        },
        {
            "label": "High Availability and Disaster Recovery",
            "field_name": "ha_disaster_recovery",
            "description": "Describe high availability and disaster recovery capabilities",
            "placeholder": "RTO/RPO targets, backup strategies, failover mechanisms, geographic redundancy",
            "category": "technical",
            "section": "Reliability"
        },
        {
            "label": "API Documentation",
            "field_name": "api_documentation",
            "description": "Provide API documentation and specifications",
            "placeholder": "OpenAPI/Swagger specs, API versioning, rate limiting, authentication methods",
            "category": "technical",
            "section": "Integration"
        },
        {
            "label": "Integration Capabilities",
            "field_name": "integration_capabilities",
            "description": "Describe integration capabilities and supported protocols",
            "placeholder": "REST, GraphQL, webhooks, message queues, ETL capabilities",
            "category": "technical",
            "section": "Integration"
        },
        {
            "label": "Data Storage and Management",
            "field_name": "data_storage_management",
            "description": "Describe data storage and management approach",
            "placeholder": "Database types, data models, backup strategies, data migration capabilities",
            "category": "technical",
            "section": "Data Management"
        },
        {
            "label": "Deployment Architecture",
            "field_name": "deployment_architecture",
            "description": "Describe deployment and infrastructure architecture",
            "placeholder": "Cloud providers, containerization, orchestration, infrastructure as code",
            "category": "technical",
            "section": "Infrastructure"
        },
        {
            "label": "Monitoring and Observability",
            "field_name": "monitoring_observability",
            "description": "Describe monitoring and observability capabilities",
            "placeholder": "Metrics, logging, tracing, alerting, dashboards, APM tools",
            "category": "technical",
            "section": "Operations"
        },
        {
            "label": "Version Control and Release Management",
            "field_name": "version_control_releases",
            "description": "Describe version control and release management practices",
            "placeholder": "Git workflows, branching strategy, release process, rollback capabilities",
            "category": "technical",
            "section": "Development"
        },
        {
            "label": "Testing and Quality Assurance",
            "field_name": "testing_qa",
            "description": "Describe testing and QA practices",
            "placeholder": "Unit tests, integration tests, E2E tests, test coverage, QA processes",
            "category": "technical",
            "section": "Development"
        }
    ]
    
    # Business Requirements Library
    BUSINESS_REQUIREMENTS = [
        {
            "label": "Business Value Proposition",
            "field_name": "business_value",
            "description": "Describe the business value and ROI",
            "placeholder": "Cost savings, efficiency gains, revenue impact, competitive advantages",
            "category": "business",
            "section": "Value Proposition"
        },
        {
            "label": "Use Cases and Applications",
            "field_name": "use_cases",
            "description": "Describe primary use cases and applications",
            "placeholder": "Specific business scenarios, industry applications, customer segments",
            "category": "business",
            "section": "Use Cases"
        },
        {
            "label": "Support and Maintenance",
            "field_name": "support_maintenance",
            "description": "Describe support and maintenance offerings",
            "placeholder": "Support channels, SLAs, maintenance windows, support tiers, escalation procedures",
            "category": "business",
            "section": "Support"
        },
        {
            "label": "Service Level Agreements (SLAs)",
            "field_name": "service_level_agreements",
            "description": "Describe service level agreements and guarantees",
            "placeholder": "Uptime guarantees, response times, resolution times, SLA penalties",
            "category": "business",
            "section": "Service Quality"
        },
        {
            "label": "Pricing and Licensing Model",
            "field_name": "pricing_licensing",
            "description": "Describe pricing and licensing structure",
            "placeholder": "Pricing tiers, licensing models, usage-based pricing, contract terms",
            "category": "business",
            "section": "Commercial"
        },
        {
            "label": "Training and Documentation",
            "field_name": "training_documentation",
            "description": "Describe training and documentation offerings",
            "placeholder": "User guides, API docs, training materials, onboarding support, knowledge base",
            "category": "business",
            "section": "Documentation"
        },
        {
            "label": "Roadmap and Future Enhancements",
            "field_name": "roadmap",
            "description": "Describe product roadmap and planned enhancements",
            "placeholder": "Upcoming features, release timeline, enhancement requests process",
            "category": "business",
            "section": "Product Roadmap"
        },
        {
            "label": "Customer References and Case Studies",
            "field_name": "customer_references",
            "description": "Provide customer references and case studies",
            "placeholder": "Customer testimonials, case studies, reference customers, success stories",
            "category": "business",
            "section": "References"
        }
    ]
    
    def get_all_requirements(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get all requirement templates organized by category"""
        return {
            "security": self.SECURITY_REQUIREMENTS,
            "compliance": self.COMPLIANCE_REQUIREMENTS,
            "technical": self.TECHNICAL_REQUIREMENTS,
            "business": self.BUSINESS_REQUIREMENTS
        }
    
    def generate_library_requirements(
        self,
        db: Session,
        tenant_id: str,
        categories: List[str] = None,
        created_by: str = None
    ) -> Dict[str, List[SubmissionRequirement]]:
        """
        Generate all library requirements for a tenant
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            categories: List of categories to generate (all if None)
            created_by: User ID who triggered generation
            
        Returns:
            Dictionary with requirements by category
        """
        all_requirements = self.get_all_requirements()
        categories_to_generate = categories or list(all_requirements.keys())
        
        result = {}
        
        for category in categories_to_generate:
            if category not in all_requirements:
                continue
            
            templates = all_requirements[category]
            created = []
            
            for template in templates:
                # Generate catalog_id for requirement
                catalog_id = f"REQ-LIB-{category.upper()}-{template['field_name'].upper().replace('_', '-')}"
                
                # Check if requirement already exists (by catalog_id or source_id)
                existing = db.query(SubmissionRequirement).filter(
                    SubmissionRequirement.tenant_id == tenant_id,
                    SubmissionRequirement.source_type == "library",
                    SubmissionRequirement.catalog_id == catalog_id,
                    SubmissionRequirement.is_active == True
                ).first()
                
                if existing:
                    continue
                
                # Create requirement from template
                # Note: field_name is now a computed property from catalog_id
                requirement = SubmissionRequirement(
                    tenant_id=tenant_id,
                    label=template["label"],
                    catalog_id=catalog_id,
                    field_type="textarea",
                    description=template["description"],
                    placeholder=template["placeholder"],
                    is_required=False,
                    category=category,
                    section=template["section"],
                    order=0,
                    source_type="library",
                    source_id=template["field_name"],  # Keep original field_name as source_id for reference
                    source_name=f"Library: {template['section']}",
                    is_auto_generated=True,
                    is_enabled=True,
                    created_by=created_by
                )
                
                db.add(requirement)
                created.append(requirement)
            
            result[category] = created
        
        db.commit()
        return result


# Singleton instance
requirement_library = RequirementLibrary()

