"""
Export functionality API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
import csv
import io
import json
from app.core.database import get_db
from app.models.user import User
from app.models.agent import Agent
from app.models.audit import AuditLog
from app.models.review import Review
from app.models.policy import ComplianceCheck, Policy
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/agents")
async def export_agents(
    format: str = Query("csv", pattern="^(csv|json)$"),
    status_filter: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export agents data"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can export data"
        )
    
    # Tenant isolation - ALL users (including platform_admin) must have tenant_id
    # Platform admins without tenant_id use the default platform admin tenant
    from app.core.tenant_utils import get_effective_tenant_id
    effective_tenant_id = get_effective_tenant_id(current_user, db)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a tenant to export agents"
        )
    
    # Build query
    query = db.query(Agent)
    
    # Filter by tenant - ALL users must filter by tenant
    from app.models.vendor import Vendor
    vendors = db.query(Vendor).filter(Vendor.tenant_id == effective_tenant_id).all()
    vendor_ids = [v.id for v in vendors]
    if vendor_ids:
        query = query.filter(Agent.vendor_id.in_(vendor_ids))
    else:
        # No vendors in tenant, return empty export
        agents = []
        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "ID", "Name", "Type", "Category", "Version", "Status",
                "Compliance Score", "Risk Score", "Created At", "Updated At"
            ])
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=agents_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"}
            )
        else:
            return JSONResponse(content={"agents": []})
    
    # Apply filters
    if status_filter:
        query = query.filter(Agent.status == status_filter)
    
    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(Agent.created_at >= start)
    
    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(Agent.created_at <= end)
    
    agents = query.all()
    
    if format == "csv":
        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID", "Name", "Type", "Category", "Version", "Status",
            "Compliance Score", "Risk Score", "Created At", "Updated At"
        ])
        
        # Data
        for agent in agents:
            writer.writerow([
                str(agent.id),
                agent.name,
                agent.type,
                agent.category or "",
                agent.version,
                agent.status,
                agent.compliance_score or "",
                agent.risk_score or "",
                agent.created_at.isoformat() if agent.created_at else "",
                agent.updated_at.isoformat() if agent.updated_at else ""
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=agents_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    
    else:  # JSON
        data = [
            {
                "id": str(agent.id),
                "name": agent.name,
                "type": agent.type,
                "category": agent.category,
                "version": agent.version,
                "status": agent.status,
                "compliance_score": agent.compliance_score,
                "risk_score": agent.risk_score,
                "created_at": agent.created_at.isoformat() if agent.created_at else None,
                "updated_at": agent.updated_at.isoformat() if agent.updated_at else None
            }
            for agent in agents
        ]
        
        return JSONResponse(
            content={"agents": data, "count": len(data)},
            headers={"Content-Disposition": f"attachment; filename=agents_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
        )


@router.get("/audit-logs")
async def export_audit_logs(
    format: str = Query("csv", pattern="^(csv|json)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    action_filter: Optional[str] = None,
    resource_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export audit logs"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can export audit logs"
        )
    
    # Build query
    query = db.query(AuditLog)
    
    # Filter by tenant
    if current_user.tenant_id:
        query = query.filter(AuditLog.tenant_id == current_user.tenant_id)
    
    # Apply filters
    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(AuditLog.timestamp >= start)
    
    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(AuditLog.timestamp <= end)
    
    if action_filter:
        query = query.filter(AuditLog.action == action_filter)
    
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    logs = query.order_by(AuditLog.timestamp.desc()).limit(10000).all()  # Limit to 10k records
    
    if format == "csv":
        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID", "User ID", "Action", "Resource Type", "Resource ID",
            "Timestamp", "IP Address", "User Agent", "Details"
        ])
        
        # Data
        for log in logs:
            writer.writerow([
                str(log.id),
                log.user_id,
                log.action,
                log.resource_type or "",
                log.resource_id or "",
                log.timestamp.isoformat() if log.timestamp else "",
                log.ip_address or "",
                log.user_agent or "",
                json.dumps(log.details) if log.details else ""
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    
    else:  # JSON
        data = [
            {
                "id": str(log.id),
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "details": log.details
            }
            for log in logs
        ]
        
        return JSONResponse(
            content={"audit_logs": data, "count": len(data)},
            headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
        )


@router.get("/reports/compliance")
async def export_compliance_report(
    format: str = Query("csv", pattern="^(csv|json)$"),
    agent_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export compliance report"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin", "compliance_reviewer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build query with join to Policy
    query = db.query(ComplianceCheck, Policy).join(Policy, ComplianceCheck.policy_id == Policy.id)
    
    if agent_id:
        query = query.filter(ComplianceCheck.agent_id == agent_id)
    
    # Filter by tenant
    if current_user.tenant_id:
        from app.models.vendor import Vendor
        vendor_ids = db.query(Vendor.id).filter(Vendor.tenant_id == current_user.tenant_id).subquery()
        agent_ids = db.query(Agent.id).filter(Agent.vendor_id.in_(db.query(vendor_ids.c.id))).subquery()
        query = query.filter(ComplianceCheck.agent_id.in_(db.query(agent_ids.c.id)))
    
    results = query.all()
    
    # Helper function to extract issue description
    def get_issue_description(check: ComplianceCheck) -> str:
        """Extract issue description from check details or rag_context"""
        if check.details:
            return check.details
        if check.rag_context and isinstance(check.rag_context, dict):
            return check.rag_context.get("gap_description", "") or check.rag_context.get("details", "") or ""
        return ""
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "ID", "Agent ID", "Policy Name", "Status", "Confidence Score",
            "Checked At", "Issue Description"
        ])
        
        for check, policy in results:
            writer.writerow([
                str(check.id),
                str(check.agent_id),
                policy.name if policy else "Unknown Policy",
                check.status,
                str(check.confidence_score) if check.confidence_score else "",
                check.checked_at.isoformat() if check.checked_at else "",
                get_issue_description(check)
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=compliance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    
    else:  # JSON
        data = [
            {
                "id": str(check.id),
                "agent_id": str(check.agent_id),
                "policy_id": str(check.policy_id),
                "policy_name": policy.name if policy else "Unknown Policy",
                "status": check.status,
                "check_type": check.check_type,
                "confidence_score": float(check.confidence_score) if check.confidence_score else None,
                "checked_at": check.checked_at.isoformat() if check.checked_at else None,
                "issue_description": get_issue_description(check),
                "details": check.details,
                "notes": check.notes
            }
            for check, policy in results
        ]
        
        return JSONResponse(
            content={"compliance_checks": data, "count": len(data)},
            headers={"Content-Disposition": f"attachment; filename=compliance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
        )


@router.get("/flow-executions")
async def export_flow_executions(
    format: str = Query("csv", pattern="^(csv|json)$"),
    flow_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export flow execution history"""
    # Check permissions
    if current_user.role.value not in ["tenant_admin", "platform_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can export flow executions"
        )
    
    from app.models.agentic_flow import FlowExecution, FlowNodeExecution
    
    # Build query
    query = db.query(FlowExecution)
    
    # Filter by tenant
    if current_user.tenant_id:
        query = query.filter(FlowExecution.tenant_id == current_user.tenant_id)
    
    # Apply filters
    if flow_id:
        query = query.filter(FlowExecution.flow_id == flow_id)
    
    if status_filter:
        query = query.filter(FlowExecution.status == status_filter)
    
    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(FlowExecution.created_at >= start)
    
    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(FlowExecution.created_at <= end)
    
    executions = query.order_by(FlowExecution.created_at.desc()).limit(10000).all()
    
    if format == "csv":
        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Execution ID", "Flow ID", "Status", "Context ID", "Context Type",
            "Started At", "Completed At", "Duration (seconds)", "Error Message",
            "Total Nodes", "Completed Nodes", "Failed Nodes"
        ])
        
        # Data
        for exec in executions:
            # Get node execution summary
            node_executions = db.query(FlowNodeExecution).filter(
                FlowNodeExecution.execution_id == exec.id
            ).all()
            
            completed_nodes = len([ne for ne in node_executions if ne.status == "completed"])
            failed_nodes = len([ne for ne in node_executions if ne.status == "failed"])
            
            writer.writerow([
                str(exec.id),
                str(exec.flow_id),
                exec.status,
                exec.context_id or "",
                exec.context_type or "",
                exec.started_at.isoformat() if exec.started_at else "",
                exec.completed_at.isoformat() if exec.completed_at else "",
                exec.duration_seconds or "",
                exec.error_message or "",
                len(node_executions),
                completed_nodes,
                failed_nodes
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=flow_executions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    
    else:  # JSON
        data = []
        for exec in executions:
            # Get node executions
            node_executions = db.query(FlowNodeExecution).filter(
                FlowNodeExecution.execution_id == exec.id
            ).all()
            
            data.append({
                "id": str(exec.id),
                "flow_id": str(exec.flow_id),
                "status": exec.status,
                "context_id": exec.context_id,
                "context_type": exec.context_type,
                "current_node_id": exec.current_node_id,
                "error_message": exec.error_message,
                "started_at": exec.started_at.isoformat() if exec.started_at else None,
                "completed_at": exec.completed_at.isoformat() if exec.completed_at else None,
                "duration_seconds": exec.duration_seconds,
                "created_at": exec.created_at.isoformat() if exec.created_at else None,
                "triggered_by": str(exec.triggered_by) if exec.triggered_by else None,
                "node_executions": [
                    {
                        "id": str(ne.id),
                        "node_id": ne.node_id,
                        "status": ne.status,
                        "skill_used": ne.skill_used,
                        "agent_id": str(ne.agent_id) if ne.agent_id else None,
                        "started_at": ne.started_at.isoformat() if ne.started_at else None,
                        "completed_at": ne.completed_at.isoformat() if ne.completed_at else None,
                        "duration_ms": ne.duration_ms,
                        "error_message": ne.error_message
                    }
                    for ne in node_executions
                ]
            })
        
        return JSONResponse(
            content={"flow_executions": data, "count": len(data)},
            headers={"Content-Disposition": f"attachment; filename=flow_executions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"}
        )

