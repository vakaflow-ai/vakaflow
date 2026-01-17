import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { incidentReportsApi, IncidentReport } from '../lib/incidentReports'
import Layout from '../components/Layout'
import { MaterialButton, MaterialChip } from '../components/material'
import { SearchIcon, FilterIcon, ExternalLinkIcon, RefreshCwIcon } from '../components/Icons'
import toast from 'react-hot-toast'

export default function IncidentReports() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('')
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [pushStatusFilter, setPushStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data, isLoading, error } = useQuery({
    queryKey: ['incident-reports', page, entityTypeFilter, incidentTypeFilter, severityFilter, pushStatusFilter],
    queryFn: () => incidentReportsApi.list(
      entityTypeFilter || undefined,
      undefined,
      incidentTypeFilter || undefined,
      severityFilter || undefined,
      pushStatusFilter || undefined,
      page,
      20
    ),
    enabled: !!user
  })

  const pushMutation = useMutation({
    mutationFn: ({ incidentId, externalSystem }: { incidentId: string; externalSystem: string }) =>
      incidentReportsApi.push(incidentId, externalSystem),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['incident-reports'] })
      if (result.success) {
        toast.success(`Incident pushed to ${variables.externalSystem} successfully`)
      } else {
        toast.error(result.error || 'Failed to push incident')
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to push incident')
    }
  })

  if (!user) {
    return <div>Loading...</div>
  }

  if (id) {
    return <IncidentDetail incidentId={id} user={user} />
  }

  const incidents = data?.incidents || []
  const filteredIncidents = incidents.filter(incident => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      incident.title.toLowerCase().includes(query) ||
      incident.description?.toLowerCase().includes(query) ||
      incident.entity_type.toLowerCase().includes(query)
    )
  })

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Incident Reports</h1>
            <p className="text-sm text-gray-500 mt-1">View and manage incidents pushed to external systems</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search incidents..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Types</option>
                <option value="agent">Agent</option>
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type</label>
              <select
                value={incidentTypeFilter}
                onChange={(e) => setIncidentTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Types</option>
                <option value="cve_tracking">CVE Tracking</option>
                <option value="qualification_failure">Qualification Failure</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Push Status</label>
              <select
                value={pushStatusFilter}
                onChange={(e) => setPushStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="pushed">Pushed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Incidents List */}
        {isLoading ? (
          <div className="text-center py-12">Loading incidents...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">Error loading incidents</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No incidents found</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Push Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">External Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/incident-reports/${incident.id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{incident.title}</div>
                      <div className="text-sm text-gray-500">{incident.description?.substring(0, 50)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <MaterialChip
                        label={incident.incident_type.replace('_', ' ')}
                        size="small"
                        className="bg-blue-100 text-blue-800"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {incident.entity_type} ({incident.entity_id.substring(0, 8)}...)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {incident.severity && (
                        <MaterialChip
                          label={incident.severity}
                          size="small"
                          className={
                            incident.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            incident.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                            incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <MaterialChip
                        label={incident.push_status}
                        size="small"
                        className={
                          incident.push_status === 'pushed' ? 'bg-green-100 text-green-800' :
                          incident.push_status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {incident.external_ticket_url ? (
                        <a
                          href={incident.external_ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {incident.external_ticket_id}
                          <ExternalLinkIcon className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                      {incident.push_status === 'pending' && (
                        <div className="flex gap-2">
                          <MaterialButton
                            size="small"
                            variant="outlined"
                            onClick={() => pushMutation.mutate({ incidentId: incident.id, externalSystem: 'servicenow' })}
                          >
                            Push to ServiceNow
                          </MaterialButton>
                          <MaterialButton
                            size="small"
                            variant="outlined"
                            onClick={() => pushMutation.mutate({ incidentId: incident.id, externalSystem: 'jira' })}
                          >
                            Push to Jira
                          </MaterialButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total} incidents
            </div>
            <div className="flex gap-2">
              <MaterialButton
                variant="outlined"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </MaterialButton>
              <MaterialButton
                variant="outlined"
                disabled={page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </MaterialButton>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

function IncidentDetail({ incidentId, user }: { incidentId: string; user: any }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident-report', incidentId],
    queryFn: () => incidentReportsApi.get(incidentId),
    enabled: !!incidentId
  })

  const pushMutation = useMutation({
    mutationFn: (externalSystem: string) => incidentReportsApi.push(incidentId, externalSystem),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['incident-report', incidentId] })
      if (result.success) {
        toast.success(`Incident pushed to ${externalSystem} successfully`)
      } else {
        toast.error(result.error || 'Failed to push incident')
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to push incident')
    }
  })

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">Loading incident...</div>
      </Layout>
    )
  }

  if (!incident) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto px-4 py-6">Incident not found</div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <MaterialButton
          variant="text"
          onClick={() => navigate('/incident-reports')}
          className="mb-4"
        >
          ← Back to Incidents
        </MaterialButton>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">{incident.title}</h1>
              <div className="flex items-center gap-2">
                <MaterialChip
                  label={incident.incident_type.replace('_', ' ')}
                  className="bg-blue-100 text-blue-800"
                />
                {incident.severity && (
                  <MaterialChip
                    label={incident.severity}
                    className={
                      incident.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      incident.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }
                  />
                )}
                <MaterialChip
                  label={incident.push_status}
                  className={
                    incident.push_status === 'pushed' ? 'bg-green-100 text-green-800' :
                    incident.push_status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }
                />
              </div>
            </div>
            {incident.push_status === 'pending' && (
              <div className="flex gap-2">
                <MaterialButton
                  variant="outlined"
                  onClick={() => pushMutation.mutate('servicenow')}
                  disabled={pushMutation.isPending}
                >
                  Push to ServiceNow
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  onClick={() => pushMutation.mutate('jira')}
                  disabled={pushMutation.isPending}
                >
                  Push to Jira
                </MaterialButton>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {incident.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                <p className="text-gray-900">{incident.description}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">Entity</h3>
              <p className="text-gray-900">
                {incident.entity_type} ({incident.entity_id})
              </p>
            </div>
            {incident.external_ticket_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">External Ticket</h3>
                <a
                  href={incident.external_ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {incident.external_ticket_id}
                  <ExternalLinkIcon className="w-4 h-4" />
                </a>
              </div>
            )}
            {incident.incident_data && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Incident Data</h3>
                <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-auto">
                  {JSON.stringify(incident.incident_data, null, 2)}
                </pre>
              </div>
            )}
            {incident.push_error && (
              <div>
                <h3 className="text-sm font-medium text-red-700 mb-1">Push Error</h3>
                <p className="text-red-600">{incident.push_error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
