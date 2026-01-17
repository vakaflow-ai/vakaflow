"""
Workflow Analytics Service
"""
import logging
from typing import Dict, List, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.workflow_config import WorkflowConfiguration, OnboardingRequest
from app.models.assessment import AssessmentAssignment
from app.models.agent import Agent
from app.models.product import Product
from app.models.service import Service
from app.models.vendor import Vendor

logger = logging.getLogger(__name__)


class WorkflowAnalyticsService:
    """Service for workflow analytics and reporting"""
    
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
    
    def get_workflow_performance_metrics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        entity_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get workflow performance metrics"""
        try:
            if not start_date:
                start_date = datetime.utcnow() - timedelta(days=30)
            if not end_date:
                end_date = datetime.utcnow()
            
            # Get all workflows
            workflows = self.db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == self.tenant_id,
                WorkflowConfiguration.status == "active"
            ).all()
            
            workflow_metrics = []
            
            for workflow in workflows:
                # Count onboarding requests for this workflow
                requests_query = self.db.query(OnboardingRequest).filter(
                    OnboardingRequest.workflow_config_id == workflow.id,
                    OnboardingRequest.created_at >= start_date,
                    OnboardingRequest.created_at <= end_date
                )
                
                total_requests = requests_query.count()
                approved = requests_query.filter(OnboardingRequest.status == "approved").count()
                rejected = requests_query.filter(OnboardingRequest.status == "rejected").count()
                pending = requests_query.filter(OnboardingRequest.status.in_(["pending", "in_review"])).count()
                
                # Calculate average time to completion
                completed_requests = requests_query.filter(
                    OnboardingRequest.status.in_(["approved", "rejected"]),
                    OnboardingRequest.approved_at.isnot(None) | OnboardingRequest.rejected_at.isnot(None)
                ).all()
                
                avg_completion_time = None
                if completed_requests:
                    completion_times = []
                    for req in completed_requests:
                        if req.approved_at:
                            completion_times.append((req.approved_at - req.created_at).total_seconds() / 3600)
                        elif req.rejected_at:
                            completion_times.append((req.rejected_at - req.created_at).total_seconds() / 3600)
                    
                    if completion_times:
                        avg_completion_time = sum(completion_times) / len(completion_times)
                
                workflow_metrics.append({
                    "workflow_id": str(workflow.id),
                    "workflow_name": workflow.name,
                    "total_requests": total_requests,
                    "approved": approved,
                    "rejected": rejected,
                    "pending": pending,
                    "approval_rate": (approved / total_requests * 100) if total_requests > 0 else 0,
                    "avg_completion_time_hours": avg_completion_time
                })
            
            return {
                "workflows": workflow_metrics,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting workflow performance metrics: {e}", exc_info=True)
            return {"workflows": [], "period": {}}
    
    def get_assessment_workflow_metrics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        entity_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get assessment workflow metrics"""
        try:
            if not start_date:
                start_date = datetime.utcnow() - timedelta(days=30)
            if not end_date:
                end_date = datetime.utcnow()
            
            query = self.db.query(AssessmentAssignment).filter(
                AssessmentAssignment.tenant_id == self.tenant_id,
                AssessmentAssignment.assigned_at >= start_date,
                AssessmentAssignment.assigned_at <= end_date
            )
            
            if entity_type:
                query = query.filter(AssessmentAssignment.entity_type == entity_type)
            
            assignments = query.all()
            
            total = len(assignments)
            completed = len([a for a in assignments if a.status == "completed"])
            in_progress = len([a for a in assignments if a.status == "in_progress"])
            pending = len([a for a in assignments if a.status == "pending"])
            overdue = len([a for a in assignments if a.status == "overdue"])
            
            # Calculate average completion time
            completed_assignments = [a for a in assignments if a.status == "completed" and a.completed_at]
            avg_completion_time = None
            if completed_assignments:
                completion_times = [
                    (a.completed_at - a.assigned_at).total_seconds() / 3600
                    for a in completed_assignments
                    if a.completed_at and a.assigned_at
                ]
                if completion_times:
                    avg_completion_time = sum(completion_times) / len(completion_times)
            
            # Group by entity type
            by_entity_type = {}
            for assignment in assignments:
                entity_type_val = assignment.entity_type or "unknown"
                if entity_type_val not in by_entity_type:
                    by_entity_type[entity_type_val] = {
                        "total": 0,
                        "completed": 0,
                        "in_progress": 0,
                        "pending": 0,
                        "overdue": 0
                    }
                by_entity_type[entity_type_val]["total"] += 1
                by_entity_type[entity_type_val][assignment.status] = (
                    by_entity_type[entity_type_val].get(assignment.status, 0) + 1
                )
            
            return {
                "total": total,
                "completed": completed,
                "in_progress": in_progress,
                "pending": pending,
                "overdue": overdue,
                "completion_rate": (completed / total * 100) if total > 0 else 0,
                "avg_completion_time_hours": avg_completion_time,
                "by_entity_type": by_entity_type,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting assessment workflow metrics: {e}", exc_info=True)
            return {
                "total": 0,
                "completed": 0,
                "in_progress": 0,
                "pending": 0,
                "overdue": 0,
                "completion_rate": 0,
                "avg_completion_time_hours": None,
                "by_entity_type": {},
                "period": {}
            }
    
    def get_workflow_bottlenecks(
        self,
        workflow_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Identify workflow bottlenecks"""
        try:
            # Get workflows
            if workflow_id:
                workflows = self.db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.id == workflow_id,
                    WorkflowConfiguration.tenant_id == self.tenant_id
                ).all()
            else:
                workflows = self.db.query(WorkflowConfiguration).filter(
                    WorkflowConfiguration.tenant_id == self.tenant_id,
                    WorkflowConfiguration.status == "active"
                ).all()
            
            bottlenecks = []
            
            for workflow in workflows:
                # Get requests stuck in review
                stuck_requests = self.db.query(OnboardingRequest).filter(
                    OnboardingRequest.workflow_config_id == workflow.id,
                    OnboardingRequest.status.in_(["pending", "in_review"]),
                    OnboardingRequest.created_at < datetime.utcnow() - timedelta(days=7)
                ).count()
                
                if stuck_requests > 0:
                    bottlenecks.append({
                        "workflow_id": str(workflow.id),
                        "workflow_name": workflow.name,
                        "stuck_requests": stuck_requests,
                        "issue": "Requests stuck in review for more than 7 days"
                    })
            
            return {
                "bottlenecks": bottlenecks,
                "total_bottlenecks": len(bottlenecks)
            }
            
        except Exception as e:
            logger.error(f"Error getting workflow bottlenecks: {e}", exc_info=True)
            return {"bottlenecks": [], "total_bottlenecks": 0}
    
    def get_workflow_summary(self) -> Dict[str, Any]:
        """Get overall workflow summary"""
        try:
            # Count active workflows
            active_workflows = self.db.query(WorkflowConfiguration).filter(
                WorkflowConfiguration.tenant_id == self.tenant_id,
                WorkflowConfiguration.status == "active"
            ).count()
            
            # Count total requests
            total_requests = self.db.query(OnboardingRequest).filter(
                OnboardingRequest.tenant_id == self.tenant_id
            ).count()
            
            # Count pending requests
            pending_requests = self.db.query(OnboardingRequest).filter(
                OnboardingRequest.tenant_id == self.tenant_id,
                OnboardingRequest.status.in_(["pending", "in_review"])
            ).count()
            
            # Count assessments
            total_assessments = self.db.query(AssessmentAssignment).filter(
                AssessmentAssignment.tenant_id == self.tenant_id
            ).count()
            
            pending_assessments = self.db.query(AssessmentAssignment).filter(
                AssessmentAssignment.tenant_id == self.tenant_id,
                AssessmentAssignment.status.in_(["pending", "in_progress"])
            ).count()
            
            return {
                "active_workflows": active_workflows,
                "total_requests": total_requests,
                "pending_requests": pending_requests,
                "total_assessments": total_assessments,
                "pending_assessments": pending_assessments
            }
            
        except Exception as e:
            logger.error(f"Error getting workflow summary: {e}", exc_info=True)
            return {
                "active_workflows": 0,
                "total_requests": 0,
                "pending_requests": 0,
                "total_assessments": 0,
                "pending_assessments": 0
            }
