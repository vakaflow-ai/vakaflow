#!/usr/bin/env python3
"""
Seed Master Data Lists
Creates default master data lists for all tenants:
- Question Categories
- Requirement Categories
- Departments
- Locations

These are seeded as regular (non-system) lists so users can edit/delete them.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.master_data_list import MasterDataList
from app.models.tenant import Tenant
from datetime import datetime
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Default Master Data Lists
MASTER_DATA_LISTS = {
    "question_category": {
        "name": "Question Categories",
        "description": "Categories for organizing questions in the Question Library",
        "list_type": "question_category",
        "values": [
            {"value": "compliance", "label": "Compliance", "order": 1, "is_active": True},
            {"value": "security", "label": "Security", "order": 2, "is_active": True},
            {"value": "risk_management", "label": "Risk Management", "order": 3, "is_active": True},
            {"value": "data_protection", "label": "Data Protection", "order": 4, "is_active": True},
            {"value": "business_continuity", "label": "Business Continuity", "order": 5, "is_active": True},
            {"value": "vendor_management", "label": "Vendor Management", "order": 6, "is_active": True},
            {"value": "privacy", "label": "Privacy", "order": 7, "is_active": True},
            {"value": "access_control", "label": "Access Control", "order": 8, "is_active": True},
            {"value": "incident_response", "label": "Incident Response", "order": 9, "is_active": True},
            {"value": "audit", "label": "Audit & Monitoring", "order": 10, "is_active": True},
        ]
    },
    "requirement_category": {
        "name": "Requirement Categories",
        "description": "Categories for organizing compliance and regulatory requirements",
        "list_type": "requirement_category",
        "values": [
            {"value": "regulatory", "label": "Regulatory", "order": 1, "is_active": True},
            {"value": "security", "label": "Security", "order": 2, "is_active": True},
            {"value": "privacy", "label": "Privacy", "order": 3, "is_active": True},
            {"value": "data_protection", "label": "Data Protection", "order": 4, "is_active": True},
            {"value": "access_control", "label": "Access Control", "order": 5, "is_active": True},
            {"value": "incident_management", "label": "Incident Management", "order": 6, "is_active": True},
            {"value": "business_continuity", "label": "Business Continuity", "order": 7, "is_active": True},
            {"value": "vendor_management", "label": "Vendor Management", "order": 8, "is_active": True},
            {"value": "audit", "label": "Audit & Compliance", "order": 9, "is_active": True},
            {"value": "governance", "label": "Governance", "order": 10, "is_active": True},
        ]
    },
    "department": {
        "name": "Departments",
        "description": "Organizational departments for categorizing users and resources",
        "list_type": "department",
        "values": [
            {"value": "it", "label": "IT", "order": 1, "is_active": True},
            {"value": "security", "label": "Security", "order": 2, "is_active": True},
            {"value": "compliance", "label": "Compliance", "order": 3, "is_active": True},
            {"value": "legal", "label": "Legal", "order": 4, "is_active": True},
            {"value": "finance", "label": "Finance", "order": 5, "is_active": True},
            {"value": "hr", "label": "Human Resources", "order": 6, "is_active": True},
            {"value": "operations", "label": "Operations", "order": 7, "is_active": True},
            {"value": "procurement", "label": "Procurement", "order": 8, "is_active": True},
            {"value": "risk_management", "label": "Risk Management", "order": 9, "is_active": True},
            {"value": "audit", "label": "Internal Audit", "order": 10, "is_active": True},
            {"value": "business_development", "label": "Business Development", "order": 11, "is_active": True},
            {"value": "sales", "label": "Sales", "order": 12, "is_active": True},
            {"value": "marketing", "label": "Marketing", "order": 13, "is_active": True},
            {"value": "engineering", "label": "Engineering", "order": 14, "is_active": True},
            {"value": "product", "label": "Product", "order": 15, "is_active": True},
        ]
    },
    "location": {
        "name": "Locations",
        "description": "Geographic locations for offices, data centers, and facilities",
        "list_type": "location",
        "values": [
            {"value": "north_america", "label": "North America", "order": 1, "is_active": True},
            {"value": "south_america", "label": "South America", "order": 2, "is_active": True},
            {"value": "europe", "label": "Europe", "order": 3, "is_active": True},
            {"value": "asia_pacific", "label": "Asia Pacific", "order": 4, "is_active": True},
            {"value": "middle_east", "label": "Middle East", "order": 5, "is_active": True},
            {"value": "africa", "label": "Africa", "order": 6, "is_active": True},
            {"value": "australia", "label": "Australia", "order": 7, "is_active": True},
            {"value": "united_states", "label": "United States", "order": 8, "is_active": True},
            {"value": "canada", "label": "Canada", "order": 9, "is_active": True},
            {"value": "united_kingdom", "label": "United Kingdom", "order": 10, "is_active": True},
            {"value": "germany", "label": "Germany", "order": 11, "is_active": True},
            {"value": "france", "label": "France", "order": 12, "is_active": True},
            {"value": "india", "label": "India", "order": 13, "is_active": True},
            {"value": "china", "label": "China", "order": 14, "is_active": True},
            {"value": "japan", "label": "Japan", "order": 15, "is_active": True},
            {"value": "singapore", "label": "Singapore", "order": 16, "is_active": True},
            {"value": "remote", "label": "Remote", "order": 17, "is_active": True},
        ]
    },
}


def seed_master_data_for_tenant(tenant_id: uuid.UUID, created_by: uuid.UUID = None):
    """Seed master data lists for a specific tenant"""
    db = SessionLocal()
    try:
        logger.info(f"Seeding master data for tenant {tenant_id}...")
        
        seeded_count = 0
        updated_count = 0
        
        for list_type, list_data in MASTER_DATA_LISTS.items():
            # Check if list already exists for this tenant
            existing = db.query(MasterDataList).filter(
                MasterDataList.tenant_id == tenant_id,
                MasterDataList.list_type == list_type,
                MasterDataList.is_active == True
            ).first()
            
            if existing:
                # Update existing list with new values (merge, don't replace)
                logger.info(f"  Updating existing list: {list_data['name']}")
                existing_values = {v.get('value'): v for v in existing.values if isinstance(v, dict)}
                new_values = {v['value']: v for v in list_data['values']}
                
                # Merge: keep existing values, add new ones
                merged_values = []
                for value_data in list_data['values']:
                    if value_data['value'] in existing_values:
                        # Keep existing value (user may have modified it)
                        merged_values.append(existing_values[value_data['value']])
                    else:
                        # Add new value
                        merged_values.append(value_data)
                
                existing.values = merged_values
                existing.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                # Create new list
                logger.info(f"  Creating new list: {list_data['name']}")
                master_list = MasterDataList(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    name=list_data['name'],
                    description=list_data['description'],
                    list_type=list_type,
                    values=list_data['values'],
                    is_active=True,
                    is_system=False,  # Not system lists - users can edit/delete
                    created_by=created_by,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(master_list)
                seeded_count += 1
        
        db.commit()
        logger.info(f"✅ Seeded {seeded_count} new lists, updated {updated_count} existing lists for tenant {tenant_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error seeding master data for tenant {tenant_id}: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


def seed_all_tenants():
    """Seed master data lists for all tenants"""
    db = SessionLocal()
    try:
        logger.info("=" * 60)
        logger.info("Seeding Master Data Lists")
        logger.info("=" * 60)
        
        tenants = db.query(Tenant).filter(Tenant.status == "active").all()
        
        if not tenants:
            logger.warning("⚠️  No active tenants found. Create a tenant first.")
            return False
        
        logger.info(f"\nFound {len(tenants)} active tenant(s)")
        
        # Get platform admin for created_by
        from app.models.user import User, UserRole
        platform_admin = db.query(User).filter(
            User.role == UserRole.PLATFORM_ADMIN
        ).first()
        created_by = platform_admin.id if platform_admin else None
        
        success_count = 0
        for tenant in tenants:
            logger.info(f"\n📋 Processing tenant: {tenant.name} ({tenant.slug})")
            if seed_master_data_for_tenant(tenant.id, created_by=created_by):
                success_count += 1
        
        logger.info("\n" + "=" * 60)
        logger.info(f"✅ Master data seeding complete!")
        logger.info(f"   Processed: {len(tenants)} tenant(s)")
        logger.info(f"   Successful: {success_count}")
        logger.info("=" * 60)
        logger.info("\n📋 Seeded Master Data Lists:")
        logger.info("   - Question Categories (10 categories)")
        logger.info("   - Requirement Categories (10 categories)")
        logger.info("   - Departments (15 departments)")
        logger.info("   - Locations (17 locations)")
        logger.info("\n💡 Note: These lists are editable and deletable by users.")
        logger.info("=" * 60)
        
        return success_count == len(tenants)
        
    except Exception as e:
        logger.error(f"❌ Error seeding master data: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    try:
        success = seed_all_tenants()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Script failed: {e}", exc_info=True)
        sys.exit(1)
