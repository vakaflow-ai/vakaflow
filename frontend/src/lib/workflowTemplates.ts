import api from './api'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  entity_types: string[]
}

export interface WorkflowTemplateCreate {
  template_name: string
  customizations?: Record<string, any>
}

export const workflowTemplatesApi = {
  list: async (): Promise<WorkflowTemplate[]> => {
    const response = await api.get('/workflow-templates')
    return response.data
  },

  create: async (data: WorkflowTemplateCreate): Promise<{
    id: string
    name: string
    description: string
    status: string
    message: string
  }> => {
    const response = await api.post('/workflow-templates', data)
    return response.data
  }
}
