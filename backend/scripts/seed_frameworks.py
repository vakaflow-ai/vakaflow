"""
Seed compliance frameworks, risks, and rules into the database
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.compliance_framework import (
    ComplianceFramework, FrameworkRisk, FrameworkRule
)
from app.models.tenant import Tenant  # Import to resolve foreign key
from app.services.comprehensive_framework_library import ComprehensiveFrameworkLibrary
from uuid import UUID
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_frameworks(db: Session):
    """Seed compliance frameworks, risks, and rules"""
    logger.info("🌱 Seeding compliance frameworks, risks, and rules...")
    
    library = ComprehensiveFrameworkLibrary()
    frameworks_data = library.get_all_frameworks()
    
    frameworks_created = 0
    risks_created = 0
    rules_created = 0
    
    for framework_code, framework_data in frameworks_data.items():
        # Check if framework already exists
        existing_framework = db.query(ComplianceFramework).filter(
            ComplianceFramework.code == framework_code
        ).first()
        
        if existing_framework:
            logger.info(f"  ⊙ Framework already exists: {framework_data['name']}")
            framework = existing_framework
        else:
            # Create framework
            framework = ComplianceFramework(
                tenant_id=None,  # Platform-wide frameworks
                name=framework_data["name"],
                code=framework_data["code"],
                description=framework_data["description"],
                region=framework_data["region"],
                category=framework_data["category"],
                version=framework_data["version"],
                status=framework_data["status"],
                is_active=True
            )
            db.add(framework)
            db.flush()  # Flush to get the framework ID
            frameworks_created += 1
            logger.info(f"  ✓ Created framework: {framework_data['name']}")
        
        # Create risks
        risks_data = framework_data.get("risks", [])
        risk_map = {}  # Map risk codes to risk IDs for rule linking
        
        for risk_data in risks_data:
            existing_risk = db.query(FrameworkRisk).filter(
                FrameworkRisk.framework_id == framework.id,
                FrameworkRisk.code == risk_data["code"]
            ).first()
            
            if existing_risk:
                risk_map[risk_data["code"]] = existing_risk.id
            else:
                risk = FrameworkRisk(
                    framework_id=framework.id,
                    name=risk_data["name"],
                    code=risk_data["code"],
                    description=risk_data.get("description"),
                    severity=risk_data["severity"],
                    category=risk_data.get("category"),
                    order=risks_data.index(risk_data),
                    is_active=True
                )
                db.add(risk)
                db.flush()  # Flush to get the risk ID
                risk_map[risk_data["code"]] = risk.id
                risks_created += 1
                logger.info(f"    ✓ Created risk: {risk_data['name']}")
        
        # Create rules
        rules_data = framework_data.get("rules", [])
        
        for rule_data in rules_data:
            existing_rule = db.query(FrameworkRule).filter(
                FrameworkRule.framework_id == framework.id,
                FrameworkRule.code == rule_data["code"]
            ).first()
            
            if existing_rule:
                logger.debug(f"    ⊙ Rule already exists: {rule_data['name']}")
            else:
                # Find risk_id if rule has a risk code (we'll link by risk name pattern for now)
                risk_id = None
                # Try to find risk by matching risk code pattern
                for risk_code, risk_uuid in risk_map.items():
                    if risk_code in rule_data.get("requirement_code", ""):
                        risk_id = risk_uuid
                        break
                
                rule = FrameworkRule(
                    framework_id=framework.id,
                    risk_id=risk_id,
                    name=rule_data["name"],
                    code=rule_data["code"],
                    description=rule_data.get("description"),
                    conditions=rule_data.get("conditions"),
                    requirement_text=rule_data["requirement_text"],
                    requirement_code=rule_data.get("requirement_code"),
                    parent_rule_id=None,  # Can be set later for hierarchical rules
                    order=rule_data.get("order", 0),
                    is_active=True
                )
                db.add(rule)
                rules_created += 1
                logger.info(f"    ✓ Created rule: {rule_data['name']}")
        
        db.commit()  # Commit after each framework to ensure data integrity
    
    logger.info(f"✅ Seeded {frameworks_created} frameworks, {risks_created} risks, {rules_created} rules")
    return {
        "frameworks": frameworks_created,
        "risks": risks_created,
        "rules": rules_created
    }


def main():
    """Main seed function"""
    print("=" * 60)
    print("🌱 Seeding Compliance Frameworks, Risks, and Rules")
    print("=" * 60)
    print()
    
    db = SessionLocal()
    try:
        results = seed_frameworks(db)
        
        print()
        print("=" * 60)
        print("✅ Framework seeding complete!")
        print("=" * 60)
        print()
        print("📊 Summary:")
        print(f"  • Frameworks: {results['frameworks']}")
        print(f"  • Risks: {results['risks']}")
        print(f"  • Rules: {results['rules']}")
        print()
        
        # Print framework list
        frameworks = db.query(ComplianceFramework).filter(
            ComplianceFramework.is_active == True
        ).all()
        print("📋 Available Frameworks:")
        for fw in frameworks:
            risk_count = db.query(FrameworkRisk).filter(
                FrameworkRisk.framework_id == fw.id
            ).count()
            rule_count = db.query(FrameworkRule).filter(
                FrameworkRule.framework_id == fw.id
            ).count()
            print(f"  • {fw.name} ({fw.code}): {risk_count} risks, {rule_count} rules")
        print()
        
    except Exception as e:
        logger.error(f"❌ Error seeding frameworks: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()

