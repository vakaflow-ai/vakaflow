import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { assessmentsApi, AssessmentQuestion, AssessmentAssignment as AssessmentAssignmentType } from '../lib/assessments'
import { authApi } from '../lib/auth'
import { assessmentTableLayoutsApi, AssessmentTableLayout } from '../lib/assessmentTableLayouts'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import { 
  FileText, CheckCircle2, AlertCircle, Loader2, Save, ArrowLeft, 
  Upload, X, CheckCircle, XCircle, Clock, AlertTriangle, 
  MessageSquare, Send, User, Search, ChevronDown, UserPlus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkflowProgress from '@/components/WorkflowProgress'

interface QuestionResponse {
  value: any
  comment?: string
  documents?: Array<{ name: string; file: File; id: string }>
}

export default function AssessmentAssignmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingAssignee, setEditingAssignee] = useState<string | null>(null)
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState<Record<string, string>>({})
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState<Record<string, boolean>>({})
  const assigneeDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Close assignee dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.entries(assigneeDropdownRefs.current).forEach(([questionId, ref]) => {
        if (ref && !ref.contains(event.target as Node)) {
          setAssigneeDropdownOpen(prev => ({ ...prev, [questionId]: false }))
          setAssigneeSearchQuery(prev => ({ ...prev, [questionId]: '' }))
        }
      })
    }

    if (Object.values(assigneeDropdownOpen).some(open => open)) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [assigneeDropdownOpen])

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => navigate('/login'))
  }, [navigate])

  const { data: assignmentStatus, isLoading: assignmentLoading, error: assignmentError } = useQuery({
    queryKey: ['assessment-assignment', id],
    queryFn: () => assessmentsApi.getAssignmentStatus(id!),
    enabled: !!id,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors (assignment doesn't exist)
      if (error?.response?.status === 404) {
        return false
      }
      // Retry other errors up to 2 times
      return failureCount < 2
    },
  })

  // Transform status response to assignment-like object for compatibility
  const assignment = assignmentStatus ? {
    id: id!,
    assessment_id: assignmentStatus.assessment_id,
    assessment_id_display: assignmentStatus.assessment_id_display,
    assessment_name: assignmentStatus.assessment_name,
    status: assignmentStatus.status, // This comes from the API response
    completed_at: assignmentStatus.completed_at,
    started_at: assignmentStatus.started_at,
    due_date: assignmentStatus.due_date,
  } : null
  
  // Removed debug logs for performance

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['assessment-questions', assignmentStatus?.assessment_id],
    queryFn: () => assessmentsApi.getAssignmentQuestions(id!),
    enabled: !!id && !!assignmentStatus?.assessment_id,
    staleTime: 60000, // Cache for 1 minute
  })

  // Load existing responses
  const { data: existingResponses = {} } = useQuery({
    queryKey: ['assessment-responses', id],
    queryFn: () => assessmentsApi.getAssignmentResponses(id!),
    enabled: !!id && !!assignmentStatus,
    staleTime: 30000, // Cache for 30 seconds
  })

  // Load question owners/assignees
  const { data: questionOwners = {} } = useQuery({
    queryKey: ['assessment-question-owners', id],
    queryFn: () => assessmentsApi.getQuestionOwners(id!),
    enabled: !!id && !!assignmentStatus,
    staleTime: 30000, // Cache for 30 seconds
  })

  // Load table layout configuration for vendor submission view
  const { data: tableLayout } = useQuery<AssessmentTableLayout>({
    queryKey: ['assessment-table-layout', 'vendor_submission'],
    queryFn: () => assessmentTableLayoutsApi.getDefault('vendor_submission'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Load workflow progress
  const { data: workflowProgress } = useQuery({
    queryKey: ['assessment-workflow-progress', id],
    queryFn: () => assessmentsApi.getWorkflowProgress(id!),
    enabled: !!id && !!assignmentStatus,
    staleTime: 30000, // Cache for 30 seconds
    retry: false, // Don't retry if workflow doesn't exist
  })

  // Initialize responses from existing data
  useEffect(() => {
    if (existingResponses && Object.keys(existingResponses).length > 0) {
      // Convert existingResponses to the format expected by the component
      // API returns { question_id: { value, comment, documents } }
      const formattedResponses: Record<string, QuestionResponse> = {}
      Object.entries(existingResponses).forEach(([questionId, responseData]: [string, any]) => {
        formattedResponses[questionId] = {
          value: responseData?.value || responseData || '',
          comment: responseData?.comment || '',
          documents: responseData?.documents || []
        }
      })
      setResponses(formattedResponses)
    }
  }, [existingResponses])

  const saveDraftMutation = useMutation({
    mutationFn: (data: any) => assessmentsApi.saveResponses(id!, data),
    onSuccess: () => {
      showToast.success('Draft saved successfully')
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Failed to save draft')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (data: any) => assessmentsApi.saveResponses(id!, data, false),
    onSuccess: (response) => {
      // Display success message with ticket number if available
      const message = response.workflow_ticket_id 
        ? `Assessment submitted successfully! Ticket Number: ${response.workflow_ticket_id}`
        : 'Assessment submitted successfully'
      showToast.success(message)
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment', id] })
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Failed to submit assessment')
    },
  })

  const handleResponseChange = (questionId: string | number, value: any) => {
    // Ensure we use string ID for consistency with API response format
    const questionIdStr = String(questionId)
    setResponses(prev => ({
      ...prev,
      [questionIdStr]: { ...prev[questionIdStr] || {}, value }
    }))
  }

  const handleSaveDraft = () => {
    // Backend expects: { question_id: { value, comment, documents } } format
    const formattedResponses: Record<string, any> = {}
    Object.entries(responses).forEach(([questionId, response]) => {
      formattedResponses[questionId] = {
        value: response.value,
        comment: response.comment,
        documents: response.documents || []
      }
    })
    saveDraftMutation.mutate(formattedResponses)
  }

  const handleSubmit = () => {
    // Backend expects: { question_id: { value, comment, documents } } format
    const formattedResponses: Record<string, any> = {}
    Object.entries(responses).forEach(([questionId, response]) => {
      formattedResponses[questionId] = {
        value: response.value,
        comment: response.comment,
        documents: response.documents || []
      }
    })
    submitMutation.mutate(formattedResponses)
  }

  // Debounced search query state
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<Record<string, string>>({})
  
  // Debounce search queries
  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setTimeout>> = {}
    Object.entries(assigneeSearchQuery).forEach(([questionId, query]) => {
      if (timers[questionId]) clearTimeout(timers[questionId])
      timers[questionId] = setTimeout(() => {
        setDebouncedSearchQuery(prev => ({ ...prev, [questionId]: query }))
      }, 300) // 300ms debounce
    })
    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer))
    }
  }, [assigneeSearchQuery])

  // Search vendor users for assignment (with debouncing)
  const activeSearchQuery = React.useMemo(() => {
    const openDropdowns = Object.entries(assigneeDropdownOpen)
      .filter(([_, isOpen]) => isOpen)
      .map(([qId, _]) => debouncedSearchQuery[qId] || '')
    return openDropdowns[0] || ''
  }, [assigneeDropdownOpen, debouncedSearchQuery])

  const { data: vendorUsers = [] } = useQuery({
    queryKey: ['vendor-users', id, activeSearchQuery],
    queryFn: () => assessmentsApi.searchVendorUsers(id!, activeSearchQuery || undefined),
    enabled: !!id && !!assignmentStatus && Object.values(assigneeDropdownOpen).some(open => open),
    staleTime: 30000, // Cache for 30 seconds
  })

  // Assign question owner mutation with optimistic updates
  const assignOwnerMutation = useMutation({
    mutationFn: ({ questionId, ownerData }: { questionId: string; ownerData: { owner_id?: string; owner_email?: string; owner_name?: string } }) => {
      return assessmentsApi.assignQuestionOwner(id!, questionId, ownerData)
    },
    onMutate: async ({ questionId, ownerData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['assessment-question-owners', id] })
      
      // Snapshot previous value
      const previousOwners = queryClient.getQueryData(['assessment-question-owners', id])
      
      // Optimistically update
      queryClient.setQueryData(['assessment-question-owners', id], (old: any) => {
        if (!old) return old
        const newOwners = { ...old }
        // We'll update this with the actual response data
        return newOwners
      })
      
      return { previousOwners }
    },
    onSuccess: (data, variables) => {
      showToast.success(`Question assigned to ${data.owner_name}`)
      // Update the cache with the actual response
      queryClient.setQueryData(['assessment-question-owners', id], (old: any) => {
        if (!old) return { [variables.questionId]: { id: data.owner_id, name: data.owner_name, email: data.owner_email, assigned_at: data.assigned_at } }
        return {
          ...old,
          [variables.questionId]: { id: data.owner_id, name: data.owner_name, email: data.owner_email, assigned_at: data.assigned_at }
        }
      })
      setAssigneeDropdownOpen(prev => ({ ...prev, [variables.questionId]: false }))
      setAssigneeSearchQuery(prev => ({ ...prev, [variables.questionId]: '' }))
      setDebouncedSearchQuery(prev => ({ ...prev, [variables.questionId]: '' }))
    },
    onError: (err: any, variables, context) => {
      // Rollback on error
      if (context?.previousOwners) {
        queryClient.setQueryData(['assessment-question-owners', id], context.previousOwners)
      }
      showToast.error(err.message || 'Failed to assign question')
    },
  })

  const handleAssignQuestion = (questionId: string, ownerId?: string, ownerEmail?: string, ownerName?: string) => {
    if (ownerId) {
      assignOwnerMutation.mutate({ questionId, ownerData: { owner_id: ownerId } })
    } else if (ownerEmail) {
      assignOwnerMutation.mutate({ questionId, ownerData: { owner_email: ownerEmail, owner_name: ownerName } })
    }
  }

  // Determine user roles first
  const isVendor = user?.role === 'vendor_user'
  const isApprover = ['approver', 'tenant_admin', 'platform_admin'].includes(user?.role)
  const isReviewer = ['security_reviewer', 'compliance_reviewer', 'technical_reviewer', 'business_reviewer'].includes(user?.role)

  // Allow editing for: pending, in_progress, rejected, needs_revision (vendor can fill/resubmit)
  // Make readonly for: completed (vendor submitted, waiting for approval), approved (already approved)
  // Note: When assignment is sent back for revision, status changes to "in_progress", "rejected", or "needs_revision"
  const editableStatuses = ['pending', 'in_progress', 'rejected', 'needs_revision', 'overdue']
  const readonlyStatuses = ['completed', 'approved', 'cancelled']
  
  // Get raw status from assignment
  const rawStatus = assignment?.status
  // Normalize status: handle null/undefined, convert to lowercase, default to 'pending'
  const normalizedStatus = rawStatus ? String(rawStatus).toLowerCase().trim() : 'pending'
  // Mark as readonly ONLY if status is explicitly in the readonly list
  // All other statuses (including 'pending', 'in_progress', and unknown) are editable
  const isReadOnly = readonlyStatuses.includes(normalizedStatus)

  // Load question reviews for read-only approved/completed assignments
  const { data: questionReviewsData } = useQuery({
    queryKey: ['assessment-question-reviews', id],
    queryFn: () => assessmentsApi.getQuestionReviews(id!),
    enabled: !!id && !!assignmentStatus && isReadOnly,
  })

  // Load workflow history for read-only approved/completed assignments
  const { data: workflowHistory = [] } = useQuery({
    queryKey: ['assessment-workflow-history', id],
    queryFn: () => assessmentsApi.getWorkflowHistory(id!),
    enabled: !!id && !!assignmentStatus && isReadOnly,
  })
  
  // Removed debug logs for performance
  
  // Approvers and reviewers should NOT fill out assessments - they only review/approve completed ones
  // If an approver/reviewer tries to access an assignment, always redirect to approver view
  useEffect(() => {
    if (assignment && (isApprover || isReviewer) && !isVendor && id) {
      // Approvers/reviewers should always use the approver view, not the assignment form
      // The approver view shows completed assessments for review/approval
      // Use the assessment review route which is designed for approvers
      navigate(`/assessments/review/${id}`, { replace: true })
    }
  }, [assignment, isApprover, isReviewer, isVendor, id, navigate])

  const answeredCount = questions.filter(q => {
    const response = responses[q.id]
    return response?.value !== undefined && response?.value !== null && response?.value !== ''
  }).length

  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  if (assignmentLoading || questionsLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    )
  }

  if (assignmentError || !assignment) {
    const error = assignmentError as any
    const is404 = error?.response?.status === 404
    const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to load assignment'
    
    // Check if the ID might be a question response ID (they often have a different format)
    // Question response IDs are UUIDs but the route /assessment_question_responses/:id suggests this might be one
    const mightBeQuestionResponseId = window.location.pathname.includes('assessment_question_responses')
    
    return (
      <Layout user={user}>
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {is404 
                ? mightBeQuestionResponseId
                  ? `The ID "${id}" appears to be a question response ID, not an assignment ID. Please use the assignment ID to access the assessment. You can find the assignment ID from the assessments list or from your action items.`
                  : `Assessment assignment not found. The assignment ID "${id}" may not exist or you may not have access to it.`
                : errorMessage
              }
            </AlertDescription>
          </Alert>
          {is404 && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground mb-2">
                {mightBeQuestionResponseId 
                  ? "Question response IDs cannot be used to access assessments. Please use the assignment ID instead."
                  : "If you believe this is an error, please contact your administrator or try navigating from the assessments list."
                }
              </p>
              {mightBeQuestionResponseId && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-actions')}
                  className="mt-2"
                >
                  Go to My Actions
                </Button>
              )}
            </div>
          )}
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl mb-2">
                    Assessment Questionnaire
                    {isReadOnly && <span className="ml-2 text-sm font-normal text-muted-foreground">(Read-Only)</span>}
                  </CardTitle>
                  <CardDescription>
                    Questionnaire ID: {assignment.assessment_id_display || assignment.assessment_id} • 
                    Total Questions: {questions.length}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Progress</div>
                <div className="text-3xl font-bold text-primary">{progress}%</div>
                <div className="text-xs text-muted-foreground">{answeredCount} of {questions.length} answered</div>
                <div className="mt-2 w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Workflow Progress */}
        {workflowProgress?.has_workflow && (
          <WorkflowProgress
            steps={workflowProgress.steps}
            current_step={workflowProgress.current_step}
            total_steps={workflowProgress.total_steps}
            completed_steps={workflowProgress.completed_steps}
            progress_percent={workflowProgress.progress_percent}
            status={workflowProgress.status}
            started_at={workflowProgress.started_at}
            completed_at={workflowProgress.completed_at}
          />
        )}

        {/* Questions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Assessment Questionnaire</CardTitle>
            <CardDescription>Total Questions: {questions.length}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Question</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Assignee</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vendor Answer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Comments</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Attachments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    // Group questions by category/section
                    const groupedQuestions: Record<string, typeof questions> = {}
                    questions.forEach(q => {
                      const category = q.category || q.section || 'Uncategorized'
                      if (!groupedQuestions[category]) {
                        groupedQuestions[category] = []
                      }
                      groupedQuestions[category].push(q)
                    })

                    const rows: JSX.Element[] = []
                    // Get configured columns once for all categories
                    const defaultColumns = [
                      { id: 'question', visible: true },
                      { id: 'assignee', visible: true },
                      { id: 'vendor_answer', visible: true },
                      { id: 'comments', visible: true },
                      { id: 'attachments', visible: true },
                    ]
                    // Access tableLayout from parent scope - it's defined above in the component
                    const layoutColumns = tableLayout?.columns || defaultColumns
                    const visibleColumnCount = layoutColumns.filter((col: any) => col.visible).length

                    Object.entries(groupedQuestions).forEach(([category, categoryQuestions]) => {
                      // Add category header row
                      rows.push(
                        <tr key={`category-${category}`} className="bg-gray-100">
                          <td colSpan={visibleColumnCount} className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {category}
                          </td>
                        </tr>
                      )

                      // Add question rows for this category
                      categoryQuestions.forEach((question, index) => {
                        const questionIdStr = String(question.id)
                        const response = responses[questionIdStr] || responses[question.id] || { value: '', comment: '', documents: [] }
                        const hasResponse = response.value !== undefined && response.value !== null && response.value !== ''
                        
                        // Get assignee/owner for this question
                        const owner = questionOwners[questionIdStr] || questionOwners[question.id]
                        const assigneeName = owner?.name || 'Unassigned'
                        const assigneeEmail = owner?.email || ''
                        
                        // Get review comment for this question (if read-only)
                        const questionReview = questionReviewsData?.question_reviews?.[questionIdStr] || questionReviewsData?.question_reviews?.[question.id]
                        const reviewerComment = questionReview?.reviewer_comment
                        const vendorComment = questionReview?.vendor_comment || response.comment
                        const reviewStatus = questionReview?.status

                        // Format vendor answer for display
                        const formatVendorAnswer = (value: any): string => {
                          if (value === null || value === undefined || value === '') return ''
                          if (typeof value === 'string') return value
                          if (Array.isArray(value)) return value.join(', ')
                          return String(value)
                        }

                        const vendorAnswer = formatVendorAnswer(response.value)

                        // Get configured columns or use defaults (already defined above)
                        const visibleColumns = layoutColumns.filter((col: any) => col.visible).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))

                        rows.push(
                          <tr key={question.id} className="hover:bg-gray-50">
                            {visibleColumns.map((col: any) => {
                              // Render cell based on column type
                              if (col.id === 'question') {
                                return (
                                  <td key={col.id} className="px-4 py-3">
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium text-gray-900">
                                        {question.question_text || question.title}
                                        {question.is_required && <span className="text-red-600 ml-1">*</span>}
                                      </div>
                                      {question.description && (
                                        <div className="text-xs text-gray-500">{question.description}</div>
                                      )}
                                    </div>
                                  </td>
                                )
                              }
                              
                              if (col.id === 'assignee') {
                                return (
                                  <td key={col.id} className="px-4 py-3">
                              {isReadOnly ? (
                                <div className="text-sm text-gray-700">
                                  {assigneeName}
                                  {assigneeEmail && (
                                    <div className="text-xs text-gray-500">{assigneeEmail}</div>
                                  )}
                                </div>
                              ) : (
                                <div 
                                  className="relative"
                                  ref={(el) => {
                                    assigneeDropdownRefs.current[questionIdStr] = el
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAssigneeDropdownOpen(prev => ({
                                        ...prev,
                                        [questionIdStr]: !prev[questionIdStr]
                                      }))
                                      if (!assigneeDropdownOpen[questionIdStr]) {
                                        setAssigneeSearchQuery(prev => ({ ...prev, [questionIdStr]: '' }))
                                      }
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md border border-gray-300 bg-white text-sm hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex items-center justify-between"
                                  >
                                    <span className="text-gray-700 truncate">
                                      {assigneeName}
                                      {assigneeEmail && <span className="text-gray-500 ml-1">({assigneeEmail})</span>}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${assigneeDropdownOpen[questionIdStr] ? 'transform rotate-180' : ''}`} />
                                  </button>
                                  
                                  {assigneeDropdownOpen[questionIdStr] && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                                      <div className="p-2 border-b border-gray-200">
                                        <div className="relative">
                                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                          <input
                                            type="text"
                                            value={assigneeSearchQuery[questionIdStr] || ''}
                                            onChange={(e) => {
                                              setAssigneeSearchQuery(prev => ({
                                                ...prev,
                                                [questionIdStr]: e.target.value
                                              }))
                                            }}
                                            placeholder="Search users..."
                                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            autoFocus
                                          />
                                        </div>
                                      </div>
                                      <div className="max-h-48 overflow-y-auto">
                                        {vendorUsers.length > 0 ? (
                                          vendorUsers.map((vendorUser: any) => (
                                            <button
                                              key={vendorUser.id}
                                              type="button"
                                              onClick={() => handleAssignQuestion(questionIdStr, vendorUser.id)}
                                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                                            >
                                              <div className="font-medium text-gray-900">{vendorUser.name}</div>
                                              <div className="text-xs text-gray-500">{vendorUser.email}</div>
                                            </button>
                                          ))
                                        ) : (
                                          <div className="px-4 py-8 text-center text-sm text-gray-500">
                                            {activeSearchQuery ? 'No users found' : 'Start typing to search users...'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                                  </td>
                                )
                              }
                              
                              if (col.id === 'vendor_answer') {
                                return (
                                  <td key={col.id} className="px-4 py-3">
                              {isReadOnly ? (
                                <div className="text-sm text-gray-900 max-w-md">
                                  {(() => {
                                    // Format answer based on question type for display
                                    if (question.response_type === 'File' || question.field_type === 'file') {
                                      // Show file names if files are uploaded
                                      if (response.documents && response.documents.length > 0) {
                                        return (
                                          <div className="space-y-1">
                                            {response.documents.map((doc: any, idx: number) => (
                                              <div key={idx} className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                <span className="text-gray-700">{doc.name || doc.path || `File ${idx + 1}`}</span>
                                                {doc.size && (
                                                  <span className="text-xs text-gray-500">
                                                    ({(doc.size / 1024).toFixed(1)} KB)
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )
                                      }
                                      return <span className="text-gray-400 italic">No file uploaded</span>
                                    }
                                    
                                    // Handle URL type
                                    if (question.response_type === 'URL' || question.field_type === 'url') {
                                      if (vendorAnswer) {
                                        return (
                                          <a 
                                            href={vendorAnswer} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-blue-600 hover:underline break-all"
                                          >
                                            {vendorAnswer}
                                          </a>
                                        )
                                      }
                                      return <span className="text-gray-400 italic">No URL provided</span>
                                    }
                                    
                                    // Handle number type
                                    if (question.response_type === 'Number' || question.field_type === 'number') {
                                      return vendorAnswer ? (
                                        <span className="font-mono">{vendorAnswer}</span>
                                      ) : (
                                        <span className="text-gray-400 italic">No number provided</span>
                                      )
                                    }
                                    
                                    // Handle date type
                                    if (question.response_type === 'Date' || question.field_type === 'date') {
                                      return vendorAnswer ? (
                                        <span>{vendorAnswer}</span>
                                      ) : (
                                        <span className="text-gray-400 italic">No date provided</span>
                                      )
                                    }
                                    
                                    // Handle radio/select - show selected option label
                                    if ((question.field_type === 'radio' || question.field_type === 'select') && question.options) {
                                      if (vendorAnswer) {
                                        const selectedOption = question.options.find((opt: any) => {
                                          const optValue = typeof opt === 'string' ? opt : opt.value
                                          return optValue === vendorAnswer
                                        })
                                        if (selectedOption) {
                                          const optLabel = typeof selectedOption === 'string' ? selectedOption : selectedOption.label || selectedOption.value
                                          return <span className="font-medium">{optLabel}</span>
                                        }
                                      }
                                      return <span className="text-gray-400 italic">No selection made</span>
                                    }
                                    
                                    // Handle checkbox/multi-select - show selected option labels
                                    if ((question.field_type === 'checkbox' || question.field_type === 'multi_select') && question.options) {
                                      if (vendorAnswer) {
                                        const selectedValues = Array.isArray(response.value) ? response.value : [response.value].filter(Boolean)
                                        if (selectedValues.length > 0) {
                                          const selectedLabels = selectedValues.map((val: any) => {
                                            const opt = (question.options || []).find((opt: any) => {
                                              const optValue = typeof opt === 'string' ? opt : opt.value
                                              return optValue === val
                                            })
                                            return opt ? (typeof opt === 'string' ? opt : opt.label || opt.value) : val
                                          })
                                          return (
                                            <div className="flex flex-wrap gap-1">
                                              {selectedLabels.map((label: string, idx: number) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                  {label}
                                                </span>
                                              ))}
                                            </div>
                                          )
                                        }
                                      }
                                      return <span className="text-gray-400 italic">No selections made</span>
                                    }
                                    
                                    // Default: text/textarea - show with proper formatting
                                    return vendorAnswer ? (
                                      <div className="whitespace-pre-wrap leading-relaxed">{vendorAnswer}</div>
                                    ) : (
                                      <span className="text-gray-400 italic">No answer provided</span>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {(() => {
                                    // Handle file upload type
                                    if (question.response_type === 'File' || question.field_type === 'file') {
                                      return (
                                        <div className="space-y-2">
                                          {response.documents && response.documents.length > 0 && (
                                            <div className="space-y-1">
                                              {(response.documents || []).map((doc: any, docIndex: number) => (
                                                <div key={docIndex} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
                                                  <FileText className="w-4 h-4 text-gray-500" />
                                                  <span className="text-gray-700 flex-1">{doc.name || doc.path || `Document ${docIndex + 1}`}</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const questionIdStr = String(question.id)
                                                      const newDocs = (response.documents || []).filter((_: any, i: number) => i !== docIndex)
                                                      setResponses(prev => ({
                                                        ...prev,
                                                        [questionIdStr]: { ...prev[questionIdStr] || {}, documents: newDocs }
                                                      }))
                                                    }}
                                                    className="text-red-600 hover:text-red-800"
                                                  >
                                                    <X className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const input = document.createElement('input')
                                              input.type = 'file'
                                              input.multiple = true
                                              input.onchange = (e: any) => {
                                                const files = Array.from(e.target.files || []) as File[]
                                                const questionIdStr = String(question.id)
                                                const newDocs = files.map((file: File) => ({
                                                  name: file.name,
                                                  file,
                                                  id: `${Date.now()}-${Math.random()}`,
                                                  size: file.size,
                                                  type: file.type
                                                }))
                                                setResponses(prev => ({
                                                  ...prev,
                                                  [questionIdStr]: {
                                                    ...prev[questionIdStr] || {},
                                                    documents: [...(prev[questionIdStr]?.documents || []), ...newDocs]
                                                  }
                                                }))
                                              }
                                              input.click()
                                            }}
                                            className="w-full"
                                          >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload File
                                          </Button>
                                        </div>
                                      )
                                    }
                                    
                                    // Handle textarea type
                                    if (question.field_type === 'textarea') {
                                      return (
                                        <textarea
                                          value={response.value || ''}
                                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                          disabled={isReadOnly}
                                          placeholder="Enter your detailed response..."
                                          rows={4}
                                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                      )
                                    }
                                    
                                    // Handle number type
                                    if (question.field_type === 'number' || question.response_type === 'Number') {
                                      return (
                                        <Input
                                          type="number"
                                          value={response.value || ''}
                                          onChange={(e) => handleResponseChange(question.id, e.target.value ? parseFloat(e.target.value) : '')}
                                          disabled={isReadOnly}
                                          placeholder="Enter a number..."
                                          className="w-full"
                                        />
                                      )
                                    }
                                    
                                    // Handle date type
                                    if (question.field_type === 'date' || question.response_type === 'Date') {
                                      return (
                                        <Input
                                          type="date"
                                          value={response.value || ''}
                                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                          disabled={isReadOnly}
                                          className="w-full"
                                        />
                                      )
                                    }
                                    
                                    // Handle email type
                                    if (question.field_type === 'email') {
                                      return (
                                        <Input
                                          type="email"
                                          value={response.value || ''}
                                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                          disabled={isReadOnly}
                                          placeholder="Enter email address..."
                                          className="w-full"
                                        />
                                      )
                                    }
                                    
                                    // Handle URL type
                                    if (question.field_type === 'url' || question.response_type === 'URL') {
                                      return (
                                        <Input
                                          type="url"
                                          value={response.value || ''}
                                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                          disabled={isReadOnly}
                                          placeholder="Enter URL (e.g., https://example.com)..."
                                          className="w-full"
                                        />
                                      )
                                    }
                                    
                                    // Handle radio buttons (including Yes/No)
                                    if (question.field_type === 'radio' && question.options && question.options.length > 0) {
                                      return (
                                        <div className="flex flex-wrap gap-4">
                                          {question.options.map((opt: any) => {
                                            const optValue = typeof opt === 'string' ? opt : opt.value
                                            const optLabel = typeof opt === 'string' ? opt : opt.label || optValue
                                            const isSelected = response.value === optValue
                                            return (
                                              <label key={optValue} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-3 py-2 rounded transition-colors">
                                                <input
                                                  type="radio"
                                                  name={`question-${question.id}`}
                                                  value={optValue}
                                                  checked={isSelected}
                                                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                                  disabled={isReadOnly}
                                                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                />
                                                <span className="text-gray-700">{optLabel}</span>
                                              </label>
                                            )
                                          })}
                                        </div>
                                      )
                                    }
                                    
                                    // Handle select/dropdown
                                    if (question.field_type === 'select') {
                                      return (
                                        <select
                                          value={response.value || ''}
                                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                          disabled={isReadOnly}
                                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                        >
                                          <option value="">Select an option...</option>
                                          {question.options?.map((opt: any) => {
                                            const optValue = typeof opt === 'string' ? opt : opt.value
                                            const optLabel = typeof opt === 'string' ? opt : opt.label || optValue
                                            return (
                                              <option key={optValue} value={optValue}>{optLabel}</option>
                                            )
                                          })}
                                        </select>
                                      )
                                    }
                                    
                                    // Handle checkbox/multi-select
                                    if (question.field_type === 'checkbox' || question.field_type === 'multi_select') {
                                      return (
                                        <div className="space-y-2 border border-gray-200 rounded-md p-3 bg-gray-50">
                                          {question.options && question.options.length > 0 ? (
                                            question.options.map((opt: any) => {
                                              const optValue = typeof opt === 'string' ? opt : opt.value
                                              const optLabel = typeof opt === 'string' ? opt : opt.label || optValue
                                              const isChecked = Array.isArray(response.value) 
                                                ? response.value.includes(optValue)
                                                : response.value === optValue
                                              return (
                                                <label key={optValue} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                      if (question.field_type === 'multi_select') {
                                                        const currentValues = Array.isArray(response.value) ? response.value : (response.value ? [response.value] : [])
                                                        const newValues = e.target.checked
                                                          ? [...currentValues, optValue]
                                                          : currentValues.filter((v: any) => v !== optValue)
                                                        handleResponseChange(question.id, newValues.length > 0 ? newValues : '')
                                                      } else {
                                                        handleResponseChange(question.id, e.target.checked ? optValue : '')
                                                      }
                                                    }}
                                                    disabled={isReadOnly}
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                  />
                                                  <span className="text-gray-700">{optLabel}</span>
                                                </label>
                                              )
                                            })
                                          ) : (
                                            <p className="text-xs text-gray-500 italic">No options configured for this question</p>
                                          )}
                                        </div>
                                      )
                                    }
                                    
                                    // Default: text input
                                    return (
                                      <Input
                                        type="text"
                                        value={response.value || ''}
                                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="Enter your response..."
                                        className="w-full"
                                      />
                                    )
                                  })()}
                                </div>
                              )}
                                  </td>
                                )
                              }
                              
                              if (col.id === 'comments') {
                                return (
                                  <td key={col.id} className="px-4 py-3">
                              <div className="space-y-2">
                                {isReadOnly ? (
                                  <>
                                    {vendorComment && (
                                      <div className="text-sm text-gray-900 whitespace-pre-wrap max-w-md">
                                        {vendorComment}
                                      </div>
                                    )}
                                    {reviewerComment && (
                                      <div className="text-sm text-blue-700 whitespace-pre-wrap max-w-md">
                                        <div className="font-medium mb-1">Reviewer:</div>
                                        {reviewerComment}
                                      </div>
                                    )}
                                    {!vendorComment && !reviewerComment && (
                                      <span className="text-gray-400 text-sm italic">No comments</span>
                                    )}
                                  </>
                                ) : (
                                  <textarea
                                    value={response.comment || ''}
                                    onChange={(e) => {
                                      const questionIdStr = String(question.id)
                                      setResponses(prev => ({
                                        ...prev,
                                        [questionIdStr]: { ...prev[questionIdStr] || {}, comment: e.target.value }
                                      }))
                                    }}
                                    disabled={isReadOnly}
                                    placeholder="Add a comment..."
                                    className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                                  />
                                )}
                              </div>
                                  </td>
                                )
                              }
                              
                              if (col.id === 'attachments') {
                                return (
                                  <td key={col.id} className="px-4 py-3">
                              <div className="space-y-2">
                                {(() => {
                                  // For file type questions, attachments are shown in the vendor answer column
                                  const isFileType = question.response_type === 'File' || question.field_type === 'file'
                                  
                                  // Show attachments that are not part of the answer (supporting documents)
                                  const supportingDocs = isFileType ? [] : (response.documents || [])
                                  
                                  if (supportingDocs.length > 0) {
                                    return (
                                      <div className="space-y-1">
                                        {supportingDocs.map((doc: any, docIndex: number) => (
                                          <div key={docIndex} className="flex items-center gap-2 text-sm">
                                            <FileText className="w-4 h-4 text-gray-500" />
                                            <span className="text-gray-700">{doc.name || doc.path || `Document ${docIndex + 1}`}</span>
                                            {doc.size && (
                                              <span className="text-xs text-gray-500">
                                                ({(doc.size / 1024).toFixed(1)} KB)
                                              </span>
                                            )}
                                            {!isReadOnly && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const questionIdStr = String(question.id)
                                                  const newDocs = supportingDocs.filter((_: any, i: number) => i !== docIndex)
                                                  setResponses(prev => ({
                                                    ...prev,
                                                    [questionIdStr]: { ...prev[questionIdStr] || {}, documents: newDocs }
                                                  }))
                                                }}
                                                className="text-red-600 hover:text-red-800 ml-auto"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  }
                                  
                                  if (isFileType) {
                                    return <span className="text-gray-400 text-sm italic">Files shown in answer column</span>
                                  }
                                  
                                  return <span className="text-gray-400 text-sm italic">No attachments</span>
                                })()}
                                {!isReadOnly && question.response_type !== 'File' && question.field_type !== 'file' && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const input = document.createElement('input')
                                      input.type = 'file'
                                      input.multiple = true
                                      input.onchange = (e: any) => {
                                        const files = Array.from(e.target.files || []) as File[]
                                        const questionIdStr = String(question.id)
                                        const newDocs = files.map((file: File) => ({
                                          name: file.name,
                                          file,
                                          id: `${Date.now()}-${Math.random()}`,
                                          size: file.size,
                                          type: file.type
                                        }))
                                        setResponses(prev => ({
                                          ...prev,
                                          [questionIdStr]: {
                                            ...prev[questionIdStr] || {},
                                            documents: [...(prev[questionIdStr]?.documents || []), ...newDocs]
                                          }
                                        }))
                                      }
                                      input.click()
                                    }}
                                    className="mt-2"
                                  >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Supporting Document
                                  </Button>
                                )}
                              </div>
                                  </td>
                                )
                              }
                              
                              // Unknown column type - render empty cell
                              return <td key={col.id} className="px-4 py-3"></td>
                            })}
                          </tr>
                        )
                      })
                    })

                    return rows
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!isReadOnly && isVendor && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saveDraftMutation.isPending}
                  className="border-border hover:bg-muted hover:border-primary/50"
                >
                  {saveDraftMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save as Draft
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || answeredCount < questions.length}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Assessment
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overall Assessment Actions for Approvers */}
        {isApprover && isReadOnly && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-end gap-3">
                <Button 
                  variant="outline" 
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workflow History (for read-only approved/completed assignments) */}
        {isReadOnly && workflowHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Workflow History
              </CardTitle>
              <CardDescription>Complete audit trail of all actions taken on this assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowHistory.map((historyItem: any, index: number) => (
                  <div key={historyItem.id || index} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {(() => {
                            const actionType = historyItem.action_type
                            if (actionType === 'submitted') return 'Assessment Submitted'
                            if (actionType === 'resubmitted') return 'Assessment Resubmitted'
                            if (actionType === 'approved') return 'Assessment Approved'
                            if (actionType === 'rejected') return 'Assessment Rejected'
                            if (actionType === 'status_changed') return `Status Changed: ${historyItem.previous_status} → ${historyItem.new_status}`
                            if (actionType === 'forwarded') return 'Assessment Forwarded'
                            return actionType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || actionType
                          })()}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {historyItem.action_at ? new Date(historyItem.action_at).toLocaleString() : ''}
                        </span>
                      </div>
                      {historyItem.action_by && (
                        <p className="text-xs text-muted-foreground">
                          By: {historyItem.action_by.name || historyItem.action_by.email || 'Unknown'} 
                          {historyItem.action_by.email && historyItem.action_by.name && ` (${historyItem.action_by.email})`}
                        </p>
                      )}
                      {historyItem.comments && (
                        <p className="text-sm mt-2 p-2 bg-muted rounded-md">{historyItem.comments}</p>
                      )}
                      {historyItem.decision_comment && (
                        <p className="text-sm mt-2 p-2 bg-muted rounded-md">
                          <span className="font-medium">Decision Comment:</span> {historyItem.decision_comment}
                        </p>
                      )}
                      {historyItem.forwarded_to && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Forwarded to: {historyItem.forwarded_to.name || historyItem.forwarded_to.email || 'Unknown'}
                          {historyItem.forwarded_to.email && historyItem.forwarded_to.name && ` (${historyItem.forwarded_to.email})`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}
