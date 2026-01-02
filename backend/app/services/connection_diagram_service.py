"""
Service to generate connection diagrams for agents
Creates visual diagrams showing agent connections to systems
"""
from typing import List, Dict, Any, Optional
import logging
import re

logger = logging.getLogger(__name__)


def get_entity_icon(entity_name: str) -> str:
    """
    Get icon/emoji for entity based on name
    Returns icon that will be displayed in Mermaid diagram
    """
    if not entity_name:
        return "🔗"
    
    name_lower = entity_name.lower()
    
    # User-related
    if any(word in name_lower for word in ['user', 'person', 'people', 'human']):
        return "👤"
    
    # SAP
    if 'sap' in name_lower:
        return "📊"  # Business/ERP icon
    
    # Lenel (Access Control)
    if 'lenel' in name_lower:
        return "🔑"  # Key/Access icon
    
    # PACS (Picture Archiving and Communication System)
    if 'pacs' in name_lower:
        return "🏥"  # Medical/Healthcare icon
    
    # Firewall/Security
    if any(word in name_lower for word in ['firewall', 'fw', 'security', 'guard']):
        return "🛡️"
    
    # SSO/Authentication
    if any(word in name_lower for word in ['sso', 'single sign', 'auth', 'authentication', 'login']):
        return "🔐"
    
    # Database
    if any(word in name_lower for word in ['database', 'db', 'sql', 'oracle', 'mysql', 'postgres']):
        return "🗄️"
    
    # Cloud
    if any(word in name_lower for word in ['cloud', 'aws', 'azure', 'gcp', 's3']):
        return "☁️"
    
    # Email/Messaging
    if any(word in name_lower for word in ['email', 'mail', 'smtp', 'outlook', 'exchange']):
        return "📧"
    
    # API/Gateway
    if any(word in name_lower for word in ['api', 'gateway', 'rest', 'graphql']):
        return "🔌"
    
    # File/Storage
    if any(word in name_lower for word in ['file', 'storage', 's3', 'bucket', 'share']):
        return "📁"
    
    # Network
    if any(word in name_lower for word in ['network', 'vpn', 'router', 'switch']):
        return "🌐"
    
    # Monitoring/Logging
    if any(word in name_lower for word in ['monitor', 'log', 'splunk', 'elk', 'grafana']):
        return "📈"
    
    # Default system icon
    return "💻"


class ConnectionDiagramService:
    """Service to generate connection diagrams"""
    
    @staticmethod
    def generate_mermaid_diagram(agent_name: str, connections: List[Dict[str, Any]]) -> str:
        """
        Generate a Mermaid diagram showing agent connections
        
        Args:
            agent_name: Name of the agent
            connections: List of connection dictionaries with:
                - name: Connection/Entity name
                - app_name: System/app name (e.g., "SAP", "PACS")
                - data_flow_direction: "inbound", "outbound", or "bidirectional"
                - source_system: Source system name (usually "Agent")
                - destination_system: Destination system name (the entity)
        
        Returns:
            Mermaid diagram syntax as string
        """
        # Helper function to sanitize node IDs (Mermaid requires alphanumeric and underscores)
        def sanitize_node_id(name: str) -> str:
            """Convert name to valid Mermaid node ID"""
            if not name:
                return "UNKNOWN"
            # Replace spaces, hyphens, and special chars with underscores, keep alphanumeric
            sanitized = "".join(c if c.isalnum() or c == "_" else "_" for c in name)
            # Remove consecutive underscores
            while "__" in sanitized:
                sanitized = sanitized.replace("__", "_")
            # Remove leading/trailing underscores
            sanitized = sanitized.strip("_")
            # Ensure it starts with a letter or underscore
            if sanitized and not sanitized[0].isalpha():
                sanitized = "N" + sanitized
            return sanitized.upper() if sanitized else "UNKNOWN"
        
        # Helper function to escape quotes in labels
        def escape_label(text: str) -> str:
            """Escape special characters in Mermaid labels"""
            if not text:
                return ""
            # Escape quotes and backslashes
            return text.replace("\\", "\\\\").replace('"', '\\"')
        
        # Create agent node ID
        agent_id = sanitize_node_id(agent_name)
        
        # Use left-to-right layout with agent in center
        # Label agent as "Agent(agentname)" to make it clear
        agent_icon = "🤖"  # Robot icon for agent
        agent_label = f"{agent_icon} Agent({agent_name})"
        diagram_lines = [
            "graph LR",
            f'    {agent_id}["{escape_label(agent_label)}"]'
        ]
        
        # Track unique entities/systems
        source_nodes = {}  # Nodes on the left (sources)
        destination_nodes = {}  # Nodes on the right/bottom (downstream)
        edges = []
        
        for conn in connections:
            # Get connection details
            entity_name = conn.get("destination_system") or conn.get("app_name") or conn.get("name", "Unknown")
            source = conn.get("source_system", "Agent")
            direction = conn.get("data_flow_direction", "bidirectional")
            connection_name = conn.get("name", "")
            
            # Layout: Left (upstream/source) -> Center (agent) -> Right (downstream/destination)
            # For inbound: external system (left/upstream) -> agent (center) - data flows INTO agent
            # For outbound: agent (center) -> external system (right/downstream) - data flows OUT of agent
            
            # Identify which is the external system (not the agent)
            external_system_name = None
            external_system_id = None
            
            if source.lower() == "agent" or source == agent_name:
                # Source is agent, so external system is the entity/destination
                external_system_name = entity_name
                source_id = agent_id
            elif entity_name.lower() == "agent" or entity_name == agent_name:
                # Entity is agent, so external system is the source
                external_system_name = source
                source_id = sanitize_node_id(source)
            else:
                # Both might be external - determine based on direction
                external_system_name = source  # Default to source
                source_id = sanitize_node_id(source)
            
            # Determine entity_id
            if entity_name.lower() == "agent" or entity_name == agent_name:
                entity_id = agent_id
            else:
                entity_id = sanitize_node_id(entity_name)
            
            # For inbound: external system (upstream) -> agent
            # For outbound: agent -> external system (downstream)
            # Place external system on appropriate side
            if external_system_name and external_system_name.lower() != "agent" and external_system_name != agent_name:
                external_system_id = source_id if source_id != agent_id else entity_id
                
                if direction == "inbound":
                    # Inbound: external system is upstream (left side)
                    if external_system_name not in source_nodes:
                        source_nodes[external_system_name] = external_system_id
                elif direction == "outbound":
                    # Outbound: external system is downstream (right side)
                    if external_system_name not in destination_nodes:
                        destination_nodes[external_system_name] = external_system_id
                else:  # bidirectional
                    # Bidirectional: place on left as upstream
                    if external_system_name not in source_nodes:
                        source_nodes[external_system_name] = external_system_id
            
            # Use connection name as label if available
            label = ""
            if connection_name:
                escaped_label = escape_label(connection_name)
                label = f'|"{escaped_label}"|'
            
            # Create edge based on direction
            # Inbound: external (left) -> agent (center)
            # Outbound: agent (center) -> external (right)
            if direction == "bidirectional":
                if label:
                    edges.append(f'    {source_id} <-->{label} {entity_id}')
                else:
                    edges.append(f'    {source_id} <--> {entity_id}')
            elif direction == "inbound":
                # Inbound: external system (left) -> agent (center)
                # If source is agent, external is entity (swap)
                if source_id == agent_id:
                    # External system (entity) -> Agent
                    if label:
                        edges.append(f'    {entity_id} -->{label} {source_id}')
                    else:
                        edges.append(f'    {entity_id} --> {source_id}')
                else:
                    # External system (source) -> Agent (entity)
                    if label:
                        edges.append(f'    {source_id} -->{label} {entity_id}')
                    else:
                        edges.append(f'    {source_id} --> {entity_id}')
            elif direction == "outbound":
                # Outbound: agent (center) -> external system (right)
                if label:
                    edges.append(f'    {source_id} -->{label} {entity_id}')
                else:
                    edges.append(f'    {source_id} --> {entity_id}')
        
        # Add source nodes (left side) first with icons
        for source_name, source_id in source_nodes.items():
            icon = get_entity_icon(source_name)
            label = f"{icon} {source_name}"
            diagram_lines.append(f'    {source_id}["{escape_label(label)}"]')
        
        # Add destination nodes (right side) after agent with icons
        for dest_name, dest_id in destination_nodes.items():
            icon = get_entity_icon(dest_name)
            label = f"{icon} {dest_name}"
            diagram_lines.append(f'    {dest_id}["{escape_label(label)}"]')
        
        # Add all edges
        diagram_lines.extend(edges)
        
        return "\n".join(diagram_lines)
    
    @staticmethod
    def generate_diagram_description(agent_name: str, connections: List[Dict[str, Any]]) -> str:
        """
        Generate a text description of the connection diagram
        
        Args:
            agent_name: Name of the agent
            connections: List of connection dictionaries
        
        Returns:
            Human-readable description of connections
        """
        descriptions = []
        descriptions.append(f"{agent_name} connects to the following systems:")
        descriptions.append("")
        
        for conn in connections:
            app_name = conn.get("app_name", "Unknown System")
            direction = conn.get("data_flow_direction", "bidirectional")
            data_types = conn.get("data_types_exchanged", [])
            description = conn.get("description", "")
            source = conn.get("source_system")
            destination = conn.get("destination_system")
            
            conn_desc = f"• {app_name}"
            
            if source and destination:
                conn_desc += f": {source} → {destination}"
            elif source:
                conn_desc += f" (from {source})"
            elif destination:
                conn_desc += f" (to {destination})"
            
            if direction == "bidirectional":
                conn_desc += " (bidirectional)"
            elif direction == "inbound":
                conn_desc += " (inbound)"
            elif direction == "outbound":
                conn_desc += " (outbound)"
            
            if data_types:
                conn_desc += f" - Data: {', '.join(data_types)}"
            
            if description:
                conn_desc += f" - {description}"
            
            descriptions.append(conn_desc)
        
        return "\n".join(descriptions)

