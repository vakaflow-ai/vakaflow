import api from './api'

export interface StageSettings {
  visible_fields?: string[]
  email_notifications?: {
    enabled: boolean
    recipients?: ('user' | 'vendor' | 'next_approver')[]
    reminders?: number[]
  }
  layout_id?: string // Form layout ID for approver screen tabs (from Process Designer)
  step_number: number
  step_name: string
  step_type: string
}

export const workflowStageSettingsApi = {
  getForAgent: async (agentId: string): Promise<StageSettings> => {
    const response = await api.get(`/workflow-stage-settings/agent/${agentId}`)
    return response.data
  },
}

