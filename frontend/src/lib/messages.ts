import api from './api'

export interface Message {
  id: string
  message_type: string
  content: string
  resource_type: string
  resource_id: string
  sender_id: string
  sender_name: string
  recipient_id?: string
  parent_id?: string
  is_read: boolean
  created_at: string
  replies: Message[]
}

export interface MessageCreate {
  resource_type: string
  resource_id: string
  content: string
  message_type?: string
  parent_id?: string
  recipient_id?: string
}

export const messagesApi = {
  create: async (data: MessageCreate): Promise<Message> => {
    const response = await api.post('/messages', data)
    return response.data
  },

  list: async (resourceType?: string, resourceId?: string, unreadOnly?: boolean): Promise<Message[]> => {
    const params: any = {}
    if (resourceType) params.resource_type = resourceType
    if (resourceId) params.resource_id = resourceId  // Can be UUID string or identifier string
    if (unreadOnly) params.unread_only = true
    
    const response = await api.get('/messages', { params })
    return response.data
  },

  getUnreadCount: async (): Promise<{ unread_count: number }> => {
    const response = await api.get('/messages/unread-count')
    return response.data
  },

  markAsRead: async (messageId: string): Promise<void> => {
    await api.patch(`/messages/${messageId}/read`)
  }
}

