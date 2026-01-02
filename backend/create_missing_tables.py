#!/usr/bin/env python3
"""Create missing tables from initial migration"""
from app.core.database import engine, Base
from app.models.agent import Agent, AgentMetadata, AgentArtifact
from app.models.vendor import Vendor
from sqlalchemy import inspect

# Check what tables exist
inspector = inspect(engine)
existing_tables = inspector.get_table_names()

print(f"Existing tables: {existing_tables}")

# Create missing tables
missing_tables = []
if 'vendors' not in existing_tables:
    missing_tables.append('vendors')
if 'agents' not in existing_tables:
    missing_tables.append('agents')
if 'agent_metadata' not in existing_tables:
    missing_tables.append('agent_metadata')
if 'agent_artifacts' not in existing_tables:
    missing_tables.append('agent_artifacts')

if missing_tables:
    print(f"\nCreating missing tables: {missing_tables}")
    Base.metadata.create_all(bind=engine, tables=[
        Vendor.__table__,
        Agent.__table__,
        AgentMetadata.__table__,
        AgentArtifact.__table__,
    ])
    print("✅ Tables created successfully")
else:
    print("✅ All tables already exist")

# Verify
inspector = inspect(engine)
new_tables = inspector.get_table_names()
print(f"\nTables now: {sorted(new_tables)}")
print(f"Has agents: {'agents' in new_tables}")
print(f"Has vendors: {'vendors' in new_tables}")

