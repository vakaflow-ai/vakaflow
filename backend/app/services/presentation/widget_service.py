"""
Widget Service - Manages widgets and their data
"""
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
import logging
from datetime import datetime, timedelta
import uuid

from app.models.presentation import Widget, WidgetDataCache, WidgetType
from app.services.presentation.data_aggregator import DataAggregator

logger = logging.getLogger(__name__)


class WidgetService:
    """Service for managing widgets and their data"""
    
    def __init__(self, db_session):
        """
        Initialize widget service
        
        Args:
            db_session: Database session
        """
        self.db = db_session
        self.data_aggregator = DataAggregator(db_session)
    
    async def get_widget_data(
        self,
        widget_id: UUID,
        tenant_id: UUID,
        context: Optional[Dict[str, Any]] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get data for a widget
        
        Args:
            widget_id: Widget ID
            tenant_id: Tenant ID
            context: Additional context
            force_refresh: Force refresh (bypass cache)
            
        Returns:
            Widget data
        """
        widget = self.db.query(Widget).filter(
            Widget.id == widget_id,
            Widget.tenant_id == tenant_id
        ).first()
        
        if not widget:
            raise ValueError(f"Widget {widget_id} not found")
        
        # Check cache if not forcing refresh
        if not force_refresh:
            cached_data = self._get_cached_data(widget_id, tenant_id, context)
            if cached_data:
                return cached_data
        
        # Aggregate data from sources
        aggregated_data = await self.data_aggregator.aggregate_data(
            data_sources=widget.data_sources,
            tenant_id=tenant_id,
            context=context,
            use_cache=True
        )
        
        # Transform data based on widget type
        transformed_data = self._transform_data_for_widget(
            widget.widget_type,
            aggregated_data,
            widget.widget_config
        )
        
        # Cache the result
        self._cache_widget_data(widget_id, tenant_id, context, transformed_data)
        
        return transformed_data
    
    def _transform_data_for_widget(
        self,
        widget_type: str,
        aggregated_data: Dict[str, Any],
        widget_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Transform aggregated data for widget display
        
        Args:
            widget_type: Type of widget
            aggregated_data: Aggregated data from sources
            widget_config: Widget configuration
            
        Returns:
            Transformed data for widget
        """
        if widget_type == WidgetType.METRIC.value:
            return self._transform_for_metric(aggregated_data, widget_config)
        elif widget_type == WidgetType.CHART.value:
            return self._transform_for_chart(aggregated_data, widget_config)
        elif widget_type == WidgetType.TABLE.value:
            return self._transform_for_table(aggregated_data, widget_config)
        elif widget_type == WidgetType.LIST.value:
            return self._transform_for_list(aggregated_data, widget_config)
        elif widget_type == WidgetType.AGENT_INSIGHT.value:
            return self._transform_for_agent_insight(aggregated_data, widget_config)
        elif widget_type == WidgetType.RAG_CONTEXT.value:
            return self._transform_for_rag_context(aggregated_data, widget_config)
        else:
            # Return raw data for custom widgets
            return aggregated_data
    
    def _transform_for_metric(
        self,
        data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform data for metric widget"""
        # Extract metric value from first successful source
        for source_key, source_data in data.items():
            if source_data.get("status") == "success":
                source_value = source_data.get("data", {})
                
                # Try to extract metric value
                metric_path = config.get("metric_path", "value")
                value = self._extract_nested_value(source_value, metric_path)
                
                return {
                    "value": value,
                    "format": config.get("format", "number"),
                    "unit": config.get("unit", ""),
                    "decimals": config.get("decimals", 0),
                    "label": config.get("label", "Metric"),
                    "trend": source_value.get("trend"),  # If available
                    "timestamp": source_data.get("timestamp")
                }
        
        return {"value": 0, "error": "No data available"}
    
    def _transform_for_chart(
        self,
        data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform data for chart widget"""
        chart_type = config.get("chart_type", "line")
        x_axis = config.get("x_axis", "date")
        y_axis = config.get("y_axis", "value")
        
        # Extract chart data from sources
        chart_data = []
        for source_key, source_data in data.items():
            if source_data.get("status") == "success":
                source_value = source_data.get("data", {})
                
                # Transform to chart format
                if isinstance(source_value, list):
                    chart_data.extend(source_value)
                elif isinstance(source_value, dict):
                    chart_data.append(source_value)
        
        return {
            "type": chart_type,
            "data": chart_data,
            "x_axis": x_axis,
            "y_axis": y_axis,
            "config": config
        }
    
    def _transform_for_table(
        self,
        data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform data for table widget"""
        columns = config.get("columns", [])
        
        # Extract table data from sources
        table_data = []
        for source_key, source_data in data.items():
            if source_data.get("status") == "success":
                source_value = source_data.get("data", {})
                
                if isinstance(source_value, list):
                    table_data.extend(source_value)
                elif isinstance(source_value, dict):
                    table_data.append(source_value)
        
        return {
            "columns": columns,
            "data": table_data,
            "sortable": config.get("sortable", True),
            "filterable": config.get("filterable", True),
            "pagination": config.get("pagination", {})
        }
    
    def _transform_for_list(
        self,
        data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform data for list widget"""
        item_template = config.get("item_template", {})
        
        # Extract list data from sources
        list_data = []
        for source_key, source_data in data.items():
            if source_data.get("status") == "success":
                source_value = source_data.get("data", {})
                
                if isinstance(source_value, list):
                    list_data.extend(source_value)
                elif isinstance(source_value, dict):
                    list_data.append(source_value)
        
        return {
            "items": list_data,
            "template": item_template,
            "limit": config.get("limit", 10)
        }
    
    def _transform_for_agent_insight(
        self,
        data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform data for agent insight widget"""
        # Extract agent insights
        insights = []
        for source_key, source_data in data.items():
            if source_data.get("status") == "success" and source_data.get("source_type") == "agent":
                insight_data = source_data.get("data", {})
                insights.append({
                    "agent_id": source_key,
                    "insight": insight_data.get("insight") or insight_data.get("result"),
                    "confidence": insight_data.get("confidence"),
                    "timestamp": source_data.get("timestamp")
                })
        
        return {
            "insights": insights,
            "format": config.get("format", "summary")
        }
    
    def _transform_for_rag_context(
        self,
        data: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform data for RAG context widget"""
        # Extract RAG results
        contexts = []
        for source_key, source_data in data.items():
            if source_data.get("status") == "success" and source_data.get("source_type") == "rag":
                rag_data = source_data.get("data", [])
                if isinstance(rag_data, list):
                    contexts.extend(rag_data)
        
        return {
            "contexts": contexts,
            "max_results": config.get("max_results", 5),
            "show_citations": config.get("show_citations", True)
        }
    
    def _extract_nested_value(self, data: Any, path: str) -> Any:
        """Extract nested value from data using dot notation"""
        keys = path.split(".")
        value = data
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            elif isinstance(value, list) and key.isdigit():
                value = value[int(key)] if int(key) < len(value) else None
            else:
                return None
            
            if value is None:
                return None
        
        return value
    
    def _get_cached_data(
        self,
        widget_id: UUID,
        tenant_id: UUID,
        context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Get cached widget data"""
        # Generate cache key
        import hashlib
        import json
        
        cache_key_data = {
            "widget_id": str(widget_id),
            "tenant_id": str(tenant_id),
            "context": context or {}
        }
        cache_key = f"widget:{hashlib.md5(json.dumps(cache_key_data, sort_keys=True).encode()).hexdigest()}"
        
        # Check database cache
        cached = self.db.query(WidgetDataCache).filter(
            WidgetDataCache.widget_id == widget_id,
            WidgetDataCache.tenant_id == tenant_id,
            WidgetDataCache.cache_key == cache_key,
            WidgetDataCache.expires_at > datetime.utcnow()
        ).first()
        
        if cached:
            return cached.data
        
        return None
    
    def _cache_widget_data(
        self,
        widget_id: UUID,
        tenant_id: UUID,
        context: Optional[Dict[str, Any]],
        data: Dict[str, Any]
    ):
        """Cache widget data"""
        import hashlib
        import json
        
        cache_key_data = {
            "widget_id": str(widget_id),
            "tenant_id": str(tenant_id),
            "context": context or {}
        }
        cache_key = f"widget:{hashlib.md5(json.dumps(cache_key_data, sort_keys=True).encode()).hexdigest()}"
        
        # Get widget to determine cache TTL
        widget = self.db.query(Widget).filter(Widget.id == widget_id).first()
        refresh_interval = widget.refresh_interval if widget else 300  # Default 5 minutes
        
        expires_at = datetime.utcnow() + timedelta(seconds=refresh_interval)
        
        # Delete old cache
        self.db.query(WidgetDataCache).filter(
            WidgetDataCache.widget_id == widget_id,
            WidgetDataCache.cache_key == cache_key
        ).delete()
        
        # Create new cache entry
        cache_entry = WidgetDataCache(
            id=uuid.uuid4(),
            widget_id=widget_id,
            tenant_id=tenant_id,
            data=data,
            cache_key=cache_key,
            expires_at=expires_at
        )
        
        self.db.add(cache_entry)
        self.db.commit()
