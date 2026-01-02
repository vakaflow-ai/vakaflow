#!/usr/bin/env python3
"""Create all missing database tables"""
from app.core.database import engine, Base
from sqlalchemy import inspect

# Import all models to register them
from app.models.vendor_invitation import VendorInvitation
from app.models.ticket import Ticket, TicketActivity
from app.models.integration import Integration, IntegrationEvent
from app.models.api_gateway import APIToken, SCIMConfiguration, APIGatewaySession, APIGatewayRequestLog
from app.models.tenant import Tenant, LicenseFeature, TenantFeature
from app.models.otp import OTPCode

# Check what tables exist
inspector = inspect(engine)
existing_tables = inspector.get_table_names()

print(f"Existing tables: {len(existing_tables)}")
print(f"  {sorted(existing_tables)}\n")

# Get all tables from Base metadata
all_tables = list(Base.metadata.tables.keys())
missing_tables = [t for t in all_tables if t not in existing_tables]

if missing_tables:
    print(f"Creating {len(missing_tables)} missing tables:")
    for table in sorted(missing_tables):
        print(f"  - {table}")
    
    # Create all missing tables
    Base.metadata.create_all(bind=engine)
    print("\n✅ All tables created successfully")
else:
    print("✅ All tables already exist")

# Verify
inspector = inspect(engine)
new_tables = sorted(inspector.get_table_names())
print(f"\n📊 Total tables now: {len(new_tables)}")
print(f"✅ All tables: {new_tables}")

# Check specific tables
required_tables = [
    'vendor_invitations', 'tickets', 'ticket_activities',
    'integrations', 'integration_events', 'api_tokens',
    'scim_configurations', 'tenants', 'otp_codes'
]
print(f"\n✅ Required tables check:")
for table in required_tables:
    exists = table in new_tables
    status = "✅" if exists else "❌"
    print(f"  {status} {table}")

