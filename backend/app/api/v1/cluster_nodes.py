"""
Cluster node management API endpoints
"""
import json
import logging
import socket
import os
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from app.core.database import get_db
from app.models.user import User
from app.models.cluster_node import ClusterNode, NodeStatus, NodeType, NodeRole, ClusterHealthCheck
from app.api.v1.auth import get_current_user
from app.api.v1.tenants import require_platform_admin
from app.services.cluster_service import ClusterService
from app.services.config_service import encrypt_secret

logger = logging.getLogger(__name__)


def get_current_node_info() -> Dict[str, str]:
    """Get current server hostname and IP address"""
    try:
        hostname = socket.gethostname()
        # Get IP address
        try:
            # Try to get IP by connecting to external address
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_address = s.getsockname()[0]
            s.close()
        except Exception:
            # Fallback to localhost
            ip_address = socket.gethostbyname(hostname)
            if ip_address == "127.0.0.1":
                ip_address = os.getenv("SERVER_IP", "127.0.0.1")
        
        return {
            "hostname": hostname,
            "ip_address": ip_address
        }
    except Exception as e:
        logger.warning(f"Failed to get current node info: {e}")
        return {
            "hostname": os.getenv("HOSTNAME", "localhost"),
            "ip_address": os.getenv("SERVER_IP", "127.0.0.1")
        }

router = APIRouter(prefix="/cluster-nodes", tags=["cluster-nodes"])


class ClusterNodeCreate(BaseModel):
    """Create cluster node request"""
    hostname: str = Field(..., description="Node hostname")
    ip_address: str = Field(..., description="Node IP address")
    node_type: str = Field(..., description="Node type (application, database, redis, qdrant, etc.)")
    ssh_username: str = Field(..., description="SSH username")
    ssh_password: Optional[str] = Field(None, description="SSH password (will be encrypted)")
    ssh_port: int = Field(22, description="SSH port")
    ssh_key_path: Optional[str] = Field(None, description="Path to SSH key file (optional)")
    description: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None
    is_monitored: bool = Field(True, description="Enable health monitoring")


class ClusterNodeUpdate(BaseModel):
    """Update cluster node request"""
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    node_type: Optional[str] = None
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_key_path: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_monitored: Optional[bool] = None
    node_role: Optional[str] = None  # "primary" or "secondary"


class ClusterNodeResponse(BaseModel):
    """Cluster node response"""
    id: str
    hostname: str
    ip_address: str
    node_type: str
    ssh_username: str
    ssh_port: int
    description: Optional[str]
    location: Optional[str]
    tags: Optional[List[str]]
    status: str
    last_health_check: Optional[str]
    cpu_usage: Optional[str]
    memory_usage: Optional[str]
    disk_usage: Optional[str]
    uptime: Optional[str]
    services_status: Optional[Dict[str, Any]]
    error_count: int
    last_error: Optional[str]
    is_active: bool
    is_monitored: bool
    is_current_node: bool
    node_role: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


@router.post("", response_model=ClusterNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_cluster_node(
    node_data: ClusterNodeCreate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Create a new cluster node (Platform Admin only)"""
    # Validate node type
    try:
        node_type = NodeType(node_data.node_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node type: {node_data.node_type}"
        )
    
    # Check if hostname already exists
    existing = db.query(ClusterNode).filter(
        ClusterNode.hostname == node_data.hostname
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Node with hostname '{node_data.hostname}' already exists"
        )
    
    # Encrypt password if provided
    encrypted_password = None
    if node_data.ssh_password:
        encrypted_password = encrypt_secret(node_data.ssh_password)
    
    # Create node
    node = ClusterNode(
        hostname=node_data.hostname,
        ip_address=node_data.ip_address,
        node_type=node_type,
        ssh_username=node_data.ssh_username,
        ssh_password=encrypted_password,
        ssh_port=node_data.ssh_port,
        ssh_key_path=node_data.ssh_key_path,
        description=node_data.description,
        location=node_data.location,
        tags=json.dumps(node_data.tags) if node_data.tags else None,
        is_monitored=node_data.is_monitored,
        created_by=current_user.id
    )
    
    db.add(node)
    db.commit()
    db.refresh(node)
    
    # Perform initial health check
    try:
        health_result = ClusterService.check_node_health(node)
        ClusterService.update_node_health(db, node, health_result)
    except Exception as e:
        logger.warning(f"Initial health check failed for node {node.hostname}: {e}")
    
    return node


@router.get("", response_model=List[ClusterNodeResponse])
async def list_cluster_nodes(
    node_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
    request: Request = None
):
    """List all cluster nodes (Platform Admin only)"""
    # Get current node info
    current_node_info = get_current_node_info()
    
    # Ensure current node exists in database
    current_node = db.query(ClusterNode).filter(
        ClusterNode.hostname == current_node_info["hostname"]
    ).first()
    
    if not current_node:
        # Auto-create current node
        logger.info(f"Auto-creating current node: {current_node_info['hostname']}")
        current_node = ClusterNode(
            hostname=current_node_info["hostname"],
            ip_address=current_node_info["ip_address"],
            node_type=NodeType.APPLICATION,
            ssh_username="admin",  # Default, can be updated
            is_current_node=True,
            is_active=True,
            is_monitored=True,
            status=NodeStatus.HEALTHY,
            created_by=current_user.id
        )
        db.add(current_node)
        db.commit()
        db.refresh(current_node)
    else:
        # Update is_current_node flag
        if not current_node.is_current_node:
            # Clear other current nodes
            db.query(ClusterNode).filter(ClusterNode.is_current_node == True).update({"is_current_node": False})
            current_node.is_current_node = True
            db.commit()
    
    query = db.query(ClusterNode)
    
    if node_type:
        try:
            query = query.filter(ClusterNode.node_type == NodeType(node_type))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid node type: {node_type}"
            )
    
    if status_filter:
        try:
            query = query.filter(ClusterNode.status == NodeStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )
    
    if is_active is not None:
        query = query.filter(ClusterNode.is_active == is_active)
    
    nodes = query.order_by(ClusterNode.created_at.desc()).all()
    
    # Parse JSON fields
    result = []
    for node in nodes:
        node_dict = {
            "id": str(node.id),
            "hostname": node.hostname,
            "ip_address": node.ip_address,
            "node_type": node.node_type.value,
            "ssh_username": node.ssh_username,
            "ssh_port": node.ssh_port,
            "description": node.description,
            "location": node.location,
            "tags": json.loads(node.tags) if node.tags else None,
            "status": node.status.value,
            "last_health_check": node.last_health_check.isoformat() if node.last_health_check else None,
            "cpu_usage": node.cpu_usage,
            "memory_usage": node.memory_usage,
            "disk_usage": node.disk_usage,
            "uptime": node.uptime,
            "services_status": json.loads(node.services_status) if node.services_status else None,
            "error_count": node.error_count,
            "last_error": node.last_error,
            "is_active": node.is_active,
            "is_monitored": node.is_monitored,
            "is_current_node": node.is_current_node,
            "node_role": node.node_role.value if node.node_role else None,
            "created_at": node.created_at.isoformat(),
            "updated_at": node.updated_at.isoformat()
        }
        result.append(node_dict)
    
    return result


@router.get("/{node_id}", response_model=ClusterNodeResponse)
async def get_cluster_node(
    node_id: UUID,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get cluster node details (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    return {
        "id": str(node.id),
        "hostname": node.hostname,
        "ip_address": node.ip_address,
        "node_type": node.node_type.value,
        "ssh_username": node.ssh_username,
        "ssh_port": node.ssh_port,
        "description": node.description,
        "location": node.location,
        "tags": json.loads(node.tags) if node.tags else None,
        "status": node.status.value,
        "last_health_check": node.last_health_check.isoformat() if node.last_health_check else None,
        "cpu_usage": node.cpu_usage,
        "memory_usage": node.memory_usage,
        "disk_usage": node.disk_usage,
        "uptime": node.uptime,
        "services_status": json.loads(node.services_status) if node.services_status else None,
        "error_count": node.error_count,
        "last_error": node.last_error,
        "is_active": node.is_active,
        "is_monitored": node.is_monitored,
        "created_at": node.created_at.isoformat(),
        "updated_at": node.updated_at.isoformat()
    }


@router.put("/{node_id}", response_model=ClusterNodeResponse)
async def update_cluster_node(
    node_id: UUID,
    node_data: ClusterNodeUpdate,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Update cluster node (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    # Update fields
    if node_data.hostname is not None:
        # Check if new hostname already exists
        existing = db.query(ClusterNode).filter(
            ClusterNode.hostname == node_data.hostname,
            ClusterNode.id != node_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Node with hostname '{node_data.hostname}' already exists"
            )
        node.hostname = node_data.hostname
    
    if node_data.ip_address is not None:
        node.ip_address = node_data.ip_address
    
    if node_data.node_type is not None:
        try:
            node.node_type = NodeType(node_data.node_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid node type: {node_data.node_type}"
            )
    
    if node_data.ssh_username is not None:
        node.ssh_username = node_data.ssh_username
    
    if node_data.ssh_password is not None:
        node.ssh_password = encrypt_secret(node_data.ssh_password)
    
    if node_data.ssh_port is not None:
        node.ssh_port = node_data.ssh_port
    
    if node_data.ssh_key_path is not None:
        node.ssh_key_path = node_data.ssh_key_path
    
    if node_data.description is not None:
        node.description = node_data.description
    
    if node_data.location is not None:
        node.location = node_data.location
    
    if node_data.tags is not None:
        node.tags = json.dumps(node_data.tags)
    
    if node_data.is_active is not None:
        node.is_active = node_data.is_active
    
    if node_data.is_monitored is not None:
        node.is_monitored = node_data.is_monitored
    
    if node_data.node_role is not None:
        try:
            node.node_role = NodeRole(node_data.node_role)
            # If setting as primary, unset other primary nodes
            if node.node_role == NodeRole.PRIMARY:
                db.query(ClusterNode).filter(
                    ClusterNode.node_role == NodeRole.PRIMARY,
                    ClusterNode.id != node_id
                ).update({"node_role": NodeRole.SECONDARY})
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid node role: {node_data.node_role}. Must be 'primary' or 'secondary'"
            )
    
    node.updated_by = current_user.id
    node.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(node)
    
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cluster_node(
    node_id: UUID,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Delete cluster node (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    db.delete(node)
    db.commit()
    
    return None


@router.post("/{node_id}/health-check", response_model=Dict[str, Any])
async def check_node_health(
    node_id: UUID,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Perform health check on a specific node (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    health_result = ClusterService.check_node_health(node)
    ClusterService.update_node_health(db, node, health_result)
    
    return health_result


@router.post("/health-check/all", response_model=Dict[str, Any])
async def check_all_nodes_health(
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Check health of all monitored nodes (Platform Admin only)"""
    results = ClusterService.check_all_nodes(db)
    return results


@router.get("/{node_id}/health-history", response_model=List[Dict[str, Any]])
async def get_node_health_history(
    node_id: UUID,
    limit: int = 50,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Get health check history for a node (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    health_checks = db.query(ClusterHealthCheck).filter(
        ClusterHealthCheck.node_id == node_id
    ).order_by(ClusterHealthCheck.checked_at.desc()).limit(limit).all()
    
    return [
        {
            "id": str(check.id),
            "status": check.status.value,
            "check_type": check.check_type,
            "check_result": json.loads(check.check_result) if check.check_result else None,
            "cpu_usage": check.cpu_usage,
            "memory_usage": check.memory_usage,
            "disk_usage": check.disk_usage,
            "uptime": check.uptime,
            "error_message": check.error_message,
            "checked_at": check.checked_at.isoformat()
        }
        for check in health_checks
    ]


@router.post("/{node_id}/test-connection", response_model=Dict[str, Any])
async def test_ssh_connection(
    node_id: UUID,
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Test SSH connection to a node (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    # Decrypt password
    from app.services.config_service import decrypt_secret
    password = None
    if node.ssh_password:
        try:
            password = decrypt_secret(node.ssh_password)
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to decrypt password: {str(e)}"
            }
    
    result = ClusterService.test_ssh_connection(
        hostname=node.hostname,
        ip_address=node.ip_address,
        username=node.ssh_username,
        password=password,
        ssh_key_path=node.ssh_key_path,
        port=node.ssh_port
    )
    
    return result


@router.post("/{node_id}/set-role", response_model=ClusterNodeResponse)
async def set_node_role(
    node_id: UUID,
    role: str = Query(..., description="Node role: 'primary' or 'secondary'"),
    current_user: User = Depends(require_platform_admin),
    db: Session = Depends(get_db)
):
    """Set node role as primary or secondary (Platform Admin only)"""
    node = db.query(ClusterNode).filter(ClusterNode.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cluster node not found"
        )
    
    try:
        node_role = NodeRole(role.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node role: {role}. Must be 'primary' or 'secondary'"
        )
    
    # If setting as primary, unset other primary nodes
    if node_role == NodeRole.PRIMARY:
        db.query(ClusterNode).filter(
            ClusterNode.node_role == NodeRole.PRIMARY,
            ClusterNode.id != node_id
        ).update({"node_role": NodeRole.SECONDARY})
    
    node.node_role = node_role
    node.updated_by = current_user.id
    node.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(node)
    
    return {
        "id": str(node.id),
        "hostname": node.hostname,
        "ip_address": node.ip_address,
        "node_type": node.node_type.value,
        "ssh_username": node.ssh_username,
        "ssh_port": node.ssh_port,
        "description": node.description,
        "location": node.location,
        "tags": json.loads(node.tags) if node.tags else None,
        "status": node.status.value,
        "last_health_check": node.last_health_check.isoformat() if node.last_health_check else None,
        "cpu_usage": node.cpu_usage,
        "memory_usage": node.memory_usage,
        "disk_usage": node.disk_usage,
        "uptime": node.uptime,
        "services_status": json.loads(node.services_status) if node.services_status else None,
        "error_count": node.error_count,
        "last_error": node.last_error,
        "is_active": node.is_active,
        "is_monitored": node.is_monitored,
        "is_current_node": node.is_current_node,
        "node_role": node.node_role.value if node.node_role else None,
        "created_at": node.created_at.isoformat(),
        "updated_at": node.updated_at.isoformat()
    }
