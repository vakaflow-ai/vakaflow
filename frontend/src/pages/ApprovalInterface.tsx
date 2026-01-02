import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from '../lib/agents'
import { approvalsApi } from '../lib/approvals'
import { reviewsApi } from '../lib/reviews'
import { authApi } from '../lib/auth'
import { workflowStageSettingsApi } from '../lib/workflowStageSettings'
import { workflowActionsApi } from '../lib/workflowActions'
import { workflowConfigApi } from '../lib/workflowConfig'
import { formLayoutsApi } from '../lib/formLayouts'
import { workflowOrchestrationApi, ViewStructure } from '../lib/workflowOrchestration'
import { submissionRequirementsApi, RequirementResponse } from '../lib/submissionRequirements'
import { complianceApi } from '../lib/compliance'
import { recommendationsApi, Recommendation } from '../lib/recommendations'
import { predictiveApi, Prediction } from '../lib/predictive'
import { agentConnectionsApi, AgentConnection } from '../lib/agentConnections'
import Layout from '../components/Layout'
import AgentDetailsView from '../components/AgentDetailsView'
import CommentsSection from '../components/CommentsSection'
import DynamicForm from '../components/DynamicForm'
import ConnectionDiagram from '../components/ConnectionDiagram'
import MermaidDiagram from '../components/MermaidDiagram'
import EntityGraphVisualization from '../components/EntityGraphVisualization'
import { ChevronDown, ChevronUp, Info, FileText, Shield, CheckCircle, XCircle, Clock, MessageSquare, History, Workflow, User, Building, Tag, HelpCircle, Network, GitBranch, Sparkles, BarChart3, Clipboard } from 'lucide-react'
import { usersApi } from '../lib/users'
import { showToast } from '../utils/toast'

export default function ApprovalInterface() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionNotes, setRejectionNotes] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [approvalFormData, setApprovalFormData] = useState<Record<string, any>>({})
  const [useDynamicForm, setUseDynamicForm] = useState(true)
  
  // Expandable sections state (for collapsible sidebar sections)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [approvalPanelExpanded, setApprovalPanelExpanded] = useState(true)

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id
  })

  const { data: approval, isLoading: approvalLoading } = useQuery({
    queryKey: ['approval', id],
    queryFn: () => approvalsApi.getAgentApproval(id!),
    enabled: !!id,
    retry: false
  })

  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => reviewsApi.list(id!),
    enabled: !!id,
    refetchInterval: activeTab === 'reviews' ? 10000 : false, // Refetch every 10 seconds when reviews tab is active
    refetchOnWindowFocus: true
  })

  // Additional data queries for agent detail tabs
  const { data: complianceData } = useQuery({
    queryKey: ['compliance', id],
    queryFn: () => complianceApi.getChecks(id!),
    enabled: !!id && activeTab === 'compliance'
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

  const { data: connections } = useQuery<AgentConnection[]>({
    queryKey: ['agent-connections', id],
    queryFn: () => agentConnectionsApi.list(id!),
    enabled: !!id && activeTab === 'connections'
  })

  // Mutation for running compliance check
  const runComplianceCheck = useMutation({
    mutationFn: () => complianceApi.checkAgent(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', id] })
      showToast.success('Compliance check initiated')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to run compliance check')
    }
  })

  // Get workflow stage settings
  const { data: stageSettings } = useQuery({
    queryKey: ['stage-settings', id],
    queryFn: () => workflowStageSettingsApi.getForAgent(id!),
    enabled: !!id,
    retry: false
  })

  // Get onboarding request for workflow info
  const { data: onboardingRequest } = useQuery({
    queryKey: ['onboarding-request', id],
    queryFn: () => workflowConfigApi.getOnboardingRequestByAgent(id!),
    enabled: !!id,
    retry: false
  })

  // Determine workflow stage for layout lookup
  const workflowStage = onboardingRequest?.status === 'in_review' || onboardingRequest?.status === 'pending'
    ? 'pending_approval'
    : onboardingRequest?.status === 'needs_revision'
    ? 'needs_revision'
    : onboardingRequest?.status === 'approved'
    ? 'approved'
    : onboardingRequest?.status === 'rejected'
    ? 'rejected'
    : 'pending_approval' // Default to pending_approval for approver screens

  // Determine request type
  const requestType = 'agent_onboarding_workflow' // Could be determined from agent/workflow config

  // Get form layout for the approver screen from Process Designer (stageSettings.layout_id)
  // NEW DESIGN: Only use layout_id from stageSettings - no fallbacks
  const layoutId = stageSettings?.layout_id
  const { data: approverLayout, isLoading: approverLayoutLoading } = useQuery({
    queryKey: ['approver-layout', id, layoutId],
    queryFn: async () => {
      if (!layoutId) {
        return null
      }
      
      try {
        const layout = await formLayoutsApi.get(layoutId)
        return layout
      } catch (error) {
        console.error('ApprovalInterface - Failed to fetch layout from Process Designer:', error)
        throw error
      }
    },
    enabled: !!id && !!agent && !!layoutId, // Wait for stageSettings and layout_id to load
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
  })
  
  // Debug logging for approverLayout and stageSettings - only log once when layout loads
  const hasLoggedLayoutReady = useRef(false)
  const hasLoggedNoLayoutId = useRef(false)
  const hasLoggedLayoutError = useRef(false)
  
  useEffect(() => {
    if (approverLayout && !approverLayoutLoading && !hasLoggedLayoutReady.current) {
      hasLoggedLayoutReady.current = true
      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log('✅ ApprovalInterface - approverLayout ready:', {
          id: approverLayout.id,
          name: approverLayout.name,
          sectionsCount: approverLayout.sections?.length || 0
        })
      }
    } else if (!approverLayoutLoading && stageSettings && !stageSettings.layout_id && !hasLoggedNoLayoutId.current) {
      hasLoggedNoLayoutId.current = true
      console.warn('⚠️ ApprovalInterface - No layout_id configured in stage settings. Please select a layout in Stage Settings.')
      console.warn('   Current step:', stageSettings.step_number, stageSettings.step_name)
      console.warn('   Please go to Workflows → Stage Settings → Select a layout in "Approver Screen Layout"')
    } else if (!approverLayoutLoading && stageSettings?.layout_id && !approverLayout && !hasLoggedLayoutError.current) {
      hasLoggedLayoutError.current = true
      console.error('❌ ApprovalInterface - layout_id exists but approverLayout is null. Layout might not exist or query failed.')
      console.error('   layout_id:', stageSettings.layout_id)
      console.error('   This might mean the layout was deleted or the ID is incorrect.')
    }
  }, [approverLayout, approverLayoutLoading, stageSettings])

  // Generate view structure dynamically from workflow orchestration
  const { data: viewStructure, isLoading: viewStructureLoading } = useQuery({
    queryKey: ['workflow-view-structure', id, requestType, workflowStage, agent?.type, agent?.category, user?.role],
    queryFn: async () => {
      if (!user || !agent) return null
      
      try {
        return await workflowOrchestrationApi.generateViewStructure({
          entity_name: 'agents',
          request_type: requestType,
          workflow_stage: workflowStage,
          entity_id: id, // Pass agent ID to generate connection diagram
          agent_type: agent.type,
          agent_category: agent.category,
        })
      } catch (error) {
        console.warn('Failed to generate view structure from workflow orchestration:', error)
        return null // Fallback to hardcoded layout
      }
    },
    enabled: !!id && !!agent && !!user,
    retry: false
  })

  // Set active tab to first tab from approverLayout (form designer) or view structure if available
  useEffect(() => {
    // PRIORITIZE approverLayout (from form designer) over viewStructure
    if (approverLayout?.sections && approverLayout.sections.length > 0 && !activeTab) {
      // Get first section from approverLayout that's not a special tab or overview
      const firstSection = approverLayout.sections
        .filter(s => !['diagram', 'visualization', 'reviews', 'comments', 'overview'].includes(s.id))
        .sort((a, b) => (a.order || 0) - (b.order || 0))[0]
      if (firstSection) {
        setActiveTab(firstSection.id)
        return
      }
    }
    
    if (viewStructure && viewStructure.tabs && viewStructure.tabs.length > 0 && !activeTab) {
      // Filter out overview tab from viewStructure
      const firstTab = viewStructure.tabs
        .filter(tab => tab.id !== 'overview')
        .sort((a, b) => (a.order || 0) - (b.order || 0))[0]
      if (firstTab) {
        setActiveTab(firstTab.id)
        return
      }
    }
    
    // Fallback to 'overview' if no layout available
    if (!activeTab) {
      setActiveTab('overview')
    }
  }, [approverLayout, viewStructure, activeTab])

  // Get workflow configuration to check current step
  const { data: workflowConfig } = useQuery({
    queryKey: ['workflow-config', onboardingRequest?.workflow_config_id],
    queryFn: () => workflowConfigApi.get(onboardingRequest!.workflow_config_id!),
    enabled: !!onboardingRequest?.workflow_config_id,
    retry: false
  })

  // Get workflow actions
  const { data: workflowActions } = useQuery({
    queryKey: ['workflow-actions', onboardingRequest?.id],
    queryFn: () => workflowActionsApi.getActions(onboardingRequest!.id),
    enabled: !!onboardingRequest?.id,
    retry: false
  })

  // Get audit trail
  const { data: auditTrail } = useQuery({
    queryKey: ['audit-trail', onboardingRequest?.id],
    queryFn: () => workflowActionsApi.getAuditTrail(onboardingRequest!.id),
    enabled: !!onboardingRequest?.id,
    retry: false
  })

  // Get business owner (business_contact_id) information
  const { data: businessOwner } = useQuery({
    queryKey: ['business-owner', onboardingRequest?.business_contact_id],
    queryFn: () => usersApi.get(onboardingRequest!.business_contact_id!),
    enabled: !!onboardingRequest?.business_contact_id,
    retry: false
  })

  // Get submission requirement responses to display submitted field values
  const { data: requirementResponses } = useQuery({
    queryKey: ['requirement-responses', id],
    queryFn: () => submissionRequirementsApi.getResponses(id!),
    enabled: !!id,
    retry: false
  })
  
  // Get all available fields to show all submitted fields in Details tab
  const { data: availableFieldsData } = useQuery({
    queryKey: ['available-fields'],
    queryFn: () => formLayoutsApi.getAvailableFields(),
    enabled: !!user,
    retry: false
  })
  
  // Create a map of requirement responses by field_name for easy lookup
  const requirementResponsesMap = new Map<string, any>()
  if (requirementResponses) {
    requirementResponses.forEach((resp: any) => {
      // Use field_name if available (from backend), otherwise try to derive from requirement_label
      const fieldName = resp.field_name || resp.requirement_label?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      if (fieldName) {
        requirementResponsesMap.set(fieldName, resp.value)
      }
    })
  }
  
  // Create a map of all available fields by field_name
  // IMPORTANT: Process 'agent' array FIRST to ensure fields with field_config are prioritized
  const allAvailableFieldsMap = new Map<string, any>()
  if (availableFieldsData) {
    // Process 'agent' array first (has correct field_type='select' and field_config with options)
    if (availableFieldsData.agent && Array.isArray(availableFieldsData.agent)) {
      availableFieldsData.agent.forEach((field: any) => {
        if (field && field.field_name) {
          allAvailableFieldsMap.set(field.field_name, field)
        }
      })
    }
    
    // Then process other field sources, but don't overwrite if field already exists with field_config
    Object.entries(availableFieldsData).forEach(([sourceKey, fieldSource]: [string, any]) => {
      // Skip agent array as we already processed it
      if (sourceKey === 'agent') return
      
      if (Array.isArray(fieldSource)) {
        fieldSource.forEach((field: any) => {
          if (field && field.field_name) {
            const existing = allAvailableFieldsMap.get(field.field_name)
            // Only add if field doesn't exist, or if existing doesn't have field_config but this one does
            if (!existing || (!existing.field_config && field.field_config)) {
            allAvailableFieldsMap.set(field.field_name, field)
            }
          }
        })
      } else if (fieldSource && typeof fieldSource === 'object') {
        Object.values(fieldSource).forEach((entityFieldArray: any) => {
          if (Array.isArray(entityFieldArray)) {
            entityFieldArray.forEach((field: any) => {
              if (field && field.field_name) {
                const existing = allAvailableFieldsMap.get(field.field_name)
                // Only add if field doesn't exist, or if existing doesn't have field_config but this one does
                if (!existing || (!existing.field_config && field.field_config)) {
                allAvailableFieldsMap.set(field.field_name, field)
                }
              }
            })
          }
        })
      }
    })
  }

  // Request more info mutation (via workflow comment)
  const requestMoreInfoMutation = useMutation({
    mutationFn: (comments: string) => workflowActionsApi.addComment(onboardingRequest!.id, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-actions', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['audit-trail', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'agent', id] })
      showToast.success('Request for more information sent successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to send request'
      showToast.error(errorMessage)
    }
  })

  const [requestMoreInfoComment, setRequestMoreInfoComment] = useState('')
  const [showRequestMoreInfo, setShowRequestMoreInfo] = useState(false)

  const approveMutation = useMutation({
    mutationFn: (notes?: string) => approvalsApi.approve(id!, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] })
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['reviews', id] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'agent', id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-request', id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-actions', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['audit-trail', onboardingRequest?.id] })
      // Invalidate trust center queries to refresh customer logos
      queryClient.invalidateQueries({ queryKey: ['my-trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['actions', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['actions-inbox'] })
      showToast.success('Agent approved successfully')
      navigate('/my-actions?filterType=approval')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to approve agent'
      showToast.error(errorMessage)
    }
  })

  const rejectMutation = useMutation({
    mutationFn: (notes: string) => approvalsApi.reject(id!, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval', id] })
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['reviews', id] })
      queryClient.invalidateQueries({ queryKey: ['messages', 'agent', id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-request', id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-actions', onboardingRequest?.id] })
      queryClient.invalidateQueries({ queryKey: ['audit-trail', onboardingRequest?.id] })
      // Invalidate trust center queries to refresh customer logos
      queryClient.invalidateQueries({ queryKey: ['my-trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['actions', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['actions-inbox'] })
      showToast.success('Agent rejected')
      navigate('/my-actions?filterType=approval')
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to reject agent'
      showToast.error(errorMessage)
    }
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const handleApprove = () => {
    const notes = useDynamicForm 
      ? (approvalFormData.approval_notes || approvalFormData.notes || '')
      : approvalNotes
    
    if (!notes.trim()) {
      if (!confirm('Approve without notes?')) return
    }
    approveMutation.mutate(notes || undefined)
  }

  const handleApprovalFormSubmit = (data: Record<string, any>) => {
    const notes = data.approval_notes || data.notes || ''
    if (!notes.trim()) {
      if (!confirm('Approve without notes?')) return
    }
    approveMutation.mutate(notes || undefined)
  }

  const handleReject = () => {
    if (!rejectionNotes.trim()) {
      showToast.warning('Please provide rejection notes')
      return
    }
    if (!confirm('Are you sure you want to reject this agent?')) return
    rejectMutation.mutate(rejectionNotes)
  }

  if (agentLoading || approvalLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  if (!agent) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Agent not found</div>
        </div>
      </Layout>
    )
  }

  const reviews = reviewsData?.reviews || []
  const requiredStages = ['security', 'compliance', 'technical', 'business']
  const completedStages = new Set(reviews.filter(r => r.status === 'approved').map(r => r.stage))
  
  // If workflow is approved, consider all stages as complete
  const isWorkflowApproved = onboardingRequest?.status === 'approved' || approval?.status === 'approved'
  const allStagesComplete = isWorkflowApproved || requiredStages.every(stage => completedStages.has(stage))
  
  // If workflow is approved but no review records exist, create virtual completed stages for display
  const effectiveCompletedStages = isWorkflowApproved 
    ? new Set(requiredStages) 
    : completedStages

  // Determine if current step is an approval step and user is assigned
  let currentStepInfo: any = null
  let canApprove = false
  let isCurrentStepApproval = false

  if (onboardingRequest && workflowConfig && workflowConfig.workflow_steps) {
    const steps = Array.isArray(workflowConfig.workflow_steps) 
      ? workflowConfig.workflow_steps 
      : (typeof workflowConfig.workflow_steps === 'string' 
          ? JSON.parse(workflowConfig.workflow_steps) 
          : [])
    
    currentStepInfo = steps.find((s: any) => s.step_number === onboardingRequest.current_step)
    
    if (currentStepInfo) {
      isCurrentStepApproval = currentStepInfo.step_type === 'approval'
      
      // Check if user is assigned to this step
      const isAssigned = 
        onboardingRequest.assigned_to === user?.id ||
        currentStepInfo.assigned_user_id === user?.id ||
        currentStepInfo.assigned_role === user?.role ||
        user?.role === 'tenant_admin' ||
        user?.role === 'platform_admin'
      
      // Can approve if:
      // 1. Current step is an approval step
      // 2. User is assigned to this step
      // 3. Request is in_review or pending status
      canApprove = isCurrentStepApproval && 
                   isAssigned && 
                   (onboardingRequest.status === 'in_review' || onboardingRequest.status === 'pending')
    }
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-actions?filterType=approval')}
            className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-2"
          >
            ← Back to Approvals
          </button>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
              <p className="text-sm text-muted-foreground">
                {agent.type} • Version {agent.version} • {agent.vendor_name || 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {approval?.current_assignee && approval.current_assignee.id === user?.id && (
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                  In Your Inbox
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                agent.status === 'approved' ? 'bg-green-100 text-green-800' :
                agent.status === 'rejected' ? 'bg-red-100 text-red-800' :
                agent.status === 'in_review' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {agent.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Workflow Information Card - Prominent Display */}
          <div className="compact-card bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 mb-6">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Workflow className="w-5 h-5 text-blue-600" />
              Workflow Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Business Owner */}
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Business Owner</div>
                  {businessOwner ? (
                    <div>
                      <div className="font-medium text-sm">{businessOwner.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{businessOwner.email}</div>
                    </div>
                  ) : onboardingRequest?.business_contact_id ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Not assigned</div>
                  )}
                </div>
              </div>

              {/* Department */}
              <div className="flex items-start gap-3">
                <Building className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Department</div>
                  <div className="font-medium text-sm">
                    {businessOwner?.department || agent.category || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Internal Branding Name (Agent Name) */}
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Agent Name</div>
                  <div className="font-medium text-sm truncate">{agent.name}</div>
                </div>
              </div>

              {/* Vendor Name */}
              <div className="flex items-start gap-3">
                <Building className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Vendor</div>
                  <div className="font-medium text-sm truncate">{agent.vendor_name || 'N/A'}</div>
                </div>
              </div>

              {/* Category */}
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <div className="font-medium text-sm">{agent.category || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Show warning if layout is not configured */}
        {!approverLayoutLoading && stageSettings && !stageSettings.layout_id && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">No Form Layout Configured</h3>
                <p className="text-sm text-yellow-700">
                  Please configure a form layout for this approval stage in Process Designer.
                  <br />
                  Go to <strong>Workflows → Stage Settings → Select a layout in "Approver Screen Layout"</strong>
                </p>
                {stageSettings.step_name && (
                  <p className="text-xs text-yellow-600 mt-2">
                    Current step: <strong>{stageSettings.step_name}</strong> (Step {stageSettings.step_number})
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show error if layout_id exists but layout failed to load */}
        {!approverLayoutLoading && stageSettings?.layout_id && !approverLayout && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Form Layout Not Found</h3>
                <p className="text-sm text-red-700">
                  The configured layout (ID: <code className="bg-red-100 px-1 rounded">{stageSettings.layout_id}</code>) could not be loaded.
                  <br />
                  The layout may have been deleted or the ID is incorrect. Please reconfigure the layout in Stage Settings.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Area - Agent Info Tabs */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tabs - Dynamically generated from workflow orchestration */}
            <div className="border-b">
              <nav className="flex space-x-1 overflow-x-auto hide-scrollbar">
                {approverLayoutLoading || viewStructureLoading ? (
                  <div className="py-2 px-1 text-sm text-muted-foreground">Loading tabs...</div>
                ) : (
                  <>
                    {/* Always show Overview tab for entity details */}
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'overview'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Overview
                      </div>
                    </button>
                    
                    {/* Entity Visualization tab - always visible */}
                    <button
                      onClick={() => setActiveTab('visualization')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'visualization'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Entity Visualization
                      </div>
                    </button>
                    
                    {/* Show tabs from approverLayout (form designer) or view structure */}
                    {(() => {
                      // PRIORITIZE approverLayout tabs (from form designer) over viewStructure
                      let tabsToShow: any[] = []
                      
                      // First, try to get tabs from approverLayout (form designer)
                      if (approverLayout?.sections && approverLayout.sections.length > 0) {
                        tabsToShow = approverLayout.sections
                          .filter(s => {
                            // Only filter out special system tabs that are always shown separately
                            // Don't filter out 'details' or 'overview' - they can be custom sections
                            const isSpecialSystemTab = ['diagram', 'visualization', 'reviews', 'comments'].includes(s.id)
                            return !isSpecialSystemTab
                          })
                          .map(section => ({
                            id: section.id,
                            label: section.title,
                            order: section.order || 0
                          }))
                      }

                      // If no tabs from approverLayout, use viewStructure tabs (fallback)
                      if (tabsToShow.length === 0 && viewStructure?.tabs && viewStructure.tabs.length > 0) {
                        tabsToShow = viewStructure.tabs.filter(tab => {
                          // Filter out special tabs that are always shown separately
                          const isSpecialTab = ['diagram', 'visualization', 'reviews', 'comments', 'overview'].includes(tab.id)
                          return !isSpecialTab
                        })
                      }

                      // If still no tabs, add default "Entity Details" tab
                      if (tabsToShow.length === 0) {
                        tabsToShow = [{
                          id: 'details',
                          label: 'Entity Details',
                          order: 1
                        }]
                      }
                      
                        return (
                          <>
                            {tabsToShow
                              .sort((a, b) => (a.order || 0) - (b.order || 0))
                              .map((tab) => {
                                // Get icon based on tab.id or tab.icon
                                let TabIcon = Info
                                if (tab.icon === 'network' || tab.id === 'diagram') {
                                  TabIcon = Network
                              } else if (tab.icon === 'file' || tab.id === 'details' || tab.id === 'agent_details') {
                                  TabIcon = FileText
                                } else if (tab.icon === 'info' || tab.id === 'overview') {
                                  TabIcon = Info
                                }
                                
                                return (
                                  <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                                      activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <TabIcon className="w-4 h-4" />
                                      {tab.label}
                                    </div>
                                  </button>
                                )
                              })}
                          </>
                        )
                    })()}
                    
                    {/* Agent Detail Tabs - Compliance, Requirements, Connections, Recommendations, Predictions */}
                    <button
                      onClick={() => setActiveTab('compliance')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'compliance'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Compliance
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('requirements')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'requirements'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clipboard className="w-4 h-4" />
                        Requirements
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('connections')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'connections'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4" />
                        Architecture
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('recommendations')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'recommendations'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Recommendations
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('predictions')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'predictions'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                      </div>
                    </button>
                    
                    {/* Always show Diagram, Reviews and Comments tabs */}
                    {/* Diagram tab - only show if not already in layout */}
                    {(() => {
                      // Check if diagram tab already exists in approverLayout or viewStructure tabs
                      const hasDiagramInApproverLayout = approverLayout?.sections?.some(s => s.id === 'diagram')
                      const hasDiagramInViewStructure = viewStructure?.tabs?.some(tab => tab.id === 'diagram')
                      const hasDiagramTab = hasDiagramInApproverLayout || hasDiagramInViewStructure
                      
                      // Only show hardcoded Diagram tab if it doesn't already exist in the layout
                      if (!hasDiagramTab) {
                        return (
                          <button
                            onClick={() => setActiveTab('diagram')}
                            className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                              activeTab === 'diagram'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Network className="w-4 h-4" />
                              Diagram
                            </div>
                          </button>
                        )
                      }
                      return null
                    })()}
                    <button
                      onClick={() => setActiveTab('reviews')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'reviews'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Review History
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('comments')}
                      className={`py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                        activeTab === 'comments'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Comments
                      </div>
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Tab Content - Dynamically generated from workflow orchestration */}
            <div className="min-h-[400px] pb-6">
              {viewStructureLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">Loading view structure...</div>
                </div>
              ) : (() => {
                  // Hardcoded tabs that have their own specific content - don't render form sections
                  const hardcodedTabs = ['compliance', 'requirements', 'connections', 'recommendations', 'predictions', 'diagram', 'visualization', 'reviews', 'comments']
                  
                  // If it's a hardcoded tab, skip form sections rendering (they render their own content below)
                  if (hardcodedTabs.includes(activeTab)) {
                    return null
                  }
                  
                  // Details/Agent Details tabs should show the same as Overview (all sections)
                  // So we treat them the same as Overview
                  const isOverviewTab = activeTab === 'overview' || activeTab === 'details' || activeTab === 'agent_details'
                  
                  // Only render form sections if:
                  // 1. It's NOT a hardcoded tab (already checked above), AND
                  // 2. Either we have approverLayout sections OR it's overview/details OR it matches a viewStructure tab
                  const shouldRenderFormSections = 
                    ((approverLayout?.sections && approverLayout.sections.length > 0) || 
                     isOverviewTab || 
                     (viewStructure && viewStructure.tabs && viewStructure.tabs.some(t => t.id === activeTab)))
                  
                  if (!shouldRenderFormSections) {
                    return null // Let custom tabs render their own content below
                  }
                  
                  // PRIORITY: Render content from approverLayout (Process Designer) first
                  // Fallback to viewStructure only if approverLayout is not available
                  return (() => {
                  // PRIORITY 1: Use approverLayout from Process Designer (stageSettings.layout_id)
                  let sectionsToRender: any[] = []
                  
                  // Check if stageSettings has loaded but layout_id is missing
                  if (!approverLayout && !approverLayoutLoading && stageSettings && !stageSettings.layout_id) {
                    return (
                      <div className="compact-card">
                        <div className="text-center py-8">
                          <p className="text-lg font-medium text-gray-700 mb-2">No Form Layout Configured</p>
                          <p className="text-sm text-gray-500 mb-4">
                            Please configure a form layout for this approval stage in Process Designer.
                          </p>
                          <p className="text-xs text-gray-400">
                            Go to Workflows → Stage Settings → Select a layout in "Approver Screen Layout"
                          </p>
                        </div>
                      </div>
                    )
                  }
                  
                  // Show loading state while stageSettings or layout is loading
                  if (approverLayoutLoading || !stageSettings) {
                    return (
                      <div className="compact-card">
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500">Loading form layout...</p>
                        </div>
                      </div>
                    )
                  }
                  
                  // If we have stageSettings but no approverLayout and it's not loading, there might be an error
                  if (!approverLayout && stageSettings?.layout_id) {
                    return (
                      <div className="compact-card">
                        <div className="text-center py-8">
                          <p className="text-lg font-medium text-red-600 mb-2">Failed to Load Layout</p>
                          <p className="text-sm text-gray-500 mb-4">
                            The configured layout (ID: {stageSettings.layout_id}) could not be loaded.
                          </p>
                          <p className="text-xs text-gray-400">
                            Please check that the layout exists and is active in Form Designer.
                          </p>
                        </div>
                      </div>
                    )
                  }
                  
                  // PRIORITY 1: Use approverLayout if available (from Process Designer)
                  if (approverLayout && approverLayout.sections && approverLayout.sections.length > 0) {
                    const filteredSections = approverLayout.sections.filter(s => {
                      // Only 'overview' tab shows all sections (for a comprehensive view)
                      // Also treat 'details' and 'agent_details' the same as 'overview'
                      if (isOverviewTab) {
                        const isSpecialSection = ['diagram', 'visualization', 'reviews', 'comments'].includes(s.id)
                        return !isSpecialSection
                      } else {
                        // For ALL other tabs, show ONLY the section that matches the activeTab ID
                        return s.id === activeTab
                      }
                    })
                    
                    sectionsToRender = filteredSections.map(section => ({
                        id: section.id,
                        title: section.title,
                        order: section.order,
                        description: section.description,
                        fields: (section.fields || []).map((fieldName: string) => {
                          const apiField = allAvailableFieldsMap.get(fieldName)
                          const viewField = viewStructure?.sections
                            ?.flatMap(s => s.fields || [])
                            ?.find((f: any) => f.field_name === fieldName)
                          
                          if (apiField) {
                            return {
                              field_name: fieldName,
                              label: apiField.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                              can_view: viewField?.can_view !== false,
                              can_edit: viewField?.can_edit || false,
                              is_required: viewField?.is_required || false,
                              field_type: apiField.field_type || apiField.field_type_display || 'text',
                              field_config: apiField.field_config || {},
                              description: apiField.description || viewField?.description
                            }
                          }
                          
                          if (viewField) {
                            return {
                              ...viewField,
                              field_type: viewField.field_type || 'text',
                              field_config: viewField.field_config || {}
                            }
                          }
                          
                          return {
                            field_name: fieldName,
                            label: fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            can_view: true,
                            can_edit: false,
                            is_required: false,
                            field_type: 'text',
                            field_config: {}
                          }
                        }).filter((f: any) => f && f.field_name)
                      }))
                  }
                  
                  if (sectionsToRender.length === 0) {
                    return (
                      <div className="compact-card">
                        <div className="text-center py-8">
                          <p className="text-lg font-medium text-gray-700 mb-2">No Sections Configured</p>
                          <p className="text-sm text-gray-500 mb-4">
                            The form layout "{approverLayout?.name || 'Unknown'}" has no sections configured for the "{activeTab}" tab.
                          </p>
                        </div>
                      </div>
                    )
                  }
                  
                  // Helper function to get field value from agent data
                  const getFieldValue = (fieldName: string, agentData: any): any => {
                    // Agent metadata fields are already flattened in the API response
                    // These include: llm_vendor, llm_model, regions, capabilities, data_types, 
                    // integrations, dependencies, use_cases, features, personas, version_info,
                    // deployment_type, data_sharing_scope, data_usage_purpose, architecture_info
                    
                    // Try direct property first (this includes flattened agent_metadata fields)
                    if (agentData?.[fieldName] !== undefined) return agentData[fieldName]
                    // Try nested in attributes
                    if (agentData?.attributes?.[fieldName] !== undefined) return agentData.attributes[fieldName]
                    // Try nested in architecture_info
                    if (agentData?.architecture_info?.[fieldName] !== undefined) return agentData.architecture_info[fieldName]
                    // Try nested in data_sharing_scope
                    if (agentData?.data_sharing_scope?.[fieldName] !== undefined) return agentData.data_sharing_scope[fieldName]
                    // Try nested in version_info
                    if (agentData?.version_info?.[fieldName] !== undefined) return agentData.version_info[fieldName]
                    
                    // Try to find in requirement responses by field_name
                    if (requirementResponsesMap.has(fieldName)) {
                      const responseValue = requirementResponsesMap.get(fieldName)
                      if (responseValue !== undefined && responseValue !== null && responseValue !== '') {
                        return responseValue
                      }
                    }
                    
                    return ''
                  }
                  
                  const formatDisplayValue = (value: any): string => {
                    if (value === null || value === undefined || value === '') return '-'
                    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-'
                    if (typeof value === 'object') return JSON.stringify(value, null, 2)
                    return String(value)
                  }
                  
                  const renderField = (field: any, agentData: any, fieldIndex: number) => {
                    const fieldName = field.field_name
                    const fieldValue = getFieldValue(fieldName, agentData)
                    const isEditable = field.can_edit && canApprove
                    const displayValue = formatDisplayValue(fieldValue)
                    
                    // Get options from field_config
                    const fieldOptions = field.field_config?.options || []
                    const isSelectField = field.field_type === 'select' || field.field_type === 'multi_select'
                    
                    switch (field.field_type) {
                      case 'textarea':
                        return (
                          <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.is_required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {isEditable ? (
                              <textarea
                                value={Array.isArray(fieldValue) ? fieldValue.join('\n') : (typeof fieldValue === 'object' ? JSON.stringify(fieldValue, null, 2) : (fieldValue || ''))}
                                onChange={(e) => {
                                  const updateData: any = {}
                                  updateData[fieldName] = e.target.value
                                  agentsApi.update(agent.id, updateData).then(() => {
                                    queryClient.invalidateQueries({ queryKey: ['agent', id] })
                                    queryClient.invalidateQueries({ queryKey: ['view-structure', id] })
                                  })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                rows={4}
                              />
                            ) : (
                              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700 whitespace-pre-wrap">
                                {displayValue}
                              </div>
                            )}
                          </div>
                        )
                      
                      case 'select':
                        return (
                          <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.is_required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {isEditable ? (
                              <select
                                value={fieldValue || ''}
                                onChange={(e) => {
                                  const updateData: any = {}
                                  updateData[fieldName] = e.target.value
                                  agentsApi.update(agent.id, updateData).then(() => {
                                    queryClient.invalidateQueries({ queryKey: ['agent', id] })
                                    queryClient.invalidateQueries({ queryKey: ['view-structure', id] })
                                  })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="">Select {field.label}...</option>
                                {fieldOptions.map((opt: any) => {
                                  const optionValue = typeof opt === 'string' ? opt : opt.value
                                  const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                                  return (
                                    <option key={optionValue} value={optionValue}>
                                      {optionLabel}
                                    </option>
                                  )
                                })}
                              </select>
                            ) : (
                              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                {displayValue}
                              </div>
                            )}
                          </div>
                        )
                      
                      case 'multi_select':
                        return (
                          <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.is_required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {isEditable ? (
                              <select
                                value={Array.isArray(fieldValue) ? fieldValue : (fieldValue ? [fieldValue] : [])}
                                onChange={(e) => {
                                  const selectedValues = Array.from(e.target.selectedOptions, (option: any) => option.value)
                                  const updateData: any = {}
                                  updateData[fieldName] = selectedValues
                                  agentsApi.update(agent.id, updateData).then(() => {
                                    queryClient.invalidateQueries({ queryKey: ['agent', id] })
                                    queryClient.invalidateQueries({ queryKey: ['view-structure', id] })
                                  })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                multiple
                              >
                                {fieldOptions.map((opt: any) => {
                                  const optionValue = typeof opt === 'string' ? opt : opt.value
                                  const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value)
                                  const isSelected = Array.isArray(fieldValue) 
                                    ? fieldValue.includes(optionValue)
                                    : fieldValue === optionValue
                                  return (
                                    <option key={optionValue} value={optionValue} selected={isSelected}>
                                      {optionLabel}
                                    </option>
                                  )
                                })}
                              </select>
                            ) : (
                              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                {displayValue}
                              </div>
                            )}
                          </div>
                        )
                      
                      default:
                        return (
                          <div key={`${fieldName}-${fieldIndex}`} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.is_required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {isEditable ? (
                              <input
                                type={field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : 'text'}
                                value={fieldValue || ''}
                                onChange={(e) => {
                                  const updateData: any = {}
                                  updateData[fieldName] = e.target.value
                                  agentsApi.update(agent.id, updateData).then(() => {
                                    queryClient.invalidateQueries({ queryKey: ['agent', id] })
                                    queryClient.invalidateQueries({ queryKey: ['view-structure', id] })
                                  })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            ) : (
                              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                {displayValue}
                              </div>
                            )}
                          </div>
                        )
                    }
                  }
                  
                  // Render sections
                  return (
                    <div className="space-y-6">
                      {sectionsToRender
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((section) => {
                          return (
                            <div key={section.id} className="compact-card">
                              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                <span>📋</span>
                                {section.title || section.id}
                              </h3>
                              {section.description && (
                                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                              )}
                              <div className="space-y-4">
                                {(section.fields || []).map((field: any, fieldIndex: number) => renderField(field, agent, fieldIndex))}
                              </div>
                            </div>
                          )
                        })
                        .filter(Boolean)
                      }
                    </div>
                  )
                })()
              })()}

              {/* Agent Detail Tabs Content */}

              {/* Agent Detail Tabs Content */}
              {activeTab === 'compliance' && (
                <div className="space-y-6">
                  {complianceData?.checks.length === 0 ? (
                    <div className="compact-card">
                      <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                        <Shield className="w-12 h-9 text-gray-200 mx-auto mb-4" />
                        <div className="text-gray-600 font-medium mb-6 italic">No automated compliance checks have been performed.</div>
                        <button
                          onClick={() => runComplianceCheck.mutate()}
                          disabled={runComplianceCheck.isPending}
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:bg-gray-400"
                        >
                          {runComplianceCheck.isPending ? 'Running...' : 'Initialize Security Scan'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {complianceData?.checks.map((check: any) => {
                        const evalResults = check.evaluation_results || {}
                        const overallScore = evalResults.overall_score || 0
                        const status = check.status?.toLowerCase() || 'unknown'
                        
                        return (
                          <div key={check.id} className="compact-card overflow-hidden group">
                            <div className={`h-1.5 w-full ${
                              status === 'pass' ? 'bg-green-500' :
                              status === 'fail' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                            
                            <div className="p-6">
                              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-semibold text-gray-900">{check.policy_name}</h3>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      status === 'pass' ? 'bg-green-100 text-green-800' :
                                      status === 'fail' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {status}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-2xl">{check.policy_description}</p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                  <div className="text-xs font-medium text-gray-700">Policy Score</div>
                                  <div className={`text-4xl font-bold ${
                                    status === 'pass' ? 'text-green-600' :
                                    status === 'fail' ? 'text-red-600' : 'text-yellow-600'
                                  }`}>
                                    {(overallScore * 100).toFixed(0)}%
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {check.policy_requirements?.length > 0 && (
                                  <div className="bg-blue-100/80 rounded-lg p-5">
                                    <div className="text-xs font-medium text-gray-700 mb-4">Mandatory Requirements</div>
                                    <ul className="space-y-3">
                                      {check.policy_requirements.map((req: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5" />
                                          {req}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {evalResults.controls_evaluated?.length > 0 && (
                                  <div className="bg-blue-50/30 rounded-lg p-5">
                                    <div className="text-xs font-bold text-primary-400 mb-4">Internal Controls Audit</div>
                                    <div className="space-y-3">
                                      {evalResults.controls_evaluated.map((ctrl: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-md shadow-sm">
                                          <span className="text-sm font-medium text-gray-800">{ctrl.control}</span>
                                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                            ctrl.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                          }`}>
                                            {ctrl.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'requirements' && (
                <div className="space-y-6">
                  <div className="compact-card bg-primary-50/50 border-primary-100/50 p-6 rounded-lg">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-blue-600">
                        <Clipboard className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-primary-900">Mandatory Organizational Requirements</h3>
                    </div>
                    <p className="text-sm text-primary-700/80 font-medium ml-14">
                      All vendors must satisfy these core requirements to maintain platform access.
                    </p>
                  </div>

                  {requirementResponses && requirementResponses.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {requirementResponses.map((response) => (
                        <div key={response.id} className="compact-card p-6 group hover:bg-primary-50/10 transition-all">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{response.requirement_label}</h3>
                              <div className="text-xs text-gray-600 font-medium">
                                Submission Date: {new Date(response.submitted_at).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {response.file_name ? (
                              <button
                                onClick={() => window.open(response.file_path, '_blank')}
                                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                              >
                                📎 {response.file_name}
                              </button>
                            ) : (
                              <div className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                Completed
                              </div>
                            )}
                          </div>
                          
                          {!response.file_name && response.value && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                              {typeof response.value === 'object' 
                                ? JSON.stringify(response.value, null, 2)
                                : String(response.value)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="compact-card">
                      <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                        <div className="text-gray-600 font-medium italic">No requirement responses found.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'connections' && (
                <div className="space-y-8">
                  <div className="compact-card overflow-hidden">
                    <div className="p-6 border-b border-gray-50 bg-surface-variant/10">
                      <h2 className="text-lg font-semibold text-gray-900">Architectural Topography</h2>
                      <p className="text-xs text-gray-500 font-medium mt-1">Network Topology & Data Flow</p>
                    </div>
                    <div className="p-8 bg-white overflow-x-auto flex justify-center">
                      {agent?.architecture_info?.connection_diagram ? (
                        <div className="min-w-[600px] p-4 rounded-lg ring-1 ring-gray-100">
                          <MermaidDiagram diagram={agent.architecture_info.connection_diagram} />
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-600 font-medium italic">Architecture diagram not available for this version.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-xs font-medium text-gray-700 px-2">Registered Connection Nodes</div>
                    {connections && connections.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {connections.map((conn) => (
                          <div key={conn.id} className="compact-card p-5 group">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-xl shadow-sm group-hover:bg-primary-100 group-hover:text-blue-600 transition-all">
                                  {conn.destination_system?.toLowerCase().includes('sap') ? '📊' : 
                                   conn.destination_system?.toLowerCase().includes('db') ? '🗄️' : 
                                   conn.protocol?.toLowerCase().includes('http') ? '🔌' : '🌐'}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{conn.destination_system || conn.app_name}</h3>
                                  <div className="text-xs font-medium text-gray-700">{conn.connection_type || 'Integration'}</div>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                {conn.is_active && <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-bold">ACTIVE</span>}
                                {conn.is_encrypted && <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">SSL</span>}
                              </div>
                            </div>
                            
                            <div className="space-y-3 pt-3 border-t border-gray-50">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 font-bold">Protocol</span>
                                <span className="font-mono text-blue-600 font-bold">{conn.protocol?.toUpperCase() || 'TCP/IP'}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 font-bold">Direction</span>
                                <span className="capitalize font-medium text-gray-700">{conn.data_flow_direction}</span>
                              </div>
                              {conn.data_classification && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600 font-bold">Classification</span>
                                  <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-lg font-medium text-xs">{conn.data_classification}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="compact-card">
                        <div className="text-center py-12 bg-blue-100/80 rounded-lg border border-dashed border-gray-200">
                          <div className="text-gray-600 font-medium italic">No connection nodes registered.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'recommendations' && (
                <div className="space-y-6">
                  {recommendations && recommendations.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {recommendations.map((rec, idx) => (
                        <div key={idx} className="compact-card p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">{rec.title}</h3>
                              <p className="text-sm text-gray-600">{rec.description}</p>
                            </div>
                            {rec.confidence && (
                              <div className="text-xs text-gray-500">
                                Confidence: {(rec.confidence * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                          {rec.reason && (
                            <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-gray-700">
                              <strong>Reason:</strong> {rec.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="compact-card">
                      <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                        <Sparkles className="w-12 h-9 text-gray-200 mx-auto mb-4" />
                        <div className="text-gray-600 font-medium italic">No recommendations available.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'predictions' && (
                <div className="space-y-6">
                  {prediction ? (
                    <div className="compact-card p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Success Prediction</h3>
                      <div className="space-y-4">
                        {prediction.success_probability !== undefined && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Success Probability</span>
                              <span className="text-2xl font-bold text-blue-600">{(prediction.success_probability * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                              <div 
                                className="bg-blue-600 h-4 rounded-full transition-all"
                                style={{ width: `${prediction.success_probability * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {prediction.factors && prediction.factors.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Key Factors</h4>
                            <ul className="space-y-2">
                              {prediction.factors.map((factor: any, idx: number) => (
                                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-blue-600 mt-1">•</span>
                                  {typeof factor === 'string' ? factor : JSON.stringify(factor)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {prediction.prediction && (
                          <div className="p-3 bg-blue-50 rounded text-sm text-gray-700">
                            <strong>Prediction:</strong> {prediction.prediction}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="compact-card">
                      <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-lg">
                        <BarChart3 className="w-12 h-9 text-gray-200 mx-auto mb-4" />
                        <div className="text-gray-600 font-medium italic">No prediction data available.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Special tabs (diagram, visualization, reviews, comments) - always rendered */}
              {activeTab === 'diagram' && (() => {
                // Get connection diagram from view structure first, then fall back to agent.architecture_info
                const diagramFromViewStructure = viewStructure?.connection_diagram || 
                  viewStructure?.sections?.find(s => s.id === 'diagram')?.connection_diagram
                const connectionDiagram = diagramFromViewStructure || agent?.architecture_info?.connection_diagram
                
                return (
                  <div className="compact-card">
                    <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Network className="w-5 h-5" />
                      Connection Diagram
                    </h2>
                    {connectionDiagram ? (
                      <div>
                        {canApprove && agent?.architecture_info?.connection_diagram ? (
                          <ConnectionDiagram
                            agentId={agent.id}
                            diagram={agent.architecture_info.connection_diagram}
                            canEdit={canApprove}
                            onUpdate={() => {
                              queryClient.invalidateQueries({ queryKey: ['agent', id] })
                              queryClient.invalidateQueries({ queryKey: ['view-structure', id] })
                            }}
                          />
                        ) : (
                          <MermaidDiagram 
                            diagram={connectionDiagram} 
                            id={`connection-diagram-${agent?.id || 'unknown'}`}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-8 text-center">
                        No connection diagram available for this agent.
                      </div>
                    )}
                  </div>
                )
              })()}

              {activeTab === 'visualization' && (
                <div className="space-y-6">
                  <div className="compact-card">
                    <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <GitBranch className="w-5 h-5" />
                      Entity Graph Visualization
                    </h2>
                    {agent ? (
                      <div className="p-2">
                        <EntityGraphVisualization agent={agent} height={500} />
                        <div className="mt-4 text-xs text-muted-foreground">
                          <p>Interactive graph showing entity relationships. Drag nodes to explore, zoom with mouse wheel.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-8 text-center">
                        No entity data available.
                      </div>
                    )}
                  </div>

                  {/* Entity Overview */}
                  {agent && (
                    <div className="compact-card">
                      <h3 className="font-medium mb-4">Entity Overview</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Entity Type:</span>
                          <span className="ml-2 font-medium">{agent.type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <span className="ml-2 font-medium">{agent.category || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <span className="ml-2 font-medium capitalize">{agent.status || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vendor:</span>
                          <span className="ml-2 font-medium">{agent.vendor_name || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Architecture Diagram if available */}
                  {agent?.architecture_info?.connection_diagram && (
                    <div className="compact-card">
                      <h3 className="font-medium mb-4">Architecture Diagram</h3>
                      <MermaidDiagram 
                        diagram={agent.architecture_info.connection_diagram} 
                        id={`entity-visualization-${agent.id}`}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="compact-card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium">Review History by Stage</h2>
                    <button
                      onClick={() => refetchReviews()}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      title="Refresh reviews"
                    >
                      <span>↻</span> Refresh
                    </button>
                  </div>
                  {reviews.length === 0 && !isWorkflowApproved ? (
                    <div className="text-sm text-muted-foreground">No reviews yet</div>
                  ) : (
                    <div className="space-y-4">
                      {requiredStages.map((stage) => {
                        const stageReviews = reviews.filter((r: any) => r.stage === stage)
                        const latestReview = stageReviews[stageReviews.length - 1]
                        
                        // If workflow is approved but no review exists for this stage, show approved status
                        const displayStatus = latestReview 
                          ? latestReview.status 
                          : (isWorkflowApproved ? 'approved' : 'pending')
                        
                        return (
                          <div key={stage} className="border-l-4 border-l-primary pl-4 py-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium capitalize text-base">{stage} Review</span>
                              {displayStatus !== 'pending' ? (
                                <span className={`status-badge ${
                                  displayStatus === 'approved' ? 'status-badge-success' :
                                  displayStatus === 'rejected' ? 'status-badge-error' :
                                  displayStatus === 'needs_revision' ? 'status-badge-warning' :
                                  'status-badge-info'
                                }`}>
                                  {displayStatus}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Pending</span>
                              )}
                            </div>
                            {latestReview ? (
                              <>
                                {/* Reviewer Info with Avatar */}
                                <div className="flex items-center gap-3 mt-2 mb-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                                    (() => {
                                      const str = latestReview.reviewer_name || latestReview.reviewer_email || ''
                                      const colors = [
                                        'bg-blue-500',
                                        'bg-green-500',
                                        'bg-yellow-500',
                                        'bg-purple-500',
                                        'bg-pink-500',
                                        'bg-indigo-500',
                                        'bg-red-500',
                                        'bg-teal-500'
                                      ]
                                      const index = str.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
                                      return colors[index % colors.length]
                                    })()
                                  }`}>
                                    {(() => {
                                      const name = latestReview.reviewer_name
                                      const email = latestReview.reviewer_email
                                      if (name) {
                                        const parts = name.split(' ')
                                        if (parts.length >= 2) {
                                          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                                        }
                                        return name.substring(0, 2).toUpperCase()
                                      }
                                      if (email) {
                                        return email.substring(0, 2).toUpperCase()
                                      }
                                      return '??'
                                    })()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">
                                      {latestReview.reviewer_name || latestReview.reviewer_email || 'Unknown Reviewer'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {latestReview.reviewer_email && latestReview.reviewer_name && (
                                        <span>{latestReview.reviewer_email}</span>
                                      )}
                                      {latestReview.reviewer_role && (
                                        <span className="ml-2 capitalize">
                                          • {latestReview.reviewer_role.replace('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {latestReview.completed_at 
                                        ? `Completed: ${new Date(latestReview.completed_at).toLocaleString()}`
                                        : `Reviewed: ${new Date(latestReview.created_at).toLocaleString()}`
                                      }
                                    </div>
                                  </div>
                                </div>

                                {latestReview.comment && (
                                  <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                                    <div className="font-medium text-xs mb-1">Comments:</div>
                                    <div className="whitespace-pre-wrap">{latestReview.comment}</div>
                                  </div>
                                )}
                                {latestReview.findings && latestReview.findings.length > 0 && (
                                  <div className="mt-2">
                                    <div className="font-medium text-xs mb-1">Findings ({latestReview.findings.length}):</div>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                      {latestReview.findings.map((finding: string, idx: number) => (
                                        <li key={idx}>{finding}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : isWorkflowApproved ? (
                              <div className="mt-2">
                                {/* Approver Info with Avatar (if available) */}
                                {(approval?.current_assignee || onboardingRequest?.approved_by_name || onboardingRequest?.approved_by_email || onboardingRequest?.assigned_to_name || onboardingRequest?.assigned_to_email) && (
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                                      (() => {
                                        const approverName = approval?.current_assignee?.name || onboardingRequest?.approved_by_name || onboardingRequest?.assigned_to_name
                                        const approverEmail = approval?.current_assignee?.email || onboardingRequest?.approved_by_email || onboardingRequest?.assigned_to_email
                                        const str = approverName || approverEmail || ''
                                        const colors = [
                                          'bg-blue-500',
                                          'bg-green-500',
                                          'bg-yellow-500',
                                          'bg-purple-500',
                                          'bg-pink-500',
                                          'bg-indigo-500',
                                          'bg-red-500',
                                          'bg-teal-500'
                                        ]
                                        const index = str.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
                                        return colors[index % colors.length]
                                      })()
                                    }`}>
                                      {(() => {
                                        const approverName = approval?.current_assignee?.name || onboardingRequest?.approved_by_name || onboardingRequest?.assigned_to_name
                                        const approverEmail = approval?.current_assignee?.email || onboardingRequest?.approved_by_email || onboardingRequest?.assigned_to_email
                                        if (approverName) {
                                          const parts = approverName.split(' ')
                                          if (parts.length >= 2) {
                                            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                                          }
                                          return approverName.substring(0, 2).toUpperCase()
                                        }
                                        if (approverEmail) {
                                          return approverEmail.substring(0, 2).toUpperCase()
                                        }
                                        return '??'
                                      })()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm">
                                        {approval?.current_assignee?.name || onboardingRequest?.approved_by_name || onboardingRequest?.assigned_to_name || onboardingRequest?.approved_by_email || onboardingRequest?.assigned_to_email || 'Approver'}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {(approval?.current_assignee?.email || onboardingRequest?.approved_by_email || onboardingRequest?.assigned_to_email) && (
                                          <span>{approval?.current_assignee?.email || onboardingRequest?.approved_by_email || onboardingRequest?.assigned_to_email}</span>
                                        )}
                                        {approval?.current_assignee?.role && (
                                          <span className="ml-2 capitalize">
                                            • {approval.current_assignee.role.replace('_', ' ')}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {onboardingRequest?.approved_at 
                                          ? `Approved on: ${new Date(onboardingRequest.approved_at).toLocaleString()}`
                                          : approval?.completed_at
                                          ? `Approved on: ${new Date(approval.completed_at).toLocaleString()}`
                                          : 'Approved'}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {(!approval?.current_assignee && !onboardingRequest?.approved_by_name && !onboardingRequest?.approved_by_email && !onboardingRequest?.assigned_to_name && !onboardingRequest?.assigned_to_email) && (
                                  <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                                    <div className="font-medium text-xs mb-1">Approved via workflow</div>
                                    <div className="text-xs">
                                      {onboardingRequest?.approved_at 
                                        ? `Approved on: ${new Date(onboardingRequest.approved_at).toLocaleString()}`
                                        : approval?.completed_at
                                        ? `Approved on: ${new Date(approval.completed_at).toLocaleString()}`
                                        : 'Approved'}
                                    </div>
                                  </div>
                                )}
                                
                                {onboardingRequest?.approval_notes && (
                                  <div className="text-sm text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                                    <div className="font-medium text-xs mb-1">Approval Notes:</div>
                                    <div className="text-xs whitespace-pre-wrap">{onboardingRequest.approval_notes}</div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <CommentsSection 
                  resourceType="agent" 
                  resourceId={id!}
                  currentUser={user}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Review Progress & Workflow Status */}
          <div className="lg:col-span-4 space-y-4">
            {/* Review Progress - Enhanced */}
            <div className="compact-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold">Review Progress</h3>
                </div>
              <button
                  onClick={() => {
                    // Expand audit trail section if it exists, or navigate to reviews tab
                    if (auditTrail && auditTrail.length > 0) {
                      toggleSection('auditTrail')
                      // Scroll to audit trail section
                      setTimeout(() => {
                        const auditTrailElement = document.getElementById('audit-trail-section')
                        if (auditTrailElement) {
                          auditTrailElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                        }
                      }, 100)
                    } else {
                      // If no audit trail, navigate to reviews tab
                      setActiveTab('reviews')
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 rounded transition-colors"
                  title="View Audit History"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
              </button>
              </div>
              
              {/* Overall Status */}
              <div className="mb-4">
                  {allStagesComplete ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">All Reviews Complete</span>
                    </div>
                  ) : (
                  <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">
                      {requiredStages.filter(s => effectiveCompletedStages.has(s)).length} of {requiredStages.length} Complete
                    </span>
                    </div>
                  )}
              </div>

              {/* Stage Progress List */}
              <div className="space-y-2">
                {requiredStages.map(stage => {
                  const stageReviews = reviews.filter((r: any) => r.stage === stage)
                  const latestReview = stageReviews[stageReviews.length - 1]
                  const isComplete = effectiveCompletedStages.has(stage)
                  
                  return (
                    <div 
                      key={stage} 
                      className={`p-2 rounded border ${
                        isComplete 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {isComplete ? (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium capitalize">{stage}</span>
                      </div>
                        {latestReview && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            latestReview.status === 'approved' ? 'bg-green-100 text-green-800' :
                            latestReview.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            latestReview.status === 'needs_revision' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {latestReview.status}
                          </span>
                        )}
                  </div>
                      {latestReview?.reviewer_name && (
                        <div className="text-xs text-muted-foreground mt-1 ml-6">
                          by {latestReview.reviewer_name}
                </div>
              )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Workflow Status - Enhanced */}
            {onboardingRequest && (
              <div className="compact-card">
                <div className="flex items-center gap-2 mb-4">
                  <Workflow className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold">Workflow Status</h3>
                  </div>
                
                <div className="space-y-3">
                  {/* Request ID */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Request ID</div>
                    <div className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                      {onboardingRequest.request_number || onboardingRequest.id?.substring(0, 8)}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <div>
                      <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                        onboardingRequest.status === 'approved' ? 'bg-green-100 text-green-800' :
                        onboardingRequest.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        onboardingRequest.status === 'in_review' ? 'bg-blue-100 text-blue-800' :
                        onboardingRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {onboardingRequest.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Current Step */}
                  {onboardingRequest.current_step && currentStepInfo && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Current Step</div>
                      <div className="text-sm font-medium">{currentStepInfo.step_name || `Step ${onboardingRequest.current_step}`}</div>
                      {currentStepInfo.step_type && (
                        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                          Type: {currentStepInfo.step_type}
                      </div>
                    )}
                    </div>
                  )}

                  {/* Assigned To */}
                    {onboardingRequest.assigned_to_email && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Assigned To</div>
                      <div className="text-sm">{onboardingRequest.assigned_to_email}</div>
                      </div>
                    )}

                  {/* Workflow Name */}
                  {workflowConfig?.name && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Workflow</div>
                      <div className="text-sm font-medium">{workflowConfig.name}</div>
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Approval Decision - Compact in Sidebar */}
            <div className="compact-card border-2 border-primary/20 bg-gradient-to-r from-blue-50 to-indigo-50">
              <button
                onClick={() => setApprovalPanelExpanded(!approvalPanelExpanded)}
                className="w-full flex items-center justify-between mb-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚖️</span>
                  <span className="font-medium">Approval Decision</span>
                </div>
                {approvalPanelExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {approvalPanelExpanded && (
                <div className="space-y-3 mt-3">
                  {/* Current Step Info */}
                  {currentStepInfo && (
                    <div className={`p-2 rounded text-xs ${
                      isCurrentStepApproval && canApprove
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    }`}>
                      <div className="font-medium mb-1">
                        {currentStepInfo.step_name || `Step ${onboardingRequest?.current_step}`}
                      </div>
                      {isCurrentStepApproval && canApprove ? (
                        <div className="text-xs">Ready for your approval</div>
                      ) : (
                        <div className="text-xs">Not ready for approval</div>
                      )}
                    </div>
                  )}

                  {/* Request More Info Button */}
                  {onboardingRequest && (
                    <button
                      onClick={() => setShowRequestMoreInfo(!showRequestMoreInfo)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Request More Info
                    </button>
                  )}

                  {/* Request More Info Form */}
                  {showRequestMoreInfo && onboardingRequest && (
                    <div className="p-2 bg-white rounded border border-blue-400">
                      <label className="block text-xs font-medium mb-1">
                        What do you need?
                      </label>
                      <textarea
                        value={requestMoreInfoComment}
                        onChange={(e) => setRequestMoreInfoComment(e.target.value)}
                        rows={2}
                        className="w-full compact-input mb-2 text-xs"
                        placeholder="Specify details needed..."
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (!requestMoreInfoComment.trim()) {
                              showToast.warning('Please enter your request')
                              return
                            }
                            requestMoreInfoMutation.mutate(requestMoreInfoComment)
                            setRequestMoreInfoComment('')
                            setShowRequestMoreInfo(false)
                          }}
                          disabled={requestMoreInfoMutation.isPending}
                          className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {requestMoreInfoMutation.isPending ? 'Sending...' : 'Send'}
                        </button>
                        <button
                          onClick={() => {
                            setShowRequestMoreInfo(false)
                            setRequestMoreInfoComment('')
                          }}
                          className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Approval Notes */}
                  {!showRejectForm && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Notes {canApprove ? '(Optional)' : ''}
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        rows={2}
                        className="w-full compact-input text-xs"
                        placeholder="Add approval notes..."
                        disabled={!canApprove}
                      />
                    </div>
                  )}

                  {/* Rejection Notes */}
                  {showRejectForm && (
                    <div>
                      <label className="block text-xs font-medium mb-1 text-red-700">
                        Rejection Notes (Required)
                      </label>
                      <textarea
                        value={rejectionNotes}
                        onChange={(e) => setRejectionNotes(e.target.value)}
                        rows={3}
                        className="w-full compact-input border-red-300 focus:border-red-500 text-xs"
                        placeholder="Reason for rejection..."
                        required
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!showRejectForm ? (
                    <div className="space-y-2">
                      <button
                        onClick={handleApprove}
                        disabled={approveMutation.isPending || !canApprove}
                        className={`w-full py-2 px-4 rounded font-medium text-white text-sm transition-all ${
                          canApprove
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {approveMutation.isPending ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="animate-spin">⏳</span> Approving...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        disabled={!canApprove}
                        className={`w-full py-2 px-4 rounded font-medium text-white text-sm transition-all ${
                          canApprove
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-1">
                          <XCircle className="w-4 h-4" />
                          Deny
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleReject}
                        disabled={rejectMutation.isPending || !rejectionNotes.trim()}
                        className={`w-full py-2 px-4 rounded font-medium text-white text-sm transition-all ${
                          rejectMutation.isPending || !rejectionNotes.trim()
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {rejectMutation.isPending ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="animate-spin">⏳</span> Rejecting...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            ❌ Confirm Rejection
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(false)
                          setRejectionNotes('')
                        }}
                        className="w-full py-2 px-4 rounded font-medium bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {!canApprove && (
                    <p className="text-xs text-muted-foreground text-center">
                      {isCurrentStepApproval 
                        ? 'Not assigned to you yet'
                        : 'Waiting for approval step'
                      }
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Assignment Info - Collapsible */}
            {approval && (
              <div className="compact-card">
                <button
                  onClick={() => toggleSection('assignment')}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span className="font-medium">Assignment</span>
                  </div>
                  {expandedSections.has('assignment') ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {expandedSections.has('assignment') && (
                  <div className="space-y-2 mt-4 text-sm">
                    {approval.current_assignee ? (
                      <>
                        <div className="font-medium">{approval.current_assignee.name}</div>
                        <div className="text-xs text-muted-foreground">{approval.current_assignee.email}</div>
                        <div className="text-xs">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {approval.current_assignee.role.replace('_', ' ')}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">Awaiting assignment</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail - Collapsible */}
            {auditTrail && auditTrail.length > 0 && (
              <div id="audit-trail-section" className="compact-card">
                <button
                  onClick={() => toggleSection('auditTrail')}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    <span className="font-medium">Audit Trail</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{auditTrail.length}</span>
                  </div>
                  {expandedSections.has('auditTrail') ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {expandedSections.has('auditTrail') && (
                  <div className="space-y-2 mt-4 max-h-96 overflow-y-auto">
                    {auditTrail.slice(0, 10).map((entry: any) => (
                      <div key={entry.id} className="text-xs p-2 bg-gray-50 rounded border-l-2 border-blue-500">
                        <div className="font-medium capitalize">{entry.action}</div>
                        {entry.step_name && (
                          <div className="text-muted-foreground">Step: {entry.step_name}</div>
                        )}
                        <div className="text-muted-foreground mt-1">
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Workflow Actions - Collapsible */}
            {workflowActions && workflowActions.length > 0 && (
              <div className="compact-card">
                <button
                  onClick={() => toggleSection('workflowActions')}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <Workflow className="w-4 h-4" />
                    <span className="font-medium">Actions</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{workflowActions.length}</span>
                  </div>
                  {expandedSections.has('workflowActions') ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {expandedSections.has('workflowActions') && (
                  <div className="space-y-2 mt-4 max-h-64 overflow-y-auto">
                    {workflowActions.slice(0, 5).map((action: any) => (
                      <div key={action.id} className="text-xs p-2 bg-gray-50 rounded">
                        <div className="font-medium capitalize">{action.action_type}</div>
                        {action.comments && (
                          <div className="text-muted-foreground mt-1">{action.comments}</div>
                        )}
                        <div className="text-muted-foreground mt-1">
                          {new Date(action.performed_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
