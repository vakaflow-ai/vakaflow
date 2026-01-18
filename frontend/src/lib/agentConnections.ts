import api from './api'

export interface AgentConnection {
  id: string
  agent_id: string
  name: string
  app_name: string
  app_type: string
  connection_type: 'cloud' | 'on_premise' | 'hybrid' | 'edge'
  protocol?: string
  endpoint_url?: string
  authentication_method?: string
  description?: string
  metadata?: Record<string, any>
  is_active: boolean
  is_required: boolean
  is_encrypted: boolean
  data_classification?: string
  compliance_requirements?: string[]
  data_types_exchanged?: string[]
  data_flow_direction?: 'inbound' | 'outbound' | 'bidirectional'
  data_format?: string
  data_volume?: string
  exchange_frequency?: string
  source_system?: string
  destination_system?: string
  data_schema?: string
  created_at: string
  updated_at: string
}

export interface ConnectionCreate {
  name: string
  app_name: string
  app_type: string
  connection_type: 'cloud' | 'on_premise' | 'hybrid' | 'edge'
  protocol?: string
  endpoint_url?: string
  authentication_method?: string
  description?: string
  metadata?: Record<string, any>
  is_active?: boolean
  is_required?: boolean
  is_encrypted?: boolean
  data_classification?: string
  compliance_requirements?: string[]
  data_types_exchanged?: string[]
  data_flow_direction?: 'inbound' | 'outbound' | 'bidirectional'
  data_format?: string
  data_volume?: string
  exchange_frequency?: string
  source_system?: string
  destination_system?: string
  data_schema?: string
}

export interface ConnectionUpdate {
  name?: string
  app_name?: string
  app_type?: string
  connection_type?: 'cloud' | 'on_premise' | 'hybrid' | 'edge'
  protocol?: string
  endpoint_url?: string
  authentication_method?: string
  description?: string
  metadata?: Record<string, any>
  is_active?: boolean
  is_required?: boolean
  is_encrypted?: boolean
  data_classification?: string
  compliance_requirements?: string[]
  data_types_exchanged?: string[]
  data_flow_direction?: 'inbound' | 'outbound' | 'bidirectional'
  data_format?: string
  data_volume?: string
  exchange_frequency?: string
  source_system?: string
  destination_system?: string
  data_schema?: string
}

export const agentConnectionsApi = {
  list: async (agentId: string, connectionType?: string, isActive?: boolean): Promise<AgentConnection[]> => {
    const params: any = {}
    if (connectionType) params.connection_type = connectionType
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get(`/agent-connections/agents/${agentId}/connections`, { params })
    return response.data
  },

  get: async (connectionId: string): Promise<AgentConnection> => {
    const response = await api.get(`/agent-connections/connections/${connectionId}`)
    return response.data
  },

  create: async (agentId: string, data: ConnectionCreate): Promise<AgentConnection> => {
    const response = await api.post(`/agent-connections/agents/${agentId}/connections`, data)
    return response.data
  },

  update: async (connectionId: string, data: ConnectionUpdate): Promise<AgentConnection> => {
    const response = await api.put(`/agent-connections/connections/${connectionId}`, data)
    return response.data
  },

  delete: async (connectionId: string): Promise<void> => {
    await api.delete(`/agent-connections/connections/${connectionId}`)
  },

  generateDiagram: async (agentName: string, connections: ConnectionCreate[]): Promise<{
    mermaid_diagram: string
    text_description: string
    format: string
  }> => {
    // Diagram generation should be fast (simple string processing), use shorter timeout
    const response = await api.post('/agent-connections/generate-diagram', {
      agent_name: agentName,
      connections
    }, {
      timeout: 10000 // 10 seconds should be more than enough for diagram generation
    })
    return response.data
  },

  getFrameworkRecommendations: async (
    connections: ConnectionCreate[],
    agentCategory?: string,
    agentSubcategory?: string
  ): Promise<{
    frameworks: Array<{ code: string; name: string; description: string }>
    reasoning: Record<string, string[]>
  }> => {
    const response = await api.post('/agent-connections/framework-recommendations', {
      connections,
      agent_category: agentCategory,
      agent_subcategory: agentSubcategory
    })
    return response.data
  },
}

