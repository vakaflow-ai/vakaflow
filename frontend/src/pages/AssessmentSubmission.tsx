import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Save, Send, ArrowLeft, CheckCircle, AlertCircle, 
  User, Building2, UserCheck, Calendar, Upload
} from 'lucide-react'
import { assessmentsApi } from '../lib/assessments'

const AssessmentSubmission: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [currentSection, setCurrentSection] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  // Data fetching using assessmentsApi
  const { data: assignmentDetails, isLoading: loadingDetails, error: detailsError } = useQuery({
    queryKey: ['assignment-details', assignmentId],
    queryFn: () => assessmentsApi.getAssignmentStatus(assignmentId!),
    enabled: !!assignmentId,
    refetchInterval: 30000
  })

  const { data: questions, isLoading: loadingQuestions, error: questionsError } = useQuery({
    queryKey: ['assignment-questions', assignmentId],
    queryFn: () => assessmentsApi.getAssignmentQuestions(assignmentId!),
    enabled: !!assignmentId
  })

  const { data: existingResponses, isLoading: loadingResponses } = useQuery({
    queryKey: ['assignment-responses', assignmentId],
    queryFn: () => assessmentsApi.getAssignmentResponses(assignmentId!),
    enabled: !!assignmentId
  })

  // Save mutation using assessmentsApi
  const saveMutation = useMutation({
    mutationFn: async ({ assignmentId, responses, isDraft }: { 
      assignmentId: string, responses: Record<string, any>, isDraft: boolean 
    }) => {
      if (isDraft) {
        await assessmentsApi.saveResponsesDraft(assignmentId, responses)
      } else {
        await assessmentsApi.saveResponses(assignmentId, responses)
      }
    },
    onSuccess: () => {
      setLastSaved(new Date())
      setUnsavedChanges(false)
      queryClient.invalidateQueries({ queryKey: ['assignment-responses', assignmentId] })
      queryClient.invalidateQueries({ queryKey: ['assignment-details', assignmentId] })
    },
    onError: (error) => {
      console.error('Save failed:', error)
      alert('Failed to save assessment. Please try again.')
    }
  })

  // Load existing responses
  useEffect(() => {
    if (existingResponses) {
      // Convert response format from API to component format
      const formattedResponses: Record<string, any> = {}
      Object.entries(existingResponses).forEach(([questionId, responseData]: [string, any]) => {
        formattedResponses[questionId] = responseData.value || responseData
      })
      setResponses(formattedResponses)
    }
  }, [existingResponses])

  // Auto-save functionality
  useEffect(() => {
    if (unsavedChanges && assignmentId) {
      const timer = setTimeout(() => handleSave(true), 30000)
      return () => clearTimeout(timer)
    }
  }, [responses, unsavedChanges, assignmentId])

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
    setUnsavedChanges(true)
  }

  const handleSave = async (isDraft = false) => {
    if (!assignmentId) return
    setIsSaving(true)
    try {
      await saveMutation.mutateAsync({ assignmentId, responses, isDraft })
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!assignmentId) return
    
    const requiredQuestions = questions?.filter((q: any) => q.is_required) || []
    const unansweredRequired = requiredQuestions.filter((q: any) => !responses[q.id])
    
    if (unansweredRequired.length > 0) {
      alert(`Please answer all required questions. ${unansweredRequired.length} required questions are still unanswered.`)
      return
    }

    setIsSaving(true)
    try {
      // Save final responses and trigger workflow
      const response = await assessmentsApi.saveResponses(assignmentId, responses, false)
      
      // Show success message with ticket number
      if (response.workflow_ticket_id) {
        alert(`Assessment submitted successfully! Ticket Number: ${response.workflow_ticket_id}`)
      } else {
        alert('Assessment submitted successfully!')
      }
      
      // Note: Workflow is automatically triggered by the backend on submission
      // No need to call triggerApprovalWorkflow separately
      
      // Navigate to success page
      navigate(`/assessments/assignment/${assignmentId}/submitted`)
    } catch (error) {
      console.error('Submission failed:', error)
      alert('Failed to submit assessment. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Group questions by section
  const sections = React.useMemo(() => {
    if (!questions) return []
    const grouped = questions.reduce((acc: any, question: any) => {
      const section = question.section || 'General'
      if (!acc[section]) acc[section] = []
      acc[section].push(question)
      return acc
    }, {})
    return Object.entries(grouped).map(([sectionName, sectionQuestions]) => ({
      name: sectionName, questions: sectionQuestions as any[]
    }))
  }, [questions])

  const getCurrentSectionQuestions = () => sections[currentSection]?.questions || []

  const isQuestionAnswered = (questionId: string) => {
    const response = responses[questionId]
    return response !== undefined && response !== null && response !== ''
  }

  const getProgress = () => {
    if (!questions) return 0
    const answered = questions.filter((q: any) => isQuestionAnswered(q.id)).length
    return Math.round((answered / questions.length) * 100)
  }

  const isOverdue = () => {
    if (!assignmentDetails?.due_date) return false
    return new Date(assignmentDetails.due_date) < new Date()
  }

  const isSubmitted = () => assignmentDetails?.status === 'completed'

  // Loading state
  if (loadingDetails || loadingQuestions || loadingResponses) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (detailsError || questionsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Assessment</h2>
          <p className="text-gray-600 mb-4">
            {detailsError?.message || questionsError?.message || 'Unknown error occurred'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Already submitted state
  if (isSubmitted()) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted</h1>
            <p className="text-gray-600 mb-6">
              Your assessment has been successfully submitted and is now being reviewed.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigate('/my-assessments')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View My Assessments
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/my-assessments" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to My Assessments
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {lastSaved && (
                <span className="text-sm text-gray-500">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
              {unsavedChanges && (
                <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              {/* Assessment Info */}
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  {assignmentDetails?.assessment_name || 'Assessment'}
                </h1>
                <p className="text-sm text-gray-600 mb-4">
                  {assignmentDetails?.assessment_id_display && (
                    <span>ID: {assignmentDetails.assessment_id_display}</span>
                  )}
                </p>
                
                <div className="space-y-2 text-sm">
                  {assignmentDetails?.point_of_contact && (
                    <div className="flex items-center text-gray-600">
                      <User className="h-4 w-4 mr-2" />
                      Contact: {assignmentDetails.point_of_contact.name || assignmentDetails.point_of_contact.email}
                    </div>
                  )}
                  {assignmentDetails?.due_date && (
                    <div className={`flex items-center ${isOverdue() ? 'text-red-600' : 'text-gray-600'}`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Due: {new Date(assignmentDetails.due_date).toLocaleDateString()}
                      {isOverdue() && <span className="ml-1 font-medium">(Overdue)</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{getProgress()}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgress()}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {questions?.filter((q: any) => isQuestionAnswered(q.id)).length || 0} of {questions?.length || 0} questions answered
                </div>
              </div>

              {/* Sections */}
              {sections.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Sections</h3>
                  <nav className="space-y-1">
                    {sections.map((section, index) => {
                      const sectionProgress = Math.round(
                        (section.questions.filter((q: any) => isQuestionAnswered(q.id)).length / section.questions.length) * 100
                      )
                      return (
                        <button
                          key={section.name}
                          onClick={() => setCurrentSection(index)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            currentSection === index
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>{section.name}</span>
                            <span className="text-xs text-gray-500">{sectionProgress}%</span>
                          </div>
                        </button>
                      )
                    })}
                  </nav>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Section Header */}
              {sections.length > 1 && (
                <div className="border-b px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {sections[currentSection]?.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Question {getCurrentSectionQuestions().findIndex((q: any) => !isQuestionAnswered(q.id)) + 1} of {getCurrentSectionQuestions().length} in this section
                  </p>
                </div>
              )}

              {/* Questions */}
              <div className="p-6">
                {getCurrentSectionQuestions().map((question: any, index: number) => (
                  <div key={question.id} className="mb-8 last:mb-0">
                    <div className="flex items-start space-x-3 mb-4">
                      <div className="flex-shrink-0 mt-1">
                        {isQuestionAnswered(question.id) ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : question.is_required ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-base font-medium text-gray-900">
                            {question.title || question.question_text}
                          </h3>
                          {question.is_required && (
                            <span className="text-red-500 text-sm">*</span>
                          )}
                        </div>
                        {question.description && (
                          <p className="text-sm text-gray-600 mb-4">{question.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Question Input */}
                    <div className="ml-8">
                      {question.field_type === 'text' && (
                        <input
                          type="text"
                          value={responses[question.id] || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter your answer..."
                        />
                      )}
                      
                      {question.field_type === 'textarea' && (
                        <textarea
                          value={responses[question.id] || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter your detailed answer..."
                        />
                      )}
                      
                      {question.field_type === 'select' && question.options && (
                        <select
                          value={responses[question.id] || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select an option...</option>
                          {question.options.map((option: any, optIndex: number) => (
                            <option key={optIndex} value={option.value || option}>
                              {option.label || option}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {question.field_type === 'number' && (
                        <input
                          type="number"
                          value={responses[question.id] || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter a number..."
                        />
                      )}
                      
                      {question.field_type === 'date' && (
                        <input
                          type="date"
                          value={responses[question.id] || ''}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      
                      {question.field_type === 'file' && (
                        <div>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleResponseChange(question.id, file.name)
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {responses[question.id] && (
                            <p className="text-sm text-gray-600 mt-2">Selected: {responses[question.id]}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="border-t px-6 py-4 flex justify-between items-center">
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving || !unsavedChanges}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSaving ? 'Submitting...' : 'Submit Assessment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssessmentSubmission
