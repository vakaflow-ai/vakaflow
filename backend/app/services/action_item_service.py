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
        # Admins can see all approval steps in their tenant (no assigned_to filter)
        # Regular users see steps assigned to them or their role
        # Optimize: Use single query with conditional filter and apply limit early
        approval_steps = []
        try:
            from app.models.approval import ApprovalInstance, ApprovalStep
            from app.models.agent import Agent
            from app.models.vendor import Vendor
            from sqlalchemy import or_, and_
            
            # Start with base query - join through ApprovalInstance -> Agent -> Vendor for tenant isolation
            # Note: Agent.vendor_id is NOT NULL, so all agents have vendors - use INNER JOIN
            approval_steps_query = self.db.query(ApprovalStep).join(
                ApprovalInstance, ApprovalStep.instance_id == ApprovalInstance.id
            ).join(
                Agent, ApprovalInstance.agent_id == Agent.id
            ).join(
                Vendor, Agent.vendor_id == Vendor.id
            ).filter(
                Vendor.tenant_id == tenant_id,  # Tenant isolation - critical for security
                ApprovalStep.status.in_(["pending", "in_progress"])  # Include both pending and in_progress steps
            )
            
            # For admins: show ALL pending approval steps in tenant (no assigned_to filter)
            # For regular users: filter by assignment (direct or role-based)
            is_admin = user_role in ["tenant_admin", "platform_admin"]
            if not is_admin:
                # Regular users: see approval steps assigned to them OR assigned to their role
                # Handle both direct assignment (assigned_to) and role-based assignment (assigned_role)
                role_filter = or_(
                    ApprovalStep.assigned_to == user_id,  # Directly assigned to user
                    and_(
                        ApprovalStep.assigned_to.is_(None),  # Not directly assigned
                        ApprovalStep.assigned_role == user_role  # But matches user's role
                    )
                )
                approval_steps_query = approval_steps_query.filter(role_filter)
            # Admins: no additional filter - they see all pending steps in tenant
            
            # Apply limit early to reduce data processing
            approval_steps = approval_steps_query.limit(limit + offset).offset(offset).all()
            
            logger.info(f"Found {len(approval_steps)} pending approval steps for user {user_id} (role={user_role}, is_admin={is_admin}) in tenant {tenant_id}")
            if len(approval_steps) > 0:
                logger.info(f"  Sample approval steps: {[(str(s.id), s.step_name or 'N/A', s.status, str(s.assigned_to) if s.assigned_to else 'None') for s in approval_steps[:3]]}")
        except Exception as e:
            logger.error(f"Error querying pending approval steps: {e}", exc_info=True)
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
        
        # Helper function to map assignment status to workflow stage
        def get_workflow_stage(assignment_status: str) -> str:
            """Map assessment assignment status to workflow stage"""
            status_mapping = {
                "pending": "new",
                "in_progress": "in_progress",
                "completed": "pending_approval",  # Vendor completed, waiting for approver
                "approved": "approved",
                "rejected": "rejected",
                "needs_revision": "needs_revision",
                "overdue": "in_progress",  # Still in progress but overdue
                "cancelled": "cancelled"
            }
            return status_mapping.get(assignment_status, "new")
        
        # 2. Get pending assessment assignments
        # NOTE: We skip direct assessment assignments here because they are handled in section 3
        # via the ActionItem table. This ensures we only show ONE action item per assessment assignment.
        # Direct assignments are only shown if there's no corresponding ActionItem record.
        assessment_assignment_ids_from_action_items = set()  # Track which assignments already have action items
        
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
                # Use status parameter to determine which action items to query
                # Note: AssessmentAssignment is imported at the top of the file
                
                # Determine ActionItem status filter based on status parameter
                if status == "completed":
                    action_item_status_filter = ActionItemStatus.COMPLETED
                    assignment_status_filter = AssessmentAssignment.status.in_(["completed", "approved", "rejected"])  # Show completed/approved/rejected assignments
                    logger.info(f"User is vendor_user (ID: {user_id}), querying COMPLETED ASSESSMENT type items assigned to user in tenant {tenant_id}")
                elif status == "pending":
                    action_item_status_filter = ActionItemStatus.PENDING
                    assignment_status_filter = AssessmentAssignment.status.in_(["pending", "in_progress"])  # Only show pending/in_progress assignments
                    logger.info(f"User is vendor_user (ID: {user_id}), querying PENDING ASSESSMENT type items assigned to user in tenant {tenant_id}, filtering for assignment status: pending or in_progress")
                elif status == "overdue":
                    action_item_status_filter = ActionItemStatus.PENDING  # Overdue items are pending
                    assignment_status_filter = AssessmentAssignment.status.in_(["pending", "in_progress"])  # Overdue items are pending/in_progress
                    logger.info(f"User is vendor_user (ID: {user_id}), querying OVERDUE ASSESSMENT type items assigned to user in tenant {tenant_id}")
                else:
                    # No status filter - show both pending and completed
                    action_item_status_filter = None  # Will filter by status later
                    assignment_status_filter = None  # Will not filter by assignment status
                    logger.info(f"User is vendor_user (ID: {user_id}), querying ALL ASSESSMENT type items assigned to user in tenant {tenant_id}")
                
                assessment_query = self.db.query(ActionItem).join(
                    AssessmentAssignment,
                    ActionItem.source_id == AssessmentAssignment.id
                ).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type == ActionItemType.ASSESSMENT,  # Only ASSESSMENT type for vendors
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_resubmission"]),  # Only assignments and resubmissions
                    ActionItem.assigned_to == user_id  # Only items assigned to this vendor user
                )
                
                # Apply status filters if specified
                if action_item_status_filter is not None:
                    assessment_query = assessment_query.filter(ActionItem.status == action_item_status_filter)
                
                if assignment_status_filter is not None:
                    assessment_query = assessment_query.filter(assignment_status_filter)
                
                # Debug: Check if there are any action items for this user at all
                all_user_items = self.db.query(ActionItem).filter(
                    ActionItem.assigned_to == user_id,
                    ActionItem.tenant_id == tenant_id
                ).all()
                logger.info(f"DEBUG: Total action items for vendor user {user_id} in tenant {tenant_id}: {len(all_user_items)}")
                for item in all_user_items[:10]:
                    logger.info(f"DEBUG: Action item {item.id}: type={item.action_type.value if hasattr(item.action_type, 'value') else item.action_type}, source_type={item.source_type}, source_id={item.source_id}, status={item.status.value if hasattr(item.status, 'value') else item.status}")
                
                # Debug: Check assessment assignments for this vendor
                from app.models.vendor import Vendor
                vendor = self.db.query(Vendor).filter(
                    Vendor.tenant_id == tenant_id
                ).join(
                    AssessmentAssignment, AssessmentAssignment.vendor_id == Vendor.id
                ).filter(
                    AssessmentAssignment.status.in_(["pending", "in_progress"])
                ).first()
                if vendor:
                    assignments = self.db.query(AssessmentAssignment).filter(
                        AssessmentAssignment.vendor_id == vendor.id,
                        AssessmentAssignment.status.in_(["pending", "in_progress"])
                    ).all()
                    logger.info(f"DEBUG: Found {len(assignments)} pending/in_progress assignments for vendor {vendor.id} ({vendor.name})")
                    for assn in assignments:
                        action_items_for_assn = self.db.query(ActionItem).filter(
                            ActionItem.source_type == "assessment_assignment",
                            ActionItem.source_id == assn.id,
                            ActionItem.assigned_to == user_id
                        ).all()
                        logger.info(f"DEBUG: Assignment {assn.id} (status={assn.status}): {len(action_items_for_assn)} action items for user {user_id}")
            elif user_role in ["approver", "security_reviewer", "compliance_reviewer", "technical_reviewer", "business_reviewer"]:
                # Approvers and reviewers should ONLY see approval/review items for completed assessments
                # They should NOT see assessment_assignment items (those are for vendors to fill out)
                # IMPORTANT: Join with AssessmentAssignment to show items where assignment is "completed" (submitted, waiting for approval)
                # but exclude items where assignment is already "approved" or "rejected" (already processed)
                assessment_query = self.db.query(ActionItem).outerjoin(
                    AssessmentAssignment,
                    (ActionItem.source_id == AssessmentAssignment.id) & 
                    (ActionItem.source_type.in_(["assessment_approval", "assessment_review"]))
                ).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type.in_([ActionItemType.REVIEW, ActionItemType.APPROVAL]),  # Only approval/review items
                    ActionItem.status == ActionItemStatus.PENDING,
                    ActionItem.source_type.in_(["assessment_approval", "assessment_review"]),  # Only approval items, NOT assignments
                    ActionItem.assigned_to == user_id,  # Only items assigned to this approver
                    # Show items where assignment is "completed" (submitted, waiting for approval) or doesn't exist
                    # Exclude only "approved" and "rejected" (already processed)
                    (AssessmentAssignment.id.is_(None)) |  # For items without assignment (shouldn't happen, but safe)
                    (AssessmentAssignment.status.notin_(["approved", "rejected"]))  # Exclude only approved/rejected (allow "completed" which means waiting for approval)
                )
                logger.info(f"User is {user_role} (approver/reviewer), querying only APPROVAL/REVIEW type items (not assignments), allowing 'completed' status assignments")
            else:
                # For other users (admins), show all assessment-related items
                # IMPORTANT: Join with AssessmentAssignment to show items where assignment is "completed" (submitted, waiting for approval)
                # but exclude items where assignment is already "approved" or "rejected" (already processed)
                # For approval items, allow "completed" status. For assignment items, exclude "completed".
                assessment_query = self.db.query(ActionItem).outerjoin(
                    AssessmentAssignment,
                    (ActionItem.source_id == AssessmentAssignment.id) & 
                    (ActionItem.source_type.in_(["assessment_assignment", "assessment_approval", "assessment_review"]))
                ).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type.in_([ActionItemType.REVIEW, ActionItemType.ASSESSMENT, ActionItemType.APPROVAL]),  # REVIEW kept for backward compat, treated as APPROVAL
                    ActionItem.status == ActionItemStatus.PENDING,
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_approval", "assessment_review"]),
                    # Show items where assignment doesn't exist OR matches status rules
                    (AssessmentAssignment.id.is_(None)) |  # For items without assignment (shouldn't happen, but safe)
                    (
                        # For approval/review items: allow "completed" (submitted, waiting for approval), exclude "approved"/"rejected"
                        ((ActionItem.source_type.in_(["assessment_approval", "assessment_review"])) & 
                         (AssessmentAssignment.status.notin_(["approved", "rejected"]))) |
                        # For assignment items: exclude "completed", "approved", "rejected" (vendors shouldn't see completed assignments)
                        ((ActionItem.source_type == "assessment_assignment") & 
                         (AssessmentAssignment.status.notin_(["completed", "approved", "rejected"])))
                    )
                )
                
                if user_role not in ["tenant_admin", "platform_admin"]:
                    logger.info(f"User is {user_role}, querying only items assigned to user")
                    assessment_query = assessment_query.filter(ActionItem.assigned_to == user_id)
                else:
                    logger.info(f"User is {user_role}, querying all assessment action items in tenant")
            
            # Apply limit and offset for pagination
            assessment_action_items = assessment_query.limit(limit + offset).offset(offset).all()
            
            # If no items found for vendor_user, try a simpler query without join to see if action items exist
            if user_role == "vendor_user" and len(assessment_action_items) == 0:
                logger.warning(f"No assessment action items found with join. Trying simpler query without join...")
                simple_query = self.db.query(ActionItem).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type == ActionItemType.ASSESSMENT,
                    ActionItem.status == ActionItemStatus.PENDING,
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_resubmission"]),
                    ActionItem.assigned_to == user_id
                ).all()
                logger.info(f"Simple query (without join) found {len(simple_query)} action items for vendor user {user_id}")
                if simple_query:
                    for item in simple_query:
                        # Check the assignment status
                        assignment = self.db.query(AssessmentAssignment).filter(
                            AssessmentAssignment.id == item.source_id
                        ).first()
                        if assignment:
                            logger.info(f"  Action item {item.id} -> Assignment {assignment.id}: status={assignment.status}, vendor_id={assignment.vendor_id}")
                        else:
                            logger.warning(f"  Action item {item.id} -> Assignment {item.source_id} NOT FOUND")
                    # Use the simple query results if they exist (even if assignment status is wrong)
                    # This helps debug the issue
                    assessment_action_items = simple_query[:limit]
            
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
                        assessment_assignment_ids_from_action_items.add(source_id)  # Track this assignment
                    except ValueError:
                        continue
                else:
                    assignment_ids.append(source_id)
                    assessment_assignment_ids_from_action_items.add(source_id)  # Track this assignment
            
            # Batch query all assignments (with tenant filtering for security)
            assignments_map = {}
            assessments_map = {}
            if assignment_ids:
                # Filter by tenant_id to ensure tenant isolation
                # Use refresh to ensure we get the latest workflow_ticket_id
                assignments = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.id.in_(assignment_ids),
                    AssessmentAssignment.tenant_id == tenant_id  # Ensure tenant isolation
                ).all()
                # Refresh each assignment to ensure we have the latest workflow_ticket_id
                for assignment in assignments:
                    self.db.refresh(assignment)
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
                
                # CRITICAL: Check assignment status to determine if action item should be shown
                # For VENDOR users: Show assignments with status "pending" or "in_progress" (they need to complete them)
                # For APPROVER/REVIEWER users: Show assignments with status "completed" (vendor has submitted, ready for approval)
                # 1. If assignment is "approved" or "rejected", mark action item as COMPLETED (appears in completed inbox)
                # 2. If assignment is "completed" (vendor submitted), ensure flags are set (appears in pending inbox for approvers)
                # 3. For approvers: If assignment is not "completed", skip it (vendor hasn't submitted yet)
                # 4. For vendors: If assignment is "pending" or "in_progress", show it (they need to complete it)
                if hasattr(assignment, 'status'):
                    if assignment.status in ["approved", "rejected"]:
                        # Assignment already processed - mark action item as COMPLETED
                        if review_item.status == ActionItemStatus.PENDING or review_item.status == ActionItemStatus.IN_PROGRESS:
                            try:
                                review_item.status = ActionItemStatus.COMPLETED.value
                                review_item.completed_at = datetime.utcnow()
                                logger.info(
                                    f"Updated action item {review_item.id} status to COMPLETED because assignment {source_id} is {assignment.status}. "
                                    f"Action item will appear in completed inbox, not pending."
                                )
                            except Exception as e:
                                logger.warning(f"Failed to update action item {review_item.id} status: {e}")
                    elif user_role != "vendor_user" and assignment.status != "completed":
                        # For approvers/reviewers: Assignment not completed by vendor yet - skip this action item
                        # (Approvers should only see assignments that vendors have completed and submitted)
                        logger.debug(
                            f"Skipping assessment action item {review_item.id}: assignment {source_id} status is '{assignment.status}', "
                            f"not 'completed'. Vendor must complete the assessment first before it appears in approver inbox."
                        )
                        continue
                    # For vendors: If assignment is "pending" or "in_progress", continue processing (they need to complete it)
                    # For approvers: If assignment.status == "completed", continue processing (vendor has submitted, ready for approval)
                
                assessment = assessments_map.get(assignment.assessment_id) if assignment and assignment.assessment_id else None

                # Build metadata, ensuring workflow_ticket_id and workflow_stage are included
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
                    # Merge: use item_metadata if exists, otherwise use fallback
                    metadata = {**fallback_metadata, **base_metadata}
                    # Always include human-readable workflow_ticket_id from assignment (e.g., ASMT-2026-017)
                    if hasattr(assignment, 'workflow_ticket_id') and assignment.workflow_ticket_id:
                        metadata["workflow_ticket_id"] = assignment.workflow_ticket_id
                    elif base_metadata.get("workflow_ticket_id"):
                        metadata["workflow_ticket_id"] = base_metadata.get("workflow_ticket_id")
                    # Always update assignment_status from assignment
                    if hasattr(assignment, 'status'):
                        metadata["assignment_status"] = assignment.status
                    # Add workflow_stage based on assignment status
                    metadata["workflow_stage"] = get_workflow_stage(assignment.status)
                    # Add flags to indicate vendor completion status
                    if assignment.status == "completed":
                        metadata["vendor_completed"] = True  # Vendor has completed the assessment
                        metadata["ready_for_approval"] = True  # Assessment is ready for approver review
                    elif assignment.status in ["approved", "rejected"]:
                        metadata["vendor_completed"] = True  # Was completed (now processed)
                        metadata["ready_for_approval"] = False  # Already processed, no longer needs approval
                    else:
                        metadata["vendor_completed"] = False  # Vendor hasn't completed yet
                        metadata["ready_for_approval"] = False  # Not ready for approval
                else:
                    metadata = base_metadata if base_metadata else {
                        "assessment_id": None,
                        "assessment_name": review_item.title.replace("Approve Assessment: ", "") if review_item.title else None,
                        "assignment_id": str(source_id)
                    }
                    # If no assignment, try to get workflow_stage from item metadata or default to "new"
                    if "workflow_stage" not in metadata:
                        metadata["workflow_stage"] = "new"
                    # Include workflow_ticket_id from metadata if available
                    if base_metadata and base_metadata.get("workflow_ticket_id"):
                        metadata["workflow_ticket_id"] = base_metadata.get("workflow_ticket_id")

                # Determine the correct status: if assignment is approved/rejected, action item should be COMPLETED
                # Otherwise use the action item's current status
                item_status = review_item.status.value if hasattr(review_item.status, 'value') else str(review_item.status)
                if assignment and hasattr(assignment, 'status') and assignment.status in ["approved", "rejected"]:
                    # Assignment is already processed, so action item should be COMPLETED
                    item_status = ActionItemStatus.COMPLETED.value
                    # Also update the database record if it's still PENDING/IN_PROGRESS
                    if review_item.status == ActionItemStatus.PENDING or review_item.status == ActionItemStatus.IN_PROGRESS:
                        try:
                            review_item.status = ActionItemStatus.COMPLETED.value
                            review_item.completed_at = datetime.utcnow()
                            logger.info(f"Updated action item {review_item.id} status to COMPLETED because assignment {assignment.id} is {assignment.status}")
                        except Exception as e:
                            logger.warning(f"Failed to update action item {review_item.id} status: {e}")
                
                # Add action item (assignment exists and is in correct tenant, verified above)
                action_items.append({
                    "id": str(review_item.id),
                    "type": review_item.action_type.value if hasattr(review_item.action_type, 'value') else str(review_item.action_type),
                    "title": review_item.title,
                    "description": review_item.description,
                    "status": item_status,  # Use the determined status
                    "priority": review_item.priority.value if hasattr(review_item.priority, 'value') else str(review_item.priority),
                    "due_date": review_item.due_date.isoformat() if review_item.due_date else None,
                    "assigned_at": review_item.assigned_at.isoformat() if review_item.assigned_at else None,
                    "source_type": review_item.source_type,
                    "source_id": str(review_item.source_id),
                    "action_url": review_item.action_url or (f"/assessments/review/{assignment.id}" if assignment else f"/assessments/{source_id}"),
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
        
        # Get completed assessment assignments and action items
        # For vendors, we should show ActionItem records with COMPLETED status (not just AssessmentAssignment)
        try:
            # Get user to check role and associations for completed items
            user_for_completed = self.db.query(UserModel).filter(UserModel.id == user_id).first()

            # For vendor users, query ActionItem records with COMPLETED status first
            # This ensures we show all completed action items (including those that were marked as completed)
            if user_for_completed and user_for_completed.role.value == "vendor_user":
                # Query completed ActionItem records for vendors
                completed_action_items_query = self.db.query(ActionItem).join(
                    AssessmentAssignment,
                    ActionItem.source_id == AssessmentAssignment.id
                ).filter(
                    ActionItem.tenant_id == tenant_id,
                    ActionItem.action_type == ActionItemType.ASSESSMENT,
                    ActionItem.status == ActionItemStatus.COMPLETED,
                    ActionItem.source_type.in_(["assessment_assignment", "assessment_resubmission"]),
                    ActionItem.assigned_to == user_id,
                    AssessmentAssignment.tenant_id == tenant_id  # Ensure tenant isolation
                )
                
                completed_action_items = completed_action_items_query.limit(100).all()
                logger.info(f"Found {len(completed_action_items)} completed ActionItem records for vendor user {user_id}")
                
                # Convert completed ActionItem records to action_items format
                completed_assignment_ids_from_action_items = set()
                for completed_item in completed_action_items:
                    source_id = completed_item.source_id
                    if isinstance(source_id, str):
                        from uuid import UUID
                        try:
                            source_id = UUID(source_id)
                            completed_assignment_ids_from_action_items.add(source_id)
                        except ValueError:
                            continue
                    else:
                        completed_assignment_ids_from_action_items.add(source_id)
                    
                    # Get assignment details
                    assignment = self.db.query(AssessmentAssignment).filter(
                        AssessmentAssignment.id == source_id,
                        AssessmentAssignment.tenant_id == tenant_id
                    ).first()
                    
                    if not assignment:
                        continue
                    
                    assessment = self.db.query(Assessment).filter(
                        Assessment.id == assignment.assessment_id
                    ).first()
                    
                    action_items.append({
                        "id": str(completed_item.id),
                        "type": completed_item.action_type.value if hasattr(completed_item.action_type, 'value') else str(completed_item.action_type),
                        "title": f"Completed: {assessment.name if assessment else 'Assessment'}",
                        "description": f"Completed the {assessment.assessment_type if assessment else 'assessment'} questionnaire",
                        "status": ActionItemStatus.COMPLETED.value,
                        "priority": completed_item.priority.value if hasattr(completed_item.priority, 'value') else str(completed_item.priority),
                        "due_date": completed_item.due_date.isoformat() if completed_item.due_date else None,
                        "assigned_at": completed_item.assigned_at.isoformat() if completed_item.assigned_at else None,
                        "completed_at": completed_item.completed_at.isoformat() if completed_item.completed_at else (assignment.completed_at.isoformat() if assignment.completed_at else None),
                        "source_type": completed_item.source_type,
                        "source_id": str(completed_item.source_id),
                        "action_url": completed_item.action_url or f"/assessments/{assignment.id}",
                        "metadata": {
                            "assessment_id": str(assignment.assessment_id),
                            "assessment_name": assessment.name if assessment else None,
                            "assignment_id": str(assignment.id),
                            "assignment_status": assignment.status,
                            "workflow_ticket_id": assignment.workflow_ticket_id if hasattr(assignment, 'workflow_ticket_id') else None,
                            **(completed_item.item_metadata or {})
                        }
                    })
                
                # Also query AssessmentAssignment records that don't have ActionItem records (for backward compatibility)
                # Get vendor associations by email match
                completed_vendor_ids = []
                completed_agent_ids = []
                
                if user_for_completed.email:
                    completed_vendors = self.db.query(Vendor).filter(
                        Vendor.tenant_id == tenant_id,
                        Vendor.contact_email == user_for_completed.email
                    ).all()
                    completed_vendor_ids = [v.id for v in completed_vendors]
                
                    try:
                        completed_agents = self.db.query(Agent).join(
                            Vendor, Agent.vendor_id == Vendor.id
                        ).filter(
                            Vendor.tenant_id == tenant_id,
                            Agent.contact_email == user_for_completed.email
                        ).all()
                        completed_agent_ids = [a.id for a in completed_agents]
                    except Exception as e:
                        logger.warning(f"Error querying agent associations for vendor user (completed): {e}")
                        self.db.rollback()
                        completed_agent_ids = []
                
                # Query assignments that don't have ActionItem records (exclude those we already added)
                completed_vendor_filter = AssessmentAssignment.vendor_id.in_(completed_vendor_ids) if completed_vendor_ids else None
                completed_agent_filter = AssessmentAssignment.agent_id.in_(completed_agent_ids) if completed_agent_ids else None
                
                completed_query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id,
                    AssessmentAssignment.status.in_(["completed", "approved", "rejected"])
                )
                
                # Exclude assignments we already added from ActionItem records
                if completed_assignment_ids_from_action_items:
                    completed_query = completed_query.filter(
                        ~AssessmentAssignment.id.in_(list(completed_assignment_ids_from_action_items))
                    )
                
                if completed_vendor_filter and completed_agent_filter:
                    completed_query = completed_query.filter(completed_vendor_filter | completed_agent_filter)
                elif completed_vendor_filter:
                    completed_query = completed_query.filter(completed_vendor_filter)
                elif completed_agent_filter:
                    completed_query = completed_query.filter(completed_agent_filter)
                else:
                    # No vendor/agent associations found - skip additional assignments
                    completed_assignments = []
            # For platform admin or tenant admin, show all completed assignments in their tenant
            # Include both "completed" (vendor submitted) and "approved" (approver approved) statuses
            elif user_for_completed and user_for_completed.role.value in ["tenant_admin", "platform_admin"]:
                completed_query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id,
                    AssessmentAssignment.status.in_(["completed", "approved", "rejected"])
                )
            else:
                # For other regular users, try to find completed assignments based on their vendor/agent associations
                completed_vendor_ids = []
                completed_agent_ids = []

                # Get vendor associations for users (not just vendor users)
                if user_for_completed and user_for_completed.email:
                    completed_vendors = self.db.query(Vendor).filter(
                        Vendor.tenant_id == tenant_id,
                        Vendor.contact_email == user_for_completed.email
                    ).all()
                    completed_vendor_ids = [v.id for v in completed_vendors]

                # Get agent associations (join through Vendor since Agent doesn't have tenant_id)
                if user_for_completed and user_for_completed.email:
                    try:
                        completed_agents = self.db.query(Agent).join(
                            Vendor, Agent.vendor_id == Vendor.id
                        ).filter(
                            Vendor.tenant_id == tenant_id,
                            Agent.contact_email == user_for_completed.email
                        ).all()
                        completed_agent_ids = [a.id for a in completed_agents]
                    except Exception as e:
                        logger.warning(f"Error querying agent associations (completed): {e}")
                        self.db.rollback()
                        completed_agent_ids = []

                # Build query for user's completed assignments
                # Include both "completed" (vendor submitted) and "approved" (approver approved) statuses
                completed_query = self.db.query(AssessmentAssignment).filter(
                    AssessmentAssignment.tenant_id == tenant_id,
                    AssessmentAssignment.status.in_(["completed", "approved", "rejected"])
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
        
        # Deduplicate action items by workflow_ticket_id or source_id
        # Ensure we only show ONE action item per assessment (all questions belong to one assessment)
        seen_tickets = {}  # workflow_ticket_id -> action_item
        seen_assignments = {}  # assignment_id -> action_item
        deduplicated_items = []
        original_count = len(action_items)
        
        for item in action_items:
            # For assessment items, deduplicate by workflow_ticket_id first, then by assignment_id
            if item.get("source_type") in ["assessment_assignment", "assessment_approval", "assessment_review"]:
                ticket_id = item.get("metadata", {}).get("workflow_ticket_id")
                assignment_id = item.get("source_id") or item.get("metadata", {}).get("assignment_id")
                
                # Prefer items with workflow_ticket_id for deduplication
                if ticket_id:
                    if ticket_id not in seen_tickets:
                        seen_tickets[ticket_id] = item
                        deduplicated_items.append(item)
                    else:
                        # Keep the one with more complete metadata or higher priority
                        existing = seen_tickets[ticket_id]
                        existing_index = deduplicated_items.index(existing)
                        if (len(item.get("metadata", {})) > len(existing.get("metadata", {})) or
                            item.get("priority") == "high" and existing.get("priority") != "high"):
                            # Replace existing with this one
                            deduplicated_items[existing_index] = item
                            seen_tickets[ticket_id] = item
                elif assignment_id:
                    if assignment_id not in seen_assignments:
                        seen_assignments[assignment_id] = item
                        deduplicated_items.append(item)
                    else:
                        # Keep the one with more complete metadata or higher priority
                        existing = seen_assignments[assignment_id]
                        existing_index = deduplicated_items.index(existing)
                        if (len(item.get("metadata", {})) > len(existing.get("metadata", {})) or
                            item.get("priority") == "high" and existing.get("priority") != "high"):
                            # Replace existing with this one
                            deduplicated_items[existing_index] = item
                            seen_assignments[assignment_id] = item
                else:
                    # No ticket_id or assignment_id, add as-is
                    deduplicated_items.append(item)
            else:
                # Non-assessment items, add as-is
                deduplicated_items.append(item)
        
        action_items = deduplicated_items
        removed_count = original_count - len(action_items)
        logger.info(f"After deduplication: {len(action_items)} items (removed {removed_count} duplicates)")
        
        # Calculate counts from ALL items BEFORE filtering by status
        # This ensures accurate counts regardless of status filter
        all_items_for_counts = action_items.copy()
        
        # Separate into pending and completed from ALL items (for accurate counts)
        def get_sort_key(item):
            """Sort by assigned_at descending (newest first)"""
            try:
                assigned_at = item.get("assigned_at")
                if assigned_at:
                    if isinstance(assigned_at, str):
                        # Parse ISO format string
                        assigned_at = datetime.fromisoformat(assigned_at.replace('Z', '+00:00'))
                    return assigned_at
                else:
                    return datetime.min
            except (ValueError, TypeError) as e:
                logger.warning(f"Error parsing assigned_at for sorting action item {item.get('id')}: {e}")
                return datetime.min
        
        # Calculate counts from all items (before any filtering)
        all_pending_items = [
            item for item in all_items_for_counts 
            if item["status"] in [ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value]
            and item["status"] != ActionItemStatus.COMPLETED.value
        ]
        all_completed_items = [item for item in all_items_for_counts if item["status"] == ActionItemStatus.COMPLETED.value]
        
        # Calculate overdue items from all pending items
        all_overdue_items = []
        for item in all_pending_items:
            if item.get("due_date"):
                try:
                    if isinstance(item["due_date"], str):
                        due_date = datetime.fromisoformat(item["due_date"].replace('Z', '+00:00'))
                    else:
                        due_date = item["due_date"]
                    if due_date < datetime.utcnow():
                        all_overdue_items.append(item)
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error parsing due_date for overdue check on action item {item.get('id')}: {e}")
                    continue
        
        # Store accurate counts from all items
        accurate_pending_count = len(all_pending_items)
        accurate_completed_count = len(all_completed_items)
        accurate_overdue_count = len(all_overdue_items)
        
        logger.info(f"Accurate counts (from all items): pending={accurate_pending_count}, completed={accurate_completed_count}, overdue={accurate_overdue_count}")
        
        # Now apply status filter to action_items for the actual returned list
        logger.info(f"Before status filter: {len(action_items)} total items in action_items")
        if status:
            if status == "pending":
                before_count = len(action_items)
                action_items = [item for item in action_items if item["status"] in [ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value]]
                after_count = len(action_items)
                logger.info(f"After status='pending' filter: {before_count} → {after_count} items")
            elif status == "completed":
                action_items = [item for item in action_items if item["status"] == ActionItemStatus.COMPLETED.value]
            elif status == "overdue":
                # Filter overdue items - handle date parsing errors gracefully
                overdue_items = []
                for item in action_items:
                    if item.get("due_date"):
                        try:
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
        
        # Sort by assigned_at (newest first)
        action_items.sort(key=get_sort_key, reverse=True)
        
        # Separate into pending and completed from filtered items (for returned lists)
        pending_items = [
            item for item in action_items 
            if item["status"] in [ActionItemStatus.PENDING.value, ActionItemStatus.IN_PROGRESS.value]
            and item["status"] != ActionItemStatus.COMPLETED.value
        ]
        completed_items = [item for item in action_items if item["status"] == ActionItemStatus.COMPLETED.value]
        
        # Sort pending and completed items separately by assigned_at (newest first)
        pending_items.sort(key=get_sort_key, reverse=True)
        completed_items.sort(key=get_sort_key, reverse=True)
        
        logger.info(f"After creating pending_items: pending_items count={len(pending_items)}, completed_items count={len(completed_items)}")
        
        # Calculate overdue items from filtered pending items
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
            "pending_count": accurate_pending_count,  # Use accurate count from all items
            "completed_count": accurate_completed_count,  # Use accurate count from all items
            "overdue_count": accurate_overdue_count  # Use accurate count from all items
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
