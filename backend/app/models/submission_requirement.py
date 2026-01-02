"""
Submission requirement models for tenant-specific agent submission forms
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base
import enum


class RequirementFieldType(str, enum.Enum):
    """Field types for submission requirements"""
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    DATE = "date"
    FILE = "file"
    URL = "url"
    EMAIL = "email"


class RequirementType(str, enum.Enum):
    """Requirement type classification"""
    COMPLIANCE = "compliance"
    RISK = "risk"
    QUESTIONNAIRES = "questionnaires"


class SubmissionRequirement(Base):
    """Submission requirement definition (tenant-specific form fields)"""
    __tablename__ = "submission_requirements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Requirement details
    label = Column(String(255), nullable=False)  # Title: Question/Field label (human-readable)
    field_type = Column(String(50), nullable=False)  # RequirementFieldType
    description = Column(Text, nullable=True)  # Description: Help text/context
    placeholder = Column(String(255), nullable=True)  # Placeholder text
    
    # Validation
    is_required = Column(Boolean, default=False)
    min_length = Column(Integer, nullable=True)
    max_length = Column(Integer, nullable=True)
    min_value = Column(Integer, nullable=True)
    max_value = Column(Integer, nullable=True)
    pattern = Column(String(255), nullable=True)  # Regex pattern
    options = Column(JSON, nullable=True)  # For select/radio/checkbox options
    
    # Organization and categorization
    requirement_type = Column(String(50), nullable=True)  # RequirementType: compliance, risk, questionnaires (MANDATORY after migration)
    category = Column(String(100), nullable=True)  # security, compliance, technical, business
    section = Column(String(100), nullable=True)  # Group related fields (e.g., "Data Privacy", "Security Controls")
    questionnaire_type = Column(String(100), nullable=True)  # TPRM- Questionnaire, Vendor Security Questionnaire, Sub Contractor Questionnaire, Vendor Qualification
    order = Column(Integer, default=0)  # Display order within section
    catalog_id = Column(String(50), nullable=True, index=True)  # Human-readable catalog ID: REQ-COM-01, REQ-SEC-02, etc. (unique per tenant)
    
    # Questionnaire-style: Multiple response types allowed per question
    # JSON array: ["text", "file", "url"] - allows vendor to respond with text, upload file, or provide link
    allowed_response_types = Column(JSON, nullable=True)  # Default: based on field_type, can override for multi-type responses
    # Example: {"text": true, "file": true, "url": true} or ["text", "file", "url"]
    
    # Filtering: Show requirement based on agent metadata
    # JSON structure for conditional display based on agent category, type, etc.
    # Example: {"agent_category": ["Security & Compliance"], "agent_type": ["AI_AGENT"]}
    filter_conditions = Column(JSON, nullable=True)  # Conditions for when to show this requirement
    
    # Industry applicability: Which industries this requirement applies to
    # JSON array: ["healthcare", "finance"] or ["all"] for all industries
    # If null or empty, applies to all industries (backward compatibility)
    applicable_industries = Column(JSON, nullable=True)  # Array of industries or ["all"]
    
    # Auto-generation metadata
    source_type = Column(String(50), nullable=True)  # "framework", "risk", "category", "manual"
    source_id = Column(String(255), nullable=True)  # ID of the source (framework_id, risk_id, category name)
    source_name = Column(String(255), nullable=True)  # Name of the source for display
    is_auto_generated = Column(Boolean, default=False)  # Whether this was auto-generated
    is_enabled = Column(Boolean, default=True)  # Whether this requirement is enabled (can be toggled)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def field_name(self) -> str:
        """Compute field_name from catalog_id (not stored as column)
        Entity design: Entity has Title (label) and Description, field_name is computed from catalog_id
        """
        catalog_id = getattr(self, 'catalog_id')
        if catalog_id is None or catalog_id == "":
            # Fallback: use id if catalog_id not set (for backward compatibility)
            return f"req_{str(self.id).replace('-', '_')[:36]}"
        # Convert catalog_id (e.g., "REQ-COM-01") to field_name (e.g., "req_com_01")
        import re
        field_name = self.catalog_id.lower().replace('-', '_')
        field_name = re.sub(r'[^a-z0-9_]+', '_', field_name)
        field_name = re.sub(r'_+', '_', field_name).strip('_')
        return field_name[:50] if field_name else f"req_{str(self.id).replace('-', '_')[:36]}"


class SubmissionRequirementResponse(Base):
    """Agent submission requirement responses"""
    __tablename__ = "submission_requirement_responses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("submission_requirements.id"), nullable=False, index=True)
    
    # Response value (can be string, number, array, etc. - stored as JSON)
    # For questionnaire-style: can contain multiple response types
    # Example: {"text": "Explanation text", "files": ["file1.pdf", "file2.jpg"], "links": ["https://drive.google.com/..."]}
    value = Column(JSON, nullable=True)
    
    # File uploads (multiple files supported for questionnaire responses)
    # JSON array of file objects: [{"path": "...", "name": "...", "size": 1234, "type": "application/pdf"}]
    file_path = Column(Text, nullable=True)  # Deprecated: use value.files instead
    file_name = Column(String(255), nullable=True)  # Deprecated: use value.files instead
    file_size = Column(Integer, nullable=True)  # Deprecated: use value.files instead
    file_type = Column(String(100), nullable=True)  # Deprecated: use value.files instead
    
    # Metadata
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
