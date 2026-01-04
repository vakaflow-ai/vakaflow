"""
Feature gating and licensing system
"""
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.tenant import Tenant, LicenseFeature, TenantFeature
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class FeatureGate:
    """Feature gating service"""
    
    # Feature definitions
    FEATURES = {
        "rag_search": {
            "name": "RAG Knowledge Search",
            "tiers": ["professional", "enterprise"],
            "default": False
        },
        "automated_compliance": {
            "name": "Automated Compliance Checking",
            "tiers": ["professional", "enterprise"],
            "default": False
        },
        "ai_recommendations": {
            "name": "AI Recommendations",
            "tiers": ["enterprise"],
            "default": False
        },
        "multi_stage_review": {
            "name": "Multi-Stage Review Workflow",
            "tiers": ["professional", "enterprise"],
            "default": False
        },
        "custom_workflows": {
            "name": "Custom Workflows",
            "tiers": ["enterprise"],
            "default": False
        },
        "advanced_analytics": {
            "name": "Advanced Analytics",
            "tiers": ["professional", "enterprise"],
            "default": False
        },
        "api_access": {
            "name": "API Access",
            "tiers": ["professional", "enterprise"],
            "default": False
        },
        "sso_integration": {
            "name": "SSO Integration",
            "tiers": ["enterprise"],
            "default": False
        },
        "white_label": {
            "name": "White Label",
            "tiers": ["enterprise"],
            "default": False
        },
        "unlimited_agents": {
            "name": "Unlimited Agents",
            "tiers": ["enterprise"],
            "default": False
        },
        "priority_support": {
            "name": "Priority Support",
            "tiers": ["enterprise"],
            "default": False
        },
        "cve_tracking": {
            "name": "CVE Tracking & Security Monitoring",
            "tiers": ["professional", "enterprise"],
            "default": False
        },
    }
    
    @classmethod
    def is_feature_enabled(
        cls,
        db: Session,
        tenant_id: Optional[str],
        feature_key: str,
        user: Optional[User] = None
    ) -> bool:
        """
        Check if a feature is enabled for a tenant
        
        Args:
            db: Database session
            tenant_id: Tenant ID
            feature_key: Feature key to check
            user: Optional user for user-specific checks
        
        Returns:
            True if feature is enabled
        """
        # Platform admins have access to all features
        if user and user.role.value == "platform_admin":
            return True
        
        # Get tenant
        if not tenant_id:
            return False
        
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return False
        
        # Check tenant-specific override
        tenant_feature = db.query(TenantFeature).filter(
            TenantFeature.tenant_id == tenant_id,
            TenantFeature.feature_key == feature_key
        ).first()
        
        if tenant_feature:
            # Check if expired
            if tenant_feature.expires_at and tenant_feature.expires_at < datetime.utcnow():
                return False
            return tenant_feature.enabled
        
        # Check license tier
        feature_def = cls.FEATURES.get(feature_key)
        if not feature_def:
            logger.warning(f"Unknown feature: {feature_key}")
            return False
        
        # Check if feature is available in tenant's tier
        if tenant.license_tier in feature_def.get("tiers", []):
            return True
        
        return feature_def.get("default", False)
    
    @classmethod
    def get_tenant_features(cls, db: Session, tenant_id: str, tenant: Optional[Tenant] = None) -> Dict[str, bool]:
        """Get all features for a tenant (optimized - single query instead of N queries)"""
        # Use provided tenant or query once
        if tenant is None:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        
        if not tenant:
            return {}
        
        # Get all tenant-specific feature overrides in a single query (optimized)
        now = datetime.utcnow()
        tenant_features_raw = db.query(TenantFeature).filter(
            TenantFeature.tenant_id == tenant_id
        ).all()
        
        # Build map of enabled features (checking expiration)
        tenant_features = {}
        for tf in tenant_features_raw:
            # Check if expired
            if tf.expires_at and tf.expires_at < now:
                continue
            tenant_features[tf.feature_key] = tf.enabled
        
        # Build features dict efficiently
        features = {}
        license_tier = tenant.license_tier.lower() if tenant.license_tier else "trial"
        
        for feature_key, feature_def in cls.FEATURES.items():
            # Check tenant-specific override first
            if feature_key in tenant_features:
                features[feature_key] = tenant_features[feature_key]
            else:
                # Check license tier
                tier_list = [t.lower() for t in feature_def.get("tiers", [])]
                features[feature_key] = license_tier in tier_list or feature_def.get("default", False)
        
        return features
    
    @classmethod
    def check_agent_limit(cls, db: Session, tenant_id: str) -> Tuple[bool, Optional[int]]:
        """
        Check if tenant can create more agents
        
        Returns:
            (can_create, current_count)
        """
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return (False, None)
        
        # Unlimited agents feature
        if cls.is_feature_enabled(db, tenant_id, "unlimited_agents"):
            return (True, None)
        
        # Check limit
        if tenant.max_agents is None:
            return (True, None)
        
        try:
            limit = int(tenant.max_agents)
            # Count current agents - optimized query using join instead of loading all vendors
            from app.models.agent import Agent
            from app.models.vendor import Vendor
            from sqlalchemy import func
            
            # Use a single optimized query with join instead of loading all vendors
            count = db.query(func.count(Agent.id)).join(
                Vendor, Agent.vendor_id == Vendor.id
            ).filter(
                Vendor.tenant_id == tenant_id
            ).scalar() or 0
            
            return (count < limit, count)
        except (ValueError, TypeError) as e:
            logger.warning(f"Error checking agent limit for tenant {tenant_id}: {e}")
            return (True, None)
        except Exception as e:
            logger.error(f"Unexpected error checking agent limit for tenant {tenant_id}: {e}", exc_info=True)
            # Fail open - allow creation if we can't check the limit
            return (True, None)
    
    @classmethod
    def check_user_limit(cls, db: Session, tenant_id: str) -> Tuple[bool, Optional[int], Optional[int]]:
        """
        Check if tenant can add more users
        
        Returns:
            (can_create, current_count, max_users)
        """
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return (False, None, None)
        
        if tenant.max_users is None:
            count = db.query(User).filter(User.tenant_id == tenant_id).count()
            return (True, count, None)
        
        try:
            limit = int(tenant.max_users)
            count = db.query(User).filter(User.tenant_id == tenant_id).count()
            return (count < limit, count, limit)
        except (ValueError, TypeError):
            count = db.query(User).filter(User.tenant_id == tenant_id).count()
            return (True, count, None)


from datetime import datetime

