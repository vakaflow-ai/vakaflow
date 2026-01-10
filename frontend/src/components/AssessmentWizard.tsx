import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ChevronRight, ChevronLeft, X, Plus, Trash2, Save, 
  CheckCircle2, FileQuestion, Link as LinkIcon,
  ArrowUp, ArrowDown, Filter, Settings, Search, Search as SearchIcon
} from 'lucide-react'
import { assessmentsApi, assessmentTemplatesApi, questionLibraryApi, assessmentRulesApi, Assessment, AssessmentType, AssessmentStatus, AssessmentQuestion, QuestionType, AssessmentTemplate, QuestionLibrary, RuleSuggestion } from '../lib/assessments'
import { submissionRequirementsApi } from '../lib/submissionRequirements'
import { usersApi } from '../lib/users'

interface AssessmentWizardProps {
  onClose: () => void
  onSuccess: (assessment: Assessment) => void
  userId: string
  initialAssessment?: Assessment | null
  mode?: 'create' | 'edit' | 'view'
  inline?: boolean  // If true, render inline instead of as modal
  initialStep?: 'template' | 'details' | 'questions' | 'review'  // Optional: override initial step
}

type WizardStep = 'template' | 'details' | 'questions' | 'review'

export default function AssessmentWizard({ onClose, onSuccess, userId, initialAssessment, mode = 'create', inline = false, initialStep }: AssessmentWizardProps) {
  const queryClient = useQueryClient()
  const isViewMode = mode === 'view'
  const isEditMode = mode === 'edit' || (mode === 'create' && initialAssessment)
  // Use initialStep prop if provided, otherwise use default logic
  const defaultStep: WizardStep = initialAssessment ? (isViewMode ? 'details' : 'questions') : 'template'
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep || defaultStep)
  const [selectedTemplate, setSelectedTemplate] = useState<AssessmentTemplate | null>(null)
  // Initialize state - only set from initialAssessment if it exists, otherwise use defaults
  const [assessmentData, setAssessmentData] = useState(() => {
    if (initialAssessment && initialAssessment.id) {
      return {
        name: initialAssessment.name,
        assessment_type: initialAssessment.assessment_type,
        description: initialAssessment.description || '',
        business_purpose: initialAssessment.business_purpose || '',
        status: initialAssessment.status,
        is_active: initialAssessment.is_active !== undefined ? initialAssessment.is_active : true,
        owner_id: initialAssessment.owner_id || userId,
        schedule_enabled: initialAssessment.schedule_enabled || false,
        schedule_frequency: initialAssessment.schedule_frequency || 'quarterly',
        schedule_interval_months: initialAssessment.schedule_interval_months || 3,
        assignment_rules: initialAssessment.assignment_rules || {},
      }
    }
    return {
      name: '',
      assessment_type: 'tprm' as AssessmentType,
      description: '',
      business_purpose: '',
      status: 'draft' as AssessmentStatus,
      is_active: true,
      owner_id: userId,
      schedule_enabled: false,
      schedule_frequency: 'quarterly' as 'quarterly' | 'yearly' | 'monthly' | 'bi_annual' | 'one_time' | 'custom',
      schedule_interval_months: 3,
      assignment_rules: {} as Record<string, any>,
    }
  })
  const [questions, setQuestions] = useState<Array<Partial<AssessmentQuestion>>>([])
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)
  const [questionFormData, setQuestionFormData] = useState({
    question_type: 'new_question' as QuestionType,
    title: '',
    question_text: '',
    description: '',
    field_type: 'text',
    response_type: '',
    category: '',
    is_required: false,
    options: [] as Array<{ value: string; label: string }>,
    requirement_id: '',
    section: '',
  })
  const [showRequirementSearch, setShowRequirementSearch] = useState(false)
  const [requirementSearchQuery, setRequirementSearchQuery] = useState('')
  const [showOwnerSearch, setShowOwnerSearch] = useState(false)
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('')
  const [showBulkAddQuestions, setShowBulkAddQuestions] = useState(false)
  const [showBulkAddRequirements, setShowBulkAddRequirements] = useState(false)
  const [bulkAddQuestionsTab, setBulkAddQuestionsTab] = useState<'library' | 'create'>('library')  // Tab state for modal
  const [selectedBulkQuestions, setSelectedBulkQuestions] = useState<Set<string>>(new Set())
  const [selectedBulkRequirements, setSelectedBulkRequirements] = useState<Set<string>>(new Set())
  const [libraryQuestions, setLibraryQuestions] = useState<QuestionLibrary[]>([])
  // Filters for bulk add questions modal
  const [questionSearchQuery, setQuestionSearchQuery] = useState('')
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState('')
  const [questionResponseTypeFilter, setQuestionResponseTypeFilter] = useState('')
  const [questionRequiredFilter, setQuestionRequiredFilter] = useState<'all' | 'required' | 'optional'>('all')
  // Column visibility for questions table
  const [questionColumnVisibility, setQuestionColumnVisibility] = useState<Record<string, boolean>>({
    id: true,
    title: true,
    description: true,
    category: true,
    responseType: true,
    required: true,
    fieldType: false,
    frameworks: true, // Show frameworks by default for compliance/risk teams
  })
  // Pagination for questions table
  const [questionsPage, setQuestionsPage] = useState(1)
  const [questionsPerPage, setQuestionsPerPage] = useState(10)
  const [ruleSuggestions, setRuleSuggestions] = useState<RuleSuggestion[]>([])
  const [showRuleSuggestions, setShowRuleSuggestions] = useState(false)

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['assessment-templates'],
    queryFn: () => assessmentTemplatesApi.list(),
  })

  // Fetch requirements
  const { data: requirements = [] } = useQuery({
    queryKey: ['submission-requirements'],
    queryFn: () => submissionRequirementsApi.list(),
  })

  // Fetch users for owner selection
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  // Fetch existing questions when editing
  const { data: existingQuestions = [] } = useQuery({
    queryKey: ['assessment-questions', initialAssessment?.id],
    queryFn: () => initialAssessment ? assessmentsApi.listQuestions(initialAssessment.id) : Promise.resolve([]),
    enabled: !!initialAssessment,
  })

  // Track which assessment ID we've initialized from to prevent overwriting user input
  const initializedAssessmentIdRef = useRef<string | null>(initialAssessment?.id || null)
  
  // Handle initialStep prop changes
  useEffect(() => {
    if (initialStep) {
      setCurrentStep(initialStep)
    }
  }, [initialStep])
  
  // Only update if assessment ID actually changes (switching between different assessments)
  // This should NEVER run while user is typing in create mode
  useEffect(() => {
    // Skip entirely if no initialAssessment (create mode) - don't interfere at all
    if (!initialAssessment || !initialAssessment.id) {
      return
    }
    
    // Only update if this is a different assessment than we've already initialized
    // This handles the case where user switches from one assessment to another
    if (initializedAssessmentIdRef.current !== initialAssessment.id) {
      setAssessmentData({
        name: initialAssessment.name,
        assessment_type: initialAssessment.assessment_type,
        description: initialAssessment.description || '',
        business_purpose: initialAssessment.business_purpose || '',
        status: initialAssessment.status,
        is_active: initialAssessment.is_active !== undefined ? initialAssessment.is_active : true,
        owner_id: initialAssessment.owner_id || userId,
        schedule_enabled: initialAssessment.schedule_enabled || false,
        schedule_frequency: initialAssessment.schedule_frequency || 'quarterly',
        schedule_interval_months: initialAssessment.schedule_interval_months || 3,
        assignment_rules: initialAssessment.assignment_rules || {},
      })
      initializedAssessmentIdRef.current = initialAssessment.id
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAssessment?.id]) // Only depend on ID - userId is stable, don't include it

  // Load existing questions when they're fetched
  useEffect(() => {
    if (existingQuestions.length > 0 && questions.length === 0 && initialAssessment) {
      setQuestions(existingQuestions.map(q => ({
        id: q.id, // Preserve ID for updates
        question_type: q.question_type,
        title: q.title,
        question_text: q.question_text,
        description: q.description,
        field_type: q.field_type,
        response_type: q.response_type,
        category: q.category,
        is_required: q.is_required,
        options: q.options,
        requirement_id: q.requirement_id,
        section: q.section,
        order: q.order,
      })))
    }
  }, [existingQuestions, initialAssessment])

  // Fetch rule suggestions when editing existing assessment
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (initialAssessment?.id && !isViewMode) {
        try {
          const suggestions = await assessmentRulesApi.applyRules(initialAssessment.id, false)
          setRuleSuggestions(suggestions)
        } catch (error) {
          // Silently fail - rule suggestions are optional
          // Only log if it's not a 404 (assessment not found) or 403 (not authenticated)
          if (error instanceof Error && !error.message.includes('not found') && !error.message.includes('Not authenticated')) {
            console.error('Failed to fetch rule suggestions:', error)
          }
        }
      }
    }
    
    fetchSuggestions()
  }, [initialAssessment?.id, isViewMode])

  // Function to apply rule suggestions
  const applyRuleSuggestions = async (suggestions: RuleSuggestion[], silent: boolean = false) => {
    const newQuestions: Array<Partial<AssessmentQuestion>> = []
    const newRequirements: Array<{ requirement_id: string; order: number }> = []
    
    for (const suggestion of suggestions) {
      // Add questions from library
      if (suggestion.questions_to_add.length > 0) {
        try {
          const libQuestions = await Promise.all(
            suggestion.questions_to_add.map(qId => questionLibraryApi.get(qId))
          )
          
          libQuestions.forEach((libQ, idx) => {
            newQuestions.push({
              question_type: 'new_question' as QuestionType,
              title: libQ.title,
              question_text: libQ.question_text,
              description: libQ.description,
              field_type: libQ.field_type,
              response_type: libQ.response_type,
              category: libQ.category,
              is_required: libQ.is_required,
              options: libQ.options,
              order: questions.length + newQuestions.length + idx + 1,
            })
          })
        } catch (error) {
          console.error(`Failed to load question ${suggestion.questions_to_add}:`, error)
        }
      }
      
      // Add requirements
      if (suggestion.requirements_to_add.length > 0) {
        suggestion.requirements_to_add.forEach((reqId, idx) => {
          newRequirements.push({
            requirement_id: reqId,
            order: questions.length + newQuestions.length + idx + 1,
          })
        })
      }
    }
    
    // Add questions
    if (newQuestions.length > 0) {
      setQuestions([...questions, ...newQuestions])
    }
    
    // Add requirements as question references
    if (newRequirements.length > 0) {
      const requirementQuestions = newRequirements.map(req => ({
        question_type: 'requirement_reference' as QuestionType,
        requirement_id: req.requirement_id,
        order: req.order,
      }))
      setQuestions([...questions, ...newQuestions, ...requirementQuestions])
    }
    
    if (!silent && (newQuestions.length > 0 || newRequirements.length > 0)) {
      // Show success message or notification
      console.log(`Applied ${newQuestions.length} questions and ${newRequirements.length} requirements from rules`)
    }
  }

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // First, create or update the assessment
      let assessment: Assessment
      if (initialAssessment) {
        assessment = await assessmentsApi.update(initialAssessment.id, assessmentData)
      } else {
        assessment = await assessmentsApi.create(assessmentData)
      }

      // Then, handle questions
      if (initialAssessment && existingQuestions.length > 0) {
        // For updates: Get existing questions and sync
        const currentExisting = await assessmentsApi.listQuestions(assessment.id)
        
        // Create a map of existing questions by a unique key
        const existingMap = new Map<string, AssessmentQuestion>()
        currentExisting.forEach(q => {
          const key = q.id || `${q.requirement_id || ''}_${q.question_text || ''}`
          existingMap.set(key, q)
        })

        // Track which questions we've processed
        const processedIds = new Set<string>()

        // Update or create questions
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i]
          const questionKey = (question as any).id || `${question.requirement_id || ''}_${question.question_text || ''}`
          const existing = existingMap.get(questionKey)

          const questionPayload: Partial<AssessmentQuestion> = {
            question_type: question.question_type,
            title: question.title,
            question_text: question.question_text,
            description: question.description,
            field_type: question.field_type,
            response_type: question.response_type,
            category: question.category,
            is_required: question.is_required,
            options: question.options,
            requirement_id: question.requirement_id,
            section: question.section,
            order: i + 1,
          }

          if (existing) {
            await assessmentsApi.updateQuestion(existing.id, questionPayload)
            processedIds.add(existing.id)
          } else {
            await assessmentsApi.addQuestion(assessment.id, questionPayload)
          }
        }

        // Delete questions that are no longer in the list
        for (const existing of currentExisting) {
          if (!processedIds.has(existing.id)) {
            await assessmentsApi.deleteQuestion(existing.id)
          }
        }
      } else {
        // For new assessments: Create all questions
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i]
          await assessmentsApi.addQuestion(assessment.id, {
            question_type: question.question_type,
            title: question.title,
            question_text: question.question_text,
            description: question.description,
            field_type: question.field_type,
            response_type: question.response_type,
            category: question.category,
            is_required: question.is_required,
            options: question.options,
            requirement_id: question.requirement_id,
            section: question.section,
            order: i + 1,
          })
        }
      }

      // After assessment is created/updated, fetch rule suggestions
      if (assessment.id) {
        try {
          const suggestions = await assessmentRulesApi.applyRules(assessment.id, false)
          setRuleSuggestions(suggestions)
          
          // Auto-apply automatic rules
          const autoRules = suggestions.filter(s => {
            // We'd need to fetch rule details to check is_automatic
            // For now, we'll apply rules that have is_automatic flag
            // This will be improved when we enhance the API response
            return true // Will be filtered properly in future
          })
          
          if (autoRules.length > 0 && questions.length === 0) {
            // Only auto-apply if no questions exist yet
            await applyRuleSuggestions(autoRules, true)
          }
        } catch (error) {
          // Silently fail - rule suggestions are optional
          // Only log if it's not a 404 (assessment not found) or 403 (not authenticated)
          if (error instanceof Error && !error.message.includes('not found') && !error.message.includes('Not authenticated')) {
            console.error('Failed to fetch rule suggestions:', error)
          }
        }
      }
      
      return assessment
    },
    onSuccess: (assessment) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] })
      queryClient.invalidateQueries({ queryKey: ['assessment-questions', assessment.id] })
      onSuccess(assessment)
      // Don't close immediately - let user see rule suggestions
      // onClose()
    },
  })

  const handleTemplateSelect = (template: AssessmentTemplate) => {
    setSelectedTemplate(template)
    setAssessmentData(prev => ({
      ...prev,
      name: template.name,
      assessment_type: template.assessment_type as AssessmentType,
      description: template.description || '',
    }))
    if (template.questions) {
      setQuestions(template.questions.map((q: any, idx: number) => ({
        question_type: q.question_type || 'new_question',
        title: q.title || '',
        question_text: q.question_text || '',
        description: q.description || '',
        field_type: q.field_type || 'text',
        response_type: q.response_type || '',
        category: q.category || '',
        is_required: q.is_required || false,
        options: q.options || [],
        requirement_id: q.requirement_id || '',
        section: q.section || '',
        order: idx + 1,
      })))
    }
    setCurrentStep('details')
  }

  const handleAddQuestion = async () => {
    if (questionFormData.question_type === 'requirement_reference' && !questionFormData.requirement_id) {
      setShowRequirementSearch(true)
      return
    }
    
    if (questionFormData.question_type === 'new_question' && !questionFormData.question_text.trim()) {
      return
    }

    const newQuestion: Partial<AssessmentQuestion> = {
      question_type: questionFormData.question_type,
      title: questionFormData.title || undefined,
      question_text: questionFormData.question_text || undefined,
      description: questionFormData.description || undefined,
      field_type: questionFormData.field_type,
      response_type: questionFormData.response_type || undefined,
      category: questionFormData.category || undefined,
      is_required: questionFormData.is_required,
      options: questionFormData.options,
      requirement_id: questionFormData.requirement_id || undefined,
      section: questionFormData.section || undefined,
      order: questions.length + 1,
    }

    // If it's a new custom question (not requirement reference), sync to library
    if (questionFormData.question_type === 'new_question' && editingQuestionIndex === null) {
      try {
        await questionLibraryApi.create({
          title: questionFormData.title || questionFormData.question_text || 'Untitled Question',
          question_text: questionFormData.question_text || '',
          description: questionFormData.description,
          assessment_type: [assessmentData.assessment_type],
          category: questionFormData.category,
          field_type: questionFormData.field_type,
          response_type: questionFormData.response_type || 'Text',
          is_required: questionFormData.is_required,
          options: questionFormData.options,
        })
        // Refresh library questions
        queryClient.invalidateQueries({ queryKey: ['question-library'] })
      } catch (error) {
        console.error('Failed to sync question to library:', error)
        // Continue anyway - don't block question addition
      }
    }

    if (editingQuestionIndex !== null) {
      const updated = [...questions]
      updated[editingQuestionIndex] = newQuestion
      setQuestions(updated)
      setEditingQuestionIndex(null)
    } else {
      setQuestions([...questions, newQuestion])
    }

    // Reset form
    setQuestionFormData({
      question_type: 'new_question',
      title: '',
      question_text: '',
      description: '',
      field_type: 'text',
      response_type: '',
      category: '',
      is_required: false,
      options: [],
      requirement_id: '',
      section: '',
    })
    setShowRequirementSearch(false)
  }

  const handleEditQuestion = (index: number) => {
    const question = questions[index]
    setQuestionFormData({
      question_type: question.question_type || 'new_question',
      title: question.title || '',
      question_text: question.question_text || '',
      description: question.description || '',
      field_type: question.field_type || 'text',
      response_type: question.response_type || '',
      category: question.category || '',
      is_required: question.is_required || false,
      options: question.options || [],
      requirement_id: question.requirement_id || '',
      section: question.section || '',
    })
    setEditingQuestionIndex(index)
    if (question.question_type === 'requirement_reference') {
      setShowRequirementSearch(true)
    }
  }

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index).map((q, idx) => ({ ...q, order: idx + 1 })))
  }

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= questions.length) return

    const updated = [...questions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setQuestions(updated.map((q, idx) => ({ ...q, order: idx + 1 })))
  }

  const handleRequirementSelect = (requirementId: string) => {
    setQuestionFormData({ ...questionFormData, requirement_id: requirementId })
    setShowRequirementSearch(false)
  }

  const filteredRequirements = requirements.filter(req =>
    req.label?.toLowerCase().includes(requirementSearchQuery.toLowerCase()) ||
    req.catalog_id?.toLowerCase().includes(requirementSearchQuery.toLowerCase())
  )

  // Reset to page 1 when filters change
  useEffect(() => {
    setQuestionsPage(1)
  }, [questionSearchQuery, questionCategoryFilter, questionResponseTypeFilter, questionRequiredFilter])

  const canProceed = () => {
    switch (currentStep) {
      case 'template':
        return selectedTemplate !== null || assessmentData.name.trim() !== ''
      case 'details':
        return assessmentData.name.trim() !== '' && assessmentData.owner_id !== ''
      case 'questions':
        return true // Questions are optional
      case 'review':
        return true
      default:
        return false
    }
  }

  const steps: Array<{ key: WizardStep; label: string; description: string }> = [
    { key: 'template', label: 'Template', description: 'Choose a template or create custom' },
    { key: 'details', label: 'Details', description: 'Assessment information' },
    { key: 'questions', label: 'Questions', description: 'Add questions and requirements' },
    { key: 'review', label: 'Review', description: 'Review and save' },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === currentStep)

  // Render wizard content directly - no function wrapper to prevent remounts
  const wizardContent = (
    <div className={`${inline ? 'w-full bg-white border rounded-lg shadow-sm' : 'bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh]'} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="unified-page-title">
              {isViewMode ? 'View Assessment' : initialAssessment ? 'Edit Assessment' : 'Create Assessment'}
            </h2>
            <p className="unified-page-subtitle mt-1">
              {isViewMode ? 'Read-only view of assessment details' : 'Guided step-by-step process'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-2 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <button
                    onClick={() => {
                      // Only allow going back, not forward
                      if (index <= currentStepIndex) {
                        setCurrentStep(step.key)
                      }
                    }}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      index < currentStepIndex
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : index === currentStepIndex
                        ? 'border-indigo-600 text-indigo-600 bg-white'
                        : 'border-gray-300 text-gray-600 bg-white'
                    }`}
                    disabled={index > currentStepIndex}
                  >
                    {index < currentStepIndex ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-medium">{index + 1}</span>
                    )}
                  </button>
                  <div className="mt-2 text-center">
                    <div className={`text-xs font-medium ${
                      index <= currentStepIndex ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    index < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Template Selection */}
          {currentStep === 'template' && (
            <div className="space-y-6">
              <div>
                <h3 className="unified-section-title mb-2">Choose Assessment Template</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select a pre-configured template or create a custom assessment from scratch.
                </p>
              </div>

              {templates.length > 0 && (
                <div>
                  <h4 className="unified-card-title mb-3">Pre-configured Templates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{template.name}</h5>
                          {selectedTemplate?.id === template.id && (
                            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileQuestion className="w-3 h-3" />
                            {template.questions?.length || 0} questions
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                <h4 className="unified-card-title mb-3">Or Create Custom Assessment</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Assessment Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assessmentData.name}
                      onChange={(e) => {
                        const value = e.target.value
                        setAssessmentData(prev => ({ ...prev, name: value }))
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter assessment name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Assessment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assessmentData.assessment_type}
                      onChange={(e) => setAssessmentData({ ...assessmentData, assessment_type: e.target.value as AssessmentType })}
                      disabled={isViewMode}
                      className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="tprm">TPRM</option>
                      <option value="vendor_qualification">Vendor Qualification</option>
                      <option value="risk_assessment">Risk Assessment</option>
                      <option value="ai_vendor_qualification">AI-Vendor Qualification</option>
                      <option value="security_assessment">Security Assessment</option>
                      <option value="compliance_assessment">Compliance Assessment</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Assessment Details */}
          {currentStep === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="unified-section-title mb-2">Assessment Details</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure the basic information for your assessment.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Assessment Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={assessmentData.name}
                    onChange={(e) => {
                      const value = e.target.value
                      setAssessmentData(prev => ({ ...prev, name: value }))
                    }}
                    disabled={isViewMode}
                    readOnly={isViewMode}
                    className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="Enter assessment name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Assessment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assessmentData.assessment_type}
                      onChange={(e) => setAssessmentData(prev => ({ ...prev, assessment_type: e.target.value as AssessmentType }))}
                      disabled={isViewMode}
                      className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="tprm">TPRM</option>
                      <option value="vendor_qualification">Vendor Qualification</option>
                      <option value="risk_assessment">Risk Assessment</option>
                      <option value="ai_vendor_qualification">AI-Vendor Qualification</option>
                      <option value="security_assessment">Security Assessment</option>
                      <option value="compliance_assessment">Compliance Assessment</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assessmentData.status}
                      onChange={(e) => setAssessmentData(prev => ({ ...prev, status: e.target.value as AssessmentStatus }))}
                      disabled={isViewMode}
                      className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assessmentData.is_active ?? true}
                      onChange={(e) => setAssessmentData(prev => ({ ...prev, is_active: e.target.checked }))}
                      disabled={isViewMode}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <span className="text-xs text-gray-500">(Assessment is active and available for use)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                    <textarea
                      value={assessmentData.description}
                      onChange={(e) => {
                        const value = e.target.value
                        setAssessmentData(prev => ({ ...prev, description: value }))
                      }}
                      disabled={isViewMode}
                      readOnly={isViewMode}
                      className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      rows={3}
                      placeholder="Enter assessment description"
                    />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Purpose</label>
                    <textarea
                      value={assessmentData.business_purpose || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setAssessmentData(prev => ({ ...prev, business_purpose: value }))
                      }}
                      disabled={isViewMode}
                      readOnly={isViewMode}
                      className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      rows={3}
                      placeholder="Enter business purpose of this assessment"
                    />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Owner <span className="text-red-500">*</span>
                  </label>
                  {showOwnerSearch ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                          <input
                            type="text"
                            value={ownerSearchQuery}
                            onChange={(e) => setOwnerSearchQuery(e.target.value)}
                            placeholder="Search by name or email..."
                            className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => {
                            setShowOwnerSearch(false)
                            setOwnerSearchQuery('')
                          }}
                          className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        {(() => {
                          const filtered = users.filter(u => {
                            const query = ownerSearchQuery.toLowerCase()
                            return !query || 
                              u.name?.toLowerCase().includes(query) ||
                              u.email?.toLowerCase().includes(query) ||
                              u.id.toLowerCase().includes(query)
                          })
                          return filtered.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500 text-center">No users found</div>
                          ) : (
                            filtered.map(u => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setAssessmentData({ ...assessmentData, owner_id: u.id })
                                  setShowOwnerSearch(false)
                                  setOwnerSearchQuery('')
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                  assessmentData.owner_id === u.id ? 'bg-indigo-100' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{u.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                                  </div>
                                  {assessmentData.owner_id === u.id && (
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 ml-2" />
                                  )}
                                </div>
                              </button>
                            ))
                          )
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={users.find(u => u.id === assessmentData.owner_id) 
                              ? `${users.find(u => u.id === assessmentData.owner_id)?.name || ''} (${users.find(u => u.id === assessmentData.owner_id)?.email || ''})`
                              : ''}
                            readOnly
                            placeholder="Click search to find owner..."
                            disabled={isViewMode}
                            onClick={() => !isViewMode && setShowOwnerSearch(true)}
                            className={`w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-gray-300 bg-white cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${isViewMode ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          />
                          <button
                            type="button"
                            onClick={() => !isViewMode && setShowOwnerSearch(true)}
                            disabled={isViewMode}
                            className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-600 hover:text-indigo-600 rounded ${isViewMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            title="Search for owner"
                          >
                            <SearchIcon className="w-4 h-4" />
                          </button>
                        </div>
                        {assessmentData.owner_id && !isViewMode && (
                          <button
                            type="button"
                            onClick={() => setAssessmentData({ ...assessmentData, owner_id: '' })}
                            className="p-2 text-gray-600 hover:text-red-600 rounded"
                            title="Clear owner"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assessmentData.is_active !== undefined ? assessmentData.is_active : true}
                      onChange={(e) => {
                        setAssessmentData(prev => ({ ...prev, is_active: e.target.checked }))
                      }}
                      disabled={isViewMode}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active
                    </span>
                    <span className="text-xs text-gray-500">(Assessment is active and can be used)</span>
                  </label>
                </div>

                {/* Questions Button - Only show when editing/viewing existing assessment */}
                {initialAssessment && !isViewMode && (
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => setCurrentStep('questions')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <FileQuestion className="w-4 h-4" />
                      Manage Questions
                    </button>
                  </div>
                )}

                {/* Rule Suggestions - Show when we have suggestions */}
                {ruleSuggestions.length > 0 && !isViewMode && (
                  <div className="pt-4 border-t">
                    <div className="bg-blue-50 border border-blue-400 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-blue-900">
                          Suggested Questions & Requirements
                        </h4>
                        <button
                          onClick={() => setShowRuleSuggestions(!showRuleSuggestions)}
                          className="text-xs text-blue-600 hover:text-blue-600 font-medium"
                        >
                          {showRuleSuggestions ? 'Hide' : 'Show'} ({ruleSuggestions.length})
                        </button>
                      </div>
                      
                      {showRuleSuggestions && (
                        <div className="space-y-3">
                          {ruleSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="bg-white border border-blue-400 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">
                                    {suggestion.rule_name}
                                  </div>
                                  {suggestion.rule_description && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      {suggestion.rule_description}
                                    </div>
                                  )}
                                  <div className="text-xs text-blue-600 mt-2">
                                    {suggestion.match_reason}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                                    {suggestion.questions_to_add.length > 0 && (
                                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                                        {suggestion.questions_to_add.length} Questions
                                      </span>
                                    )}
                                    {suggestion.requirements_to_add.length > 0 && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                        {suggestion.requirements_to_add.length} Requirements
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => applyRuleSuggestions([suggestion])}
                                  className="ml-3 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          <button
                            onClick={() => applyRuleSuggestions(ruleSuggestions)}
                            className="w-full mt-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Apply All Suggestions
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Questions */}
          {currentStep === 'questions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="unified-section-title mb-2">Add Questions</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Add questions to your assessment. You can reference existing requirements or create new questions.
                  </p>
                </div>
                {!isViewMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setShowBulkAddQuestions(true)
                        // Fetch library questions for this assessment type
                        try {
                          const questions = await questionLibraryApi.list({
                            assessment_type: assessmentData.assessment_type,
                            is_active: true
                          })
                          // Filter questions that include this assessment type in their array
                          const filtered = questions.filter(q => {
                            const qTypes = Array.isArray(q.assessment_type) ? q.assessment_type : [q.assessment_type]
                            return qTypes.includes(assessmentData.assessment_type)
                          })
                          // Sort by question_id (human-readable ID)
                          const sorted = filtered.sort((a, b) => {
                            // Questions with question_id come first, sorted by question_id
                            if (a.question_id && b.question_id) {
                              return a.question_id.localeCompare(b.question_id)
                            }
                            if (a.question_id) return -1
                            if (b.question_id) return 1
                            // If no question_id, sort by title
                            return (a.title || '').localeCompare(b.title || '')
                          })
                          setLibraryQuestions(sorted)
                        } catch (error) {
                          console.error('Failed to load library questions:', error)
                          setLibraryQuestions([])
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Questions Group
                    </button>
                    <button
                      onClick={() => setShowBulkAddRequirements(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Requirements Group
                    </button>
                  </div>
                )}
              </div>

              {/* Question Edit Form - Only shown when editing */}
              {!isViewMode && editingQuestionIndex !== null && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-4">
                  Edit Question
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Question Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={questionFormData.question_type}
                      onChange={(e) => {
                        setQuestionFormData({ 
                          ...questionFormData, 
                          question_type: e.target.value as QuestionType,
                          requirement_id: '',
                          question_text: ''
                        })
                        if (e.target.value === 'requirement_reference') {
                          setShowRequirementSearch(true)
                        }
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="new_question">New Question</option>
                      <option value="requirement_reference">Reference Existing Requirement</option>
                    </select>
                  </div>

                  {questionFormData.question_type === 'requirement_reference' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Requirement <span className="text-red-500">*</span>
                      </label>
                      {showRequirementSearch ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={requirementSearchQuery}
                              onChange={(e) => setRequirementSearchQuery(e.target.value)}
                              placeholder="Search requirements..."
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                setShowRequirementSearch(false)
                                setRequirementSearchQuery('')
                              }}
                              className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                            {filteredRequirements.length === 0 ? (
                              <div className="p-4 text-sm text-gray-500 text-center">No requirements found</div>
                            ) : (
                              filteredRequirements.map(req => (
                                <button
                                  key={req.id}
                                  onClick={() => handleRequirementSelect(req.id)}
                                  className={`w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                    questionFormData.requirement_id === req.id ? 'bg-indigo-100' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {req.catalog_id && <span className="text-indigo-600">{req.catalog_id}: </span>}
                                        {req.label}
                                      </div>
                                      {req.description && (
                                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{req.description}</div>
                                      )}
                                    </div>
                                    {questionFormData.requirement_id === req.id && (
                                      <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 ml-2" />
                                    )}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {questionFormData.requirement_id ? (
                            <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm font-medium text-indigo-900">
                                  {requirements.find(r => r.id === questionFormData.requirement_id)?.catalog_id && 
                                    `${requirements.find(r => r.id === questionFormData.requirement_id)?.catalog_id}: `}
                                  {requirements.find(r => r.id === questionFormData.requirement_id)?.label}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setQuestionFormData({ ...questionFormData, requirement_id: '' })
                                  setShowRequirementSearch(true)
                                }}
                                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRequirementSearch(true)}
                              className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-lg hover:border-indigo-300 hover:bg-gray-50 flex items-center justify-between"
                            >
                              <span className="text-gray-500">Select requirement</span>
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Question Title
                        </label>
                        <input
                          type="text"
                          value={questionFormData.title || ''}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, title: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter question title (optional)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Question Text <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={questionFormData.question_text}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          rows={3}
                          placeholder="Enter question text"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                        <textarea
                          value={questionFormData.description || ''}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, description: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          rows={2}
                          placeholder="Enter question description (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Field Type</label>
                          <select
                            value={questionFormData.field_type}
                            onChange={(e) => setQuestionFormData({ ...questionFormData, field_type: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="text">Text</option>
                            <option value="textarea">Textarea</option>
                            <option value="number">Number</option>
                            <option value="email">Email</option>
                            <option value="url">URL</option>
                            <option value="date">Date</option>
                            <option value="select">Select</option>
                            <option value="multi_select">Multi-Select</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="radio">Radio</option>
                            <option value="file">File Upload</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Response Type</label>
                          <select
                            value={questionFormData.response_type || ''}
                            onChange={(e) => setQuestionFormData({ ...questionFormData, response_type: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">Select response type</option>
                            <option value="Text">Text</option>
                            <option value="File">File</option>
                            <option value="Number">Number</option>
                            <option value="Date">Date</option>
                            <option value="Boolean">Boolean</option>
                            <option value="MultiSelect">Multi-Select</option>
                            <option value="URL">URL</option>
                            <option value="Email">Email</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                          <input
                            type="text"
                            value={questionFormData.category || ''}
                            onChange={(e) => setQuestionFormData({ ...questionFormData, category: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter category (optional)"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Section</label>
                          <input
                            type="text"
                            value={questionFormData.section}
                            onChange={(e) => setQuestionFormData({ ...questionFormData, section: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Optional section name"
                          />
                        </div>
                      </div>
                      {(questionFormData.field_type === 'select' || questionFormData.field_type === 'multi_select' || questionFormData.field_type === 'radio' || questionFormData.field_type === 'checkbox') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Options</label>
                          <div className="space-y-2">
                            {questionFormData.options.map((opt, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input
                                  type="text"
                                  value={opt.value}
                                  onChange={(e) => {
                                    const newOptions = [...questionFormData.options]
                                    newOptions[idx].value = e.target.value
                                    setQuestionFormData({ ...questionFormData, options: newOptions })
                                  }}
                                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  placeholder="Value"
                                />
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => {
                                    const newOptions = [...questionFormData.options]
                                    newOptions[idx].label = e.target.value
                                    setQuestionFormData({ ...questionFormData, options: newOptions })
                                  }}
                                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  placeholder="Label"
                                />
                                <button
                                  onClick={() => {
                                    const newOptions = questionFormData.options.filter((_, i) => i !== idx)
                                    setQuestionFormData({ ...questionFormData, options: newOptions })
                                  }}
                                  className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => setQuestionFormData({ ...questionFormData, options: [...questionFormData.options, { value: '', label: '' }] })}
                              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_required"
                      checked={questionFormData.is_required}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, is_required: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="is_required" className="text-sm font-medium text-gray-700">
                      Required
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAddQuestion}
                      disabled={
                        (questionFormData.question_type === 'requirement_reference' && !questionFormData.requirement_id) ||
                        (questionFormData.question_type === 'new_question' && !questionFormData.question_text.trim())
                      }
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}
                    </button>
                    {editingQuestionIndex !== null && (
                      <button
                        onClick={() => {
                          setEditingQuestionIndex(null)
                          setQuestionFormData({
                            question_type: 'new_question',
                            title: '',
                            question_text: '',
                            description: '',
                            field_type: 'text',
                            response_type: '',
                            category: '',
                            is_required: false,
                            options: [],
                            requirement_id: '',
                            section: '',
                          })
                          setShowRequirementSearch(false)
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Questions List */}
              {questions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Questions ({questions.length})</h4>
                  <div className="space-y-2">
                    {questions.map((question, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex flex-col gap-1 pt-1">
                          <button
                            onClick={() => handleMoveQuestion(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ArrowUp className="w-4 h-4 text-gray-600" />
                          </button>
                          <span className="text-xs font-medium text-gray-500 text-center w-6">{index + 1}</span>
                          <button
                            onClick={() => handleMoveQuestion(index, 'down')}
                            disabled={index === questions.length - 1}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ArrowDown className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                        <div className="flex-1">
                          {/* Title or Question Text */}
                          <div className="font-medium text-gray-900">
                            {question.title || (question.question_type === 'requirement_reference' 
                              ? (requirements.find(r => r.id === question.requirement_id)?.label || 'Requirement Reference')
                              : question.question_text || 'Untitled Question')}
                          </div>
                          
                          {/* Description */}
                          {question.description && (
                            <div className="text-sm text-gray-600 mt-1">{question.description}</div>
                          )}
                          
                          {/* Question Text (if different from title) */}
                          {question.title && question.question_text && question.question_type !== 'requirement_reference' && (
                            <div className="text-sm text-gray-700 mt-1">{question.question_text}</div>
                          )}
                          
                          {/* Requirement Reference Indicator */}
                          {question.question_type === 'requirement_reference' && (
                            <div className="flex items-center gap-2 mt-1">
                              <LinkIcon className="w-3 h-3 text-indigo-600" />
                              <span className="text-xs text-indigo-600">
                                {requirements.find(r => r.id === question.requirement_id)?.catalog_id && 
                                  `${requirements.find(r => r.id === question.requirement_id)?.catalog_id}: `}
                                Requirement Reference
                              </span>
                            </div>
                          )}
                          
                          {/* Metadata Tags */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                              Type: {question.question_type === 'requirement_reference' ? 'Reference' : 'Question'}
                            </span>
                            {question.response_type && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                Response: {question.response_type}
                              </span>
                            )}
                            {question.field_type && question.question_type !== 'requirement_reference' && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded">
                                Field: {question.field_type}
                              </span>
                            )}
                            {question.category && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                Category: {question.category}
                              </span>
                            )}
                            {question.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">Required</span>
                            )}
                            {question.section && (
                              <span className="text-xs text-gray-500">Section: {question.section}</span>
                            )}
                          </div>
                        </div>
                        {!isViewMode && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditQuestion(index)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="Edit"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bulk Add Questions Modal */}
              {showBulkAddQuestions && (() => {
                // Get IDs of questions already added to the assessment
                // Questions from library are identified by matching title/question_text
                // or by reusable_question_id if available
                const existingQuestionIds = new Set(
                  questions
                    .filter(q => q.reusable_question_id || q.requirement_id)
                    .map(q => q.reusable_question_id || q.requirement_id)
                    .filter(Boolean)
                )
                
                // Also check by matching question text/title to catch questions added from library
                // that might not have reusable_question_id set
                const existingQuestionTexts = new Set(
                  questions
                    .filter(q => q.question_text || q.title)
                    .map(q => (q.question_text || q.title || '').toLowerCase().trim())
                    .filter(Boolean)
                )
                
                // Filter questions based on search and filters, and exclude already added questions
                const filteredQuestions = libraryQuestions.filter(q => {
                  // Skip questions that are already added (by ID or by matching text)
                  if (existingQuestionIds.has(q.id)) {
                    return false
                  }
                  
                  // Also check if question text/title matches an existing question
                  const questionText = (q.question_text || q.title || '').toLowerCase().trim()
                  if (existingQuestionTexts.has(questionText)) {
                    return false
                  }
                  
                  const matchesSearch = !questionSearchQuery || 
                    (q.title || q.question_text || '').toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
                    (q.description || '').toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
                    (q.question_id || q.id).toLowerCase().includes(questionSearchQuery.toLowerCase())
                  const matchesCategory = !questionCategoryFilter || q.category === questionCategoryFilter
                  const matchesResponseType = !questionResponseTypeFilter || q.response_type === questionResponseTypeFilter
                  const matchesRequired = questionRequiredFilter === 'all' || 
                    (questionRequiredFilter === 'required' && q.is_required) ||
                    (questionRequiredFilter === 'optional' && !q.is_required)
                  return matchesSearch && matchesCategory && matchesResponseType && matchesRequired
                })

                // Get unique values for filters
                const categories = Array.from(new Set(libraryQuestions.map(q => q.category).filter(Boolean)))
                const responseTypes = Array.from(new Set(libraryQuestions.map(q => q.response_type).filter(Boolean)))

                // Pagination calculations
                const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage)
                const startIndex = (questionsPage - 1) * questionsPerPage
                const endIndex = startIndex + questionsPerPage
                const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex)

                // Select all handler (for current page)
                const handleSelectAll = (checked: boolean) => {
                  if (checked) {
                    const currentPageIds = new Set(paginatedQuestions.map(q => q.id))
                    setSelectedBulkQuestions(prev => new Set([...prev, ...currentPageIds]))
                  } else {
                    // Deselect only current page items
                    const currentPageIds = new Set(paginatedQuestions.map(q => q.id))
                    setSelectedBulkQuestions(prev => {
                      const next = new Set(prev)
                      currentPageIds.forEach(id => next.delete(id))
                      return next
                    })
                  }
                }

                // Check if all items on current page are selected
                const allSelectedOnPage = paginatedQuestions.length > 0 && paginatedQuestions.every(q => selectedBulkQuestions.has(q.id))
                const someSelectedOnPage = paginatedQuestions.some(q => selectedBulkQuestions.has(q.id)) && !allSelectedOnPage

                return (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                      <div className="flex items-center justify-between p-6 border-b">
                        <div>
                          <h3 className="unified-section-title">Add Questions Group</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {bulkAddQuestionsTab === 'library' 
                              ? 'Select multiple questions from the library to add to this assessment'
                              : 'Create a new question and add it to the library and this assessment'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowBulkAddQuestions(false)
                            setSelectedBulkQuestions(new Set())
                            setQuestionSearchQuery('')
                            setQuestionCategoryFilter('')
                            setQuestionResponseTypeFilter('')
                            setQuestionRequiredFilter('all')
                            setBulkAddQuestionsTab('library')
                            // Reset form
                            setQuestionFormData({
                              question_type: 'new_question',
                              title: '',
                              question_text: '',
                              description: '',
                              field_type: 'text',
                              response_type: '',
                              category: '',
                              is_required: false,
                              options: [],
                              requirement_id: '',
                              section: '',
                            })
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Tabs - Made more actionable with button-like styling */}
                      <div className="flex gap-2 p-4 border-b bg-gray-50">
                        <button
                          onClick={() => setBulkAddQuestionsTab('library')}
                          className={`flex-1 px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                            bulkAddQuestionsTab === 'library'
                              ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <FileQuestion className={`w-4 h-4 ${bulkAddQuestionsTab === 'library' ? 'text-white' : 'text-gray-600'}`} />
                            <span>Select from Library</span>
                          </div>
                        </button>
                        <button
                          onClick={() => setBulkAddQuestionsTab('create')}
                          className={`flex-1 px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                            bulkAddQuestionsTab === 'create'
                              ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Plus className={`w-4 h-4 ${bulkAddQuestionsTab === 'create' ? 'text-white' : 'text-gray-600'}`} />
                            <span>Create New Question</span>
                          </div>
                        </button>
                      </div>

                      {/* Content based on active tab */}
                      {bulkAddQuestionsTab === 'library' ? (
                        <>
                      {/* Filters Section */}
                      <div className="p-4 border-b bg-gray-50 space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Search */}
                          <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                              <input
                                type="text"
                                placeholder="Search by ID, title, or description..."
                                value={questionSearchQuery}
                                onChange={(e) => setQuestionSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Category Filter */}
                          <select
                            value={questionCategoryFilter}
                            onChange={(e) => setQuestionCategoryFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>

                          {/* Response Type Filter */}
                          <select
                            value={questionResponseTypeFilter}
                            onChange={(e) => setQuestionResponseTypeFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">All Response Types</option>
                            {responseTypes.map(rt => (
                              <option key={rt} value={rt}>{rt}</option>
                            ))}
                          </select>

                          {/* Required Filter */}
                          <select
                            value={questionRequiredFilter}
                            onChange={(e) => setQuestionRequiredFilter(e.target.value as 'all' | 'required' | 'optional')}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="all">All Questions</option>
                            <option value="required">Required Only</option>
                            <option value="optional">Optional Only</option>
                          </select>

                          {/* Column Visibility Toggle */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                // Toggle column visibility for fieldType and frameworks
                                setQuestionColumnVisibility(prev => ({
                                  ...prev,
                                  fieldType: !prev.fieldType,
                                  frameworks: !prev.frameworks
                                }))
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                              title="Toggle column visibility"
                            >
                              <Settings className="w-4 h-4" />
                              Columns
                            </button>
                          </div>
                        </div>

                        {/* Results count, pagination controls, and select all */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="text-sm text-gray-600">
                            Showing {startIndex + 1}-{Math.min(endIndex, filteredQuestions.length)} of {filteredQuestions.length} questions
                            {existingQuestionIds.size > 0 && (
                              <span className="ml-2 text-gray-500 text-xs">
                                ({existingQuestionIds.size} already added)
                              </span>
                            )}
                            {selectedBulkQuestions.size > 0 && (
                              <span className="ml-2 text-indigo-600 font-medium">
                                ({selectedBulkQuestions.size} selected)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Items per page selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">Per page:</span>
                              <select
                                value={questionsPerPage}
                                onChange={(e) => {
                                  setQuestionsPerPage(Number(e.target.value))
                                  setQuestionsPage(1) // Reset to first page when changing page size
                                }}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                              </select>
                            </div>
                            {/* Pagination controls */}
                            {totalPages > 1 && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setQuestionsPage(prev => Math.max(1, prev - 1))}
                                  disabled={questionsPage === 1}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                                <span className="px-2 py-1 text-xs text-gray-600">
                                  Page {questionsPage} of {totalPages}
                                </span>
                                <button
                                  onClick={() => setQuestionsPage(prev => Math.min(totalPages, prev + 1))}
                                  disabled={questionsPage === totalPages}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {/* Select All (current page) */}
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allSelectedOnPage}
                                ref={(input) => {
                                  if (input) input.indeterminate = someSelectedOnPage
                                }}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="text-xs">Select Page</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Table Grid */}
                      <div className="flex-1 overflow-auto p-6">
                        {libraryQuestions.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <FileQuestion className="w-16 h-12 mx-auto mb-4 text-gray-600" />
                            <p className="text-sm font-medium">No questions found in library</p>
                            <p className="text-xs mt-2">Questions must include this assessment type: {assessmentData.assessment_type}</p>
                            <p className="text-xs mt-1">Create questions in the library first, or add custom questions individually.</p>
                          </div>
                        ) : filteredQuestions.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <Filter className="w-16 h-12 mx-auto mb-4 text-gray-600" />
                            <p className="text-sm font-medium">No questions match your filters</p>
                            <p className="text-xs mt-2">Try adjusting your search or filter criteria.</p>
                          </div>
                        ) : (
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight w-12">
                                      <input
                                        type="checkbox"
                                        checked={allSelectedOnPage}
                                        ref={(input) => {
                                          if (input) input.indeterminate = someSelectedOnPage
                                        }}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                      />
                                    </th>
                                    {questionColumnVisibility.id && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Question ID
                                      </th>
                                    )}
                                    {questionColumnVisibility.title && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Title
                                      </th>
                                    )}
                                    {questionColumnVisibility.description && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Description
                                      </th>
                                    )}
                                    {questionColumnVisibility.category && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Category
                                      </th>
                                    )}
                                    {questionColumnVisibility.responseType && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Response Type
                                      </th>
                                    )}
                                    {questionColumnVisibility.fieldType && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Field Type
                                      </th>
                                    )}
                                    {questionColumnVisibility.required && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Required
                                      </th>
                                    )}
                                    {questionColumnVisibility.frameworks && (
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">
                                        Frameworks
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {paginatedQuestions.map(q => (
                                    <tr
                                      key={q.id}
                                      className={`hover:bg-gray-50 cursor-pointer ${
                                        selectedBulkQuestions.has(q.id) ? 'bg-indigo-50' : ''
                                      }`}
                                      onClick={() => {
                                        setSelectedBulkQuestions(prev => {
                                          const next = new Set(prev)
                                          if (next.has(q.id)) {
                                            next.delete(q.id)
                                          } else {
                                            next.add(q.id)
                                          }
                                          return next
                                        })
                                      }}
                                    >
                                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={selectedBulkQuestions.has(q.id)}
                                          onChange={() => {
                                            setSelectedBulkQuestions(prev => {
                                              const next = new Set(prev)
                                              if (next.has(q.id)) {
                                                next.delete(q.id)
                                              } else {
                                                next.add(q.id)
                                              }
                                              return next
                                            })
                                          }}
                                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                      </td>
                                      {questionColumnVisibility.id && (
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                                          {q.question_id || (
                                            <span className="text-gray-600 italic">Pending</span>
                                          )}
                                        </td>
                                      )}
                                      {questionColumnVisibility.title && (
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                          {q.title || q.question_text || 'Untitled'}
                                        </td>
                                      )}
                                      {questionColumnVisibility.description && (
                                        <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                                          <div className="truncate" title={q.description || ''}>
                                            {q.description || '-'}
                                          </div>
                                        </td>
                                      )}
                                      {questionColumnVisibility.category && (
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          {q.category ? (
                                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                              {q.category}
                                            </span>
                                          ) : (
                                            <span className="text-sm text-gray-600">-</span>
                                          )}
                                        </td>
                                      )}
                                      {questionColumnVisibility.responseType && (
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                            {q.response_type || 'Text'}
                                          </span>
                                        </td>
                                      )}
                                      {questionColumnVisibility.fieldType && (
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                          {q.field_type || '-'}
                                        </td>
                                      )}
                                      {questionColumnVisibility.required && (
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          {q.is_required ? (
                                            <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-medium">
                                              Required
                                            </span>
                                          ) : (
                                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                              Optional
                                            </span>
                                          )}
                                        </td>
                                      )}
                                      {questionColumnVisibility.frameworks && (
                                        <td className="px-4 py-3">
                                          <div className="flex flex-wrap gap-1">
                                            {q.compliance_framework_ids && q.compliance_framework_ids.length > 0 && (
                                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded" title="Compliance Frameworks">
                                                C: {q.compliance_framework_ids.length}
                                              </span>
                                            )}
                                            {q.risk_framework_ids && q.risk_framework_ids.length > 0 && (
                                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded" title="Risk Frameworks">
                                                R: {q.risk_framework_ids.length}
                                              </span>
                                            )}
                                            {(!q.compliance_framework_ids || q.compliance_framework_ids.length === 0) && 
                                             (!q.risk_framework_ids || q.risk_framework_ids.length === 0) && (
                                              <span className="text-xs text-gray-400 italic">-</span>
                                            )}
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* Pagination Footer */}
                            {totalPages > 1 && (
                              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                                <div className="text-xs text-gray-600">
                                  Showing {startIndex + 1}-{Math.min(endIndex, filteredQuestions.length)} of {filteredQuestions.length} questions
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setQuestionsPage(1)}
                                    disabled={questionsPage === 1}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="First page"
                                  >
                                    «
                                  </button>
                                  <button
                                    onClick={() => setQuestionsPage(prev => Math.max(1, prev - 1))}
                                    disabled={questionsPage === 1}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Previous page"
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>
                                  <span className="px-3 py-1 text-xs text-gray-700">
                                    Page {questionsPage} of {totalPages}
                                  </span>
                                  <button
                                    onClick={() => setQuestionsPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={questionsPage === totalPages}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Next page"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setQuestionsPage(totalPages)}
                                    disabled={questionsPage === totalPages}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Last page"
                                  >
                                    »
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                        </>
                      ) : (
                        /* Create New Question Tab */
                        <div className="flex-1 overflow-auto p-6">
                          <div className="max-w-2xl mx-auto space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Question Title
                              </label>
                              <input
                                type="text"
                                value={questionFormData.title || ''}
                                onChange={(e) => setQuestionFormData({ ...questionFormData, title: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Enter question title (optional)"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Question Text <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                value={questionFormData.question_text}
                                onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={3}
                                placeholder="Enter question text"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                              <textarea
                                value={questionFormData.description || ''}
                                onChange={(e) => setQuestionFormData({ ...questionFormData, description: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                rows={2}
                                placeholder="Enter question description (optional)"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Field Type</label>
                                <select
                                  value={questionFormData.field_type}
                                  onChange={(e) => setQuestionFormData({ ...questionFormData, field_type: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="text">Text</option>
                                  <option value="textarea">Textarea</option>
                                  <option value="number">Number</option>
                                  <option value="email">Email</option>
                                  <option value="url">URL</option>
                                  <option value="date">Date</option>
                                  <option value="select">Select</option>
                                  <option value="multi_select">Multi-Select</option>
                                  <option value="checkbox">Checkbox</option>
                                  <option value="radio">Radio</option>
                                  <option value="file">File Upload</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Response Type</label>
                                <select
                                  value={questionFormData.response_type || ''}
                                  onChange={(e) => setQuestionFormData({ ...questionFormData, response_type: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="">Select response type</option>
                                  <option value="Text">Text</option>
                                  <option value="File">File</option>
                                  <option value="Number">Number</option>
                                  <option value="Date">Date</option>
                                  <option value="Boolean">Boolean</option>
                                  <option value="MultiSelect">Multi-Select</option>
                                  <option value="URL">URL</option>
                                  <option value="Email">Email</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                                <input
                                  type="text"
                                  value={questionFormData.category || ''}
                                  onChange={(e) => setQuestionFormData({ ...questionFormData, category: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  placeholder="Enter category (optional)"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Section</label>
                                <input
                                  type="text"
                                  value={questionFormData.section || ''}
                                  onChange={(e) => setQuestionFormData({ ...questionFormData, section: e.target.value })}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  placeholder="Optional section name"
                                />
                              </div>
                            </div>
                            {(questionFormData.field_type === 'select' || questionFormData.field_type === 'multi_select' || questionFormData.field_type === 'radio' || questionFormData.field_type === 'checkbox') && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Options</label>
                                <div className="space-y-2">
                                  {questionFormData.options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={opt.value}
                                        onChange={(e) => {
                                          const newOptions = [...questionFormData.options]
                                          newOptions[idx].value = e.target.value
                                          setQuestionFormData({ ...questionFormData, options: newOptions })
                                        }}
                                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Value"
                                      />
                                      <input
                                        type="text"
                                        value={opt.label}
                                        onChange={(e) => {
                                          const newOptions = [...questionFormData.options]
                                          newOptions[idx].label = e.target.value
                                          setQuestionFormData({ ...questionFormData, options: newOptions })
                                        }}
                                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Label"
                                      />
                                      <button
                                        onClick={() => {
                                          const newOptions = questionFormData.options.filter((_, i) => i !== idx)
                                          setQuestionFormData({ ...questionFormData, options: newOptions })
                                        }}
                                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => setQuestionFormData({ ...questionFormData, options: [...questionFormData.options, { value: '', label: '' }] })}
                                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                  >
                                    + Add Option
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="is_required_modal"
                                checked={questionFormData.is_required}
                                onChange={(e) => setQuestionFormData({ ...questionFormData, is_required: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <label htmlFor="is_required_modal" className="text-sm font-medium text-gray-700">
                                Required
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between p-6 border-t bg-gray-50">
                        {bulkAddQuestionsTab === 'library' ? (
                          <>
                            <div className="text-sm text-gray-600">
                              {selectedBulkQuestions.size > 0 && (
                                <span className="font-medium text-indigo-600">
                                  {selectedBulkQuestions.size} question{selectedBulkQuestions.size !== 1 ? 's' : ''} selected
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  setShowBulkAddQuestions(false)
                                  setSelectedBulkQuestions(new Set())
                                  setQuestionSearchQuery('')
                                  setQuestionCategoryFilter('')
                                  setQuestionResponseTypeFilter('')
                                  setQuestionRequiredFilter('all')
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  // Add selected questions from library
                                  const newQuestions = Array.from(selectedBulkQuestions)
                                    .map(qId => {
                                      const libQ = libraryQuestions.find(q => q.id === qId)
                                      if (!libQ) return null
                                      return {
                                        question_type: 'new_question' as QuestionType,
                                        title: libQ.title,
                                        question_text: libQ.question_text,
                                        description: libQ.description,
                                        field_type: libQ.field_type,
                                        response_type: libQ.response_type || 'Text', // Ensure response_type is always set
                                        category: libQ.category,
                                        is_required: libQ.is_required,
                                        options: libQ.options,
                                        reusable_question_id: libQ.id, // Link to library question
                                        order: questions.length + 1,
                                      }
                                    })
                                    .filter(q => q !== null) as Array<Partial<AssessmentQuestion>>
                                  
                                  setQuestions([...questions, ...newQuestions])
                                  setShowBulkAddQuestions(false)
                                  setSelectedBulkQuestions(new Set())
                                  setQuestionSearchQuery('')
                                  setQuestionCategoryFilter('')
                                  setQuestionResponseTypeFilter('')
                                  setQuestionRequiredFilter('all')
                                }}
                                disabled={selectedBulkQuestions.size === 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add Questions ({selectedBulkQuestions.size})
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm text-gray-600">
                              Create a new question and add it to the library
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  setShowBulkAddQuestions(false)
                                  setBulkAddQuestionsTab('library')
                                  setQuestionFormData({
                                    question_type: 'new_question',
                                    title: '',
                                    question_text: '',
                                    description: '',
                                    field_type: 'text',
                                    response_type: '',
                                    category: '',
                                    is_required: false,
                                    options: [],
                                    requirement_id: '',
                                    section: '',
                                  })
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  if (!questionFormData.question_text.trim()) {
                                    return
                                  }
                                  
                                  try {
                                    // Create question in library
                                    const newLibQuestion = await questionLibraryApi.create({
                                      title: questionFormData.title || questionFormData.question_text || 'Untitled Question',
                                      question_text: questionFormData.question_text || '',
                                      description: questionFormData.description,
                                      assessment_type: [assessmentData.assessment_type],
                                      category: questionFormData.category,
                                      field_type: questionFormData.field_type,
                                      response_type: questionFormData.response_type || 'Text',
                                      is_required: questionFormData.is_required,
                                      options: questionFormData.options,
                                    })
                                    
                                    // Refresh library questions
                                    queryClient.invalidateQueries({ queryKey: ['question-library'] })
                                    
                                    // Add to assessment
                                    const newQuestion: Partial<AssessmentQuestion> = {
                                      question_type: 'new_question' as QuestionType,
                                      title: questionFormData.title || undefined,
                                      question_text: questionFormData.question_text || undefined,
                                      description: questionFormData.description || undefined,
                                      field_type: questionFormData.field_type,
                                      response_type: questionFormData.response_type || undefined,
                                      category: questionFormData.category || undefined,
                                      is_required: questionFormData.is_required,
                                      options: questionFormData.options,
                                      section: questionFormData.section || undefined,
                                      order: questions.length + 1,
                                    }
                                    setQuestions([...questions, newQuestion])
                                    
                                    // Reset form and close modal
                                    setQuestionFormData({
                                      question_type: 'new_question',
                                      title: '',
                                      question_text: '',
                                      description: '',
                                      field_type: 'text',
                                      response_type: '',
                                      category: '',
                                      is_required: false,
                                      options: [],
                                      requirement_id: '',
                                      section: '',
                                    })
                                    setShowBulkAddQuestions(false)
                                    setBulkAddQuestionsTab('library')
                                  } catch (error) {
                                    console.error('Failed to create question:', error)
                                    // Show error toast if available
                                  }
                                }}
                                disabled={!questionFormData.question_text.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Create & Add Question
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Bulk Add Requirements Modal */}
              {showBulkAddRequirements && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b">
                      <h3 className="unified-section-title">Add Requirements Group</h3>
                      <button
                        onClick={() => {
                          setShowBulkAddRequirements(false)
                          setSelectedBulkRequirements(new Set())
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="mb-4">
                        <input
                          type="text"
                          value={requirementSearchQuery}
                          onChange={(e) => setRequirementSearchQuery(e.target.value)}
                          placeholder="Search requirements..."
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredRequirements.map(req => (
                          <div
                            key={req.id}
                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 cursor-pointer"
                            onClick={() => {
                              setSelectedBulkRequirements(prev => {
                                const next = new Set(prev)
                                if (next.has(req.id)) {
                                  next.delete(req.id)
                                } else {
                                  next.add(req.id)
                                }
                                return next
                              })
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedBulkRequirements.has(req.id)}
                              onChange={() => {}}
                              className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {req.catalog_id && `${req.catalog_id}: `}
                                {req.label}
                              </div>
                              {req.description && (
                                <div className="text-sm text-gray-600 mt-1">{req.description}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 p-6 border-t">
                      <button
                        onClick={() => {
                          setShowBulkAddRequirements(false)
                          setSelectedBulkRequirements(new Set())
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          // Add selected requirements as questions
                          const newQuestions = Array.from(selectedBulkRequirements).map((reqId, idx) => ({
                            question_type: 'requirement_reference' as QuestionType,
                            requirement_id: reqId,
                            order: questions.length + idx + 1,
                          }))
                          setQuestions([...questions, ...newQuestions])
                          setShowBulkAddRequirements(false)
                          setSelectedBulkRequirements(new Set())
                          setRequirementSearchQuery('')
                        }}
                        disabled={selectedBulkRequirements.size === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add {selectedBulkRequirements.size > 0 ? `${selectedBulkRequirements.size} ` : ''}Requirements
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="unified-section-title mb-2">Review Assessment</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review all details before saving your assessment.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Assessment Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium text-gray-900">{assessmentData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium text-gray-900">{assessmentData.assessment_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-gray-900">{assessmentData.status}</span>
                    </div>
                    {assessmentData.description && (
                      <div>
                        <span className="text-gray-600">Description:</span>
                        <p className="text-gray-900 mt-1">{assessmentData.description}</p>
                      </div>
                    )}
                    {assessmentData.business_purpose && (
                      <div>
                        <span className="text-gray-600">Business Purpose:</span>
                        <p className="text-gray-900 mt-1">{assessmentData.business_purpose}</p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Owner:</span>
                      <span className="font-medium text-gray-900">
                        {users.find(u => u.id === assessmentData.owner_id)?.name || 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Questions ({questions.length})
                  </h4>
                  {questions.length === 0 ? (
                    <p className="text-sm text-gray-500">No questions added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {questions.map((question, index) => (
                        <div key={index} className="text-sm border-b border-gray-200 pb-2 last:border-0">
                          <div className="font-medium text-gray-900">
                            {index + 1}. {question.title || (question.question_type === 'requirement_reference' 
                              ? (requirements.find(r => r.id === question.requirement_id)?.label || 'Requirement Reference')
                              : question.question_text || 'Untitled Question')}
                          </div>
                          {question.description && (
                            <div className="text-gray-600 mt-1">{question.description}</div>
                          )}
                          {question.question_text && question.title && question.question_type !== 'requirement_reference' && (
                            <div className="text-gray-700 mt-1">{question.question_text}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                              Type: {question.question_type === 'requirement_reference' ? 'Reference' : 'Question'}
                            </span>
                            {question.response_type && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                                Response: {question.response_type}
                              </span>
                            )}
                            {question.field_type && question.question_type !== 'requirement_reference' && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded">
                                Field: {question.field_type}
                              </span>
                            )}
                            {question.category && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                Category: {question.category}
                              </span>
                            )}
                            {question.is_required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">Required</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <button
              onClick={() => {
                if (currentStepIndex > 0) {
                  setCurrentStep(steps[currentStepIndex - 1].key)
                } else {
                  onClose()
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              {currentStepIndex === 0 ? 'Cancel' : 'Previous'}
            </button>

          <div className="text-xs text-gray-500">
            Step {currentStepIndex + 1} of {steps.length}
          </div>

          {isViewMode ? (
              <div className="flex items-center gap-2">
                {currentStepIndex < steps.length - 1 ? (
                  <button
                    onClick={() => {
                      if (currentStepIndex < steps.length - 1) {
                        setCurrentStep(steps[currentStepIndex + 1].key)
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    Close
                  </button>
                )}
              </div>
            ) : currentStep === 'review' ? (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? 'Saving...' : initialAssessment ? 'Update Assessment' : 'Create Assessment'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {(currentStep === 'details' || currentStep === 'questions') && (
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !assessmentData.name.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (currentStepIndex < steps.length - 1) {
                      setCurrentStep(steps[currentStepIndex + 1].key)
                    }
                  }}
                  disabled={!canProceed()}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
        </div>
    </div>
  )

  if (inline) {
    return wizardContent
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {wizardContent}
    </div>
  )
}
