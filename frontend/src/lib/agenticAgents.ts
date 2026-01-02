import api from './api'

export interface AgenticAgent {
  id: string
  name: string
  agent_type: string
  description?: string
  status: string
  skills: string[]
  capabilities?: Record<string, any>
  total_interactions: number
  success_rate: number
  last_used_at?: string
}

export interface AgenticAgentCreate {
  name: string
  agent_type: string
  description?: string
  skills?: string[]
  capabilities?: Record<string, any>
  configuration?: Record<string, any>
  rag_enabled?: boolean
  llm_provider?: string
  llm_model?: string
  mcp_enabled?: boolean
}

export interface SkillExecutionRequest {
  skill: string
  input_data: Record<string, any>
  context?: Record<string, any>
}

export const agenticAgentsApi = {
  // Create agentic agent
  create: async (agentData: AgenticAgentCreate): Promise<AgenticAgent> => {
    const response = await api.post('/agentic-agents', agentData)
    return response.data
  },

  // List agentic agents
  list: async (params?: {
    agent_type?: string
    status?: string
    skill?: string
  }): Promise<AgenticAgent[]> => {
    const response = await api.get('/agentic-agents', { params })
    return response.data
  },

  // Get agentic agent by ID
  get: async (agentId: string): Promise<AgenticAgent> => {
    const response = await api.get(`/agentic-agents/${agentId}`)
    return response.data
  },

  // Execute a skill
  executeSkill: async (
    agentId: string,
    request: SkillExecutionRequest
  ) => {
    const response = await api.post(
      `/agentic-agents/${agentId}/execute-skill`,
      request
    )
    return response.data
  },

  // Create a session
  createSession: async (
    agentId: string,
    contextId: string,
    contextType: string
  ) => {
    const response = await api.post(`/agentic-agents/${agentId}/sessions`, {
      context_id: contextId,
      context_type: contextType
    })
    return response.data
  }
}
