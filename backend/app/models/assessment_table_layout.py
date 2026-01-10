"""
Assessment Table Layout models for configurable table columns
Allows admins to configure which columns are shown in assessment submission and approver views
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class TableViewType(str, enum.Enum):
    """Table view types for assessments"""
    VENDOR_SUBMISSION = "vendor_submission"  # Vendor submission view
    APPROVER = "approver"  # Approver review view


class AssessmentTableLayout(Base):
    """Assessment table layout configuration for configurable columns"""
    __tablename__ = "assessment_table_layouts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)  # NULL = platform-wide default
    
    # Layout identification
    name = Column(String(255), nullable=False)  # e.g., "Default Vendor Submission Layout", "Custom Approver Layout"
    view_type = Column(String(50), nullable=False)  # TableViewType: vendor_submission, approver
    description = Column(Text, nullable=True)
    
    # Column configuration
    # JSON structure: Array of column definitions
    # [
    #   {
    #     "id": "question",
    #     "label": "Question",
    #     "field": "question_text",
    #     "order": 1,
    #     "width": "30%",
    #     "visible": true,
    #     "sortable": true,
    #     "type": "text"  # text, action, comments, attachments, etc.
    #   },
    #   {
    #     "id": "vendor_response",
    #     "label": "Vendor Response",
    #     "field": "response_value",
    #     "order": 2,
    #     "width": "25%",
    #     "visible": true,
    #     "sortable": false,
    #     "type": "response"
    #   },
    #   {
    #     "id": "action",
    #     "label": "Action",
    #     "field": null,
    #     "order": 3,
    #     "width": "20%",
    #     "visible": true,
    #     "sortable": false,
    #     "type": "action"  # Only for approver view
    #   },
    #   {
    #     "id": "comments",
    #     "label": "Comments",
    #     "field": "comments",
    #     "order": 4,
    #     "width": "25%",
    #     "visible": true,
    #     "sortable": false,
    #     "type": "comments"
    #   }
    # ]
    columns = Column(JSON, nullable=False, default=list)
    
    # Table display configuration
    # JSON structure for table behavior settings
    # {
    #   "default_expanded": true,  # Whether categories are expanded by default
    #   "group_by": "category",  # Group by field: "category", "section", "none"
    #   "show_attachments_by_default": true,  # Show attachments column by default
    #   "enable_collapse": true,  # Allow users to collapse/expand groups
    # }
    display_config = Column(JSON, nullable=True, default=dict)  # Table display configuration
    
    # Default columns available for each view type
    # These are the standard columns that can be configured
    AVAILABLE_COLUMNS = {
        "vendor_submission": [
            {"id": "question", "label": "Question", "field": "question_text", "type": "text", "default_visible": True},
            {"id": "assignee", "label": "Assignee", "field": "assignee", "type": "assignee", "default_visible": True},
            {"id": "vendor_answer", "label": "Vendor Answer", "field": "response_value", "type": "response", "default_visible": True},
            {"id": "comments", "label": "Comments", "field": "comments", "type": "comments", "default_visible": True},
            {"id": "attachments", "label": "Attachments", "field": "attachments", "type": "attachments", "default_visible": True},
            {"id": "category", "label": "Category", "field": "category", "type": "text", "default_visible": False},
            {"id": "status", "label": "Status", "field": "status", "type": "status", "default_visible": False},
        ],
        "approver": [
            {"id": "question", "label": "Question", "field": "question_text", "type": "text", "default_visible": True},
            {"id": "vendor_response", "label": "Vendor Response", "field": "response_value", "type": "response", "default_visible": True},
            {"id": "action", "label": "Action", "field": None, "type": "action", "default_visible": True},
            {"id": "comments", "label": "Comments", "field": "comments", "type": "comments", "default_visible": True},
            {"id": "category", "label": "Category", "field": "category", "type": "text", "default_visible": False},
            {"id": "review_status", "label": "Review Status", "field": "review_status", "type": "status", "default_visible": False},
        ]
    }
    
    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Default layout for this view type
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        {'comment': 'Assessment table layout configuration for configurable columns in submission and approver views'}
    )
