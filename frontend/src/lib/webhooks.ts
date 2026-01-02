import api from './api'

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  secret?: string
  created_at: string
}

export interface WebhookDelivery {
  id: string
  status: string
  response_code?: number
  attempted_at: string
  delivered_at?: string
  error?: string
}

export const webhooksApi = {
  list: async (): Promise<Webhook[]> => {
    const response = await api.get('/webhooks')
    return response.data
  },
  
  create: async (name: string, url: string, events: string[]) => {
    const response = await api.post('/webhooks', { name, url, events })
    return response.data
  },
  
  get: async (id: string): Promise<Webhook> => {
    const response = await api.get(`/webhooks/${id}`)
    return response.data
  },
  
  delete: async (id: string) => {
    await api.delete(`/webhooks/${id}`)
  },
  
  activate: async (id: string) => {
    await api.post(`/webhooks/${id}/activate`)
  },
  
  deactivate: async (id: string) => {
    await api.post(`/webhooks/${id}/deactivate`)
  },
  
  getDeliveries: async (id: string): Promise<WebhookDelivery[]> => {
    const response = await api.get(`/webhooks/${id}/deliveries`)
    return response.data
  },
}

