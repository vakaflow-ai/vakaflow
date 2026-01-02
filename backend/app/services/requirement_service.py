"""
Service layer for submission requirements business logic
Follows separation of concerns - business logic separated from API routes
"""
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.submission_requirement import SubmissionRequirement
from app.core.audit import audit_service, AuditAction
import logging

logger = logging.getLogger(__name__)


class RequirementService:
    """Service for managing submission requirements"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_catalog_id(
        self,
        tenant_id: UUID,
        requirement_type: str,
        category: Optional[str] = None,
        questionnaire_type: Optional[str] = None
    ) -> str:
        """Generate a unique catalog ID for a requirement
        
        Format: REQ-{CATEGORY}-{SEQ}
        Examples:
        - REQ-SEC-01, REQ-SEC-02 (Security requirements)
        - REQ-COM-01 (Compliance requirements)
        - REQ-TPRM-01 (TPRM Questionnaire)
        
        Args:
            tenant_id: Tenant UUID
            requirement_type: Type of requirement (compliance, risk, questionnaires)
            category: Optional category (security, compliance, etc.)
            questionnaire_type: Optional questionnaire type
        
        Returns:
            Unique catalog ID string (e.g., "REQ-SEC-01")
        """
        # Determine category prefix
        if questionnaire_type:
            if 'TPRM' in questionnaire_type.upper():
                category_prefix = 'TPRM'
            elif 'SECURITY' in questionnaire_type.upper() or 'SEC' in questionnaire_type.upper():
                category_prefix = 'VSEC'
            elif 'SUB' in questionnaire_type.upper() or 'CONTRACTOR' in questionnaire_type.upper():
                category_prefix = 'SCON'
            elif 'QUALIFICATION' in questionnaire_type.upper() or 'QUAL' in questionnaire_type.upper():
                category_prefix = 'VQUA'
            else:
                category_prefix = questionnaire_type[:4].upper().replace(' ', '').replace('-', '')
        elif category:
            category_prefix = category[:3].upper()
        else:
            category_prefix = 'GEN'
        
        # Find next sequence number for this tenant + category
        base_query = self.db.query(SubmissionRequirement).filter(
            SubmissionRequirement.tenant_id == tenant_id,
            SubmissionRequirement.is_active == True
        )
        
        if questionnaire_type:
            base_query = base_query.filter(SubmissionRequirement.questionnaire_type == questionnaire_type)
        elif category:
            base_query = base_query.filter(SubmissionRequirement.category == category)
        else:
            base_query = base_query.filter(
                (SubmissionRequirement.category == None) | (SubmissionRequirement.category == '')
            )
        
        existing_count = base_query.count()
        seq_num = existing_count + 1
        
        # Generate catalog ID
        catalog_id = f"REQ-{category_prefix}-{seq_num:02d}"
        
        # Ensure uniqueness (handle race conditions)
        max_attempts = 100
        attempt = 0
        while attempt < max_attempts:
            existing = self.db.query(SubmissionRequirement).filter(
                SubmissionRequirement.catalog_id == catalog_id,
                SubmissionRequirement.tenant_id == tenant_id
            ).first()
            if not existing:
                break
            seq_num += 1
            catalog_id = f"REQ-{category_prefix}-{seq_num:02d}"
            attempt += 1
        
        return catalog_id
    
    def create_requirement(
        self,
        requirement_data: dict,
        tenant_id: UUID,
        created_by: UUID
    ) -> SubmissionRequirement:
        """Create a new submission requirement
        
        Args:
            requirement_data: Requirement data dictionary
            tenant_id: Tenant UUID
            created_by: User UUID who created the requirement
        
        Returns:
            Created SubmissionRequirement instance
        
        Raises:
            ValueError: If field_name already exists or validation fails
            IntegrityError: If database constraint violation
        """
        # Check if catalog_id already exists for this tenant (field_name is computed from catalog_id)
        catalog_id = requirement_data.get('catalog_id')
        if catalog_id:
            existing = self.db.query(SubmissionRequirement).filter(
                SubmissionRequirement.tenant_id == tenant_id,
                SubmissionRequirement.catalog_id == catalog_id,
                SubmissionRequirement.is_active == True
            ).first()
            
            if existing:
                raise ValueError(f"Catalog ID '{catalog_id}' already exists for this tenant")
        
        # Generate catalog_id if not provided
        if not requirement_data.get('catalog_id'):
            catalog_id = self.generate_catalog_id(
                tenant_id=tenant_id,
                requirement_type=requirement_data.get('requirement_type', 'compliance'),
                category=requirement_data.get('category'),
                questionnaire_type=requirement_data.get('questionnaire_type')
            )
            requirement_data['catalog_id'] = catalog_id
        
        # Create requirement
        requirement = SubmissionRequirement(
            tenant_id=tenant_id,
            created_by=created_by,
            source_type="manual",
            is_auto_generated=False,
            is_enabled=True,
            is_active=True,
            **requirement_data
        )
        
        try:
            self.db.add(requirement)
            self.db.commit()
            self.db.refresh(requirement)
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(created_by),
                action=AuditAction.CREATE,
                resource_type="submission_requirement",
                resource_id=str(requirement.id),
                tenant_id=str(tenant_id),
                details={"label": requirement.label, "catalog_id": requirement.catalog_id},
                ip_address=None,
                user_agent=None
            )
            
            return requirement
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error creating requirement: {e}")
            raise ValueError("Failed to create requirement due to database constraint violation")
    
    def update_requirement(
        self,
        requirement_id: UUID,
        update_data: dict,
        updated_by: UUID
    ) -> SubmissionRequirement:
        """Update an existing requirement
        
        Args:
            requirement_id: Requirement UUID
            update_data: Dictionary of fields to update
            updated_by: User UUID who updated the requirement
        
        Returns:
            Updated SubmissionRequirement instance
        
        Raises:
            ValueError: If requirement not found
        """
        requirement = self.db.query(SubmissionRequirement).filter(
            SubmissionRequirement.id == requirement_id
        ).first()
        
        if not requirement:
            raise ValueError(f"Requirement with ID {requirement_id} not found")
        
        # Update fields
        for key, value in update_data.items():
            if hasattr(requirement, key) and value is not None:
                setattr(requirement, key, value)
        
        try:
            self.db.commit()
            self.db.refresh(requirement)
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(updated_by),
                action=AuditAction.UPDATE,
                resource_type="submission_requirement",
                resource_id=str(requirement_id),
                tenant_id=str(requirement.tenant_id),
                details={"updated_fields": list(update_data.keys())},
                ip_address=None,
                user_agent=None
            )
            
            return requirement
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error updating requirement: {e}")
            raise ValueError("Failed to update requirement due to database constraint violation")
    
    def delete_requirement(
        self,
        requirement_id: UUID,
        deleted_by: UUID
    ) -> None:
        """Delete a requirement (soft delete by setting is_active=False)
        
        Args:
            requirement_id: Requirement UUID
            deleted_by: User UUID who deleted the requirement
        
        Raises:
            ValueError: If requirement not found
        """
        requirement = self.db.query(SubmissionRequirement).filter(
            SubmissionRequirement.id == requirement_id
        ).first()
        
        if not requirement:
            raise ValueError(f"Requirement with ID {requirement_id} not found")
        
        # Allow deletion of all requirements, including auto-generated ones
        # Soft delete
        requirement.is_active = False
        
        try:
            self.db.commit()
            
            # Audit log
            audit_service.log_action(
                db=self.db,
                user_id=str(deleted_by),
                action=AuditAction.DELETE,
                resource_type="submission_requirement",
                resource_id=str(requirement_id),
                tenant_id=str(requirement.tenant_id),
                details={"label": requirement.label, "catalog_id": requirement.catalog_id},
                ip_address=None,
                user_agent=None
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting requirement: {e}")
            raise ValueError("Failed to delete requirement")
