import api from './api'

export interface SubmissionRequirement {
  id: string
  catalog_id?: string // Human-readable catalog ID: REQ-COM-01, REQ-SEC-02, etc.
  tenant_id: string
  label: string
  field_name: string
  field_type: string
  requirement_type: 'compliance' | 'risk' | 'questionnaires' // MANDATORY
  description?: string
  placeholder?: string
  is_required: boolean
  min_length?: number
  max_length?: number
  min_value?: number
  max_value?: number
  pattern?: string
  options?: Array<{ value: string; label: string }>
  category?: string
  section?: string
  questionnaire_type?: string
  order: number
  is_active: boolean
  source_type?: string
  source_id?: string
  source_name?: string
  is_auto_generated?: boolean
  is_enabled?: boolean
  allowed_response_types?: string[] // ['text', 'file', 'url'] - questionnaire-style multiple response types
  filter_conditions?: Record<string, any> // Filter based on agent category/type/metadata
  created_at: string
  updated_at: string
}

export interface RequirementResponse {
  id: string
  requirement_id: string
  requirement_label: string
  field_name?: string // Field name computed from requirement (for mapping to form fields)
  value?: any // Can be: string (text), {text: "...", files: [...], links: [...]} for questionnaire-style
  file_path?: string // Deprecated: use value.files
  file_name?: string // Deprecated: use value.files
  submitted_at: string
}

export const submissionRequirementsApi = {
  list: async (category?: string, section?: string, sourceType?: string, isEnabled?: boolean, agentCategory?: string, agentType?: string, questionnaireType?: string, requirementType?: 'compliance' | 'risk' | 'questionnaires'): Promise<SubmissionRequirement[]> => {
    const params: any = {}
    if (category) params.category = category
    if (section) params.section = section
    if (sourceType) params.source_type = sourceType
    if (isEnabled !== undefined) params.is_enabled = isEnabled
    if (agentCategory) params.agent_category = agentCategory
    if (agentType) params.agent_type = agentType
    if (questionnaireType) params.questionnaire_type = questionnaireType
    if (requirementType) params.requirement_type = requirementType
    const response = await api.get('/submission-requirements', { params })
    return response.data
  },

  get: async (id: string): Promise<SubmissionRequirement> => {
    const response = await api.get(`/submission-requirements/${id}`)
    return response.data
  },

  create: async (requirement: Partial<SubmissionRequirement>): Promise<SubmissionRequirement> => {
    const response = await api.post('/submission-requirements', requirement)
    return response.data
  },

  update: async (id: string, requirement: Partial<SubmissionRequirement>): Promise<SubmissionRequirement> => {
    const response = await api.patch(`/submission-requirements/${id}`, requirement)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/submission-requirements/${id}`)
  },

  toggle: async (id: string): Promise<SubmissionRequirement> => {
    const response = await api.patch(`/submission-requirements/${id}/toggle`)
    return response.data
  },

  autoGenerate: async (sourceTypes?: string[], frameworkIds?: string[], riskIds?: string[], categories?: string[]): Promise<{ message: string; created: number; details: any }> => {
    const response = await api.post('/submission-requirements/auto-generate', {
      source_types: sourceTypes,
      framework_ids: frameworkIds,
      risk_ids: riskIds,
      categories: categories,
    })
    return response.data
  },

  saveResponses: async (agentId: string, responses: Record<string, any>): Promise<void> => {
    await api.post(`/submission-requirements/agents/${agentId}/responses`, responses)
  },

  getResponses: async (agentId: string): Promise<RequirementResponse[]> => {
    const response = await api.get(`/submission-requirements/agents/${agentId}/responses`)
    return response.data
  },
}

