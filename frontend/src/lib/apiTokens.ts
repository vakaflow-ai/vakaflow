import api from './api'

export interface APIToken {
  id: string
  name: string
  description?: string
  token_prefix: string
  scopes: string[]
  permissions?: Record<string, any>
  rate_limit_per_minute: number
  rate_limit_per_hour: number
  rate_limit_per_day: number
  status: string
  expires_at?: string
  last_used_at?: string
  last_used_ip?: string
  request_count: number
  created_at: string
  created_by: string
}

export interface APITokenCreate {
  name: string
  description?: string
  scopes: string[]
  permissions?: Record<string, any>
  rate_limit_per_minute?: number
  rate_limit_per_hour?: number
  rate_limit_per_day?: number
  expires_in_days?: number
}

export interface APITokenCreateResponse {
  id: string
  name: string
  token: string
  token_prefix: string
  scopes: string[]
  expires_at?: string
  created_at: string
  warning: string
}

export interface SCIMConfig {
  id: string
  tenant_id: string
  enabled: boolean
  base_url: string
  auto_provision_users: boolean
  auto_update_users: boolean
  auto_deactivate_users: boolean
  field_mappings?: Record<string, string>
  webhook_url?: string
  last_sync_at?: string
  sync_status?: string
  last_error?: string
  created_at: string
  updated_at: string
}

export interface SCIMConfigCreate {
  enabled: boolean
  bearer_token: string
  auto_provision_users?: boolean
  auto_update_users?: boolean
  auto_deactivate_users?: boolean
  field_mappings?: Record<string, string>
  webhook_url?: string
  webhook_secret?: string
}

export interface TokenUsage {
  token_id: string
  period_days: number
  total_requests: number
  successful_requests: number
  failed_requests: number
  rate_limit_hits: number
  average_response_time_ms: number
  endpoint_usage: Record<string, number>
  last_used_at?: string
}

export const apiTokensApi = {
  create: async (data: APITokenCreate): Promise<APITokenCreateResponse> => {
    const response = await api.post('/api-tokens', data)
    return response.data
  },

  list: async (): Promise<APIToken[]> => {
    const response = await api.get('/api-tokens')
    return response.data
  },

  revoke: async (tokenId: string): Promise<void> => {
    await api.post(`/api-tokens/${tokenId}/revoke`)
  },

  getUsage: async (tokenId: string, days: number = 7): Promise<TokenUsage> => {
    const response = await api.get(`/api-tokens/${tokenId}/usage`, {
      params: { days }
    })
    return response.data
  },

  // SCIM Configuration
  getSCIMConfig: async (): Promise<SCIMConfig> => {
    const response = await api.get('/api-tokens/scim/config')
    return response.data
  },

  createOrUpdateSCIMConfig: async (data: SCIMConfigCreate): Promise<SCIMConfig> => {
    const response = await api.post('/api-tokens/scim/config', data)
    return response.data
  }
}

