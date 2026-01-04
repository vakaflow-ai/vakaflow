import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { assessmentsApi, AssessmentQuestion, AssessmentAssignment as AssessmentAssignmentType } from '../lib/assessments'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { showToast } from '../utils/toast'
import { 
  FileText, CheckCircle2, AlertCircle, Loader2, Save, ArrowLeft, 
  Upload, X, CheckCircle, XCircle, Clock, AlertTriangle, 
  MessageSquare, Send, User, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => navigate('/login'))
  }, [navigate])

  const { data: assignmentStatus, isLoading: assignmentLoading, error: assignmentError } = useQuery({
    queryKey: ['assessment-assignment', id],
    queryFn: () => assessmentsApi.getAssignmentStatus(id!),
    enabled: !!id,
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
  
  // Debug: Log raw API response
  if (assignmentStatus) {
    console.log('Raw Assignment Status API Response:', {
      rawStatus: assignmentStatus.status,
      statusType: typeof assignmentStatus.status,
      fullResponse: assignmentStatus
    })
  }

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['assessment-questions', assignmentStatus?.assessment_id],
    queryFn: () => assessmentsApi.getAssignmentQuestions(id!),
    enabled: !!id && !!assignmentStatus?.assessment_id,
  })

  // Load existing responses
  const { data: existingResponses = {} } = useQuery({
    queryKey: ['assessment-responses', id],
    queryFn: () => assessmentsApi.getAssignmentResponses(id!),
    enabled: !!id && !!assignmentStatus,
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
    mutationFn: (data: any) => assessmentsApi.saveResponses(id!, data),
    onSuccess: () => {
      showToast.success('Assessment submitted successfully')
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
  
  // Debug: Log status to help troubleshoot
  if (assignment) {
    console.log('🔍 Assessment Assignment Debug:', {
      rawStatus,
      normalizedStatus,
      isReadOnly,
      isVendor,
      editableStatuses,
      readonlyStatuses,
      isInEditable: editableStatuses.includes(normalizedStatus),
      isInReadonly: readonlyStatuses.includes(normalizedStatus),
      statusCheck: {
        isPending: normalizedStatus === 'pending',
        isInProgress: normalizedStatus === 'in_progress',
        isCompleted: normalizedStatus === 'completed',
        isApproved: normalizedStatus === 'approved',
        isRejected: normalizedStatus === 'rejected',
        isNeedsRevision: normalizedStatus === 'needs_revision'
      },
      assignmentId: assignment.id,
      assessmentName: assignment.assessment_name
    })
  }
  
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
    const errorMessage = assignmentError 
      ? (assignmentError as any)?.response?.data?.detail || 'Failed to load assignment'
      : 'Assessment assignment not found'
    
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
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
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

        {/* Questions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>Answer all required questions to complete the assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {questions.map((question, index) => {
                // Use string ID for lookup to match API response format (question IDs are UUIDs stored as strings)
                const questionIdStr = String(question.id)
                const response = responses[questionIdStr] || responses[question.id] || { value: '' }
                const hasResponse = response.value !== undefined && response.value !== null && response.value !== ''
                
                // Get review comment for this question (if read-only)
                const questionReview = questionReviewsData?.question_reviews?.[questionIdStr] || questionReviewsData?.question_reviews?.[question.id]
                const reviewerComment = questionReview?.reviewer_comment
                const vendorComment = questionReview?.vendor_comment
                const reviewStatus = questionReview?.status

                return (
                  <div key={question.id} className="space-y-3 pb-6 border-b last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Label className="text-base font-semibold">
                          {index + 1}. {question.question_text}
                          {question.is_required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {question.description && (
                          <p className="text-sm text-muted-foreground mt-1">{question.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {reviewStatus && isReadOnly && (
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            reviewStatus === 'pass' && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                            reviewStatus === 'fail' && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                            reviewStatus === 'in_progress' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                            reviewStatus === 'pending' && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          )}>
                            {reviewStatus === 'pass' && '✓ Passed'}
                            {reviewStatus === 'fail' && '✗ Failed'}
                            {reviewStatus === 'in_progress' && '⏳ In Progress'}
                            {reviewStatus === 'pending' && '⏸ Pending'}
                          </span>
                        )}
                        {hasResponse && (
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {question.field_type === 'textarea' ? (
                        <textarea
                          value={response.value || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          disabled={isReadOnly}
                          placeholder="Enter your response..."
                          className="w-full min-h-[120px] px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:border-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-ring/50"
                        />
                      ) : (
                        <Input
                          value={response.value || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          disabled={isReadOnly}
                          placeholder="Enter your response or paste a URL"
                          className="bg-background text-foreground"
                        />
                      )}
                      
                      {/* Show vendor comment if exists */}
                      {response.comment && (
                        <div className="mt-2 p-3 bg-muted rounded-md">
                          <p className="text-xs text-muted-foreground mb-1">Vendor Comment:</p>
                          <p className="text-sm">{response.comment}</p>
                        </div>
                      )}
                    </div>

                    {/* Review Comments (for read-only approved/completed assignments) */}
                    {isReadOnly && (reviewerComment || vendorComment) && (
                      <div className="mt-3 space-y-2">
                        {reviewerComment && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Reviewer Comment:</p>
                                <p className="text-sm text-blue-800 dark:text-blue-200">{reviewerComment}</p>
                                {questionReview?.reviewed_at && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Reviewed on {new Date(questionReview.reviewed_at).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {vendorComment && (
                          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-green-900 dark:text-green-100 mb-1">Vendor Response:</p>
                                <p className="text-sm text-green-800 dark:text-green-200">{vendorComment}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions for Reviewers/Approvers */}
                    {(isReviewer || isApprover) && isReadOnly && (
                      <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" size="sm" className="border-border hover:bg-muted hover:border-primary/50">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button variant="outline" size="sm" className="border-border hover:bg-muted hover:border-destructive/50">
                          <XCircle className="h-4 w-4 mr-2" />
                          Deny
                        </Button>
                        <Button variant="outline" size="sm" className="border-border hover:bg-muted hover:border-primary/50">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          More Info
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
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
