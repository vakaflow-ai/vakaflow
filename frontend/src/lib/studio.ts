import api from './api'

export interface StudioAgent {
  id: string
  name: string
  agent_type: string
  description?: string
  source: 'vaka' | 'external' | 'marketplace'
  source_agent_id?: string
  mcp_connection_id?: string
  mcp_connection_name?: string
  platform_name?: string
  skills: string[]
  capabilities?: Record<string, any>
  category?: string
  is_available: boolean
  is_featured: boolean
  usage_count: number
  last_used_at?: string
  // Master data attributes
  owner_id?: string
  owner_name?: string
  department?: string
  organization?: string
  master_data_attributes?: Record<string, any>  // Custom master data mappings
}

export interface AgenticFlow {
  id: string
  name: string
  description?: string
  category?: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
  is_template: boolean
  tags?: string[]
  flow_definition: {
    nodes: Array<{
      id: string
      name?: string  // Friendly name for the node
      type: string
      agent_id?: string
      skill?: string
      input?: Record<string, any>
      position?: { x: number; y: number }
      customAttributes?: Record<string, any>  // Custom user-defined attributes
      agenticConfig?: Record<string, any>  // Agentic configuration (email, push, collect)
      mcp_connection_id?: string
    }>
    edges: Array<{
      from: string
      to: string
      condition?: any
    }>
  }
  context_id_template?: string
  context_type_default?: string
  created_at: string
  updated_at: string
}

export interface AgenticFlowCreate {
  name: string
  description?: string
  category?: string
  flow_definition: AgenticFlow['flow_definition']
  tags?: string[]
  is_template?: boolean
  max_concurrent_executions?: number
  timeout_seconds?: number
  retry_on_failure?: boolean
  retry_count?: number
}

export interface FlowExecutionRequest {
  context_id?: string
  context_type?: string
  trigger_data?: Record<string, any>
}

export const studioApi = {
  // Get all agents in Studio
  getAgents: async (params?: {
    agent_type?: string
    skill?: string
    source?: string
    category?: string
  }): Promise<StudioAgent[]> => {
    const response = await api.get('/studio/agents', { params })
    return response.data
  },

  // Get a single agent
  getAgent: async (agentId: string): Promise<StudioAgent> => {
    const response = await api.get(`/studio/agents/${agentId}`)
    return response.data
  },

  // Update agent settings
  updateAgent: async (agentId: string, updates: {
    name?: string
    description?: string
    category?: string
    tags?: string[]
    icon_url?: string
    is_available?: boolean
    is_featured?: boolean
    capabilities?: Record<string, any>
    owner_id?: string | null
    department?: string | null
    organization?: string | null
    master_data_attributes?: Record<string, any> | null
  }): Promise<StudioAgent> => {
    console.log('API: Sending PATCH request to /studio/agents/' + agentId, updates)
    try {
      const response = await api.patch(`/studio/agents/${agentId}`, updates)
      console.log('API: Response received:', response.data)
      return response.data
    } catch (error: any) {
      console.error('API: Error updating agent:', error)
      console.error('API: Error response:', error.response?.data)
      throw error
    }
  },

  // Execute an agent skill
  executeAgent: async (
    agentId: string,
    source: string,
    skill: string,
    inputData: Record<string, any>,
    mcpConnectionId?: string
  ) => {
    const response = await api.post(
      `/studio/agents/${agentId}/execute`,
      {
        source,
        skill,
        input_data: inputData,
        mcp_connection_id: mcpConnectionId
      },
      { timeout: 120000 } // 120 seconds for agent execution (RAG/LLM can be slow)
    )
    return response.data
  },

  // Create a flow
  createFlow: async (flowData: AgenticFlowCreate): Promise<AgenticFlow> => {
    const response = await api.post('/studio/flows', flowData)
    return response.data
  },

  // List flows
  listFlows: async (params?: {
    category?: string
    status?: string
    is_template?: boolean
  }): Promise<AgenticFlow[]> => {
    const response = await api.get('/studio/flows', { params })
    return response.data
  },

  // Get flow by ID
  getFlow: async (flowId: string): Promise<AgenticFlow> => {
    const response = await api.get(`/studio/flows/${flowId}`)
    return response.data
  },

  // Execute a flow
  executeFlow: async (
    flowId: string,
    executionRequest: FlowExecutionRequest
  ) => {
    const response = await api.post(
      `/studio/flows/${flowId}/execute`,
      executionRequest
    )
    return response.data
  },

  // Update a flow
  updateFlow: async (flowId: string, updates: {
    name?: string
    description?: string
    category?: string
    status?: string
    tags?: string[]
    is_template?: boolean
    max_concurrent_executions?: number
    timeout_seconds?: number
    retry_on_failure?: boolean
    retry_count?: number
  }): Promise<AgenticFlow> => {
    const response = await api.patch(`/studio/flows/${flowId}`, updates)
    return response.data
  },

  // Delete a flow
  deleteFlow: async (flowId: string): Promise<void> => {
    await api.delete(`/studio/flows/${flowId}`)
  },

  // Activate a flow
  activateFlow: async (flowId: string) => {
    const response = await api.patch(`/studio/flows/${flowId}/activate`)
    return response.data
  },

  // Get flow executions
  getFlowExecutions: async (
    flowId: string,
    limit: number = 20,
    status?: string,
    startDate?: string,
    endDate?: string
  ) => {
    const response = await api.get(`/studio/flows/${flowId}/executions`, {
      params: { limit, status, start_date: startDate, end_date: endDate }
    })
    return response.data
  },

  // Get execution details
  getExecution: async (executionId: string) => {
    const response = await api.get(`/studio/executions/${executionId}`)
    return response.data
  },

  // Retry a failed execution
  retryExecution: async (executionId: string) => {
    const response = await api.post(`/studio/executions/${executionId}/retry`)
    return response.data
  }
}
