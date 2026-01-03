"""
Action Item Service - Aggregates and manages action items for user inbox
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, case

from app.models.action_item import ActionItem, ActionItemType, ActionItemStatus, ActionItemPriority
from app.models.approval import ApprovalStep, ApprovalInstance
from app.models.assessment import AssessmentAssignment
from app.models.workflow_config import OnboardingRequest, WorkflowConfiguration
from app.models.ticket import Ticket
from app.models.message import Message, MessageType
from app.models.user import User as UserModel
from app.models.vendor import Vendor
from app.models.assessment import Assessment
from app.models.agent import Agent

import logging

logger = logging.getLogger(__name__)


class ActionItemService:
    """Service for managing action items"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_default_tenant_id(self) -> Optional[UUID]:
        """Get default tenant ID for platform admin users"""
        from app.models.tenant import Tenant
        default_tenant = self.db.query(Tenant).filter(
            Tenant.slug == "default"
        ).first()
        return default_tenant.id if default_tenant else None
    
    def get_user_inbox(
        self,
        user_id: UUID,
        tenant_id: Optional[UUID],
        status: Optional[str] = None,
        action_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        user_role: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get all action items for a user (aggregated from various sources)

        Args:
            user_id: User UUID
            tenant_id: Tenant UUID (None for platform_admin without tenant)
            status: Filter by status (pending, completed, overdue)
            action_type: Filter by action type
            limit: Maximum items to return
            offset: Offset for pagination

        Returns:
            Dictionary with pending, completed, and overdue items
        """
        action_items = []

        # If no tenant_id, use default tenant for platform_admin users
        if tenant_id is None:
            tenant_id = self._get_default_tenant_id()
            # If still None, return empty results
            if tenant_id is None:
                return {
                    "items": [],
                    "pending": [],
                    "completed": [],
                    "overdue": [],
                    "total": 0,
                    "pending_count": 0,
                    "completed_count": 0,
                    "overdue_count": 0
                }

        # 1. Get pending approval steps with optimized queries
        # Admins can see all approval steps in their tenant
        # Optimize: Use single query with conditional filter and apply limit early
        approval_steps = []
        try:
            from app.models.approval import ApprovalInstance
            from app.models.agent import Agent
            from app.models.vendor import Vendor
            
            approval_steps_query = self.db.query(ApprovalStep).join(
                ApprovalInstance, ApprovalStep.instance_id == ApprovalInstance.id
            ).join(
                Agent, ApprovalInstance.agent_id == Agent.id
            ).join(
                Vendor, Agent.vendor_id == Vendor.id
            ).filter(
                Vendor.tenant_id == tenant_id,
                ApprovalStep.status == "pending"
            )
            
            if user_role not in ["tenant_admin", "platform_admin"]:
                # Regular users: only see approval steps assigned to them
                approval_steps_query = approval_steps_query.filter(ApprovalStep.assigned_to == user_id)
            
            # Apply limit early to reduce data processing
            approval_steps = approval_steps_query.limit(limit + offset).offset(offset).all()
        except Exception as e:
            logger.warning(f"Error querying pending approval steps: {e}")
            self.db.rollback()
            approval_steps = []

        if approval_steps:
            # Initialize variables
            instance_map = {}
            agents = {}
            onboarding_requests = {}
            agent_ids = []
            
            try:
                # Batch query approval instances and related data
                instance_ids = [step.instance_id for step in approval_steps]
                from app.models.approval import ApprovalInstance
                approval_instances = self.db.query(ApprovalInstance).filter(
                    ApprovalInstance.id.in_(instance_ids)
                ).all()

                # Create lookup maps
                instance_map = {inst.id: inst for inst in approval_instances}
                agent_ids = [inst.agent_id for inst in approval_instances if inst.agent_id]

                # Batch query agents and onboarding requests
                if agent_ids:
                    agents = {agent.id: agent for agent in self.db.query(Agent).filter(Agent.id.in_(agent_ids)).all()}
                    onboarding_requests = {
                        req.agent_id: req for req in self.db.query(OnboardingRequest).filter(
                            OnboardingRequest.agent_id.in_(agent_ids),
                            OnboardingRequest.status.in_(["pending", "in_review"])
                        ).all()
                    }
            except Exception as e:
                logger.warning(f"Error querying approval instances/agents: {e}")
                self.db.rollback()
                # Variables already initialized above

            for step in approval_steps:
                instance = instance_map.get(step.instance_id)
                agent_id = instance.agent_id if instance else None
                agent = agents.get(agent_id) if agent_id else None
                onboarding_request = onboarding_requests.get(agent_id) if agent_id else None

                request_ticket_id = onboarding_request.external_workflow_id if onboarding_request else None
                request_number = onboarding_request.request_number if onboarding_request else None

                # Use agent_id for action_url (ApprovalInterface expects agent_id, not instance_id)
                action_url = f"/approvals/{agent_id}" if agent_id else f"/approvals/{step.instance_id}"

                action_items.append({
                    "id": str(step.id),
                    "type": ActionItemType.APPROVAL.value,
                    "title": f"Approve {step.step_name or 'Request'}",
                    "description": f"Step {step.step_number}: {step.step_type}",
                    "status": ActionItemStatus.PENDING.value,
                    "priority": ActionItemPriority.MEDIUM.value,
                    "due_date": None,  # Approval steps don't have due dates by default
                    "assigned_at": step.created_at.isoformat() if step.created_at else None,
                    "source_type": "approval_step",
                    "source_id": str(step.id),
                    "action_url": action_url,
                    "metadata": {
                        "instance_id": str(step.instance_id),
                        "agent_id": str(agent_id) if agent_id else None,
                        "step_number": step.step_number,
                        "step_type": step.step_type,
                        "request_number": request_number,
                        "request_ticket_id": request_ticket_id
                    }
                })
        
        # 2. Get pending assessment assignments
        try:
            # Get user to check role and associations
            user = self.db.query(UserModel).filter(UserModel.id == user_id).first()

            # For platform admin or tenant admin, show all assignments in their tenant
            if user and user.role.value in ["tenant_admin", "platform_admin"]:
                query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id
                )
            elif user and user.role.value == "vendor_user":
                # Vendor users can see all assessment assignments in their tenant
                query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id
                )
            else:
                # For other regular users, try to find assignments based on their vendor/agent associations
                vendor_ids = []
                agent_ids = []

                # Get vendor associations for users (not just vendor users)
                if user and user.email:
                    vendors = self.db.query(Vendor).filter(
                        Vendor.tenant_id == tenant_id,
                        Vendor.contact_email == user.email
                    ).all()
                    vendor_ids = [v.id for v in vendors]

                # Get agent associations (join through Vendor since Agent doesn't have tenant_id)
                if user and user.email:
                    try:
                        agents = self.db.query(Agent).join(
                            Vendor, Agent.vendor_id == Vendor.id
                        ).filter(
                            Vendor.tenant_id == tenant_id,
                            Agent.contact_email == user.email
                        ).all()
                        agent_ids = [a.id for a in agents]
                    except Exception as e:
                        logger.warning(f"Error querying agent associations: {e}")
                        self.db.rollback()
                        agent_ids = []

                # Build query for user's assignments
                query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id
                )

                # Filter by vendor or agent assignments
                # Use OR logic: show assignments for any associated vendors OR agents
                vendor_filter = AssessmentAssignment.vendor_id.in_(vendor_ids) if vendor_ids else None
                agent_filter = AssessmentAssignment.agent_id.in_(agent_ids) if agent_ids else None

                if vendor_filter and agent_filter:
                    query = query.filter(vendor_filter | agent_filter)
                elif vendor_filter:
                    query = query.filter(vendor_filter)
                elif agent_filter:
                    query = query.filter(agent_filter)
                else:
                    # No associations found, return empty list
                    assessment_assignments = []
                    # Skip the rest of this section
                    assessment_assignments = []

            if 'assessment_assignments' not in locals():
                # Apply status filter for active assignments only
                query = query.filter(AssessmentAssignment.status.in_(["pending", "in_progress"]))
                assessment_assignments = query.all()
            
            for assignment in assessment_assignments:
                if not assignment.assessment_id:
                    logger.warning(f"AssessmentAssignment {assignment.id} has no assessment_id, skipping")
                    continue
                    
                assessment = self.db.query(Assessment).filter(
                    Assessment.id == assignment.assessment_id
                ).first()
                
                action_items.append({
                    "id": str(assignment.id),
                    "type": ActionItemType.ASSESSMENT.value,
                    "title": f"Complete Assessment: {assessment.name if assessment else 'Assessment'}",
                    "description": f"Complete the {assessment.assessment_type if assessment else 'assessment'} questionnaire",
                    "status": ActionItemStatus.PENDING.value if assignment.status == "pending" else ActionItemStatus.IN_PROGRESS.value,
                    "priority": ActionItemPriority.HIGH.value if assignment.due_date and assignment.due_date < datetime.utcnow() + timedelta(days=3) else ActionItemPriority.MEDIUM.value,
                    "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                    "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                    "source_type": "assessment_assignment",
                    "source_id": str(assignment.id),
                    "action_url": f"/assessments/{assignment.id}",
                    "metadata": {
                        "assessment_id": str(assignment.assessment_id),
                        "assessment_name": assessment.name if assessment else None,
                        "vendor_id": str(assignment.vendor_id) if assignment.vendor_id else None,
                        "workflow_ticket_id": assignment.workflow_ticket_id if hasattr(assignment, 'workflow_ticket_id') else None
                    }
                })
        except Exception as e:
            logger.warning(f"Error querying assessment assignments: {e}. Continuing without assessment assignments.")
            self.db.rollback()
            pass
        
        # 3. Get pending assessment reviews and approvals (action items for completed assessments)
        # Query action items table (gracefully handle if table doesn't exist)
        try:
            # Get REVIEW, ASSESSMENT, and APPROVAL type action items for assessments
            # APPROVAL type is used for assessment approval workflow items
            # Query for assessment-related action items (REVIEW, ASSESSMENT, APPROVAL types)
            # Use enum values directly for SQLEnum columns (SQLEnum handles both enum and string values)
            # For tenant_admin and platform_admin, show all action items in the tenant
            # For other users, only show items assigned to them
            logger.info(f"Querying assessment action items: user_id={user_id}, tenant_id={tenant_id}, user_role={user_role}")
            # Query for assessment action items - REVIEW type is treated as APPROVAL (backward compatibility)
            # Apply limit early to improve performance
            # For vendor users, only show ASSESSMENT type items (assignments and resubmissions), not approvals/reviews
            if user_role == "vendor_user":
                # Vendors should only see assessment assignments and resubmissions
                # Exclude items where the underlying assignment is already completed
                # Note: AssessmentAssignment is imported at the top of the file
                assessment_query = self.db.query(ActionItem).join(
                    AssessmentAssignment,
                    ActionItem.source_id == AssessmentAssignment.id
                ).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type == ActionItemType.ASSESSMENT,  # Only ASSESSMENT type for vendors
                    ActionItem.status == ActionItemStatus.PENDING,
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_resubmission"]),  # Only assignments and resubmissions
                    ActionItem.assigned_to == user_id,  # Only items assigned to this vendor user
                    AssessmentAssignment.status != "completed"  # Exclude completed assignments
                )
                logger.info(f"User is vendor_user, querying only ASSESSMENT type items (assignments/resubmissions) assigned to user, excluding completed")
            else:
                # For other users (admins, approvers, reviewers), show all assessment-related items
                assessment_query = self.db.query(ActionItem).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type.in_([ActionItemType.REVIEW, ActionItemType.ASSESSMENT, ActionItemType.APPROVAL]),  # REVIEW kept for backward compat, treated as APPROVAL
                    ActionItem.status == ActionItemStatus.PENDING,
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_approval", "assessment_review"])
                )
                
                if user_role not in ["tenant_admin", "platform_admin"]:
                    logger.info(f"User is {user_role}, querying only items assigned to user")
                    assessment_query = assessment_query.filter(ActionItem.assigned_to == user_id)
                else:
                    logger.info(f"User is {user_role}, querying all assessment action items in tenant")
            
            # Apply limit and offset for pagination
            assessment_action_items = assessment_query.limit(limit + offset).offset(offset).all()
            
            logger.info(f"Querying assessment action items for user {user_id} (role={user_role}) in tenant {tenant_id}: found {len(assessment_action_items)} items")
            items_added_count = 0
            if assessment_action_items:
                for item in assessment_action_items[:5]:  # Log first 5
                    logger.info(f"  - Action item {item.id}: type={item.action_type.value if hasattr(item.action_type, 'value') else item.action_type}, source_type={item.source_type}, source_id={item.source_id}, status={item.status.value if hasattr(item.status, 'value') else item.status}, assigned_to={item.assigned_to}, tenant_id={item.tenant_id}")
            else:
                # Log what we're looking for to help debug
                if user_role not in ["tenant_admin", "platform_admin"]:
                    all_user_action_items = self.db.query(ActionItem).filter(
                        ActionItem.assigned_to == user_id
                    ).all()
                    logger.info(f"  No assessment action items found. Total action items for user {user_id}: {len(all_user_action_items)}")
                    for item in all_user_action_items[:5]:  # Show first 5
                        logger.info(f"    - Action item {item.id}: type={item.action_type.value if hasattr(item.action_type, 'value') else item.action_type}, source_type={item.source_type}, status={item.status.value if hasattr(item.status, 'value') else item.status}, tenant_id={item.tenant_id}")
                
                # Also check if there are any action items for this tenant with the right source_type
                tenant_action_items = self.db.query(ActionItem).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_approval", "assessment_review"]),
                    ActionItem.action_type.in_([ActionItemType.REVIEW, ActionItemType.ASSESSMENT, ActionItemType.APPROVAL])
                ).all()
                logger.info(f"  Total assessment action items in tenant {tenant_id}: {len(tenant_action_items)}")
                for item in tenant_action_items[:5]:  # Show first 5
                    logger.info(f"    - Action item {item.id}: assigned_to={item.assigned_to}, type={item.action_type.value if hasattr(item.action_type, 'value') else item.action_type}, source_type={item.source_type}, status={item.status.value if hasattr(item.status, 'value') else item.status}")
                
                # Specifically check for assessment_approval items
                approval_items = self.db.query(ActionItem).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.source_type == "assessment_approval",
                    ActionItem.action_type == ActionItemType.APPROVAL
                ).all()
                logger.info(f"  Total assessment_approval action items in tenant {tenant_id}: {len(approval_items)}")
                for item in approval_items[:5]:  # Show first 5
                    logger.info(f"    - Approval item {item.id}: assigned_to={item.assigned_to}, status={item.status.value if hasattr(item.status, 'value') else item.status}, source_id={item.source_id}")

            # Batch load assignments and assessments to avoid N+1 queries
            assignment_ids = []
            for review_item in assessment_action_items:
                source_id = review_item.source_id
                if isinstance(source_id, str):
                    from uuid import UUID
                    try:
                        source_id = UUID(source_id)
                        assignment_ids.append(source_id)
                    except ValueError:
                        continue
                else:
                    assignment_ids.append(source_id)
            
            # Batch query all assignments (with tenant filtering for security)
            assignments_map = {}
            assessments_map = {}
            if assignment_ids:
                # Filter by tenant_id to ensure tenant isolation
                assignments = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.id.in_(assignment_ids),
                    AssessmentAssignment.tenant_id == tenant_id  # Ensure tenant isolation
                ).all()
                assignments_map = {a.id: a for a in assignments}
                
                # Log if any assignments were filtered out due to tenant mismatch
                if len(assignments) < len(assignment_ids):
                    filtered_out = set(assignment_ids) - {a.id for a in assignments}
                    logger.warning(
                        f"Filtered out {len(filtered_out)} assessment assignments due to tenant mismatch. "
                        f"Requested {len(assignment_ids)} assignments, found {len(assignments)} in tenant {tenant_id}"
                    )
                
                # Batch query assessments
                assessment_ids = [a.assessment_id for a in assignments if a.assessment_id]
                if assessment_ids:
                    assessments = self.db.query(Assessment).filter(
                        Assessment.id.in_(assessment_ids)
                    ).all()
                    assessments_map = {a.id: a for a in assessments}
            
            for review_item in assessment_action_items:
                # Get assignment details from batch-loaded data
                source_id = review_item.source_id
                if isinstance(source_id, str):
                    from uuid import UUID
                    try:
                        source_id = UUID(source_id)
                    except ValueError:
                        source_id = None
                
                assignment = assignments_map.get(source_id) if source_id else None
                
                # Skip if assignment doesn't exist or is in wrong tenant (shouldn't happen due to filtering, but safety check)
                if not assignment:
                    logger.warning(
                        f"Skipping assessment action item {review_item.id}: assignment {source_id} not found or not in tenant {tenant_id}. "
                        f"Action item tenant_id: {review_item.tenant_id}, source_type: {review_item.source_type}"
                    )
                    continue
                
                # Double-check tenant isolation
                if assignment.tenant_id != tenant_id:
                    logger.warning(
                        f"Skipping assessment action item {review_item.id}: assignment {source_id} belongs to tenant {assignment.tenant_id}, "
                        f"but action item query was for tenant {tenant_id}. This indicates a data integrity issue."
                    )
                    continue
                
                assessment = assessments_map.get(assignment.assessment_id) if assignment and assignment.assessment_id else None

                # Build metadata, ensuring workflow_ticket_id is included
                base_metadata = review_item.item_metadata or {}
                if assignment:
                    # Merge assignment data into metadata
                    fallback_metadata = {
                        "assessment_id": str(assignment.assessment_id) if assignment.assessment_id else None,
                        "assessment_name": assessment.name if assessment else (review_item.title.replace("Approve Assessment: ", "") if review_item.title else None),
                        "assessment_type": assessment.assessment_type if assessment else None,
                        "assignment_id": str(assignment.id),
                        "assignment_status": assignment.status if hasattr(assignment, 'status') else None
                    }
                    # Merge: use item_metadata if exists, otherwise use fallback, but always include workflow_ticket_id and status
                    metadata = {**fallback_metadata, **base_metadata}
                    # Always add workflow_ticket_id from assignment if available (override any existing value)
                    if hasattr(assignment, 'workflow_ticket_id'):
                        if assignment.workflow_ticket_id:
                            metadata["workflow_ticket_id"] = assignment.workflow_ticket_id
                            logger.debug(f"Added workflow_ticket_id {assignment.workflow_ticket_id} to metadata for action item {review_item.id}")
                        else:
                            logger.debug(f"Assignment {assignment.id} has no workflow_ticket_id set")
                    else:
                        logger.warning(f"Assignment {assignment.id} does not have workflow_ticket_id attribute")
                    # Always update assignment_status from assignment
                    if hasattr(assignment, 'status'):
                        metadata["assignment_status"] = assignment.status
                else:
                    metadata = base_metadata if base_metadata else {
                        "assessment_id": None,
                        "assessment_name": review_item.title.replace("Approve Assessment: ", "") if review_item.title else None,
                        "assignment_id": str(source_id)
                    }

                # Add action item (assignment exists and is in correct tenant, verified above)
                action_items.append({
                    "id": str(review_item.id),
                    "type": review_item.action_type.value if hasattr(review_item.action_type, 'value') else str(review_item.action_type),
                    "title": review_item.title,
                    "description": review_item.description,
                    "status": review_item.status.value if hasattr(review_item.status, 'value') else str(review_item.status),
                    "priority": review_item.priority.value if hasattr(review_item.priority, 'value') else str(review_item.priority),
                    "due_date": review_item.due_date.isoformat() if review_item.due_date else None,
                    "assigned_at": review_item.assigned_at.isoformat() if review_item.assigned_at else None,
                    "source_type": review_item.source_type,
                    "source_id": str(review_item.source_id),
                    "action_url": review_item.action_url or (f"/assessments/approver/{assignment.id}" if assignment else f"/assessments/{source_id}"),
                    "metadata": metadata
                })
                items_added_count += 1
                if items_added_count <= 5:  # Log first 5 additions
                    logger.info(f"Added assessment action item {review_item.id} (type={review_item.action_type.value if hasattr(review_item.action_type, 'value') else review_item.action_type}, source_type={review_item.source_type}, status={review_item.status.value if hasattr(review_item.status, 'value') else review_item.status}) to inbox")
            
            logger.info(f"Total assessment action items added to action_items list: {items_added_count} out of {len(assessment_action_items)} queried")
        except Exception as e:
            # Table doesn't exist or query failed - skip assessment action items
            logger.error(f"Assessment action items query failed (table may not exist): {e}", exc_info=True)
            pass
        
        # 4. Get pending onboarding requests assigned to user (or all for admins only)
        try:
            user = self.db.query(UserModel).filter(UserModel.id == user_id).first()
            is_admin = user and user.role.value in ["tenant_admin", "platform_admin"]
            
            onboarding_query = self.db.query(OnboardingRequest).filter(
                OnboardingRequest.tenant_id == tenant_id,
                OnboardingRequest.status.in_(["pending", "in_review"])
            )
            
            # Admins can see all requests, approvers and regular users only see assigned requests (or unassigned)
            if not is_admin:
                onboarding_query = onboarding_query.filter(
                    (OnboardingRequest.assigned_to == user_id) | (OnboardingRequest.assigned_to.is_(None))
                )
            
            onboarding_requests = onboarding_query.all()
            
            for request in onboarding_requests:
                if not request.agent_id:
                    logger.warning(f"OnboardingRequest {request.id} has no agent_id, skipping")
                    continue
                    
                agent = self.db.query(Agent).filter(Agent.id == request.agent_id).first()
                
                # Determine if current step is an approval step
                is_approval_step = False
                step_name = "Onboarding Request"
                if request.workflow_config_id and request.current_step:
                    workflow_config = self.db.query(WorkflowConfiguration).filter(
                        WorkflowConfiguration.id == request.workflow_config_id
                    ).first()
                    
                    if workflow_config and workflow_config.workflow_steps:
                        steps = workflow_config.workflow_steps
                        # Handle JSON string if needed
                        if isinstance(steps, str):
                            import json
                            try:
                                steps = json.loads(steps)
                            except json.JSONDecodeError:
                                steps = []
                        
                        if isinstance(steps, list):
                            # Find the current step
                            current_step_data = next(
                                (s for s in steps if s.get("step_number") == request.current_step),
                                None
                            )
                            if current_step_data:
                                step_type = current_step_data.get("step_type", "")
                                is_approval_step = step_type == "approval"
                                step_name = current_step_data.get("step_name", step_name)
                
                # Use approval type if it's an approval step, otherwise onboarding_review
                action_type = ActionItemType.APPROVAL.value if is_approval_step else ActionItemType.ONBOARDING_REVIEW.value
                title_prefix = "Approve" if is_approval_step else "Review Onboarding"
                # Link to approval interface for approvals, agent detail for reviews
                action_url = f"/approvals/{request.agent_id}" if is_approval_step else f"/agents/{request.agent_id}"
                
                # Get ticket number if ticket exists for this agent
                ticket_number = None
                workflow_ticket_id = None
                try:
                    from app.services.ticket_service import TicketService
                    ticket = TicketService.get_ticket_by_agent(self.db, request.agent_id)
                    if ticket and hasattr(ticket, 'ticket_number'):
                        ticket_number = ticket.ticket_number
                        workflow_ticket_id = ticket.ticket_number
                except Exception as e:
                    logger.debug(f"Could not get ticket for agent {request.agent_id}: {e}")
                
                # Use external_workflow_id if ticket_number not available
                if not workflow_ticket_id:
                    workflow_ticket_id = request.external_workflow_id
                
                # Use request_number as fallback
                if not workflow_ticket_id:
                    workflow_ticket_id = request.request_number
                
                action_items.append({
                    "id": str(request.id),
                    "type": action_type,
                    "title": f"{title_prefix}: {agent.name if agent else 'Agent'}",
                    "description": f"{step_name} - Request {request.request_number or ''}",
                    "status": ActionItemStatus.PENDING.value,
                    "priority": ActionItemPriority.MEDIUM.value,
                    "due_date": None,
                    "assigned_at": request.created_at.isoformat() if request.created_at else None,
                    "source_type": "onboarding_request",
                    "source_id": str(request.id),
                    "action_url": action_url,
                    "metadata": {
                        "agent_id": str(request.agent_id),
                        "agent_name": agent.name if agent else None,
                        "request_number": request.request_number,
                        "request_ticket_id": request.external_workflow_id,
                        "ticket_number": ticket_number,
                        "workflow_ticket_id": workflow_ticket_id,  # Primary ticket ID for display
                        "current_step": request.current_step,
                        "step_type": "approval" if is_approval_step else "review"
                    }
                })
        except Exception as e:
            logger.warning(f"Error querying onboarding requests: {e}. Continuing without onboarding requests.")
            pass
        
        # 5. Get pending tickets assigned to user (or all for admins)
        try:
            # Admins can see all tickets in their tenant
            if user_role in ["tenant_admin", "platform_admin"]:
                tickets = self.db.query(Ticket).filter(
                    Ticket.tenant_id == tenant_id,
                    Ticket.status.in_(["open", "in_progress"])
                ).all()
            else:
                tickets = self.db.query(Ticket).filter(
                    Ticket.tenant_id == tenant_id,
                    Ticket.assigned_to == user_id,
                    Ticket.status.in_(["open", "in_progress"])
                ).all()
            
            for ticket in tickets:
                ticket_number = ticket.ticket_number if hasattr(ticket, 'ticket_number') else None
                action_items.append({
                    "id": str(ticket.id),
                    "type": ActionItemType.TICKET.value,
                    "title": f"Ticket: {ticket.title}",
                    "description": ticket.description,
                    "status": ActionItemStatus.PENDING.value if ticket.status == "open" else ActionItemStatus.IN_PROGRESS.value,
                    "priority": ActionItemPriority.HIGH.value if ticket.priority == "high" else ActionItemPriority.MEDIUM.value,
                    "due_date": None,
                    "assigned_at": ticket.created_at.isoformat() if ticket.created_at else None,
                    "source_type": "ticket",
                    "source_id": str(ticket.id),
                    "action_url": f"/tickets/{ticket.id}",
                    "metadata": {
                        "ticket_type": ticket.ticket_type if hasattr(ticket, 'ticket_type') else None,
                        "priority": ticket.priority if hasattr(ticket, 'priority') else None,
                        "ticket_number": ticket_number,
                        "workflow_ticket_id": ticket_number  # Use ticket_number as workflow_ticket_id
                    }
                })
        except Exception as e:
            logger.warning(f"Error querying tickets: {e}. Continuing without tickets.")
            pass
        
        # 5. Get unread messages/comments requiring response
        try:
            unread_messages = self.db.query(Message).filter(
                Message.tenant_id == tenant_id,
                Message.is_read == False,
                Message.is_archived == False,
                or_(
                    Message.recipient_id == user_id,  # Messages directed to user
                    and_(
                        Message.recipient_id.is_(None),  # Public comments on resources user owns/is involved in
                        Message.resource_type.in_(["agent", "review", "policy"])
                    )
                )
            ).order_by(Message.created_at.desc()).limit(50).all()
        except Exception as e:
            logger.warning(f"Error querying messages: {e}. Continuing without messages.")
            unread_messages = []
        
        for message in unread_messages:
            sender = self.db.query(UserModel).filter(UserModel.id == message.sender_id).first()
            sender_name = sender.name if sender else "Unknown"
            
            # Determine action type based on message type
            if message.message_type == MessageType.QUESTION.value:
                action_type = ActionItemType.QUESTION.value
                title = f"Question from {sender_name}"
            elif message.message_type == MessageType.REPLY.value:
                action_type = ActionItemType.COMMENT.value
                title = f"Reply from {sender_name}"
            else:
                action_type = ActionItemType.MESSAGE.value
                title = f"Message from {sender_name}"
            
            # Build action URL based on resource type
            if message.resource_type == "agent":
                action_url = f"/agents/{message.resource_id}?tab=messages"
            elif message.resource_type == "review":
                action_url = f"/reviews/{message.resource_id}?tab=messages"
            elif message.resource_type == "policy":
                action_url = f"/admin/policies/{message.resource_id}?tab=messages"
            else:
                action_url = f"/messages?resource_type={message.resource_type}&resource_id={message.resource_id}"
            
            action_items.append({
                "id": str(message.id),
                "type": action_type,
                "title": title,
                "description": message.content[:200] + "..." if len(message.content) > 200 else message.content,
                "status": ActionItemStatus.PENDING.value,
                "priority": ActionItemPriority.MEDIUM.value,
                "due_date": None,
                "assigned_at": message.created_at.isoformat() if message.created_at else None,
                "source_type": "message",
                "source_id": str(message.id),
                "action_url": action_url,
                "metadata": {
                    "message_type": message.message_type,
                    "resource_type": message.resource_type,
                    "resource_id": str(message.resource_id),
                    "sender_id": str(message.sender_id),
                    "sender_name": sender_name
                }
            })
        
        # Get completed items (for completed section)
        # Admins can see all completed approval steps in their tenant
        completed_approvals = []
        try:
            if user_role in ["tenant_admin", "platform_admin"]:
                from app.models.approval import ApprovalInstance
                from app.models.agent import Agent
                from app.models.vendor import Vendor
                completed_approvals = self.db.query(ApprovalStep).join(
                    ApprovalInstance, ApprovalStep.instance_id == ApprovalInstance.id
                ).join(
                    Agent, ApprovalInstance.agent_id == Agent.id
                ).join(
                    Vendor, Agent.vendor_id == Vendor.id
                ).filter(
                    Vendor.tenant_id == tenant_id,
                    ApprovalStep.status == "completed"
                ).limit(50).all()
            else:
                # Regular users: only see completed approval steps assigned to them
                # Still need to ensure tenant isolation through joins
                from app.models.approval import ApprovalInstance
                from app.models.agent import Agent
                from app.models.vendor import Vendor
                completed_approvals = self.db.query(ApprovalStep).join(
                    ApprovalInstance, ApprovalStep.instance_id == ApprovalInstance.id
                ).join(
                    Agent, ApprovalInstance.agent_id == Agent.id
                ).join(
                    Vendor, Agent.vendor_id == Vendor.id
                ).filter(
                    ApprovalStep.assigned_to == user_id,
                    Vendor.tenant_id == tenant_id,  # Ensure tenant isolation
                    ApprovalStep.status == "completed"
                ).limit(50).all()
        except Exception as e:
            logger.warning(f"Error querying completed approvals: {e}")
            self.db.rollback()
            completed_approvals = []
        
        # Batch load approval instances and onboarding requests to avoid N+1 queries
        completed_instance_ids = [step.instance_id for step in completed_approvals]
        completed_instances_map = {}
        completed_agent_ids = []
        if completed_instance_ids:
            completed_instances = self.db.query(ApprovalInstance).filter(
                ApprovalInstance.id.in_(completed_instance_ids)
            ).all()
            completed_instances_map = {inst.id: inst for inst in completed_instances}
            completed_agent_ids = [inst.agent_id for inst in completed_instances if inst.agent_id]
        
        # Batch load onboarding requests
        completed_onboarding_map = {}
        if completed_agent_ids:
            from app.models.workflow_config import OnboardingRequest
            completed_onboarding_requests = self.db.query(OnboardingRequest).filter(
                OnboardingRequest.agent_id.in_(completed_agent_ids)
            ).order_by(OnboardingRequest.created_at.desc()).all()
            # Group by agent_id, keeping most recent
            for req in completed_onboarding_requests:
                if req.agent_id and req.agent_id not in completed_onboarding_map:
                    completed_onboarding_map[req.agent_id] = req
        
        for step in completed_approvals:
            # Get related onboarding request from batch-loaded data
            request_ticket_id = None
            request_number = None
            agent_id = None
            approval_instance = completed_instances_map.get(step.instance_id)
            if approval_instance and approval_instance.agent_id:
                agent_id = approval_instance.agent_id
                onboarding_request = completed_onboarding_map.get(agent_id)
                if onboarding_request:
                    request_ticket_id = onboarding_request.external_workflow_id
                    request_number = onboarding_request.request_number
            
            # Use agent_id for action_url (ApprovalInterface expects agent_id, not instance_id)
            action_url = f"/approvals/{agent_id}" if agent_id else f"/approvals/{step.instance_id}"
            
            action_items.append({
                "id": str(step.id),
                "type": ActionItemType.APPROVAL.value,
                "title": f"Approved: {step.step_name or 'Request'}",
                "description": f"Step {step.step_number}: {step.step_type}",
                "status": ActionItemStatus.COMPLETED.value,
                "priority": ActionItemPriority.MEDIUM.value,
                "due_date": None,
                "assigned_at": step.created_at.isoformat() if step.created_at else None,
                "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                "source_type": "approval_step",
                "source_id": str(step.id),
                "action_url": action_url,
                "metadata": {
                    "instance_id": str(step.instance_id),
                    "agent_id": str(agent_id) if agent_id else None,
                    "step_number": step.step_number,
                    "request_number": request_number,
                    "request_ticket_id": request_ticket_id
                }
            })
        
        # Get completed onboarding requests (approved or rejected)
        try:
            user_for_completed = self.db.query(UserModel).filter(UserModel.id == user_id).first()
            is_admin_for_completed = user_for_completed and user_for_completed.role.value in ["tenant_admin", "platform_admin"]
            
            completed_onboarding_query = self.db.query(OnboardingRequest).filter(
                OnboardingRequest.tenant_id == tenant_id,
                OnboardingRequest.status.in_(["approved", "rejected"])
            )
            
            # Admins can see all completed requests, regular users only see ones they approved/rejected
            if not is_admin_for_completed:
                completed_onboarding_query = completed_onboarding_query.filter(
                    (OnboardingRequest.approved_by == user_id) | (OnboardingRequest.reviewed_by == user_id)
                )
            
            # Order by approved_at or reviewed_at (whichever is available)
            completed_onboarding_requests = completed_onboarding_query.order_by(
                case(
                    (OnboardingRequest.approved_at.isnot(None), OnboardingRequest.approved_at),
                    else_=OnboardingRequest.reviewed_at
                ).desc()
            ).limit(50).all()
            
            # Batch load agents and workflow configs to avoid N+1 queries
            completed_req_agent_ids = [r.agent_id for r in completed_onboarding_requests if r.agent_id]
            completed_req_workflow_ids = [r.workflow_config_id for r in completed_onboarding_requests if r.workflow_config_id]
            
            agents_map = {}
            if completed_req_agent_ids:
                agents_map = {a.id: a for a in self.db.query(Agent).filter(Agent.id.in_(completed_req_agent_ids)).all()}
            
            workflow_configs_map = {}
            if completed_req_workflow_ids:
                from app.models.workflow_config import WorkflowConfiguration
                workflow_configs_map = {
                    wc.id: wc for wc in self.db.query(WorkflowConfiguration).filter(
                        WorkflowConfiguration.id.in_(completed_req_workflow_ids)
                    ).all()
                }
            
            for request in completed_onboarding_requests:
                if not request.agent_id:
                    logger.warning(f"Completed OnboardingRequest {request.id} has no agent_id, skipping")
                    continue
                    
                agent = agents_map.get(request.agent_id)
                
                # Determine if this was an approval step
                is_approval_step = False
                step_name = "Onboarding Request"
                if request.workflow_config_id and request.current_step:
                    workflow_config = workflow_configs_map.get(request.workflow_config_id)
                    
                    if workflow_config and workflow_config.workflow_steps:
                        steps = workflow_config.workflow_steps
                        if isinstance(steps, str):
                            import json
                            try:
                                steps = json.loads(steps)
                            except json.JSONDecodeError:
                                steps = []
                        
                        if isinstance(steps, list):
                            current_step_data = next(
                                (s for s in steps if s.get("step_number") == request.current_step),
                                None
                            )
                            if current_step_data:
                                step_type = current_step_data.get("step_type", "")
                                is_approval_step = step_type == "approval"
                                step_name = current_step_data.get("step_name", step_name)
                
                action_type = ActionItemType.APPROVAL.value if is_approval_step else ActionItemType.ONBOARDING_REVIEW.value
                title_prefix = "Approved" if request.status == "approved" else "Rejected"
                completed_at = request.approved_at if request.approved_at else request.reviewed_at
                
                action_items.append({
                    "id": str(request.id),
                    "type": action_type,
                    "title": f"{title_prefix}: {agent.name if agent else 'Agent'}",
                    "description": f"{step_name} - Request {request.request_number or ''}",
                    "status": ActionItemStatus.COMPLETED.value,
                    "priority": ActionItemPriority.MEDIUM.value,
                    "due_date": None,
                    "assigned_at": request.created_at.isoformat() if request.created_at else None,
                    "completed_at": completed_at.isoformat() if completed_at else None,
                    "source_type": "onboarding_request",
                    "source_id": str(request.id),
                    "action_url": f"/approvals/{request.agent_id}" if is_approval_step else f"/agents/{request.agent_id}",
                    "metadata": {
                        "agent_id": str(request.agent_id),
                        "agent_name": agent.name if agent else None,
                        "request_number": request.request_number,
                        "request_ticket_id": request.external_workflow_id,
                        "current_step": request.current_step,
                        "step_type": "approval" if is_approval_step else "review",
                        "status": request.status
                    }
                })
        except Exception as e:
            logger.warning(f"Error querying completed onboarding requests: {e}. Continuing without completed onboarding requests.")
            pass
        
        # Get completed assessment assignments
        try:
            # Get user to check role and associations for completed items
            user_for_completed = self.db.query(UserModel).filter(UserModel.id == user_id).first()

            # For platform admin or tenant admin, show all completed assignments in their tenant
            if user_for_completed and user_for_completed.role.value in ["tenant_admin", "platform_admin"]:
                completed_query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id,
                    AssessmentAssignment.status == "completed"
                )
            else:
                # For regular users, try to find completed assignments based on their vendor/agent associations
                completed_vendor_ids = []
                completed_agent_ids = []

                # Get vendor associations for users (not just vendor users)
                if user_for_completed and user_for_completed.email:
                    completed_vendors = self.db.query(Vendor).filter(
                        Vendor.tenant_id == tenant_id,
                        Vendor.contact_email == user_for_completed.email
                    ).all()
                    completed_vendor_ids = [v.id for v in completed_vendors]

                # Get agent associations
                if user_for_completed and user_for_completed.email:
                    completed_agents = self.db.query(Agent).join(Vendor).filter(
                        Vendor.tenant_id == tenant_id,
                        Agent.contact_email == user_for_completed.email
                    ).all()
                    completed_agent_ids = [a.id for a in completed_agents]

                # Build query for user's completed assignments
                completed_query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id,
                    AssessmentAssignment.status == "completed"
                )

                # Filter by vendor or agent assignments
                # Use OR logic: show assignments for any associated vendors OR agents
                completed_vendor_filter = AssessmentAssignment.vendor_id.in_(completed_vendor_ids) if completed_vendor_ids else None
                completed_agent_filter = AssessmentAssignment.agent_id.in_(completed_agent_ids) if completed_agent_ids else None

                if completed_vendor_filter and completed_agent_filter:
                    completed_query = completed_query.filter(completed_vendor_filter | completed_agent_filter)
                elif completed_vendor_filter:
                    completed_query = completed_query.filter(completed_vendor_filter)
                elif completed_agent_filter:
                    completed_query = completed_query.filter(completed_agent_filter)
                else:
                    # No associations found, skip completed assignments
                    completed_assignments = []
                    # Skip the rest of this section
                    completed_assignments = []

            if 'completed_assignments' not in locals():
                completed_assignments = completed_query.limit(50).all()
            
            for assignment in completed_assignments:
                if not assignment.assessment_id:
                    logger.warning(f"Completed AssessmentAssignment {assignment.id} has no assessment_id, skipping")
                    continue
                    
                assessment = self.db.query(Assessment).filter(
                    Assessment.id == assignment.assessment_id
                ).first()
                
                action_items.append({
                    "id": str(assignment.id),
                    "type": ActionItemType.ASSESSMENT.value,
                    "title": f"Completed: {assessment.name if assessment else 'Assessment'}",
                    "description": f"Completed the {assessment.assessment_type if assessment else 'assessment'} questionnaire",
                    "status": ActionItemStatus.COMPLETED.value,
                    "priority": ActionItemPriority.MEDIUM.value,
                    "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                    "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                    "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
                    "source_type": "assessment_assignment",
                    "source_id": str(assignment.id),
                    "action_url": f"/assessments/{assignment.id}",
                    "metadata": {
                        "assessment_id": str(assignment.assessment_id),
                        "assessment_name": assessment.name if assessment else None,
                        "workflow_ticket_id": assignment.workflow_ticket_id if hasattr(assignment, 'workflow_ticket_id') else None
                    }
                })
        except Exception as e:
            logger.warning(f"Error querying completed assessment assignments: {e}. Continuing without completed assessment assignments.")
            pass
        
        # Get read/completed messages (for completed section)
        try:
            read_messages = self.db.query(Message).filter(
                Message.tenant_id == tenant_id,
                Message.is_read == True,
                Message.is_archived == False,
                or_(
                    Message.recipient_id == user_id,
                    and_(
                        Message.recipient_id.is_(None),
                        Message.resource_type.in_(["agent", "review", "policy"])
                    )
                )
            ).order_by(Message.created_at.desc()).limit(50).all()
        except Exception as e:
            logger.warning(f"Error querying read messages: {e}. Continuing without messages.")
            read_messages = []
        
        for message in read_messages:
            sender = self.db.query(UserModel).filter(UserModel.id == message.sender_id).first()
            sender_name = sender.name if sender else "Unknown"
            
            # Determine action type based on message type
            if message.message_type == MessageType.QUESTION.value:
                action_type = ActionItemType.QUESTION.value
                title = f"Answered: Question from {sender_name}"
            elif message.message_type == MessageType.REPLY.value:
                action_type = ActionItemType.COMMENT.value
                title = f"Read: Reply from {sender_name}"
            else:
                action_type = ActionItemType.MESSAGE.value
                title = f"Read: Message from {sender_name}"
            
            # Build action URL based on resource type
            if message.resource_type == "agent":
                action_url = f"/agents/{message.resource_id}?tab=messages"
            elif message.resource_type == "review":
                action_url = f"/reviews/{message.resource_id}?tab=messages"
            elif message.resource_type == "policy":
                action_url = f"/admin/policies/{message.resource_id}?tab=messages"
            else:
                action_url = f"/messages?resource_type={message.resource_type}&resource_id={message.resource_id}"
            
            action_items.append({
                "id": str(message.id),
                "type": action_type,
                "title": title,
                "description": message.content[:200] + "..." if len(message.content) > 200 else message.content,
                "status": ActionItemStatus.COMPLETED.value,
                "priority": ActionItemPriority.MEDIUM.value,
                "due_date": None,
                "assigned_at": message.created_at.isoformat() if message.created_at else None,
                "completed_at": message.updated_at.isoformat() if message.updated_at else None,
                "source_type": "message",
                "source_id": str(message.id),
                "action_url": action_url,
                "metadata": {
                    "message_type": message.message_type,
                    "resource_type": message.resource_type,
                    "resource_id": str(message.resource_id),
                    "sender_id": str(message.sender_id),
                    "sender_name": sender_name
                }
            })
        
        # Filter by status
        logger.info(f"Before status filter: {len(action_items)} total items in action_items")
        if status:
            if status == "pending":
                before_count = len(action_items)
                action_items = [item for item in action_items if item["status"] in [ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value]]
                after_count = len(action_items)
                logger.info(f"After status='pending' filter: {before_count} → {after_count} items")
                # Log status distribution before filter
                status_dist = {}
                for item in action_items[:100]:  # Check first 100
                    s = item.get("status", "unknown")
                    status_dist[s] = status_dist.get(s, 0) + 1
                logger.info(f"Status distribution in filtered items (first 100): {status_dist}")
            elif status == "completed":
                action_items = [item for item in action_items if item["status"] == ActionItemStatus.COMPLETED.value]
            elif status == "overdue":
                # Filter overdue items - handle date parsing errors gracefully
                overdue_items = []
                for item in action_items:
                    if item.get("due_date"):
                        try:
                            # Handle both ISO format strings and datetime objects
                            if isinstance(item["due_date"], str):
                                due_date = datetime.fromisoformat(item["due_date"].replace('Z', '+00:00'))
                            else:
                                due_date = item["due_date"]
                            if due_date < datetime.utcnow():
                                overdue_items.append(item)
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Error parsing due_date for action item {item.get('id')}: {e}")
                            continue
                action_items = overdue_items
        
        # Filter by action type
        if action_type:
            before_action_type_count = len(action_items)
            action_items = [item for item in action_items if item["type"] == action_type]
            after_action_type_count = len(action_items)
            logger.info(f"After action_type='{action_type}' filter: {before_action_type_count} → {after_action_type_count} items")
            # Log type distribution before filter
            type_dist_before = {}
            for item in action_items[:100] if before_action_type_count > 0 else []:
                t = item.get("type", "unknown")
                type_dist_before[t] = type_dist_before.get(t, 0) + 1
            logger.info(f"Type distribution before action_type filter (first 100): {type_dist_before}")
        else:
            logger.info(f"No action_type filter applied. action_items count: {len(action_items)}")
        
        # Sort by priority and due date
        def get_sort_key(item):
            priority_score = {"urgent": 0, "high": 1, "medium": 2, "low": 3}.get(item.get("priority", "medium"), 2)
            try:
                if item.get("due_date"):
                    if isinstance(item["due_date"], str):
                        due_date = datetime.fromisoformat(item["due_date"].replace('Z', '+00:00'))
                    else:
                        due_date = item["due_date"]
                    return (priority_score, due_date)
                else:
                    return (priority_score, datetime.max)
            except (ValueError, TypeError) as e:
                logger.warning(f"Error parsing due_date for sorting action item {item.get('id')}: {e}")
                return (priority_score, datetime.max)
        
        action_items.sort(key=get_sort_key)
        
        # Log before creating pending_items
        logger.info(f"Before creating pending_items: action_items count={len(action_items)}")
        if len(action_items) > 0:
            # Log type distribution in action_items
            type_dist = {}
            for item in action_items[:100]:
                t = item.get("type", "unknown")
                type_dist[t] = type_dist.get(t, 0) + 1
            logger.info(f"Type distribution in action_items (first 100): {type_dist}")
            # Log status distribution
            status_dist = {}
            for item in action_items[:100]:
                s = item.get("status", "unknown")
                status_dist[s] = status_dist.get(s, 0) + 1
            logger.info(f"Status distribution in action_items (first 100): {status_dist}")
        
        # Separate into pending and completed
        pending_items = [item for item in action_items if item["status"] in [ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value]]
        completed_items = [item for item in action_items if item["status"] == ActionItemStatus.COMPLETED.value]
        
        logger.info(f"After creating pending_items: pending_items count={len(pending_items)}, completed_items count={len(completed_items)}")
        
        # Log summary of pending items by type
        pending_by_type = {}
        for item in pending_items:
            item_type = item.get("type", "unknown")
            pending_by_type[item_type] = pending_by_type.get(item_type, 0) + 1
        logger.info(f"Pending items summary: {pending_by_type}, total={len(pending_items)}")
        # Log first 10 pending items for debugging
        logger.info(f"First 10 pending items: {[(item.get('id'), item.get('type'), item.get('source_type'), item.get('title', '')[:50]) for item in pending_items[:10]]}")
        
        # Calculate overdue items - handle date parsing errors gracefully
        overdue_items = []
        for item in pending_items:
            if item.get("due_date"):
                try:
                    if isinstance(item["due_date"], str):
                        due_date = datetime.fromisoformat(item["due_date"].replace('Z', '+00:00'))
                    else:
                        due_date = item["due_date"]
                    if due_date < datetime.utcnow():
                        overdue_items.append(item)
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error parsing due_date for overdue check on action item {item.get('id')}: {e}")
                    continue
        
        # Apply pagination
        total = len(action_items)
        paginated_items = action_items[offset:offset + limit]
        
        return {
            "items": paginated_items,
            "pending": pending_items[:limit],
            "completed": completed_items[:limit],
            "overdue": overdue_items,
            "total": total,
            "pending_count": len(pending_items),
            "completed_count": len(completed_items),
            "overdue_count": len(overdue_items)
        }
    
    def mark_as_completed(
        self,
        action_item_id: str,
        source_type: str,
        user_id: UUID
    ) -> bool:
        """
        Mark an action item as completed
        
        Args:
            action_item_id: ID of the source entity
            source_type: Type of source (approval_step, assessment_assignment, etc.)
            user_id: User who completed it
            
        Returns:
            True if successful
        """
        # The actual completion is handled by the respective services
        # This method can be used to update action item status if we store them in action_items table
        # For now, we aggregate on-the-fly, so completion is handled by source services
        return True
    
    def mark_as_read(
        self,
        action_item_id: str,
        source_type: str,
        user_id: UUID
    ) -> bool:
        """
        Mark an action item as read
        
        Args:
            action_item_id: ID of the source entity
            source_type: Type of source
            user_id: User who read it
            
        Returns:
            True if successful
        """
        # For now, we aggregate on-the-fly
        # In the future, we can store read status in action_items table
        return True
