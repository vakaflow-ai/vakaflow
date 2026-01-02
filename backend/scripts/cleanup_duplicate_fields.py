"""
Cleanup script to remove duplicate entity fields from the database.

This script identifies and removes duplicate fields that have the same
entity_name and field_name but different tenant_id values.

Strategy:
- For each (entity_name, field_name) combination, keep the most recent record
- Prefer tenant-specific fields over platform-wide (tenant_id=None)
- If multiple tenant-specific fields exist, keep the most recent one
"""
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from sqlalchemy import desc, nullslast
from app.core.database import SessionLocal
from app.models.entity_field import EntityFieldRegistry
from datetime import datetime


def find_duplicates(db: Session):
    """Find all duplicate fields grouped by entity_name and field_name."""
    # Find all (entity_name, field_name) combinations that appear more than once
    duplicates_query = (
        db.query(
            EntityFieldRegistry.entity_name,
            EntityFieldRegistry.field_name,
            func.count(EntityFieldRegistry.id).label('count')
        )
        .group_by(EntityFieldRegistry.entity_name, EntityFieldRegistry.field_name)
        .having(func.count(EntityFieldRegistry.id) > 1)
        .all()
    )
    
    return duplicates_query


def cleanup_duplicates(db: Session, dry_run: bool = True):
    """Remove duplicate fields, keeping the most appropriate one."""
    duplicates = find_duplicates(db)
    
    if not duplicates:
        print("✅ No duplicates found!")
        return
    
    print(f"Found {len(duplicates)} duplicate field groups:")
    total_deleted = 0
    
    for entity_name, field_name, count in duplicates:
        print(f"\n📋 Processing: {entity_name}.{field_name} ({count} duplicates)")
        
        # Get all records for this entity_name + field_name combination
        all_records = (
            db.query(EntityFieldRegistry)
            .filter(
                EntityFieldRegistry.entity_name == entity_name,
                EntityFieldRegistry.field_name == field_name
            )
            .order_by(
                # Prefer tenant-specific over platform-wide (NULL)
                nullslast(desc(EntityFieldRegistry.tenant_id)),
                # Then by most recent
                nullslast(desc(EntityFieldRegistry.last_discovered_at)),
                desc(EntityFieldRegistry.updated_at)
            )
            .all()
        )
        
        if len(all_records) <= 1:
            continue
        
        # Keep the first one (most preferred)
        keep_record = all_records[0]
        delete_records = all_records[1:]
        
        print(f"  ✅ Keeping: id={keep_record.id}, tenant_id={keep_record.tenant_id}, "
              f"updated_at={keep_record.updated_at}")
        
        for record in delete_records:
            print(f"  ❌ Deleting: id={record.id}, tenant_id={record.tenant_id}, "
                  f"updated_at={record.updated_at}")
            
            if not dry_run:
                db.delete(record)
                total_deleted += 1
    
    if dry_run:
        print(f"\n🔍 DRY RUN: Would delete {total_deleted} duplicate records")
        print("Run with --execute to actually delete the duplicates")
    else:
        db.commit()
        print(f"\n✅ Successfully deleted {total_deleted} duplicate records")
    
    return total_deleted


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Cleanup duplicate entity fields')
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually delete duplicates (default is dry-run)'
    )
    args = parser.parse_args()
    
    db = SessionLocal()
    try:
        print("🔍 Starting duplicate field cleanup...")
        print(f"Mode: {'EXECUTE' if args.execute else 'DRY RUN'}")
        print("-" * 60)
        
        deleted_count = cleanup_duplicates(db, dry_run=not args.execute)
        
        if args.execute and deleted_count > 0:
            print("\n✅ Cleanup completed successfully!")
        elif not args.execute:
            print("\n💡 To actually delete duplicates, run: python scripts/cleanup_duplicate_fields.py --execute")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

