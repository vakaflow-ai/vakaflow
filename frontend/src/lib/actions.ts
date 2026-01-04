import api from './api'

export interface ActionItem {
  id: string
  type: string
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  assigned_at?: string
  completed_at?: string
  source_type: string
  source_id: string
  action_url: string
  metadata?: Record<string, any>
}

export interface InboxResponse {
  items: ActionItem[]
  pending: ActionItem[]
  completed: ActionItem[]
  overdue: ActionItem[]
  total: number
  pending_count: number
  completed_count: number
  overdue_count: number
}

export const actionsApi = {
  getInbox: async (status?: string, action_type?: string, limit: number = 100, offset: number = 0): Promise<InboxResponse> => {
    const params: any = { limit, offset }
    if (status) params.status = status
    if (action_type) params.action_type = action_type
    const response = await api.get('/actions/inbox', { params })
    return response.data
  },

  getPending: async (action_type?: string, limit: number = 100): Promise<ActionItem[]> => {
    const params: any = { limit }
    if (action_type) params.action_type = action_type
    const response = await api.get('/actions/inbox/pending', { params })
    return response.data
  },

  getCompleted: async (action_type?: string, limit: number = 100): Promise<ActionItem[]> => {
    const params: any = { limit }
    if (action_type) params.action_type = action_type
    const response = await api.get('/actions/inbox/completed', { params })
    return response.data
  },

  markAsRead: async (source_type: string, source_id: string): Promise<void> => {
    await api.post(`/actions/inbox/${source_type}/${source_id}/read`)
  },

  getCounts: async (): Promise<{ pending: number; completed: number; overdue: number; total: number }> => {
    const response = await api.get('/actions/inbox/counts')
    return response.data
  },

  getBySource: async (sourceType: string, sourceId: string): Promise<ActionItem> => {
    const response = await api.get(`/actions/inbox/${sourceType}/${sourceId}`)
    return response.data
  }
}
