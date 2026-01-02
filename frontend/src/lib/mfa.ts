import api from './api'

export interface MFASetupResponse {
  secret?: string
  qr_code?: string
  backup_codes?: string[]
  method: string
  message: string
}

export interface MFAStatus {
  enabled: boolean
  method: string | null
  status: string
  has_backup_codes: boolean
}

export const mfaApi = {
  setup: async (method: string = 'totp'): Promise<MFASetupResponse> => {
    const response = await api.post('/mfa/setup', { method })
    return response.data
  },
  
  verify: async (code: string): Promise<{ verified: boolean; message: string }> => {
    const response = await api.post('/mfa/verify', { code })
    return response.data
  },
  
  enable: async (): Promise<{ enabled: boolean; message: string }> => {
    const response = await api.post('/mfa/enable')
    return response.data
  },
  
  disable: async (): Promise<{ enabled: boolean; message: string }> => {
    const response = await api.post('/mfa/disable')
    return response.data
  },
  
  getStatus: async (): Promise<MFAStatus> => {
    const response = await api.get('/mfa/status')
    return response.data
  },
}

