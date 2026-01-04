import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assessmentsApi, AssessmentQuestion } from '../lib/assessments'
import { MaterialCard, MaterialChip, MaterialButton } from './material'
import { CheckCircle, XCircle, Clock, FileText, HelpCircle, MessageSquare } from 'lucide-react'
import { showToast } from '../utils/toast'

interface AssessmentResponseGridProps {
  assignmentId?: string
  questions?: AssessmentQuestion[]
  responses?: Record<string, {
    value: any
    comment?: string
    documents?: Array<{ name: string; path?: string; size?: number; type?: string }>
  }>
  readOnly?: boolean
  showReviewStatus?: boolean
  showQuestionActions?: boolean // New prop to show Accept/Deny/More Info buttons
  questionReviews?: Record<string, {
    status?: 'pass' | 'fail' | 'in_progress'
    reviewer_comment?: string
    vendor_comment?: string
  }>
}

export default function AssessmentResponseGrid({
  assignmentId,
  questions: providedQuestions,
  responses: providedResponses,
  readOnly = true,
  showReviewStatus = false,
  showQuestionActions = false, // Show Accept/Deny/More Info buttons for approvers
  questionReviews = {}
}: AssessmentResponseGridProps) {
  const queryClient = useQueryClient()
  const [moreInfoQuestionId, setMoreInfoQuestionId] = useState<string | null>(null)
  const [moreInfoComment, setMoreInfoComment] = useState<string>('')
  // Fetch questions if not provided
  const { data: fetchedQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ['assessment-questions', assignmentId],
    queryFn: () => assessmentsApi.getAssignmentQuestions(assignmentId!),
    enabled: !!assignmentId && !providedQuestions,
  })

  // Fetch responses if not provided
  const { data: fetchedResponses, isLoading: responsesLoading } = useQuery({
    queryKey: ['assessment-responses', assignmentId],
    queryFn: () => assessmentsApi.getAssignmentResponses(assignmentId!),
    enabled: !!assignmentId && !providedResponses,
  })

  const questions = providedQuestions || fetchedQuestions || []
  const responses = providedResponses || fetchedResponses || {}
  const isLoading = questionsLoading || responsesLoading

  console.log('AssessmentResponseGrid - Data:', {
    assignmentId,
    providedQuestionsCount: Array.isArray(providedQuestions) ? providedQuestions.length : 'not array',
    providedResponsesCount: providedResponses ? Object.keys(providedResponses).length : 'not object',
    fetchedQuestionsCount: Array.isArray(fetchedQuestions) ? fetchedQuestions.length : 'not array',
    fetchedResponsesCount: fetchedResponses ? Object.keys(fetchedResponses).length : 'not object',
    finalQuestionsCount: Array.isArray(questions) ? questions.length : 'not array',
    finalResponsesCount: Object.keys(responses).length,
    isLoading
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading assessment responses...</div>
      </div>
    )
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No assessment questions found.</p>
        {assignmentId && (
          <p className="text-sm mt-2">Assignment ID: {assignmentId}</p>
        )}
        {!providedQuestions && !fetchedQuestions && (
          <p className="text-sm mt-2 text-yellow-600">Questions not provided and fetch failed or disabled.</p>
        )}
      </div>
    )
  }

  // Group questions by section if available
  const groupedQuestions = questions.reduce((acc, question) => {
    const section = question.section || 'General'
    if (!acc[section]) {
      acc[section] = []
    }
    acc[section].push(question)
    return acc
  }, {} as Record<string, AssessmentQuestion[]>)

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'fail':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'in_progress':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4" />
      case 'fail':
        return <XCircle className="w-4 h-4" />
      case 'in_progress':
        return <Clock className="w-4 h-4" />
      default:
        return null
    }
  }

  // Mutation for reviewing questions
  const reviewQuestionMutation = useMutation({
    mutationFn: async ({ questionId, status, comment }: { questionId: string; status: 'pass' | 'fail' | 'in_progress'; comment?: string }) => {
      if (!assignmentId) throw new Error('Assignment ID is required')
      return assessmentsApi.reviewQuestion(assignmentId, questionId, status, comment)
    },
    onSuccess: () => {
      showToast.success('Question review saved successfully')
      queryClient.invalidateQueries({ queryKey: ['assessment-question-reviews', assignmentId] })
      queryClient.invalidateQueries({ queryKey: ['assessment-responses', assignmentId] })
      setMoreInfoQuestionId(null)
      setMoreInfoComment('')
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Failed to save question review')
    }
  })

  const handleAccept = (questionId: string) => {
    reviewQuestionMutation.mutate({ questionId, status: 'pass' })
  }

  const handleDeny = (questionId: string) => {
    const comment = prompt('Please provide a comment explaining why this question is denied:')
    if (comment && comment.trim()) {
      reviewQuestionMutation.mutate({ questionId, status: 'fail', comment: comment.trim() })
    }
  }

  const handleMoreInfo = (questionId: string) => {
    setMoreInfoQuestionId(questionId)
  }

  const handleSubmitMoreInfo = (questionId: string) => {
    if (!moreInfoComment.trim()) {
      showToast.error('Please provide a comment explaining what information is needed')
      return
    }
    reviewQuestionMutation.mutate({ questionId, status: 'in_progress', comment: moreInfoComment.trim() })
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
        <div key={section}>
          {Object.keys(groupedQuestions).length > 1 && (
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
              {section}
            </h3>
          )}
          <div className="grid grid-cols-1 gap-4">
            {sectionQuestions.map((question, index) => {
              const questionIdStr = String(question.id)
              const response = responses[questionIdStr]
              const questionReview = questionReviews[question.id] || {}
              const reviewStatus = questionReview.status

              return (
                <MaterialCard key={question.id} elevation={0} className="overflow-hidden">
                  <div className="p-4">
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-700">
                            Q{index + 1}
                          </span>
                          {question.is_required && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Required</span>
                          )}
                          {question.category && (
                            <MaterialChip
                              label={question.category}
                              size="small"
                              variant="filled"
                              className="text-xs bg-gray-100 text-gray-700"
                            />
                          )}
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 mt-1 mb-2">
                          {question.title || question.question_text || `Question ${index + 1}`}
                        </h4>
                        {question.description && (
                          <p className="text-sm text-gray-600 mt-1 mb-2">{question.description}</p>
                        )}
                        {question.response_type && (
                          <span className="inline-block mt-2 text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">
                            {question.response_type}
                          </span>
                        )}
                      </div>

                      {/* Review Status */}
                      {showReviewStatus && reviewStatus && (
                        <div className="ml-4 flex-shrink-0">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border ${getStatusColor(reviewStatus)}`}>
                            {getStatusIcon(reviewStatus)}
                            <span className="capitalize">{reviewStatus.replace('_', ' ')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Response Display */}
                    <div className="bg-gray-50 rounded-lg p-4 mt-3 border border-gray-200">
                      {response?.value !== undefined && response?.value !== null && response?.value !== '' ? (
                        <div className="space-y-2">
                          <div className="text-base text-gray-900">
                            {typeof response.value === 'string' ? (
                              <div className="whitespace-pre-wrap leading-relaxed">{response.value}</div>
                            ) : Array.isArray(response.value) ? (
                              <ul className="list-disc list-inside space-y-1.5">
                                {response.value.map((item: any, idx: number) => (
                                  <li key={idx} className="text-base">{String(item)}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-base">{String(response.value)}</div>
                            )}
                          </div>
                          {response.comment && (
                            <div className="text-sm text-gray-700 pt-3 border-t border-gray-300 mt-3">
                              <strong className="font-semibold">Comment:</strong> <span className="ml-1">{response.comment}</span>
                            </div>
                          )}
                          {response.documents && response.documents.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                              <div className="text-xs font-medium text-gray-700 mb-1">Attachments:</div>
                              <div className="flex flex-wrap gap-2">
                                {response.documents.map((doc, docIdx) => (
                                  <a
                                    key={docIdx}
                                    href={doc.path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                                  >
                                    <FileText className="w-3 h-3" />
                                    {doc.name}
                                    {doc.size && (
                                      <span className="text-gray-500">
                                        ({(doc.size / 1024).toFixed(1)} KB)
                                      </span>
                                    )}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-base text-gray-500 italic py-2">
                          No response provided
                        </div>
                      )}
                    </div>

                    {/* Review Comments */}
                    {showReviewStatus && questionReview && (questionReview.reviewer_comment || questionReview.vendor_comment) && (
                      <div className="mt-4 space-y-3">
                        {questionReview.reviewer_comment && (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                            <div className="text-sm font-semibold text-blue-900 mb-2">Reviewer Comment:</div>
                            <div className="text-base text-blue-800 whitespace-pre-wrap leading-relaxed">{questionReview.reviewer_comment}</div>
                          </div>
                        )}
                        {questionReview.vendor_comment && (
                          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                            <div className="text-sm font-semibold text-yellow-900 mb-2">Vendor Response:</div>
                            <div className="text-base text-yellow-800 whitespace-pre-wrap leading-relaxed">{questionReview.vendor_comment}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Question-Level Actions for Approvers */}
                    {showQuestionActions && !readOnly && assignmentId && (
                      <div className="mt-5 pt-4 border-t-2 border-gray-300">
                        {moreInfoQuestionId === questionIdStr ? (
                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              What additional information is needed?
                            </label>
                            <textarea
                              value={moreInfoComment}
                              onChange={(e) => setMoreInfoComment(e.target.value)}
                              placeholder="Please describe what additional information you need from the vendor..."
                              className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                              rows={4}
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleSubmitMoreInfo(questionIdStr)}
                                disabled={reviewQuestionMutation.isPending || !moreInfoComment.trim()}
                                className="px-6 py-2.5 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                              >
                                Submit Request
                              </button>
                              <button
                                onClick={() => {
                                  setMoreInfoQuestionId(null)
                                  setMoreInfoComment('')
                                }}
                                disabled={reviewQuestionMutation.isPending}
                                className="px-6 py-2.5 bg-white text-gray-700 text-base font-medium rounded-lg border-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAccept(questionIdStr)}
                              disabled={reviewQuestionMutation.isPending || reviewStatus === 'pass'}
                              className={`px-6 py-3 text-base font-medium rounded-lg flex items-center gap-2 transition-all shadow-sm ${
                                reviewStatus === 'pass'
                                  ? 'bg-green-700 text-white cursor-default'
                                  : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              <CheckCircle className="w-5 h-5" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeny(questionIdStr)}
                              disabled={reviewQuestionMutation.isPending || reviewStatus === 'fail'}
                              className={`px-6 py-3 text-base font-medium rounded-lg flex items-center gap-2 transition-all shadow-sm ${
                                reviewStatus === 'fail'
                                  ? 'bg-red-700 text-white cursor-default'
                                  : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              <XCircle className="w-5 h-5" />
                              Deny
                            </button>
                            <button
                              onClick={() => handleMoreInfo(questionIdStr)}
                              disabled={reviewQuestionMutation.isPending || reviewStatus === 'in_progress'}
                              className={`px-6 py-3 text-base font-medium rounded-lg flex items-center gap-2 transition-all border-2 ${
                                reviewStatus === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700 border-blue-300 cursor-default'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              <HelpCircle className="w-5 h-5" />
                              More Info
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </MaterialCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

