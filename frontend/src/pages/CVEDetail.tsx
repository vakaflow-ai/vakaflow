import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { tenantsApi } from '../lib/tenants'
import { securityIncidentsApi, VendorSecurityTracking, IncidentActionHistory } from '../lib/securityIncidents'
import Layout from '../components/Layout'
import { Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink, ArrowLeft, RefreshCw, Eye, EyeOff, Ban, History, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CVEDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [tenantFeatures, setTenantFeatures] = useState<Record<string, boolean>>({})
  const [showRiskForm, setShowRiskForm] = useState<string | null>(null)
  const [showResolveForm, setShowResolveForm] = useState<string | null>(null)
  const [riskAssessment, setRiskAssessment] = useState({ risk_level: 'medium', notes: '' })
  const [resolution, setResolution] = useState({ resolution_type: 'resolved', notes: '' })
  const [showActionDialog, setShowActionDialog] = useState<string | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [showHistory, setShowHistory] = useState(false)

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

  const { data: incident, isLoading, error } = useQuery({
    queryKey: ['security-incident', id],
    queryFn: () => securityIncidentsApi.get(id!),
    enabled: !!id && !!user && tenantFeatures.cve_tracking === true,
  })

  const updateRisk = useMutation({
    mutationFn: ({ trackingId, data }: { trackingId: string; data: any }) =>
      securityIncidentsApi.updateTrackingRisk(trackingId, data),
    onSuccess: () => {
      toast.success('Risk assessment updated')
      queryClient.invalidateQueries({ queryKey: ['security-incident', id] })
      setShowRiskForm(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to update risk assessment')
    }
  })

  const resolveTracking = useMutation({
    mutationFn: ({ trackingId, data }: { trackingId: string; data: any }) =>
      securityIncidentsApi.resolveTracking(trackingId, data),
    onSuccess: () => {
      toast.success('Tracking resolved')
      queryClient.invalidateQueries({ queryKey: ['security-incident', id] })
      queryClient.invalidateQueries({ queryKey: ['incident-trackings', id] })
      setShowResolveForm(null)
      setResolution({ resolution_type: 'resolved', notes: '' })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to resolve tracking')
    }
  })

  const performAction = useMutation({
    mutationFn: (action: { action: string; notes?: string }) =>
      securityIncidentsApi.performAction(id!, action),
    onSuccess: () => {
      toast.success('Action performed successfully')
      queryClient.invalidateQueries({ queryKey: ['security-incident', id] })
      queryClient.invalidateQueries({ queryKey: ['incident-history', id] })
      setShowActionDialog(null)
      setActionNotes('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to perform action')
    }
  })

  const { data: actionHistory } = useQuery({
    queryKey: ['incident-history', id],
    queryFn: () => securityIncidentsApi.getActionHistory(id!),
    enabled: !!id && showHistory,
  })

  const { data: vendorTrackings, isLoading: trackingsLoading } = useQuery({
    queryKey: ['incident-trackings', id],
    queryFn: () => securityIncidentsApi.getIncidentTrackings(id!),
    enabled: !!id && !!user && tenantFeatures.cve_tracking === true,
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
        <div className="text-center py-12 text-muted-foreground">Loading incident details...</div>
      </Layout>
    )
  }

  if (error || !incident) {
    return (
      <Layout user={user}>
        <div className="text-center py-12 text-red-500">
          Error loading incident details. Please try again.
        </div>
      </Layout>
    )
  }

  // Get vendor trackings for this incident (would need to fetch separately)
  // For now, we'll show the incident details

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
              <h1 className="text-2xl font-medium">{incident.external_id}</h1>
              {incident.severity && (
                <span className={`px-3 py-1 rounded text-sm font-medium border flex items-center gap-2 ${getSeverityColor(incident.severity)}`}>
                  {incident.severity === 'critical' && <XCircle className="w-4 h-4" />}
                  {incident.severity === 'high' && <AlertTriangle className="w-4 h-4" />}
                  {incident.severity === 'medium' && <AlertTriangle className="w-4 h-4" />}
                  {incident.severity === 'low' && <CheckCircle className="w-4 h-4" />}
                  {incident.severity.toUpperCase()}
                </span>
              )}
              <span className={`status-badge ${incident.status === 'active' ? 'status-badge-error' : 'status-badge-success'}`}>
                {incident.status}
              </span>
            </div>
            <p className="text-muted-foreground">{incident.title}</p>
          </div>
          {incident.source_url && (
            <a
              href={incident.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="compact-button-secondary flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Source
            </a>
          )}
        </div>

        {/* Incident Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Details */}
          <div className="space-y-4">
            <div className="compact-card">
              <h2 className="text-lg font-medium mb-4">Incident Details</h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Type</div>
                  <div className="font-medium capitalize">{incident.incident_type.replace('_', ' ')}</div>
                </div>
                {incident.description && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Description</div>
                    <div className="text-sm">{incident.description}</div>
                  </div>
                )}
                {incident.cvss_score !== null && incident.cvss_score !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">CVSS Score</div>
                    <div className="font-medium">{incident.cvss_score.toFixed(1)}</div>
                    {incident.cvss_vector && (
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        {incident.cvss_vector}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Source</div>
                  <div className="font-medium">{incident.source}</div>
                </div>
                {incident.published_date && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Published Date</div>
                    <div className="font-medium">
                      {new Date(incident.published_date).toLocaleString()}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Created</div>
                  <div className="font-medium">
                    {new Date(incident.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Affected Products/Vendors - Always show this section prominently */}
            <div className="compact-card">
              <h2 className="text-lg font-medium mb-4">Affected Entities</h2>
              
              {/* Vendors Section */}
              {incident.affected_vendors && incident.affected_vendors.length > 0 ? (
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Affected Vendors</div>
                  <div className="flex flex-wrap gap-2">
                    {incident.affected_vendors.map((vendor, idx) => (
                      <span key={idx} className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-800 border border-blue-400 text-sm font-medium">
                        {vendor}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Affected Vendors</div>
                  <div className="text-sm text-muted-foreground italic">No vendor information available</div>
                </div>
              )}
              
              {/* Detailed Product Information - Show with vendor, product, version prominently */}
              {incident.incident_metadata?.product_details && incident.incident_metadata.product_details.length > 0 ? (
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-3">Affected Products & Versions</div>
                  <div className="space-y-3">
                    {incident.incident_metadata.product_details.map((product: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Vendor */}
                            {product.vendor && (
                              <div className="mb-1">
                                <span className="text-xs font-medium text-gray-500 tracking-tight">Vendor:</span>
                                <span className="ml-2 text-sm font-medium text-gray-900">{product.vendor}</span>
                              </div>
                            )}
                            {/* Product */}
                            <div className="mb-1">
                              <span className="text-xs font-medium text-gray-500 tracking-tight">Application:</span>
                              <span className="ml-2 text-sm font-medium text-gray-900">{product.product}</span>
                            </div>
                            {/* Version */}
                            {product.version && (
                              <div className="mb-1">
                                <span className="text-xs font-medium text-gray-500 tracking-tight">Version:</span>
                                <span className="ml-2 text-sm font-medium text-orange-600">{product.version}</span>
                              </div>
                            )}
                            {/* Version Range */}
                            {product.version_range && (product.version_range.start || product.version_range.end) && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <span className="text-xs font-medium text-gray-500 tracking-tight">Version Range:</span>
                                <span className="ml-2 text-xs text-gray-700">
                                  {product.version_range.start || 'any'} → {product.version_range.end || 'any'}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Vulnerability Status Badge */}
                          <div className="ml-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              product.vulnerable 
                                ? 'bg-red-100 text-red-800 border border-red-200' 
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {product.vulnerable ? 'Vulnerable' : 'Not Vulnerable'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Affected Products & Versions</div>
                  {/* Fallback to simple product list */}
                  {incident.affected_products && incident.affected_products.length > 0 ? (
                    <div className="space-y-2">
                      {incident.affected_products.map((product, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded border text-sm">
                          <span className="text-xs font-medium text-gray-500 tracking-tight">Application:</span>
                          <span className="ml-2 font-medium">{product}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No product information available</div>
                  )}
                </div>
              )}
            </div>

            {/* Solutions & Workarounds */}
            {(incident.incident_metadata?.solutions || incident.incident_metadata?.workarounds || incident.incident_metadata?.remediation_info) && (
              <div className="compact-card">
                <h2 className="text-lg font-medium mb-4">Solutions & Remediation</h2>
                
                {/* Solutions */}
                {incident.incident_metadata?.solutions && incident.incident_metadata.solutions.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Solutions ({incident.incident_metadata.solutions.length})
                    </div>
                    <div className="space-y-3">
                      {incident.incident_metadata.solutions.map((solution: any, idx: number) => (
                        <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded">
                          <div className="text-sm mb-1">
                            {solution.text}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-green-700 mt-2">
                            {solution.organization && (
                              <span>Source: {solution.organization}</span>
                            )}
                            {solution.last_modified && (
                              <span>Updated: {new Date(solution.last_modified).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Workarounds */}
                {incident.incident_metadata?.workarounds && incident.incident_metadata.workarounds.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Workarounds ({incident.incident_metadata.workarounds.length})
                    </div>
                    <div className="space-y-3">
                      {incident.incident_metadata.workarounds.map((workaround: any, idx: number) => (
                        <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="text-sm mb-1">
                            {workaround.text}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-yellow-700 mt-2">
                            {workaround.organization && (
                              <span>Source: {workaround.organization}</span>
                            )}
                            {workaround.last_modified && (
                              <span>Updated: {new Date(workaround.last_modified).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Remediation Info */}
                {incident.incident_metadata?.remediation_info && (
                  <div className="mb-4">
                    {incident.incident_metadata.remediation_info.recommended_version && (
                      <div className="p-3 bg-blue-50 border border-blue-400 rounded">
                        <div className="text-sm font-medium text-blue-800 mb-1">Recommended Version</div>
                        <div className="text-sm text-blue-600">
                          Update to version {incident.incident_metadata.remediation_info.recommended_version}
                        </div>
                      </div>
                    )}
                    {incident.incident_metadata.remediation_info.vendor_comment && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded mt-2">
                        <div className="text-sm font-medium mb-1">Vendor Comment</div>
                        <div className="text-sm text-muted-foreground">
                          {incident.incident_metadata.remediation_info.vendor_comment.text}
                        </div>
                        {incident.incident_metadata.remediation_info.vendor_comment.organization && (
                          <div className="text-xs text-muted-foreground mt-2">
                            - {incident.incident_metadata.remediation_info.vendor_comment.organization}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Patch and Advisory URLs */}
                {(incident.incident_metadata?.patch_urls || incident.incident_metadata?.advisory_urls) && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm font-medium mb-2">Related Links</div>
                    <div className="space-y-2">
                      {incident.incident_metadata?.patch_urls && incident.incident_metadata.patch_urls.map((patch: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <a
                            href={patch.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Patch/Fix Information
                          </a>
                        </div>
                      ))}
                      {incident.incident_metadata?.advisory_urls && incident.incident_metadata.advisory_urls.map((advisory: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <a
                            href={advisory.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Security Advisory
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vendor Trackings */}
          <div className="compact-card">
            <h2 className="text-lg font-medium mb-4">Matched Vendors</h2>
            {trackingsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading vendor trackings...</div>
            ) : vendorTrackings && vendorTrackings.length > 0 ? (
              <div className="space-y-4">
                {vendorTrackings.map((tracking: VendorSecurityTracking) => (
                  <div key={tracking.id} className="p-4 border rounded-lg bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{tracking.vendor_name || 'Unknown Vendor'}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tracking.status === 'active' 
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {tracking.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                          <span>
                            Match: <span className="font-medium text-foreground">{tracking.match_method.replace('_', ' ')}</span>
                          </span>
                          <span>
                            Confidence: <span className="font-medium text-foreground">{(tracking.match_confidence * 100).toFixed(0)}%</span>
                          </span>
                          {tracking.risk_level && (
                            <span>
                              Risk: <span className={`font-medium ${
                                tracking.risk_level === 'critical' ? 'text-red-600' :
                                tracking.risk_level === 'high' ? 'text-orange-600' :
                                tracking.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                              }`}>{tracking.risk_level.toUpperCase()}</span>
                            </span>
                          )}
                        </div>
                        {tracking.match_details && (
                          <div className="text-xs text-muted-foreground mb-2">
                            Matched: {tracking.match_details.matched_name || tracking.match_details.matched_product || 'N/A'}
                          </div>
                        )}
                        {tracking.resolution_notes && (
                          <div className="text-sm text-muted-foreground mt-2 p-2 bg-gray-50 rounded">
                            <span className="font-medium">Resolution:</span> {tracking.resolution_notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t">
                      {tracking.risk_qualification_status === 'pending' && (
                        <button
                          onClick={() => setShowRiskForm(tracking.id)}
                          className="compact-button-secondary text-sm"
                        >
                          Qualify Risk
                        </button>
                      )}
                      {tracking.status === 'active' && (
                        <button
                          onClick={() => setShowResolveForm(tracking.id)}
                          className="compact-button-secondary text-sm"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-12 h-9 mx-auto mb-3 opacity-50" />
                <div className="text-sm">
                  No vendors matched to this incident yet.
                </div>
                <div className="text-xs mt-2">
                  Vendors will be automatically matched when they are found in the CVE data.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk Qualification Dialog */}
      {showRiskForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-medium mb-4">Qualify Risk</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Risk Level *</label>
                <select
                  className="compact-input w-full"
                  value={riskAssessment.risk_level}
                  onChange={(e) => setRiskAssessment({ ...riskAssessment, risk_level: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Assessment Notes</label>
                <textarea
                  className="compact-input w-full"
                  rows={6}
                  value={riskAssessment.notes}
                  onChange={(e) => setRiskAssessment({ ...riskAssessment, notes: e.target.value })}
                  placeholder="Describe the risk assessment, impact analysis, and recommended actions..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  updateRisk.mutate({
                    trackingId: showRiskForm,
                    data: {
                      risk_level: riskAssessment.risk_level,
                      risk_assessment: {
                        notes: riskAssessment.notes,
                        assessed_at: new Date().toISOString(),
                        assessed_by: user?.id
                      }
                    }
                  })
                }}
                disabled={updateRisk.isPending}
                className="compact-button-primary"
              >
                {updateRisk.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowRiskForm(null)
                  setRiskAssessment({ risk_level: 'medium', notes: '' })
                }}
                disabled={updateRisk.isPending}
                className="compact-button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Dialog */}
      {showResolveForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-medium mb-4">Resolve Tracking</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Resolution Type *</label>
                <select
                  className="compact-input w-full"
                  value={resolution.resolution_type}
                  onChange={(e) => setResolution({ ...resolution, resolution_type: e.target.value })}
                >
                  <option value="resolved">Resolved</option>
                  <option value="false_positive">False Positive</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Resolution Notes</label>
                <textarea
                  className="compact-input w-full"
                  rows={6}
                  value={resolution.notes}
                  onChange={(e) => setResolution({ ...resolution, notes: e.target.value })}
                  placeholder="Describe how this was resolved, actions taken, or why it's a false positive..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  resolveTracking.mutate({
                    trackingId: showResolveForm,
                    data: {
                      resolution_type: resolution.resolution_type,
                      resolution_notes: resolution.notes
                    }
                  })
                }}
                disabled={resolveTracking.isPending}
                className="compact-button-primary"
              >
                {resolveTracking.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowResolveForm(null)
                  setResolution({ resolution_type: 'resolved', notes: '' })
                }}
                disabled={resolveTracking.isPending}
                className="compact-button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

