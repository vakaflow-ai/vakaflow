"""
Studio Service - Aggregates VAKA agents and external agents for flow building
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
from datetime import datetime

from app.models.agentic_agent import AgenticAgent, AgenticAgentType
from app.models.agentic_flow import StudioAgent, AgentSource
from app.models.agentic_agent import MCPConnection
from app.models.user import User
from app.services.agentic.agent_registry import AgentRegistry
from app.services.agentic.mcp_server import MCPServer
import uuid

logger = logging.getLogger(__name__)


class StudioService:
    """Service for Studio operations - aggregating and managing agents"""
    
    def __init__(self, db_session):
        """
        Initialize Studio service
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.registry = AgentRegistry(db_session)
        self.mcp_server = MCPServer(db_session)
    
    async def get_studio_agents(
        self,
        tenant_id: Optional[UUID],
        agent_type: Optional[str] = None,
        skill: Optional[str] = None,
        source: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all agents available in Studio (VAKA + external)
        
        Args:
            tenant_id: Tenant ID
            agent_type: Filter by agent type
            skill: Filter by skill
            source: Filter by source (vaka, external, marketplace)
            category: Filter by category
            
        Returns:
            List of studio agents
        """
        agents = []
        
        # Get VAKA agents
        if not source or source == AgentSource.VAKA.value:
            vaka_agents = await self._get_vaka_agents(
                tenant_id, agent_type, skill, category
            )
            agents.extend(vaka_agents)
        
        # Get external agents via MCP
        if not source or source == AgentSource.EXTERNAL.value:
            external_agents = await self._get_external_agents(
                tenant_id, agent_type, skill, category
            )
            agents.extend(external_agents)
        
        # Get marketplace agents (if implemented)
        if not source or source == AgentSource.MARKETPLACE.value:
            marketplace_agents = await self._get_marketplace_agents(
                tenant_id, agent_type, skill, category
            )
            agents.extend(marketplace_agents)
        
        return agents
    
    async def _get_vaka_agents(
        self,
        tenant_id: Optional[UUID],
        agent_type: Optional[str] = None,
        skill: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get VAKA built-in agents"""
        query = self.db.query(AgenticAgent).filter(
            AgenticAgent.status == "active"
        )
        
        # Tenant isolation - ALL users (including platform_admin) must filter by tenant_id
        if tenant_id is None:
            raise ValueError("tenant_id is required for tenant isolation")
        query = query.filter(AgenticAgent.tenant_id == tenant_id)
        
        if agent_type:
            query = query.filter(AgenticAgent.agent_type == agent_type)
        
        agent_models = query.all()
        
        agents = []
        for agent_model in agent_models:
            # Filter by skill if specified
            if skill and skill not in (agent_model.skills or []):
                continue
            
            # Get StudioAgent for master data attributes
            studio_query = self.db.query(StudioAgent).filter(
                StudioAgent.source_agent_id == agent_model.id
            )
            # Tenant isolation - ALL users must filter by tenant_id
            studio_query = studio_query.filter(StudioAgent.tenant_id == tenant_id)
            studio_agent = studio_query.first()
            
            # Get owner name if exists
            owner_name = None
            if studio_agent and studio_agent.owner_id:
                owner = self.db.query(User).filter(User.id == studio_agent.owner_id).first()
                owner_name = owner.name if owner else None
            
            agents.append({
                "id": str(agent_model.id),
                "name": agent_model.name,
                "agent_type": agent_model.agent_type,
                "description": agent_model.description,
                "source": AgentSource.VAKA.value,
                "source_agent_id": str(agent_model.id),
                "mcp_connection_id": None,  # VAKA agents don't use MCP
                "mcp_connection_name": None,
                "platform_name": None,
                "skills": agent_model.skills or [],
                "capabilities": agent_model.capabilities or {},
                "category": category or "general",
                "is_available": True,
                "is_featured": False,
                "usage_count": agent_model.total_interactions,
                "last_used_at": agent_model.last_used_at.isoformat() if agent_model.last_used_at else None,
                # Master data attributes
                "owner_id": str(studio_agent.owner_id) if studio_agent and studio_agent.owner_id else None,
                "owner_name": owner_name,
                "department": studio_agent.department if studio_agent else None,
                "organization": studio_agent.organization if studio_agent else None,
                "master_data_attributes": studio_agent.master_data_attributes if studio_agent else None
            })
        
        return agents
    
    async def _get_external_agents(
        self,
        tenant_id: Optional[UUID],
        agent_type: Optional[str] = None,
        skill: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get external agents via MCP connections"""
        # Get active MCP connections for tenant
        connections_query = self.db.query(MCPConnection).filter(
            MCPConnection.enabled == True
        )
        # Tenant isolation - ALL users must filter by tenant_id
        connections_query = connections_query.filter(
            MCPConnection.tenant_id == tenant_id
        )
        connections = connections_query.all()
        
        agents = []
        for connection in connections:
            try:
                # Query external platform for agents
                result = await self.mcp_server.handle_mcp_request(
                    connection.id,
                    "agent_list",
                    {
                        "agent_type": agent_type,
                        "skill": skill
                    },
                    tenant_id
                )
                
                if result.get("success") and result.get("agents"):
                    for ext_agent in result["agents"]:
                        agents.append({
                            "id": f"ext_{connection.id}_{ext_agent.get('id', '')}",
                            "name": ext_agent.get("name", "Unknown Agent"),
                            "agent_type": ext_agent.get("agent_type", "unknown"),
                            "description": ext_agent.get("description"),
                            "source": AgentSource.EXTERNAL.value,
                            "source_agent_id": ext_agent.get("id"),
                            "mcp_connection_id": str(connection.id),
                            "mcp_connection_name": connection.connection_name,
                            "platform_name": connection.platform_name,
                            "skills": ext_agent.get("skills", []),
                            "capabilities": ext_agent.get("capabilities", {}),
                            "category": category or "external",
                            "is_available": True,
                            "is_featured": False,
                            "usage_count": 0,
                            "last_used_at": None
                        })
            except Exception as e:
                logger.error(f"Failed to get agents from MCP connection {connection.id}: {e}")
                continue
        
        return agents
    
    async def _get_marketplace_agents(
        self,
        tenant_id: Optional[UUID],
        agent_type: Optional[str] = None,
        skill: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get marketplace agents (placeholder for future implementation)"""
        # TODO: Implement marketplace agent discovery
        return []
    
    async def get_studio_agent(
        self,
        tenant_id: Optional[UUID],
        agent_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get a single agent by ID
        
        Args:
            tenant_id: Tenant ID
            agent_id: Agent ID (can be VAKA agent ID or external agent ID)
            
        Returns:
            Agent dict or None if not found
        """
        # Try to determine source from agent_id
        if agent_id.startswith("ext_"):
            # External agent - would need to query MCP
            # For now, get from all agents
            agents = await self.get_studio_agents(tenant_id=tenant_id)
            for agent in agents:
                if agent["id"] == agent_id:
                    return agent
        else:
            # VAKA agent
            try:
                # Tenant isolation - ALL users must filter by tenant_id
                agent_query = self.db.query(AgenticAgent).filter(
                    AgenticAgent.id == UUID(agent_id),
                    AgenticAgent.tenant_id == tenant_id
                )
                agent_model = agent_query.first()
                
                if agent_model:
                    # Get StudioAgent for master data attributes - refresh to get latest data
                    # Tenant isolation - ALL users must filter by tenant_id
                    studio_query = self.db.query(StudioAgent).filter(
                        StudioAgent.source_agent_id == agent_model.id,
                        StudioAgent.tenant_id == tenant_id
                    )
                    studio_agent = studio_query.first()
                    
                    # Refresh to ensure we have latest data
                    if studio_agent:
                        self.db.refresh(studio_agent)
                    
                    # Get owner name if exists
                    owner_name = None
                    if studio_agent and studio_agent.owner_id:
                        owner = self.db.query(User).filter(User.id == studio_agent.owner_id).first()
                        owner_name = owner.name if owner else None
                    
                    # Use StudioAgent values if available, otherwise fall back to defaults
                    return {
                        "id": str(agent_model.id),
                        "name": studio_agent.name if studio_agent else agent_model.name,
                        "agent_type": agent_model.agent_type,
                        "description": studio_agent.description if studio_agent and studio_agent.description else agent_model.description,
                        "source": AgentSource.VAKA.value,
                        "source_agent_id": str(agent_model.id),
                        "mcp_connection_id": None,
                        "mcp_connection_name": None,
                        "platform_name": None,
                        "skills": agent_model.skills or [],
                        "capabilities": agent_model.capabilities or {},
                        "category": studio_agent.category if studio_agent else "general",
                        "tags": studio_agent.tags if studio_agent else [],
                        "icon_url": studio_agent.icon_url if studio_agent else None,
                        "is_available": studio_agent.is_available if studio_agent is not None else True,
                        "is_featured": studio_agent.is_featured if studio_agent is not None else False,
                        "usage_count": agent_model.total_interactions,
                        "last_used_at": agent_model.last_used_at.isoformat() if agent_model.last_used_at else None,
                        # Master data attributes - always include, even if None
                        "owner_id": str(studio_agent.owner_id) if studio_agent and studio_agent.owner_id else None,
                        "owner_name": owner_name,
                        "department": studio_agent.department if studio_agent else None,
                        "organization": studio_agent.organization if studio_agent else None,
                        "master_data_attributes": studio_agent.master_data_attributes if studio_agent else None
                    }
            except (ValueError, TypeError):
                pass
        
        return None
    
    async def update_studio_agent(
        self,
        tenant_id: UUID,
        agent_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update agent settings (business info and properties)
        
        Args:
            tenant_id: Tenant ID
            agent_id: Agent ID (must be VAKA agent for now)
            updates: Dictionary of fields to update
            
        Returns:
            Updated agent dict or None if not found
            
        Note:
            - VAKA agents: Can update description, category, tags, icon_url, is_available, is_featured, capabilities
            - External agents: Updates not supported yet (would need MCP support)
        """
        # For now, only support updating VAKA agents
        try:
            agent_model = self.db.query(AgenticAgent).filter(
                AgenticAgent.id == UUID(agent_id),
                AgenticAgent.tenant_id == tenant_id
            ).first()
            
            if not agent_model:
                return None
            
            # Update allowed fields on AgenticAgent
            if "description" in updates:
                agent_model.description = updates["description"]
            if "capabilities" in updates:
                agent_model.capabilities = updates["capabilities"]
            
            # Note: name, category, tags, icon_url are stored in StudioAgent table
            # for display purposes, not in AgenticAgent
            
            # Update StudioAgent table if it exists (for display properties)
            studio_agent = self.db.query(StudioAgent).filter(
                StudioAgent.source_agent_id == UUID(agent_id),
                StudioAgent.tenant_id == tenant_id
            ).first()
            
            if studio_agent:
                if "name" in updates:
                    studio_agent.name = updates["name"]
                if "description" in updates:
                    studio_agent.description = updates["description"]
                if "category" in updates:
                    studio_agent.category = updates["category"]
                if "tags" in updates:
                    studio_agent.tags = updates["tags"]
                if "icon_url" in updates:
                    studio_agent.icon_url = updates["icon_url"]
                if "is_available" in updates:
                    studio_agent.is_available = updates["is_available"]
                if "is_featured" in updates:
                    studio_agent.is_featured = updates["is_featured"]
                if "owner_id" in updates:
                    # Handle null/None/empty string - all should clear the owner
                    if updates["owner_id"] is None or updates["owner_id"] == "":
                        studio_agent.owner_id = None
                    else:
                        studio_agent.owner_id = UUID(updates["owner_id"])
                    logger.debug(f"Updated owner_id to: {studio_agent.owner_id}")
                if "department" in updates:
                    # Handle null/None/empty string - all should clear the department
                    if updates["department"] is None or (isinstance(updates["department"], str) and not updates["department"].strip()):
                        studio_agent.department = None
                    else:
                        studio_agent.department = updates["department"].strip() if isinstance(updates["department"], str) else updates["department"]
                    logger.debug(f"Updated department to: {studio_agent.department}")
                if "organization" in updates:
                    # Handle null/None/empty string - all should clear the organization
                    if updates["organization"] is None or (isinstance(updates["organization"], str) and not updates["organization"].strip()):
                        studio_agent.organization = None
                    else:
                        studio_agent.organization = updates["organization"].strip() if isinstance(updates["organization"], str) else updates["organization"]
                    logger.debug(f"Updated organization to: {studio_agent.organization}")
                if "master_data_attributes" in updates:
                    # Handle null/None/empty dict - all should clear the master_data_attributes
                    if updates["master_data_attributes"] is None:
                        studio_agent.master_data_attributes = None
                    elif isinstance(updates["master_data_attributes"], dict) and len(updates["master_data_attributes"]) > 0:
                        studio_agent.master_data_attributes = updates["master_data_attributes"]
                    else:
                        studio_agent.master_data_attributes = None
                    logger.debug(f"Updated master_data_attributes to: {studio_agent.master_data_attributes}")
            else:
                # Create StudioAgent entry if it doesn't exist
                logger.info(f"Creating new StudioAgent entry for agent {agent_id}")
                studio_agent = StudioAgent(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    name=updates.get("name", agent_model.name),
                    agent_type=agent_model.agent_type,
                    description=updates.get("description", agent_model.description),
                    source=AgentSource.VAKA.value,
                    source_agent_id=agent_model.id,
                    skills=agent_model.skills or [],
                    capabilities=updates.get("capabilities", agent_model.capabilities or {}),
                    category=updates.get("category", "general"),
                    tags=updates.get("tags", []),
                    icon_url=updates.get("icon_url"),
                    is_available=updates.get("is_available", True),
                    is_featured=updates.get("is_featured", False),
                    owner_id=UUID(updates["owner_id"]) if updates.get("owner_id") and updates.get("owner_id") != "" else None,
                    department=updates.get("department").strip() if updates.get("department") and isinstance(updates.get("department"), str) and updates.get("department").strip() else None,
                    organization=updates.get("organization").strip() if updates.get("organization") and isinstance(updates.get("organization"), str) and updates.get("organization").strip() else None,
                    master_data_attributes=updates.get("master_data_attributes") if updates.get("master_data_attributes") and isinstance(updates.get("master_data_attributes"), dict) and len(updates.get("master_data_attributes", {})) > 0 else None
                )
                self.db.add(studio_agent)
                logger.info(f"Created StudioAgent with owner_id={studio_agent.owner_id}, department={studio_agent.department}, organization={studio_agent.organization}")
            
            self.db.commit()
            self.db.refresh(agent_model)
            if studio_agent:
                self.db.refresh(studio_agent)
            
            logger.info(f"Successfully updated agent {agent_id} with fields: {list(updates.keys())}")
            logger.info(f"Updated StudioAgent values - owner_id: {studio_agent.owner_id if studio_agent else 'N/A'}, department: {studio_agent.department if studio_agent else 'N/A'}, organization: {studio_agent.organization if studio_agent else 'N/A'}")
            
            # Return updated agent
            updated_agent_dict = await self.get_studio_agent(tenant_id, agent_id)
            logger.info(f"Returning updated agent with owner_id: {updated_agent_dict.get('owner_id') if updated_agent_dict else 'N/A'}, department: {updated_agent_dict.get('department') if updated_agent_dict else 'N/A'}")
            return updated_agent_dict
            
        except (ValueError, TypeError) as e:
            logger.error(f"Failed to update agent {agent_id}: {e}", exc_info=True)
            self.db.rollback()
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating agent {agent_id}: {e}", exc_info=True)
            self.db.rollback()
            raise
            raise ValueError(f"Invalid agent ID: {agent_id}")
        except Exception as e:
            logger.error(f"Error updating agent {agent_id}: {e}", exc_info=True)
            self.db.rollback()
            raise
    
    async def execute_agent_in_studio(
        self,
        tenant_id: UUID,
        agent_id: str,
        source: str,
        skill: str,
        input_data: Dict[str, Any],
        mcp_connection_id: Optional[UUID] = None,
        triggered_by: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Execute an agent skill from Studio
        
        Args:
            tenant_id: Tenant ID
            agent_id: Agent ID (can be VAKA agent ID or external agent ID)
            source: Agent source (vaka, external, marketplace)
            skill: Skill to execute
            input_data: Input data
            mcp_connection_id: MCP connection ID (for external agents)
            
        Returns:
            Execution result
        """
        import time
        start_time = time.time()
        
        try:
            if source == AgentSource.VAKA.value:
                # Execute VAKA agent
                logger.info(f"Executing VAKA agent {agent_id} skill {skill} for tenant {tenant_id}")
                agent = await self.registry.get_agent(UUID(agent_id), tenant_id)
                if not agent:
                    raise ValueError(f"VAKA agent {agent_id} not found")
                
                if not agent.has_skill(skill):
                    raise ValueError(f"Agent does not have skill: {skill}")
                
                # Handle vendor_id if provided directly (may be array for TPRM)
                if "vendor_id" in input_data and not input_data.get("agent_id"):
                    vendor_id_value = input_data.get("vendor_id")
                    if isinstance(vendor_id_value, list):
                        if len(vendor_id_value) > 0:
                            # For TPRM with multiple vendors, use the first one
                            first_vendor = vendor_id_value[0]
                            if first_vendor:
                                input_data["vendor_id"] = str(first_vendor)
                                logger.info(f"Extracted first vendor_id from array: {input_data['vendor_id']}")
                            else:
                                # Empty string in array - remove it
                                input_data.pop("vendor_id", None)
                        else:
                            # Empty array - remove it so error handling below catches it
                            input_data.pop("vendor_id", None)
                            logger.warning("vendor_id was provided as empty array")
                    elif vendor_id_value:
                        # Ensure it's a string (not None, not empty)
                        vendor_str = str(vendor_id_value).strip()
                        if vendor_str and vendor_str.lower() != "none":
                            input_data["vendor_id"] = vendor_str
                            logger.info(f"Using vendor_id from input_data: {input_data['vendor_id']}")
                        else:
                            input_data.pop("vendor_id", None)
                    else:
                        # None or empty - remove it so error handling below catches it
                        input_data.pop("vendor_id", None)
                
                # Handle agent_selection field - convert to agent_id or vendor_id for skills that need it
                # Also handle agent_selection_original (when agent_selection was already processed but expansion failed)
                agent_selection = None
                if "agent_selection" in input_data:
                    agent_selection = input_data.pop("agent_selection")
                elif "agent_selection_original" in input_data and not input_data.get("agent_id") and not input_data.get("vendor_id"):
                    # Try to re-expand if original exists but expansion failed
                    agent_selection = input_data.get("agent_selection_original")
                    logger.info(f"Re-expanding agent_selection_original: {agent_selection}")
                
                if agent_selection and not input_data.get("agent_id") and not input_data.get("vendor_id"):
                    # If agent_selection is a dict with vendor mode, extract vendor_id directly
                    if isinstance(agent_selection, dict) and agent_selection.get("mode") == "vendor":
                        vendors = agent_selection.get("vendors", [])
                        if vendors:
                            # For TPRM, use the first vendor_id
                            input_data["vendor_id"] = vendors[0] if isinstance(vendors[0], str) else str(vendors[0])
                            logger.info(f"Extracted vendor_id from agent_selection: {input_data['vendor_id']}")
                        else:
                            raise ValueError("agent_selection with vendor mode requires at least one vendor_id in the 'vendors' array")
                    else:
                        # Expand agent selection to agent IDs
                        from app.services.agent_selection_expander import AgentSelectionExpander
                        expander = AgentSelectionExpander(self.db, tenant_id)
                        expanded_agent_ids = expander.expand_selection(agent_selection)
                        
                        if expanded_agent_ids:
                            # For TPRM, prefer vendor_id if we can get it from the first agent
                            if skill == "tprm":
                                first_agent_id = expanded_agent_ids[0]
                                if not first_agent_id.startswith("${"):
                                    from app.models.agent import Agent
                                    agent_model = self.db.query(Agent).filter(Agent.id == first_agent_id).first()
                                    if agent_model:
                                        input_data["vendor_id"] = str(agent_model.vendor_id)
                                        logger.info(f"Extracted vendor_id from agent {first_agent_id}: {input_data['vendor_id']}")
                                    else:
                                        input_data["agent_id"] = first_agent_id
                                else:
                                    input_data["agent_id"] = first_agent_id
                            else:
                                # For other skills, use agent_id
                                input_data["agent_id"] = expanded_agent_ids[0]
                                if len(expanded_agent_ids) > 1:
                                    input_data["agent_ids"] = expanded_agent_ids
                        else:
                            # Expansion failed - provide helpful error message
                            if isinstance(agent_selection, dict):
                                mode = agent_selection.get("mode", "unknown")
                                if mode == "category":
                                    categories = agent_selection.get("categories", [])
                                    if not categories:
                                        raise ValueError(
                                            f"agent_selection with category mode requires at least one category. "
                                            f"Please select categories in the agent selection configuration. "
                                            f"Received: {agent_selection}"
                                        )
                                    else:
                                        raise ValueError(
                                            f"No agents found matching the selected categories: {categories}. "
                                            f"Please ensure there are approved agents in these categories for your tenant."
                                        )
                                elif mode == "vendor":
                                    vendors = agent_selection.get("vendors", [])
                                    if not vendors:
                                        raise ValueError(
                                            f"agent_selection with vendor mode requires at least one vendor_id. "
                                            f"Received: {agent_selection}"
                                        )
                                    else:
                                        raise ValueError(
                                            f"No approved agents found for vendors: {vendors}. "
                                            f"Please ensure there are approved agents for these vendors."
                                        )
                                elif mode == "agent":
                                    agent_ids = agent_selection.get("agent_ids", [])
                                    if not agent_ids:
                                        raise ValueError(
                                            f"agent_selection with agent mode requires at least one agent_id. "
                                            f"Received: {agent_selection}"
                                        )
                                    else:
                                        raise ValueError(
                                            f"None of the specified agents were found or approved: {agent_ids}. "
                                            f"Please ensure the agent IDs are correct and the agents are approved."
                                        )
                                else:
                                    raise ValueError(
                                        f"agent_selection expansion failed. No agents matched the selection criteria. "
                                        f"Mode: {mode}, Selection: {agent_selection}"
                                    )
                            else:
                                raise ValueError(
                                    f"agent_selection expansion failed. Invalid selection format or no agents found. "
                                    f"Selection: {agent_selection}"
                                )
                
                # Evaluate business rules before agent execution
                try:
                    from app.services.business_rules_engine import BusinessRulesEngine
                    rules_engine = BusinessRulesEngine(self.db, tenant_id)
                    
                    # Build context for rule evaluation
                    context = {
                        "agent": {
                            "id": str(agent.agent_id) if hasattr(agent, 'agent_id') else agent_id,
                            "name": agent.name,
                            "type": agent.agent_type if hasattr(agent, 'agent_type') else None,
                            "category": getattr(agent, 'category', None),
                            "source": source
                        },
                        "skill": skill,
                        "input_data": input_data
                    }
                    
                    # Evaluate agent execution rules
                    rule_results = rules_engine.evaluate_rules(
                        context=context,
                        entity_type="agent",
                        screen="agent_execution",
                        rule_type="validation"
                    )
                    
                    # Execute automatic validation/action rules
                    if rule_results:
                        action_results = rules_engine.execute_actions(
                            rule_results,
                            context,
                            auto_execute=True
                        )
                        
                        # Check for validation failures
                        for executed in action_results.get("executed", []):
                            if executed.get("action", {}).get("type") == "validate":
                                validation_result = executed.get("result", {})
                                if validation_result.get("status") != "success":
                                    raise ValueError(f"Business rule validation failed: {validation_result.get('message', 'Validation failed')}")
                except Exception as e:
                    logger.warning(f"Error evaluating business rules for agent execution: {e}", exc_info=True)
                    # Continue with execution unless it's a validation error
                    if "validation failed" in str(e).lower():
                        raise
                
                # Check rate limits before execution
                from app.services.agent_rate_limiter import AgentRateLimiter
                rate_limiter = AgentRateLimiter(self.db)
                
                # Get user_id from context if available
                user_id = None
                if context and "user_id" in context:
                    from uuid import UUID as UUIDType
                    try:
                        user_id = UUIDType(context["user_id"]) if isinstance(context["user_id"], str) else context["user_id"]
                    except (ValueError, TypeError):
                        pass
                
                # Get agent_id as UUID
                agent_uuid = agent.agent_id if hasattr(agent, 'agent_id') else UUID(agent_id)
                
                is_allowed, limit_type, limit_details = rate_limiter.check_agent_execution_rate_limit(
                    agent_id=agent_uuid,
                    tenant_id=tenant_id,
                    user_id=user_id
                )
                
                if not is_allowed:
                    error_msg = f"Rate limit exceeded: {limit_type}"
                    if limit_details:
                        error_msg += f" (limit: {limit_details.get('limit')}, current: {limit_details.get('current')}, window: {limit_details.get('window')})"
                    logger.warning(f"Agent execution rate limited: {error_msg}")
                    raise ValueError(error_msg)
                
                # Log final input_data before execution for debugging
                logger.info(f"Final input_data before execution: {input_data}")
                logger.info(f"Starting skill execution: {skill} on agent {agent.name}")
                
                # Validate required fields for TPRM skill
                if skill == "tprm" and not input_data.get("agent_id") and not input_data.get("vendor_id"):
                    raise ValueError(
                        "TPRM skill requires either 'agent_id' or 'vendor_id' in input_data. "
                        f"Received input_data keys: {list(input_data.keys())}. "
                        "Please ensure vendor_id is provided when executing TPRM from Studio."
                    )
                
                # Build context for agent execution (includes tenant_id and triggered_by)
                agent_context = {
                    "tenant_id": str(tenant_id),
                }
                if triggered_by:
                    agent_context["triggered_by"] = str(triggered_by)
                
                logger.info(f"🔍 Executing agent skill '{skill}' with context: tenant_id={tenant_id}, triggered_by={triggered_by}")
                try:
                    result = await agent.execute_skill(skill, input_data, context=agent_context)
                    execution_time = time.time() - start_time
                    logger.info(f"Skill execution completed in {execution_time:.2f}s")
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    logger.error(f"❌ Agent skill execution failed after {execution_time:.2f}s: {type(e).__name__}: {str(e)}", exc_info=True)
                    logger.error(f"   Skill: {skill}, Agent: {agent.name}, Context: {agent_context}, Input keys: {list(input_data.keys())}")
                    raise
        
            elif source == AgentSource.EXTERNAL.value:
                # Execute external agent via MCP
                logger.info(f"Executing external agent {agent_id} via MCP connection {mcp_connection_id}")
                if not mcp_connection_id:
                    raise ValueError("MCP connection ID required for external agents")
                
                connection = self.db.query(MCPConnection).filter(
                    MCPConnection.id == mcp_connection_id,
                    MCPConnection.tenant_id == tenant_id
                ).first()
                
                if not connection:
                    raise ValueError(f"MCP connection {mcp_connection_id} not found")
                
                result = await self.mcp_server.handle_mcp_request(
                    mcp_connection_id,
                    "skill_execution",
                    {
                        "agent_id": agent_id,
                        "agent_type": None,  # Will be determined by external platform
                        "skill": skill,
                        "input_data": input_data
                    },
                    tenant_id
                )
                
                execution_time = time.time() - start_time
                logger.info(f"External agent execution completed in {execution_time:.2f}s")
                return result.get("result", {})
            
            else:
                raise ValueError(f"Unknown agent source: {source}")
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Agent execution failed after {execution_time:.2f}s: {e}", exc_info=True)
            raise
