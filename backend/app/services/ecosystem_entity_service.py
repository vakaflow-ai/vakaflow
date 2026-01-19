"""
Ecosystem Entity Service
Handles unified management of Agents, Products, and Services with shared governance patterns
"""
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
import logging

from app.models.ecosystem_entity import (
    EcosystemEntity, EntityType, EntityStatus, 
    EntityLifecycleEvent, SharedGovernanceProfile
)
from app.models.agent import Agent, AgentMetadata
from app.models.product import Product
from app.models.vendor import Vendor
from app.models.user import User

logger = logging.getLogger(__name__)


class EcosystemEntityService:
    """Service for managing ecosystem entities with unified governance"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_entity(
        self,
        tenant_id: UUID,
        vendor_id: UUID,
        entity_type: EntityType,
        name: str,
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        description: Optional[str] = None,
        version: Optional[str] = None,
        department: Optional[str] = None,
        organization: Optional[str] = None,
        governance_owner_id: Optional[UUID] = None,
        skills: Optional[List[str]] = None,
        **kwargs
    ) -> EcosystemEntity:
        """Create a new ecosystem entity"""
        
        entity = EcosystemEntity(
            tenant_id=tenant_id,
            vendor_id=vendor_id,
            name=name,
            entity_type=entity_type,
            category=category,
            subcategory=subcategory,
            description=description,
            version=version,
            department=department,
            organization=organization,
            governance_owner_id=governance_owner_id,
            skills=skills or [],
            status=EntityStatus.DRAFT,
            **kwargs
        )
        
        self.db.add(entity)
        self.db.commit()
        self.db.refresh(entity)
        
        # Log creation event
        self._log_lifecycle_event(
            entity_id=entity.id,
            tenant_id=tenant_id,
            event_type="created",
            to_status=EntityStatus.DRAFT,
            reason=f"Created new {entity_type.value}: {name}"
        )
        
        logger.info(f"Created ecosystem entity {entity.id} ({entity_type.value}): {name}")
        return entity
    
    def get_entity(self, entity_id: UUID) -> Optional[EcosystemEntity]:
        """Get entity by ID"""
        return self.db.query(EcosystemEntity).filter(EcosystemEntity.id == entity_id).first()
    
    def list_entities(
        self,
        tenant_id: UUID,
        entity_types: Optional[List[EntityType]] = None,
        statuses: Optional[List[EntityStatus]] = None,
        department: Optional[str] = None,
        organization: Optional[str] = None,
        search_term: Optional[str] = None
    ) -> List[EcosystemEntity]:
        """List entities with filters"""
        
        query = self.db.query(EcosystemEntity).filter(EcosystemEntity.tenant_id == tenant_id)
        
        if entity_types:
            query = query.filter(EcosystemEntity.entity_type.in_(entity_types))
        
        if statuses:
            query = query.filter(EcosystemEntity.status.in_(statuses))
        
        if department:
            query = query.filter(EcosystemEntity.department == department)
        
        if organization:
            query = query.filter(EcosystemEntity.organization == organization)
        
        if search_term:
            query = query.filter(
                or_(
                    EcosystemEntity.name.ilike(f"%{search_term}%"),
                    EcosystemEntity.description.ilike(f"%{search_term}%")
                )
            )
        
        return query.order_by(EcosystemEntity.created_at.desc()).all()
    
    def update_entity_status(
        self,
        entity_id: UUID,
        new_status: EntityStatus,
        triggered_by: Optional[UUID] = None,
        reason: Optional[str] = None,
        workflow_step: Optional[str] = None
    ) -> EcosystemEntity:
        """Update entity status and log the change"""
        
        entity = self.get_entity(entity_id)
        if not entity:
            raise ValueError(f"Entity {entity_id} not found")
        
        old_status = entity.status
        entity.status = new_status
        
        # Update lifecycle timestamps
        if new_status == EntityStatus.SUBMITTED and old_status == EntityStatus.DRAFT:
            entity.submission_date = datetime.utcnow()
        elif new_status == EntityStatus.APPROVED and old_status == EntityStatus.IN_REVIEW:
            entity.approval_date = datetime.utcnow()
        elif new_status == EntityStatus.ACTIVE and old_status in [EntityStatus.APPROVED, EntityStatus.PAUSED]:
            entity.activation_date = datetime.utcnow()
        elif new_status == EntityStatus.PAUSED and old_status == EntityStatus.ACTIVE:
            entity.deactivation_date = datetime.utcnow()
        
        entity.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(entity)
        
        # Log the status change
        self._log_lifecycle_event(
            entity_id=entity_id,
            tenant_id=entity.tenant_id,
            event_type=f"status_changed_{old_status.value}_to_{new_status.value}",
            from_status=old_status,
            to_status=new_status,
            triggered_by=triggered_by,
            reason=reason,
            workflow_step=workflow_step
        )
        
        logger.info(f"Updated entity {entity_id} status: {old_status.value} → {new_status.value}")
        return entity
    
    def apply_governance_profile(
        self,
        entity_id: UUID,
        profile_id: UUID,
        applied_by: Optional[UUID] = None
    ) -> EcosystemEntity:
        """Apply a shared governance profile to an entity"""
        
        entity = self.get_entity(entity_id)
        if not entity:
            raise ValueError(f"Entity {entity_id} not found")
        
        profile = self.db.query(SharedGovernanceProfile).filter(
            SharedGovernanceProfile.id == profile_id,
            SharedGovernanceProfile.tenant_id == entity.tenant_id
        ).first()
        
        if not profile:
            raise ValueError(f"Governance profile {profile_id} not found for tenant")
        
        # Apply profile fields to entity
        if profile.security_controls:
            # Merge with existing security controls
            existing_controls = entity.security_controls or []
            entity.security_controls = list(set(existing_controls + profile.security_controls))
        
        if profile.compliance_standards:
            existing_standards = entity.compliance_standards or []
            entity.compliance_standards = list(set(existing_standards + profile.compliance_standards))
        
        # Update profile usage count
        profile.entity_count += 1
        profile.last_applied = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(entity)
        self.db.refresh(profile)
        
        logger.info(f"Applied governance profile {profile_id} to entity {entity_id}")
        return entity
    
    def _log_lifecycle_event(
        self,
        entity_id: UUID,
        tenant_id: UUID,
        event_type: str,
        to_status: EntityStatus,
        from_status: Optional[EntityStatus] = None,
        triggered_by: Optional[UUID] = None,
        reason: Optional[str] = None,
        workflow_step: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None
    ):
        """Log a lifecycle event for an entity"""
        
        event = EntityLifecycleEvent(
            entity_id=entity_id,
            tenant_id=tenant_id,
            event_type=event_type,
            from_status=from_status,
            to_status=to_status,
            triggered_by=triggered_by,
            reason=reason,
            workflow_step=workflow_step,
            event_data=event_data or {}
        )
        
        self.db.add(event)
        # Don't commit here - let the calling function handle transactions
        return event
    
    def get_lifecycle_history(self, entity_id: UUID) -> List[EntityLifecycleEvent]:
        """Get lifecycle history for an entity"""
        return self.db.query(EntityLifecycleEvent).filter(
            EntityLifecycleEvent.entity_id == entity_id
        ).order_by(EntityLifecycleEvent.created_at.desc()).all()
    
    def create_governance_profile(
        self,
        tenant_id: UUID,
        name: str,
        profile_type: str,
        description: Optional[str] = None,
        security_controls: Optional[List[str]] = None,
        compliance_standards: Optional[List[str]] = None,
        monitoring_requirements: Optional[List[str]] = None,
        documentation_templates: Optional[Dict[str, str]] = None,
        created_by: Optional[UUID] = None
    ) -> SharedGovernanceProfile:
        """Create a new shared governance profile"""
        
        profile = SharedGovernanceProfile(
            tenant_id=tenant_id,
            name=name,
            profile_type=profile_type,
            description=description,
            security_controls=security_controls,
            compliance_standards=compliance_standards,
            monitoring_requirements=monitoring_requirements,
            documentation_templates=documentation_templates,
            created_by=created_by
        )
        
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        
        logger.info(f"Created governance profile {profile.id}: {name}")
        return profile
    
    def migrate_existing_agent_to_ecosystem(
        self,
        agent_id: UUID,
        tenant_id: UUID,
        vendor_id: UUID
    ) -> EcosystemEntity:
        """Migrate an existing agent to the ecosystem entity model"""
        
        # Get existing agent
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Get agent metadata
        metadata = self.db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
        
        # Create ecosystem entity
        entity = self.create_entity(
            tenant_id=tenant_id,
            vendor_id=vendor_id,
            entity_type=EntityType.AGENT,
            name=agent.name,
            category=agent.category,
            subcategory=agent.subcategory,
            description=agent.description,
            version=agent.version,
            department=agent.department,
            organization=agent.organization,
            governance_owner_id=agent.governance_owner_id,
            skills=agent.skills,
            service_account=agent.service_account,
            kill_switch_enabled=agent.kill_switch_enabled,
            last_governance_review=agent.last_governance_review,
            compliance_score=agent.compliance_score,
            risk_score=agent.risk_score,
            status=EntityStatus(agent.status) if agent.status else EntityStatus.DRAFT
        )
        
        # Copy metadata fields if they exist
        if metadata:
            entity.security_controls = metadata.security_controls
            entity.compliance_standards = metadata.compliance_standards
            entity.documentation_urls = metadata.documentation_urls
            entity.architecture_diagrams = metadata.architecture_diagrams
            entity.landscape_diagrams = metadata.landscape_diagrams
            entity.integration_points = metadata.integrations
            
            self.db.commit()
            self.db.refresh(entity)
        
        logger.info(f"Migrated agent {agent_id} to ecosystem entity {entity.id}")
        return entity