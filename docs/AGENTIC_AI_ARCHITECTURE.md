# Agentic AI & RAG-Powered Architecture

## Overview

The VAKA platform has been transformed into a full Agentic AI & RAG-powered system with MCP (Model Context Protocol) architecture. This enables intelligent, autonomous agents that can communicate with each other and external platforms, learn from interactions, and provide real-time GRC for AI.

## Architecture Components

### 1. Agent Framework

**Base Agent Class** (`app/services/agentic/base_agent.py`)
- Abstract base class for all agentic AI agents
- Handles session management, interaction logging, RAG queries, LLM calls
- Supports agent-to-agent communication
- Manages skill execution and context

**Agent Registry** (`app/services/agentic/agent_registry.py`)
- Central registry for managing all agentic agents
- Provides agent lookup by type, skill, or ID
- Handles agent instantiation and caching

### 2. Specialized Agents

#### AiGrcAgent (`app/services/agentic/ai_grc_agent.py`)
- **Purpose**: AI Governance, Risk, and Compliance operations
- **Skills**:
  - `realtime_risk_analysis`: Real-time risk analysis for AI agents
  - `tprm`: Third Party Risk Management
  - `ai_agent_onboarding`: AI agent onboarding workflow

#### AssessmentAgent (`app/services/agentic/assessment_agent.py`)
- **Purpose**: Assessment workflows
- **Skills**:
  - `assessment`: General assessment
  - `vendor_qualification`: Vendor qualification assessment
  - `marketplace_reviews`: Marketplace review assessment

#### VendorAgent (`app/services/agentic/vendor_agent.py`)
- **Purpose**: Vendor management operations
- **Skills**:
  - `vendor_qualification`: Vendor qualification process
  - `onboarding`: Vendor onboarding
  - `offboarding`: Vendor offboarding

#### ComplianceReviewerAgent (`app/services/agentic/compliance_reviewer_agent.py`)
- **Purpose**: Compliance review workflows
- **Skills**:
  - `compliance_review`: General compliance review
  - `onboarding`: Compliance review for onboarding
  - `offboarding`: Compliance review for offboarding

### 3. Agent Skills

All agents support the following skills:

- **TPRM** (Third Party Risk Management)
- **Vendor Qualification**
- **Onboarding**
- **Offboarding**
- **AI Agent Onboarding**
- **Marketplace Reviews**
- **Realtime Risk Analysis**

### 4. MCP (Model Context Protocol) Architecture

**MCP Server** (`app/services/agentic/mcp_server.py`)
- Handles requests from external platforms
- Routes requests to appropriate agents
- Manages MCP connections
- Supports skill execution, agent queries, and agent listing

**MCP Client** (`app/services/agentic/mcp_server.py`)
- Client for making requests to external platforms
- Enables bidirectional communication

**MCP Connections** (`app/models/agentic_agent.py`)
- Stores connection details for external platforms
- Tracks usage and capabilities
- Supports authentication and configuration

### 5. Learning System

**Agent Learning System** (`app/services/agentic/learning_system.py`)
- Learns from compliance checks
- Learns from questionnaire responses
- Learns from agent interactions
- Applies learned patterns to new contexts
- Updates RAG knowledge base with learned patterns

**Learning Types**:
- `compliance_pattern`: Patterns from compliance checks
- `questionnaire_pattern`: Patterns from questionnaires
- `workflow_pattern`: Patterns from successful interactions

### 6. Database Models

**AgenticAgent** (`app/models/agentic_agent.py`)
- Core agent model with configuration, skills, capabilities
- Tracks performance metrics and learning status

**AgenticAgentSession**
- Manages agent sessions with context tracking
- Supports multi-step workflows

**AgenticAgentInteraction**
- Logs all agent interactions
- Tracks RAG usage, skill execution, agent-to-agent calls
- Stores feedback for learning

**AgenticAgentLearning**
- Stores learned patterns
- Tracks confidence scores and usage
- Supports pattern validation

**MCPConnection**
- Stores external platform connections
- Tracks usage and capabilities

### 7. API Endpoints

**Agent Management** (`/api/v1/agentic-agents`)
- `POST /agentic-agents`: Create new agent
- `GET /agentic-agents`: List agents (filter by type/skill)
- `GET /agentic-agents/{id}`: Get agent details
- `POST /agentic-agents/{id}/execute-skill`: Execute skill
- `POST /agentic-agents/{id}/sessions`: Create session
- `POST /agentic-agents/{id}/learn`: Trigger learning

**MCP Endpoints**
- `POST /agentic-agents/mcp/connections`: Create MCP connection
- `POST /agentic-agents/mcp/{connection_id}/request`: Handle MCP request

## Usage Examples

### 1. Create an AI GRC Agent

```python
POST /api/v1/agentic-agents
{
  "name": "AI GRC Agent",
  "agent_type": "ai_grc",
  "description": "AI Governance, Risk, and Compliance agent",
  "skills": ["realtime_risk_analysis", "tprm", "ai_agent_onboarding"],
  "rag_enabled": true,
  "llm_provider": "openai",
  "llm_model": "gpt-4"
}
```

### 2. Execute a Skill

```python
POST /api/v1/agentic-agents/{agent_id}/execute-skill
{
  "skill": "realtime_risk_analysis",
  "input_data": {
    "agent_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "context": {}
}
```

### 3. Create MCP Connection

```python
POST /api/v1/agentic-agents/mcp/connections
{
  "connection_name": "External Platform",
  "platform_name": "ExternalGRC",
  "mcp_server_url": "https://external-platform.com/mcp",
  "api_key": "your-api-key",
  "supported_skills": ["realtime_risk_analysis", "tprm"],
  "supported_agents": ["ai_grc"]
}
```

### 4. External Platform Request (via MCP)

```python
POST /api/v1/agentic-agents/mcp/{connection_id}/request
{
  "request_type": "skill_execution",
  "payload": {
    "agent_type": "ai_grc",
    "skill": "realtime_risk_analysis",
    "input_data": {
      "agent_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  }
}
```

## Integration with Existing Platform

The agentic AI system integrates seamlessly with existing VAKA platform features:

- **RAG Service**: Agents use existing RAG infrastructure for knowledge retrieval
- **Compliance Service**: Agents leverage compliance checking capabilities
- **Workflow System**: Agents can interact with onboarding/offboarding workflows
- **Assessment System**: Agents use assessment capabilities
- **Marketplace**: Agents can analyze marketplace reviews

## Learning and Improvement

The platform learns from:

1. **Compliance Checks**: Patterns from compliance assessments
2. **Questionnaires**: Patterns from questionnaire responses
3. **Interactions**: Successful interaction patterns
4. **Feedback**: User feedback on agent performance

Learned patterns are:
- Stored in the database
- Applied to new contexts
- Updated in RAG knowledge base
- Validated by administrators

## Real-time GRC for AI

The AI GRC agent provides:

- **Real-time Risk Analysis**: Continuous monitoring and assessment
- **Compliance Tracking**: Automated compliance checking
- **Risk Scoring**: Dynamic risk score calculation
- **Recommendations**: AI-powered recommendations for risk mitigation

## Next Steps

1. **Run Migration**: Execute the database migration to create agentic agent tables
2. **Configure LLM**: Set up LLM provider (OpenAI, Anthropic, etc.)
3. **Create Default Agents**: Create initial agentic agents for your tenant
4. **Set Up MCP Connections**: Configure connections to external platforms
5. **Enable Learning**: Activate learning system for continuous improvement

## Migration

Run the migration to create the agentic agent tables:

```bash
cd backend
alembic upgrade head
```

This will create:
- `agentic_agents` table
- `agentic_agent_sessions` table
- `agentic_agent_interactions` table
- `agentic_agent_learning` table
- `mcp_connections` table

## Configuration

Configure agents in the database or via API:

- **LLM Provider**: Set `llm_provider` and `llm_model`
- **RAG**: Enable/disable RAG with `rag_enabled`
- **MCP**: Configure MCP with `mcp_enabled`, `mcp_server_url`, `mcp_api_key`
- **Skills**: Assign skills to agents via `skills` array

## Security

- All agents are tenant-isolated
- MCP connections require authentication
- Agent interactions are logged and audited
- Learning patterns can be validated before use

## Performance

- Agent registry caches agent instances
- RAG queries are optimized with similarity search
- Learning patterns are indexed for fast retrieval
- MCP requests are rate-limited and monitored
