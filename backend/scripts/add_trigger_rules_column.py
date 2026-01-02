#!/usr/bin/env python3
"""Add trigger_rules column to workflow_configurations table"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text

def add_trigger_rules_column():
    """Add trigger_rules column if it doesn't exist"""
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='workflow_configurations' 
            AND column_name='trigger_rules'
        """))
        
        if result.fetchone():
            print("Column 'trigger_rules' already exists")
            return
        
        # Add column
        conn.execute(text("""
            ALTER TABLE workflow_configurations 
            ADD COLUMN trigger_rules JSONB
        """))
        conn.commit()
        print("✅ Column 'trigger_rules' added successfully")

if __name__ == "__main__":
    add_trigger_rules_column()

