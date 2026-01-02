"""
Data Aggregation Service - Collects data from Agents, RAG, MCP for presentation
"""
from typing import Dict, List, Optional, Any
from uuid import UUID
import logging
from datetime import datetime, timedelta
import asyncio

from app.services.agentic.agent_registry import AgentRegistry
from app.services.rag_service import rag_service
from app.services.enhanced_rag_service import EnhancedRAGService
from app.services.agentic.mcp_server import MCPServer
from app.services.agentic.external_agent_service import ExternalAgentService
from app.core.cache import get_redis

logger = logging.getLogger(__name__)


class DataAggregator:
    """Aggregates data from multiple sources for presentation"""
    
    def __init__(self, db_session):
        """
        Initialize data aggregator
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.registry = AgentRegistry(db_session)
        self.rag_service = rag_service
        self.enhanced_rag = EnhancedRAGService(rag_service)
        self.mcp_server = MCPServer(db_session)
        self.external_service = ExternalAgentService(db_session)
        self.redis = get_redis()
    
    async def aggregate_data(
        self,
        data_sources: List[Dict[str, Any]],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Aggregate data from multiple sources
        
        Args:
            data_sources: List of data source configurations
                [
                    {
                        "type": "agent" | "rag" | "mcp" | "database" | "analytics",
                        "source_id": "...",
                        "query": "...",
                        "params": {...}
                    }
                ]
            tenant_id: Tenant ID
            context: Additional context
            use_cache: Whether to use cache
            
        Returns:
            Aggregated data dictionary
        """
        # Generate cache key
        cache_key = self._generate_cache_key(data_sources, tenant_id, context)
        
        # Check cache
        if use_cache and self.redis:
            try:
                cached_data = self.redis.get(cache_key)
                if cached_data:
                    import json
                    logger.info(f"Returning cached data for key: {cache_key}")
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"Cache read failed: {e}")
        
        # Collect data from all sources in parallel
        tasks = []
        for source in data_sources:
            task = self._collect_from_source(source, tenant_id, context)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results
        aggregated = {}
        for i, result in enumerate(results):
            source = data_sources[i]
            source_key = source.get("key", f"source_{i}")
            
            if isinstance(result, Exception):
                logger.error(f"Error collecting from source {source_key}: {result}")
                aggregated[source_key] = {
                    "error": str(result),
                    "status": "error"
                }
            else:
                aggregated[source_key] = {
                    "data": result,
                    "status": "success",
                    "source_type": source.get("type"),
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        # Cache result (TTL: 5 minutes)
        if use_cache and self.redis:
            try:
                import json
                self.redis.setex(cache_key, 300, json.dumps(aggregated))
            except Exception as e:
                logger.warning(f"Cache write failed: {e}")
        
        return aggregated
    
    async def _collect_from_source(
        self,
        source: Dict[str, Any],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> Any:
        """
        Collect data from a single source
        
        Args:
            source: Source configuration
            tenant_id: Tenant ID
            context: Additional context
            
        Returns:
            Data from source
        """
        source_type = source.get("type")
        
        if source_type == "agent":
            return await self._collect_from_agent(source, tenant_id, context)
        elif source_type == "rag":
            return await self._collect_from_rag(source, tenant_id, context)
        elif source_type == "mcp":
            return await self._collect_from_mcp(source, tenant_id, context)
        elif source_type == "database":
            return await self._collect_from_database(source, tenant_id, context)
        elif source_type == "analytics":
            return await self._collect_from_analytics(source, tenant_id, context)
        else:
            raise ValueError(f"Unknown source type: {source_type}")
    
    async def _collect_from_agent(
        self,
        source: Dict[str, Any],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Collect data from agent"""
        agent_id = UUID(source.get("source_id"))
        skill = source.get("query")  # Skill to execute
        params = source.get("params", {})
        
        # Merge context into params
        if context:
            params = {**context, **params}
        
        agent = await self.registry.get_agent(agent_id, tenant_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        if not agent.has_skill(skill):
            raise ValueError(f"Agent does not have skill: {skill}")
        
        result = await agent.execute_skill(skill, params)
        return result
    
    async def _collect_from_rag(
        self,
        source: Dict[str, Any],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Collect data from RAG"""
        query = source.get("query")
        agent_id = source.get("source_id")  # Optional agent filter
        limit = source.get("params", {}).get("limit", 5)
        
        if not query:
            raise ValueError("RAG query is required")
        
        # Use enhanced RAG for better results
        results = await self.enhanced_rag.enhanced_search(
            query=query,
            agent_id=agent_id,
            limit=limit,
            score_threshold=0.5
        )
        
        return results
    
    async def _collect_from_mcp(
        self,
        source: Dict[str, Any],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Collect data from MCP connection"""
        connection_id = UUID(source.get("source_id"))
        request_type = source.get("query")  # Request type
        payload = source.get("params", {})
        
        # Merge context into payload
        if context:
            payload = {**context, **payload}
        
        result = await self.mcp_server.handle_mcp_request(
            connection_id,
            request_type,
            payload,
            tenant_id
        )
        
        return result
    
    async def _collect_from_database(
        self,
        source: Dict[str, Any],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Collect data from database"""
        query_config = source.get("query")  # SQL or ORM query config
        params = source.get("params", {})
        
        # Merge context into params
        if context:
            params = {**context, **params}
        
        # Execute database query
        # This is a placeholder - implement based on query_config
        # In production, use parameterized queries or ORM
        
        return []
    
    async def _collect_from_analytics(
        self,
        source: Dict[str, Any],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Collect data from analytics service"""
        analytics_type = source.get("query")  # Analytics type
        params = source.get("params", {})
        
        # Merge context into params
        if context:
            params = {**context, **params}
        
        # Call analytics service
        # This is a placeholder - implement based on analytics_type
        # For now, return empty result
        return {
            "analytics_type": analytics_type,
            "data": [],
            "message": "Analytics service integration pending"
        }
    
    def _generate_cache_key(
        self,
        data_sources: List[Dict[str, Any]],
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Generate cache key for data sources"""
        import hashlib
        import json
        
        key_data = {
            "sources": data_sources,
            "tenant_id": str(tenant_id),
            "context": context or {}
        }
        
        key_string = json.dumps(key_data, sort_keys=True)
        return f"data_agg:{hashlib.md5(key_string.encode()).hexdigest()}"
