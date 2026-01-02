"""
Requirement Matching Service - matches framework requirements to agents based on attributes
"""
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from app.models.compliance_framework import (
    ComplianceFramework, FrameworkRule, FrameworkRisk, AgentFrameworkLink
)
from app.models.agent import Agent, AgentMetadata
from app.models.agent_connection import AgentConnection
from app.services.connection_framework_matcher import ConnectionFrameworkMatcher
import logging

logger = logging.getLogger(__name__)


class RequirementMatchingService:
    """Service for matching compliance framework requirements to agents"""
    
    def get_applicable_frameworks(
        self,
        db: Session,
        agent: Agent,
        metadata: Optional[AgentMetadata] = None,
        connections: Optional[List[AgentConnection]] = None
    ) -> List[ComplianceFramework]:
        """
        Get compliance frameworks that apply to an agent based on agent attributes and connections
        
        Args:
            db: Database session
            agent: Agent instance
            metadata: Optional agent metadata
            connections: Optional list of agent connections
            
        Returns:
            List of applicable compliance frameworks
        """
        # Get agent attributes
        agent_attrs = self._extract_agent_attributes(agent, metadata, connections)
        
        # Get all active frameworks
        frameworks = db.query(ComplianceFramework).filter(
            ComplianceFramework.is_active == True
        ).all()
        
        applicable = []
        for framework in frameworks:
            if self._framework_applies_to_agent(framework, agent_attrs):
                applicable.append(framework)
        
        # Also check connections for additional frameworks
        if connections is None:
            connections = db.query(AgentConnection).filter(
                AgentConnection.agent_id == agent.id,
                AgentConnection.is_active == True
            ).all()
        
        if connections:
            # Convert connections to dict format
            connections_dict = [
                {
                    "app_name": conn.app_name,
                    "app_type": conn.app_type,
                    "data_types_exchanged": conn.data_types_exchanged or [],
                    "data_classification": conn.data_classification,
                    "source_system": conn.source_system,
                    "destination_system": conn.destination_system,
                    "data_flow_direction": conn.data_flow_direction,
                }
                for conn in connections
            ]
            
            # Get framework recommendations from connections
            connection_frameworks = ConnectionFrameworkMatcher.match_frameworks_from_connections(
                connections_dict,
                db
            )
            
            # Add connection-based frameworks that aren't already included
            existing_codes = {fw.code for fw in applicable}
            for fw_code in connection_frameworks:
                if fw_code not in existing_codes:
                    framework = db.query(ComplianceFramework).filter(
                        ComplianceFramework.code == fw_code,
                        ComplianceFramework.is_active == True
                    ).first()
                    if framework:
                        applicable.append(framework)
        
        return applicable
    
    def get_applicable_requirements(
        self,
        db: Session,
        agent: Agent,
        framework_id: Optional[str] = None,
        metadata: Optional[AgentMetadata] = None,
        connections: Optional[List[AgentConnection]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get requirements that apply to an agent based on agent category and attributes
        
        Args:
            db: Database session
            agent: Agent instance
            framework_id: Optional framework ID to filter by
            metadata: Optional agent metadata
            connections: Optional list of agent connections
            
        Returns:
            List of applicable requirements with hierarchy
        """
        # Get agent attributes
        agent_attrs = self._extract_agent_attributes(agent, metadata, connections)
        
        # Build query for rules
        query = db.query(FrameworkRule).filter(
            FrameworkRule.is_active == True
        )
        
        if framework_id:
            query = query.filter(FrameworkRule.framework_id == framework_id)
        
        all_rules = query.order_by(FrameworkRule.order).all()
        
        # Filter rules based on conditions
        applicable_rules = []
        for rule in all_rules:
            if self._rule_applies_to_agent(rule, agent_attrs):
                applicable_rules.append(rule)
        
        # Build hierarchical structure
        return self._build_requirement_tree(applicable_rules)
    
    def _extract_agent_attributes(
        self,
        agent: Agent,
        metadata: Optional[AgentMetadata] = None,
        connections: Optional[List[AgentConnection]] = None
    ) -> Dict[str, Any]:
        """Extract agent attributes for matching"""
        attrs = {
            "category": agent.category or "",
            "subcategory": agent.subcategory or "",
            "type": agent.type or "",
        }
        
        if metadata:
            attrs.update({
                "data_types": metadata.data_types or [],
                "regions": metadata.regions or [],
                "capabilities": metadata.capabilities or [],
            })
        
        if connections:
            connected_app_types = list(set([conn.app_type for conn in connections if conn.app_type]))
            connected_data_types = list(set([dt for conn in connections for dt in (conn.data_types_exchanged or [])]))
            connected_app_names = list(set([conn.app_name for conn in connections if conn.app_name]))
            attrs.update({
                "connected_app_types": connected_app_types,
                "connected_data_types": connected_data_types,
                "connected_app_names": connected_app_names,
            })
        
        return attrs
    
    def _framework_applies_to_agent(
        self,
        framework: ComplianceFramework,
        agent_attrs: Dict[str, Any]
    ) -> bool:
        """Check if a framework applies to an agent (basic matching)"""
        # For now, all active frameworks apply
        # Can be enhanced with framework-level conditions later
        return True
    
    def _rule_applies_to_agent(
        self,
        rule: FrameworkRule,
        agent_attrs: Dict[str, Any]
    ) -> bool:
        """Check if a rule applies to an agent based on conditions"""
        if not rule.conditions:
            # No conditions = applies to all
            return True
        
        conditions = rule.conditions
        
        # Check agent category
        if "agent_category" in conditions:
            required_categories = conditions["agent_category"]
            if isinstance(required_categories, list):
                if agent_attrs.get("category") not in required_categories:
                    return False
        
        # Check data types
        if "data_types" in conditions:
            required_types = conditions["data_types"]
            if isinstance(required_types, list):
                agent_types = agent_attrs.get("data_types", [])
                if not any(t in agent_types for t in required_types):
                    return False
        
        # Check regions
        if "regions" in conditions:
            required_regions = conditions["regions"]
            if isinstance(required_regions, list):
                agent_regions = agent_attrs.get("regions", [])
                if not any(r in agent_regions for r in required_regions):
                    return False
        
        # Check agent type
        if "agent_type" in conditions:
            required_types = conditions["agent_type"]
            if isinstance(required_types, list):
                if agent_attrs.get("type") not in required_types:
                    return False
        
        return True
    
    def _build_requirement_tree(
        self,
        rules: List[FrameworkRule]
    ) -> List[Dict[str, Any]]:
        """Build hierarchical tree structure from rules"""
        # Create a map of rules by ID
        rule_map = {str(rule.id): rule for rule in rules}
        
        # Find root rules (no parent)
        root_rules = [r for r in rules if not r.parent_rule_id]
        
        def build_node(rule: FrameworkRule) -> Dict[str, Any]:
            """Recursively build a rule node with children"""
            node = {
                "id": str(rule.id),
                "name": rule.name,
                "code": rule.code,
                "description": rule.description,
                "requirement_text": rule.requirement_text,
                "requirement_code": rule.requirement_code,
                "order": rule.order,
                "children": []
            }
            
            # Find children
            children = [r for r in rules if r.parent_rule_id == rule.id]
            for child in children:
                node["children"].append(build_node(child))
            
            # Sort children by order
            node["children"].sort(key=lambda x: x["order"])
            
            return node
        
        # Build tree from root rules
        tree = [build_node(rule) for rule in root_rules]
        tree.sort(key=lambda x: x["order"])
        
        return tree


# Singleton instance
requirement_matching_service = RequirementMatchingService()

