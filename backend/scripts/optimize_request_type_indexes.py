"""
Performance optimization migration for request type configurations
Adds database indexes to improve query performance
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import engine

def upgrade():
    """Add performance indexes"""
    with engine.connect() as conn:
        # Index for tenant_id + is_active combination (common query pattern)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_request_type_config_tenant_active 
            ON request_type_configs (tenant_id, is_active)
        """))
        
        # Index for tenant_id + visibility_scope combination
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_request_type_config_tenant_visibility 
            ON request_type_configs (tenant_id, visibility_scope)
        """))
        
        # Index for request_type (used in joins and lookups)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_request_type_config_request_type 
            ON request_type_configs (request_type)
        """))
        
        # Composite index for common filtering patterns
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_request_type_config_composite 
            ON request_type_configs (tenant_id, is_active, visibility_scope, created_at DESC)
        """))
        
        conn.commit()

def downgrade():
    """Remove performance indexes"""
    with engine.connect() as conn:
        conn.execute(text("DROP INDEX IF EXISTS idx_request_type_config_tenant_active"))
        conn.execute(text("DROP INDEX IF EXISTS idx_request_type_config_tenant_visibility"))
        conn.execute(text("DROP INDEX IF EXISTS idx_request_type_config_request_type"))
        conn.execute(text("DROP INDEX IF EXISTS idx_request_type_config_composite"))
        conn.commit()

if __name__ == "__main__":
    print("Applying performance optimization indexes...")
    upgrade()
    print("Indexes created successfully!")