import { api } from './api'

export interface Ticket {
  id: string
  ticket_number: string
  agent_id: string
  title: string
  description?: string
  status: string
  current_stage: string
  submitted_by: string
  submitted_by_name?: string
  submitted_by_email?: string
  assigned_to?: string
  assigned_to_name?: string
  assigned_to_email?: string
  approved_by?: string
  approved_by_name?: string
  stage_progress?: Record<string, any>
  submitted_at: string
  last_updated_at: string
  completed_at?: string
  agent_name?: string
  agent_status?: string
}

export interface TicketListResponse {
  tickets: Ticket[]
  total: number
  page: number
  limit: number
}

export interface TicketActivity {
  id: string
  activity_type: string
  description?: string
  user_id: string
  user_name?: string
  user_email?: string
  old_value?: string
  new_value?: string
  created_at: string
}

export const ticketsApi = {
  list: async (page: number = 1, limit: number = 20, statusFilter?: string): Promise<TicketListResponse> => {
    const params: any = { page, limit }
    if (statusFilter) params.status_filter = statusFilter
    
    const response = await api.get('/tickets', { params })
    return response.data
  },
  
  get: async (id: string): Promise<Ticket> => {
    const response = await api.get(`/tickets/${id}`)
    return response.data
  },
  
  getByAgent: async (agentId: string): Promise<Ticket> => {
    const response = await api.get(`/tickets/agent/${agentId}`)
    return response.data
  },
  
  getActivities: async (ticketId: string, page: number = 1, limit: number = 50): Promise<TicketActivity[]> => {
    const response = await api.get(`/tickets/${ticketId}/activities`, {
      params: { page, limit }
    })
    return response.data
  },
  
  sync: async (): Promise<{ synced_count: number; total_tickets: number; errors: string[] }> => {
    const response = await api.post('/tickets/sync')
    return response.data
  },
}

