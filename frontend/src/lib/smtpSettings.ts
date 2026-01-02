import api from './api'

export interface SMTPConfig {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_use_tls: boolean
  from_email: string
  from_name: string
}

export interface SMTPConfigResponse {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_use_tls: boolean
  from_email: string
  from_name: string
  is_configured: boolean
  integration_id?: string
}

export const smtpSettingsApi = {
  get: async (): Promise<SMTPConfigResponse> => {
    const response = await api.get('/smtp-settings')
    return response.data
  },

  update: async (config: SMTPConfig): Promise<SMTPConfigResponse> => {
    const response = await api.post('/smtp-settings', config)
    return response.data
  },

  test: async (config?: SMTPConfig): Promise<{ status: string; message: string }> => {
    const response = await api.post('/smtp-settings/test', config || {})
    return response.data
  }
}

