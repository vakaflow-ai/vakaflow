# Presentation Layer Implementation Guide

## Overview

The presentation layer provides a **widget-based dashboard system** that aggregates data from Agents, RAG, and MCP to present business information in configurable pages.

## Architecture

### 1. Data Aggregation Service

**Purpose**: Collects data from multiple sources in parallel

**Sources Supported**:
- **Agents**: Execute agent skills
- **RAG**: Query knowledge base
- **MCP**: Fetch from external platforms
- **Database**: Direct database queries
- **Analytics**: Pre-computed analytics

**Features**:
- Parallel data collection
- Caching (Redis + Database)
- Error handling per source
- Context-aware queries

### 2. Widget System

**Purpose**: Reusable UI components for different data types

**Widget Types**:
- **Metric**: Single number/metric
- **Chart**: Line, bar, pie charts
- **Table**: Data tables
- **List**: Item lists
- **Card**: Information cards
- **Agent Insight**: Agent-generated insights
- **RAG Context**: RAG search results
- **Custom**: Custom widgets

**Features**:
- Data transformation per widget type
- Auto-refresh support
- Configurable display options

### 3. Page System

**Purpose**: Business pages with multiple widgets

**Features**:
- Grid-based layout
- Widget positioning
- Access control (public/role-based/user-based)
- Page templates

## Data Flow

```
User Request
    ↓
Page Service
    ↓
Widget Service (for each widget)
    ↓
Data Aggregator
    ↓
┌───────┬───────┬───────┬──────────┐
│ Agent │  RAG  │  MCP  │ Database │
└───────┴───────┴───────┴──────────┘
    ↓
Data Transformer
    ↓
Cache Layer
    ↓
Widget Data
    ↓
Page Response
```

## Usage Examples

### 1. Create a Widget

```python
POST /api/v1/presentation/widgets
{
  "name": "Risk Score Widget",
  "widget_type": "metric",
  "widget_config": {
    "format": "number",
    "unit": "",
    "decimals": 0,
    "label": "Current Risk Score"
  },
  "data_sources": [
    {
      "type": "agent",
      "source_id": "ai_grc_agent_id",
      "query": "realtime_risk_analysis",
      "params": {
        "agent_id": "${context.agent_id}"
      },
      "key": "risk_analysis"
    }
  ],
  "refresh_interval": 60
}
```

### 2. Create a Page

```python
POST /api/v1/presentation/pages
{
  "name": "Agent Compliance Dashboard",
  "page_type": "dashboard",
  "category": "compliance",
  "layout_config": {
    "columns": 12,
    "widgets": [
      {
        "widget_id": "risk_score_widget_id",
        "position": {"x": 0, "y": 0, "w": 6, "h": 4}
      },
      {
        "widget_id": "compliance_chart_widget_id",
        "position": {"x": 6, "y": 0, "w": 6, "h": 4}
      }
    ]
  }
}
```

### 3. Get Page Data

```python
GET /api/v1/presentation/pages/{page_id}?context={"agent_id":"123"}
```

Returns all widget data for the page.

### 4. Aggregate Data Directly

```python
POST /api/v1/presentation/aggregate
{
  "data_sources": [
    {
      "type": "agent",
      "source_id": "ai_grc_agent_id",
      "query": "realtime_risk_analysis",
      "params": {"agent_id": "123"},
      "key": "risk"
    },
    {
      "type": "rag",
      "query": "compliance requirements for AI agents",
      "params": {"limit": 5},
      "key": "compliance"
    },
    {
      "type": "mcp",
      "source_id": "mcp_connection_id",
      "query": "skill_execution",
      "params": {
        "agent_type": "assessment",
        "skill": "assessment",
        "input_data": {...}
      },
      "key": "assessment"
    }
  ],
  "context": {
    "agent_id": "123",
    "tenant_id": "..."
  }
}
```

## Widget Configuration Examples

### Metric Widget

```json
{
  "widget_type": "metric",
  "widget_config": {
    "format": "number",
    "unit": "%",
    "decimals": 1,
    "label": "Compliance Score",
    "metric_path": "compliance_score"
  },
  "data_sources": [
    {
      "type": "agent",
      "source_id": "compliance_agent_id",
      "query": "compliance_review",
      "params": {"agent_id": "${context.agent_id}"},
      "key": "compliance"
    }
  ]
}
```

### Chart Widget

```json
{
  "widget_type": "chart",
  "widget_config": {
    "chart_type": "line",
    "x_axis": "date",
    "y_axis": "value",
    "title": "Risk Trend"
  },
  "data_sources": [
    {
      "type": "analytics",
      "query": "risk_trend",
      "params": {"days": 30},
      "key": "trend"
    }
  ]
}
```

### Agent Insight Widget

```json
{
  "widget_type": "agent_insight",
  "widget_config": {
    "format": "summary"
  },
  "data_sources": [
    {
      "type": "agent",
      "source_id": "ai_grc_agent_id",
      "query": "realtime_risk_analysis",
      "params": {"agent_id": "${context.agent_id}"},
      "key": "insight"
    }
  ]
}
```

### RAG Context Widget

```json
{
  "widget_type": "rag_context",
  "widget_config": {
    "max_results": 5,
    "show_citations": true
  },
  "data_sources": [
    {
      "type": "rag",
      "query": "compliance requirements ${context.agent_type}",
      "params": {"limit": 5},
      "key": "context"
    }
  ]
}
```

## Best Practices

### 1. Data Source Configuration

- **Use keys**: Always provide a `key` for each data source
- **Context variables**: Use `${context.variable}` for dynamic values
- **Error handling**: Sources fail gracefully, don't break entire page
- **Caching**: Set appropriate `refresh_interval` for widgets

### 2. Widget Design

- **Single responsibility**: Each widget should show one type of data
- **Reusability**: Create reusable widgets for common patterns
- **Performance**: Use caching and appropriate refresh intervals
- **Error states**: Handle errors gracefully

### 3. Page Layout

- **Grid system**: Use 12-column grid for responsive layout
- **Widget sizing**: Balance widget sizes for good UX
- **Loading states**: Show loading indicators while data loads
- **Access control**: Set appropriate permissions

### 4. Performance

- **Caching**: Leverage widget data cache
- **Parallel loading**: Data sources load in parallel
- **Lazy loading**: Load widgets as they come into view
- **Refresh intervals**: Set appropriate refresh rates

## Frontend Integration

### React Component Structure

```typescript
// Page Component
<BusinessPage pageId={pageId} context={context}>
  {widgets.map(widget => (
    <Widget
      key={widget.id}
      widget={widget}
      data={widget.data}
      position={widget.position}
    />
  ))}
</BusinessPage>

// Widget Components
<MetricWidget config={config} data={data} />
<ChartWidget config={config} data={data} />
<TableWidget config={config} data={data} />
<AgentInsightWidget config={config} data={data} />
<RAGContextWidget config={config} data={data} />
```

### Data Fetching

```typescript
// Using React Query
const { data: pageData } = useQuery({
  queryKey: ['page', pageId, context],
  queryFn: () => presentationApi.getPage(pageId, context),
  refetchInterval: 30000 // 30 seconds
})
```

## Migration

Run migration to create presentation tables:

```bash
cd backend
alembic upgrade head
```

This creates:
- `business_pages` table
- `widgets` table
- `page_widgets` table
- `widget_data_cache` table

## Summary

The presentation layer provides:

1. ✅ **Unified Data Collection**: From Agents, RAG, MCP, Database, Analytics
2. ✅ **Widget System**: Reusable components for different data types
3. ✅ **Page Builder**: Create custom business pages
4. ✅ **Caching**: Performance optimization
5. ✅ **Real-time Updates**: Auto-refresh support
6. ✅ **Access Control**: Role and user-based permissions
7. ✅ **Context-Aware**: Dynamic data based on context

This architecture allows screens to collect data from multiple sources and present business information in a flexible, customizable way.
