import api from './api'

export interface Agent {
  id: string
  vendor_id: string
  name: string
  type: string
  category?: string
  subcategory?: string
  description?: string
  version: string
  status: string
  compliance_score?: number
  risk_score?: number
  submission_date?: string
  created_at: string
  skills?: string[]
  features?: string[]
  capabilities?: string[]
  data_types?: string[]
  regions?: string[]
  integrations?: any[]
  personas?: Array<{ name: string; description: string }>
  version_info?: {
    release_notes?: string
    changelog?: string
    compatibility?: string
    known_issues?: string
    architecture_info?: {
      connection_diagram?: string
    }
  }
  architecture_info?: {
    connection_diagram?: string
    diagram_updated_by?: string
    diagram_updated_at?: string
  }
  // AI/LLM information
  llm_vendor?: string
  llm_model?: string
  deployment_type?: string
  data_sharing_scope?: {
    shares_pii?: boolean
    shares_phi?: boolean
    shares_financial_data?: boolean
    shares_biometric_data?: boolean
    data_retention_period?: string
    data_processing_location?: string
  }
  data_usage_purpose?: string
  vendor_name?: string
  vendor_logo_url?: string
  // Workflow tracking
  onboarding_request_id?: string
  workflow_status?: string
  workflow_current_step?: number
}

export interface AgentCreate {
  name: string
  type: string
  category?: string
  subcategory?: string
  description?: string
  version: string
  // AI/LLM information
  llm_vendor?: string
  llm_model?: string
  deployment_type?: string
  data_sharing_scope?: {
    shares_pii?: boolean
    shares_phi?: boolean
    shares_financial_data?: boolean
    shares_biometric_data?: boolean
    data_retention_period?: string
    data_processing_location?: string
  }
  data_usage_purpose?: string
  capabilities?: string[]
  data_types?: string[]
  regions?: string[]
  integrations?: any[]
  skills?: string[]
  features?: string[]
  personas?: Array<{ name: string; description: string }>
  version_info?: {
    release_notes?: string
    changelog?: string
    compatibility?: string
    known_issues?: string
  }
  connection_diagram?: string
}

export interface AgentListResponse {
  agents: Agent[]
  total: number
  page: number
  limit: number
}

export const agentsApi = {
  list: async (page: number = 1, limit: number = 20, statusFilter?: string): Promise<AgentListResponse> => {
    const params: any = { page, limit }
    if (statusFilter) params.status_filter = statusFilter
    
    const response = await api.get('/agents', { params })
    return response.data
  },
  
  get: async (id: string): Promise<Agent> => {
    const response = await api.get(`/agents/${id}`)
    return response.data
  },
  
  create: async (data: AgentCreate): Promise<Agent> => {
    // Increase timeout for agent creation as it may involve complex processing
    // Backend does multiple DB operations: vendor creation, agent creation, metadata creation, audit logging
    // Using 180 seconds (3 minutes) to handle slow database operations
    const response = await api.post('/agents', data, { timeout: 180000 }) // 180 seconds
    return response.data
  },
  
  update: async (id: string, data: Partial<AgentCreate>): Promise<Agent> => {
    // Increase timeout for agent updates as they may involve complex processing
    const response = await api.patch(`/agents/${id}`, data, { timeout: 120000 }) // 120 seconds
    return response.data
  },

  updateConnectionDiagram: async (id: string, connectionDiagram: string): Promise<{ message: string; connection_diagram: string }> => {
    const response = await api.patch(`/agents/${id}/connection-diagram`, {
      connection_diagram: connectionDiagram
    })
    return response.data
  },
  
  submit: async (id: string): Promise<Agent> => {
    const response = await api.post(`/agents/${id}/submit`)
    return response.data
  },
  
  uploadArtifact: async (agentId: string, file: File, artifactType: string = 'DOCUMENTATION'): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post(`/agents/${agentId}/artifacts`, formData, {
      params: { artifact_type: artifactType },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}

