import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { webhooksApi, Webhook, WebhookDelivery } from '../lib/webhooks'
import Layout from '../components/Layout'

export default function WebhookManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null)
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: [] as string[] })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: webhooks, isLoading } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: () => webhooksApi.list(),
  })

  const { data: deliveries } = useQuery<WebhookDelivery[]>({
    queryKey: ['webhook-deliveries', selectedWebhook],
    queryFn: () => webhooksApi.getDeliveries(selectedWebhook!),
    enabled: !!selectedWebhook,
  })

  const createMutation = useMutation({
    mutationFn: () => webhooksApi.create(newWebhook.name, newWebhook.url, newWebhook.events),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      setShowCreate(false)
      setNewWebhook({ name: '', url: '', events: [] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) => {
      return activate ? webhooksApi.activate(id) : webhooksApi.deactivate(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })

  const eventOptions = [
    'agent.created',
    'agent.submitted',
    'agent.approved',
    'agent.rejected',
    'review.completed',
    'compliance.check.completed',
    'approval.completed',
  ]

  const toggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }))
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Webhook Management</h1>
            <p className="text-muted-foreground">
              Configure webhooks to receive real-time events
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="compact-button-primary"
          >
            + Create Webhook
          </button>
        </div>

        {showCreate && (
          <div className="compact-card-elevated">
            <h2 className="text-xl font-medium mb-4">Create New Webhook</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Webhook Name</label>
                <input
                  type="text"
                  className="compact-input"
                  placeholder="My Webhook"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Webhook URL</label>
                <input
                  type="url"
                  className="compact-input"
                  placeholder="https://example.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Events</label>
                <div className="grid grid-cols-2 gap-2">
                  {eventOptions.map(event => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createMutation.mutate()}
                  className="compact-button-primary"
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setNewWebhook({ name: '', url: '', events: [] })
                  }}
                  className="compact-button-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading webhooks...</div>
        ) : webhooks && webhooks.length > 0 ? (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="compact-card-elevated">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium">{webhook.name}</h3>
                      <span className={`status-badge ${webhook.is_active ? 'status-badge-success' : 'status-badge-info'}`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{webhook.url}</p>
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Events:</p>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map(event => (
                          <span key={event} className="status-badge status-badge-info text-xs">
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleMutation.mutate({ id: webhook.id, activate: !webhook.is_active })}
                      className="compact-button-secondary text-xs"
                    >
                      {webhook.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => setSelectedWebhook(selectedWebhook === webhook.id ? null : webhook.id)}
                      className="compact-button-ghost text-xs"
                    >
                      {selectedWebhook === webhook.id ? 'Hide' : 'View'} Deliveries
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this webhook?')) {
                          deleteMutation.mutate(webhook.id)
                        }
                      }}
                      className="compact-button-ghost text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {selectedWebhook === webhook.id && deliveries && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-medium mb-3">Delivery History</h4>
                    {deliveries.length > 0 ? (
                      <div className="space-y-2">
                        {deliveries.map(delivery => (
                          <div key={delivery.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <span className={`status-badge ${
                                delivery.status === 'success' ? 'status-badge-success' :
                                delivery.status === 'failed' ? 'status-badge-error' :
                                'status-badge-warning'
                              }`}>
                                {delivery.status}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {new Date(delivery.attempted_at).toLocaleString()}
                              </span>
                            </div>
                            {delivery.response_code && (
                              <span className="text-xs text-muted-foreground">
                                HTTP {delivery.response_code}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No deliveries yet</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="compact-card text-center py-8">
            <p className="text-muted-foreground mb-4">No webhooks configured</p>
            <button
              onClick={() => setShowCreate(true)}
              className="compact-button-primary"
            >
              Create Your First Webhook
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

