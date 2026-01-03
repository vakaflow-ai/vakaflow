import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialInput, MaterialCard, MaterialChip } from '../components/material'
import { assessmentsApi } from '../lib/assessments'
import { authApi } from '../lib/auth'
import { formLayoutsApi } from '../lib/formLayouts'
import Layout from '../components/Layout'
import DynamicForm from '../components/DynamicForm'
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
  Workflow
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
  const [useDynamicForm, setUseDynamicForm] = useState(true)
  const [approvalFormData, setApprovalFormData] = useState<Record<string, any>>({})
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [forwardQuestionIds, setForwardQuestionIds] = useState<string[]>([])
  const [forwardUserId, setForwardUserId] = useState('')
  const [forwardComment, setForwardComment] = useState('')

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

  // Get form layout for assessment approval (assessment_workflow, pending_approval stage)
  const { data: approverLayout, isLoading: approverLayoutLoading } = useQuery({
    queryKey: ['assessment-approver-layout', assignment?.assessment_id],
    queryFn: async () => {
      try {
        const layout = await formLayoutsApi.getActiveForScreen(
          'assessment_workflow',
          'pending_approval'
        )
        return layout
      } catch (error) {
        console.warn('AssessmentApprover - No form layout found, using default view:', error)
        return null
      }
    },
    enabled: !!assignment?.assessment_id,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Map assessment responses to form data format for DynamicForm
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

  // Handle individual question review
  const handleQuestionReview = (questionId: string, status: 'pass' | 'fail' | 'in_progress', comment?: string) => {
    // For fail and in_progress, require a comment
    if ((status === 'fail' || status === 'in_progress') && !comment?.trim()) {
      const commentText = prompt(`Please provide a comment for ${status === 'fail' ? 'denying' : 'requesting more info on'} this question:`)
      if (!commentText?.trim()) {
        showToast.error('Comment is required for this action')
        return
      }
      reviewQuestionMutation.mutate({ questionId, status, comment: commentText })
    } else {
      reviewQuestionMutation.mutate({ questionId, status, comment })
    }
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
                      color="success"
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
                      color="error"
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
                  {approverLayout && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={useDynamicForm}
                        onChange={(e) => setUseDynamicForm(e.target.checked)}
                        className="rounded"
                      />
                      Use Form Designer Layout
                    </label>
                  )}
                </div>

                {questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No questions found in this assessment.</p>
                </div>
              ) : useDynamicForm && approverLayout ? (
                // Use DynamicForm with form designer layout
                <div className="space-y-6">
                  {approverLayoutLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                      <p className="mt-2 text-gray-500">Loading form layout...</p>
                    </div>
                  ) : (
                    <DynamicForm
                      requestType="approver"
                      formData={{ 
                        ...formData, 
                        ...approvalFormData,
                        questions: questions, // Pass questions to DynamicForm
                        responses: responses, // Pass responses to DynamicForm
                        questionReviews: questionReviewsData?.question_reviews || {} // Pass question reviews
                      }}
                      onChange={(fieldName, value) => {
                        setApprovalFormData(prev => ({ ...prev, [fieldName]: value }))
                      }}
                      readOnly={false} // Allow editing approval notes
                      assignmentId={id} // Pass assignment ID for assessment response grid
                    />
                  )}
                </div>
              ) : (
                // Fallback to default question/response view - Organized by status
                <div className="space-y-8">
                  {/* Questions Needing Attention (Denied or More Info) - Show First */}
                  {questionsByStatus.needsAttention.length > 0 && (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-yellow-600" />
                          <h4 className="text-lg font-semibold text-yellow-900">
                            Needs Attention ({questionsByStatus.needsAttention.length})
                          </h4>
                        </div>
                        <MaterialButton
                          variant="outlined"
                          size="small"
                          onClick={() => handleForwardClick(questionsByStatus.needsAttention.map((q: any) => String(q.id)))}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Forward All
                        </MaterialButton>
                      </div>
                      <div className="space-y-4">
                        {questionsByStatus.needsAttention.map((question) => {
                          const questionIdStr = String(question.id)
                          const response = responses?.[questionIdStr]
                          const questionReview = questionReviewsData?.question_reviews?.[question.id]
                          const questionIndex = questions.findIndex((q: any) => q.id === question.id) + 1

                          return (
                            <div key={question.id} className="border-2 border-yellow-300 bg-yellow-50 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-yellow-900">
                                    Question {questionIndex}
                                    {question.is_required && <span className="text-red-500 ml-1">*</span>}
                                  </h4>
                                  <p className="text-sm text-yellow-800 mt-1">{question.question_text}</p>
                                  {question.description && (
                                    <p className="text-xs text-yellow-700 mt-1">{question.description}</p>
                                  )}
                                </div>

                                <div className="ml-4 flex items-center gap-2">
                                  {/* Review Status */}
                                  {questionReview && (
                                    <>
                                      {questionReview.status === 'fail' && (
                                        <MaterialChip color="error" size="small">
                                          <XCircle className="w-3 h-3 mr-1" />
                                          Denied
                                        </MaterialChip>
                                      )}
                                      {questionReview.status === 'in_progress' && (
                                        <MaterialChip color="warning" size="small">
                                          <HelpCircle className="w-3 h-3 mr-1" />
                                          More Info
                                        </MaterialChip>
                                      )}
                                    </>
                                  )}
                                  {/* Forward Button */}
                                  <MaterialButton
                                    variant="text"
                                    size="small"
                                    onClick={() => handleForwardClick([String(question.id)])}
                                    title="Forward this question"
                                  >
                                    <Users className="w-4 h-4" />
                                  </MaterialButton>
                                </div>
                              </div>

                              {/* Response Display */}
                              <div className="bg-white rounded p-3 mb-3">
                                <div className="text-sm text-gray-700">
                                  <strong>Response:</strong>
                                  {response?.value ? (
                                    <div className="mt-1 whitespace-pre-wrap">{String(response.value)}</div>
                                  ) : (
                                    <span className="text-gray-500 italic">No response provided</span>
                                  )}
                                </div>
                                {response?.comment && (
                                  <div className="text-sm text-gray-700 mt-2">
                                    <strong>Comment:</strong>
                                    <div className="mt-1 whitespace-pre-wrap">{response.comment}</div>
                                  </div>
                                )}
                              </div>

                              {/* Review Comments */}
                              {questionReview && (questionReview.reviewer_comment || questionReview.vendor_comment) && (
                                <div className="space-y-2">
                                  {questionReview.reviewer_comment && (
                                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                      <div className="text-sm">
                                        <strong className="text-blue-800">Reviewer Comment:</strong>
                                        <div className="mt-1 text-blue-700 whitespace-pre-wrap">{questionReview.reviewer_comment}</div>
                                      </div>
                                    </div>
                                  )}
                                  {questionReview.vendor_comment && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                      <div className="text-sm">
                                        <strong className="text-yellow-800">Vendor Response:</strong>
                                        <div className="mt-1 text-yellow-700 whitespace-pre-wrap">{questionReview.vendor_comment}</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Accepted Questions - Collapsed Section */}
                  {questionsByStatus.accepted.length > 0 && (
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="text-lg font-semibold text-green-900">
                          Accepted ({questionsByStatus.accepted.length})
                        </h4>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-700">
                          {questionsByStatus.accepted.length} question{questionsByStatus.accepted.length !== 1 ? 's' : ''} have been accepted.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Pending Questions */}
                  {questionsByStatus.pending.length > 0 && (
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-gray-600" />
                          <h4 className="text-lg font-semibold text-gray-900">
                            Pending Review ({questionsByStatus.pending.length})
                          </h4>
                        </div>
                        <MaterialButton
                          variant="outlined"
                          size="small"
                          onClick={() => handleForwardClick(questionsByStatus.pending.map((q: any) => String(q.id)))}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Forward All
                        </MaterialButton>
                      </div>
                      <div className="space-y-4">
                        {questionsByStatus.pending.map((question) => {
                          const questionIdStr = String(question.id)
                          const response = responses?.[questionIdStr]
                          const questionReview = questionReviewsData?.question_reviews?.[question.id]
                          const questionIndex = questions.findIndex((q: any) => q.id === question.id) + 1

                          return (
                            <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    Question {questionIndex}
                                    {question.is_required && <span className="text-red-500 ml-1">*</span>}
                                  </h4>
                                  <p className="text-sm text-gray-700 mt-1">{question.question_text}</p>
                                  {question.description && (
                                    <p className="text-xs text-gray-600 mt-1">{question.description}</p>
                                  )}
                                </div>

                                {/* Forward Button */}
                                <MaterialButton
                                  variant="text"
                                  size="small"
                                  onClick={() => handleForwardClick([String(question.id)])}
                                  title="Forward this question"
                                >
                                  <Users className="w-4 h-4" />
                                </MaterialButton>
                              </div>

                              {/* Response Display */}
                              <div className="bg-gray-50 rounded p-3 mb-3">
                                <div className="text-sm text-gray-700">
                                  <strong>Response:</strong>
                                  {response?.value ? (
                                    <div className="mt-1 whitespace-pre-wrap">{String(response.value)}</div>
                                  ) : (
                                    <span className="text-gray-500 italic">No response provided</span>
                                  )}
                                </div>
                                {response?.comment && (
                                  <div className="text-sm text-gray-700 mt-2">
                                    <strong>Comment:</strong>
                                    <div className="mt-1 whitespace-pre-wrap">{response.comment}</div>
                                  </div>
                                )}
                              </div>

                              {/* Review Actions */}
                              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                <MaterialButton
                                  variant="outlined"
                                  color="success"
                                  size="small"
                                  onClick={() => handleQuestionReview(String(question.id), 'pass')}
                                  disabled={reviewQuestionMutation.isPending}
                                  loading={reviewQuestionMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Accept
                                </MaterialButton>
                                <MaterialButton
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  onClick={() => {
                                    const comment = prompt('Please provide a reason for denying this question:')
                                    if (comment?.trim()) {
                                      handleQuestionReview(String(question.id), 'fail', comment)
                                    }
                                  }}
                                  disabled={reviewQuestionMutation.isPending}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Deny
                                </MaterialButton>
                                <MaterialButton
                                  variant="outlined"
                                  color="warning"
                                  size="small"
                                  onClick={() => {
                                    const comment = prompt('Please specify what additional information is needed:')
                                    if (comment?.trim()) {
                                      handleQuestionReview(String(question.id), 'in_progress', comment)
                                    }
                                  }}
                                  disabled={reviewQuestionMutation.isPending}
                                >
                                  <HelpCircle className="w-4 h-4 mr-1" />
                                  More Info
                                </MaterialButton>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fallback: Show all questions if organization fails */}
                  {questionsByStatus.accepted.length === 0 && questionsByStatus.needsAttention.length === 0 && questionsByStatus.pending.length === 0 && (
                    <div className="space-y-6">
                      {questions.map((question, index) => {
                        const questionIdStr = String(question.id)
                        const response = responses?.[questionIdStr]
                        const questionReview = questionReviewsData?.question_reviews?.[question.id]

                        return (
                          <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  Question {index + 1}
                                  {question.is_required && <span className="text-red-500 ml-1">*</span>}
                                </h4>
                                <p className="text-sm text-gray-700 mt-1">{question.question_text}</p>
                                {question.description && (
                                  <p className="text-xs text-gray-600 mt-1">{question.description}</p>
                                )}
                              </div>

                              {/* Review Status */}
                              {questionReview && (
                                <div className="ml-4">
                                  {questionReview.status === 'pass' && (
                                    <MaterialChip color="success" size="small" label="Accepted">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Accepted
                                    </MaterialChip>
                                  )}
                                  {questionReview.status === 'fail' && (
                                    <MaterialChip color="error" size="small" label="Denied">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Denied
                                    </MaterialChip>
                                  )}
                                  {questionReview.status === 'in_progress' && (
                                    <MaterialChip color="warning" size="small" label="More Info">
                                      <HelpCircle className="w-3 h-3 mr-1" />
                                      More Info
                                    </MaterialChip>
                                  )}
                                </div>
                              )}
                            </div>

                        {/* Response Display */}
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-sm text-gray-700">
                            <strong>Response:</strong>
                            {response?.value ? (
                              <div className="mt-1 whitespace-pre-wrap">{String(response.value)}</div>
                            ) : (
                              <span className="text-gray-500 italic">No response provided</span>
                            )}
                          </div>
                          {response?.comment && (
                            <div className="text-sm text-gray-700 mt-2">
                              <strong>Comment:</strong>
                              <div className="mt-1 whitespace-pre-wrap">{response.comment}</div>
                            </div>
                          )}
                        </div>

                        {/* Review Comments */}
                        {questionReview && (questionReview.reviewer_comment || questionReview.vendor_comment) && (
                          <div className="mt-3 space-y-2">
                            {questionReview.reviewer_comment && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <div className="text-sm">
                                  <strong className="text-blue-800">Reviewer Comment:</strong>
                                  <div className="mt-1 text-blue-700 whitespace-pre-wrap">{questionReview.reviewer_comment}</div>
                                </div>
                              </div>
                            )}
                            {questionReview.vendor_comment && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <div className="text-sm">
                                  <strong className="text-yellow-800">Vendor Response:</strong>
                                  <div className="mt-1 text-yellow-700 whitespace-pre-wrap">{questionReview.vendor_comment}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow History</h3>

              {workflowHistoryLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="mt-2 text-gray-500">Loading workflow history...</p>
                </div>
              ) : workflowHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No workflow history available yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workflowHistory.map((item: any, index: number) => (
                    <div key={item.id || index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <MaterialChip
                              color={
                                item.action_type === 'approved' ? 'success' :
                                item.action_type === 'denied' ? 'error' :
                                item.action_type === 'sent_back' ? 'warning' :
                                item.action_type === 'forwarded' ? 'primary' : 'default'
                              }
                              size="small"
                            >
                              {item.action_type.replace('_', ' ').toUpperCase()}
                            </MaterialChip>
                            <span className="text-sm font-medium text-gray-900">
                              by {item.action_by?.name || item.action_by?.email || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              on {new Date(item.action_at).toLocaleString()}
                            </span>
                          </div>

                          {item.forwarded_to && (
                            <div className="text-sm text-gray-700 mb-2">
                              <strong>Forwarded to:</strong> {item.forwarded_to?.name || item.forwarded_to?.email || 'Unknown'}
                            </div>
                          )}

                          {item.question_ids && item.question_ids.length > 0 && (
                            <div className="text-sm text-gray-700 mb-2">
                              <strong>Questions:</strong> {item.question_ids.length} question(s)
                            </div>
                          )}

                          {item.decision_comment && (
                            <div className="text-sm text-gray-700 mb-2">
                              <strong>Comment:</strong>
                              <div className="mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{item.decision_comment}</div>
                            </div>
                          )}

                          {item.comments && item.comments !== item.decision_comment && (
                            <div className="text-sm text-gray-700 mb-2">
                              <strong>Notes:</strong>
                              <div className="mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{item.comments}</div>
                            </div>
                          )}

                          {(item.previous_status || item.new_status) && (
                            <div className="text-xs text-gray-600 mt-2">
                              Status: {item.previous_status} → {item.new_status}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {activeTab === 'workflow' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow Status</h3>
                
                {assignment && (
                  <div className="space-y-4">
                    {/* Workflow Ticket ID */}
                    {assignment.workflow_ticket_id && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Workflow Ticket ID</div>
                        <div className="font-mono text-lg font-semibold bg-blue-50 px-3 py-2 rounded border border-blue-200">
                          {assignment.workflow_ticket_id}
                        </div>
                      </div>
                    )}

                    {/* Assignment Status */}
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Status</div>
                      <div>
                        <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                          assignment.status === 'approved' ? 'bg-green-100 text-green-800' :
                          assignment.status === 'denied' ? 'bg-red-100 text-red-800' :
                          assignment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          assignment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Submitted At */}
                    {assignment.completed_at && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Submitted At</div>
                        <div className="text-sm">{new Date(assignment.completed_at).toLocaleString()}</div>
                      </div>
                    )}

                    {/* Due Date */}
                    {assignment.due_date && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Due Date</div>
                        <div className="text-sm">{new Date(assignment.due_date).toLocaleString()}</div>
                      </div>
                    )}

                    {/* Questions Summary */}
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Questions</div>
                      <div className="text-sm">
                        {assignment.total_questions || 0} total, {assignment.answered_questions || 0} answered
                      </div>
                    </div>

                    {/* Review Progress */}
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Review Progress</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                          <div className="text-lg font-bold text-green-600">{reviewStats.pass || 0}</div>
                          <div className="text-xs text-green-700">Accepted</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                          <div className="text-lg font-bold text-red-600">{reviewStats.fail || 0}</div>
                          <div className="text-xs text-red-700">Denied</div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-center">
                          <div className="text-lg font-bold text-yellow-600">{reviewStats.in_progress || 0}</div>
                          <div className="text-xs text-yellow-700">More Info</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>

        {/* Overall Approval Actions - Only shown when all questions are accepted */}
        {isApprover && allQuestionsAccepted && (
          <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-1">All Questions Accepted</h3>
                <p className="text-sm text-green-700">You can now make an overall decision on this assessment.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <MaterialButton
                onClick={() => handleDecisionClick('accepted')}
                color="success"
                variant="contained"
                size="large"
                disabled={submitDecisionMutation.isPending}
                loading={submitDecisionMutation.isPending && pendingDecision === 'accepted'}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Overall Accept
              </MaterialButton>

              <MaterialButton
                onClick={() => handleDecisionClick('denied')}
                color="error"
                variant="outlined"
                size="large"
                disabled={submitDecisionMutation.isPending}
                loading={submitDecisionMutation.isPending && pendingDecision === 'denied'}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Overall Deny
              </MaterialButton>

              <MaterialButton
                onClick={() => handleDecisionClick('need_info')}
                color="warning"
                variant="outlined"
                size="large"
                disabled={submitDecisionMutation.isPending}
                loading={submitDecisionMutation.isPending && pendingDecision === 'need_info'}
              >
                <HelpCircle className="w-5 h-5 mr-2" />
                Need Info
              </MaterialButton>
            </div>
          </div>
        )}

        {/* Action Buttons - For individual question actions */}
        {isApprover && !allQuestionsAccepted && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-900 mb-2">Review Required</h3>
            <p className="text-sm text-yellow-700 mb-4">
              Please review all questions and accept them individually. Overall Accept/Deny will be available once all questions are reviewed.
            </p>
          </div>
        )}

            {/* Review Statistics Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Review Summary</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{reviewStats.pass || 0}</div>
                  <div className="text-gray-600">Accepted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{reviewStats.fail || 0}</div>
                  <div className="text-gray-600">Denied</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{reviewStats.in_progress || 0}</div>
                  <div className="text-gray-600">More Info</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{reviewStats.pending || 0}</div>
                  <div className="text-gray-600">Pending</div>
                </div>
              </div>
            </div>

        {/* Decision Confirmation Dialog */}
        {showDecisionDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {pendingDecision === 'accepted' && <CheckCircle className="w-6 h-6 text-green-600" />}
                    {pendingDecision === 'denied' && <XCircle className="w-6 h-6 text-red-600" />}
                    {pendingDecision === 'need_info' && <MessageSquare className="w-6 h-6 text-yellow-600" />}
                  </div>
                  <h2 className="text-xl font-medium text-gray-900">
                    Confirm {getDecisionButtonText(pendingDecision || '')}
                  </h2>
                </div>
                <button
                  onClick={() => setShowDecisionDialog(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  Are you sure you want to {pendingDecision === 'accepted' ? 'accept' :
                                          pendingDecision === 'denied' ? 'deny' :
                                          'request more information for'} this assessment?
                </p>

                {(pendingDecision === 'denied' || pendingDecision === 'need_info') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comment <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                      placeholder="Please provide a reason for your decision..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowDecisionDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecisionSubmit}
                  disabled={submitDecisionMutation.isPending ||
                           ((pendingDecision === 'denied' || pendingDecision === 'need_info') && !decisionComment.trim())}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg ${
                    pendingDecision === 'accepted' ? 'bg-green-600 hover:bg-green-700' :
                    pendingDecision === 'denied' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-yellow-600 hover:bg-yellow-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitDecisionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm {getDecisionButtonText(pendingDecision || '')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forward Dialog */}
        {showForwardDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-md w-full border-none overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between">
                <h2 className="text-xl font-medium text-gray-900">
                  Forward {forwardQuestionIds.length > 0 ? `${forwardQuestionIds.length} Question(s)` : 'Assessment'}
                </h2>
                <MaterialButton
                  variant="text"
                  size="small"
                  onClick={() => {
                    setShowForwardDialog(false)
                    setForwardQuestionIds([])
                    setForwardUserId('')
                    setForwardComment('')
                  }}
                  className="!p-2 text-gray-600"
                >
                  <X className="w-6 h-6" />
                </MaterialButton>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 bg-background">
                <MaterialInput
                  label="Forward to User ID"
                  placeholder="Enter user ID or email..."
                  value={forwardUserId}
                  onChange={(e) => setForwardUserId(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                />
                <MaterialInput
                  label="Comment (Optional)"
                  placeholder="Add a comment for the forwarded user..."
                  value={forwardComment}
                  onChange={(e) => setForwardComment(e.target.value)}
                  multiline
                  rows={4}
                  fullWidth
                />
                {forwardQuestionIds.length > 0 && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                    Forwarding {forwardQuestionIds.length} specific question(s)
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 bg-surface-variant/10 border-t flex justify-end gap-3">
                <MaterialButton
                  variant="text"
                  onClick={() => {
                    setShowForwardDialog(false)
                    setForwardQuestionIds([])
                    setForwardUserId('')
                    setForwardComment('')
                  }}
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  variant="contained"
                  color="primary"
                  onClick={handleForwardSubmit}
                  disabled={!forwardUserId.trim() || forwardMutation.isPending}
                  loading={forwardMutation.isPending}
                >
                  Forward
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Overall Status Display */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Assessment Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Workflow Ticket</span>
              </div>
              <div className="text-2xl font-mono font-bold text-blue-700">
                {assignment?.workflow_ticket_id || 'N/A'}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-900">Current Status</span>
              </div>
              <div className="text-xl font-semibold text-gray-700 capitalize">
                {assignment?.status || 'Unknown'}
              </div>
              {assignment?.completed_at && (
                <div className="text-xs text-gray-500 mt-1">
                  Submitted: {new Date(assignment.completed_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">Review Progress</span>
              </div>
              <div className="text-xl font-semibold text-green-700">
                {reviewStats.pass || 0} / {questions.length} Accepted
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {reviewStats.fail || 0} Denied, {reviewStats.in_progress || 0} More Info
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
