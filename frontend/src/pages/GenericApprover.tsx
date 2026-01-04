import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialCard, MaterialChip } from '../components/material'
import { actionsApi } from '../lib/actions'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import { workflowOrchestrationApi, ViewStructure } from '../lib/workflowOrchestration'
import { agentsApi } from '../lib/agents'
import { vendorsApi } from '../lib/vendors'
import { usersApi, User as UserType } from '../lib/users'
import Layout from '../components/Layout'
import DynamicForm from '../components/DynamicForm'
import { showToast } from '../utils/toast'
import {
  FileText,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Eye,
  History,
  User as UserIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  X,
  Workflow,
  Building2,
  Shield,
  FileCheck,
  Network,
  BarChart3,
  Forward,
  Search,
  Clock
} from 'lucide-react'

interface GenericApproverPageProps {}

/**
 * Generic Approver View
 * 
 * This component loads action items dynamically based on source_type and source_id
 * from the business process. It then loads entity details and renders appropriate UI.
 * 
 * Route: /approver/:sourceType/:sourceId
 * 
 * The source_type and source_id come from the action item's business process mapping,
 * not hardcoded. This allows the same component to handle:
 * - assessment_assignment / assessment_approval
 * - onboarding_request
 * - approval_step
 * - ticket
 * - etc.
 */
export default function GenericApproverPage({}: GenericApproverPageProps) {
  const { sourceType, sourceId } = useParams<{ sourceType: string; sourceId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<string>('overview') // Default to 'overview' tab
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [forwardQuestionIds, setForwardQuestionIds] = useState<string[]>([]) // Empty array = forward entire assessment
  const [forwardUserSearch, setForwardUserSearch] = useState('')
  const [forwardUserId, setForwardUserId] = useState('')
  const [forwardComment, setForwardComment] = useState('')

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Load action item FIRST - this gives us the source_type and source_id from business process
  const { data: actionItem, isLoading: actionItemLoading, error: actionItemError } = useQuery({
    queryKey: ['action-item', sourceType, sourceId],
    queryFn: () => actionsApi.getBySource(sourceType!, sourceId!),
    enabled: !!sourceType && !!sourceId,
  })

  // Once we have the action item, use its source_type and source_id to load entity details
  // The source_type determines which API to call and how to render the entity
  
  // For assessment-related items
  const isAssessmentType = actionItem?.source_type === 'assessment_assignment' || 
                          actionItem?.source_type === 'assessment_approval' ||
                          actionItem?.source_type === 'assessment_review'
  
  // Load assessment assignment details if this is an assessment
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assessment-assignment-approver', actionItem?.source_id],
    queryFn: () => assessmentsApi.getAssignmentStatus(actionItem!.source_id),
    enabled: !!actionItem && isAssessmentType && !!actionItem.source_id,
  })

  // Determine entity type and request type for view structure generation (after assignment is loaded)
  const entityType = useMemo(() => {
    if (isAssessmentType) return 'assessment_assignments'
    if (actionItem?.source_type === 'onboarding_request') return 'agents'
    if (actionItem?.source_type === 'approval_step') return 'agents'
    // Add more mappings as needed
    return 'agents' // Default fallback
  }, [actionItem, isAssessmentType])

  const requestType = useMemo(() => {
    if (isAssessmentType) return 'assessment_workflow'
    if (actionItem?.source_type === 'onboarding_request') return 'agent_onboarding_workflow'
    if (actionItem?.source_type === 'approval_step') return 'agent_onboarding_workflow'
    return 'agent_onboarding_workflow' // Default fallback
  }, [actionItem, isAssessmentType])
  
  // Map requestType to DynamicForm compatible type (already mapped above, but keeping for clarity)
  const mappedRequestType = useMemo(() => {
    return requestType as 'assessment_workflow' | 'agent_onboarding_workflow' | 'vendor_submission_workflow' | 'approver' | 'admin' | 'end_user' | 'vendor'
  }, [requestType])

  const workflowStage = useMemo(() => {
    if (assignment?.status) {
      // Map assignment status to workflow stage
      const statusMap: Record<string, string> = {
        'pending': 'new',
        'in_progress': 'in_progress',
        'completed': 'pending_approval',
        'approved': 'approved',
        'rejected': 'rejected',
        'needs_revision': 'needs_revision'
      }
      return statusMap[assignment.status] || 'pending_approval'
    }
    return 'pending_approval' // Default for assessments
  }, [assignment])

  // Generate view structure (tabs/sections) based on entity type and configuration
  const { data: viewStructure, isLoading: viewStructureLoading } = useQuery({
    queryKey: ['view-structure', entityType, requestType, workflowStage, user?.role, actionItem?.source_id],
    queryFn: () => workflowOrchestrationApi.generateViewStructure({
      entity_name: entityType,
      request_type: requestType,
      workflow_stage: workflowStage,
      entity_id: actionItem?.source_id,
      agent_type: (actionItem?.metadata as any)?.agent_type,
      agent_category: (actionItem?.metadata as any)?.agent_category
    }),
    enabled: !!actionItem && !!user && !!entityType && !!requestType,
  })

  // Get agent and vendor info if available (for assessments with agent_id or vendor_id)
  const agentId = useMemo(() => {
    if (isAssessmentType && assignment) {
      return (actionItem?.metadata as any)?.agent_id || (assignment as any)?.agent_id
    }
    if (actionItem?.source_type === 'onboarding_request' || actionItem?.source_type === 'approval_step') {
      return actionItem?.source_id // For agent approvals, source_id is the agent_id
    }
    return null
  }, [actionItem, assignment, isAssessmentType])

  const vendorId = useMemo(() => {
    if (isAssessmentType && assignment) {
      return (actionItem?.metadata as any)?.vendor_id || (assignment as any)?.vendor_id
    }
    if (agentId) {
      // For agents, we'll need to fetch the agent first to get vendor_id
      return null // Will be loaded from agent data
    }
    return null
  }, [actionItem, assignment, isAssessmentType, agentId])

  // Load agent details if agentId is available
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent-details', agentId],
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  })

  // Load vendor details if vendorId is available (or from agent)
  const effectiveVendorId = agent?.vendor_id || vendorId
  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendor-details', effectiveVendorId],
    queryFn: async () => {
      // Note: We may need to add a get vendor by ID endpoint
      const vendors = await vendorsApi.list()
      return vendors.find(v => v.id === effectiveVendorId)
    },
    enabled: !!effectiveVendorId,
  })

  // Get tabs from view structure, with fallback defaults
  const tabs = useMemo(() => {
    if (viewStructure?.tabs && viewStructure.tabs.length > 0) {
      // Deduplicate tabs by ID (safety measure in case backend returns duplicates)
      const seenIds = new Set<string>()
      const uniqueTabs = viewStructure.tabs.filter((tab) => {
        if (seenIds.has(tab.id)) {
          return false
        }
        seenIds.add(tab.id)
        return true
      })
      // Sort by order
      return uniqueTabs.sort((a, b) => (a.order || 0) - (b.order || 0))
    }
    
    // Default tabs based on entity type
    if (isAssessmentType) {
      return [
        { id: 'overview', label: 'Overview', order: 1 },
        { id: 'entity_visualization', label: 'Entity Visualization', order: 2 },
        { id: 'agent_details', label: 'Agent Details', order: 3 },
        { id: 'organization_info', label: 'Organization Info', order: 4 },
        { id: 'compliance', label: 'Compliance', order: 5 },
        { id: 'requirement', label: 'Requirement', order: 6 },
        { id: 'review_progress', label: 'Review Progress', order: 7 },
        { id: 'history', label: 'History', order: 8 }
      ]
    }
    
    // Default tabs for agents
    return [
      { id: 'overview', label: 'Overview', order: 1 },
      { id: 'agent_details', label: 'Agent Details', order: 2 },
      { id: 'organization_info', label: 'Organization Info', order: 3 },
      { id: 'compliance', label: 'Compliance', order: 4 },
      { id: 'requirement', label: 'Requirement', order: 5 },
      { id: 'review_progress', label: 'Review Progress', order: 6 },
      { id: 'history', label: 'History', order: 7 }
    ]
  }, [viewStructure, isAssessmentType])

  // Set default active tab to first tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  // Load assessment questions and responses
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['assessment-questions-approver', actionItem?.source_id, assignment?.assessment_id],
    queryFn: () => assessmentsApi.getAssignmentQuestions(actionItem!.source_id),
    enabled: !!actionItem && isAssessmentType && !!actionItem.source_id,
  })

  // Load responses
  const { data: responses, isLoading: responsesLoading } = useQuery({
    queryKey: ['assessment-responses-approver', actionItem?.source_id],
    queryFn: () => assessmentsApi.getAssignmentResponses(actionItem!.source_id),
    enabled: !!actionItem && isAssessmentType && !!actionItem.source_id,
  })

  // Fetch question reviews (must be before formData useMemo)
  const { data: questionReviewsData } = useQuery({
    queryKey: ['question-reviews-approver', actionItem?.source_id],
    queryFn: () => assessmentsApi.getQuestionReviews(actionItem!.source_id),
    enabled: !!actionItem && isAssessmentType && !!actionItem.source_id,
  })

  // Fetch approval status to get current step
  const { data: approvalStatus } = useQuery({
    queryKey: ['approval-status', actionItem?.source_id],
    queryFn: () => assessmentsApi.getApprovalStatus(actionItem!.source_id),
    enabled: !!actionItem && isAssessmentType && !!actionItem.source_id,
  })

  // Note: DynamicForm fetches its own layout, so we don't need to fetch it here

  // Map assessment responses to form data format
  const formData = useMemo(() => {
    if (!isAssessmentType) return {}
    
    const safeResponses = responses || {}
    const safeQuestions = Array.isArray(questions) ? questions : []
    
    const data: Record<string, any> = {
      // Always include questions and responses for assessment_response_grid
      questions: safeQuestions,
      responses: safeResponses,
      questionReviews: questionReviewsData?.question_reviews || {},
      assignment_id: actionItem?.source_id
    }
    
    // Also map individual question responses for other fields
    safeQuestions.forEach((question: any) => {
      const questionIdStr = String(question.id)
      const response = safeResponses[questionIdStr]
      if (response) {
        const fieldName = question.field_name || `question_${question.id}`
        data[fieldName] = response.value
        if (response.comment) {
          data[`${fieldName}_comment`] = response.comment
        }
      }
    })
    
    if (assignment) {
      data.assessment_name = assignment.assessment_name
      data.status = assignment.status
      data.workflow_ticket_id = assignment.workflow_ticket_id
      data.submitted_at = assignment.completed_at
      data.completed_at = assignment.completed_at
      // Get assessment_type and submitted_by from actionItem metadata if available
      if (actionItem?.metadata) {
        data.assessment_type = actionItem.metadata.assessment_type
        data.submitted_by = actionItem.metadata.submitted_by
      }
    }
    
    
    return data
  }, [responses, questions, assignment, isAssessmentType, questionReviewsData, actionItem])

  // Fetch workflow history
  const { data: workflowHistory = [], isLoading: workflowHistoryLoading } = useQuery({
    queryKey: ['workflow-history-approver', actionItem?.source_id],
    queryFn: () => assessmentsApi.getWorkflowHistory(actionItem!.source_id),
    enabled: !!actionItem && isAssessmentType && !!actionItem.source_id,
  })

  // Decision mutation
  const submitDecisionMutation = useMutation({
    mutationFn: ({ decision, comment }: {
      decision: 'accepted' | 'denied' | 'need_info'
      comment?: string
    }) => assessmentsApi.submitFinalDecision(actionItem!.source_id, decision, comment),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['action-item', sourceType, sourceId] })
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', actionItem?.source_id] })
      showToast.success(`Assessment ${result.decision || result.mapped_decision || 'decision submitted'}`)
      setTimeout(() => navigate('/my-actions'), 2000)
    },
    onError: (err: any) => {
      showToast.error(err?.response?.data?.detail || err.message || 'Failed to submit decision')
    }
  })

  // Question review mutation
  const reviewQuestionMutation = useMutation({
    mutationFn: ({ questionId, status, comment }: {
      questionId: string
      status: 'pass' | 'fail' | 'in_progress'
      comment?: string
    }) => assessmentsApi.reviewQuestion(actionItem!.source_id, questionId, status, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-reviews-approver', actionItem?.source_id] })
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', actionItem?.source_id] })
      showToast.success('Question review saved')
    },
    onError: (err: any) => {
      showToast.error(err?.response?.data?.detail || err.message || 'Failed to review question')
    }
  })

  // Fetch users for forwarding
  const { data: forwardableUsers = [], isLoading: forwardUsersLoading } = useQuery<UserType[]>({
    queryKey: ['forwardable-users', user?.tenant_id, forwardUserSearch],
    queryFn: () => usersApi.list(user?.tenant_id),
    enabled: !!user && showForwardDialog,
    select: (users) => {
      // Filter by search term and exclude current user
      return users.filter(u => 
        u.id !== user?.id && 
        u.is_active &&
        (!forwardUserSearch || 
          u.name?.toLowerCase().includes(forwardUserSearch.toLowerCase()) ||
          u.email?.toLowerCase().includes(forwardUserSearch.toLowerCase()))
      )
    }
  })

  // Forward mutation
  const forwardMutation = useMutation({
    mutationFn: ({ questionIds, forwardToUserId, comment }: {
      questionIds?: string[]
      forwardToUserId: string
      comment?: string
    }) => assessmentsApi.forwardQuestions(
      actionItem!.source_id,
      forwardToUserId,
      questionIds,
      comment
    ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['action-item', sourceType, sourceId] })
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', actionItem?.source_id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-history-approver', actionItem?.source_id] })
      showToast.success(result.message || 'Assessment forwarded successfully')
      setShowForwardDialog(false)
      setForwardUserId('')
      setForwardComment('')
      setForwardQuestionIds([])
    },
    onError: (err: any) => {
      showToast.error(err?.response?.data?.detail || err.message || 'Failed to forward assessment')
    }
  })

  // Handle forward button click
  const handleForwardClick = (questionIds?: string[]) => {
    setForwardQuestionIds(questionIds || [])
    setShowForwardDialog(true)
  }

  // Handle forward submit
  const handleForwardSubmit = () => {
    if (!forwardUserId) {
      showToast.error('Please select a user to forward to')
      return
    }
    forwardMutation.mutate({
      questionIds: forwardQuestionIds.length > 0 ? forwardQuestionIds : undefined,
      forwardToUserId: forwardUserId,
      comment: forwardComment || undefined
    })
  }

  const isApprover = user && ['approver', 'tenant_admin', 'platform_admin'].includes(user.role)

  // Calculate review statistics (needed by renderAssessmentApprover)
  const reviewStats = useMemo(() => {
    if (!questionReviewsData?.question_reviews) return { pass: 0, fail: 0, in_progress: 0, pending: 0 }
    const reviews = Object.values(questionReviewsData.question_reviews) as any[]
    return reviews.reduce((acc, review: any) => {
      const status = review.status || 'pending'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, { pass: 0, fail: 0, in_progress: 0, pending: 0 })
  }, [questionReviewsData])

  // Calculate question counts for status display
  const questionCounts = useMemo(() => {
    const total = Array.isArray(questions) ? questions.length : 0
    const reviewed = reviewStats.pass + reviewStats.fail + reviewStats.in_progress
    const pending = total - reviewed
    return {
      total,
      pending,
      reviewed,
      completed: reviewed // Questions that have been reviewed
    }
  }, [questions, reviewStats])

  // Map review stats to display format (Accepted = pass, Denied = fail, More Info = in_progress)
  const summaryStats = useMemo(() => {
    return {
      accepted: reviewStats.pass || 0,
      denied: reviewStats.fail || 0,
      moreInfo: reviewStats.in_progress || 0
    }
  }, [reviewStats])

  // Render assessment approver view function (defined before use)
  const renderAssessmentApprover = () => {
    if (assignmentLoading || questionsLoading || responsesLoading) {
      return (
        <Layout user={user}>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </Layout>
      )
    }

    if (!assignment) {
      return (
        <Layout user={user}>
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-red-900 mb-2">Assessment Not Found</h2>
              <p className="text-red-700">The assessment assignment could not be loaded.</p>
              <button
                onClick={() => navigate('/my-actions')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Back to Inbox
              </button>
            </div>
          </div>
        </Layout>
      )
    }

    return (
      <Layout user={user}>
        <div className="max-w-7xl mx-auto p-6 relative">
          {/* Right Side Floating Action Buttons */}
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
            <button
              onClick={() => handleForwardClick()} // Forward entire assessment
              className="p-3 rounded-full shadow-lg bg-blue-600 text-white border-2 border-blue-700 hover:bg-blue-700 hover:border-blue-800 transition-all"
              title="Forward Assessment"
            >
              <Forward className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className="p-3 rounded-full shadow-lg bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
              title="View History & Audit"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className="p-3 rounded-full shadow-lg bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
              title="View Workflow"
            >
              <Workflow className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className="p-3 rounded-full shadow-lg bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
              title="View Assessment Details"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>

          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/my-actions')}
              className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Inbox
            </button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <FileText className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {actionItem?.title || 'Assessment Approval'}
                      </h1>
                      {(assignment?.workflow_ticket_id || actionItem?.metadata?.workflow_ticket_id) && (
                        <MaterialChip label={assignment?.workflow_ticket_id || actionItem?.metadata?.workflow_ticket_id} color="primary" size="medium" className="!px-3 !py-1">
                          <span className="font-mono font-semibold">{assignment?.workflow_ticket_id || actionItem?.metadata?.workflow_ticket_id}</span>
                        </MaterialChip>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Source Type:</span> {actionItem?.source_type || 'assessment_approval'}
                      </div>
                      {(assignment?.workflow_ticket_id || actionItem?.metadata?.workflow_ticket_id) && (
                        <div>
                          <span className="font-medium">Workflow Ticket:</span> <span className="font-mono">{assignment?.workflow_ticket_id || actionItem?.metadata?.workflow_ticket_id}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Status:</span> {assignment?.status || actionItem?.status || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="mb-6">
            <MaterialCard elevation={1} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <MaterialChip
                      label={assignment?.status || 'pending'}
                      color={
                        assignment?.status === 'completed' ? 'primary' :
                        assignment?.status === 'approved' ? 'success' :
                        assignment?.status === 'rejected' ? 'error' :
                        'default'
                      }
                      size="small"
                      className="!px-3 !py-1"
                    >
                      {assignment?.status || 'pending'}
                    </MaterialChip>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Pending</div>
                    <div className="text-lg font-semibold text-gray-900">{questionCounts.pending}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Completed</div>
                    <div className="text-lg font-semibold text-gray-900">{questionCounts.completed}</div>
                  </div>
                </div>
              </div>
            </MaterialCard>
          </div>

          {/* Main Content Area with Right Sidebar */}
          <div className="flex gap-6">
            {/* Main Content - Left Side */}
            <div className="flex-1">

          {/* Tab Navigation */}
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 overflow-x-auto px-4 border-b border-gray-200">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                const getTabIcon = (tabId: string) => {
                  switch (tabId) {
                    case 'overview': return <Eye className="w-4 h-4" />
                    case 'entity_visualization': return <Network className="w-4 h-4" />
                    case 'agent_details': return <UserIcon className="w-4 h-4" />
                    case 'organization_info': return <Building2 className="w-4 h-4" />
                    case 'compliance': return <Shield className="w-4 h-4" />
                    case 'requirement': return <FileCheck className="w-4 h-4" />
                    case 'review_progress': return <BarChart3 className="w-4 h-4" />
                    case 'history': return <History className="w-4 h-4" />
                    default: return null
                  }
                }
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {getTabIcon(tab.id)}
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              {viewStructureLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Loading tab content...</p>
                </div>
              ) : (() => {
                // Find the section that matches the active tab
                const activeSection = viewStructure?.sections?.find(s => s.id === activeTab)
                
                
                // If we have a section from viewStructure, render it dynamically
                if (activeSection) {
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{activeSection.title}</h3>
                      {activeSection.description && (
                        <p className="text-sm text-gray-600 mb-6">{activeSection.description}</p>
                      )}
                      <DynamicForm
                        key={`dynamic-form-${actionItem?.source_id || 'unknown'}-${activeTab}`}
                        requestType={mappedRequestType}
                        workflowStage={workflowStage || "pending_approval"}
                        formData={formData}
                        onChange={() => {}}
                        readOnly={false}
                        assignmentId={actionItem?.source_id}
                        onForwardQuestion={(questionId) => handleForwardClick([questionId])} // Forward specific question
                      />
                    </div>
                  )
                }
                
                // If no section found but we have viewStructure, try to render with DynamicForm using the active tab
                if (viewStructure && tabs.find(t => t.id === activeTab)) {
                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {tabs.find(t => t.id === activeTab)?.label || 'Content'}
                      </h3>
                      <DynamicForm
                        key={`dynamic-form-${actionItem?.source_id || 'unknown'}-${activeTab}`}
                        requestType={mappedRequestType}
                        workflowStage={workflowStage || "pending_approval"}
                        formData={formData}
                        onChange={() => {}}
                        readOnly={false}
                        assignmentId={actionItem?.source_id}
                        onForwardQuestion={(questionId) => handleForwardClick([questionId])} // Forward specific question
                      />
                    </div>
                  )
                }
                
                // Fallback: show message if no content available
                return (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No content available for this tab.</p>
                    <p className="text-sm mt-2">Please configure the form layout for this workflow stage.</p>
                  </div>
                )
              })()}
            </div>
          </div>
            </div>
            
            {/* Right Sidebar */}
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-6 space-y-6">
                {/* Review Summary Card */}
                <MaterialCard elevation={2} className="bg-white border border-gray-200 p-5 shadow-sm">
                  <div className="text-base font-bold text-gray-900 mb-4">Review Summary</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 font-medium">Accepted:</span>
                      <span className="text-lg font-bold text-blue-600">{summaryStats.accepted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 font-medium">Denied:</span>
                      <span className="text-lg font-bold text-red-600">{summaryStats.denied}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 font-medium">More Info:</span>
                      <span className="text-lg font-bold text-yellow-600">{summaryStats.moreInfo}</span>
                    </div>
                  </div>
                </MaterialCard>

                {/* Review Progress Card */}
                <MaterialCard elevation={2} className="bg-white border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div className="text-base font-bold text-gray-900">Review Progress</div>
                    </div>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      History
                    </button>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="text-sm font-semibold text-yellow-900 mb-1">Summary</div>
                    <div className="text-base font-bold text-yellow-800">
                      {questionCounts.completed} of {questionCounts.total} Complete
                    </div>
                  </div>
                  <div className="space-y-2">
                    {['Security', 'Compliance', 'Technical', 'Business'].map((category) => (
                      <div key={category} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{category}</span>
                      </div>
                    ))}
                  </div>
                </MaterialCard>

                {/* Workflow Status Card */}
                <MaterialCard elevation={2} className="bg-white border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Workflow className="w-5 h-5 text-gray-600" />
                    <div className="text-base font-bold text-gray-900">Workflow Status</div>
                  </div>
                  {assignment && (
                    <div className="space-y-4">
                      {assignment.workflow_ticket_id && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Request ID</div>
                          <div className="font-mono text-sm font-semibold text-gray-900">
                            {assignment.workflow_ticket_id.split('-').pop()?.slice(0, 8)}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Status</div>
                        <div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            assignment.status === 'approved' ? 'bg-green-100 text-green-800' :
                            assignment.status === 'rejected' || assignment.status === 'denied' ? 'bg-red-100 text-red-800' :
                            assignment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {assignment.status === 'completed' ? 'IN REVIEW' : assignment.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current Step</div>
                        <div className="text-sm font-medium text-gray-900">
                          {approvalStatus?.has_workflow && approvalStatus.current_step
                            ? `Step ${approvalStatus.current_step}${approvalStatus.total_steps > 0 ? ` of ${approvalStatus.total_steps}` : ''}${approvalStatus.step_name ? `: ${approvalStatus.step_name}` : ''}`
                            : 'Step 1'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Type</div>
                        <div className="text-sm font-medium text-gray-900">Review</div>
                      </div>
                      {actionItem?.metadata?.assigned_to && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Assigned To</div>
                          <div className="text-sm font-medium text-gray-900">
                            {typeof actionItem.metadata.assigned_to === 'string' 
                              ? actionItem.metadata.assigned_to 
                              : (actionItem.metadata.assigned_to as any)?.email || actionItem.metadata.assigned_to || 'N/A'}
                          </div>
                        </div>
                      )}
                      {!actionItem?.metadata?.assigned_to && user?.email && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Assigned To</div>
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        </div>
                      )}
                      <button
                        onClick={() => setActiveTab('workflow')}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
                      >
                        Workflow
                      </button>
                    </div>
                  )}
                </MaterialCard>

                {/* Final Decision Card - Only show when assignment is completed and all questions reviewed */}
                {assignment && assignment.status === 'completed' && questionCounts.pending === 0 && questionCounts.total > 0 && (
                  <MaterialCard elevation={2} className="bg-white border-2 border-blue-200 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                      <div className="text-base font-bold text-gray-900">Final Decision</div>
                    </div>
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-semibold text-green-900 mb-1">All Questions Reviewed</div>
                      <div className="text-xs text-green-700">
                        {questionCounts.completed} of {questionCounts.total} questions reviewed. Ready to submit final decision.
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => {
                          const comment = prompt('Optional comment for acceptance:') || undefined
                          submitDecisionMutation.mutate({ decision: 'accepted', comment })
                        }}
                        disabled={submitDecisionMutation.isPending}
                        className="w-full px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {submitDecisionMutation.isPending ? 'Submitting...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => {
                          const comment = prompt('Reason for denial (required):')
                          if (comment) {
                            submitDecisionMutation.mutate({ decision: 'denied', comment })
                          }
                        }}
                        disabled={submitDecisionMutation.isPending}
                        className="w-full px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {submitDecisionMutation.isPending ? 'Submitting...' : 'Deny'}
                      </button>
                      <button
                        onClick={() => {
                          const comment = prompt('What information is needed?')
                          if (comment) {
                            submitDecisionMutation.mutate({ decision: 'need_info', comment })
                          }
                        }}
                        disabled={submitDecisionMutation.isPending}
                        className="w-full px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        {submitDecisionMutation.isPending ? 'Submitting...' : 'Need Info'}
                      </button>
                    </div>
                  </MaterialCard>
                )}
                
                {/* Forward Assessment Card */}
                {assignment && assignment.status === 'completed' && (
                  <MaterialCard elevation={2} className="bg-white border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Forward className="w-4 h-4 text-blue-600" />
                      <div className="text-sm font-semibold text-gray-900">Forward</div>
                    </div>
                    <button
                      onClick={() => handleForwardClick()} // Forward entire assessment
                      disabled={forwardMutation.isPending}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Forward className="w-3.5 h-3.5" />
                      {forwardMutation.isPending ? 'Forwarding...' : 'Forward'}
                    </button>
                    <p className="text-xs text-gray-500 mt-1.5 text-center">
                      Forward to team member or user
                    </p>
                  </MaterialCard>
                )}

                {/* Show status message if already processed */}
                {assignment && (assignment.status === 'approved' || assignment.status === 'rejected') && (
                  <MaterialCard elevation={2} className="bg-white border-2 border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`w-5 h-5 ${assignment.status === 'approved' ? 'text-green-600' : 'text-red-600'}`} />
                      <div className="text-base font-bold text-gray-900">Assessment {assignment.status === 'approved' ? 'Accepted' : 'Denied'}</div>
                    </div>
                    <div className="text-sm text-gray-600">
                      This assessment has been {assignment.status === 'approved' ? 'accepted' : 'denied'} and is closed.
                    </div>
                  </MaterialCard>
                )}

                {/* History Card (Compact) */}
                <MaterialCard elevation={2} className="bg-white border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <History className="w-5 h-5 text-gray-600" />
                      <div className="text-base font-bold text-gray-900">History</div>
                    </div>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View All
                    </button>
                  </div>
                  {workflowHistoryLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                    </div>
                  ) : workflowHistory.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No history available</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {workflowHistory.slice(0, 3).map((item: any, index: number) => (
                        <div key={item.id || index} className="border-l-2 border-gray-200 pl-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${
                              item.action_type === 'approved' ? 'text-green-600' :
                              item.action_type === 'denied' ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {item.action_type?.replace('_', ' ').toUpperCase() || 'ACTION'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(item.action_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            by {item.action_by?.name || item.action_by?.email || 'Unknown'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </MaterialCard>
              </div>
            </div>
          </div>
        </div>

        {/* Forward Dialog */}
        {showForwardDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 max-h-[85vh] overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {forwardQuestionIds.length > 0 
                      ? `Forward ${forwardQuestionIds.length} Question${forwardQuestionIds.length > 1 ? 's' : ''}`
                      : 'Forward Assessment'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForwardDialog(false)
                      setForwardUserId('')
                      setForwardComment('')
                      setForwardQuestionIds([])
                      setForwardUserSearch('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* User Search */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Search User or Team Member
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={forwardUserSearch}
                        onChange={(e) => setForwardUserSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* User List */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Select User
                    </label>
                    <div className="border border-gray-300 rounded-md max-h-40 overflow-y-auto">
                      {forwardUsersLoading ? (
                        <div className="p-3 text-center">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                        </div>
                      ) : forwardableUsers.length === 0 ? (
                        <div className="p-3 text-center text-gray-500 text-xs">
                          {forwardUserSearch ? 'No users found' : 'Start typing to search for users'}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {forwardableUsers.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => setForwardUserId(u.id)}
                              className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                                forwardUserId === u.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                              }`}
                            >
                              <div className="font-medium text-sm text-gray-900">{u.name || 'No name'}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                              {u.role && (
                                <div className="text-xs text-gray-400 mt-0.5 capitalize">{u.role.replace('_', ' ')}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Comment (Optional)
                    </label>
                    <textarea
                      value={forwardComment}
                      onChange={(e) => setForwardComment(e.target.value)}
                      placeholder="Add a comment for the forwarded user..."
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowForwardDialog(false)
                        setForwardUserId('')
                        setForwardComment('')
                        setForwardQuestionIds([])
                        setForwardUserSearch('')
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleForwardSubmit}
                      disabled={!forwardUserId || forwardMutation.isPending}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {forwardMutation.isPending ? 'Forwarding...' : 'Forward'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    )
  }

  // Loading state
  if (actionItemLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    )
  }

  if (!actionItem || actionItemError) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-red-900 mb-2">Action Item Not Found</h2>
            <p className="text-red-700">The action item you're looking for doesn't exist or you don't have access to it.</p>
            <button
              onClick={() => navigate('/my-actions')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Back to Inbox
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // Render based on source_type from action item (from business process)
  if (isAssessmentType) {
    // Render assessment approver view
    return renderAssessmentApprover()
  }

  // For other types, render a generic view or redirect to appropriate component
  // This can be extended for other entity types
  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-yellow-900 mb-2">Unsupported Entity Type</h2>
          <p className="text-yellow-700">
            Entity type "{actionItem.source_type}" is not yet supported in the generic approver view.
          </p>
          <p className="text-yellow-700 mt-2">
            Source ID: {actionItem.source_id}
          </p>
          <button
            onClick={() => navigate('/my-actions')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    </Layout>
  )
}

