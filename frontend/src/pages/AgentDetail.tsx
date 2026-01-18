import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from '../lib/agents'
import { reviewsApi, Review } from '../lib/reviews'
import { complianceApi } from '../lib/compliance'
import { authApi } from '../lib/auth'
import { recommendationsApi, Recommendation } from '../lib/recommendations'
import { predictiveApi, Prediction } from '../lib/predictive'
import { submissionRequirementsApi, RequirementResponse } from '../lib/submissionRequirements'
import { agentConnectionsApi, AgentConnection } from '../lib/agentConnections'
import { workflowConfigApi } from '../lib/workflowConfig'
import { approvalsApi } from '../lib/approvals'
import Layout from '../components/Layout'
import FileUpload from '../components/FileUpload'
import ProgressIndicator from '../components/ProgressIndicator'
import CommentsSection from '../components/CommentsSection'
import AgentDetailsView from '../components/AgentDetailsView'
import ConnectionDiagram from '../components/ConnectionDiagram'
import MermaidDiagram from '../components/MermaidDiagram'
import { showToast } from '../utils/toast'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { ChevronLeftIcon, CheckCircleIcon, XCircleIcon, ClockIcon, MessageSquareIcon, ShieldCheckIcon, ClipboardIcon, Share2Icon, SparklesIcon, FileTextIcon, RefreshCwIcon, ChartBarIcon } from '../components/Icons'

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'compliance' | 'artifacts' | 'comments' | 'recommendations' | 'predictions' | 'requirements' | 'connections'>('compliance')

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agent, isLoading, error: agentError } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id,
    retry: false
  })

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => reviewsApi.list(id!),
    enabled: !!id && !!agent, // Only fetch reviews if agent exists
    retry: false
  })

  const { data: complianceData } = useQuery({
    queryKey: ['compliance', id],
    queryFn: () => complianceApi.getChecks(id!),
    enabled: !!id
  })

  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', id],
    queryFn: () => recommendationsApi.getSimilar(id!),
    enabled: !!id && activeTab === 'recommendations'
  })

  const { data: prediction } = useQuery<Prediction>({
    queryKey: ['prediction', id],
    queryFn: () => predictiveApi.predictSuccess(id!),
    enabled: !!id && activeTab === 'predictions'
  })

  const { data: requirementResponses } = useQuery<RequirementResponse[]>({
    queryKey: ['requirement-responses', id],
    queryFn: () => submissionRequirementsApi.getResponses(id!),
    enabled: !!id && activeTab === 'requirements'
  })

  const { data: connections } = useQuery<AgentConnection[]>({
    queryKey: ['agent-connections', id],
    queryFn: () => agentConnectionsApi.list(id!),
    enabled: !!id
  })

  // Get workflow status for vendors
  const { data: onboardingRequest } = useQuery({
    queryKey: ['onboarding-request', id],
    queryFn: () => workflowConfigApi.getOnboardingRequestByAgent(id!),
    enabled: !!id && !!user && (user.role === 'vendor_user' || user.role === 'tenant_admin' || user.role === 'platform_admin'),
    retry: false
  })

  // Check if there's a pending approval for approvers
  const isApprover = user?.role === 'approver' || user?.role === 'tenant_admin' || user?.role === 'platform_admin'
  const { data: approval, isLoading: approvalLoading, error: approvalError } = useQuery({
    queryKey: ['approval', id],
    queryFn: () => approvalsApi.getAgentApproval(id!),
    enabled: !!id && !!isApprover,
    retry: false
  })

  // Get onboarding request for approvers too (to check workflow status)
  const { data: onboardingRequestForApprover } = useQuery({
    queryKey: ['onboarding-request-approver', id],
    queryFn: () => workflowConfigApi.getOnboardingRequestByAgent(id!),
    enabled: !!id && !!isApprover,
    retry: false
  })

  // Determine if approval button should be shown
  const showApprovalButton = isApprover && 
    !approvalLoading && 
    (approval || (onboardingRequestForApprover && (onboardingRequestForApprover.status === 'in_review' || onboardingRequestForApprover.status === 'pending')))

  // Generate diagram from connections if diagram is not available
  // Layout: Left to Right with agent in center, sources on left, destinations on right
  const generateDiagramFromConnections = (agentName: string, conns: AgentConnection[]): string => {
    // Helper function to get icon for entity
    const getEntityIcon = (entityName: string): string => {
      if (!entityName) return '🔗'
      const nameLower = entityName.toLowerCase()
      
      // User-related
      if (['user', 'person', 'people', 'human'].some(word => nameLower.includes(word))) {
        return '👤'
      }
      // SAP
      if (nameLower.includes('sap')) {
        return '📊'
      }
      // Lenel (Access Control)
      if (nameLower.includes('lenel')) {
        return '🔑'
      }
      // PACS (Picture Archiving and Communication System)
      if (nameLower.includes('pacs')) {
        return '🏥'
      }
      // Firewall/Security
      if (['firewall', 'fw', 'security', 'guard'].some(word => nameLower.includes(word))) {
        return '🛡️'
      }
      // SSO/Authentication
      if (['sso', 'single sign', 'auth', 'authentication', 'login'].some(word => nameLower.includes(word))) {
        return '🔐'
      }
      // Database
      if (['database', 'db', 'sql', 'oracle', 'mysql', 'postgres'].some(word => nameLower.includes(word))) {
        return '🗄️'
      }
      // Cloud
      if (['cloud', 'aws', 'azure', 'gcp', 's3'].some(word => nameLower.includes(word))) {
        return '☁️'
      }
      // Email/Messaging
      if (['email', 'mail', 'smtp', 'outlook', 'exchange'].some(word => nameLower.includes(word))) {
        return '📧'
      }
      // API/Gateway
      if (['api', 'gateway', 'rest', 'graphql'].some(word => nameLower.includes(word))) {
        return '🔌'
      }
      // File/Storage
      if (['file', 'storage', 's3', 'bucket', 'share'].some(word => nameLower.includes(word))) {
        return '📁'
      }
      // Network
      if (['network', 'vpn', 'router', 'switch'].some(word => nameLower.includes(word))) {
        return '🌐'
      }
      // Monitoring/Logging
      if (['monitor', 'log', 'splunk', 'elk', 'grafana'].some(word => nameLower.includes(word))) {
        return '📈'
      }
      // Default system icon
      return '💻'
    }
    
    // Helper function to sanitize node IDs
    const sanitizeNodeId = (name: string): string => {
      if (!name) return 'UNKNOWN'
      return name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toUpperCase() || 'UNKNOWN'
    }
    
    // Helper function to escape labels
    const escapeLabel = (text: string): string => {
      if (!text) return ''
      return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    
    if (!conns || conns.length === 0) {
      return 'graph LR\n    AGENT["🤖 Agent(No connections)"]'
    }

    const agentId = sanitizeNodeId(agentName)
    // Label agent as "Agent(agentname)" to make it clear, with robot icon
    const agentLabel = `🤖 Agent(${agentName})`
    const lines = [`graph LR`, `    ${agentId}["${escapeLabel(agentLabel)}"]`]
    const sourceNodes = new Map<string, string>() // Left side (sources)
    const destNodes = new Map<string, string>() // Right side (destinations)
    const edges: string[] = []

    conns.forEach((conn) => {
      const entityName = conn.destination_system || conn.app_name || conn.name || 'Unknown'
      const source = conn.source_system || 'Agent'
      const direction = conn.data_flow_direction || 'bidirectional'
      const connName = conn.name || ''

      const sourceId = source.toLowerCase() === 'agent' || source === agentName
        ? agentId
        : sanitizeNodeId(source)
      
      const entityId = sanitizeNodeId(entityName)

      // Add source nodes (left side)
      if (sourceId !== agentId && !sourceNodes.has(source)) {
        sourceNodes.set(source, sourceId)
      }

      // Add destination nodes (right side)
      if (entityId !== agentId && !destNodes.has(entityName)) {
        destNodes.set(entityName, entityId)
      }

      const escapedLabel = connName ? escapeLabel(connName) : ''
      const label = escapedLabel ? `|"${escapedLabel}"|` : ''
      
      // In LR layout: left (source) -> center (agent) -> right (destination)
      if (direction === 'bidirectional') {
        edges.push(`    ${sourceId} <-->${label} ${entityId}`)
      } else if (direction === 'inbound') {
        // Source -> Agent (left to center)
        edges.push(`    ${sourceId} -->${label} ${entityId}`)
      } else {
        // Agent -> Destination (center to right)
        edges.push(`    ${sourceId} -->${label} ${entityId}`)
      }
    })

    // Add source nodes first (left side) with icons
    sourceNodes.forEach((nodeId, nodeName) => {
      const icon = getEntityIcon(nodeName)
      const label = `${icon} ${nodeName}`
      lines.push(`    ${nodeId}["${escapeLabel(label)}"]`)
    })

    // Add destination nodes (right side) with icons
    destNodes.forEach((nodeId, nodeName) => {
      const icon = getEntityIcon(nodeName)
      const label = `${icon} ${nodeName}`
      lines.push(`    ${nodeId}["${escapeLabel(label)}"]`)
    })

    lines.push(...edges)
    return lines.join('\n')
  }

  const runComplianceCheck = useMutation({
    mutationFn: () => complianceApi.checkAgent(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', id] })
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
    }
  })

  const submitAgent = useMutation({
    mutationFn: () => agentsApi.submit(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-request', id] })
      
      // Show detailed success message with workflow information
      let message = 'Agent submitted successfully!'
      if (data.onboarding_request_id) {
        message += ` Workflow Request ID: ${data.onboarding_request_id}`
        if (data.workflow_status) {
          message += ` | Status: ${data.workflow_status}`
        }
        if (data.workflow_current_step !== null && data.workflow_current_step !== undefined) {
          message += ` | Step: ${data.workflow_current_step}`
        }
        showToast.success(message)
      } else {
        showToast.warning('Agent submitted successfully! Note: No workflow request was created. Please check workflow configuration for your tenant.')
      }
    },
    onError: (error: any) => {
      const errorDetail = error?.response?.data?.detail || error.message || 'Unknown error'
      showToast.error(`Failed to submit agent: ${errorDetail}`)
      console.error('Submit agent error:', error)
    }
  })

  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  // Handle 404 or agent not found
  if (agentError || !agent) {
    const is404 = agentError && (agentError as any)?.response?.status === 404
    return (
      <Layout user={user}>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-medium mb-2">Agent Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {is404 
              ? `The agent with ID "${id}" could not be found. It may have been deleted or the ID is incorrect.`
              : 'Unable to load agent details. Please try again later.'}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/agents')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              View All Agents
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            >
              Go Back
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      in_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Layout user={user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header - Material Design */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {agent.vendor_logo_url ? (
              <MaterialCard elevation={1} className="w-20 h-20 flex-shrink-0 p-2 border-none bg-white">
                <img
                  src={agent.vendor_logo_url}
                  alt={agent.vendor_name || 'Vendor logo'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </MaterialCard>
            ) : (
              <div className="w-20 h-20 rounded-lg bg-surface-variant/20 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🤖</span>
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => navigate(-1)}
                  startIcon={<ChevronLeftIcon className="w-4 h-4" />}
                  className="!px-0 text-gray-500 hover:text-gray-900"
                >
                  Back
                </MaterialButton>
                <h1 className="text-3xl font-semibold text-gray-900 leading-tight">{agent.name}</h1>
                <MaterialChip
                  label={agent.status.replace('_', ' ')}
                  color={
                    agent.status === 'approved' ? 'success' :
                    agent.status === 'rejected' ? 'error' :
                    agent.status === 'in_review' ? 'warning' : 'default'
                  }
                  variant="filled"
                  size="small"
                  className="capitalize font-bold shadow-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 font-medium">
                <span className="flex items-center gap-1.5"><MaterialChip label={agent.type} size="small" variant="outlined" className="h-5" /></span>
                <span>Version {agent.version}</span>
                {agent.vendor_name && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    By <span className="text-blue-600 font-medium">{agent.vendor_name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            {agent.status === 'draft' && (
              <MaterialButton
                onClick={() => submitAgent.mutate()}
                disabled={submitAgent.isPending}
                className="shadow-md-elevation-4 h-11 px-6 flex-1 md:flex-none"
                startIcon={submitAgent.isPending ? <div className="loading-spinner w-4 h-4" /> : <CheckCircleIcon className="w-5 h-5" />}
              >
                {submitAgent.isPending ? 'Submitting...' : 'Submit for Review'}
              </MaterialButton>
            )}
            {showApprovalButton && (
              <MaterialButton
                onClick={() => navigate(`/approvals/${id}`)}
                className="bg-green-600 hover:bg-green-700 text-white shadow-md-elevation-4 h-11 px-6 flex-1 md:flex-none"
                startIcon={<CheckCircleIcon className="w-5 h-5" />}
              >
                Review & Approve
              </MaterialButton>
            )}
          </div>
        </div>

        {/* Workflow Status Card - For Vendors */}
        {agent.status !== 'draft' && (onboardingRequest || agent.onboarding_request_id) && (
          <MaterialCard elevation={1} className="bg-primary-50/30 border-primary-100/50 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-primary-100 flex items-center justify-center text-blue-600">
                  <ClockIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary-900 tracking-tight">Workflow Status</h3>
                  <div className="text-xs text-primary-700 font-mono mt-0.5">
                    Request #{onboardingRequest?.request_number || onboardingRequest?.id || agent.onboarding_request_id || 'N/A'}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-primary-400 mb-1">Status</span>
                  <MaterialChip 
                    label={(onboardingRequest?.status || agent.workflow_status || 'pending').replace('_', ' ')}
                    color={
                      (onboardingRequest?.status || agent.workflow_status) === 'approved' ? 'success' :
                      (onboardingRequest?.status || agent.workflow_status) === 'rejected' ? 'error' :
                      'primary'
                    }
                    variant="filled"
                    size="small"
                    className="capitalize font-bold"
                  />
                </div>
                
                {(onboardingRequest?.current_step || agent.workflow_current_step) && (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-primary-400 mb-1">Current Step</span>
                    <span className="text-sm font-bold text-primary-900">Step {onboardingRequest?.current_step || agent.workflow_current_step}</span>
                  </div>
                )}
                
                {onboardingRequest?.assigned_to && (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-primary-400 mb-1">Assigned To</span>
                    <span className="text-sm font-medium text-primary-800">{onboardingRequest.assigned_to_email || onboardingRequest.assigned_to}</span>
                  </div>
                )}
              </div>
            </div>
            
            {(onboardingRequest?.approval_notes || onboardingRequest?.rejection_reason) && (
              <div className={`mt-4 p-3 rounded-lg text-sm border ${
                onboardingRequest.rejection_reason ? 'bg-error-50 text-error-800 border-error-100' : 'bg-success-50 text-success-800 border-success-100'
              }`}>
                <span className="font-bold mr-2">{onboardingRequest.rejection_reason ? 'Rejection Reason:' : 'Approval Notes:'}</span>
                {onboardingRequest.rejection_reason || onboardingRequest.approval_notes}
              </div>
            )}
          </MaterialCard>
        )}

        <ProgressIndicator agent={agent} />

        {/* Compliance Score Section - Prominent Material Card */}
        <MaterialCard elevation={2} className="overflow-hidden border-none relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
          <div className="p-8 flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-10 rounded-lg bg-primary-50 flex items-center justify-center shadow-sm">
                  <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 leading-tight">Compliance & Policy Alignment</h2>
                  <p className="text-gray-500 font-medium">Auto-evaluated against organization standards</p>
                </div>
              </div>
              
              {agent.compliance_score !== null ? (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700 tracking-tight mb-1">Trust Score</div>
                      <div className="text-5xl font-bold text-primary-700 tabular-nums">
                        {agent.compliance_score}<span className="text-2xl text-gray-500 font-bold ml-1">/100</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold tracking-tight ${
                        (agent.compliance_score ?? 0) >= 80 ? 'text-green-600' :
                        (agent.compliance_score ?? 0) >= 60 ? 'text-warning-600' : 'text-red-600'
                      }`}>
                        {(agent.compliance_score ?? 0) >= 80 ? 'High Confidence' :
                         (agent.compliance_score ?? 0) >= 60 ? 'Moderate Risk' : 'High Risk'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="progress-bar-modern h-4 bg-gray-100 border border-gray-50 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 shadow-md ${
                        (agent.compliance_score ?? 0) >= 80 ? 'bg-success-500' :
                        (agent.compliance_score ?? 0) >= 60 ? 'bg-warning-500' : 'bg-error-500'
                      }`}
                      style={{ width: `${agent.compliance_score ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                  <p className="text-gray-500 font-medium italic">No compliance checks have been performed for this agent yet.</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-3">
                <MaterialButton
                  onClick={() => setActiveTab('compliance')}
                  className="shadow-md-elevation-2 h-10 px-5"
                  startIcon={<ClipboardIcon className="w-4 h-4" />}
                >
                  View Details
                </MaterialButton>
                <MaterialButton
                  variant="outlined"
                  onClick={() => runComplianceCheck.mutate()}
                  disabled={runComplianceCheck.isPending}
                  className="h-10 px-5 border-outline/10 text-gray-700 bg-white"
                  startIcon={runComplianceCheck.isPending ? <div className="loading-spinner w-4 h-4" /> : <RefreshCwIcon className="w-4 h-4" />}
                >
                  {runComplianceCheck.isPending ? 'Running...' : 'Run New Check'}
                </MaterialButton>
                <MaterialButton
                  variant="text"
                  onClick={() => navigate('/admin/policies')}
                  className="h-10 px-5 text-gray-500 font-medium text-sm tracking-tight"
                >
                  Policy Explorer
                </MaterialButton>
              </div>
            </div>
            
            {agent.compliance_score !== null && (
              <div className="w-48 h-48 relative flex-shrink-0 hidden sm:flex items-center justify-center">
                <svg className="w-40 h-48 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="96"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-50"
                  />
                  <circle
                    cx="80"
                    cy="96"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 70}`}
                    strokeDashoffset={`${2 * Math.PI * 70 * (1 - (agent.compliance_score ?? 0) / 100)}`}
                    strokeLinecap="round"
                    className={`transition-all duration-1000 ${
                      (agent.compliance_score ?? 0) >= 80 ? 'text-success-500' :
                      (agent.compliance_score ?? 0) >= 60 ? 'text-warning-500' : 'text-error-500'
                    }`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col pt-4">
                  <span className="text-4xl font-semibold text-gray-900">{agent.compliance_score ?? 0}</span>
                  <span className="text-xs font-medium text-gray-700 tracking-tight mt-1">Compliance</span>
                </div>
              </div>
            )}
          </div>
        </MaterialCard>

        {/* Tabs - Material Design */}
        <MaterialCard elevation={1} className="p-0 overflow-hidden border-none">
          <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-50 bg-white">
            {[
              { id: 'compliance', label: 'Compliance', icon: <ShieldCheckIcon className="w-4 h-4" /> },
              { id: 'requirements', label: 'Requirements', icon: <ClipboardIcon className="w-4 h-4" /> },
              { id: 'connections', label: 'Architecture', icon: <Share2Icon className="w-4 h-4" /> },
              { id: 'overview', label: 'Overview', icon: <FileTextIcon className="w-4 h-4" /> },
              { id: 'reviews', label: 'Reviews', icon: <CheckCircleIcon className="w-4 h-4" /> },
              { id: 'recommendations', label: 'Recommendations', icon: <SparklesIcon className="w-4 h-4" /> },
              { id: 'predictions', label: 'Analytics', icon: <ChartBarIcon className="w-4 h-4" /> },
              { id: 'comments', label: 'Communications', icon: <MessageSquareIcon className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2 text-sm font-medium whitespace-nowrap transition-all border-b-2 relative ${
                  activeTab === tab.id
                    ? 'text-primary-700 border-primary-600 bg-primary-50/30'
                    : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 shadow-md" />}
              </button>
            ))}
          </div>

          <div className="p-8 bg-background min-h-[400px]">
            {/* Tab contents wrapped in Material Design layouts */}
            {activeTab === 'overview' && (
              <div className="animate-in fade-in duration-300">
                <AgentDetailsView 
                  agent={agent} 
                  showAllSections={true}
                  onDiagramUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['agent', id] })
                  }}
                  canEditDiagram={false}
                />
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {['security', 'compliance', 'technical', 'business'].map((stage) => {
                    const stageReview = reviewsData?.reviews.find((r: Review) => r.stage === stage)
                      return (
                      <MaterialCard 
                        key={stage} 
                        elevation={0}
                        className={`p-5 flex flex-col items-center text-center gap-3 border-none transition-all ${
                          stageReview?.status === 'approved' ? 'bg-success-50/50 ring-1 ring-success-100' :
                          stageReview?.status === 'rejected' ? 'bg-error-50/50 ring-1 ring-error-100' :
                          stageReview?.status === 'needs_revision' ? 'bg-warning-50/50 ring-1 ring-warning-100' :
                          'bg-blue-100/80 ring-1 ring-gray-100'
                        }`}
                      >
                        <div className="text-xs font-medium text-gray-700 tracking-tight">{stage}</div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          stageReview?.status === 'approved' ? 'bg-success-100 text-green-600' :
                          stageReview?.status === 'rejected' ? 'bg-error-100 text-red-600' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {stageReview?.status === 'approved' ? <CheckCircleIcon className="w-6 h-6" /> : 
                           stageReview?.status === 'rejected' ? <XCircleIcon className="w-6 h-6" /> : 
                           <ClockIcon className="w-6 h-6" />}
                        </div>
                        <div className={`text-sm font-bold capitalize ${
                          stageReview?.status === 'approved' ? 'text-success-700' :
                          stageReview?.status === 'rejected' ? 'text-error-700' :
                          'text-gray-500'
                        }`}>
                          {stageReview ? stageReview.status : 'Pending'}
                        </div>
                      </MaterialCard>
                    )
                  })}
                </div>

                {reviewsData?.reviews.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                    <MessageSquareIcon className="w-12 h-9 text-gray-200 mx-auto mb-4" />
                    <div className="text-gray-600 font-medium italic">No review reports have been submitted for this agent yet.</div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {['security', 'compliance', 'technical', 'business'].map((stage) => {
                      const stageReviews = reviewsData?.reviews.filter((r: Review) => r.stage === stage)
                      const latestReview = stageReviews[stageReviews.length - 1]
                      if (!latestReview) return null
                      
                      return (
                        <MaterialCard key={stage} elevation={1} className="overflow-hidden border-none">
                          <div className="flex items-center justify-between p-5 bg-surface-variant/10 border-b border-gray-50">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-bold capitalize text-gray-900">{stage} Assessment Report</h3>
                              <MaterialChip 
                                label={latestReview.status} 
                                color={latestReview.status === 'approved' ? 'success' : 'error'} 
                                size="small" 
                                variant="filled" 
                                className="font-medium text-xs"
                              />
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              Report Generated: {new Date(latestReview.created_at).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="p-6 space-y-6">
                            {latestReview.comment && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700 tracking-tight">Executive Summary</div>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">{latestReview.comment}</p>
                              </div>
                            )}
                            
                            {latestReview.findings && latestReview.findings.length > 0 && (
                              <div className="space-y-3">
                                <div className="text-sm font-bold text-error-400 tracking-tight">Critical Findings & Gaps</div>
                                <div className="space-y-2">
                                  {latestReview.findings.map((finding: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-error-50 rounded-md border border-error-100/50">
                                      <div className="w-1.5 h-1.5 rounded-full bg-error-500 mt-1.5 flex-shrink-0" />
                                      <span className="text-sm text-error-900 font-medium">{finding}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </MaterialCard>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'compliance' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {complianceData?.checks.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                    <ShieldCheckIcon className="w-12 h-9 text-gray-200 mx-auto mb-4" />
                    <div className="text-gray-600 font-medium mb-6 italic">No automated compliance checks have been performed.</div>
                    <MaterialButton
                      onClick={() => runComplianceCheck.mutate()}
                      disabled={runComplianceCheck.isPending}
                      className="shadow-md-elevation-4"
                    >
                      Initialize Security Scan
                    </MaterialButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {complianceData?.checks.map((check: any) => {
                      const evalResults = check.evaluation_results || {}
                      const overallScore = evalResults.overall_score || 0
                      const status = check.status?.toLowerCase() || 'unknown'
                      
                      return (
                        <MaterialCard key={check.id} elevation={1} className="border-none overflow-hidden group">
                          <div className={`h-1.5 w-full ${
                            status === 'pass' ? 'bg-success-500' :
                            status === 'fail' ? 'bg-error-500' : 'bg-warning-500'
                          }`} />
                          
                          <div className="p-6">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-xl font-semibold text-gray-900">{check.policy_name}</h3>
                                  <MaterialChip 
                                    label={status} 
                                    color={status === 'pass' ? 'success' : status === 'fail' ? 'error' : 'warning'} 
                                    size="small" 
                                    variant="filled"
                                    className="font-medium text-xs"
                                  />
                                  {evalResults.can_be_cleared && (
                                    <MaterialChip label="✓ CLEARED" color="success" size="small" variant="outlined" className="font-medium text-xs" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-2xl">{check.policy_description}</p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {check.policy_category && <MaterialChip label={check.policy_category} size="small" variant="outlined" className="text-xs tracking-tight font-medium text-gray-700" />}
                                  {check.policy_type && <MaterialChip label={check.policy_type} size="small" variant="outlined" className="text-xs tracking-tight font-medium text-gray-700" />}
                                  {check.policy_region && <MaterialChip label={check.policy_region} size="small" variant="outlined" className="text-xs tracking-tight font-medium text-gray-700" />}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2">
                                <div className="text-xs font-medium text-gray-700 tracking-tight">Policy Score</div>
                                <div className={`text-4xl font-bold ${
                                  status === 'pass' ? 'text-green-600' :
                                  status === 'fail' ? 'text-red-600' : 'text-warning-600'
                                }`}>
                                  {(overallScore * 100).toFixed(0)}%
                                </div>
                                <div className="text-xs text-gray-600 font-medium italic">
                                  Last scan: {new Date(check.checked_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Left Column: Requirements & Evidence */}
                              <div className="space-y-6">
                                {check.policy_requirements?.length > 0 && (
                                  <div className="bg-blue-100/80 rounded-lg p-5 ring-1 ring-gray-100">
                                    <div className="text-xs font-medium text-gray-700 tracking-tight mb-4">Mandatory Requirements</div>
                                    <ul className="space-y-3">
                                      {check.policy_requirements.map((req: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5" />
                                          {req}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {check.gap_description && (
                                  <div className="bg-error-50 rounded-lg p-5 ring-1 ring-error-100">
                                    <div className="text-xs font-bold text-error-400 tracking-tight mb-3">Compliance Gap Identified</div>
                                    <p className="text-sm text-error-900 font-bold leading-relaxed">{check.gap_description}</p>
                                    {check.severity && (
                                      <div className="mt-3">
                                        <MaterialChip label={`Severity: ${check.severity}`} color="error" size="small" variant="filled" className="font-medium text-xs" />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right Column: Evaluation Controls */}
                              <div className="space-y-6">
                                {evalResults.controls_evaluated?.length > 0 && (
                                  <div className="bg-blue-50/30 rounded-lg p-5 ring-1 ring-blue-100/50">
                                    <div className="text-xs font-bold text-primary-400 tracking-tight mb-4">Internal Controls Audit</div>
                                    <div className="space-y-3">
                                      {evalResults.controls_evaluated.map((ctrl: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-md shadow-sm border border-blue-50">
                                          <span className="text-sm font-medium text-gray-800">{ctrl.control}</span>
                                          <div className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                            ctrl.status === 'pass' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'
                                          }`}>
                                            {ctrl.status}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {check.confidence_score !== null && (
                                  <div className="px-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-gray-700 tracking-tight">Model Confidence</span>
                                      <span className="text-sm font-bold text-blue-600">{(check.confidence_score * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="progress-bar-modern h-2 bg-gray-100 border border-gray-50">
                                      <div className="progress-fill-modern bg-primary-500" style={{ width: `${check.confidence_score * 100}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </MaterialCard>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Other tabs follow similar Material Design principles */}
            {activeTab === 'requirements' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <MaterialCard elevation={0} className="bg-primary-50/50 border-primary-100/50 p-6 rounded-lg">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-blue-600">
                      <ClipboardIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-primary-900">Mandatory Organizational Requirements</h3>
                  </div>
                  <p className="text-sm text-primary-700/80 font-medium ml-14">
                    All vendors must satisfy these core requirements to maintain platform access.
                  </p>
                </MaterialCard>

                {requirementResponses && requirementResponses.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {requirementResponses.map((response) => (
                      <MaterialCard key={response.id} elevation={1} className="border-none p-6 group hover:bg-primary-50/10 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{response.requirement_label}</h3>
                            <div className="text-xs text-gray-600 font-medium">
                              Submission Date: {new Date(response.submitted_at).toLocaleDateString()}
                            </div>
                          </div>
                          
                          {response.file_name ? (
                            <MaterialButton
                              variant="outlined"
                              size="small"
                              onClick={() => window.open(response.file_path, '_blank')}
                              startIcon={<span className="text-lg">📎</span>}
                              className="border-outline/10 text-gray-600 bg-white shadow-sm"
                            >
                              {response.file_name}
                            </MaterialButton>
                          ) : (
                            <div className="text-sm font-bold text-green-600 bg-success-50 px-3 py-1 rounded-full border border-success-100">
                              Completed
                            </div>
                          )}
                        </div>
                        
                        {!response.file_name && response.value && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 font-medium whitespace-pre-wrap leading-relaxed">
                            {typeof response.value === 'object' 
                              ? JSON.stringify(response.value, null, 2)
                              : String(response.value)}
                          </div>
                        )}
                      </MaterialCard>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                    <div className="text-gray-600 font-medium italic">No requirement responses found.</div>
                  </div>
                )}
              </div>
            )}

            {/* Final fallback or more tabs can be added here with same styling */}
            {activeTab === 'connections' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <MaterialCard elevation={1} className="border-none overflow-hidden">
                  <div className="p-6 border-b border-gray-50 bg-surface-variant/10">
                    <h2 className="text-lg font-semibold text-gray-900">Architectural Topography</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1 tracking-tight">Network Topology & Data Flow</p>
                  </div>
                  <div className="p-8 bg-white overflow-x-auto flex justify-center">
                    {agent.architecture_info?.connection_diagram ? (
                      <div className="min-w-[600px] p-4 rounded-lg ring-1 ring-gray-100">
                        <MermaidDiagram diagram={agent.architecture_info.connection_diagram} />
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-600 font-medium italic">Architecture diagram not available for this version.</div>
                    )}
                  </div>
                </MaterialCard>

                <div className="space-y-4">
                  <div className="text-xs font-medium text-gray-700 tracking-tight px-2">Registered Connection Nodes</div>
                  {connections && connections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {connections.map((conn) => (
                        <MaterialCard key={conn.id} elevation={1} className="border-none p-5 group">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-xl shadow-sm group-hover:bg-primary-100 group-hover:text-blue-600 transition-all">
                                {conn.destination_system?.toLowerCase().includes('sap') ? '📊' : 
                                 conn.destination_system?.toLowerCase().includes('db') ? '🗄️' : 
                                 conn.protocol?.toLowerCase().includes('http') ? '🔌' : '🌐'}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{conn.destination_system || conn.app_name}</h3>
                                <div className="text-xs font-medium text-gray-700 tracking-tight">{conn.connection_type || 'Integration'}</div>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {conn.is_active && <MaterialChip label="ACTIVE" color="success" size="small" variant="filled" className="text-xs font-bold h-5" />}
                              {conn.is_encrypted && <MaterialChip label="SSL" color="primary" size="small" variant="filled" className="text-xs font-bold h-5" />}
                            </div>
                          </div>
                          
                          <div className="space-y-3 pt-3 border-t border-gray-50">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 font-bold tracking-tight">Protocol</span>
                              <span className="font-mono text-blue-600 font-bold">{conn.protocol?.toUpperCase() || 'TCP/IP'}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 font-bold tracking-tight">Direction</span>
                              <span className="capitalize font-medium text-gray-700">{conn.data_flow_direction}</span>
                            </div>
                            {conn.data_classification && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 font-bold tracking-tight">Classification</span>
                                <span className="px-2 py-0.5 bg-warning-50 text-warning-700 rounded-lg font-medium text-xs">{conn.data_classification}</span>
                              </div>
                            )}
                          </div>
                        </MaterialCard>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-blue-100/80 rounded-lg border border-dashed border-gray-200">
                      <div className="text-gray-600 font-medium italic">No connection nodes registered.</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="animate-in fade-in duration-300">
                <MaterialCard elevation={0} className="bg-blue-100/80 border-blue-300/50 p-6 rounded-lg mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                      <MessageSquareIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900 leading-tight">Collaborative Intelligence</h3>
                      <p className="text-sm text-blue-600/80 font-medium mt-1">Reviewers and vendors can collaborate on findings and clarifications here.</p>
                    </div>
                  </div>
                </MaterialCard>
                <CommentsSection resourceType="agent" resourceId={id!} currentUser={user} />
              </div>
            )}
          </div>
        </MaterialCard>
      </div>
    </Layout>
  )
}

