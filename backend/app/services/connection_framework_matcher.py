"""
Service to automatically match compliance frameworks based on agent connections
"""
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from app.models.compliance_framework import ComplianceFramework
from app.models.agent_connection import AgentConnection
import logging

logger = logging.getLogger(__name__)


class ConnectionFrameworkMatcher:
    """Service to match compliance frameworks based on connected systems"""
    
    # System to framework mapping
    SYSTEM_FRAMEWORK_MAP: Dict[str, List[str]] = {
        # Healthcare systems
        "PACS": ["HIPAA"],
        "EHR": ["HIPAA"],
        "EMR": ["HIPAA"],
        "HL7": ["HIPAA"],
        "FHIR": ["HIPAA"],
        "DICOM": ["HIPAA"],
        "EPIC": ["HIPAA"],
        "CERNER": ["HIPAA"],
        "ALLSCRIPTS": ["HIPAA"],
        "AThenahealth": ["HIPAA"],
        
        # Financial systems
        "SAP": ["SOX", "PCI_DSS"],  # SAP can handle financial data
        "ORACLE": ["SOX", "PCI_DSS"],
        "SALESFORCE": ["SOC2", "GDPR"],
        "WORKDAY": ["SOC2", "GDPR"],
        "ADP": ["SOC2", "GDPR"],
        "QUICKBOOKS": ["SOX"],
        "XERO": ["SOX"],
        "STRIPE": ["PCI_DSS"],
        "PAYPAL": ["PCI_DSS"],
        "SQUARE": ["PCI_DSS"],
        
        # Cloud providers
        "AWS": ["SOC2", "ISO27001"],
        "AZURE": ["SOC2", "ISO27001"],
        "GCP": ["SOC2", "ISO27001"],
        "GOOGLE CLOUD": ["SOC2", "ISO27001"],
        
        # Data systems
        "SNOWFLAKE": ["SOC2", "ISO27001"],
        "DATABRICKS": ["SOC2", "ISO27001"],
        "REDSHIFT": ["SOC2", "ISO27001"],
        
        # EU systems
        "EU": ["GDPR"],
        "EUROPE": ["GDPR"],
        
        # California systems
        "CALIFORNIA": ["CCPA"],
        "CA": ["CCPA"],
        
        # Energy/Utilities
        "SCADA": ["NERC_CIP"],
        "ICS": ["NERC_CIP"],
        "OT": ["NERC_CIP"],
        "ENERGY": ["NERC_CIP"],
        
        # Defense systems
        "DEFENSE": ["ITAR"],
        "MILITARY": ["ITAR"],
        "AEROSPACE": ["ITAR"],
    }
    
    # Data type to framework mapping
    DATA_TYPE_FRAMEWORK_MAP: Dict[str, List[str]] = {
        "PHI": ["HIPAA"],
        "HEALTHCARE": ["HIPAA"],
        "MEDICAL": ["HIPAA"],
        "PII": ["GDPR", "CCPA", "PRIVACY"],
        "PERSONAL_DATA": ["GDPR", "PRIVACY"],
        "FINANCIAL": ["SOX", "PCI_DSS"],
        "PAYMENT_CARD": ["PCI_DSS"],
        "CARDHOLDER": ["PCI_DSS"],
        "CREDIT_CARD": ["PCI_DSS"],
        "HR_DATA": ["GDPR", "PRIVACY", "SOX"],
        "EMPLOYEE_DATA": ["GDPR", "PRIVACY", "SOX"],
        "EU": ["GDPR"],
        "EUROPE": ["GDPR"],
        "CALIFORNIA": ["CCPA"],
        "BES": ["NERC_CIP"],
        "CRITICAL_INFRASTRUCTURE": ["NERC_CIP"],
        "ENERGY": ["NERC_CIP"],
        "DEFENSE": ["ITAR"],
        "MILITARY": ["ITAR"],
    }
    
    @classmethod
    def match_frameworks_from_connections(
        cls, 
        connections: List[Dict[str, Any]],
        db: Session
    ) -> List[str]:
        """
        Match compliance frameworks based on agent connections
        
        Args:
            connections: List of connection dictionaries
            db: Database session
        
        Returns:
            List of framework codes that should apply
        """
        matched_frameworks: Set[str] = set()
        
        for conn in connections:
            app_name = conn.get("app_name", "").upper()
            app_type = conn.get("app_type", "").upper()
            data_types = conn.get("data_types_exchanged", [])
            data_classification = conn.get("data_classification", "").upper()
            source_system = conn.get("source_system", "").upper()
            destination_system = conn.get("destination_system", "").upper()
            
            # Check system name mapping
            for system_key, frameworks in cls.SYSTEM_FRAMEWORK_MAP.items():
                if system_key in app_name or system_key in app_type:
                    matched_frameworks.update(frameworks)
            
            # Check source/destination systems
            for system_key, frameworks in cls.SYSTEM_FRAMEWORK_MAP.items():
                if system_key in source_system or system_key in destination_system:
                    matched_frameworks.update(frameworks)
            
            # Check data types
            for data_type in data_types:
                data_type_upper = data_type.upper()
                for data_key, frameworks in cls.DATA_TYPE_FRAMEWORK_MAP.items():
                    if data_key in data_type_upper:
                        matched_frameworks.update(frameworks)
            
            # Check data classification
            if data_classification:
                for data_key, frameworks in cls.DATA_TYPE_FRAMEWORK_MAP.items():
                    if data_key in data_classification:
                        matched_frameworks.update(frameworks)
        
        # Verify frameworks exist in database
        framework_codes = list(matched_frameworks)
        
        if not framework_codes:
            return []
        
        try:
            existing_frameworks = db.query(ComplianceFramework).filter(
                ComplianceFramework.code.in_(framework_codes),
                ComplianceFramework.is_active == True
            ).all()
            
            existing_codes = [fw.code for fw in existing_frameworks]
            
            logger.info(f"Matched frameworks from connections: {existing_codes}")
            
            return existing_codes
        except Exception as e:
            logger.error(f"Error querying frameworks: {e}")
            return []
    
    @classmethod
    def get_framework_recommendations(
        cls,
        connections: List[Dict[str, Any]],
        agent_category: str = None,
        agent_subcategory: str = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get framework recommendations with reasoning
        
        Args:
            connections: List of connection dictionaries
            agent_category: Agent category
            agent_subcategory: Agent subcategory
            db: Database session
        
        Returns:
            Dictionary with recommended frameworks and reasoning
        """
        recommendations = {
            "frameworks": [],
            "reasoning": {}
        }
        
        if not db:
            return recommendations
        
        matched_frameworks = cls.match_frameworks_from_connections(connections, db)
        
        try:
            # Batch query all frameworks at once
            framework_codes = list(matched_frameworks)
            if framework_codes:
                frameworks_map = {
                    fw.code: fw for fw in db.query(ComplianceFramework).filter(
                        ComplianceFramework.code.in_(framework_codes),
                        ComplianceFramework.is_active == True
                    ).all()
                }
            else:
                frameworks_map = {}
            
            for framework_code in matched_frameworks:
                framework = frameworks_map.get(framework_code)
                
                if framework:
                    reasoning = []
                    
                    # Find which connections triggered this framework
                    for conn in connections:
                        app_name = conn.get("app_name", "").upper()
                        data_types = conn.get("data_types_exchanged", [])
                        
                        # Check if this connection matches
                        for system_key, frameworks in cls.SYSTEM_FRAMEWORK_MAP.items():
                            if system_key in app_name and framework_code in frameworks:
                                reasoning.append(f"Connected to {conn.get('app_name')} system")
                        
                        for data_type in data_types:
                            data_type_upper = data_type.upper()
                            for data_key, frameworks in cls.DATA_TYPE_FRAMEWORK_MAP.items():
                                if data_key in data_type_upper and framework_code in frameworks:
                                    reasoning.append(f"Processes {data_type} data")
                    
                    recommendations["frameworks"].append({
                        "code": framework.code,
                        "name": framework.name,
                        "description": framework.description
                    })
                    
                    recommendations["reasoning"][framework_code] = reasoning
        except Exception as e:
            logger.error(f"Error getting framework recommendations: {e}")
            # Return empty recommendations on error
        
        return recommendations

