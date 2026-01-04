import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialInput, MaterialCard, MaterialChip } from '../components/material'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import CommentDialog from '../components/CommentDialog'
import { showToast } from '../utils/toast'
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Eye,
  History,
  Send,
  User,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Users,
  X,
  Workflow,
  Paperclip,
  ExternalLink,
  Download
} from 'lucide-react'

interface AssessmentApproverPageProps {}

export default function AssessmentApproverPage({}: AssessmentApproverPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'workflow'>('details')
  const [showSidebar, setShowSidebar] = useState(true)
  const [decisionComment, setDecisionComment] = useState('')
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<'accepted' | 'denied' | 'need_info' | null>(null)
  // Assessment approver view is locked to use assessment questions directly (no form layouts)
  // Questions are loaded directly from the assessment, ensuring approvers see exactly what was submitted
  const [approvalFormData, setApprovalFormData] = useState<Record<string, any>>({})
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [forwardQuestionIds, setForwardQuestionIds] = useState<string[]>([])
  const [forwardUserId, setForwardUserId] = useState('')
  const [forwardComment, setForwardComment] = useState('')
  
  // Dialog state for question review actions (Deny/More Info)
  const [showQuestionReviewDialog, setShowQuestionReviewDialog] = useState(false)
  const [pendingQuestionReview, setPendingQuestionReview] = useState<{
    questionId: string
    action: 'deny' | 'more_info'
  } | null>(null)
  
  // Team assignment dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignQuestionId, setAssignQuestionId] = useState<string | null>(null)
  const [assignUserSearch, setAssignUserSearch] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const questionsPerPage = 5 // Compact view - 5 questions per page
  
  // Fetch users for assignment
  const { data: assignableUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['assignable-users', id, assignUserSearch],
    queryFn: async () => {
      if (!id) return []
      return assessmentsApi.searchVendorUsers(id, assignUserSearch || undefined)
    },
    enabled: !!id && showAssignDialog,
    staleTime: 5 * 60 * 1000,
  })
  
  // Fetch question owners
  const { data: questionOwners = {} } = useQuery({
    queryKey: ['question-owners', id],
    queryFn: () => assessmentsApi.getQuestionOwners(id!),
    enabled: !!id,
  })

  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Fetch assignment details FIRST (needed by other queries)
  const { data: assignment, isLoading: assignmentLoading, error: assignmentError } = useQuery({
    queryKey: ['assessment-assignment-approver', id],
    queryFn: () => assessmentsApi.getAssignmentStatus(id!),
    enabled: !!id,
  })

  // Fetch assessment questions and responses (needed by formData useMemo)
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['assessment-questions-approver', id, assignment?.assessment_id],
    queryFn: () => assessmentsApi.getAssignmentQuestions(id!),
    enabled: !!id, // Enable as soon as we have the assignment ID
  })

  // Fetch responses (needed by formData useMemo)
  const { data: responses, isLoading: responsesLoading } = useQuery({
    queryKey: ['assessment-responses-approver', id],
    queryFn: () => assessmentsApi.getAssignmentResponses(id!),
    enabled: !!id,
  })

  // Assessment approver view is locked to use assessment questions directly
  // No form layouts - always show questions as they exist in the assessment
  // This ensures approvers see exactly what was submitted, based on the assessment definition

  // Map assessment responses for display
  // Use defensive checks to handle undefined values during initial render
  const formData = useMemo(() => {
    // Defensive check - ensure responses and questions are defined
    const safeResponses = responses || {}
    const safeQuestions = questions || []
    
    if (!safeQuestions.length) return {}
    
    const data: Record<string, any> = {}
    safeQuestions.forEach((question: any) => {
      const questionIdStr = String(question.id)
      const response = safeResponses[questionIdStr]
      if (response) {
        // Map question responses to form fields
        // Use question field_name if available, otherwise use question id
        const fieldName = question.field_name || `question_${question.id}`
        data[fieldName] = response.value
        if (response.comment) {
          data[`${fieldName}_comment`] = response.comment
        }
      }
    })
    
    // Add assignment metadata
    if (assignment) {
      data.assessment_name = assignment.assessment_name
      data.assessment_type = assignment.assessment_type
      data.status = assignment.status
      data.completed_at = assignment.completed_at
    }
    
    // Merge with approval form data
    return { ...data, ...approvalFormData }
  }, [responses, questions, assignment, approvalFormData])

  // Fetch question reviews
  const { data: questionReviewsData } = useQuery({
    queryKey: ['question-reviews-approver', id],
    queryFn: () => assessmentsApi.getQuestionReviews(id!),
    enabled: !!id,
  })

  // Fetch assignment reviews/audit
  const { data: assignmentReviews } = useQuery({
    queryKey: ['assignment-reviews-approver', id],
    queryFn: () => assessmentsApi.getAssignmentReviews(id!),
    enabled: !!id,
  })

  // Get latest review ID for audit trail
  const latestReviewId = assignmentReviews && assignmentReviews.length > 0 ? assignmentReviews[0].id : null

  const { data: reviewAudit } = useQuery({
    queryKey: ['review-audit-approver', latestReviewId],
    queryFn: () => latestReviewId ? assessmentsApi.getReviewAuditTrail(latestReviewId) : Promise.resolve([]),
    enabled: !!latestReviewId,
  })

  // Fetch workflow history
  const { data: workflowHistory = [], isLoading: workflowHistoryLoading } = useQuery({
    queryKey: ['workflow-history-approver', id],
    queryFn: () => assessmentsApi.getWorkflowHistory(id!),
    enabled: !!id,
  })

  // Question review mutation
  const reviewQuestionMutation = useMutation({
    mutationFn: ({ questionId, status, comment }: {
      questionId: string
      status: 'pass' | 'fail' | 'in_progress'
      comment?: string
    }) => assessmentsApi.reviewQuestion(id!, questionId, status, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-reviews-approver', id] })
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', id] })
      showToast.success('Question review saved')
    },
    onError: (err: any) => {
      showToast.error(err?.response?.data?.detail || err.message || 'Failed to review question')
    }
  })

  // Decision mutation
  const submitDecisionMutation = useMutation({
    mutationFn: ({ decision, comment, forward_to_user_id }: {
      decision: 'accepted' | 'denied' | 'need_info'
      comment?: string
      forward_to_user_id?: string
    }) => assessmentsApi.submitFinalDecision(id!, decision, comment, forward_to_user_id),
    onSuccess: (result) => {
      console.log('Decision submitted successfully:', result)
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', id] })
      queryClient.invalidateQueries({ queryKey: ['assignment-reviews-approver', id] })
      queryClient.invalidateQueries({ queryKey: ['question-reviews-approver', id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-history-approver', id] })
      showToast.success(`Assessment ${result.decision || result.mapped_decision || 'decision submitted'}`)
      setShowDecisionDialog(false)
      setDecisionComment('')
      setPendingDecision(null)
      // Navigate back to inbox after successful decision
      setTimeout(() => navigate('/my-actions'), 2000)
    },
    onError: (err: any) => {
      console.error('Decision submission error:', err)
      const errorMessage = err?.response?.data?.detail || err.message || 'Failed to submit decision'
      showToast.error(errorMessage)
    }
  })

  // Check if user is an approver
  const isApprover = user && ['approver', 'tenant_admin', 'platform_admin'].includes(user.role)

  // Calculate review statistics
  const reviewStats = React.useMemo(() => {
    if (!questionReviewsData?.question_reviews) return { pass: 0, fail: 0, in_progress: 0, pending: 0 }

    const reviews = Object.values(questionReviewsData.question_reviews) as any[]
    return reviews.reduce((acc, review: any) => {
      const status = review.status || 'pending'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, { pass: 0, fail: 0, in_progress: 0, pending: 0 })
  }, [questionReviewsData])

  // Check if all questions are accepted (enables overall Accept button)
  const allQuestionsAccepted = React.useMemo(() => {
    if (!questionReviewsData?.question_reviews || questions.length === 0) return false
    const reviews = Object.values(questionReviewsData.question_reviews) as any[]
    const acceptedCount = reviews.filter((r: any) => r.status === 'pass').length
    return acceptedCount === questions.length && acceptedCount > 0
  }, [questionReviewsData, questions])

  // Organize questions by status
  const questionsByStatus = React.useMemo(() => {
    const accepted: any[] = []
    const needsAttention: any[] = [] // Denied or More Info
    const pending: any[] = []

    questions.forEach((question: any) => {
      const questionIdStr = String(question.id)
      const review = questionReviewsData?.question_reviews?.[question.id]
      
      if (review?.status === 'pass') {
        accepted.push(question)
      } else if (review?.status === 'fail' || review?.status === 'in_progress') {
        needsAttention.push(question)
      } else {
        pending.push(question)
      }
    })

    return { accepted, needsAttention, pending }
  }, [questions, questionReviewsData])

  const handleDecisionClick = (decision: 'accepted' | 'denied' | 'need_info') => {
    setPendingDecision(decision)
    setShowDecisionDialog(true)
  }

  const handleDecisionSubmit = () => {
    if (!pendingDecision) return

    // Get comment from form data if available, otherwise use decisionComment
    const comment = approvalFormData.approval_notes || 
                    approvalFormData.review_notes || 
                    approvalFormData.decision_comment || 
                    decisionComment

    // Require comment for deny and need_info
    if ((pendingDecision === 'denied' || pendingDecision === 'need_info') && !comment?.trim()) {
      showToast.error('Comment is required for this decision')
      return
    }

    console.log('Submitting decision:', { decision: pendingDecision, comment, assignmentId: id })
    
    submitDecisionMutation.mutate({
      decision: pendingDecision,
      comment: comment?.trim() || undefined
    }, {
      onError: (error: any) => {
        console.error('Decision submission error:', error)
        showToast.error(error?.response?.data?.detail || error.message || 'Failed to submit decision')
      }
    })
  }

  // Forward mutation
  const forwardMutation = useMutation({
    mutationFn: ({ questionIds, userId, comment }: { questionIds?: string[], userId: string, comment?: string }) =>
      assessmentsApi.forwardQuestions(id!, userId, questionIds, comment),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-history-approver', id] })
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', id] })
      showToast.success(result.message || 'Assessment forwarded successfully')
      setShowForwardDialog(false)
      setForwardQuestionIds([])
      setForwardUserId('')
      setForwardComment('')
    },
    onError: (err: any) => {
      showToast.error(err?.response?.data?.detail || err.message || 'Failed to forward assessment')
    }
  })

  // Question assignment mutation
  const assignQuestionMutation = useMutation({
    mutationFn: ({ questionId, ownerData }: { questionId: string, ownerData: { owner_id?: string; owner_email?: string; owner_name?: string } }) =>
      assessmentsApi.assignQuestionOwner(id!, questionId, ownerData),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['question-owners', id] })
      queryClient.invalidateQueries({ queryKey: ['assessment-assignment-approver', id] })
      showToast.success(`Question assigned to ${result.owner_name || result.owner_email}`)
      setShowAssignDialog(false)
      setAssignQuestionId(null)
      setAssignUserId('')
      setAssignUserSearch('')
    },
    onError: (err: any) => {
      showToast.error(err?.response?.data?.detail || err.message || 'Failed to assign question')
    }
  })

  // Helper function to render question options (for select/radio/checkbox) - Compact horizontal layout
  const renderQuestionOptions = (question: any, response: any) => {
    if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
      return null
    }

    const fieldType = question.field_type || question.response_type
    const isMultiSelect = fieldType === 'multi_select' || fieldType === 'checkbox'
    const responseValue = response?.value
    const selectedValues = Array.isArray(responseValue) ? responseValue : (responseValue ? [responseValue] : [])

    return (
      <div className="mt-1.5">
        <div className="text-xs text-gray-400 mb-1">Options</div>
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((option: any, optIndex: number) => {
            const optionValue = typeof option === 'string' ? option : (option.value || option.label || option)
            const optionLabel = typeof option === 'string' ? option : (option.label || option.value || option)
            const isSelected = selectedValues.some((val: any) => String(val) === String(optionValue))

            return (
              <div
                key={optIndex}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isSelected && <CheckCircle className="w-3 h-3" />}
                <span>{optionLabel}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  
  // Pagination logic
  const allQuestions = useMemo(() => {
    const needsAttention = questionsByStatus.needsAttention || []
    const pending = questionsByStatus.pending || []
    const accepted = questionsByStatus.accepted || []
    return [...needsAttention, ...pending, ...accepted]
  }, [questionsByStatus])
  
  const totalPages = Math.ceil(allQuestions.length / questionsPerPage)
  const startIndex = (currentPage - 1) * questionsPerPage
  const endIndex = startIndex + questionsPerPage
  const paginatedQuestions = allQuestions.slice(startIndex, endIndex)
  
  // Reset to page 1 when questions change
  useEffect(() => {
    setCurrentPage(1)
  }, [allQuestions.length])

  // Handle question assignment
  const handleAssignClick = (questionId: string) => {
    setAssignQuestionId(questionId)
    setShowAssignDialog(true)
    setAssignUserSearch('')
    setAssignUserId('')
  }

  const handleAssignSubmit = () => {
    if (!assignQuestionId || !assignUserId) {
      showToast.error('Please select a user to assign')
      return
    }

    const selectedUser = assignableUsers.find((u: any) => u.id === assignUserId)
    if (!selectedUser) {
      showToast.error('Selected user not found')
      return
    }

    assignQuestionMutation.mutate({
      questionId: assignQuestionId,
      ownerData: { owner_id: assignUserId }
    })
  }

  const handleForwardClick = (questionIds?: string[]) => {
    setForwardQuestionIds(questionIds || [])
    setShowForwardDialog(true)
  }

  const handleForwardSubmit = () => {
    if (!forwardUserId.trim()) {
      showToast.error('Please enter a user ID to forward to')
      return
    }

    forwardMutation.mutate({
      questionIds: forwardQuestionIds.length > 0 ? forwardQuestionIds : undefined,
      userId: forwardUserId,
      comment: forwardComment || undefined
    })
  }

  // Handle opening question review dialog (for Deny/More Info)
  const handleQuestionReviewClick = (questionId: string, action: 'deny' | 'more_info') => {
    setPendingQuestionReview({ questionId, action })
    setShowQuestionReviewDialog(true)
  }

  // Handle submitting question review from dialog
  const handleQuestionReviewSubmit = (comment: string) => {
    if (!pendingQuestionReview) return
    
    const status = pendingQuestionReview.action === 'deny' ? 'fail' : 'in_progress'
    reviewQuestionMutation.mutate({ 
      questionId: pendingQuestionReview.questionId, 
      status, 
      comment 
    })
    
    setShowQuestionReviewDialog(false)
    setPendingQuestionReview(null)
  }

  // Handle individual question review (for Accept - no comment needed)
  const handleQuestionReview = (questionId: string, status: 'pass' | 'fail' | 'in_progress', comment?: string) => {
    reviewQuestionMutation.mutate({ questionId, status, comment })
  }

  const getDecisionButtonColor = (decision: string) => {
    switch (decision) {
      case 'accepted': return 'success'
      case 'denied': return 'error'
      case 'need_info': return 'warning'
      default: return 'primary'
    }
  }

  const getDecisionButtonText = (decision: string) => {
    switch (decision) {
      case 'accepted': return 'Accept Assessment'
      case 'denied': return 'Deny Assessment'
      case 'need_info': return 'Request More Info'
      default: return decision
    }
  }

  if (assignmentLoading || questionsLoading || responsesLoading) {
    return (
      <Layout user={user}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    )
  }

  if (!assignment || assignmentError) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-red-900 mb-2">Assessment Not Found</h2>
            <p className="text-red-700">The assessment you're looking for doesn't exist or you don't have access to it.</p>
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

  if (!isApprover) {
    return (
      <Layout user={user}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-yellow-900 mb-2">Access Denied</h2>
            <p className="text-yellow-700">You don't have permission to access the assessment approval interface.</p>
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

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto p-6 relative">
        {/* Right Side Floating Icon Menu */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
          <button
            onClick={() => setActiveTab('history')}
            className={`p-3 rounded-full shadow-lg border-2 transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400'
            }`}
            title="View History & Audit"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`p-3 rounded-full shadow-lg border-2 transition-all ${
              activeTab === 'workflow'
                ? 'bg-purple-600 text-white border-purple-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50 hover:border-purple-400'
            }`}
            title="View Workflow"
          >
            <Workflow className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`p-3 rounded-full shadow-lg border-2 transition-all ${
              activeTab === 'details'
                ? 'bg-green-600 text-white border-green-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50 hover:border-green-400'
            }`}
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
                      Assessment Approval: {assignment?.assessment_name || assignment?.assessment_id_display || `Assessment ${id}`}
                    </h1>
                    {assignment?.workflow_ticket_id && (
                      <MaterialChip color="primary" size="medium" className="!px-3 !py-1">
                        <span className="font-mono font-semibold">{assignment.workflow_ticket_id}</span>
                      </MaterialChip>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Assessment:</span> {assignment?.assessment_name || assignment?.assessment_id_display || `Assessment ${id}`}
                    </div>
                    {assignment?.workflow_ticket_id && (
                      <div>
                        <span className="font-medium">Workflow Ticket:</span> <span className="font-mono">{assignment.workflow_ticket_id}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Status:</span> {assignment?.status || 'Unknown'}
                    </div>
                    <div>
                      <span className="font-medium">Due Date:</span> {assignment?.due_date ? new Date(assignment.due_date).toLocaleString() : 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Questions:</span> {assignment?.total_questions || 0} total, {assignment?.answered_questions || 0} answered
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Statistics and Action Buttons */}
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-2">Review Status</div>
                <div className="flex gap-2 mb-4">
                  <MaterialChip color="success" size="small">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {reviewStats.pass || 0} Accepted
                  </MaterialChip>
                  <MaterialChip color="error" size="small">
                    <XCircle className="w-3 h-3 mr-1" />
                    {reviewStats.fail || 0} Denied
                  </MaterialChip>
                  <MaterialChip color="warning" size="small">
                    <HelpCircle className="w-3 h-3 mr-1" />
                    {reviewStats.in_progress || 0} More Info
                  </MaterialChip>
                </div>
                {/* Approve/Deny/Need Info Buttons in Header */}
                {isApprover && (assignment?.status === 'pending_approval' || assignment?.status === 'completed') && (
                  <div className="flex gap-2 justify-end">
                    <MaterialButton
                      onClick={() => handleDecisionClick('accepted')}
                      color="primary"
                      variant="contained"
                      size="medium"
                      disabled={submitDecisionMutation.isPending}
                      loading={submitDecisionMutation.isPending && pendingDecision === 'accepted'}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </MaterialButton>
                    <MaterialButton
                      onClick={() => handleDecisionClick('denied')}
                      color="neutral"
                      variant="outlined"
                      size="medium"
                      disabled={submitDecisionMutation.isPending}
                      loading={submitDecisionMutation.isPending && pendingDecision === 'denied'}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Deny
                    </MaterialButton>
                    <MaterialButton
                      onClick={() => handleDecisionClick('need_info')}
                      color="warning"
                      variant="outlined"
                      size="medium"
                      disabled={submitDecisionMutation.isPending}
                      loading={submitDecisionMutation.isPending && pendingDecision === 'need_info'}
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Need Info
                    </MaterialButton>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Navigation - Hidden, using floating icons instead */}
            <div className="border-b border-gray-200 hidden">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Eye className="w-4 h-4 inline mr-2" />
                  Assessment Details
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <History className="w-4 h-4 inline mr-2" />
                  History & Audit
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <>
          {activeTab === 'details' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Assessment Responses</h3>
                  {/* Assessment approver view is locked to use assessment questions directly */}
                  {/* No form layout toggle - always shows questions from assessment */}
                </div>

                {questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No questions found in this assessment.</p>
                </div>
              ) : (
                // Assessment approver view: Always use direct assessment questions (locked view)
                // Questions are loaded directly from the assessment, not from form layouts
                // This ensures approvers see exactly what was submitted based on the assessment definition
                <div className="space-y-3">
                  {/* Compact Questions Display with Pagination */}
                  {paginatedQuestions.length > 0 ? (
                    <div className="space-y-3">
                      {paginatedQuestions.map((question) => {
                        const questionIdStr = String(question.id)
                        const response = responses?.[questionIdStr]
                        const questionReview = questionReviewsData?.question_reviews?.[question.id]
                        const questionIndex = questions.findIndex((q: any) => q.id === question.id) + 1

                        return (
                          <div key={question.id} className="bg-white mb-3 pb-3 border-b border-gray-100" style={{ pageBreakInside: 'avoid' }}>
                            {/* Compact Question Header */}
                            <div className="flex items-start justify-between mb-2 gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-xs font-medium text-gray-500">
                                    Q{questionIndex} {question.is_required && <span className="text-red-500">*</span>}
                                  </span>
                                  {questionOwners[question.id] && (
                                    <span className="text-xs text-gray-400">
                                      • {questionOwners[question.id].name || questionOwners[question.id].email.split('@')[0]}
                                    </span>
                                  )}
                                  {questionReview && (
                                    <>
                                      {questionReview.status === 'fail' && (
                                        <span className="text-xs text-red-600 font-medium">• Denied</span>
                                      )}
                                      {questionReview.status === 'in_progress' && (
                                        <span className="text-xs text-yellow-600 font-medium">• More Info</span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 break-words leading-snug mb-1">
                                  {question.question_text || question.title}
                                </h3>
                                {question.description && (
                                  <p className="text-xs text-gray-400 mt-0.5 break-words line-clamp-2">
                                    {question.description}
                                  </p>
                                )}
                                
                                {/* Show Question Options (Horizontal Layout) */}
                                {renderQuestionOptions(question, response)}
                              </div>

                              {/* Action Buttons - Compact */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleAssignClick(String(question.id))}
                                  title="Assign to team member"
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                >
                                  <User className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleForwardClick([String(question.id)])}
                                  title="Forward this question"
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Response Display - Compact */}
                            <div className="mt-2 mb-2">
                              <div className="text-xs text-gray-500 mb-1">Response</div>
                              <div className="text-xs text-gray-700 break-words bg-gray-50 rounded px-2 py-1.5 line-clamp-3">
                                {response?.value ? (
                                  <div className="whitespace-pre-wrap break-words leading-snug">{String(response.value)}</div>
                                ) : (
                                  <span className="text-gray-400 italic">No response provided</span>
                                )}
                              </div>

                              {/* Attachments - Compact */}
                              {response?.documents && Array.isArray(response.documents) && response.documents.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {response.documents.map((doc: any, docIndex: number) => (
                                    <a
                                      key={docIndex}
                                      href={`${import.meta.env.VITE_API_URL || ''}/uploads/${doc.path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                    >
                                      <Paperclip className="w-2.5 h-2.5" />
                                      <span className="truncate max-w-[120px]">{doc.name || 'File'}</span>
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Links - Compact */}
                              {response?.value && typeof response.value === 'string' && (
                                (() => {
                                  const urlRegex = /(https?:\/\/[^\s]+)/g
                                  const urls = response.value.match(urlRegex)
                                  if (urls && urls.length > 0) {
                                    return (
                                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {urls.slice(0, 2).map((url: string, linkIndex: number) => (
                                          <a
                                            key={linkIndex}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                          >
                                            <ExternalLink className="w-2.5 h-2.5" />
                                            <span className="truncate max-w-[150px]">{url}</span>
                                          </a>
                                        ))}
                                        {urls.length > 2 && (
                                          <span className="text-xs text-gray-500">+{urls.length - 2} more</span>
                                        )}
                                      </div>
                                    )
                                  }
                                  return null
                                })()
                              )}

                              {/* Submitter's Comment - Compact */}
                              {response?.comment && (
                                <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                                  <div className="text-xs text-gray-500 mb-0.5">Comment</div>
                                  <div className="text-xs text-gray-600 whitespace-pre-wrap break-words line-clamp-2">
                                    {response.comment}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Review Comments - Compact */}
                            {questionReview && (questionReview.reviewer_comment || questionReview.vendor_comment) && (
                              <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-1">
                                {questionReview.reviewer_comment && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Reviewer</div>
                                    <div className="text-xs text-gray-600 whitespace-pre-wrap break-words line-clamp-2">{questionReview.reviewer_comment}</div>
                                  </div>
                                )}
                                {questionReview.vendor_comment && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-0.5">Vendor</div>
                                    <div className="text-xs text-gray-600 whitespace-pre-wrap break-words line-clamp-2">{questionReview.vendor_comment}</div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Review Actions - Compact */}
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                              <button
                                onClick={() => handleQuestionReview(String(question.id), 'pass')}
                                disabled={reviewQuestionMutation.isPending}
                                className="px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Accept
                              </button>
                              <button
                                onClick={() => handleQuestionReviewClick(String(question.id), 'deny')}
                                disabled={reviewQuestionMutation.isPending}
                                className="px-2.5 py-1 bg-white text-gray-700 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                                Deny
                              </button>
                              <button
                                onClick={() => handleQuestionReviewClick(String(question.id), 'more_info')}
                                disabled={reviewQuestionMutation.isPending}
                                className="px-2.5 py-1 bg-white text-yellow-700 text-xs font-medium rounded border border-yellow-300 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              >
                                <HelpCircle className="w-3 h-3" />
                                More Info
                              </button>
                            </div>
                          </div>
                          )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No questions to display</p>
                    </div>
                  )}
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Showing {startIndex + 1}-{Math.min(endIndex, allQuestions.length)} of {allQuestions.length} questions
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Previous
                        </button>
                        <span className="px-3 py-1.5 text-xs text-gray-700">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          Next
                          <ArrowLeft className="w-3 h-3 rotate-180" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          )}
        </>
      </div>
    </Layout>
  )
}
