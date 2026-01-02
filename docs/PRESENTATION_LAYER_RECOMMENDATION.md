# Presentation Layer - Recommended Approach

## 🎯 Recommended Architecture: Widget-Based Dashboard System

### Why This Approach?

1. **Flexibility**: Users can customize their views
2. **Reusability**: Widgets can be reused across pages
3. **Performance**: Caching reduces load on data sources
4. **Scalability**: Easy to add new data sources and widget types
5. **Maintainability**: Clear separation of concerns
6. **User Experience**: Familiar dashboard pattern

## Architecture Components

### 1. Data Aggregation Layer

**Service**: `DataAggregator` (`app/services/presentation/data_aggregator.py`)

**Purpose**: Collects data from multiple sources in parallel

**Sources**:
- ✅ **Agents**: Execute agent skills (e.g., `realtime_risk_analysis`)
- ✅ **RAG**: Query knowledge base for contextual information
- ✅ **MCP**: Fetch data from external platforms
- ✅ **Database**: Direct database queries
- ✅ **Analytics**: Pre-computed analytics

**Features**:
- Parallel data collection (async/await)
- Caching (Redis + Database)
- Error handling per source
- Context-aware queries (e.g., `${context.agent_id}`)

### 2. Widget System

**Service**: `WidgetService` (`app/services/presentation/widget_service.py`)

**Purpose**: Manages reusable widgets with data transformation

**Widget Types**:
- **Metric**: Single number (e.g., risk score, compliance score)
- **Chart**: Line, bar, pie charts (e.g., risk trends)
- **Table**: Data tables (e.g., agent list)
- **List**: Item lists (e.g., recent activities)
- **Agent Insight**: Agent-generated insights
- **RAG Context**: RAG search results with citations
- **Card**: Information cards
- **Custom**: Custom widgets

**Features**:
- Data transformation per widget type
- Auto-refresh support
- Configurable display options
- Caching per widget

### 3. Page System

**Service**: `PageService` (`app/services/presentation/page_service.py`)

**Purpose**: Manages business pages with multiple widgets

**Features**:
- Grid-based layout (12-column grid)
- Widget positioning and sizing
- Access control (public/role-based/user-based)
- Page templates

## Data Flow Example

### Example: Agent Compliance Dashboard

```
User requests page
    ↓
Page Service loads page definition
    ↓
For each widget on page:
    ↓
Widget Service gets widget data
    ↓
Data Aggregator collects from sources:
    ├─ Agent: realtime_risk_analysis
    ├─ RAG: compliance requirements
    └─ MCP: external compliance data
    ↓
Data transformed for widget type
    ↓
Cached for performance
    ↓
Returned to frontend
```

## Implementation Status

### ✅ Completed

1. **Data Aggregation Service**
   - Collects from Agents, RAG, MCP
   - Parallel execution
   - Caching support

2. **Widget System**
   - Widget models and service
   - Data transformation
   - Multiple widget types

3. **Page System**
   - Page models and service
   - Layout configuration
   - Access control

4. **API Endpoints**
   - `/api/v1/presentation/pages` - Page management
   - `/api/v1/presentation/widgets` - Widget management
   - `/api/v1/presentation/aggregate` - Direct data aggregation

5. **Database Models**
   - `BusinessPage` - Page definitions
   - `Widget` - Widget definitions
   - `PageWidget` - Widget instances on pages
   - `WidgetDataCache` - Caching layer

### 📋 Next Steps (Frontend)

1. **Page Builder UI**
   - Drag-and-drop interface
   - Widget selection and placement
   - Layout configuration

2. **Widget Components**
   - React components for each widget type
   - Data binding
   - Auto-refresh

3. **Page Renderer**
   - Grid layout system
   - Widget rendering
   - Loading states

## Usage Examples

### Create a Widget with Agent Data

```python
POST /api/v1/presentation/widgets
{
  "name": "Risk Score",
  "widget_type": "metric",
  "widget_config": {
    "format": "number",
    "unit": "",
    "decimals": 0,
    "label": "Current Risk Score",
    "metric_path": "risk_score"
  },
  "data_sources": [
    {
      "type": "agent",
      "source_id": "ai_grc_agent_id",
      "query": "realtime_risk_analysis",
      "params": {
        "agent_id": "${context.agent_id}"
      },
      "key": "risk"
    }
  ]
}
```

### Create a Widget with RAG Data

```python
POST /api/v1/presentation/widgets
{
  "name": "Compliance Context",
  "widget_type": "rag_context",
  "widget_config": {
    "max_results": 5,
    "show_citations": true
  },
  "data_sources": [
    {
      "type": "rag",
      "query": "compliance requirements for ${context.agent_type}",
      "params": {"limit": 5},
      "key": "compliance"
    }
  ]
}
```

### Create a Widget with MCP Data

```python
POST /api/v1/presentation/widgets
{
  "name": "External Assessment",
  "widget_type": "table",
  "widget_config": {
    "columns": ["assessment_id", "status", "score"],
    "sortable": true
  },
  "data_sources": [
    {
      "type": "mcp",
      "source_id": "mcp_connection_id",
      "query": "skill_execution",
      "params": {
        "agent_type": "assessment",
        "skill": "assessment",
        "input_data": {"agent_id": "${context.agent_id}"}
      },
      "key": "assessment"
    }
  ]
}
```

### Create a Page

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
      },
      {
        "widget_id": "rag_context_widget_id",
        "position": {"x": 0, "y": 4, "w": 12, "h": 6}
      }
    ]
  }
}
```

### Get Page Data

```python
GET /api/v1/presentation/pages/{page_id}?context={"agent_id":"123","agent_type":"ai_agent"}
```

Returns:
```json
{
  "page_id": "...",
  "page_name": "Agent Compliance Dashboard",
  "layout": {...},
  "widgets": {
    "widget1": {
      "widget_id": "...",
      "widget_type": "metric",
      "position": {"x": 0, "y": 0, "w": 6, "h": 4},
      "data": {
        "value": 85,
        "format": "number",
        "label": "Current Risk Score"
      }
    },
    "widget2": {
      "widget_id": "...",
      "widget_type": "rag_context",
      "data": {
        "contexts": [...],
        "citations": [...]
      }
    }
  }
}
```

## Frontend Implementation Strategy

### 1. Component Structure

```
src/
├── pages/
│   └── BusinessPage.tsx          # Page renderer
├── components/
│   ├── widgets/
│   │   ├── MetricWidget.tsx
│   │   ├── ChartWidget.tsx
│   │   ├── TableWidget.tsx
│   │   ├── AgentInsightWidget.tsx
│   │   └── RAGContextWidget.tsx
│   └── PageBuilder.tsx           # Page builder UI
└── lib/
    └── presentation.ts           # API client
```

### 2. Data Fetching Pattern

```typescript
// Using React Query
const { data: pageData, isLoading } = useQuery({
  queryKey: ['page', pageId, context],
  queryFn: () => presentationApi.getPage(pageId, context),
  refetchInterval: pageData?.widgets?.[0]?.refresh_interval || 30000
})
```

### 3. Widget Rendering

```typescript
function WidgetRenderer({ widget }) {
  switch (widget.widget_type) {
    case 'metric':
      return <MetricWidget data={widget.data} config={widget.config} />
    case 'chart':
      return <ChartWidget data={widget.data} config={widget.config} />
    case 'rag_context':
      return <RAGContextWidget data={widget.data} config={widget.config} />
    // ... other types
  }
}
```

## Benefits of This Approach

1. **Unified Data Collection**: Single API to collect from all sources
2. **Flexible Presentation**: Different widget types for different data
3. **Performance**: Caching reduces load
4. **User Customization**: Users can create custom pages
5. **Reusability**: Widgets can be reused across pages
6. **Scalability**: Easy to add new sources and widget types
7. **Maintainability**: Clear separation of concerns

## Migration

Run migration to create presentation tables:

```bash
cd backend
alembic upgrade head
```

## Summary

**Recommended Approach**: **Widget-Based Dashboard System**

This approach provides:
- ✅ Flexible data collection from Agents, RAG, MCP
- ✅ Reusable widget components
- ✅ Customizable business pages
- ✅ Performance optimization through caching
- ✅ Scalable architecture
- ✅ User-friendly interface

The backend is ready. Next step: Build the frontend page builder and widget components.
