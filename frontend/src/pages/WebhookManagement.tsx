import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { webhooksApi, Webhook, WebhookDelivery } from '../lib/webhooks'
import Layout from '../components/Layout'

export default function WebhookManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dialog = useDialogContext()
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
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Webhook Management</h1>
            <p className="text-sm text-gray-600">
              Configure webhooks to receive real-time events
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> Create Webhook
          </button>
        </div>

        {showCreate && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Webhook</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Webhook Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="My Webhook"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Webhook URL</label>
                <input
                  type="url"
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://example.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Events</label>
                <div className="grid grid-cols-2 gap-3">
                  {eventOptions.map(event => (
                    <label key={event} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setNewWebhook({ name: '', url: '', events: [] })
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-600">Loading webhooks...</div>
        ) : webhooks && webhooks.length > 0 ? (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{webhook.name}</h3>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        webhook.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-mono mb-4 break-all">{webhook.url}</p>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 mb-2">Events:</p>
                      <div className="flex flex-wrap gap-2">
                        {webhook.events.map(event => (
                          <span key={event} className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => toggleMutation.mutate({ id: webhook.id, activate: !webhook.is_active })}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {webhook.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => setSelectedWebhook(selectedWebhook === webhook.id ? null : webhook.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {selectedWebhook === webhook.id ? 'Hide' : 'View'} Deliveries
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await dialog.confirm({
                          title: 'Delete Webhook',
                          message: 'Are you sure you want to delete this webhook? This action cannot be undone.',
                          variant: 'destructive'
                        })
                        if (confirmed) {
                          deleteMutation.mutate(webhook.id)
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {selectedWebhook === webhook.id && deliveries && (
                  <div className="mt-5 pt-5 border-t border-gray-200">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Delivery History</h4>
                    {deliveries.length > 0 ? (
                      <div className="space-y-2.5">
                        {deliveries.map(delivery => (
                          <div key={delivery.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                delivery.status === 'success' ? 'bg-green-100 text-green-700' :
                                delivery.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {delivery.status}
                              </span>
                              <span className="text-xs text-gray-600">
                                {new Date(delivery.attempted_at).toLocaleString()}
                              </span>
                            </div>
                            {delivery.response_code && (
                              <span className="text-xs text-gray-600 font-mono">
                                HTTP {delivery.response_code}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No deliveries yet</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm text-center py-12 px-6">
            <p className="text-gray-600 mb-4">No webhooks configured</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Your First Webhook
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

