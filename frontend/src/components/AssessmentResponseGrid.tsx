import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { assessmentsApi, AssessmentQuestion } from '../lib/assessments'
import { MaterialCard, MaterialChip } from './material'
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react'

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
  questionReviews = {}
}: AssessmentResponseGridProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading assessment responses...</div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No assessment questions found.
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
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">
                            Q{index + 1}
                          </span>
                          {question.is_required && (
                            <span className="text-xs text-red-500 font-medium">Required</span>
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
                        <h4 className="text-sm font-semibold text-gray-900 mt-1">
                          {question.title || question.question_text || `Question ${index + 1}`}
                        </h4>
                        {question.description && (
                          <p className="text-xs text-gray-600 mt-1">{question.description}</p>
                        )}
                        {question.response_type && (
                          <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                            {question.response_type}
                          </span>
                        )}
                      </div>

                      {/* Review Status */}
                      {showReviewStatus && reviewStatus && (
                        <div className="ml-4 flex-shrink-0">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(reviewStatus)}`}>
                            {getStatusIcon(reviewStatus)}
                            <span className="capitalize">{reviewStatus.replace('_', ' ')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Response Display */}
                    <div className="bg-gray-50 rounded-lg p-3 mt-3">
                      {response?.value !== undefined && response?.value !== null && response?.value !== '' ? (
                        <div className="space-y-2">
                          <div className="text-sm text-gray-900">
                            {typeof response.value === 'string' ? (
                              <div className="whitespace-pre-wrap">{response.value}</div>
                            ) : Array.isArray(response.value) ? (
                              <ul className="list-disc list-inside space-y-1">
                                {response.value.map((item: any, idx: number) => (
                                  <li key={idx} className="text-sm">{String(item)}</li>
                                ))}
                              </ul>
                            ) : (
                              <div>{String(response.value)}</div>
                            )}
                          </div>
                          {response.comment && (
                            <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                              <strong>Comment:</strong> {response.comment}
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
                        <div className="text-sm text-gray-500 italic">
                          No response provided
                        </div>
                      )}
                    </div>

                    {/* Review Comments */}
                    {showReviewStatus && questionReview && (questionReview.reviewer_comment || questionReview.vendor_comment) && (
                      <div className="mt-3 space-y-2">
                        {questionReview.reviewer_comment && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="text-xs font-semibold text-blue-800 mb-1">Reviewer Comment:</div>
                            <div className="text-sm text-blue-700 whitespace-pre-wrap">{questionReview.reviewer_comment}</div>
                          </div>
                        )}
                        {questionReview.vendor_comment && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="text-xs font-semibold text-yellow-800 mb-1">Vendor Response:</div>
                            <div className="text-sm text-yellow-700 whitespace-pre-wrap">{questionReview.vendor_comment}</div>
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

