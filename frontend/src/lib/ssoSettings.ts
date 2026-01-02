import api from './api'

export interface SSOConfig {
  type: 'saml' | 'oidc'
  provider: 'azure_entra_id' | 'google' | 'okta' | 'ping' | 'custom'
  name: string
  saml_entity_id?: string
  saml_sso_url?: string
  saml_x509_cert?: string
  saml_private_key?: string
  oidc_client_id?: string
  oidc_client_secret?: string
  oidc_authorization_url?: string
  oidc_token_url?: string
  oidc_userinfo_url?: string
  oidc_issuer?: string
  attribute_mapping?: Record<string, string>
  sync_enabled: boolean
  sync_schedule?: string
  allowed_fields: string[]
  azure_tenant_id?: string
  google_domain?: string
}

export interface SSOConfigResponse {
  type: string
  provider: string
  name: string
  saml_entity_id?: string
  saml_sso_url?: string
  oidc_client_id?: string
  oidc_authorization_url?: string
  attribute_mapping: Record<string, string>
  sync_enabled: boolean
  sync_schedule?: string
  allowed_fields: string[]
  is_configured: boolean
  integration_id?: string
  azure_tenant_id?: string
  google_domain?: string
}

export const ssoSettingsApi = {
  get: async (): Promise<SSOConfigResponse> => {
    const response = await api.get('/sso-settings')
    return response.data
  },

  update: async (config: SSOConfig): Promise<SSOConfigResponse> => {
    const response = await api.post('/sso-settings', config)
    return response.data
  }
}

