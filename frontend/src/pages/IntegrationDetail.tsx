import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi, Integration } from '../lib/integrations'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import IntegrationHelpModal from '../components/IntegrationHelpModal'
import api from '../lib/api'

export default function IntegrationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editConfigString, setEditConfigString] = useState('')
  const [editConfigError, setEditConfigError] = useState<string | null>(null)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: integration, isLoading, error } = useQuery({
    queryKey: ['integration', id],
    queryFn: () => integrationsApi.get(id!),
    enabled: !!id && !!user
  })

  const { data: config } = useQuery({
    queryKey: ['integration-config', id],
    queryFn: () => integrationsApi.getConfig(id!),
    enabled: !!id && !!user
  })

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; config?: any }) => integrationsApi.update(id!, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', id] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setEditModalOpen(false)
      setEditConfigError(null)
    },
    onError: (err: any) => {
      setEditConfigError(err.response?.data?.detail || 'Failed to update integration')
    }
  })

  const testMutation = useMutation({
    mutationFn: () => integrationsApi.test(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', id] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      alert('Integration test successful!')
    },
    onError: (err: any) => {
      alert(`Integration test failed: ${err.response?.data?.detail || err.message}`)
    }
  })

  const activateMutation = useMutation({
    mutationFn: () => integrationsApi.activate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', id] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: () => integrationsApi.deactivate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration', id] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    }
  })

  const openEditModal = () => {
    if (integration) {
      setEditName(integration.name)
      setEditDescription(integration.description || '')
      setEditConfigString(JSON.stringify(config || {}, null, 2))
      setEditConfigError(null)
      setEditModalOpen(true)
    }
  }

  const handleUpdate = () => {
    try {
      const parsedConfig = JSON.parse(editConfigString)
      setEditConfigError(null)
      updateMutation.mutate({
        name: editName,
        description: editDescription || undefined,
        config: parsedConfig
      })
    } catch (e) {
      setEditConfigError('Invalid JSON configuration')
    }
  }

  const getHealthStatus = (integration: Integration) => {
    if (integration.health_status === 'healthy') return '🟢 Healthy'
    if (integration.health_status === 'warning') return '🟡 Warning'
    if (integration.health_status === 'error') return '🔴 Error'
    return '⚪ Unknown'
  }

  const isAdmin = user && ['tenant_admin', 'platform_admin'].includes(user.role)

  if (isLoading || !user) {
    return (
      <Layout user={user}>
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-12">Loading...</div>
        </div>
      </Layout>
    )
  }

  if (error || !integration) {
    return (
      <Layout user={user}>
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error ? 'Failed to load integration' : 'Integration not found'}
            </p>
            <button
              onClick={() => navigate('/integrations')}
              className="compact-button-secondary"
            >
              Back to Integrations
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/integrations')}
              className="text-muted-foreground hover:text-foreground mb-4"
            >
              ← Back to Integrations
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-medium">{integration.name}</h1>
              <button
                onClick={() => setHelpModalOpen(true)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                title="View configuration help"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-muted-foreground capitalize mt-1">
              {integration.integration_type.replace('_', ' ')}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="compact-button-secondary"
              >
                {testMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={openEditModal}
                className="compact-button-secondary"
              >
                Edit
              </button>
              {integration.status === 'active' && integration.is_active ? (
                <button
                  onClick={() => deactivateMutation.mutate()}
                  disabled={deactivateMutation.isPending}
                  className="compact-button-secondary"
                >
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
                </button>
              ) : (
                <button
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                  className="compact-button-primary"
                >
                  {activateMutation.isPending ? 'Activating...' : 'Activate'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="compact-card">
            <div className="text-sm text-muted-foreground mb-1">Status</div>
            <div className="text-lg font-medium capitalize">{integration.status}</div>
            <span className={`status-badge ${
              integration.status === 'active' ? 'status-badge-success' :
              integration.status === 'inactive' ? 'status-badge' :
              'status-badge-error'
            }`}>
              {integration.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="compact-card">
            <div className="text-sm text-muted-foreground mb-1">Health</div>
            <div className="text-lg font-medium">{getHealthStatus(integration)}</div>
            {integration.error_count > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {integration.error_count} error(s)
              </div>
            )}
          </div>
          <div className="compact-card">
            <div className="text-sm text-muted-foreground mb-1">Last Sync</div>
            <div className="text-sm">
              {integration.last_sync_at
                ? new Date(integration.last_sync_at).toLocaleString()
                : 'Never'}
            </div>
          </div>
        </div>

        {/* Description */}
        {integration.description && (
          <div className="compact-card">
            <h2 className="unified-card-title mb-2">Description</h2>
            <p className="text-muted-foreground">{integration.description}</p>
          </div>
        )}

        {/* Configuration */}
        <div className="compact-card">
          <h2 className="unified-section-title mb-4">Configuration</h2>
          {config ? (
            <div className="bg-muted p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-muted-foreground">No configuration available</p>
          )}
        </div>

        {/* Error Details */}
        {integration.last_error && (
          <div className="compact-card border-red-200 dark:border-red-800">
            <h2 className="unified-card-title mb-2 text-red-600 dark:text-red-400">Last Error</h2>
            <p className="text-sm text-red-600 dark:text-red-400">{integration.last_error}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="compact-card">
          <h2 className="unified-section-title mb-4">Metadata</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Created</div>
              <div>{new Date(integration.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last Updated</div>
              <div>{new Date(integration.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl p-6">
              <h2 className="text-xl font-medium mb-4">Edit Integration: {integration.name}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Integration Type</label>
                  <input
                    type="text"
                    value={integration.integration_type.replace('_', ' ')}
                    className="compact-input w-full bg-muted"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="compact-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="compact-input w-full min-h-[80px]"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium">Configuration (JSON) *</label>
                    <button
                      onClick={() => setHelpModalOpen(true)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View configuration help"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    value={editConfigString}
                    onChange={(e) => setEditConfigString(e.target.value)}
                    className="compact-input w-full min-h-[150px] font-mono text-xs"
                    placeholder='{"api_url": "https://...", "api_key": "..."}'
                  />
                  {editConfigError && (
                    <p className="text-red-500 text-sm mt-1">{editConfigError}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setEditModalOpen(false)}
                    className="compact-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending || !editName || !!editConfigError}
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
          provider={integration.integration_type}
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
        />
      </div>
    </Layout>
  )
}

