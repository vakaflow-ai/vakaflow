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
    status: assignmentStatus.status,
    completed_at: assignmentStatus.completed_at,
    started_at: assignmentStatus.started_at,
    due_date: assignmentStatus.due_date,
  } : null

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
      setResponses(existingResponses as Record<string, QuestionResponse>)
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

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], value }
    }))
  }

  const handleSaveDraft = () => {
    const data = {
      responses: Object.entries(responses).map(([questionId, response]) => ({
        question_id: questionId,
        value: response.value,
        comment: response.comment,
      }))
    }
    saveDraftMutation.mutate(data)
  }

  const handleSubmit = () => {
    const data = {
      responses: Object.entries(responses).map(([questionId, response]) => ({
        question_id: questionId,
        value: response.value,
        comment: response.comment,
      }))
    }
    submitMutation.mutate(data)
  }

  const isReadOnly = assignment?.status === 'completed' || assignment?.status === 'approved'
  const isVendor = user?.role === 'vendor_user'
  const isApprover = ['approver', 'tenant_admin', 'platform_admin'].includes(user?.role)
  const isReviewer = ['security_reviewer', 'compliance_reviewer', 'technical_reviewer', 'business_reviewer'].includes(user?.role)

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
                const response = responses[question.id] || { value: '' }
                const hasResponse = response.value !== undefined && response.value !== null && response.value !== ''

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
                      {hasResponse && (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
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
                    </div>

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
      </div>
    </Layout>
  )
}
