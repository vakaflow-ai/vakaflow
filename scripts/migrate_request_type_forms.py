#!/usr/bin/env python3
"""
Migration script for Request Type and Form Library consolidation
This script migrates existing request types and forms to the new unified structure
"""

import os
import sys
from typing import List, Dict, Any
import logging

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.models.request_type_config import RequestTypeConfig, RequestTypeFormAssociation
from app.models.form_layout import FormLayout
from app.core.database import SessionLocal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RequestTypeFormMigration:
    def __init__(self):
        self.db = SessionLocal()
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.db.rollback()
            logger.error(f"Migration failed: {exc_val}")
        else:
            self.db.commit()
        self.db.close()

    def get_existing_request_types(self) -> List[RequestTypeConfig]:
        """Get all existing request types"""
        return self.db.query(RequestTypeConfig).all()
    
    def get_existing_forms(self) -> List[FormLayout]:
        """Get all existing forms"""
        return self.db.query(FormLayout).all()
    
    def create_basic_associations(self):
        """
        Create basic form associations for existing request types
        This creates a simple mapping based on naming conventions
        """
        logger.info("Starting form association migration...")
        
        request_types = self.get_existing_request_types()
        forms = self.get_existing_forms()
        
        if not request_types:
            logger.info("No request types found. Nothing to migrate.")
            return
            
        if not forms:
            logger.info("No forms found. Nothing to migrate.")
            return
            
        # Create a mapping of request types to likely forms
        association_mapping = self._create_association_mapping(request_types, forms)
        
        # Create associations
        associations_created = 0
        for request_type, form_list in association_mapping.items():
            for i, form in enumerate(form_list):
                try:
                    # Check if association already exists
                    existing = self.db.query(RequestTypeFormAssociation).filter(
                        RequestTypeFormAssociation.request_type_config_id == request_type.id,
                        RequestTypeFormAssociation.form_layout_id == form.id
                    ).first()
                    
                    if not existing:
                        association = RequestTypeFormAssociation(
                            request_type_config_id=request_type.id,
                            form_layout_id=form.id,
                            display_order=i,
                            is_primary=(i == 0)  # First form is default
                        )
                        self.db.add(association)
                        associations_created += 1
                        
                except Exception as e:
                    logger.warning(f"Failed to create association for {request_type.request_type} -> {form.name}: {e}")
        
        logger.info(f"Created {associations_created} form associations")
        return associations_created
    
    def _create_association_mapping(self, request_types: List[RequestTypeConfig], 
                                  forms: List[FormLayout]) -> Dict[RequestTypeConfig, List[FormLayout]]:
        """
        Create intelligent mapping between request types and forms
        Based on naming patterns and request type categories
        """
        mapping: Dict[RequestTypeConfig, List[FormLayout]] = {}
        
        # Common request type to form mappings
        type_patterns = {
            'agent': ['agent', 'onboarding', 'registration'],
            'vendor': ['vendor', 'supplier', 'third_party'],
            'assessment': ['assessment', 'evaluation', 'review'],
            'compliance': ['compliance', 'audit', 'certification'],
            'incident': ['incident', 'report', 'issue'],
        }
        
        for request_type in request_types:
            matched_forms = []
            
            # Look for forms that match the request type
            rt_lower = request_type.request_type.lower()
            
            # Direct name matching
            for form in forms:
                form_name_lower = form.name.lower()
                
                # Exact match
                if rt_lower == form_name_lower.replace(' ', '_') or \
                   rt_lower.replace('_', ' ') == form_name_lower:
                    matched_forms.append(form)
                    continue
                    
                # Pattern matching
                for category, patterns in type_patterns.items():
                    if category in rt_lower:
                        for pattern in patterns:
                            if pattern in form_name_lower:
                                matched_forms.append(form)
                                break
                        if matched_forms:  # Found matches, move to next request type
                            break
                
                # Fallback: if no specific matches, associate active forms
                if not matched_forms and form.is_active:
                    matched_forms.append(form)
            
            # Limit to reasonable number of forms per request type
            mapping[request_type] = matched_forms[:3]  # Max 3 forms per request type
            
        return mapping
    
    def validate_migration(self):
        """Validate that the migration was successful"""
        logger.info("Validating migration...")
        
        # Count associations
        total_associations = self.db.query(RequestTypeFormAssociation).count()
        logger.info(f"Total form associations: {total_associations}")
        
        # Check for orphaned associations
        orphaned_count = self.db.query(RequestTypeFormAssociation)\
            .join(RequestTypeConfig, isouter=True)\
            .filter(RequestTypeConfig.id.is_(None)).count()
            
        if orphaned_count > 0:
            logger.warning(f"Found {orphaned_count} orphaned form associations")
            
        # Check for request types without forms
        request_types_without_forms = self.db.query(RequestTypeConfig)\
            .outerjoin(RequestTypeFormAssociation)\
            .filter(RequestTypeFormAssociation.id.is_(None)).count()
            
        if request_types_without_forms > 0:
            logger.info(f"{request_types_without_forms} request types have no associated forms")
            
        return {
            'total_associations': total_associations,
            'orphaned_associations': orphaned_count,
            'request_types_without_forms': request_types_without_forms
        }
    
    def rollback_orphaned_associations(self):
        """Remove any associations that reference non-existent entities"""
        logger.info("Cleaning up orphaned associations...")
        
        # Remove associations with non-existent request types
        orphaned_rt = self.db.query(RequestTypeFormAssociation)\
            .join(RequestTypeConfig, isouter=True)\
            .filter(RequestTypeConfig.id.is_(None))
            
        count = orphaned_rt.count()
        if count > 0:
            logger.info(f"Removing {count} orphaned request type associations")
            orphaned_rt.delete(synchronize_session=False)
            
        # Remove associations with non-existent forms
        orphaned_forms = self.db.query(RequestTypeFormAssociation)\
            .join(FormLayout, isouter=True)\
            .filter(FormLayout.id.is_(None))
            
        count = orphaned_forms.count()
        if count > 0:
            logger.info(f"Removing {count} orphaned form associations")
            orphaned_forms.delete(synchronize_session=False)
            
        return True

def main():
    """Main migration function"""
    print("=" * 60)
    print("REQUEST TYPE AND FORM LIBRARY MIGRATION")
    print("=" * 60)
    print()
    
    try:
        with RequestTypeFormMigration() as migrator:
            print("1. Creating form associations...")
            associations_created = migrator.create_basic_associations()
            
            print("2. Validating migration...")
            validation_results = migrator.validate_migration()
            
            print("3. Cleaning up orphaned data...")
            migrator.rollback_orphaned_associations()
            
            print()
            print("=" * 60)
            print("MIGRATION SUMMARY")
            print("=" * 60)
            print(f"Associations created: {associations_created}")
            print(f"Total associations: {validation_results['total_associations']}")
            print(f"Orphaned associations cleaned: {validation_results['orphaned_associations']}")
            print(f"Request types without forms: {validation_results['request_types_without_forms']}")
            print()
            print("✅ Migration completed successfully!")
            print()
            print("Next steps:")
            print("- Test the unified dashboard at /admin/workflow-config")
            print("- Verify form associations are working correctly")
            print("- Update any hardcoded references to old routes")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()