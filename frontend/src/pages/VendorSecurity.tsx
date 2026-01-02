import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { securityIncidentsApi, VendorSecurityTracking } from '../lib/securityIncidents'
import { vendorsApi } from '../lib/vendors'
import Layout from '../components/Layout'
import { Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink, ArrowLeft, Building2 } from 'lucide-react'

export default function VendorSecurity() {
  const navigate = useNavigate()
  const { vendorId } = useParams<{ vendorId: string }>()
  const [user, setUser] = useState<any>(null)
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({})

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  useEffect(() => {
    if (user?.tenant_id) {
      tenantsApi.getMyTenantFeatures().then((features) => {
        setTenantFeatures(features || {})
      }).catch(() => {})
    }
  }, [user])

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list(true),
    enabled: !!user,
  })
  
  const vendor = vendors?.find(v => v.id === vendorId)

  const { data: trackings, isLoading } = useQuery({
    queryKey: ['vendor-trackings', vendorId],
    queryFn: () => securityIncidentsApi.getVendorTrackings(vendorId!),
    enabled: !!vendorId && !!user && tenantFeatures.cve_tracking === true,
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

  if (tenantFeatures.cve_tracking !== true) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Feature Not Available</div>
          <div className="text-muted-foreground">
            CVE Tracking is not enabled for your tenant.
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="text-center py-12 text-muted-foreground">Loading vendor security data...</div>
      </Layout>
    )
  }

  // Fetch incident details for each tracking
  const incidentIds = trackings?.map(t => t.incident_id) || []
  const { data: incidents } = useQuery({
    queryKey: ['incidents-batch', incidentIds],
    queryFn: async () => {
      const incidentsMap: Record<string, any> = {}
      await Promise.all(
        incidentIds.map(async (id: string) => {
          try {
            const incident = await securityIncidentsApi.get(id)
            incidentsMap[id] = incident
          } catch {
            // Ignore errors
          }
        })
      )
      return incidentsMap
    },
    enabled: incidentIds.length > 0,
  })

  const activeTrackings = trackings?.filter(t => t.status === 'active') || []
  const resolvedTrackings = trackings?.filter(t => t.status === 'resolved') || []
  const criticalTrackings = trackings?.filter(t => incidents?.[t.incident_id]?.severity === 'critical') || []

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Link
            to="/cve"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-6 h-6 text-muted-foreground" />
              <h1 className="text-2xl font-medium">{vendor?.name || 'Vendor'} Security</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Security incidents and CVEs affecting this vendor
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {trackings && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="compact-card">
              <div className="text-sm text-muted-foreground mb-1">Total Incidents</div>
              <div className="text-2xl font-medium">{trackings.length}</div>
            </div>
            <div className="compact-card">
              <div className="text-sm text-muted-foreground mb-1">Active</div>
              <div className="text-2xl font-medium text-red-600">{activeTrackings.length}</div>
            </div>
            <div className="compact-card">
              <div className="text-sm text-muted-foreground mb-1">Critical</div>
              <div className="text-2xl font-medium text-red-600">{criticalTrackings.length}</div>
            </div>
            <div className="compact-card">
              <div className="text-sm text-muted-foreground mb-1">Resolved</div>
              <div className="text-2xl font-medium text-green-600">{resolvedTrackings.length}</div>
            </div>
          </div>
        )}

        {/* Security Incidents */}
        {trackings && trackings.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Security Incidents</h2>
            {trackings.map((tracking: VendorSecurityTracking) => {
              const incident = incidents?.[tracking.incident_id]
              if (!incident) return null

              return (
                <div key={tracking.id} className="compact-card-elevated hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          to={`/cve/${incident.id}`}
                          className="text-lg font-medium hover:text-primary transition-colors"
                        >
                          {incident.external_id}
                        </Link>
                        {incident.severity && (
                          <span className={`px-2 py-1 rounded text-xs font-medium border flex items-center gap-1 ${getSeverityColor(incident.severity)}`}>
                            {getSeverityIcon(incident.severity)}
                            {incident.severity.toUpperCase()}
                          </span>
                        )}
                        <span className={`status-badge ${tracking.status === 'active' ? 'status-badge-error' : 'status-badge-success'}`}>
                          {tracking.status}
                        </span>
                      </div>
                      <h3 className="text-base font-medium mb-2">{incident.title}</h3>
                      {incident.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {incident.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-2">
                        {incident.cvss_score !== null && incident.cvss_score !== undefined && (
                          <span>CVSS: {incident.cvss_score.toFixed(1)}</span>
                        )}
                        {incident.published_date && (
                          <span>Published: {new Date(incident.published_date).toLocaleDateString()}</span>
                        )}
                        <span>Match Confidence: <span className="font-medium">{(tracking.match_confidence * 100).toFixed(0)}%</span></span>
                        <span>Match Method: <span className="font-medium">{tracking.match_method.replace('_', ' ')}</span></span>
                        {tracking.risk_level && (
                          <span>Risk Level: <span className={`font-medium ${
                            tracking.risk_level === 'critical' ? 'text-red-600' :
                            tracking.risk_level === 'high' ? 'text-orange-600' :
                            tracking.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                          }`}>{tracking.risk_level.toUpperCase()}</span></span>
                        )}
                      </div>
                      {tracking.resolution_notes && (
                        <div className="text-sm text-muted-foreground p-2 bg-gray-50 rounded mt-2">
                          <span className="font-medium">Resolution:</span> {tracking.resolution_notes}
                        </div>
                      )}
                    </div>
                    {incident.source_url && (
                      <a
                        href={incident.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Source
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      Matched: {new Date(tracking.created_at).toLocaleString()}
                    </div>
                    <Link
                      to={`/cve/${incident.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="compact-card text-center py-12">
            <Shield className="w-12 h-9 mx-auto mb-4 text-muted-foreground" />
            <div className="text-muted-foreground mb-4">
              No security incidents found for this vendor.
            </div>
            <div className="text-sm text-muted-foreground">
              Security incidents will appear here when CVEs are matched to this vendor.
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

