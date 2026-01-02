#!/usr/bin/env python3
"""Create messages table"""
from app.core.database import engine, Base
from app.models.message import Message

# Create messages table
Base.metadata.create_all(bind=engine, tables=[Message.__table__])
print("✅ Messages table created successfully")

# Verify
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"✅ Has messages: {'messages' in tables}")
print(f"✅ All tables: {sorted(tables)}")

