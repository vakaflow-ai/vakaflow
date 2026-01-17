"""
Ecosystem Map Service - Aggregates data from all entities for visualization
"""
import logging
from typing import Dict, List, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.product import Product
from app.models.service import Service
from app.models.vendor import Vendor
from app.models.architecture import ArchitectureDocument
from app.models.landscape import LandscapePosition
from app.models.agent import AgentProduct
from app.models.assessment import AssessmentAssignment

logger = logging.getLogger(__name__)


class EcosystemMapService:
    """Service for aggregating ecosystem data for visualization"""
    
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
    
    def get_network_graph_data(self) -> Dict[str, Any]:
        """Get network graph data for ecosystem visualization"""
        try:
            # Get all vendors for tenant
            vendors = self.db.query(Vendor).filter(Vendor.tenant_id == self.tenant_id).all()
            
            # Get all agents, products, services
            agents = self.db.query(Agent).filter(Agent.tenant_id == self.tenant_id).all()
            products = self.db.query(Product).filter(Product.tenant_id == self.tenant_id).all()
            services = self.db.query(Service).filter(Service.tenant_id == self.tenant_id).all()
            
            # Get agent-product relationships
            agent_products = self.db.query(AgentProduct).all()
            agent_product_map = {}
            for ap in agent_products:
                if ap.agent_id not in agent_product_map:
                    agent_product_map[ap.agent_id] = []
                agent_product_map[ap.agent_id].append(ap.product_id)
            
            # Build nodes
            nodes = []
            node_ids = set()
            
            # Add vendors
            for vendor in vendors:
                node_id = f"vendor_{vendor.id}"
                nodes.append({
                    "id": node_id,
                    "label": vendor.name,
                    "type": "vendor",
                    "data": {
                        "id": str(vendor.id),
                        "name": vendor.name,
                        "compliance_score": vendor.compliance_score,
                        "risk_score": None
                    }
                })
                node_ids.add(node_id)
            
            # Add products
            for product in products:
                node_id = f"product_{product.id}"
                nodes.append({
                    "id": node_id,
                    "label": product.name,
                    "type": "product",
                    "data": {
                        "id": str(product.id),
                        "name": product.name,
                        "vendor_id": str(product.vendor_id),
                        "compliance_score": product.compliance_score,
                        "risk_score": product.risk_score
                    }
                })
                node_ids.add(node_id)
            
            # Add services
            for service in services:
                node_id = f"service_{service.id}"
                nodes.append({
                    "id": node_id,
                    "label": service.name,
                    "type": "service",
                    "data": {
                        "id": str(service.id),
                        "name": service.name,
                        "vendor_id": str(service.vendor_id),
                        "compliance_score": service.compliance_score,
                        "risk_score": service.risk_score
                    }
                })
                node_ids.add(node_id)
            
            # Add agents
            for agent in agents:
                node_id = f"agent_{agent.id}"
                nodes.append({
                    "id": node_id,
                    "label": agent.name,
                    "type": "agent",
                    "data": {
                        "id": str(agent.id),
                        "name": agent.name,
                        "vendor_id": str(agent.vendor_id),
                        "compliance_score": agent.compliance_score,
                        "risk_score": agent.risk_score
                    }
                })
                node_ids.add(node_id)
            
            # Build edges
            edges = []
            
            # Vendor -> Product/Service/Agent relationships
            for product in products:
                vendor_node = f"vendor_{product.vendor_id}"
                product_node = f"product_{product.id}"
                if vendor_node in node_ids and product_node in node_ids:
                    edges.append({
                        "source": vendor_node,
                        "target": product_node,
                        "type": "owns",
                        "label": "owns"
                    })
            
            for service in services:
                vendor_node = f"vendor_{service.vendor_id}"
                service_node = f"service_{service.id}"
                if vendor_node in node_ids and service_node in node_ids:
                    edges.append({
                        "source": vendor_node,
                        "target": service_node,
                        "type": "owns",
                        "label": "owns"
                    })
            
            for agent in agents:
                vendor_node = f"vendor_{agent.vendor_id}"
                agent_node = f"agent_{agent.id}"
                if vendor_node in node_ids and agent_node in node_ids:
                    edges.append({
                        "source": vendor_node,
                        "target": agent_node,
                        "type": "owns",
                        "label": "owns"
                    })
            
            # Agent -> Product relationships
            for agent in agents:
                if agent.id in agent_product_map:
                    agent_node = f"agent_{agent.id}"
                    for product_id in agent_product_map[agent.id]:
                        product_node = f"product_{product_id}"
                        if agent_node in node_ids and product_node in node_ids:
                            edges.append({
                                "source": agent_node,
                                "target": product_node,
                                "type": "tagged_to",
                                "label": "tagged to"
                            })
            
            return {
                "nodes": nodes,
                "edges": edges
            }
            
        except Exception as e:
            logger.error(f"Error generating network graph data: {e}", exc_info=True)
            return {"nodes": [], "edges": []}
    
    def get_landscape_quadrant_data(self, category: Optional[str] = None) -> Dict[str, Any]:
        """Get landscape quadrant data for visualization"""
        try:
            query = self.db.query(LandscapePosition).filter(
                LandscapePosition.tenant_id == self.tenant_id
            )
            
            if category:
                query = query.filter(LandscapePosition.category == category)
            
            positions = query.all()
            
            data = []
            for pos in positions:
                data.append({
                    "id": str(pos.id),
                    "entity_type": pos.entity_type,
                    "entity_id": str(pos.entity_id),
                    "category": pos.category,
                    "subcategory": pos.subcategory,
                    "quadrant": pos.quadrant,
                    "position_x": pos.position_x,
                    "position_y": pos.position_y,
                    "capability_score": pos.capability_score,
                    "business_value_score": pos.business_value_score,
                    "maturity_score": pos.maturity_score,
                    "risk_score": pos.risk_score
                })
            
            return {
                "positions": data,
                "category": category
            }
            
        except Exception as e:
            logger.error(f"Error generating landscape quadrant data: {e}", exc_info=True)
            return {"positions": [], "category": category}
    
    def get_dependency_graph_data(self) -> Dict[str, Any]:
        """Get dependency graph data showing integrations and dependencies"""
        try:
            # Get all entities with integration_points
            products = self.db.query(Product).filter(
                Product.tenant_id == self.tenant_id,
                Product.integration_points.isnot(None)
            ).all()
            
            services = self.db.query(Service).filter(
                Service.tenant_id == self.tenant_id,
                Service.integration_points.isnot(None)
            ).all()
            
            nodes = []
            edges = []
            
            # Add product/service nodes
            for product in products:
                nodes.append({
                    "id": f"product_{product.id}",
                    "label": product.name,
                    "type": "product"
                })
                
                # Add integration edges
                if product.integration_points:
                    for integration in product.integration_points.get("integrations", []):
                        target_id = integration.get("target_entity_id")
                        if target_id:
                            edges.append({
                                "source": f"product_{product.id}",
                                "target": f"{integration.get('target_entity_type')}_{target_id}",
                                "type": "integration",
                                "label": integration.get("integration_type", "integration")
                            })
            
            for service in services:
                nodes.append({
                    "id": f"service_{service.id}",
                    "label": service.name,
                    "type": "service"
                })
                
                if service.integration_points:
                    for integration in service.integration_points.get("integrations", []):
                        target_id = integration.get("target_entity_id")
                        if target_id:
                            edges.append({
                                "source": f"service_{service.id}",
                                "target": f"{integration.get('target_entity_type')}_{target_id}",
                                "type": "integration",
                                "label": integration.get("integration_type", "integration")
                            })
            
            return {
                "nodes": nodes,
                "edges": edges
            }
            
        except Exception as e:
            logger.error(f"Error generating dependency graph data: {e}", exc_info=True)
            return {"nodes": [], "edges": []}
    
    def get_risk_heatmap_data(self) -> Dict[str, Any]:
        """Get risk heat map data"""
        try:
            # Aggregate risk scores by entity type and category
            agents = self.db.query(Agent).filter(
                Agent.tenant_id == self.tenant_id,
                Agent.risk_score.isnot(None)
            ).all()
            
            products = self.db.query(Product).filter(
                Product.tenant_id == self.tenant_id,
                Product.risk_score.isnot(None)
            ).all()
            
            services = self.db.query(Service).filter(
                Service.tenant_id == self.tenant_id,
                Service.risk_score.isnot(None)
            ).all()
            
            heatmap_data = []
            
            for agent in agents:
                heatmap_data.append({
                    "entity_type": "agent",
                    "entity_id": str(agent.id),
                    "name": agent.name,
                    "category": agent.category,
                    "risk_score": agent.risk_score,
                    "compliance_score": agent.compliance_score
                })
            
            for product in products:
                heatmap_data.append({
                    "entity_type": "product",
                    "entity_id": str(product.id),
                    "name": product.name,
                    "category": product.category,
                    "risk_score": product.risk_score,
                    "compliance_score": product.compliance_score
                })
            
            for service in services:
                heatmap_data.append({
                    "entity_type": "service",
                    "entity_id": str(service.id),
                    "name": service.name,
                    "category": service.category,
                    "risk_score": service.risk_score,
                    "compliance_score": service.compliance_score
                })
            
            return {
                "heatmap_data": heatmap_data
            }
            
        except Exception as e:
            logger.error(f"Error generating risk heatmap data: {e}", exc_info=True)
            return {"heatmap_data": []}
    
    def get_ecosystem_summary(self) -> Dict[str, Any]:
        """Get ecosystem summary statistics"""
        try:
            vendors_count = self.db.query(Vendor).filter(Vendor.tenant_id == self.tenant_id).count()
            agents_count = self.db.query(Agent).filter(Agent.tenant_id == self.tenant_id).count()
            products_count = self.db.query(Product).filter(Product.tenant_id == self.tenant_id).count()
            services_count = self.db.query(Service).filter(Service.tenant_id == self.tenant_id).count()
            
            # Risk distribution
            high_risk = self.db.query(Agent).filter(
                Agent.tenant_id == self.tenant_id,
                Agent.risk_score >= 70
            ).count()
            
            medium_risk = self.db.query(Agent).filter(
                Agent.tenant_id == self.tenant_id,
                Agent.risk_score >= 40,
                Agent.risk_score < 70
            ).count()
            
            low_risk = self.db.query(Agent).filter(
                Agent.tenant_id == self.tenant_id,
                Agent.risk_score < 40
            ).count()
            
            return {
                "total_vendors": vendors_count,
                "total_agents": agents_count,
                "total_products": products_count,
                "total_services": services_count,
                "risk_distribution": {
                    "high": high_risk,
                    "medium": medium_risk,
                    "low": low_risk
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating ecosystem summary: {e}", exc_info=True)
            return {
                "total_vendors": 0,
                "total_agents": 0,
                "total_products": 0,
                "total_services": 0,
                "risk_distribution": {"high": 0, "medium": 0, "low": 0}
            }
