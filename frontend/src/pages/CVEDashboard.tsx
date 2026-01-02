import { useEffect, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { securityIncidentsApi, SecurityIncident } from '../lib/securityIncidents'
import Layout from '../components/Layout'
import { Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CVEDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({})
  const [filterType, setFilterType] = useState<string>('')
  const [filterSeverity, setFilterSeverity] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Check if CVE tracking feature is enabled
  useEffect(() => {
    if (user?.tenant_id) {
      tenantsApi.getMyTenantFeatures().then((features) => {
        setTenantFeatures(features || {})
        if (!features?.cve_tracking) {
          toast.error('CVE Tracking feature is not enabled for your tenant')
        }
      }).catch(() => {})
    }
  }, [user])

  const { data: incidentsData, isLoading, error } = useQuery({
    queryKey: ['security-incidents', filterType, filterSeverity, filterStatus, page],
    queryFn: () => securityIncidentsApi.list(filterType || undefined, filterSeverity || undefined, filterStatus || undefined, limit, (page - 1) * limit),
    enabled: !!user && tenantFeatures.cve_tracking === true,
    refetchInterval: 60000, // Refresh every 60 seconds
  })

  // Fetch vendor trackings for each incident to show matched vendor counts
  const incidents = incidentsData?.incidents || []
  const incidentIds = incidents.map(i => i.id)
  const { data: trackingsData } = useQuery({
    queryKey: ['incident-trackings-batch', incidentIds.join(',')],
    queryFn: async () => {
      const trackingsMap: Record<string, number> = {}
      await Promise.all(
        incidentIds.map(async (id: string) => {
          try {
            const trackings = await securityIncidentsApi.getIncidentTrackings(id)
            trackingsMap[id] = trackings.length
          } catch {
            trackingsMap[id] = 0
          }
        })
      )
      return trackingsMap
    },
    enabled: incidentIds.length > 0 && !!user && tenantFeatures.cve_tracking === true,
  })

  const scanCVEs = useMutation({
    mutationFn: (daysBack: number) => securityIncidentsApi.scanCVEs(daysBack),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['security-incidents'] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to scan CVEs')
    }
  })

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4" />
      case 'high':
        return <AlertTriangle className="w-4 h-4" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4" />
      case 'low':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <Shield className="w-4 h-4" />
    }
  }

  if (!user) {
    return null
  }

  // Check feature access
  if (tenantFeatures.cve_tracking !== true) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Feature Not Available</div>
          <div className="text-muted-foreground mb-4">
            CVE Tracking is not enabled for your tenant.
          </div>
          <div className="text-sm text-muted-foreground">
            Please contact your administrator to enable this feature.
          </div>
        </div>
      </Layout>
    )
  }

  const total = incidentsData?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1>CVE Tracking & Security Monitoring</h1>
            <p className="text-body text-muted-foreground">
              Monitor and track security vulnerabilities affecting your vendors
            </p>
          </div>
          {['tenant_admin', 'platform_admin'].includes(user?.role) && (
            <button
              onClick={() => scanCVEs.mutate(7)}
              disabled={scanCVEs.isPending}
              className="compact-button-primary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${scanCVEs.isPending ? 'animate-spin' : ''}`} />
              {scanCVEs.isPending ? 'Scanning...' : 'Scan CVEs'}
            </button>
          )}
        </div>

        {/* Stats Cards */}
        {incidentsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="compact-card">
              <div className="text-body text-muted-foreground mb-1">Total Incidents</div>
              <div className="text-heading font-medium">{total}</div>
            </div>
            <div className="compact-card">
              <div className="text-body text-muted-foreground mb-1">Critical</div>
              <div className="text-heading font-medium text-red-600">
                {incidents.filter(i => i.severity === 'critical').length}
              </div>
            </div>
            <div className="compact-card">
              <div className="text-body text-muted-foreground mb-1">High</div>
              <div className="text-heading font-medium text-orange-600">
                {incidents.filter(i => i.severity === 'high').length}
              </div>
            </div>
            <div className="compact-card">
              <div className="text-body text-muted-foreground mb-1">Active</div>
              <div className="text-heading font-medium">
                {incidents.filter(i => i.status === 'active').length}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            className="compact-input"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Types</option>
            <option value="cve">CVE</option>
            <option value="data_breach">Data Breach</option>
            <option value="security_alert">Security Alert</option>
          </select>
          <select
            className="compact-input"
            value={filterSeverity}
            onChange={(e) => {
              setFilterSeverity(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="compact-input"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>
        </div>

        {/* Incidents List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading security incidents...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            Error loading security incidents. Please try again.
          </div>
        ) : incidents.length === 0 ? (
          <div className="compact-card text-center py-12">
            <Shield className="w-12 h-9 mx-auto mb-4 text-muted-foreground" />
            <div className="text-muted-foreground mb-4">
              No security incidents found.
            </div>
            {['tenant_admin', 'platform_admin'].includes(user?.role) && (
              <button
                onClick={() => scanCVEs.mutate(7)}
                disabled={scanCVEs.isPending}
                className="compact-button-primary"
              >
                Scan for CVEs
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {(incidentsData?.incidents || []).map((incident: SecurityIncident) => (
                <div key={incident.id} className="compact-card-elevated hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <RouterLink
                          to={`/cve/${incident.id}`}
                          className="text-subheading font-medium hover:text-primary transition-colors"
                        >
                          {incident.external_id}
                        </RouterLink>
                        {incident.severity && (
                          <span className={`px-2 py-1 rounded badge-text border flex items-center gap-1 ${getSeverityColor(incident.severity)}`}>
                            {getSeverityIcon(incident.severity)}
                            {incident.severity.toUpperCase()}
                          </span>
                        )}
                        <span className={`status-badge ${incident.status === 'active' ? 'status-badge-error' : 'status-badge-success'}`}>
                          {incident.status}
                        </span>
                      </div>
                      <h3 className="text-subheading font-medium mb-2">{incident.title}</h3>
                      {incident.description && (
                        <p className="text-body text-muted-foreground mb-3 line-clamp-2">
                          {incident.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-caption text-muted-foreground">
                        {incident.cvss_score !== null && incident.cvss_score !== undefined && (
                          <span>CVSS: {incident.cvss_score.toFixed(1)}</span>
                        )}
                        {incident.published_date && (
                          <span>Published: {new Date(incident.published_date).toLocaleDateString()}</span>
                        )}
                        <span>Source: {incident.source}</span>
                        {incident.affected_vendors && incident.affected_vendors.length > 0 && (
                          <span className="flex items-center gap-1">
                            <span>Affected Vendors:</span>
                            <span className="font-medium text-blue-600">{incident.affected_vendors.length}</span>
                          </span>
                        )}
                        {trackingsData && trackingsData[incident.id] !== undefined && (
                          <span className="flex items-center gap-1">
                            <span>Matched Vendors:</span>
                            <span className="font-medium text-green-600">{trackingsData[incident.id]}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {incident.source_url && (
                      <a
                        href={incident.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-body"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Source
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="text-caption text-muted-foreground">
                      Created: {new Date(incident.created_at).toLocaleString()}
                    </div>
                    <RouterLink
                      to={`/cve/${incident.id}`}
                      className="text-body text-primary hover:underline"
                    >
                      View Details →
                    </RouterLink>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-body text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} incidents
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="compact-button-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="compact-button-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

