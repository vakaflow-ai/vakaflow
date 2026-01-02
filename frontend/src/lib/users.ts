import api from './api'

export interface User {
  id: string
  email: string
  name: string
  role: string
  tenant_id?: string
  department?: string
  organization?: string
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  email: string
  name: string
  password: string
  role: string
  tenant_id?: string
}

export interface UserUpdate {
  name?: string
  role?: string
  is_active?: boolean
  password?: string
  department?: string
  organization?: string
}

export const usersApi = {
  list: async (tenantId?: string, roleFilter?: string): Promise<User[]> => {
    const params: any = {}
    if (tenantId) params.tenant_id = tenantId
    if (roleFilter) params.role_filter = roleFilter
    const response = await api.get('/users', { params })
    return response.data
  },

  get: async (userId: string): Promise<User> => {
    const response = await api.get(`/users/${userId}`)
    return response.data
  },

  create: async (data: UserCreate): Promise<User> => {
    const response = await api.post('/users', data)
    return response.data
  },

  update: async (userId: string, data: UserUpdate): Promise<User> => {
    const response = await api.patch(`/users/${userId}`, data)
    return response.data
  },

  delete: async (userId: string): Promise<void> => {
    await api.delete(`/users/${userId}`)
  },

  terminate: async (userId: string): Promise<User> => {
    const response = await api.post(`/users/terminate/${userId}`)
    return response.data
  },

  importCSV: async (file: File, defaultRole: string = 'end_user', sendInvitation: boolean = false): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/users/import-csv', formData, {
      params: {
        default_role: defaultRole,
        send_invitation: sendInvitation
      },
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },
}

// User roles are now fetched from master data lists
// Use masterDataListsApi.getValuesByType('user_role') instead
// This constant is kept for backward compatibility but should be replaced with master data
export const USER_ROLES = [
  { value: 'tenant_admin', label: 'Tenant Admin' },
  { value: 'policy_admin', label: 'Policy Admin' },
  { value: 'integration_admin', label: 'Integration Admin' },
  { value: 'user_admin', label: 'User Admin' },
  { value: 'security_reviewer', label: 'Security Reviewer' },
  { value: 'compliance_reviewer', label: 'Compliance Reviewer' },
  { value: 'technical_reviewer', label: 'Technical Reviewer' },
  { value: 'business_reviewer', label: 'Business Reviewer' },
  { value: 'approver', label: 'Approver' },
  { value: 'vendor_coordinator', label: 'Vendor Coordinator' },
  { value: 'vendor_user', label: 'Vendor User' },
  { value: 'end_user', label: 'End User' },
]

