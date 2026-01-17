"""
Assessment/Evaluation models for managing vendor and agent assessments
Supports TPRM, Vendor Qualification, Risk Assessment, AI-Vendor Qualification, etc.
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class AssessmentType(str, enum.Enum):
    """Assessment type classification"""
    TPRM = "tprm"  # Third-Party Risk Management
    VENDOR_QUALIFICATION = "vendor_qualification"
    RISK_ASSESSMENT = "risk_assessment"
    AI_VENDOR_QUALIFICATION = "ai_vendor_qualification"
    SECURITY_ASSESSMENT = "security_assessment"
    COMPLIANCE_ASSESSMENT = "compliance_assessment"
    CUSTOM = "custom"


class AssessmentStatus(str, enum.Enum):
    """Assessment status"""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    SCHEDULED = "scheduled"


class ScheduleFrequency(str, enum.Enum):
    """Assessment schedule frequency"""
    QUARTERLY = "quarterly"  # Every 3 months
    YEARLY = "yearly"  # Every 12 months
    MONTHLY = "monthly"  # Every month
    BI_ANNUAL = "bi_annual"  # Every 6 months
    ONE_TIME = "one_time"  # Single assessment
    CUSTOM = "custom"  # Custom interval


class QuestionType(str, enum.Enum):
    """Question type - can be a new question or reference to existing requirement"""
    NEW_QUESTION = "new_question"  # Question defined within assessment
    REQUIREMENT_REFERENCE = "requirement_reference"  # References existing submission requirement


class AssessmentApprovalStatus(str, enum.Enum):
    """Assessment approval status"""
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DENIED = "denied"
    NEEDS_INFO = "needs_info"
    CANCELLED = "cancelled"


class AssessmentDecision(str, enum.Enum):
    """Assessment decision types"""
    ACCEPT = "accept"
    DENY = "deny"
    CLARIFY = "clarify"


class AssessmentApprovalWorkflow(str, enum.Enum):
    """Assessment approval workflow types"""
    ASSESSMENT_APPROVAL = "assessment_approval"


class Assessment(Base):
    """Assessment/Evaluation definition"""
    __tablename__ = "assessments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Basic Information
    assessment_id = Column(String(100), nullable=True, unique=True, index=True)  # Human-readable assessment ID
    name = Column(String(255), nullable=False)  # Assessment name (e.g., "TPRM Assessment 2024")
    assessment_type = Column(String(50), nullable=False)  # AssessmentType
    description = Column(Text, nullable=True)  # Assessment description
    business_purpose = Column(Text, nullable=True)  # Business purpose of the assessment
    status = Column(String(50), nullable=False, default=AssessmentStatus.DRAFT.value)  # AssessmentStatus
    
    # Ownership and Management
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # Assessment owner
    team_ids = Column(JSON, nullable=True)  # Array of team/user IDs who can manage this assessment
    
    # Rule-based Assignment Configuration
    # JSON structure defining when this assessment should be assigned
    # Example: {
    #   "vendor_attributes": {"category": ["Security & Compliance"], "type": ["AI_AGENT"]},
    #   "agent_attributes": {"risk_level": ["high", "medium"]},
    #   "master_data_tags": {"department": ["IT", "Security"], "business_unit": ["Engineering"]},
    #   "apply_to": ["vendor_onboarding", "agent_onboarding"]  # or both
    # }
    assignment_rules = Column(JSON, nullable=True)  # Rule-based assignment configuration
    
    # Scheduling
    schedule_enabled = Column(Boolean, default=False)  # Whether scheduling is enabled
    schedule_frequency = Column(String(50), nullable=True)  # ScheduleFrequency
    schedule_interval_months = Column(Integer, nullable=True)  # Custom interval in months (if frequency is CUSTOM)
    last_scheduled_date = Column(DateTime, nullable=True)  # Last time assessment was scheduled
    next_scheduled_date = Column(DateTime, nullable=True)  # Next scheduled date
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # User who last updated
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    questions = relationship("AssessmentQuestion", back_populates="assessment", cascade="all, delete-orphan", order_by="AssessmentQuestion.order")
    schedules = relationship("AssessmentSchedule", back_populates="assessment", cascade="all, delete-orphan")
    assignments = relationship("AssessmentAssignment", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentQuestion(Base):
    """Questions within an assessment - can be new questions or references to existing requirements"""
    __tablename__ = "assessment_questions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Question Type
    question_type = Column(String(50), nullable=False)  # QuestionType: new_question or requirement_reference
    
    # For NEW_QUESTION type
    title = Column(String(255), nullable=True)  # Question title
    question_text = Column(Text, nullable=True)  # Question text (if new question)
    description = Column(Text, nullable=True)  # Question description
    field_type = Column(String(50), nullable=True)  # Field type (text, textarea, select, etc.) - same as RequirementFieldType
    response_type = Column(String(50), nullable=True)  # ResponseType: Text, File, Number, Date, etc.
    category = Column(String(100), nullable=True)  # Question category
    is_required = Column(Boolean, default=False)
    options = Column(JSON, nullable=True)  # For select/radio/checkbox options
    validation_rules = Column(JSON, nullable=True)  # Min/max length, pattern, etc.
    
    # For REQUIREMENT_REFERENCE type
    # Using string reference to avoid circular import - table name is 'submission_requirements'
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("submission_requirements.id", ondelete="SET NULL"), nullable=True, index=True)
    # If requirement_id is set, question_text and field_type are derived from the requirement
    
    # Ordering and Display
    order = Column(Integer, default=0)  # Display order within assessment
    section = Column(String(100), nullable=True)  # Optional section grouping
    
    # Reusability
    is_reusable = Column(Boolean, default=False)  # Can this question be reused in other assessments?
    reusable_question_id = Column(UUID(as_uuid=True), ForeignKey("assessment_questions.id"), nullable=True)  # If this is a reference to a reusable question
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="questions")
    requirement = relationship("SubmissionRequirement", foreign_keys=[requirement_id])


class AssessmentSchedule(Base):
    """Assessment schedule instances - tracks when assessments are scheduled/triggered"""
    __tablename__ = "assessment_schedules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Schedule Details
    scheduled_date = Column(DateTime, nullable=False)  # When assessment should be triggered
    due_date = Column(DateTime, nullable=True)  # When assessment responses are due
    frequency = Column(String(50), nullable=False)  # ScheduleFrequency
    
    # Vendor Selection (based on matching to last schedule)
    # JSON array of vendor IDs selected for this schedule instance
    # If empty, vendors are auto-selected based on assignment_rules
    selected_vendor_ids = Column(JSON, nullable=True)  # Array of vendor UUIDs
    
    # Status
    status = Column(String(50), nullable=False, default="pending")  # pending, in_progress, completed, cancelled
    triggered_at = Column(DateTime, nullable=True)  # When assessment was actually triggered
    completed_at = Column(DateTime, nullable=True)  # When all responses were collected
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="schedules")
    assignments = relationship("AssessmentAssignment", back_populates="schedule", cascade="all, delete-orphan")


class AssessmentAssignment(Base):
    """Individual assessment assignments to vendors/agents/products/services"""
    __tablename__ = "assessment_assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("assessment_schedules.id"), nullable=True, index=True)  # If part of a scheduled assessment
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Assignment Target - Entity-agnostic approach
    entity_type = Column(String(50), nullable=True, index=True)  # "agent", "product", "service", "vendor"
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Generic entity ID (can reference agent, product, service, or vendor)
    
    # Legacy fields - kept for backward compatibility, but entity_type/entity_id should be preferred
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True)  # If assigned to vendor
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True, index=True)  # If assigned to specific agent
    
    # Assignment Context
    assignment_type = Column(String(50), nullable=False)  # "vendor_onboarding", "agent_onboarding", "product_qualification", "service_qualification", "scheduled"
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # Who assigned this
    
    # Status and Tracking
    status = Column(String(50), nullable=False, default="pending")  # pending, in_progress, completed, overdue, cancelled
    assigned_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)  # When vendor started filling
    completed_at = Column(DateTime, nullable=True)  # When all responses submitted
    due_date = Column(DateTime, nullable=True)  # Due date for completion
    workflow_ticket_id = Column(String(50), nullable=True, index=True)  # Human-friendly workflow ticket ID (e.g., ASMT-2025-001)
    
    # Response Data
    # Responses are stored in submission_requirement_responses table (integrated)
    # This table tracks the assignment and completion status
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="assignments")
    schedule = relationship("AssessmentSchedule", back_populates="assignments")
    question_responses = relationship("AssessmentQuestionResponse", back_populates="assignment", cascade="all, delete-orphan")


class AssessmentQuestionResponse(Base):
    """Responses to assessment questions - stores vendor/user responses"""
    __tablename__ = "assessment_question_responses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assessment_assignments.id"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("assessment_questions.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Response value (can be string, number, array, etc. - stored as JSON)
    value = Column(JSON, nullable=True)
    
    # Comments and additional data
    comment = Column(Text, nullable=True)  # Vendor/user comment on the response
    
    # File uploads (multiple files supported)
    # JSON array of file objects: [{"path": "...", "name": "...", "size": 1234, "type": "application/pdf"}]
    documents = Column(JSON, nullable=True)  # Array of document metadata
    
    # AI Evaluation Results (from pass/fail criteria evaluation)
    # JSON structure: {
    #   "status": "passed" | "failed" | "review",
    #   "confidence": 0.0-1.0,
    #   "reasoning": "Explanation of evaluation",
    #   "evaluated_at": "ISO timestamp",
    #   "evaluated_by": "ai_system"
    # }
    ai_evaluation = Column(JSON, nullable=True)  # AI evaluation result
    
    # Metadata
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # Assigned owner for the question
    assigned_at = Column(DateTime, nullable=True)  # When the question was assigned
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Who assigned the question
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("AssessmentAssignment", back_populates="question_responses")
    question = relationship("AssessmentQuestion")
    owner = relationship("User", foreign_keys=[owner_id])
    
    # Unique constraint: one response per question per assignment
    __table_args__ = (
        UniqueConstraint('assignment_id', 'question_id', name='uq_assignment_question_response'),
    )
