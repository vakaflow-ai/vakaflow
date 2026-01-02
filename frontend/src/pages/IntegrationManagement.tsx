import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi, Integration } from '../lib/integrations'
import { smtpSettingsApi, SMTPConfig, SMTPConfigResponse } from '../lib/smtpSettings'
import { ssoSettingsApi, SSOConfig, SSOConfigResponse } from '../lib/ssoSettings'
import { apiTokensApi, APIToken, APITokenCreate, SCIMConfig, SCIMConfigCreate } from '../lib/apiTokens'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import IntegrationHelpModal from '../components/IntegrationHelpModal'
import api from '../lib/api'

export default function IntegrationManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showSMTPForm, setShowSMTPForm] = useState(false)
  const [showSSOForm, setShowSSOForm] = useState(false)
  const [showAPITokenForm, setShowAPITokenForm] = useState(false)
  const [showSCIMForm, setShowSCIMForm] = useState(false)
  const [integrationType, setIntegrationType] = useState<string>('servicenow')
  const [integrationName, setIntegrationName] = useState('')
  const [integrationConfig, setIntegrationConfig] = useState('')
  
  // Type-specific configuration states
  const [servicenowConfig, setServicenowConfig] = useState({
    instance_url: '',
    username: '',
    password: '',
    table: 'incident',
    client_id: '',
    client_secret: ''
  })
  
  const [jiraConfig, setJiraConfig] = useState({
    base_url: '',
    email: '',
    api_token: '',
    project_key: '',
    issue_type: 'Task',
    oauth_client_id: '',
    oauth_client_secret: '',
    webhook_url: ''
  })
  
  const [slackConfig, setSlackConfig] = useState({
    bot_token: '',
    default_channel: ''
  })
  
  const [teamsConfig, setTeamsConfig] = useState({
    webhook_url: ''
  })
  
  const [webhookConfig, setWebhookConfig] = useState({
    webhook_url: '',
    secret: '',
    events: [] as string[]
  })
  
  const [complianceToolConfig, setComplianceToolConfig] = useState({
    api_url: '',
    api_key: '',
    api_secret: ''
  })
  
  const [securityToolConfig, setSecurityToolConfig] = useState({
    api_url: '',
    api_key: '',
    api_secret: ''
  })
  
  // Edit integration state
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null)
  const [editName, setEditName] = useState('')
  const [editConfig, setEditConfig] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  
  // API Token state
  const [newToken, setNewToken] = useState<APITokenCreate>({
    name: '',
    description: '',
    scopes: ['read:agents'],
    rate_limit_per_minute: 60,
    rate_limit_per_hour: 1000,
    rate_limit_per_day: 10000
  })
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  
  // SCIM Config state
  const [scimConfig, setScimConfig] = useState<SCIMConfigCreate>({
    enabled: true,
    bearer_token: '',
    auto_provision_users: true,
    auto_update_users: true,
    auto_deactivate_users: true
  })
  
  // SMTP Settings state
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_use_tls: true,
    from_email: '',
    from_name: 'VAKA Platform'
  })
  
  // SSO Settings state
  const [ssoConfig, setSsoConfig] = useState<SSOConfig>({
    type: 'saml',
    provider: 'custom',
    name: '',
    attribute_mapping: {
      email: 'email',
      first_name: 'givenName',
      last_name: 'surname',
      name: 'name',
      department: 'department'
    },
    sync_enabled: true,
    allowed_fields: ['email', 'first_name', 'last_name', 'department']
  })

  // Help modal state
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [helpProvider, setHelpProvider] = useState<string>('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Calculate isAdmin before using it in queries
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'platform_admin'

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list(),
    enabled: !!user
  })

  const { data: smtpSettings, isLoading: smtpLoading } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: () => smtpSettingsApi.get(),
    enabled: !!user && isAdmin
  })

  const { data: ssoSettings, isLoading: ssoLoading } = useQuery({
    queryKey: ['sso-settings'],
    queryFn: () => ssoSettingsApi.get(),
    enabled: !!user && isAdmin
  })

  const { data: apiTokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => apiTokensApi.list(),
    enabled: !!user && isAdmin
  })

  const { data: scimConfigData, isLoading: scimLoading } = useQuery({
    queryKey: ['scim-config'],
    queryFn: () => apiTokensApi.getSCIMConfig(),
    enabled: !!user && isAdmin,
    retry: false // Don't retry if 404 (not configured yet)
  })

  const smtpUpdateMutation = useMutation({
    mutationFn: (config: SMTPConfig) => smtpSettingsApi.update(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      closeAllForms()
    }
  })

  const smtpTestMutation = useMutation({
    mutationFn: (config?: SMTPConfig) => smtpSettingsApi.test(config),
  })

  const ssoUpdateMutation = useMutation({
    mutationFn: (config: SSOConfig) => ssoSettingsApi.update(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-settings'] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      closeAllForms()
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => integrationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      closeAllForms()
      setIntegrationName('')
      setIntegrationConfig('')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => integrationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setEditingIntegration(null)
      setEditName('')
      setEditConfig('')
      setEditDescription('')
    }
  })

  const handleEdit = async (integration: Integration) => {
    try {
      // For SMTP integrations, use the SMTP form instead of generic editor
      if (integration.integration_type.toLowerCase() === 'smtp') {
        const config = await integrationsApi.getConfig(integration.id)
        const smtpConfigData = config.config || {}
        setSmtpConfig({
          smtp_host: smtpConfigData.smtp_host || '',
          smtp_port: smtpConfigData.smtp_port || 587,
          smtp_user: smtpConfigData.smtp_user || '',
          smtp_password: '', // Don't pre-fill password for security
          smtp_use_tls: smtpConfigData.smtp_use_tls ?? true,
          from_email: smtpConfigData.from_email || '',
          from_name: smtpConfigData.from_name || 'VAKA Platform'
        })
        setEditingIntegration(integration)
        openForm('smtp')
        return
      }
      
      // For other integrations, use generic JSON editor
      const config = await integrationsApi.getConfig(integration.id)
      setEditingIntegration(integration)
      setEditName(integration.name)
      setEditConfig(JSON.stringify(config.config || {}, null, 2))
      setEditDescription(integration.description || '')
    } catch (err: any) {
      alert(`Failed to load integration config: ${err.response?.data?.detail || err.message}`)
    }
  }

  const handleSaveEdit = () => {
    if (!editingIntegration) return
    
    try {
      const config = JSON.parse(editConfig || '{}')
      updateMutation.mutate({
        id: editingIntegration.id,
        data: {
          name: editName,
          integration_type: editingIntegration.integration_type,
          config: config,
          description: editDescription || undefined
        }
      })
    } catch (e) {
      alert('Invalid JSON configuration')
    }
  }

  const testMutation = useMutation({
    mutationFn: (integrationId: string) => integrationsApi.test(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    }
  })

  const activateMutation = useMutation({
    mutationFn: (integrationId: string) => integrationsApi.activate(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: (integrationId: string) => integrationsApi.deactivate(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    }
  })

  const createTokenMutation = useMutation({
    mutationFn: (data: APITokenCreate) => apiTokensApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] })
      setCreatedToken(data.token)
      // Don't close form immediately - user needs to see the token
    }
  })

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) => apiTokensApi.revoke(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] })
    }
  })

  const scimConfigMutation = useMutation({
    mutationFn: (data: SCIMConfigCreate) => apiTokensApi.createOrUpdateSCIMConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim-config'] })
      closeAllForms()
    }
  })

  const handleCreate = () => {
    let config: any = {}
    
    // Build config based on integration type
    switch (integrationType) {
      case 'servicenow':
        config = {
          instance_url: servicenowConfig.instance_url,
          username: servicenowConfig.username,
          password: servicenowConfig.password,
          table: servicenowConfig.table,
          client_id: servicenowConfig.client_id || undefined,
          client_secret: servicenowConfig.client_secret || undefined
        }
        break
      case 'jira':
        config = {
          base_url: jiraConfig.base_url,
          email: jiraConfig.email,
          api_token: jiraConfig.api_token,
          project_key: jiraConfig.project_key,
          issue_type: jiraConfig.issue_type,
          oauth_client_id: jiraConfig.oauth_client_id || undefined,
          oauth_client_secret: jiraConfig.oauth_client_secret || undefined,
          webhook_url: jiraConfig.webhook_url || undefined
        }
        break
      case 'slack':
        config = {
          bot_token: slackConfig.bot_token,
          default_channel: slackConfig.default_channel || undefined
        }
        break
      case 'teams':
        config = {
          webhook_url: teamsConfig.webhook_url
        }
        break
      case 'webhook':
        config = {
          webhook_url: webhookConfig.webhook_url,
          secret: webhookConfig.secret || undefined,
          events: webhookConfig.events
        }
        break
      case 'compliance_tool':
        config = {
          api_url: complianceToolConfig.api_url,
          api_key: complianceToolConfig.api_key,
          api_secret: complianceToolConfig.api_secret || undefined
        }
        break
      case 'security_tool':
        config = {
          api_url: securityToolConfig.api_url,
          api_key: securityToolConfig.api_key,
          api_secret: securityToolConfig.api_secret || undefined
        }
        break
      case 'smtp':
        // SMTP is handled separately via SMTP settings
        alert('Please use "Configure Email (SMTP)" button for SMTP configuration')
        return
      case 'sso':
        // SSO is handled separately via SSO settings
        alert('Please use "Configure SSO" button for SSO configuration')
        return
      default:
        // Fallback to JSON for custom types
        try {
          config = JSON.parse(integrationConfig || '{}')
        } catch (e) {
          alert('Invalid JSON configuration')
          return
        }
    }
    
    createMutation.mutate({
      name: integrationName,
      integration_type: integrationType,
      config
    })
  }
  
  const renderIntegrationForm = () => {
    switch (integrationType) {
      case 'servicenow':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Instance URL *</label>
              <input
                type="url"
                value={servicenowConfig.instance_url}
                onChange={(e) => setServicenowConfig({ ...servicenowConfig, instance_url: e.target.value })}
                className="compact-input w-full"
                placeholder="https://instance.service-now.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Username *</label>
              <input
                type="text"
                value={servicenowConfig.username}
                onChange={(e) => setServicenowConfig({ ...servicenowConfig, username: e.target.value })}
                className="compact-input w-full"
                placeholder="Integration user username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password *</label>
              <input
                type="password"
                value={servicenowConfig.password}
                onChange={(e) => setServicenowConfig({ ...servicenowConfig, password: e.target.value })}
                className="compact-input w-full"
                placeholder="Integration user password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Table Name</label>
              <input
                type="text"
                value={servicenowConfig.table}
                onChange={(e) => setServicenowConfig({ ...servicenowConfig, table: e.target.value })}
                className="compact-input w-full"
                placeholder="incident"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">OAuth Client ID (Optional)</label>
              <input
                type="text"
                value={servicenowConfig.client_id}
                onChange={(e) => setServicenowConfig({ ...servicenowConfig, client_id: e.target.value })}
                className="compact-input w-full"
                placeholder="OAuth client ID if using OAuth"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">OAuth Client Secret (Optional)</label>
              <input
                type="password"
                value={servicenowConfig.client_secret}
                onChange={(e) => setServicenowConfig({ ...servicenowConfig, client_secret: e.target.value })}
                className="compact-input w-full"
                placeholder="OAuth client secret if using OAuth"
              />
            </div>
          </div>
        )
      
      case 'jira':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Jira URL *</label>
              <input
                type="url"
                value={jiraConfig.base_url}
                onChange={(e) => setJiraConfig({ ...jiraConfig, base_url: e.target.value })}
                className="compact-input w-full"
                placeholder="https://domain.atlassian.net or https://your-server.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email/Username *</label>
              <input
                type="email"
                value={jiraConfig.email}
                onChange={(e) => setJiraConfig({ ...jiraConfig, email: e.target.value })}
                className="compact-input w-full"
                placeholder="your-jira-email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">API Token *</label>
              <input
                type="password"
                value={jiraConfig.api_token}
                onChange={(e) => setJiraConfig({ ...jiraConfig, api_token: e.target.value })}
                className="compact-input w-full"
                placeholder="API token from Jira account settings"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Project Key *</label>
              <input
                type="text"
                value={jiraConfig.project_key}
                onChange={(e) => setJiraConfig({ ...jiraConfig, project_key: e.target.value })}
                className="compact-input w-full"
                placeholder="PROJ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Issue Type</label>
              <input
                type="text"
                value={jiraConfig.issue_type}
                onChange={(e) => setJiraConfig({ ...jiraConfig, issue_type: e.target.value })}
                className="compact-input w-full"
                placeholder="Task"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">OAuth Client ID (Optional)</label>
              <input
                type="text"
                value={jiraConfig.oauth_client_id}
                onChange={(e) => setJiraConfig({ ...jiraConfig, oauth_client_id: e.target.value })}
                className="compact-input w-full"
                placeholder="OAuth client ID if using OAuth"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">OAuth Client Secret (Optional)</label>
              <input
                type="password"
                value={jiraConfig.oauth_client_secret}
                onChange={(e) => setJiraConfig({ ...jiraConfig, oauth_client_secret: e.target.value })}
                className="compact-input w-full"
                placeholder="OAuth client secret if using OAuth"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Webhook URL (Optional)</label>
              <input
                type="url"
                value={jiraConfig.webhook_url}
                onChange={(e) => setJiraConfig({ ...jiraConfig, webhook_url: e.target.value })}
                className="compact-input w-full"
                placeholder="Webhook URL for receiving Jira events"
              />
            </div>
          </div>
        )
      
      case 'slack':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bot Token *</label>
              <input
                type="password"
                value={slackConfig.bot_token}
                onChange={(e) => setSlackConfig({ ...slackConfig, bot_token: e.target.value })}
                className="compact-input w-full"
                placeholder="xoxb-..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Create a bot app in Slack and get the bot token from OAuth & Permissions
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Channel (Optional)</label>
              <input
                type="text"
                value={slackConfig.default_channel}
                onChange={(e) => setSlackConfig({ ...slackConfig, default_channel: e.target.value })}
                className="compact-input w-full"
                placeholder="#general"
              />
            </div>
          </div>
        )
      
      case 'teams':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Webhook URL *</label>
              <input
                type="url"
                value={teamsConfig.webhook_url}
                onChange={(e) => setTeamsConfig({ ...teamsConfig, webhook_url: e.target.value })}
                className="compact-input w-full"
                placeholder="https://outlook.office.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Create an incoming webhook connector in Microsoft Teams
              </p>
            </div>
          </div>
        )
      
      case 'webhook':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Webhook URL *</label>
              <input
                type="url"
                value={webhookConfig.webhook_url}
                onChange={(e) => setWebhookConfig({ ...webhookConfig, webhook_url: e.target.value })}
                className="compact-input w-full"
                placeholder="https://example.com/webhook"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Secret (Optional)</label>
              <input
                type="password"
                value={webhookConfig.secret}
                onChange={(e) => setWebhookConfig({ ...webhookConfig, secret: e.target.value })}
                className="compact-input w-full"
                placeholder="Webhook secret for verification"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Events to Subscribe</label>
              <div className="space-y-2">
                {['agent.submitted', 'agent.approved', 'agent.rejected', 'review.completed'].map((event) => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={webhookConfig.events.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setWebhookConfig({ ...webhookConfig, events: [...webhookConfig.events, event] })
                        } else {
                          setWebhookConfig({ ...webhookConfig, events: webhookConfig.events.filter(e => e !== event) })
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{event}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )
      
      case 'compliance_tool':
      case 'security_tool':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API URL *</label>
              <input
                type="url"
                value={integrationType === 'compliance_tool' ? complianceToolConfig.api_url : securityToolConfig.api_url}
                onChange={(e) => {
                  if (integrationType === 'compliance_tool') {
                    setComplianceToolConfig({ ...complianceToolConfig, api_url: e.target.value })
                  } else {
                    setSecurityToolConfig({ ...securityToolConfig, api_url: e.target.value })
                  }
                }}
                className="compact-input w-full"
                placeholder="https://api.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">API Key *</label>
              <input
                type="text"
                value={integrationType === 'compliance_tool' ? complianceToolConfig.api_key : securityToolConfig.api_key}
                onChange={(e) => {
                  if (integrationType === 'compliance_tool') {
                    setComplianceToolConfig({ ...complianceToolConfig, api_key: e.target.value })
                  } else {
                    setSecurityToolConfig({ ...securityToolConfig, api_key: e.target.value })
                  }
                }}
                className="compact-input w-full"
                placeholder="API key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">API Secret (Optional)</label>
              <input
                type="password"
                value={integrationType === 'compliance_tool' ? complianceToolConfig.api_secret : securityToolConfig.api_secret}
                onChange={(e) => {
                  if (integrationType === 'compliance_tool') {
                    setComplianceToolConfig({ ...complianceToolConfig, api_secret: e.target.value })
                  } else {
                    setSecurityToolConfig({ ...securityToolConfig, api_secret: e.target.value })
                  }
                }}
                className="compact-input w-full"
                placeholder="API secret"
              />
            </div>
          </div>
        )
      
      default:
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Configuration (JSON) *</label>
            <textarea
              value={integrationConfig}
              onChange={(e) => setIntegrationConfig(e.target.value)}
              className="compact-input w-full min-h-[100px] font-mono text-xs"
              placeholder='{"api_url": "https://...", "api_key": "..."}'
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter configuration as JSON for custom integration types
            </p>
          </div>
        )
    }
  }
  
  const getRequiredFieldsValid = () => {
    switch (integrationType) {
      case 'servicenow':
        return servicenowConfig.instance_url && servicenowConfig.username && servicenowConfig.password
      case 'jira':
        return jiraConfig.base_url && jiraConfig.email && jiraConfig.api_token && jiraConfig.project_key
      case 'slack':
        return slackConfig.bot_token
      case 'teams':
        return teamsConfig.webhook_url
      case 'webhook':
        return webhookConfig.webhook_url
      case 'compliance_tool':
        return complianceToolConfig.api_url && complianceToolConfig.api_key
      case 'security_tool':
        return securityToolConfig.api_url && securityToolConfig.api_key
      case 'smtp':
      case 'sso':
        return false // These are handled separately
      default:
        return integrationName && integrationConfig
    }
  }

  // Load SMTP settings when available
  useEffect(() => {
    if (smtpSettings && !showSMTPForm) {
      setSmtpConfig({
        smtp_host: smtpSettings.smtp_host || '',
        smtp_port: smtpSettings.smtp_port || 587,
        smtp_user: smtpSettings.smtp_user || '',
        smtp_password: '', // Don't pre-fill password
        smtp_use_tls: smtpSettings.smtp_use_tls ?? true,
        from_email: smtpSettings.from_email || '',
        from_name: smtpSettings.from_name || 'VAKA Platform'
      })
    }
  }, [smtpSettings, showSMTPForm])

  // Load SSO settings when available
  useEffect(() => {
    if (ssoSettings && !showSSOForm) {
      setSsoConfig({
        type: (ssoSettings.type as 'saml' | 'oidc') || 'saml',
        provider: (ssoSettings.provider as any) || 'custom',
        name: ssoSettings.name || '',
        saml_entity_id: ssoSettings.saml_entity_id,
        saml_sso_url: ssoSettings.saml_sso_url,
        oidc_client_id: ssoSettings.oidc_client_id,
        oidc_authorization_url: ssoSettings.oidc_authorization_url,
        attribute_mapping: ssoSettings.attribute_mapping || {},
        sync_enabled: ssoSettings.sync_enabled ?? true,
        allowed_fields: ssoSettings.allowed_fields || ['email', 'first_name', 'last_name', 'department'],
        azure_tenant_id: ssoSettings.azure_tenant_id,
        google_domain: ssoSettings.google_domain
      })
    }
  }, [ssoSettings, showSSOForm])

  const openHelp = (provider: string) => {
    setHelpProvider(provider)
    setHelpModalOpen(true)
  }

  // Close all forms
  const closeAllForms = () => {
    setShowCreateForm(false)
    setShowSMTPForm(false)
    setShowSSOForm(false)
    setShowAPITokenForm(false)
    setShowSCIMForm(false)
    setEditingIntegration(null)
  }

  // Open a specific form and close all others
  const openForm = (formType: 'create' | 'smtp' | 'sso' | 'api-token' | 'scim') => {
    closeAllForms()
    switch (formType) {
      case 'create':
        setShowCreateForm(true)
        break
      case 'smtp':
        setShowSMTPForm(true)
        break
      case 'sso':
        setShowSSOForm(true)
        break
      case 'api-token':
        setShowAPITokenForm(true)
        break
      case 'scim':
        setShowSCIMForm(true)
        break
    }
  }

  const getHealthStatus = (integration: Integration) => {
    if (integration.health_status === 'healthy') return '🟢'
    if (integration.health_status === 'warning') return '🟡'
    if (integration.health_status === 'error') return '🔴'
    return '⚪'
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2">Integration Management</h1>
            <p className="text-sm text-muted-foreground">
              Configure and manage platform integrations
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => showSMTPForm ? closeAllForms() : openForm('smtp')}
                className={`compact-button-primary ${showSMTPForm ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {showSMTPForm ? 'Cancel' : 'Configure Email (SMTP)'}
              </button>
              <button
                onClick={() => showSSOForm ? closeAllForms() : openForm('sso')}
                className={`compact-button-primary ${showSSOForm ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {showSSOForm ? 'Cancel' : 'Configure SSO'}
              </button>
              <button
                onClick={() => showCreateForm ? closeAllForms() : openForm('create')}
                className={`compact-button-secondary ${showCreateForm ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {showCreateForm ? 'Cancel' : 'Add Integration'}
              </button>
              <button
                onClick={() => showAPITokenForm ? closeAllForms() : openForm('api-token')}
                className={`compact-button-secondary ${showAPITokenForm ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {showAPITokenForm ? 'Cancel' : 'API Tokens'}
              </button>
              <button
                onClick={() => showSCIMForm ? closeAllForms() : openForm('scim')}
                className={`compact-button-secondary ${showSCIMForm ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {showSCIMForm ? 'Cancel' : 'SCIM Config'}
              </button>
            </div>
          )}
        </div>

        {/* SMTP Settings Form */}
        {showSMTPForm && isAdmin && (
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">
              {editingIntegration ? `Edit ${editingIntegration.name}` : 'Email (SMTP) Configuration'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">SMTP Host *</label>
                  <input
                    type="text"
                    value={smtpConfig.smtp_host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                    className="compact-input w-full"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">SMTP Port *</label>
                  <input
                    type="number"
                    value={smtpConfig.smtp_port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) || 587 })}
                    className="compact-input w-full"
                    placeholder="587"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">SMTP Username (Email) *</label>
                <input
                  type="email"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                  className="compact-input w-full"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">SMTP Password *</label>
                <input
                  type="password"
                  value={smtpConfig.smtp_password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                  className="compact-input w-full"
                  placeholder="Enter SMTP password or app password"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For Gmail, use an App Password instead of your regular password
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="smtp_use_tls"
                  checked={smtpConfig.smtp_use_tls}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_use_tls: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="smtp_use_tls" className="text-sm font-medium">
                  Use TLS/SSL
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">From Email *</label>
                  <input
                    type="email"
                    value={smtpConfig.from_email}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                    className="compact-input w-full"
                    placeholder="noreply@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">From Name *</label>
                  <input
                    type="text"
                    value={smtpConfig.from_name}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                    className="compact-input w-full"
                    placeholder="VAKA Platform"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    smtpUpdateMutation.mutate(smtpConfig)
                    if (editingIntegration) {
                      setEditingIntegration(null)
                    }
                  }}
                  disabled={smtpUpdateMutation.isPending || !smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_password}
                  className="compact-button-primary"
                >
                  {smtpUpdateMutation.isPending ? 'Saving...' : editingIntegration ? 'Update SMTP Settings' : 'Save SMTP Settings'}
                </button>
                <button
                  onClick={() => smtpTestMutation.mutate(smtpConfig)}
                  disabled={smtpTestMutation.isPending || !smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_password}
                  className="compact-button-secondary"
                >
                  {smtpTestMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              {smtpTestMutation.isSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                  {smtpTestMutation.data?.message || 'Test email sent successfully!'}
                </div>
              )}
              {smtpTestMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  Test failed: {smtpTestMutation.error?.message || 'Please check your SMTP settings'}
                </div>
              )}
              {smtpSettings?.is_configured && (
                <div className="p-3 bg-blue-50 border border-blue-400 rounded text-sm text-blue-800">
                  ✓ SMTP is currently configured and active
                </div>
              )}
            </div>
          </div>
        )}

        {/* SSO Settings Form */}
        {showSSOForm && isAdmin && (
          <div className="compact-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">SSO Configuration</h2>
              <button
                onClick={() => openHelp(ssoConfig.provider || 'custom')}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                title="View configuration help"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">SSO Provider *</label>
                <select
                  value={ssoConfig.provider}
                  onChange={(e) => {
                    const provider = e.target.value as any
                    setSsoConfig({ 
                      ...ssoConfig, 
                      provider,
                      // Auto-set type based on provider
                      type: (provider === 'google' || provider === 'azure_entra_id') ? 'oidc' : 'saml'
                    })
                  }}
                  className="compact-input w-full"
                >
                  <option value="custom">Custom</option>
                  <option value="azure_entra_id">Azure Entra ID (Azure AD)</option>
                  <option value="google">Google Workspace</option>
                  <option value="okta">OKTA</option>
                  <option value="ping">Ping Identity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">SSO Type *</label>
                <select
                  value={ssoConfig.type}
                  onChange={(e) => setSsoConfig({ ...ssoConfig, type: e.target.value as 'saml' | 'oidc' })}
                  className="compact-input w-full"
                >
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OIDC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Integration Name *</label>
                <input
                  type="text"
                  value={ssoConfig.name}
                  onChange={(e) => setSsoConfig({ ...ssoConfig, name: e.target.value })}
                  className="compact-input w-full"
                  placeholder="e.g., Azure AD SSO"
                />
              </div>
              
              {/* Azure Entra ID specific fields */}
              {ssoConfig.provider === 'azure_entra_id' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Azure Tenant ID</label>
                  <input
                    type="text"
                    value={ssoConfig.azure_tenant_id || ''}
                    onChange={(e) => setSsoConfig({ ...ssoConfig, azure_tenant_id: e.target.value })}
                    className="compact-input w-full"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
              )}

              {/* Google specific fields */}
              {ssoConfig.provider === 'google' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Google Domain</label>
                  <input
                    type="text"
                    value={ssoConfig.google_domain || ''}
                    onChange={(e) => setSsoConfig({ ...ssoConfig, google_domain: e.target.value })}
                    className="compact-input w-full"
                    placeholder="example.com"
                  />
                </div>
              )}
              
              {ssoConfig.type === 'saml' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">SAML Entity ID</label>
                    <input
                      type="text"
                      value={ssoConfig.saml_entity_id || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, saml_entity_id: e.target.value })}
                      className="compact-input w-full"
                      placeholder="urn:example:sp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">SAML SSO URL</label>
                    <input
                      type="url"
                      value={ssoConfig.saml_sso_url || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, saml_sso_url: e.target.value })}
                      className="compact-input w-full"
                      placeholder="https://idp.example.com/sso"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">X.509 Certificate</label>
                    <textarea
                      value={ssoConfig.saml_x509_cert || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, saml_x509_cert: e.target.value })}
                      className="compact-input w-full min-h-[100px] font-mono text-xs"
                      placeholder="-----BEGIN CERTIFICATE-----..."
                    />
                  </div>
                </>
              )}
              
              {ssoConfig.type === 'oidc' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Client ID *</label>
                    <input
                      type="text"
                      value={ssoConfig.oidc_client_id || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, oidc_client_id: e.target.value })}
                      className="compact-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Client Secret *</label>
                    <input
                      type="password"
                      value={ssoConfig.oidc_client_secret || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, oidc_client_secret: e.target.value })}
                      className="compact-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Authorization URL *</label>
                    <input
                      type="url"
                      value={ssoConfig.oidc_authorization_url || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, oidc_authorization_url: e.target.value })}
                      className="compact-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Token URL *</label>
                    <input
                      type="url"
                      value={ssoConfig.oidc_token_url || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, oidc_token_url: e.target.value })}
                      className="compact-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">UserInfo URL</label>
                    <input
                      type="url"
                      value={ssoConfig.oidc_userinfo_url || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, oidc_userinfo_url: e.target.value })}
                      className="compact-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Issuer</label>
                    <input
                      type="text"
                      value={ssoConfig.oidc_issuer || ''}
                      onChange={(e) => setSsoConfig({ ...ssoConfig, oidc_issuer: e.target.value })}
                      className="compact-input w-full"
                    />
                  </div>
                </>
              )}
              
              <div className="border-t pt-4">
                <h3 className="text-md font-medium mb-3">User Sync Configuration</h3>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="sync_enabled"
                    checked={ssoConfig.sync_enabled}
                    onChange={(e) => setSsoConfig({ ...ssoConfig, sync_enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="sync_enabled" className="text-sm font-medium">
                    Enable automatic user sync
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Allowed Fields to Sync</label>
                  <div className="space-y-2">
                    {['email', 'first_name', 'last_name', 'department', 'organization'].map((field) => (
                      <div key={field} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`field_${field}`}
                          checked={ssoConfig.allowed_fields.includes(field)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSsoConfig({
                                ...ssoConfig,
                                allowed_fields: [...ssoConfig.allowed_fields, field]
                              })
                            } else {
                              setSsoConfig({
                                ...ssoConfig,
                                allowed_fields: ssoConfig.allowed_fields.filter(f => f !== field)
                              })
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`field_${field}`} className="text-sm">
                          {field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select which user fields can be synced from SSO for security control
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => ssoUpdateMutation.mutate(ssoConfig)}
                  disabled={ssoUpdateMutation.isPending || !ssoConfig.name}
                  className="compact-button-primary"
                >
                  {ssoUpdateMutation.isPending ? 'Saving...' : 'Save SSO Settings'}
                </button>
                {ssoSettings?.integration_id && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await api.post('/user-sync/sync', {
                          integration_id: ssoSettings.integration_id,
                          sync_type: 'full'
                        })
                        alert(`User sync completed: ${response.data.users_synced} users synced`)
                      } catch (err: any) {
                        alert(`Sync failed: ${err.response?.data?.detail || err.message}`)
                      }
                    }}
                    className="compact-button-secondary"
                  >
                    Sync Users Now
                  </button>
                )}
              </div>
              {ssoSettings?.is_configured && (
                <div className="p-3 bg-blue-50 border border-blue-400 rounded text-sm text-blue-800">
                  ✓ SSO is currently configured and active
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && isAdmin && (
          <div className="compact-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Create Integration</h2>
              <button
                onClick={() => openHelp(integrationType)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                title="View configuration help"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium">Integration Type *</label>
                  <button
                    onClick={() => openHelp(integrationType)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="View configuration help"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <select
                  value={integrationType}
                  onChange={(e) => {
                    setIntegrationType(e.target.value)
                    // Reset configs when type changes
                    setIntegrationName('')
                    setIntegrationConfig('')
                  }}
                  className="compact-input w-full"
                >
                  <option value="servicenow">ServiceNow</option>
                  <option value="jira">Jira</option>
                  <option value="slack">Slack</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="webhook">Webhook</option>
                  <option value="compliance_tool">Compliance Tool</option>
                  <option value="security_tool">Security Tool</option>
                  <option value="smtp">SMTP Email (Use Configure Email button)</option>
                  <option value="sso">SSO (Use Configure SSO button)</option>
                </select>
                {(integrationType === 'smtp' || integrationType === 'sso') && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    ⚠️ {integrationType === 'smtp' ? 'SMTP' : 'SSO'} integrations should be configured using the dedicated buttons above.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                  className="compact-input w-full"
                  placeholder="Integration name"
                />
              </div>
              
              {/* Type-specific configuration fields */}
              {renderIntegrationForm()}
              
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !integrationName || !getRequiredFieldsValid()}
                  className="compact-button-primary"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Integration'}
                </button>
                <button
                  onClick={closeAllForms}
                  className="compact-button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Token Management */}
        {showAPITokenForm && isAdmin && (
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">API Token Management</h2>
            
            {/* Create New Token Form */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
              <h3 className="text-md font-medium mb-3">Create New API Token</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Token Name *</label>
                  <input
                    type="text"
                    value={newToken.name}
                    onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                    className="compact-input w-full"
                    placeholder="e.g., Production API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={newToken.description || ''}
                    onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                    className="compact-input w-full"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Scopes *</label>
                  <div className="space-y-2">
                    {['read:agents', 'write:agents', 'read:users', 'read:analytics'].map((scope) => (
                      <label key={scope} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newToken.scopes.includes(scope)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewToken({ ...newToken, scopes: [...newToken.scopes, scope] })
                            } else {
                              setNewToken({ ...newToken, scopes: newToken.scopes.filter(s => s !== scope) })
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Rate Limit (per minute)</label>
                    <input
                      type="number"
                      value={newToken.rate_limit_per_minute}
                      onChange={(e) => setNewToken({ ...newToken, rate_limit_per_minute: parseInt(e.target.value) || 60 })}
                      className="compact-input w-full"
                      min="1"
                      max="10000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Rate Limit (per hour)</label>
                    <input
                      type="number"
                      value={newToken.rate_limit_per_hour}
                      onChange={(e) => setNewToken({ ...newToken, rate_limit_per_hour: parseInt(e.target.value) || 1000 })}
                      className="compact-input w-full"
                      min="1"
                      max="100000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Rate Limit (per day)</label>
                    <input
                      type="number"
                      value={newToken.rate_limit_per_day}
                      onChange={(e) => setNewToken({ ...newToken, rate_limit_per_day: parseInt(e.target.value) || 10000 })}
                      className="compact-input w-full"
                      min="1"
                      max="1000000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Expires In (days, optional)</label>
                  <input
                    type="number"
                    value={newToken.expires_in_days || ''}
                    onChange={(e) => setNewToken({ ...newToken, expires_in_days: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="compact-input w-full"
                    placeholder="Leave empty for no expiration"
                    min="1"
                    max="365"
                  />
                </div>
                <button
                  onClick={() => createTokenMutation.mutate(newToken)}
                  disabled={createTokenMutation.isPending || !newToken.name || newToken.scopes.length === 0}
                  className="compact-button-primary"
                >
                  {createTokenMutation.isPending ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </div>

            {/* Display Created Token (one-time) */}
            {createdToken && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <h3 className="text-md font-medium mb-2 text-yellow-800 dark:text-yellow-200">
                  ⚠️ Save this token now! You won't be able to see it again.
                </h3>
                <div className="bg-white dark:bg-gray-800 p-3 rounded font-mono text-sm break-all">
                  {createdToken}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdToken)
                    alert('Token copied to clipboard!')
                  }}
                  className="mt-2 compact-button-secondary text-xs"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => setCreatedToken(null)}
                  className="mt-2 ml-2 compact-button-secondary text-xs"
                >
                  Close
                </button>
              </div>
            )}

            {/* Existing Tokens List */}
            <div>
              <h3 className="text-md font-medium mb-3">Existing API Tokens</h3>
              {tokensLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : !apiTokens || apiTokens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No API tokens created yet</div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Prefix</th>
                        <th>Scopes</th>
                        <th>Status</th>
                        <th>Usage</th>
                        <th>Last Used</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiTokens.map((token: APIToken) => (
                        <tr key={token.id}>
                          <td className="font-medium">{token.name}</td>
                          <td className="text-sm font-mono">{token.token_prefix}...</td>
                          <td className="text-sm">
                            <div className="flex flex-wrap gap-1">
                              {token.scopes.slice(0, 2).map((scope) => (
                                <span key={scope} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {scope}
                                </span>
                              ))}
                              {token.scopes.length > 2 && (
                                <span className="text-xs text-muted-foreground">+{token.scopes.length - 2} more</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${
                              token.status === 'active' ? 'status-badge-success' : 'status-badge'
                            }`}>
                              {token.status}
                            </span>
                          </td>
                          <td className="text-sm">{token.request_count} requests</td>
                          <td className="text-sm text-muted-foreground">
                            {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'Never'}
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to revoke this token?')) {
                                  revokeTokenMutation.mutate(token.id)
                                }
                              }}
                              disabled={revokeTokenMutation.isPending || token.status !== 'active'}
                              className="compact-button-secondary text-xs"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCIM Configuration */}
        {showSCIMForm && isAdmin && (
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">SCIM (System for Cross-domain Identity Management) Configuration</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                <h3 className="text-md font-medium mb-2">SCIM Endpoint Information</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Base URL: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">/api/v1/scim/v2</code>
                </p>
                <p className="text-sm text-muted-foreground">
                  SCIM 2.0 endpoints are available for user provisioning from third-party identity providers.
                </p>
              </div>

              {scimConfigData && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                  <h3 className="text-md font-medium mb-2">Current Configuration</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Status:</strong> {scimConfigData.enabled ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Last Sync:</strong> {scimConfigData.last_sync_at ? new Date(scimConfigData.last_sync_at).toLocaleString() : 'Never'}</p>
                    {scimConfigData.sync_status && (
                      <p><strong>Sync Status:</strong> {scimConfigData.sync_status}</p>
                    )}
                    {scimConfigData.last_error && (
                      <p className="text-red-600"><strong>Last Error:</strong> {scimConfigData.last_error}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Bearer Token *</label>
                  <input
                    type="password"
                    value={scimConfig.bearer_token}
                    onChange={(e) => setScimConfig({ ...scimConfig, bearer_token: e.target.value })}
                    className="compact-input w-full"
                    placeholder="Enter bearer token for SCIM authentication"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This token will be used to authenticate SCIM requests from your identity provider
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="scim_enabled"
                    checked={scimConfig.enabled}
                    onChange={(e) => setScimConfig({ ...scimConfig, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="scim_enabled" className="text-sm font-medium">
                    Enable SCIM provisioning
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto_provision"
                    checked={scimConfig.auto_provision_users}
                    onChange={(e) => setScimConfig({ ...scimConfig, auto_provision_users: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="auto_provision" className="text-sm font-medium">
                    Automatically provision new users
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto_update"
                    checked={scimConfig.auto_update_users}
                    onChange={(e) => setScimConfig({ ...scimConfig, auto_update_users: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="auto_update" className="text-sm font-medium">
                    Automatically update existing users
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto_deactivate"
                    checked={scimConfig.auto_deactivate_users}
                    onChange={(e) => setScimConfig({ ...scimConfig, auto_deactivate_users: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="auto_deactivate" className="text-sm font-medium">
                    Automatically deactivate users when removed from identity provider
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Webhook URL (optional)</label>
                  <input
                    type="url"
                    value={scimConfig.webhook_url || ''}
                    onChange={(e) => setScimConfig({ ...scimConfig, webhook_url: e.target.value })}
                    className="compact-input w-full"
                    placeholder="https://example.com/webhook"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL to receive push updates when users are modified
                  </p>
                </div>

                <button
                  onClick={() => scimConfigMutation.mutate(scimConfig)}
                  disabled={scimConfigMutation.isPending || !scimConfig.bearer_token}
                  className="compact-button-primary"
                >
                  {scimConfigMutation.isPending ? 'Saving...' : 'Save SCIM Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Integrations List */}
        <div className="compact-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">All Integrations</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Filter:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="compact-input text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading integrations...</div>
          ) : !integrations || integrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No integrations configured. Click "Add Integration" to create one.
            </div>
          ) : (
            <>
              {/* Active Integrations */}
              {statusFilter === 'all' || statusFilter === 'active' ? (
                <div className="mb-6">
                  <h3 className="text-md font-medium mb-3 text-green-700 dark:text-green-400">
                    Active Integrations ({integrations.filter((i: Integration) => i.status === 'active' && i.is_active).length})
                  </h3>
                  {integrations.filter((i: Integration) => i.status === 'active' && i.is_active).length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">No active integrations</div>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Health</th>
                            <th>Last Sync</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {integrations
                            .filter((i: Integration) => i.status === 'active' && i.is_active)
                            .map((integration: Integration) => (
                              <tr key={integration.id} className="bg-green-50/50 dark:bg-green-900/10">
                                <td className="font-medium">{integration.name}</td>
                                <td className="text-sm text-muted-foreground capitalize">
                                  {integration.integration_type.replace('_', ' ')}
                                </td>
                                <td>
                                  <span className="status-badge status-badge-success">
                                    {integration.status}
                                  </span>
                                </td>
                                <td>
                                  <span className="text-lg">{getHealthStatus(integration)}</span>
                                  {integration.error_count > 0 && (
                                    <span className="text-xs text-red-600 ml-1">
                                      ({integration.error_count} errors)
                                    </span>
                                  )}
                                </td>
                                <td className="text-sm text-muted-foreground">
                                  {integration.last_sync_at
                                    ? new Date(integration.last_sync_at).toLocaleString()
                                    : 'Never'}
                                </td>
                                <td>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEdit(integration)}
                                      className="compact-button-secondary text-xs"
                                      title="Edit integration"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => testMutation.mutate(integration.id)}
                                      disabled={testMutation.isPending}
                                      className="compact-button-secondary text-xs"
                                    >
                                      Test
                                    </button>
                                    <button
                                      onClick={() => deactivateMutation.mutate(integration.id)}
                                      disabled={deactivateMutation.isPending}
                                      className="compact-button-secondary text-xs"
                                    >
                                      Deactivate
                                    </button>
                                    <button
                                      onClick={() => navigate(`/integrations/${integration.id}`)}
                                      className="compact-button-secondary text-xs"
                                    >
                                      View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Inactive Integrations */}
              {statusFilter === 'all' || statusFilter === 'inactive' ? (
                <div>
                  <h3 className="text-md font-medium mb-3 text-gray-600 dark:text-gray-600">
                    Inactive Integrations ({integrations.filter((i: Integration) => i.status !== 'active' || !i.is_active).length})
                  </h3>
                  {integrations.filter((i: Integration) => i.status !== 'active' || !i.is_active).length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">No inactive integrations</div>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Health</th>
                            <th>Last Sync</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {integrations
                            .filter((i: Integration) => i.status !== 'active' || !i.is_active)
                            .map((integration: Integration) => (
                              <tr key={integration.id} className="opacity-75">
                                <td className="font-medium">{integration.name}</td>
                                <td className="text-sm text-muted-foreground capitalize">
                                  {integration.integration_type.replace('_', ' ')}
                                </td>
                                <td>
                                  <span className={`status-badge ${
                                    integration.status === 'inactive' ? 'status-badge' : 'status-badge-error'
                                  }`}>
                                    {integration.status}
                                  </span>
                                </td>
                                <td>
                                  <span className="text-lg">{getHealthStatus(integration)}</span>
                                  {integration.error_count > 0 && (
                                    <span className="text-xs text-red-600 ml-1">
                                      ({integration.error_count} errors)
                                    </span>
                                  )}
                                </td>
                                <td className="text-sm text-muted-foreground">
                                  {integration.last_sync_at
                                    ? new Date(integration.last_sync_at).toLocaleString()
                                    : 'Never'}
                                </td>
                                <td>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEdit(integration)}
                                      className="compact-button-secondary text-xs"
                                      title="Edit integration"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => testMutation.mutate(integration.id)}
                                      disabled={testMutation.isPending}
                                      className="compact-button-secondary text-xs"
                                    >
                                      Test
                                    </button>
                                    <button
                                      onClick={() => activateMutation.mutate(integration.id)}
                                      disabled={activateMutation.isPending}
                                      className="compact-button-primary text-xs"
                                    >
                                      Activate
                                    </button>
                                    <button
                                      onClick={() => navigate(`/integrations/${integration.id}`)}
                                      className="compact-button-secondary text-xs"
                                    >
                                      View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Edit Integration Modal */}
        {editingIntegration && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-medium">Edit Integration</h2>
                <button
                  onClick={() => {
                    setEditingIntegration(null)
                    setEditName('')
                    setEditConfig('')
                    setEditDescription('')
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Integration Type</label>
                    <input
                      type="text"
                      value={editingIntegration.integration_type.replace('_', ' ')}
                      disabled
                      className="compact-input w-full bg-gray-100 dark:bg-gray-700"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Integration type cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Name *</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="compact-input w-full"
                      placeholder="Integration name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="compact-input w-full"
                      rows={2}
                      placeholder="Integration description"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium">Configuration (JSON) *</label>
                      <button
                        onClick={() => openHelp(editingIntegration.integration_type)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                        title="View configuration help"
                      >
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Help
                      </button>
                    </div>
                    <textarea
                      value={editConfig}
                      onChange={(e) => setEditConfig(e.target.value)}
                      className="compact-input w-full min-h-[200px] font-mono text-xs"
                      placeholder='{"api_url": "https://...", "api_key": "..."}'
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter configuration as JSON. Click Help for provider-specific configuration guide.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 p-6">
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setEditingIntegration(null)
                      setEditName('')
                      setEditConfig('')
                      setEditDescription('')
                    }}
                    className="compact-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending || !editName || !editConfig}
                    className="compact-button-primary"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Modal */}
        <IntegrationHelpModal
          provider={helpProvider}
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
        />
      </div>
    </Layout>
  )
}

