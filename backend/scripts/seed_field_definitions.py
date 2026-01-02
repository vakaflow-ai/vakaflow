#!/usr/bin/env python3
"""
Seed Field Definitions - Seeds field_config with options for agent fields
Ensures type, category, and subcategory fields have their dropdown options configured
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.entity_field import EntityFieldRegistry
from typing import Optional
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Agent Type Options
AGENT_TYPE_OPTIONS = [
    {"value": "AI_AGENT", "label": "AI Agent"},
    {"value": "BOT", "label": "Bot"},
    {"value": "AUTOMATION", "label": "Automation"},
    {"value": "API_SERVICE", "label": "API Service"}
]

# Agent Category Options
AGENT_CATEGORY_OPTIONS = [
    {"value": "Security & Compliance", "label": "Security & Compliance"},
    {"value": "Financial Trading", "label": "Financial Trading"},
    {"value": "Healthcare", "label": "Healthcare"},
    {"value": "Customer Support", "label": "Customer Support"},
    {"value": "Sales & Marketing", "label": "Sales & Marketing"},
    {"value": "Human Resources", "label": "Human Resources"},
    {"value": "IT Operations", "label": "IT Operations"},
    {"value": "Data Analytics", "label": "Data Analytics"},
    {"value": "E-commerce", "label": "E-commerce"},
    {"value": "Education", "label": "Education"},
    {"value": "Legal", "label": "Legal"},
    {"value": "Real Estate", "label": "Real Estate"},
    {"value": "Manufacturing", "label": "Manufacturing"},
    {"value": "Supply Chain", "label": "Supply Chain"},
    {"value": "Energy & Utilities", "label": "Energy & Utilities"},
    {"value": "Telecommunications", "label": "Telecommunications"},
    {"value": "Transportation", "label": "Transportation"},
    {"value": "Government", "label": "Government"},
    {"value": "Non-Profit", "label": "Non-Profit"},
    {"value": "Research & Development", "label": "Research & Development"},
    {"value": "Entertainment", "label": "Entertainment"},
    {"value": "Media & Publishing", "label": "Media & Publishing"},
    {"value": "Insurance", "label": "Insurance"},
    {"value": "Banking", "label": "Banking"},
    {"value": "Retail", "label": "Retail"},
    {"value": "Hospitality", "label": "Hospitality"},
    {"value": "Agriculture", "label": "Agriculture"},
    {"value": "Construction", "label": "Construction"},
    {"value": "Aerospace", "label": "Aerospace"},
    {"value": "Defense", "label": "Defense"},
    {"value": "Automotive", "label": "Automotive"},
    {"value": "Pharmaceuticals", "label": "Pharmaceuticals"},
    {"value": "Biotechnology", "label": "Biotechnology"},
    {"value": "Other", "label": "Other"}
]

# Category to Subcategory Mapping
AGENT_SUBCATEGORY_OPTIONS = {
    "Security & Compliance": [
        {"value": "IT Security", "label": "IT Security"},
        {"value": "OT Security", "label": "OT Security"},
        {"value": "Physical Security", "label": "Physical Security"},
        {"value": "Information Security", "label": "Information Security"},
        {"value": "Cybersecurity", "label": "Cybersecurity"},
        {"value": "Network Security", "label": "Network Security"},
        {"value": "Cloud Security", "label": "Cloud Security"},
        {"value": "Application Security", "label": "Application Security"},
        {"value": "Data Security", "label": "Data Security"},
        {"value": "Compliance Management", "label": "Compliance Management"},
        {"value": "Risk Management", "label": "Risk Management"},
        {"value": "Audit & Assessment", "label": "Audit & Assessment"},
        {"value": "Identity & Access Management", "label": "Identity & Access Management"},
        {"value": "Security Operations", "label": "Security Operations"},
        {"value": "Other", "label": "Other"}
    ],
    "Financial Trading": [
        {"value": "Algorithmic Trading", "label": "Algorithmic Trading"},
        {"value": "High-Frequency Trading", "label": "High-Frequency Trading"},
        {"value": "Risk Management", "label": "Risk Management"},
        {"value": "Portfolio Management", "label": "Portfolio Management"},
        {"value": "Market Analysis", "label": "Market Analysis"},
        {"value": "Trade Execution", "label": "Trade Execution"},
        {"value": "Regulatory Compliance", "label": "Regulatory Compliance"},
        {"value": "Other", "label": "Other"}
    ],
    "Healthcare": [
        {"value": "Clinical Decision Support", "label": "Clinical Decision Support"},
        {"value": "Patient Care", "label": "Patient Care"},
        {"value": "Medical Records", "label": "Medical Records"},
        {"value": "Telemedicine", "label": "Telemedicine"},
        {"value": "Medical Imaging", "label": "Medical Imaging"},
        {"value": "Pharmacy Management", "label": "Pharmacy Management"},
        {"value": "Health Data Analytics", "label": "Health Data Analytics"},
        {"value": "Regulatory Compliance", "label": "Regulatory Compliance"},
        {"value": "Other", "label": "Other"}
    ],
    "Customer Support": [
        {"value": "Help Desk", "label": "Help Desk"},
        {"value": "Live Chat", "label": "Live Chat"},
        {"value": "Ticket Management", "label": "Ticket Management"},
        {"value": "Customer Service", "label": "Customer Service"},
        {"value": "FAQ Management", "label": "FAQ Management"},
        {"value": "Customer Feedback", "label": "Customer Feedback"},
        {"value": "Other", "label": "Other"}
    ],
    "Sales & Marketing": [
        {"value": "Lead Generation", "label": "Lead Generation"},
        {"value": "CRM", "label": "CRM"},
        {"value": "Email Marketing", "label": "Email Marketing"},
        {"value": "Social Media Marketing", "label": "Social Media Marketing"},
        {"value": "Content Marketing", "label": "Content Marketing"},
        {"value": "Sales Automation", "label": "Sales Automation"},
        {"value": "Market Research", "label": "Market Research"},
        {"value": "Other", "label": "Other"}
    ],
    "Human Resources": [
        {"value": "Recruitment", "label": "Recruitment"},
        {"value": "Talent Management", "label": "Talent Management"},
        {"value": "Performance Management", "label": "Performance Management"},
        {"value": "Payroll", "label": "Payroll"},
        {"value": "Benefits Administration", "label": "Benefits Administration"},
        {"value": "Employee Engagement", "label": "Employee Engagement"},
        {"value": "Learning & Development", "label": "Learning & Development"},
        {"value": "Other", "label": "Other"}
    ],
    "IT Operations": [
        {"value": "Infrastructure Management", "label": "Infrastructure Management"},
        {"value": "DevOps", "label": "DevOps"},
        {"value": "Cloud Operations", "label": "Cloud Operations"},
        {"value": "Monitoring & Alerting", "label": "Monitoring & Alerting"},
        {"value": "Incident Management", "label": "Incident Management"},
        {"value": "Configuration Management", "label": "Configuration Management"},
        {"value": "Automation", "label": "Automation"},
        {"value": "Other", "label": "Other"}
    ],
    "Data Analytics": [
        {"value": "Business Intelligence", "label": "Business Intelligence"},
        {"value": "Data Visualization", "label": "Data Visualization"},
        {"value": "Predictive Analytics", "label": "Predictive Analytics"},
        {"value": "Machine Learning", "label": "Machine Learning"},
        {"value": "Data Warehousing", "label": "Data Warehousing"},
        {"value": "ETL", "label": "ETL"},
        {"value": "Reporting", "label": "Reporting"},
        {"value": "Other", "label": "Other"}
    ],
    "E-commerce": [
        {"value": "Online Store", "label": "Online Store"},
        {"value": "Payment Processing", "label": "Payment Processing"},
        {"value": "Inventory Management", "label": "Inventory Management"},
        {"value": "Order Management", "label": "Order Management"},
        {"value": "Shipping & Logistics", "label": "Shipping & Logistics"},
        {"value": "Product Recommendations", "label": "Product Recommendations"},
        {"value": "Other", "label": "Other"}
    ],
    "Education": [
        {"value": "Learning Management", "label": "Learning Management"},
        {"value": "Student Information Systems", "label": "Student Information Systems"},
        {"value": "Online Learning", "label": "Online Learning"},
        {"value": "Assessment & Testing", "label": "Assessment & Testing"},
        {"value": "Curriculum Management", "label": "Curriculum Management"},
        {"value": "Other", "label": "Other"}
    ],
    "Legal": [
        {"value": "Contract Management", "label": "Contract Management"},
        {"value": "Document Review", "label": "Document Review"},
        {"value": "Case Management", "label": "Case Management"},
        {"value": "Compliance", "label": "Compliance"},
        {"value": "Legal Research", "label": "Legal Research"},
        {"value": "Other", "label": "Other"}
    ],
    "Real Estate": [
        {"value": "Property Management", "label": "Property Management"},
        {"value": "Real Estate Listings", "label": "Real Estate Listings"},
        {"value": "Transaction Management", "label": "Transaction Management"},
        {"value": "Market Analysis", "label": "Market Analysis"},
        {"value": "Other", "label": "Other"}
    ],
    "Manufacturing": [
        {"value": "Production Planning", "label": "Production Planning"},
        {"value": "Quality Control", "label": "Quality Control"},
        {"value": "Supply Chain", "label": "Supply Chain"},
        {"value": "Inventory Management", "label": "Inventory Management"},
        {"value": "Equipment Management", "label": "Equipment Management"},
        {"value": "Other", "label": "Other"}
    ],
    "Supply Chain": [
        {"value": "Logistics", "label": "Logistics"},
        {"value": "Warehouse Management", "label": "Warehouse Management"},
        {"value": "Transportation", "label": "Transportation"},
        {"value": "Procurement", "label": "Procurement"},
        {"value": "Demand Planning", "label": "Demand Planning"},
        {"value": "Other", "label": "Other"}
    ],
    "Energy & Utilities": [
        {"value": "Grid Management", "label": "Grid Management"},
        {"value": "Energy Trading", "label": "Energy Trading"},
        {"value": "Renewable Energy", "label": "Renewable Energy"},
        {"value": "Smart Metering", "label": "Smart Metering"},
        {"value": "Other", "label": "Other"}
    ],
    "Telecommunications": [
        {"value": "Network Management", "label": "Network Management"},
        {"value": "Service Provisioning", "label": "Service Provisioning"},
        {"value": "Customer Management", "label": "Customer Management"},
        {"value": "Billing", "label": "Billing"},
        {"value": "Other", "label": "Other"}
    ],
    "Transportation": [
        {"value": "Fleet Management", "label": "Fleet Management"},
        {"value": "Route Optimization", "label": "Route Optimization"},
        {"value": "Logistics", "label": "Logistics"},
        {"value": "Public Transit", "label": "Public Transit"},
        {"value": "Other", "label": "Other"}
    ],
    "Government": [
        {"value": "Citizen Services", "label": "Citizen Services"},
        {"value": "Public Safety", "label": "Public Safety"},
        {"value": "Administration", "label": "Administration"},
        {"value": "Regulatory", "label": "Regulatory"},
        {"value": "Other", "label": "Other"}
    ],
    "Non-Profit": [
        {"value": "Donor Management", "label": "Donor Management"},
        {"value": "Volunteer Management", "label": "Volunteer Management"},
        {"value": "Program Management", "label": "Program Management"},
        {"value": "Fundraising", "label": "Fundraising"},
        {"value": "Other", "label": "Other"}
    ],
    "Research & Development": [
        {"value": "Research Management", "label": "Research Management"},
        {"value": "Innovation", "label": "Innovation"},
        {"value": "Product Development", "label": "Product Development"},
        {"value": "Other", "label": "Other"}
    ],
    "Entertainment": [
        {"value": "Content Management", "label": "Content Management"},
        {"value": "Streaming", "label": "Streaming"},
        {"value": "Gaming", "label": "Gaming"},
        {"value": "Other", "label": "Other"}
    ],
    "Media & Publishing": [
        {"value": "Content Management", "label": "Content Management"},
        {"value": "Digital Publishing", "label": "Digital Publishing"},
        {"value": "Media Production", "label": "Media Production"},
        {"value": "Other", "label": "Other"}
    ],
    "Insurance": [
        {"value": "Claims Processing", "label": "Claims Processing"},
        {"value": "Underwriting", "label": "Underwriting"},
        {"value": "Policy Management", "label": "Policy Management"},
        {"value": "Risk Assessment", "label": "Risk Assessment"},
        {"value": "Other", "label": "Other"}
    ],
    "Banking": [
        {"value": "Core Banking", "label": "Core Banking"},
        {"value": "Digital Banking", "label": "Digital Banking"},
        {"value": "Loan Management", "label": "Loan Management"},
        {"value": "Fraud Detection", "label": "Fraud Detection"},
        {"value": "Other", "label": "Other"}
    ],
    "Retail": [
        {"value": "Point of Sale", "label": "Point of Sale"},
        {"value": "Inventory Management", "label": "Inventory Management"},
        {"value": "Customer Management", "label": "Customer Management"},
        {"value": "Other", "label": "Other"}
    ],
    "Hospitality": [
        {"value": "Hotel Management", "label": "Hotel Management"},
        {"value": "Restaurant Management", "label": "Restaurant Management"},
        {"value": "Booking Systems", "label": "Booking Systems"},
        {"value": "Other", "label": "Other"}
    ],
    "Agriculture": [
        {"value": "Farm Management", "label": "Farm Management"},
        {"value": "Crop Monitoring", "label": "Crop Monitoring"},
        {"value": "Livestock Management", "label": "Livestock Management"},
        {"value": "Other", "label": "Other"}
    ],
    "Construction": [
        {"value": "Project Management", "label": "Project Management"},
        {"value": "Resource Planning", "label": "Resource Planning"},
        {"value": "Safety Management", "label": "Safety Management"},
        {"value": "Other", "label": "Other"}
    ],
    "Aerospace": [
        {"value": "Flight Operations", "label": "Flight Operations"},
        {"value": "Maintenance", "label": "Maintenance"},
        {"value": "Safety", "label": "Safety"},
        {"value": "Other", "label": "Other"}
    ],
    "Defense": [
        {"value": "Command & Control", "label": "Command & Control"},
        {"value": "Intelligence", "label": "Intelligence"},
        {"value": "Logistics", "label": "Logistics"},
        {"value": "Other", "label": "Other"}
    ],
    "Automotive": [
        {"value": "Manufacturing", "label": "Manufacturing"},
        {"value": "Supply Chain", "label": "Supply Chain"},
        {"value": "Quality Control", "label": "Quality Control"},
        {"value": "Other", "label": "Other"}
    ],
    "Pharmaceuticals": [
        {"value": "Research", "label": "Research"},
        {"value": "Manufacturing", "label": "Manufacturing"},
        {"value": "Regulatory Compliance", "label": "Regulatory Compliance"},
        {"value": "Other", "label": "Other"}
    ],
    "Biotechnology": [
        {"value": "Research", "label": "Research"},
        {"value": "Development", "label": "Development"},
        {"value": "Manufacturing", "label": "Manufacturing"},
        {"value": "Other", "label": "Other"}
    ],
    "Other": []
}


def seed_field_definitions(tenant_id: Optional[UUID] = None, created_by: Optional[UUID] = None):
    """
    Seed field definitions with options for agent fields (type, category, subcategory)
    
    Args:
        tenant_id: Tenant ID (None for platform-wide)
        created_by: User ID who triggered seed
    """
    db = SessionLocal()
    try:
        logger.info(f"Starting field definitions seed (tenant_id={tenant_id})")
        
        # Update or create field definitions for agents entity
        entity_name = "agents"
        
        # 1. Update/Create 'type' field
        type_field = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == "type",
            EntityFieldRegistry.tenant_id == tenant_id
        ).first()
        
        if type_field:
            # Update existing field
            field_config = type_field.field_config or {}
            needs_update = False
            
            if "options" not in field_config or not field_config.get("options"):
                field_config["options"] = AGENT_TYPE_OPTIONS
                needs_update = True
            
            if type_field.field_type_display != "select":
                type_field.field_type_display = "select"
                needs_update = True
            
            if type_field.field_type != "select":
                type_field.field_type = "select"
                needs_update = True
            
            if needs_update:
                type_field.field_config = field_config
                logger.info("✅ Updated 'type' field with options and field_type")
            else:
                logger.info("✅ 'type' field already has options and correct type")
        else:
            logger.warning(f"⚠️  'type' field not found in EntityFieldRegistry for {entity_name}")
        
        # 2. Update/Create 'category' field
        category_field = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == "category",
            EntityFieldRegistry.tenant_id == tenant_id
        ).first()
        
        if category_field:
            # Update existing field
            field_config = category_field.field_config or {}
            needs_update = False
            
            if "options" not in field_config or not field_config.get("options"):
                field_config["options"] = AGENT_CATEGORY_OPTIONS
                needs_update = True
            
            if category_field.field_type_display != "select":
                category_field.field_type_display = "select"
                needs_update = True
            
            if category_field.field_type != "select":
                category_field.field_type = "select"
                needs_update = True
            
            if needs_update:
                category_field.field_config = field_config
                logger.info("✅ Updated 'category' field with options and field_type")
            else:
                logger.info("✅ 'category' field already has options and correct type")
        else:
            logger.warning(f"⚠️  'category' field not found in EntityFieldRegistry for {entity_name}")
        
        # 3. Update/Create 'subcategory' field
        subcategory_field = db.query(EntityFieldRegistry).filter(
            EntityFieldRegistry.entity_name == entity_name,
            EntityFieldRegistry.field_name == "subcategory",
            EntityFieldRegistry.tenant_id == tenant_id
        ).first()
        
        if subcategory_field:
            # Update existing field
            field_config = subcategory_field.field_config or {}
            needs_update = False
            
            if "dependent_options" not in field_config or not field_config.get("dependent_options"):
                field_config["depends_on"] = "category"
                field_config["depends_on_label"] = "Category"
                field_config["dependent_options"] = AGENT_SUBCATEGORY_OPTIONS
                field_config["allow_custom"] = False
                field_config["clear_on_parent_change"] = True
                needs_update = True
            
            if subcategory_field.field_type_display != "dependent_select":
                subcategory_field.field_type_display = "dependent_select"
                needs_update = True
            
            if subcategory_field.field_type != "dependent_select":
                subcategory_field.field_type = "dependent_select"
                needs_update = True
            
            if needs_update:
                subcategory_field.field_config = field_config
                logger.info("✅ Updated 'subcategory' field with dependent options and field_type")
            else:
                logger.info("✅ 'subcategory' field already has dependent options and correct type")
        else:
            logger.warning(f"⚠️  'subcategory' field not found in EntityFieldRegistry for {entity_name}")
        
        db.commit()
        logger.info("✅ Field definitions seed completed successfully")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Field definitions seed failed: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()


def seed_field_definitions_for_all_tenants(created_by: Optional[UUID] = None):
    """
    Seed field definitions for all tenants and platform-wide
    """
    db = SessionLocal()
    try:
        from app.models.tenant import Tenant
        
        # First, seed platform-wide (tenant_id=None)
        logger.info("\n📋 Seeding platform-wide field definitions...")
        seed_field_definitions(tenant_id=None, created_by=created_by)
        
        # Then, seed for each tenant
        tenants = db.query(Tenant).all()
        logger.info(f"\n📋 Seeding field definitions for {len(tenants)} tenants...")
        
        for tenant in tenants:
            logger.info(f"Seeding field definitions for tenant: {tenant.name} ({tenant.id})")
            seed_field_definitions(tenant_id=tenant.id, created_by=created_by)
        
        logger.info("\n✅ Field definitions seed completed for all tenants")
        return True
        
    except Exception as e:
        logger.error(f"❌ Field definitions seed failed: {e}", exc_info=True)
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    try:
        success = seed_field_definitions_for_all_tenants()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"❌ Script failed: {e}", exc_info=True)
        sys.exit(1)

