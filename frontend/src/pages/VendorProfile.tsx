import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { suppliersMasterApi, SupplierMasterView } from '../lib/suppliersMaster'
import { agentsApi } from '../lib/agents'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import {
  Building2, FileText, Shield, AlertTriangle, CheckCircle, XCircle,
  Users, Package, FileCheck, Search, Filter, Download, Eye, ChevronLeft, RefreshCw,
  Calendar, DollarSign, Tag, ExternalLink, File, ClipboardList, BarChart3,
  Clock, Mail, Phone, Globe, MapPin, FileX, CheckCircle2, AlertCircle,
  TrendingUp, Activity, History, Award, Lock
} from 'lucide-react'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'

type TabType = 'overview' | 'assessments' | 'agents' | 'agreements' | 'cves' | 'compliance' | 'reviews' | 'activity'

export default function VendorProfile() {
  const navigate = useNavigate()
  const { vendorId } = useParams<{ vendorId: string }>()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: vendorData, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor-profile', vendorId],
    queryFn: () => suppliersMasterApi.get(vendorId!),
    enabled: !!vendorId && !!user,
  })

  // Extract data with safe defaults (before early returns to satisfy Rules of Hooks)
  const vendor = vendorData?.vendor
  const assessments = vendorData?.assessment_history || []
  const agents = vendorData?.agents || []
  const agreements = vendorData?.agreements || []
  const cves = vendorData?.cves || []
  const complianceIssues = vendorData?.compliance_issues || []
  const investigations = vendorData?.investigations || []

  // Calculate metrics - must be before early returns
  const metrics = useMemo(() => {
    if (!vendor) {
      return {
        totalAssessments: 0,
        completedAssessments: 0,
        pendingAssessments: 0,
        totalArtifacts: 0,
        totalAgents: 0,
        activeAgents: 0,
        totalCVEs: 0,
        criticalCVEs: 0,
        openComplianceIssues: 0,
        complianceScore: 0,
      }
    }

    const totalAssessments = assessments.length
    const completedAssessments = assessments.filter(a => a.status === 'completed').length
    const pendingAssessments = assessments.filter(a => a.status === 'pending' || a.status === 'in_progress').length
    const totalArtifacts = assessments.reduce((sum, a) => sum + (a.artifacts_count || 0), 0)
    const totalAgents = agents.length
    const activeAgents = agents.filter(a => a.status === 'approved').length
    const totalCVEs = cves.length
    const criticalCVEs = cves.filter(c => c.severity === 'critical' || c.severity === 'high').length
    const openComplianceIssues = complianceIssues.filter(c => c.status === 'open' || c.status === 'in_remediation').length

    return {
      totalAssessments,
      completedAssessments,
      pendingAssessments,
      totalArtifacts,
      totalAgents,
      activeAgents,
      totalCVEs,
      criticalCVEs,
      openComplianceIssues,
      complianceScore: vendor.compliance_score || 0,
    }
  }, [assessments, agents, cves, complianceIssues, vendor])

  // Filter data based on search and status - must be before early returns
  const filteredAssessments = useMemo(() => {
    let filtered = assessments
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.name?.toLowerCase().includes(term) ||
        a.type?.toLowerCase().includes(term) ||
        a.workflow_ticket_id?.toLowerCase().includes(term)
      )
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status?.toLowerCase() === statusFilter.toLowerCase())
    }
    return filtered
  }, [assessments, searchTerm, statusFilter])

  const filteredAgents = useMemo(() => {
    let filtered = agents
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.name?.toLowerCase().includes(term) ||
        a.type?.toLowerCase().includes(term)
      )
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status?.toLowerCase() === statusFilter.toLowerCase())
    }
    return filtered
  }, [agents, searchTerm, statusFilter])

  // Early returns AFTER all hooks
  if (!user) {
    return (
      <Layout user={null}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading vendor profile...</div>
        </div>
      </Layout>
    )
  }

  if (error || !vendorData || !vendor) {
    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MaterialCard className="p-6">
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Vendor Not Found</h2>
              <p className="text-gray-600 mb-4">The vendor profile you're looking for doesn't exist or you don't have access.</p>
              <MaterialButton onClick={() => navigate('/my-vendors')}>
                Back to Suppliers
              </MaterialButton>
            </div>
          </MaterialCard>
        </div>
      </Layout>
    )
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'N/A'
    }
  }

  const getStatusBadge = (status: string, type: 'assessment' | 'agent' | 'agreement' | 'cve' | 'compliance') => {
    const baseClasses = 'px-2 py-1 rounded text-xs font-medium'
    switch (type) {
      case 'assessment':
        switch (status?.toLowerCase()) {
          case 'completed':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'in_progress':
            return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>{status}</span>
          case 'pending':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          case 'overdue':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>
        }
      case 'agent':
        switch (status?.toLowerCase()) {
          case 'approved':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'in_review':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          case 'rejected':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>
        }
      case 'agreement':
        switch (status?.toLowerCase()) {
          case 'active':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'expired':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'pending_signature':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>
        }
      case 'cve':
        switch (status?.toLowerCase()) {
          case 'confirmed':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'resolved':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          case 'mitigated':
            return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>
        }
      case 'compliance':
        switch (status?.toLowerCase()) {
          case 'open':
            return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
          case 'in_remediation':
            return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>
          case 'resolved':
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>
          default:
            return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>
        }
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>
    }
  }


  const tabs: Array<{ id: TabType; label: string; count?: number; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'assessments', label: 'Assessments', count: assessments.length, icon: ClipboardList },
    { id: 'agents', label: 'Agents', count: agents.length, icon: Package },
    { id: 'agreements', label: 'Agreements', count: agreements.length, icon: FileText },
    { id: 'cves', label: 'CVEs', count: cves.length, icon: Shield },
    { id: 'compliance', label: 'Compliance', count: complianceIssues.length, icon: CheckCircle },
    { id: 'reviews', label: 'Reviews', icon: FileCheck },
    { id: 'activity', label: 'Activity', icon: History },
  ]

  return (
    <Layout user={user}>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <MaterialButton
                variant="outlined"
                onClick={() => navigate('/my-vendors')}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </MaterialButton>
              <MaterialButton
                variant="outlined"
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </MaterialButton>
            </div>
          </div>

          {/* Vendor Header Card */}
          <MaterialCard className="p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-6">
                {vendor.logo_url ? (
                  <img
                    src={vendor.logo_url}
                    alt={vendor.name}
                    className="w-20 h-20 rounded-lg object-contain border border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                    <Building2 className="w-10 h-10 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">{vendor.name}</h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {vendor.contact_email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {vendor.contact_email}
                      </div>
                    )}
                    {vendor.website && (
                      <div className="flex items-center gap-1">
                        <Globe className="w-4 h-4" />
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {vendor.website}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <MaterialChip label="Active" className="bg-green-100 text-green-800" />
                    {vendor.compliance_score !== null && (
                      <MaterialChip label={`Compliance: ${vendor.compliance_score}%`} className="bg-blue-100 text-blue-800" />
                    )}
                    {vendor.registration_number && (
                      <MaterialChip label={`Reg: ${vendor.registration_number}`} variant="outlined" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </MaterialCard>

          {/* Business Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <MaterialCard className="p-4">
              <div className="text-sm text-gray-600 mb-1">Total Assessments</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.totalAssessments}</div>
              <div className="text-xs text-gray-500 mt-1">{metrics.completedAssessments} completed</div>
            </MaterialCard>
            <MaterialCard className="p-4">
              <div className="text-sm text-gray-600 mb-1">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{metrics.pendingAssessments}</div>
            </MaterialCard>
            <MaterialCard className="p-4">
              <div className="text-sm text-gray-600 mb-1">Artifacts</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.totalArtifacts}</div>
            </MaterialCard>
            <MaterialCard className="p-4">
              <div className="text-sm text-gray-600 mb-1">Agents</div>
              <div className="text-2xl font-bold text-gray-900">{metrics.totalAgents}</div>
              <div className="text-xs text-gray-500 mt-1">{metrics.activeAgents} active</div>
            </MaterialCard>
            <MaterialCard className="p-4">
              <div className="text-sm text-gray-600 mb-1">CVEs</div>
              <div className="text-2xl font-bold text-red-600">{metrics.totalCVEs}</div>
              <div className="text-xs text-gray-500 mt-1">{metrics.criticalCVEs} critical</div>
            </MaterialCard>
            <MaterialCard className="p-4">
              <div className="text-sm text-gray-600 mb-1">Compliance Issues</div>
              <div className="text-2xl font-bold text-orange-600">{metrics.openComplianceIssues}</div>
            </MaterialCard>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Search and Filter */}
        {(activeTab === 'assessments' || activeTab === 'agents') && (
          <div className="mb-6 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              {activeTab === 'assessments' && (
                <>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </>
              )}
              {activeTab === 'agents' && (
                <>
                  <option value="approved">Approved</option>
                  <option value="in_review">In Review</option>
                  <option value="rejected">Rejected</option>
                </>
              )}
            </select>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Vendor Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    {vendor.contact_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.contact_email}</span>
                      </div>
                    )}
                    {vendor.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.contact_phone}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.address}</span>
                      </div>
                    )}
                    {vendor.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {vendor.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                  <p className="text-sm text-gray-600">{vendor.description || 'No description provided'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assessments Tab */}
          {activeTab === 'assessments' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Assessments ({filteredAssessments.length})
                </h2>
              </div>
              {filteredAssessments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No assessments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responses</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artifacts</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAssessments.map((assessment) => (
                        <tr key={assessment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{assessment.name}</div>
                            {assessment.workflow_ticket_id && (
                              <div className="text-xs text-gray-500">{assessment.workflow_ticket_id}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{assessment.type || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(assessment.status || '', 'assessment')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {assessment.schedule ? (
                              <div>
                                <div>{formatDate(assessment.schedule.scheduled_date)}</div>
                                <div className="text-xs text-gray-500">{assessment.schedule.frequency}</div>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {assessment.responses_count || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {assessment.artifacts_count || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(assessment.assigned_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(assessment.completed_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {assessment.assignment_id && (
                              <MaterialButton
                                variant="text"
                                size="small"
                                onClick={() => navigate(`/assessments/assignments/${assessment.assignment_id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </MaterialButton>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Agents/Products ({filteredAgents.length})
                </h2>
              </div>
              {filteredAgents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No agents found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{agent.type || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(agent.status || '', 'agent')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(agent.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <MaterialButton
                              variant="text"
                              size="small"
                              onClick={() => navigate(`/agents/${agent.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </MaterialButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Agreements Tab */}
          {activeTab === 'agreements' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Agreements ({agreements.length})
                </h2>
              </div>
              {agreements.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No agreements found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Effective Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {agreements.map((agreement) => (
                        <tr key={agreement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{agreement.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{agreement.agreement_type || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(agreement.status || '', 'agreement')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(agreement.effective_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(agreement.expiry_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {agreement.pdf_file_path && (
                              <MaterialButton
                                variant="text"
                                size="small"
                                onClick={() => window.open(agreement.pdf_file_path, '_blank')}
                              >
                                <File className="w-4 h-4" />
                              </MaterialButton>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CVEs Tab */}
          {activeTab === 'cves' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Security Vulnerabilities ({cves.length})
                </h2>
              </div>
              {cves.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No CVEs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CVE ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CVSS Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discovered</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cves.map((cve) => (
                        <tr key={cve.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{cve.cve_id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{cve.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              cve.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              cve.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                              cve.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {cve.severity || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {cve.cvss_score || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(cve.status || '', 'cve')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(cve.discovered_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <MaterialButton
                              variant="text"
                              size="small"
                              onClick={() => navigate(`/cve/${cve.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </MaterialButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Compliance Issues ({complianceIssues.length})
                </h2>
              </div>
              {complianceIssues.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No compliance issues found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Framework</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identified</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Resolution</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {complianceIssues.map((issue) => (
                        <tr key={issue.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{issue.title}</div>
                            {issue.description && (
                              <div className="text-xs text-gray-500 mt-1">{issue.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {issue.compliance_framework || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                              issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {issue.severity || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(issue.status || '', 'compliance')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(issue.identified_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(issue.target_resolution_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Assessment Reviews</h2>
              </div>
              {assessments.filter(a => a.reviews && a.reviews.length > 0).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileCheck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No reviews found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assessments.map((assessment) => {
                    if (!assessment.reviews || assessment.reviews.length === 0) return null
                    return (
                      <MaterialCard key={assessment.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{assessment.name}</h3>
                            <p className="text-sm text-gray-600">{assessment.type}</p>
                          </div>
                          {assessment.assignment_id && (
                            <MaterialButton
                              variant="outlined"
                              size="small"
                              onClick={() => navigate(`/assessments/assignments/${assessment.assignment_id}`)}
                            >
                              View Assessment
                            </MaterialButton>
                          )}
                        </div>
                        <div className="space-y-2">
                          {assessment.reviews.map((review) => (
                            <div key={review.id} className="border-l-4 border-blue-500 pl-4 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">{review.review_type}</span>
                                {getStatusBadge(review.status || '', 'assessment')}
                                {review.risk_score !== null && (
                                  <span className="text-xs text-gray-600">
                                    Risk: {review.risk_score} ({review.risk_level})
                                  </span>
                                )}
                              </div>
                              {review.created_at && (
                                <div className="text-xs text-gray-500">
                                  {formatDate(review.created_at)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </MaterialCard>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Activity History</h2>
              </div>
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Activity history will be displayed here</p>
                <p className="text-sm mt-2">This feature is coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
