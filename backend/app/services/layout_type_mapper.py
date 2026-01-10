"""
Layout Type Mapper
Maps workflow stages to simplified layout types to reduce configuration complexity.

Instead of creating separate layouts for each workflow stage, we use 2 layout types:
- submission: For initial submission, resubmission, and rejection
- approver: For review, approval, and completed states

Permissions control what users see based on their role.
"""
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


# Map workflow stages to layout types
STAGE_TO_LAYOUT_TYPE: Dict[str, str] = {
    # Submission layouts (for initial submission, resubmission, and rejection)
    "new": "submission",
    "needs_revision": "submission",
    "rejected": "submission",
    
    # Approver layouts (for review, approval, and completed states)
    "pending_approval": "approver",
    "pending_review": "approver",
    "in_progress": "approver",
    "approved": "approver",
    "closed": "approver",
    "cancelled": "approver",
}


def get_layout_type_for_stage(workflow_stage: str) -> str:
    """
    Get layout type for a workflow stage
    
    Args:
        workflow_stage: Workflow stage (e.g., "new", "pending_approval", "approved")
    
    Returns:
        Layout type: "submission" or "approver"
    """
    return STAGE_TO_LAYOUT_TYPE.get(workflow_stage, "submission")


def get_stages_for_layout_type(layout_type: str) -> list[str]:
    """
    Get all workflow stages that map to a layout type
    
    Args:
        layout_type: Layout type ("submission", "approver", or "completed")
    
    Returns:
        List of workflow stages
    """
    return [stage for stage, lt in STAGE_TO_LAYOUT_TYPE.items() if lt == layout_type]

