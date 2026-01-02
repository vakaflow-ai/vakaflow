"""
Assessment Review Model - For AI and human reviews of questionnaire responses
"""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Boolean, JSON, Float, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class ReviewType(str, enum.Enum):
    """Type of review"""
    AI_REVIEW = "ai_review"  # Automated AI review
    HUMAN_REVIEW = "human_review"  # Human reviewer
    HYBRID = "hybrid"  # AI + Human


class ReviewStatus(str, enum.Enum):
    """Review status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AssessmentReview(Base):
    """Review of an assessment assignment - tracks AI and human reviews"""
    __tablename__ = "assessment_reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assessment_assignments.id"), nullable=False, index=True)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True)
    
    # Review type and status
    review_type = Column(String(50), nullable=False, default=ReviewType.AI_REVIEW.value)  # ai_review, human_review, hybrid
    status = Column(String(50), nullable=False, default=ReviewStatus.PENDING.value)
    
    # AI Review Details
    ai_agent_id = Column(UUID(as_uuid=True), ForeignKey("agentic_agents.id"), nullable=True)  # AI agent that performed review
    ai_review_completed_at = Column(DateTime, nullable=True)
    
    # Risk Scoring
    risk_score = Column(Float, nullable=True)  # Overall risk score (0-100)
    risk_level = Column(String(50), nullable=True)  # low, medium, high, critical
    risk_factors = Column(JSON, nullable=True)  # List of risk factors identified
    
    # Review Analysis
    analysis_summary = Column(Text, nullable=True)  # Summary of analysis
    flagged_risks = Column(JSON, nullable=True)  # List of flagged risks with details
    flagged_questions = Column(JSON, nullable=True)  # Questions that need followup
    recommendations = Column(JSON, nullable=True)  # Recommendations for vendor
    
    # Human Reviewer Assignment
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # Human reviewer
    assigned_at = Column(DateTime, nullable=True)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Who assigned (system or user)
    assignment_method = Column(String(50), nullable=True)  # agent_config, flow_config, rule_based, manual
    
    # Human Review Details
    human_review_started_at = Column(DateTime, nullable=True)
    human_review_completed_at = Column(DateTime, nullable=True)
    human_review_notes = Column(Text, nullable=True)
    human_risk_score = Column(Float, nullable=True)  # Human reviewer's risk score
    human_decision = Column(String(50), nullable=True)  # approved, rejected, needs_revision, conditional
    
    # Followup Actions
    followup_sent = Column(Boolean, default=False)
    followup_sent_at = Column(DateTime, nullable=True)
    followup_questions = Column(JSON, nullable=True)  # Questions sent to vendor for followup
    
    # Audit Trail
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # System or user who triggered review
    review_metadata = Column(JSON, nullable=True)  # Additional metadata for tracking
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("AssessmentAssignment", foreign_keys=[assignment_id])
    assessment = relationship("Assessment", foreign_keys=[assessment_id])
    # vendor = relationship("Vendor", foreign_keys=[vendor_id])  # Will be loaded when needed
    ai_agent = relationship("AgenticAgent", foreign_keys=[ai_agent_id])
    reviewer = relationship("User", foreign_keys=[assigned_to])


class QuestionReviewStatus(str, enum.Enum):
    """Status for individual question review"""
    PENDING = "pending"  # Not yet reviewed
    PASS = "pass"  # Approved/passed - green tick
    FAIL = "fail"  # Failed - red cross
    IN_PROGRESS = "in_progress"  # In progress - yellow indicator
    RESOLVED = "resolved"  # Previously failed/in_progress, now resolved


class AssessmentQuestionReview(Base):
    """Per-question review status and comments"""
    __tablename__ = "assessment_question_reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("assessment_reviews.id"), nullable=False, index=True)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assessment_assignments.id"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("assessment_questions.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Review status
    status = Column(String(50), nullable=False, default=QuestionReviewStatus.PENDING.value)
    
    # Reviewer information
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Comments (mandatory for fail/in_progress)
    reviewer_comment = Column(Text, nullable=True)  # Comment from reviewer
    vendor_comment = Column(Text, nullable=True)  # Comment from vendor (for followup)
    
    # Resolution tracking
    is_resolved = Column(Boolean, default=False)  # Whether the issue has been resolved
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    review = relationship("AssessmentReview", foreign_keys=[review_id])
    assignment = relationship("AssessmentAssignment", foreign_keys=[assignment_id])
    question = relationship("AssessmentQuestion", foreign_keys=[question_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    
    # Unique constraint: one review per question per review
    __table_args__ = (
        UniqueConstraint('review_id', 'question_id', name='uq_review_question'),
    )


class AssessmentReviewAudit(Base):
    """Audit trail for assessment reviews - tracks all review activities"""
    __tablename__ = "assessment_review_audits"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("assessment_reviews.id"), nullable=False, index=True)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assessment_assignments.id"), nullable=False, index=True)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True)
    
    # Audit details
    action = Column(String(100), nullable=False)  # review_started, risk_scored, risk_flagged, reviewer_assigned, email_sent, etc.
    actor_type = Column(String(50), nullable=False)  # ai_agent, human_user, system
    actor_id = Column(UUID(as_uuid=True), nullable=True)  # User ID or Agent ID
    actor_name = Column(String(255), nullable=True)  # Human-readable name
    
    # Action details
    action_data = Column(JSON, nullable=True)  # Detailed data about the action
    previous_state = Column(JSON, nullable=True)  # Previous state before action
    new_state = Column(JSON, nullable=True)  # New state after action
    
    # Context
    questionnaire_id = Column(String(100), nullable=True)  # Assessment ID for tracking
    vendor_name = Column(String(255), nullable=True)  # Vendor name for easy tracking
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    review = relationship("AssessmentReview", foreign_keys=[review_id])
