"""
Agent connections API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.models.agent import Agent
from app.models.agent_connection import AgentConnection, ConnectionType, ConnectionProtocol
from app.models.user import User
from app.api.v1.auth import get_current_user
from app.services.connection_diagram_service import ConnectionDiagramService
from app.services.connection_framework_matcher import ConnectionFrameworkMatcher
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent-connections", tags=["agent-connections"])


class ConnectionCreate(BaseModel):
    """Connection creation schema"""
    name: str
    app_name: str
    app_type: str
    connection_type: str  # cloud, on_premise, hybrid, edge
    protocol: Optional[str] = None
    endpoint_url: Optional[str] = None
    authentication_method: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: bool = True
    is_required: bool = True
    is_encrypted: bool = True
    data_classification: Optional[str] = None
    compliance_requirements: Optional[List[str]] = None
    data_types_exchanged: Optional[List[str]] = None
    data_flow_direction: Optional[str] = None  # inbound, outbound, bidirectional
    data_format: Optional[str] = None
    data_volume: Optional[str] = None
    exchange_frequency: Optional[str] = None
    source_system: Optional[str] = None
    destination_system: Optional[str] = None
    data_schema: Optional[str] = None


class ConnectionUpdate(BaseModel):
    """Connection update schema"""
    name: Optional[str] = None
    app_name: Optional[str] = None
    app_type: Optional[str] = None
    connection_type: Optional[str] = None
    protocol: Optional[str] = None
    endpoint_url: Optional[str] = None
    authentication_method: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_required: Optional[bool] = None
    is_encrypted: Optional[bool] = None
    data_classification: Optional[str] = None
    compliance_requirements: Optional[List[str]] = None
    data_types_exchanged: Optional[List[str]] = None
    data_flow_direction: Optional[str] = None
    data_format: Optional[str] = None
    data_volume: Optional[str] = None
    exchange_frequency: Optional[str] = None
    source_system: Optional[str] = None
    destination_system: Optional[str] = None
    data_schema: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Connection response schema"""
    id: str
    agent_id: str
    name: str
    app_name: str
    app_type: str
    connection_type: str
    protocol: Optional[str] = None
    endpoint_url: Optional[str] = None
    authentication_method: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: bool
    is_required: bool
    is_encrypted: bool
    data_classification: Optional[str] = None
    compliance_requirements: Optional[List[str]] = None
    data_types_exchanged: Optional[List[str]] = None
    data_flow_direction: Optional[str] = None
    data_format: Optional[str] = None
    data_volume: Optional[str] = None
    exchange_frequency: Optional[str] = None
    source_system: Optional[str] = None
    destination_system: Optional[str] = None
    data_schema: Optional[str] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.post("/agents/{agent_id}/connections", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    agent_id: UUID,
    connection_data: ConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new connection for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check permissions (vendor can only add to their own agents)
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
    
    # Vendor users can only add connections to their own agents
    if current_user.role.value == "vendor_user":
        if not vendor or vendor.contact_email != current_user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only add connections to your own agents."
            )
    elif vendor and vendor.tenant_id != current_user.tenant_id:
        if current_user.role.value not in ["tenant_admin", "platform_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Create connection
    connection = AgentConnection(
        agent_id=agent_id,
        name=connection_data.name,
        app_name=connection_data.app_name,
        app_type=connection_data.app_type,
        connection_type=connection_data.connection_type,
        protocol=connection_data.protocol,
        endpoint_url=connection_data.endpoint_url,
        authentication_method=connection_data.authentication_method,
        description=connection_data.description,
        connection_metadata=connection_data.metadata,
        is_active=connection_data.is_active,
        is_required=connection_data.is_required,
        is_encrypted=connection_data.is_encrypted,
        data_classification=connection_data.data_classification,
        compliance_requirements=connection_data.compliance_requirements,
        data_types_exchanged=connection_data.data_types_exchanged,
        data_flow_direction=connection_data.data_flow_direction,
        data_format=connection_data.data_format,
        data_volume=connection_data.data_volume,
        exchange_frequency=connection_data.exchange_frequency,
        source_system=connection_data.source_system,
        destination_system=connection_data.destination_system,
        data_schema=connection_data.data_schema,
    )
    
    db.add(connection)
    db.commit()
    db.refresh(connection)
    
    return ConnectionResponse(
        id=str(connection.id),
        agent_id=str(connection.agent_id),
        name=connection.name,
        app_name=connection.app_name,
        app_type=connection.app_type,
        connection_type=connection.connection_type,
        protocol=connection.protocol,
        endpoint_url=connection.endpoint_url,
        authentication_method=connection.authentication_method,
        description=connection.description,
        metadata=connection.connection_metadata,
        is_active=connection.is_active,
        is_required=connection.is_required,
        is_encrypted=connection.is_encrypted,
        data_classification=connection.data_classification,
        compliance_requirements=connection.compliance_requirements,
        data_types_exchanged=connection.data_types_exchanged,
        data_flow_direction=connection.data_flow_direction,
        data_format=connection.data_format,
        data_volume=connection.data_volume,
        exchange_frequency=connection.exchange_frequency,
        source_system=connection.source_system,
        destination_system=connection.destination_system,
        data_schema=connection.data_schema,
        created_at=connection.created_at.isoformat(),
        updated_at=connection.updated_at.isoformat(),
    )


@router.get("/agents/{agent_id}/connections", response_model=List[ConnectionResponse])
async def list_connections(
    agent_id: UUID,
    connection_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all connections for an agent"""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Build query
    query = db.query(AgentConnection).filter(AgentConnection.agent_id == agent_id)
    
    # Apply filters
    if connection_type:
        query = query.filter(AgentConnection.connection_type == connection_type)
    if is_active is not None:
        query = query.filter(AgentConnection.is_active == is_active)
    
    connections = query.order_by(AgentConnection.created_at.desc()).all()
    
    return [
        ConnectionResponse(
            id=str(c.id),
            agent_id=str(c.agent_id),
            name=c.name,
            app_name=c.app_name,
            app_type=c.app_type,
            connection_type=c.connection_type,
            protocol=c.protocol,
            endpoint_url=c.endpoint_url,
            authentication_method=c.authentication_method,
            description=c.description,
            metadata=c.connection_metadata,
            is_active=c.is_active,
            is_required=c.is_required,
            is_encrypted=c.is_encrypted,
            data_classification=c.data_classification,
            compliance_requirements=c.compliance_requirements,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in connections
    ]


@router.get("/connections/{connection_id}", response_model=ConnectionResponse)
async def get_connection(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific connection"""
    connection = db.query(AgentConnection).filter(AgentConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    return ConnectionResponse(
        id=str(connection.id),
        agent_id=str(connection.agent_id),
        name=connection.name,
        app_name=connection.app_name,
        app_type=connection.app_type,
        connection_type=connection.connection_type,
        protocol=connection.protocol,
        endpoint_url=connection.endpoint_url,
        authentication_method=connection.authentication_method,
        description=connection.description,
        metadata=connection.connection_metadata,
        is_active=connection.is_active,
        is_required=connection.is_required,
        is_encrypted=connection.is_encrypted,
        data_classification=connection.data_classification,
        compliance_requirements=connection.compliance_requirements,
        data_types_exchanged=connection.data_types_exchanged,
        data_flow_direction=connection.data_flow_direction,
        data_format=connection.data_format,
        data_volume=connection.data_volume,
        exchange_frequency=connection.exchange_frequency,
        source_system=connection.source_system,
        destination_system=connection.destination_system,
        data_schema=connection.data_schema,
        created_at=connection.created_at.isoformat(),
        updated_at=connection.updated_at.isoformat(),
    )


@router.put("/connections/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: UUID,
    connection_data: ConnectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a connection"""
    connection = db.query(AgentConnection).filter(AgentConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Check permissions
    from app.models.vendor import Vendor
    agent = db.query(Agent).filter(Agent.id == connection.agent_id).first()
    if agent:
        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
        if vendor and vendor.tenant_id != current_user.tenant_id:
            if current_user.role.value not in ["tenant_admin", "platform_admin"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
    
    # Update fields
    if connection_data.name is not None:
        connection.name = connection_data.name
    if connection_data.app_name is not None:
        connection.app_name = connection_data.app_name
    if connection_data.app_type is not None:
        connection.app_type = connection_data.app_type
    if connection_data.connection_type is not None:
        connection.connection_type = connection_data.connection_type
    if connection_data.protocol is not None:
        connection.protocol = connection_data.protocol
    if connection_data.endpoint_url is not None:
        connection.endpoint_url = connection_data.endpoint_url
    if connection_data.authentication_method is not None:
        connection.authentication_method = connection_data.authentication_method
    if connection_data.description is not None:
        connection.description = connection_data.description
    if connection_data.metadata is not None:
        connection.connection_metadata = connection_data.metadata
    if connection_data.is_active is not None:
        connection.is_active = connection_data.is_active
    if connection_data.is_required is not None:
        connection.is_required = connection_data.is_required
    if connection_data.is_encrypted is not None:
        connection.is_encrypted = connection_data.is_encrypted
    if connection_data.data_classification is not None:
        connection.data_classification = connection_data.data_classification
    if connection_data.compliance_requirements is not None:
        connection.compliance_requirements = connection_data.compliance_requirements
    
    db.commit()
    db.refresh(connection)
    
    return ConnectionResponse(
        id=str(connection.id),
        agent_id=str(connection.agent_id),
        name=connection.name,
        app_name=connection.app_name,
        app_type=connection.app_type,
        connection_type=connection.connection_type,
        protocol=connection.protocol,
        endpoint_url=connection.endpoint_url,
        authentication_method=connection.authentication_method,
        description=connection.description,
        metadata=connection.connection_metadata,
        is_active=connection.is_active,
        is_required=connection.is_required,
        is_encrypted=connection.is_encrypted,
        data_classification=connection.data_classification,
        compliance_requirements=connection.compliance_requirements,
        data_types_exchanged=connection.data_types_exchanged,
        data_flow_direction=connection.data_flow_direction,
        data_format=connection.data_format,
        data_volume=connection.data_volume,
        exchange_frequency=connection.exchange_frequency,
        source_system=connection.source_system,
        destination_system=connection.destination_system,
        data_schema=connection.data_schema,
        created_at=connection.created_at.isoformat(),
        updated_at=connection.updated_at.isoformat(),
    )


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a connection"""
    connection = db.query(AgentConnection).filter(AgentConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Check permissions
    from app.models.vendor import Vendor
    agent = db.query(Agent).filter(Agent.id == connection.agent_id).first()
    if agent:
        vendor = db.query(Vendor).filter(Vendor.id == agent.vendor_id).first()
        if vendor and vendor.tenant_id != current_user.tenant_id:
            if current_user.role.value not in ["tenant_admin", "platform_admin"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
    
    db.delete(connection)
    db.commit()
    
    return None


class DiagramRequest(BaseModel):
    """Request schema for diagram generation"""
    agent_name: str
    connections: List[ConnectionCreate]


@router.post("/generate-diagram")
async def generate_connection_diagram(
    request: DiagramRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a connection diagram from agent connections"""
    try:
        # Convert connections to dict format
        connections_dict = []
        for conn in request.connections:
            if isinstance(conn, dict):
                connections_dict.append(conn)
            else:
                connections_dict.append(conn.dict() if hasattr(conn, 'dict') else conn)
        
        # Generate Mermaid diagram
        mermaid_diagram = ConnectionDiagramService.generate_mermaid_diagram(
            request.agent_name, 
            connections_dict
        )
        
        # Generate text description
        text_description = ConnectionDiagramService.generate_diagram_description(
            request.agent_name,
            connections_dict
        )
        
        return {
            "mermaid_diagram": mermaid_diagram,
            "text_description": text_description,
            "format": "mermaid"
        }
    except Exception as e:
        logger.error(f"Error generating diagram: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate diagram: {str(e)}"
        )


class FrameworkRecommendationRequest(BaseModel):
    """Request schema for framework recommendations"""
    connections: List[ConnectionCreate]
    agent_category: Optional[str] = None
    agent_subcategory: Optional[str] = None


@router.post("/framework-recommendations")
async def get_framework_recommendations(
    request: FrameworkRecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get compliance framework recommendations based on connections"""
    try:
        # Convert connections to dict format
        connections_dict = []
        for conn in request.connections:
            if isinstance(conn, dict):
                connections_dict.append(conn)
            else:
                connections_dict.append(conn.dict() if hasattr(conn, 'dict') else conn)
        
        # Get framework recommendations
        recommendations = ConnectionFrameworkMatcher.get_framework_recommendations(
            connections_dict,
            request.agent_category,
            request.agent_subcategory,
            db
        )
        
        return recommendations
    except Exception as e:
        logger.error(f"Error getting framework recommendations: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get framework recommendations: {str(e)}"
        )

