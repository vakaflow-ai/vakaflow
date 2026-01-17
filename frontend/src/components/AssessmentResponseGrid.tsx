import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assessmentsApi, AssessmentQuestion } from '../lib/assessments'
import { MaterialCard, MaterialChip, MaterialButton } from './material'
import { CheckCircle, XCircle, Clock, FileText, HelpCircle, MessageSquare, Forward, Download, Link as LinkIcon, Lock, Edit, Eye, File, Image, FileCode, FileSpreadsheet, FileVideo, FileAudio } from 'lucide-react'
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
  onForwardQuestion?: (questionId: string) => void // Callback for forwarding a specific question
  isCompleted?: boolean // Whether the assignment is completed (approved/rejected) - disables all action buttons
}

export default function AssessmentResponseGrid({
  assignmentId,
  questions: providedQuestions,
  responses: providedResponses,
  readOnly = true,
  showReviewStatus = false,
  showQuestionActions = false, // Show Accept/Deny/More Info buttons for approvers
  questionReviews = {},
  onForwardQuestion, // Callback for forwarding a specific question
  isCompleted = false // Whether the assignment is completed (approved/rejected) - disables all action buttons
}: AssessmentResponseGridProps) {
  const queryClient = useQueryClient()
  const [moreInfoQuestionId, setMoreInfoQuestionId] = useState<string | null>(null)
  const [moreInfoComment, setMoreInfoComment] = useState<string>('')
  const [denyQuestionId, setDenyQuestionId] = useState<string | null>(null)
  const [denyComment, setDenyComment] = useState<string>('')
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

  // Get file type icon based on file extension or MIME type
  const getFileIcon = (fileName?: string, fileType?: string) => {
    if (!fileName && !fileType) return <File className="w-4 h-4" />
    
    const extension = fileName?.split('.').pop()?.toLowerCase() || ''
    const mimeType = fileType?.toLowerCase() || ''
    
    if (mimeType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
      return <Image className="w-4 h-4" />
    } else if (mimeType.includes('pdf') || extension === 'pdf') {
      return <FileText className="w-4 h-4" />
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(extension)) {
      return <FileSpreadsheet className="w-4 h-4" />
    } else if (mimeType.includes('video') || ['mp4', 'avi', 'mov', 'wmv'].includes(extension)) {
      return <FileVideo className="w-4 h-4" />
    } else if (mimeType.includes('audio') || ['mp3', 'wav', 'ogg'].includes(extension)) {
      return <FileAudio className="w-4 h-4" />
    } else if (['html', 'css', 'js', 'json', 'xml', 'yaml', 'yml'].includes(extension)) {
      return <FileCode className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Check if value is a URL
  const isUrl = (value: any): boolean => {
    if (typeof value !== 'string') return false
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Render response value based on type
  const renderResponseValue = (value: any, responseType?: string) => {
    if (value === undefined || value === null || value === '') {
      return <div className="text-base text-gray-500 italic py-2">No response provided</div>
    }

    // Handle URLs
    if (typeof value === 'string' && isUrl(value)) {
      return (
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline break-all"
          >
            {value}
          </a>
        </div>
      )
    }

    // Handle arrays (multi-select, file lists, etc.)
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside space-y-1.5">
          {value.map((item: any, idx: number) => (
            <li key={idx} className="text-base">
              {typeof item === 'string' && isUrl(item) ? (
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <a
                    href={item}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                  >
                    {item}
                  </a>
                </div>
              ) : (
                String(item)
              )}
            </li>
          ))}
        </ul>
      )
    }

    // Handle boolean
    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <MaterialChip
            label={value ? 'Yes' : 'No'}
            size="small"
            variant="filled"
            className={`text-xs ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
          />
        </div>
      )
    }

    // Handle numbers
    if (typeof value === 'number') {
      return <div className="text-base font-mono">{value}</div>
    }

    // Handle strings (text, textarea)
    if (typeof value === 'string') {
      return <div className="whitespace-pre-wrap leading-relaxed text-base">{value}</div>
    }

    // Fallback for objects
    return <div className="text-base">{JSON.stringify(value, null, 2)}</div>
  }

  // Mutation for reviewing questions
  const reviewQuestionMutation = useMutation({
    mutationFn: async ({ questionId, status, comment }: { questionId: string; status: 'pass' | 'fail' | 'in_progress'; comment?: string }) => {
      if (!assignmentId) throw new Error('Assignment ID is required')
      return assessmentsApi.reviewQuestion(assignmentId, questionId, status, comment)
    },
    onSuccess: () => {
      showToast.success('Question review saved successfully')
      // Invalidate all question review queries to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ['assessment-question-reviews', assignmentId] })
      queryClient.invalidateQueries({ queryKey: ['question-reviews-approver', assignmentId] })
      queryClient.invalidateQueries({ queryKey: ['assessment-responses', assignmentId] })
      setMoreInfoQuestionId(null)
      setMoreInfoComment('')
    },
    onError: (error: any) => {
      showToast.error(error.message || 'Failed to save question review')
    }
  })

  const handleAccept = (questionId: string) => {
    // Accept directly without modal - no comment needed
    reviewQuestionMutation.mutate({ 
      questionId: questionId, 
      status: 'pass', 
      comment: undefined 
    })
  }

  const handleDeny = (questionId: string) => {
    // Close more info panel if open
    setMoreInfoQuestionId(null)
    setMoreInfoComment('')
    setDenyQuestionId(questionId)
    setDenyComment('')
  }

  const handleSubmitDeny = (questionId: string) => {
    if (!denyComment.trim()) {
      showToast.error('Please provide a comment explaining why this question is denied')
      return
    }
    reviewQuestionMutation.mutate({ 
      questionId: questionId, 
      status: 'fail', 
      comment: denyComment.trim() 
    })
    setDenyQuestionId(null)
    setDenyComment('')
  }

  const handleMoreInfo = (questionId: string) => {
    // Close deny panel if open
    setDenyQuestionId(null)
    setDenyComment('')
    setMoreInfoQuestionId(questionId)
  }

  const handleSubmitMoreInfo = (questionId: string) => {
    if (!moreInfoComment.trim()) {
      showToast.error('Please provide a comment explaining what information is needed')
      return
    }
    reviewQuestionMutation.mutate({ questionId, status: 'in_progress', comment: moreInfoComment.trim() })
  }

  // Separate questions by review status when showQuestionActions is enabled
  const separateByStatus = showQuestionActions && !readOnly
  
  // Group questions by review status
  const questionsByStatus = separateByStatus ? {
    pending: [] as AssessmentQuestion[],
    accepted: [] as AssessmentQuestion[],
    denied: [] as AssessmentQuestion[],
    moreInfo: [] as AssessmentQuestion[]
  } : null

  if (separateByStatus && questionsByStatus) {
    questions.forEach((question) => {
      const questionReview = questionReviews[question.id] || {}
      const reviewStatus = questionReview.status
      
      if (reviewStatus === 'pass') {
        questionsByStatus.accepted.push(question)
      } else if (reviewStatus === 'fail') {
        questionsByStatus.denied.push(question)
      } else if (reviewStatus === 'in_progress') {
        questionsByStatus.moreInfo.push(question)
      } else {
        questionsByStatus.pending.push(question)
      }
    })
  }

  // Render a single question card
  const renderQuestionCard = (question: AssessmentQuestion, index: number, section?: string, showActions: boolean = true) => {
    const questionIdStr = String(question.id)
    const response = responses[questionIdStr]
    const questionReview = questionReviews[question.id] || {}
    const reviewStatus = questionReview.status
    const isEditable = showActions && showQuestionActions && !readOnly

    return (
      <MaterialCard key={question.id} elevation={0} className="overflow-hidden">
        <div className="p-4">
          {/* Question Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {section ? `${section} - ` : ''}Q{index + 1}
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
                {reviewStatus && (
                  <MaterialChip
                    label={reviewStatus === 'pass' ? 'Accepted' : reviewStatus === 'fail' ? 'Denied' : 'More Info'}
                    size="small"
                    variant="filled"
                    className={`text-xs ${getStatusColor(reviewStatus)}`}
                  />
                )}
              </div>
              <h4 className="text-base font-semibold text-gray-900 mt-1 mb-2">
                {question.title || question.question_text || `Question ${index + 1}`}
              </h4>
              {question.description && (
                <p className="text-sm text-gray-600 mb-3">{question.description}</p>
              )}
              {question.response_type && (
                <MaterialChip
                  label={question.response_type}
                  size="small"
                  variant="outlined"
                  className="text-xs"
                />
              )}
            </div>
          </div>

          {/* Response Display */}
          <div className={`rounded-lg p-4 mt-3 border ${isEditable ? 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-dashed border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
              {isEditable ? <Eye className="w-4 h-4 text-gray-600" /> : <Lock className="w-4 h-4 text-gray-600" />}
              <span>Vendor Response {isEditable ? '' : '(Read-Only)'}</span>
            </div>
            {response?.value !== undefined && response?.value !== null && response?.value !== '' ? (
              <div className="space-y-2">
                <div className="text-base text-gray-900">
                  {question.response_type === 'URL' ? (
                    <a href={String(response.value)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      <LinkIcon className="w-4 h-4" /> {String(response.value)}
                    </a>
                  ) : typeof response.value === 'boolean' ? (
                    <MaterialChip label={response.value ? 'Yes' : 'No'} color={response.value ? 'success' : 'error'} size="small" />
                  ) : typeof response.value === 'number' ? (
                    <span className="font-mono">{String(response.value)}</span>
                  ) : typeof response.value === 'string' ? (
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
                  <div className="bg-gray-100 rounded-md p-3 text-sm text-gray-700 border border-gray-200 mt-3">
                    <strong className="font-semibold">Vendor Comment:</strong> <span className="ml-1 whitespace-pre-wrap leading-relaxed">{response.comment}</span>
                  </div>
                )}
                {response.documents && response.documents.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 mt-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">Attachments:</div>
                    <div className="flex flex-wrap gap-2">
                      {response.documents.map((doc, docIdx) => (
                        <a
                          key={docIdx}
                          href={doc.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs hover:bg-blue-100 transition-colors"
                          title={doc.name}
                        >
                          {getFileIcon(doc.name, doc.type)}
                          <span className="truncate max-w-[120px]">{doc.name}</span>
                          {doc.size && (
                            <span className="text-gray-500">({formatFileSize(doc.size)})</span>
                          )}
                          <Download className="w-3 h-3 text-blue-600" />
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
                  <div className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Your Review:
                  </div>
                  <div className="text-base text-blue-800 whitespace-pre-wrap leading-relaxed">{questionReview.reviewer_comment}</div>
                </div>
              )}
              {questionReview.vendor_comment && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                  <div className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Vendor Response to Reviewer:
                  </div>
                  <div className="text-base text-yellow-800 whitespace-pre-wrap leading-relaxed">{questionReview.vendor_comment}</div>
                </div>
              )}
            </div>
          )}

          {/* Question-Level Actions for Approvers */}
          {showQuestionActions && !readOnly && assignmentId && (
            <div className="mt-5 pt-4 border-t-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-blue-800">
                <Edit className="w-4 h-4" /> Review Actions (Editable)
              </div>
              {moreInfoQuestionId === questionIdStr ? (
                <div className="space-y-3">
                  <textarea
                    value={moreInfoComment}
                    onChange={(e) => setMoreInfoComment(e.target.value)}
                    placeholder="What additional information is needed?"
                    className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitMoreInfo(questionIdStr)}
                      disabled={isCompleted || reviewQuestionMutation.isPending || !moreInfoComment.trim()}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                        isCompleted
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      Submit Request
                    </button>
                    <button
                      onClick={() => {
                        setMoreInfoQuestionId(null)
                        setMoreInfoComment('')
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : denyQuestionId === questionIdStr ? (
                <div className="space-y-3">
                  <textarea
                    value={denyComment}
                    onChange={(e) => setDenyComment(e.target.value)}
                    placeholder="Please explain why this question is denied..."
                    className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitDeny(questionIdStr)}
                      disabled={isCompleted || reviewQuestionMutation.isPending || !denyComment.trim()}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                        isCompleted
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      Submit Denial
                    </button>
                    <button
                      onClick={() => {
                        setDenyQuestionId(null)
                        setDenyComment('')
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleAccept(questionIdStr)}
                    disabled={isCompleted || reviewQuestionMutation.isPending || reviewStatus === 'pass'}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                      isCompleted
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : reviewStatus === 'pass'
                        ? 'bg-green-700 text-white cursor-default'
                        : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeny(questionIdStr)}
                    disabled={isCompleted || reviewQuestionMutation.isPending || reviewStatus === 'fail'}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                      isCompleted
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : reviewStatus === 'fail'
                        ? 'bg-red-700 text-white cursor-default'
                        : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Deny
                  </button>
                  <button
                    onClick={() => handleMoreInfo(questionIdStr)}
                    disabled={isCompleted || reviewQuestionMutation.isPending || reviewStatus === 'in_progress'}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all border ${
                      isCompleted
                        ? 'bg-gray-400 text-white border-gray-400 cursor-not-allowed'
                        : reviewStatus === 'in_progress'
                        ? 'bg-blue-100 text-blue-700 border-blue-300 cursor-default'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    More Info
                  </button>
                  {onForwardQuestion && (
                    <button
                      onClick={() => {
                        if (!isCompleted) {
                          onForwardQuestion(questionIdStr)
                        }
                      }}
                      disabled={isCompleted}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all border ${
                        isCompleted
                          ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-50'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                      }`}
                      title={isCompleted ? "Assessment already completed" : "Forward this question"}
                    >
                      <Forward className="w-3.5 h-3.5" />
                      Forward
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </MaterialCard>
    )
  }

  // If separating by status, render sections for pending, accepted, denied, moreInfo
  if (separateByStatus && questionsByStatus) {
    return (
      <>
      <div className="space-y-8">
        {/* Pending Questions - Main Review List */}
        {questionsByStatus.pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-gray-900">Questions Pending Review ({questionsByStatus.pending.length})</h2>
            </div>
            <div className="space-y-4">
              {Object.entries(
                questionsByStatus.pending.reduce((acc, question) => {
                  const section = question.section || 'General'
                  if (!acc[section]) acc[section] = []
                  acc[section].push(question)
                  return acc
                }, {} as Record<string, AssessmentQuestion[]>)
              ).map(([section, sectionQuestions]) => (
                <div key={section}>
                  {Object.keys(groupedQuestions).length > 1 && (
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      {section}
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {sectionQuestions.map((question, index) => 
                      renderQuestionCard(question, index + 1, section, true)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted Questions */}
        {questionsByStatus.accepted.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">Accepted Questions ({questionsByStatus.accepted.length})</h2>
            </div>
            <div className="space-y-4">
              {Object.entries(
                questionsByStatus.accepted.reduce((acc, question) => {
                  const section = question.section || 'General'
                  if (!acc[section]) acc[section] = []
                  acc[section].push(question)
                  return acc
                }, {} as Record<string, AssessmentQuestion[]>)
              ).map(([section, sectionQuestions]) => (
                <div key={section}>
                  {Object.keys(groupedQuestions).length > 1 && (
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      {section}
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {sectionQuestions.map((question, index) => 
                      renderQuestionCard(question, index + 1, section, false)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Denied Questions */}
        {questionsByStatus.denied.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-gray-900">Denied Questions ({questionsByStatus.denied.length})</h2>
            </div>
            <div className="space-y-4">
              {Object.entries(
                questionsByStatus.denied.reduce((acc, question) => {
                  const section = question.section || 'General'
                  if (!acc[section]) acc[section] = []
                  acc[section].push(question)
                  return acc
                }, {} as Record<string, AssessmentQuestion[]>)
              ).map(([section, sectionQuestions]) => (
                <div key={section}>
                  {Object.keys(groupedQuestions).length > 1 && (
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      {section}
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {sectionQuestions.map((question, index) => 
                      renderQuestionCard(question, index + 1, section, false)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* More Info Questions */}
        {questionsByStatus.moreInfo.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-bold text-gray-900">More Info Requested ({questionsByStatus.moreInfo.length})</h2>
            </div>
            <div className="space-y-4">
              {Object.entries(
                questionsByStatus.moreInfo.reduce((acc, question) => {
                  const section = question.section || 'General'
                  if (!acc[section]) acc[section] = []
                  acc[section].push(question)
                  return acc
                }, {} as Record<string, AssessmentQuestion[]>)
              ).map(([section, sectionQuestions]) => (
                <div key={section}>
                  {Object.keys(groupedQuestions).length > 1 && (
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      {section}
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {sectionQuestions.map((question, index) => 
                      renderQuestionCard(question, index + 1, section, true)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show message if all questions are reviewed */}
        {questionsByStatus.pending.length === 0 && questionsByStatus.moreInfo.length === 0 && (
          <div className="text-center p-8 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">All Questions Reviewed</h3>
            <p className="text-green-700">You have completed reviewing all questions. You can now submit your decision.</p>
          </div>
        )}
      </div>

      </>
    )
  }

  // Default rendering (when not separating by status)
  return (
    <>
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

                    {/* Vendor Response Section - READ ONLY */}
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-semibold text-gray-700">Vendor Response (Read-Only)</span>
                        <Lock className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 border-dashed">
                        <div className="space-y-3">
                          {/* Response Value */}
                          <div className="text-base text-gray-900">
                            {renderResponseValue(response?.value, question.response_type)}
                          </div>
                          
                          {/* Vendor Comment */}
                          {response?.comment && (
                            <div className="pt-3 border-t border-gray-300">
                              <div className="flex items-start gap-2 mb-1">
                                <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-gray-600 mb-1">Vendor Comment:</div>
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white rounded p-2 border border-gray-200">
                                    {response.comment}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Attachments */}
                          {response?.documents && response.documents.length > 0 && (
                            <div className="pt-3 border-t border-gray-300">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                <div className="text-xs font-semibold text-gray-600">
                                  Attachments ({response.documents.length})
                                </div>
                              </div>
                              <div className="space-y-2">
                                {response.documents.map((doc, docIdx) => {
                                  const fileUrl = doc.path?.startsWith('http') 
                                    ? doc.path 
                                    : doc.path?.startsWith('/') 
                                      ? `${window.location.origin}/api${doc.path}`
                                      : `${window.location.origin}/uploads/${doc.path}`
                                  
                                  return (
                                    <div
                                      key={docIdx}
                                      className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                    >
                                      <div className="flex-shrink-0 text-gray-600">
                                        {getFileIcon(doc.name, doc.type)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                          {doc.name || 'Unnamed file'}
                                        </div>
                                        {doc.size && (
                                          <div className="text-xs text-gray-500">
                                            {formatFileSize(doc.size)}
                                            {doc.type && ` • ${doc.type}`}
                                          </div>
                                        )}
                                      </div>
                                      <a
                                        href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                        title="Download file"
                                  >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download</span>
                                  </a>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                    </div>

                    {/* Review Comments Section - APPROVER EDITABLE */}
                    {showReviewStatus && questionReview && (questionReview.reviewer_comment || questionReview.vendor_comment) && (
                      <div className="mt-4 space-y-3">
                        {questionReview.reviewer_comment && (
                          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Edit className="w-4 h-4 text-blue-700" />
                              <div className="text-sm font-semibold text-blue-900">Reviewer Comment (Your Review):</div>
                            </div>
                            <div className="text-base text-blue-800 whitespace-pre-wrap leading-relaxed bg-white rounded p-2 border border-blue-200">
                              {questionReview.reviewer_comment}
                            </div>
                          </div>
                        )}
                        {questionReview.vendor_comment && (
                          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="w-4 h-4 text-yellow-700" />
                              <div className="text-sm font-semibold text-yellow-900">Vendor Response to Reviewer:</div>
                            </div>
                            <div className="text-base text-yellow-800 whitespace-pre-wrap leading-relaxed bg-white rounded p-2 border border-yellow-200">
                              {questionReview.vendor_comment}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Question-Level Actions for Approvers - APPROVER EDITABLE */}
                    {showQuestionActions && !readOnly && assignmentId && (
                      <div className="mt-5 pt-4 border-t-2 border-blue-300 bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Edit className="w-4 h-4 text-blue-700" />
                          <span className="text-sm font-semibold text-blue-900">Review Actions (Editable)</span>
                        </div>
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
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => handleAccept(questionIdStr)}
                              disabled={reviewQuestionMutation.isPending || reviewStatus === 'pass'}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                                reviewStatus === 'pass'
                                  ? 'bg-green-700 text-white cursor-default'
                                  : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                              title={reviewStatus === 'pass' ? 'Already accepted' : 'Accept this response'}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeny(questionIdStr)}
                              disabled={reviewQuestionMutation.isPending || reviewStatus === 'fail'}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                                reviewStatus === 'fail'
                                  ? 'bg-red-700 text-white cursor-default'
                                  : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                              title={reviewStatus === 'fail' ? 'Already denied' : 'Deny this response'}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Deny
                            </button>
                            <button
                              onClick={() => handleMoreInfo(questionIdStr)}
                              disabled={reviewQuestionMutation.isPending || reviewStatus === 'in_progress'}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all border ${
                                reviewStatus === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700 border-blue-300 cursor-default'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                              title={reviewStatus === 'in_progress' ? 'More info requested' : 'Request more information'}
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              More Info
                            </button>
                            {onForwardQuestion && (
                              <button
                                onClick={() => {
                                  if (!isCompleted) {
                                    onForwardQuestion(questionIdStr)
                                  }
                                }}
                                disabled={isCompleted}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all border ${
                                  isCompleted
                                    ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-50'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                                title={isCompleted ? "Assessment already completed" : "Forward this question to another reviewer"}
                              >
                                <Forward className="w-3.5 h-3.5" />
                                Forward
                              </button>
                            )}
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

    </>
  )
}

