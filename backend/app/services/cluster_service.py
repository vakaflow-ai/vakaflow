"""
Cluster node management and health check service
"""
import paramiko
import socket
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.cluster_node import ClusterNode, NodeStatus, NodeType, ClusterHealthCheck
from app.services.config_service import encrypt_secret, decrypt_secret

logger = logging.getLogger(__name__)


class ClusterService:
    """Service for managing cluster nodes and health checks"""
    
    @staticmethod
    def test_ssh_connection(
        hostname: str,
        ip_address: str,
        username: str,
        password: Optional[str] = None,
        ssh_key_path: Optional[str] = None,
        port: int = 22,
        timeout: int = 10
    ) -> Dict[str, Any]:
        """
        Test SSH connection to a node
        
        Returns:
            Dict with connection status and details
        """
        result = {
            "success": False,
            "error": None,
            "hostname": hostname,
            "ip": ip_address,
            "port": port,
            "connection_time": None
        }
        
        try:
            start_time = datetime.now()
            
            # Create SSH client
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Try to connect
            try:
                if ssh_key_path:
                    # Use SSH key
                    ssh.connect(
                        hostname=ip_address,
                        port=port,
                        username=username,
                        key_filename=ssh_key_path,
                        timeout=timeout,
                        look_for_keys=False,
                        allow_agent=False
                    )
                elif password:
                    # Use password
                    ssh.connect(
                        hostname=ip_address,
                        port=port,
                        username=username,
                        password=password,
                        timeout=timeout,
                        look_for_keys=False,
                        allow_agent=False
                    )
                else:
                    result["error"] = "No authentication method provided"
                    return result
                
                # Test connection by running a simple command
                stdin, stdout, stderr = ssh.exec_command("echo 'SSH connection successful'")
                exit_status = stdout.channel.recv_exit_status()
                
                if exit_status == 0:
                    result["success"] = True
                    result["connection_time"] = (datetime.now() - start_time).total_seconds()
                else:
                    result["error"] = f"Command execution failed with exit status {exit_status}"
                
                ssh.close()
                
            except paramiko.AuthenticationException:
                result["error"] = "Authentication failed - check username and password/key"
            except paramiko.SSHException as e:
                result["error"] = f"SSH error: {str(e)}"
            except socket.timeout:
                result["error"] = f"Connection timeout after {timeout} seconds"
            except socket.gaierror:
                result["error"] = f"Could not resolve hostname: {ip_address}"
            except Exception as e:
                result["error"] = f"Connection error: {str(e)}"
                
        except Exception as e:
            result["error"] = f"Unexpected error: {str(e)}"
            logger.error(f"SSH connection test failed for {ip_address}: {e}", exc_info=True)
        
        return result
    
    @staticmethod
    def check_node_health(
        node: ClusterNode,
        check_services: bool = True,
        check_resources: bool = True
    ) -> Dict[str, Any]:
        """
        Perform comprehensive health check on a node
        
        Returns:
            Dict with health check results
        """
        result = {
            "node_id": str(node.id),
            "hostname": node.hostname,
            "ip_address": node.ip_address,
            "status": NodeStatus.UNKNOWN.value,
            "ssh_connection": None,
            "services": {},
            "resources": {},
            "error": None,
            "checked_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Decrypt password if needed
            password = None
            if node.ssh_password:
                try:
                    password = decrypt_secret(node.ssh_password)
                except Exception as e:
                    logger.warning(f"Failed to decrypt password for node {node.hostname}: {e}")
                    result["error"] = "Failed to decrypt SSH password"
                    result["status"] = NodeStatus.UNKNOWN.value
                    return result
            
            # Test SSH connection
            ssh_result = ClusterService.test_ssh_connection(
                hostname=node.hostname,
                ip_address=node.ip_address,
                username=node.ssh_username,
                password=password,
                ssh_key_path=node.ssh_key_path,
                port=node.ssh_port
            )
            
            result["ssh_connection"] = ssh_result
            
            if not ssh_result["success"]:
                result["status"] = NodeStatus.OFFLINE.value
                result["error"] = ssh_result.get("error", "SSH connection failed")
                return result
            
            # If SSH successful, get detailed information
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            try:
                if node.ssh_key_path:
                    ssh.connect(
                        hostname=node.ip_address,
                        port=node.ssh_port,
                        username=node.ssh_username,
                        key_filename=node.ssh_key_path,
                        timeout=10
                    )
                else:
                    ssh.connect(
                        hostname=node.ip_address,
                        port=node.ssh_port,
                        username=node.ssh_username,
                        password=password,
                        timeout=10
                    )
                
                # Check system resources
                if check_resources:
                    # CPU usage
                    stdin, stdout, stderr = ssh.exec_command(
                        "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\([0-9.]*\)%* id.*/\\1/' | awk '{print 100 - $1}'"
                    )
                    cpu_output = stdout.read().decode().strip()
                    if cpu_output:
                        result["resources"]["cpu_usage"] = f"{cpu_output}%"
                    
                    # Memory usage
                    stdin, stdout, stderr = ssh.exec_command(
                        "free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'"
                    )
                    mem_output = stdout.read().decode().strip()
                    if mem_output:
                        result["resources"]["memory_usage"] = f"{mem_output}%"
                    
                    # Disk usage
                    stdin, stdout, stderr = ssh.exec_command(
                        "df -h / | awk 'NR==2 {print $5}' | sed 's/%//'"
                    )
                    disk_output = stdout.read().decode().strip()
                    if disk_output:
                        result["resources"]["disk_usage"] = f"{disk_output}%"
                    
                    # Uptime
                    stdin, stdout, stderr = ssh.exec_command("uptime -p")
                    uptime_output = stdout.read().decode().strip()
                    if uptime_output:
                        result["resources"]["uptime"] = uptime_output
                
                # Check services based on node type
                if check_services:
                    services_to_check = []
                    
                    if node.node_type == NodeType.APPLICATION:
                        services_to_check = ["nginx", "uwsgi", "gunicorn", "uvicorn"]
                    elif node.node_type == NodeType.DATABASE:
                        services_to_check = ["postgresql", "postgres"]
                    elif node.node_type == NodeType.REDIS:
                        services_to_check = ["redis", "redis-server"]
                    elif node.node_type == NodeType.QDRANT:
                        services_to_check = ["qdrant"]
                    
                    for service in services_to_check:
                        stdin, stdout, stderr = ssh.exec_command(
                            f"systemctl is-active {service} 2>/dev/null || service {service} status 2>/dev/null | grep -q running && echo active || echo inactive"
                        )
                        service_status = stdout.read().decode().strip()
                        result["services"][service] = "active" if "active" in service_status.lower() else "inactive"
                
                ssh.close()
                
                # Determine overall status
                if result["ssh_connection"]["success"]:
                    # Check if critical services are running
                    if check_services and result["services"]:
                        active_services = [s for s, status in result["services"].items() if status == "active"]
                        if active_services:
                            result["status"] = NodeStatus.HEALTHY.value
                        else:
                            result["status"] = NodeStatus.UNHEALTHY.value
                    else:
                        result["status"] = NodeStatus.HEALTHY.value
                else:
                    result["status"] = NodeStatus.OFFLINE.value
                    
            except Exception as e:
                result["error"] = f"Error during health check: {str(e)}"
                result["status"] = NodeStatus.UNHEALTHY.value
                logger.error(f"Health check error for node {node.hostname}: {e}", exc_info=True)
                
        except Exception as e:
            result["error"] = f"Health check failed: {str(e)}"
            result["status"] = NodeStatus.UNKNOWN.value
            logger.error(f"Health check failed for node {node.hostname}: {e}", exc_info=True)
        
        return result
    
    @staticmethod
    def update_node_health(
        db: Session,
        node: ClusterNode,
        health_result: Dict[str, Any]
    ) -> ClusterNode:
        """Update node with health check results"""
        node.status = NodeStatus(health_result["status"])
        node.last_health_check = datetime.utcnow()
        node.last_health_check_result = json.dumps(health_result)
        
        # Update metrics
        if "resources" in health_result:
            resources = health_result["resources"]
            node.cpu_usage = resources.get("cpu_usage")
            node.memory_usage = resources.get("memory_usage")
            node.disk_usage = resources.get("disk_usage")
            node.uptime = resources.get("uptime")
        
        # Update services status
        if "services" in health_result:
            node.services_status = json.dumps(health_result["services"])
        
        # Update error tracking
        if health_result.get("error"):
            node.error_count += 1
            node.last_error = health_result["error"]
            node.last_error_at = datetime.utcnow()
        else:
            node.error_count = 0
            node.last_error = None
        
        # Save health check history
        health_check = ClusterHealthCheck(
            node_id=node.id,
            status=NodeStatus(health_result["status"]),
            check_type="full",
            check_result=json.dumps(health_result),
            cpu_usage=health_result.get("resources", {}).get("cpu_usage"),
            memory_usage=health_result.get("resources", {}).get("memory_usage"),
            disk_usage=health_result.get("resources", {}).get("disk_usage"),
            uptime=health_result.get("resources", {}).get("uptime"),
            error_message=health_result.get("error")
        )
        db.add(health_check)
        
        db.commit()
        db.refresh(node)
        
        return node
    
    @staticmethod
    def check_all_nodes(db: Session) -> Dict[str, Any]:
        """Check health of all monitored nodes"""
        nodes = db.query(ClusterNode).filter(
            ClusterNode.is_active == True,
            ClusterNode.is_monitored == True
        ).all()
        
        results = {
            "total_nodes": len(nodes),
            "healthy": 0,
            "unhealthy": 0,
            "offline": 0,
            "unknown": 0,
            "nodes": []
        }
        
        for node in nodes:
            health_result = ClusterService.check_node_health(node)
            ClusterService.update_node_health(db, node, health_result)
            
            status = health_result["status"]
            if status == NodeStatus.HEALTHY.value:
                results["healthy"] += 1
            elif status == NodeStatus.UNHEALTHY.value:
                results["unhealthy"] += 1
            elif status == NodeStatus.OFFLINE.value:
                results["offline"] += 1
            else:
                results["unknown"] += 1
            
            results["nodes"].append({
                "id": str(node.id),
                "hostname": node.hostname,
                "status": status,
                "error": health_result.get("error")
            })
        
        return results
