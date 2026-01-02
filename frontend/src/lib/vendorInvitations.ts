import api from './api'

export interface VendorInvitation {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
  invited_by: string
  invited_by_name?: string
  message?: string
  tenant_name?: string
  email_sent?: boolean
  email_error?: string
}

export interface InvitationCreate {
  email: string
  message?: string
}

export interface InvitationAccept {
  token: string
  email: string
  otp: string
  vendor_name: string
  contact_phone?: string
  address?: string
  website?: string
  description?: string
  registration_number?: string
  password: string
  name: string
  tenant_id?: string
  tenant_slug?: string
}

export const vendorInvitationsApi = {
  create: async (data: InvitationCreate): Promise<VendorInvitation> => {
    const response = await api.post('/vendor-invitations', data)
    return response.data
  },

  list: async (statusFilter?: string): Promise<VendorInvitation[]> => {
    const params: any = {}
    if (statusFilter) params.status_filter = statusFilter
    const response = await api.get('/vendor-invitations', { params })
    return response.data
  },

  get: async (id: string): Promise<VendorInvitation> => {
    const response = await api.get(`/vendor-invitations/${id}`)
    return response.data
  },

  getByToken: async (token: string): Promise<VendorInvitation> => {
    const response = await api.get(`/vendor-invitations/by-token/${token}`)
    return response.data
  },

  accept: async (data: InvitationAccept): Promise<{ message: string; vendor_id: string; user_id: string }> => {
    const response = await api.post('/vendor-invitations/accept', data)
    return response.data
  },

  resend: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/vendor-invitations/${id}/resend`)
    return response.data
  },

  cancel: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/vendor-invitations/${id}/cancel`)
    return response.data
  },
}

