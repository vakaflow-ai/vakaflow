import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { assessmentsApi, assessmentTemplatesApi, Assessment, AssessmentType, AssessmentStatus, AssessmentQuestion, QuestionType, AssessmentSchedule, ScheduleFrequency, AssessmentTemplate } from '../lib/assessments'
import { usersApi, User } from '../lib/users'
import { submissionRequirementsApi, SubmissionRequirement } from '../lib/submissionRequirements'
import { vendorsApi } from '../lib/vendors'
import Layout from '../components/Layout'
import AssessmentWizard from '../components/AssessmentWizard'
import DeleteConfirmation from '../components/DeleteConfirmation'
import { showToast } from '../utils/toast'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'
import { 
  BookOpen, Building2, AlertTriangle, FolderOpen, FileText, 
  Shield, CheckCircle2, Filter, FileQuestion, 
  Edit, Trash2, ToggleLeft, ToggleRight, Download, Upload, Settings, Eye, EyeOff,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, GripVertical, X,
  Calendar, Users, Clock, Plus, Save, MoveUp, MoveDown, Link as LinkIcon, Copy
} from 'lucide-react'

// Assessment types are now fetched from master data lists
// Fallback constant for backward compatibility
const ASSESSMENT_TYPES_FALLBACK: Array<{ value: AssessmentType; label: string }> = [
  { value: 'tprm', label: 'TPRM' },
  { value: 'vendor_qualification', label: 'Vendor Qualification' },
  { value: 'risk_assessment', label: 'Risk Assessment' },
  { value: 'ai_vendor_qualification', label: 'AI-Vendor Qualification' },
  { value: 'security_assessment', label: 'Security Assessment' },
  { value: 'compliance_assessment', label: 'Compliance Assessment' },
  { value: 'custom', label: 'Custom' },
]

interface User {
  id: string
  role: string
  tenant_id?: string
}

export default function AssessmentsManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null)
  const [filterAssessmentType, setFilterAssessmentType] = useState<AssessmentType | ''>('')

  // Fetch assessment types from master data
  const { data: assessmentTypesData = [] } = useQuery({
    queryKey: ['master-data', 'assessment_type'],
    queryFn: () => masterDataListsApi.getValuesByType('assessment_type'),
    enabled: !!user?.tenant_id,
  })

  // Use master data if available, fallback to hardcoded values
  const ASSESSMENT_TYPES = assessmentTypesData.length > 0
    ? assessmentTypesData.map((v: MasterDataValue) => ({ value: v.value as AssessmentType, label: v.label }))
    : ASSESSMENT_TYPES_FALLBACK
  const [filterStatus, setFilterStatus] = useState<AssessmentStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [groupBy, setGroupBy] = useState<'assessment_type' | 'status' | 'none'>('none')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedAssessments, setSelectedAssessments] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState<boolean>(false)
  const [showQuestionsModal, setShowQuestionsModal] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<AssessmentTemplate | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardInitialStep, setWizardInitialStep] = useState<'template' | 'details' | 'questions' | 'review' | undefined>(undefined)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: string; count?: number } | null>(null)
  const [assessmentFormData, setAssessmentFormData] = useState({
    name: '',
    assessment_type: 'tprm' as AssessmentType,
    description: '',
    status: 'draft' as AssessmentStatus,
    owner_id: '',
    schedule_enabled: false,
    schedule_frequency: 'quarterly' as 'quarterly' | 'yearly' | 'monthly' | 'bi_annual' | 'one_time' | 'custom',
    schedule_interval_months: 3,
    assignment_rules: {} as Record<string, any>,
  })
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [questionFormData, setQuestionFormData] = useState({
    question_type: 'new_question' as QuestionType,
    question_text: '',
    field_type: 'text',
    is_required: false,
    options: [] as Array<{ value: string; label: string }>,
    requirement_id: '',
    section: '',
  })
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showAssignmentRulesModal, setShowAssignmentRulesModal] = useState(false)
  const [scheduleFormData, setScheduleFormData] = useState({
    scheduled_date: '',
    due_date: '',
    frequency: 'quarterly' as ScheduleFrequency,
    selected_vendor_ids: [] as string[],
  })
  const [assignmentRulesData, setAssignmentRulesData] = useState({
    apply_to: [] as string[],
    vendor_attributes: {} as Record<string, any>,
    agent_attributes: {} as Record<string, any>,
    master_data_tags: {} as Record<string, any>,
  })

  // Fetch user
  useEffect(() => {
    authApi.getCurrentUser()
      .then(setUser)
      .catch(() => navigate('/login'))
  }, [navigate])

  // Fetch assessments
  const { data: assessments = [], isLoading, error } = useQuery({
    queryKey: ['assessments', filterAssessmentType, filterStatus],
    queryFn: () => assessmentsApi.list(
      filterAssessmentType || undefined,
      filterStatus || undefined,
      true
    ),
    enabled: !!user,
    onError: (err: any) => {
      console.error('Error loading assessments:', err)
      console.error('Error details:', err.response?.data || err.message)
    },
  })

  // Check for assessment to open from sessionStorage (e.g., from assignment page)
  // This must be after the assessments query is declared
  useEffect(() => {
    if (isLoading || !assessments || assessments.length === 0) {
      return // Wait for assessments to load
    }
    
    const openAssessmentId = sessionStorage.getItem('openAssessmentId')
    const openAssessmentStep = sessionStorage.getItem('openAssessmentStep') as 'template' | 'details' | 'questions' | 'review' | undefined
    
    if (openAssessmentId) {
      const assessment = assessments.find(a => a.id === openAssessmentId)
      if (assessment) {
        setSelectedAssessment(assessment)
        setViewMode(false)
        setWizardInitialStep(openAssessmentStep || 'questions')
        setShowWizard(true)
        // Clear sessionStorage after opening
        sessionStorage.removeItem('openAssessmentId')
        sessionStorage.removeItem('openAssessmentStep')
      }
    }
  }, [assessments, isLoading])

  // Fetch users for owner dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['users', user?.tenant_id],
    queryFn: () => usersApi.list(user?.tenant_id),
    enabled: !!user?.tenant_id,
  })

  // Fetch requirements for question references
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements-for-questions'],
    queryFn: () => submissionRequirementsApi.list(),
    enabled: showQuestionForm && questionFormData.question_type === 'requirement_reference',
  })

  // Fetch vendors for scheduling
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-for-scheduling'],
    queryFn: () => vendorsApi.list(false),
    enabled: showScheduleModal && !!user?.tenant_id,
  })

  // Fetch schedules for assessment
  const { data: schedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ['assessment-schedules', selectedAssessment?.id],
    queryFn: () => selectedAssessment ? assessmentsApi.listSchedules(selectedAssessment.id) : Promise.resolve([]),
    enabled: !!selectedAssessment && showScheduleModal,
  })

  // Fetch questions when editing assessment
  const { data: assessmentQuestions = [], refetch: refetchQuestions } = useQuery({
    queryKey: ['assessment-questions', selectedAssessment?.id],
    queryFn: () => selectedAssessment ? assessmentsApi.listQuestions(selectedAssessment.id) : Promise.resolve([]),
    enabled: !!selectedAssessment && (showEditModal || showQuestionsModal),
  })

  // Fetch applicable templates
  const { data: templates = [] } = useQuery({
    queryKey: ['assessment-templates', user?.tenant_id],
    queryFn: () => assessmentTemplatesApi.list(),
    enabled: !!user?.tenant_id,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Assessment>) => assessmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] })
      setShowCreateModal(false)
      setAssessmentFormData({
        name: '',
        assessment_type: 'tprm',
        description: '',
        status: 'draft',
        owner_id: user?.id || '',
        schedule_enabled: false,
        schedule_frequency: 'quarterly',
        schedule_interval_months: 3,
        assignment_rules: {},
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Assessment> }) => assessmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] })
      setShowEditModal(false)
      setSelectedAssessment(null)
    },
  })

  const addQuestionMutation = useMutation({
    mutationFn: ({ assessmentId, question }: { assessmentId: string; question: Partial<AssessmentQuestion> }) =>
      assessmentsApi.addQuestion(assessmentId, question),
    onSuccess: () => {
      refetchQuestions()
      setShowQuestionForm(false)
      setEditingQuestion(null)
      setQuestionFormData({
        question_type: 'new_question',
        question_text: '',
        field_type: 'text',
        is_required: false,
        options: [],
        requirement_id: '',
        section: '',
      })
    },
  })

  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, question }: { questionId: string; question: Partial<AssessmentQuestion> }) =>
      assessmentsApi.updateQuestion(questionId, question),
    onSuccess: () => {
      refetchQuestions()
      setShowQuestionForm(false)
      setEditingQuestion(null)
      setQuestionFormData({
        question_type: 'new_question',
        question_text: '',
        field_type: 'text',
        is_required: false,
        options: [],
        requirement_id: '',
        section: '',
      })
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => assessmentsApi.deleteQuestion(questionId),
    onSuccess: () => {
      refetchQuestions()
    },
  })

  const reorderQuestionsMutation = useMutation({
    mutationFn: ({ assessmentId, orders }: { assessmentId: string; orders: Array<{ question_id: string; order: number }> }) =>
      assessmentsApi.reorderQuestions(assessmentId, orders),
    onSuccess: () => {
      refetchQuestions()
    },
  })

  // Filter and search assessments
  const filteredAssessments = assessments.filter((assessment) => {
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !assessment.name.toLowerCase().includes(query) &&
        !(assessment.description && assessment.description.toLowerCase().includes(query)) &&
        !assessment.assessment_type.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    // Assessment type filter
    if (filterAssessmentType && assessment.assessment_type !== filterAssessmentType) {
      return false
    }

    // Status filter
    if (filterStatus && assessment.status !== filterStatus) {
      return false
    }

    return true
  })

  // Group assessments
  const groupedAssessments = filteredAssessments.reduce((acc, assessment) => {
    if (groupBy === 'none') {
      if (!acc['all']) acc['all'] = []
      acc['all'].push(assessment)
    } else if (groupBy === 'assessment_type') {
      const key = assessment.assessment_type
      if (!acc[key]) acc[key] = []
      acc[key].push(assessment)
    } else if (groupBy === 'status') {
      const key = assessment.status
      if (!acc[key]) acc[key] = []
      acc[key].push(assessment)
    }
    return acc
  }, {} as Record<string, Assessment[]>)

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => assessmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] })
      setSelectedAssessments(new Set())
    },
  })

  const handleCreateClick = () => {
    setSelectedAssessment(null)
    setViewMode(false)
    setWizardInitialStep(undefined)  // Use default step for create
    setShowWizard(true)
  }

  const handleCreateFromTemplate = async (template: AssessmentTemplate) => {
    try {
      const assessment = await assessmentTemplatesApi.instantiate(template.id)
      queryClient.invalidateQueries({ queryKey: ['assessments'] })
      setShowTemplatesModal(false)
      setSelectedTemplate(null)
      // Optionally open edit modal to customize
      handleEditClick(assessment)
    } catch (error) {
      console.error('Error instantiating template:', error)
      alert('Failed to create assessment from template. Please try again.')
    }
  }

  const handleCreateCustom = () => {
    setSelectedAssessment(null)
    setAssessmentFormData({
      name: '',
      assessment_type: 'tprm',
      description: '',
      status: 'draft',
      owner_id: user?.id || '',
      schedule_enabled: false,
      schedule_frequency: 'quarterly',
      schedule_interval_months: 3,
      assignment_rules: {},
    })
    setShowTemplatesModal(false)
    setShowCreateModal(true)
  }

  const handleEditClick = (assessment: Assessment) => {
    setSelectedAssessment(assessment)
    setViewMode(false)
    setWizardInitialStep(undefined)  // Use default step for edit
    setShowWizard(true)
  }

  const handleCopyAssessment = async (assessment: Assessment) => {
    try {
      showToast.info('Copying assessment...')
      
      // Fetch full assessment with questions
      const fullAssessment = await assessmentsApi.get(assessment.id)
      const questions = await assessmentsApi.listQuestions(assessment.id)

      // Create copy with "Copy of" prefix
      const copiedAssessment = {
        name: `Copy of ${fullAssessment.name}`,
        assessment_type: fullAssessment.assessment_type,
        description: fullAssessment.description || '',
        business_purpose: fullAssessment.business_purpose || '',
        status: 'draft' as AssessmentStatus,
        owner_id: fullAssessment.owner_id,
        is_active: false, // New copy should be inactive by default
        schedule_enabled: fullAssessment.schedule_enabled || false,
        schedule_frequency: fullAssessment.schedule_frequency || 'quarterly',
        schedule_interval_months: fullAssessment.schedule_interval_months || 3,
        assignment_rules: fullAssessment.assignment_rules || {},
      }

      // Create the new assessment
      const newAssessment = await createMutation.mutateAsync(copiedAssessment)

      // Copy all questions
      if (questions && questions.length > 0) {
        for (const question of questions) {
          await assessmentsApi.addQuestion(newAssessment.id, {
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
            order: question.order,
          })
        }
      }

      showToast.success(`Assessment "${copiedAssessment.name}" created successfully!`)

      // Open the wizard in edit mode for the new assessment, starting at 'details' step so user can set new name
      const updatedAssessment = await assessmentsApi.get(newAssessment.id)
      setSelectedAssessment(updatedAssessment)
      setViewMode(false)
      setWizardInitialStep('details')  // Start at details step to allow name change
      setShowWizard(true)
    } catch (error: any) {
      console.error('Error copying assessment:', error)
      showToast.error(`Failed to copy assessment: ${error?.response?.data?.detail || error.message}`)
    }
  }

  const handleSaveAssessment = async () => {
    if (!assessmentFormData.name.trim()) {
      alert('Please enter an assessment name')
      return
    }
    if (!assessmentFormData.owner_id) {
      alert('Please select an owner')
      return
    }

    try {
      if (selectedAssessment) {
        await updateMutation.mutateAsync({
          id: selectedAssessment.id,
          data: assessmentFormData,
        })
      } else {
        await createMutation.mutateAsync(assessmentFormData)
      }
    } catch (error) {
      console.error('Error saving assessment:', error)
      alert('Failed to save assessment. Please try again.')
    }
  }

  const handleManageQuestions = (assessment: Assessment) => {
    setSelectedAssessment(assessment)
    setShowQuestionsModal(true)
  }

  const handleAddQuestion = () => {
    setEditingQuestion(null)
    setQuestionFormData({
      question_type: 'new_question',
      question_text: '',
      field_type: 'text',
      is_required: false,
      options: [],
      requirement_id: '',
      section: '',
    })
    setShowQuestionForm(true)
  }

  const handleEditQuestion = (question: AssessmentQuestion) => {
    setEditingQuestion(question)
    setQuestionFormData({
      question_type: question.question_type,
      question_text: question.question_text || '',
      field_type: question.field_type || 'text',
      is_required: question.is_required,
      options: question.options || [],
      requirement_id: question.requirement_id || '',
      section: question.section || '',
    })
    setShowQuestionForm(true)
  }

  const handleSaveQuestion = async () => {
    if (!selectedAssessment) return

    if (questionFormData.question_type === 'new_question' && !questionFormData.question_text.trim()) {
      alert('Please enter question text')
      return
    }
    if (questionFormData.question_type === 'requirement_reference' && !questionFormData.requirement_id) {
      alert('Please select a requirement')
      return
    }

    try {
      if (editingQuestion) {
        await updateQuestionMutation.mutateAsync({
          questionId: editingQuestion.id,
          question: questionFormData,
        })
      } else {
        await addQuestionMutation.mutateAsync({
          assessmentId: selectedAssessment.id,
          question: questionFormData,
        })
      }
    } catch (error) {
      console.error('Error saving question:', error)
      alert('Failed to save question. Please try again.')
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return
    try {
      await deleteQuestionMutation.mutateAsync(questionId)
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question. Please try again.')
    }
  }

  const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    if (!selectedAssessment) return
    const currentQuestions = assessmentQuestions || []
    const currentIndex = currentQuestions.findIndex(q => q.id === questionId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= currentQuestions.length) return

    const newOrders = currentQuestions.map((q, idx) => ({
      question_id: q.id,
      order: idx === currentIndex ? newIndex : idx === newIndex ? currentIndex : idx,
    }))

    try {
      await reorderQuestionsMutation.mutateAsync({
        assessmentId: selectedAssessment.id,
        orders: newOrders,
      })
    } catch (error) {
      console.error('Error reordering questions:', error)
      alert('Failed to reorder questions. Please try again.')
    }
  }

  const handleViewClick = (assessment: Assessment) => {
    setSelectedAssessment(assessment)
    setViewMode(true)
    setWizardInitialStep(undefined)  // Use default step for view
    setShowWizard(true)
  }

  const handleSelectAssessment = (id: string, checked: boolean) => {
    setSelectedAssessments(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssessments(new Set(filteredAssessments.map(a => a.id)))
      setSelectAll(true)
    } else {
      setSelectedAssessments(new Set())
      setSelectAll(false)
    }
  }

  const handleBulkDelete = () => {
    if (selectedAssessments.size === 0) return
    setDeleteTarget({ type: 'bulk', count: selectedAssessments.size })
    setShowDeleteConfirm(true)
  }

  const handleSingleDelete = (id: string) => {
    const assessment = assessments.find(a => a.id === id)
    setDeleteTarget({ type: 'single', id, count: 1 })
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === 'bulk' && selectedAssessments.size > 0) {
        const deletePromises = Array.from(selectedAssessments).map(id => 
          deleteMutation.mutateAsync(id)
        )
        await Promise.all(deletePromises)
        setSelectedAssessments(new Set())
        setSelectAll(false)
      } else if (deleteTarget.type === 'single' && deleteTarget.id) {
        await deleteMutation.mutateAsync(deleteTarget.id)
      }
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    } catch (error) {
      console.error('Error deleting assessments:', error)
      alert('Some assessments could not be deleted. Please try again.')
    }
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getAssessmentTypeLabel = (type: AssessmentType): string => {
    return ASSESSMENT_TYPES.find(t => t.value === type)?.label || type
  }

  const getAssessmentTypeColor = (type: AssessmentType): string => {
    const colors: Record<AssessmentType, string> = {
      tprm: 'bg-blue-100 text-blue-800 border-blue-400',
      vendor_qualification: 'bg-green-100 text-green-800 border-green-400',
      risk_assessment: 'bg-orange-100 text-orange-800 border-orange-400',
      ai_vendor_qualification: 'bg-purple-100 text-purple-800 border-purple-400',
      security_assessment: 'bg-red-100 text-red-800 border-red-400',
      compliance_assessment: 'bg-indigo-100 text-indigo-800 border-indigo-400',
      custom: 'bg-gray-100 text-gray-800 border-gray-400',
    }
    return colors[type] || colors.custom
  }

  if (!user || !['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer', 'policy_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Assessment management access required.</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6 relative scrollbar-hide">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1">
            <h1>Assessments & Evaluations</h1>
            <p className="text-body text-muted-foreground">
              Manage TPRM, Vendor Qualification, Risk Assessment, and other evaluation assessments
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-body font-medium transition-colors whitespace-nowrap ${
                showFilters
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title="Toggle filters"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-body font-medium shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create Assessment
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-label font-medium text-gray-700">Filter Assessments</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-600 hover:text-gray-600 text-body"
                >
                  Hide Filters
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-label mb-1.5 text-gray-700">Assessment Type</label>
                  <select
                    value={filterAssessmentType}
                    onChange={(e) => setFilterAssessmentType(e.target.value as AssessmentType | '')}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">All Types</option>
                    {ASSESSMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label mb-1.5 text-gray-700">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as AssessmentStatus | '')}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label mb-1.5 text-gray-700">Search</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assessments..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedAssessments.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-body font-medium text-indigo-900">
                {selectedAssessments.size} assessment{selectedAssessments.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedAssessments(new Set())
                  setSelectAll(false)
                }}
                className="px-3 py-1.5 text-caption font-medium text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-300 transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-1.5 text-caption font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin">⏳</span>
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedAssessments.size})
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Assessment Wizard - Inline Guided Step-by-Step Flow (replaces grid) */}
        {showWizard ? (
          <AssessmentWizard
            key={selectedAssessment?.id || 'new'} // Add key to prevent remount issues
            onClose={() => {
              setShowWizard(false)
              setSelectedAssessment(null)
              setViewMode(false)
              setWizardInitialStep(undefined)  // Reset initial step
            }}
            onSuccess={(assessment) => {
              queryClient.invalidateQueries({ queryKey: ['assessments'] })
              setShowWizard(false)
              setSelectedAssessment(null)
              setViewMode(false)
              setWizardInitialStep(undefined)  // Reset initial step
            }}
            userId={user?.id || ''}
            initialAssessment={selectedAssessment}
            mode={selectedAssessment && !showCreateModal ? (viewMode ? 'view' : 'edit') : 'create'}
            inline={true}
            initialStep={wizardInitialStep}
          />
        ) : (
          <>
            {/* Group By Selector */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-caption font-medium text-gray-700 tracking-tight">Group By:</span>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                    className="text-caption px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="assessment_type">Assessment Type</option>
                    <option value="status">Status</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="text-caption text-gray-500 font-medium">
                  {filteredAssessments.length} assessment{filteredAssessments.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Assessments Grid */}
            {isLoading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading assessments...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">Error loading assessments. Please try again.</div>
            <div className="text-xs text-gray-500">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="w-full overflow-hidden hide-scrollbar border border-gray-200 rounded-lg">
              <table className="border-collapse w-full table-fixed">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left w-[4%]">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        title="Select all"
                      />
                    </th>
                    <th className="table-header px-4 py-3 text-left w-[12%]">
                      Assessment ID
                    </th>
                    <th 
                      className="table-header px-4 py-3 text-left cursor-pointer hover:bg-gray-100 w-[20%]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Title
                        {sortColumn === 'name' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="table-header px-4 py-3 text-left w-[12%]">
                      Owner
                    </th>
                    <th 
                      className="table-header px-4 py-3 text-left cursor-pointer hover:bg-gray-100 w-[15%]"
                      onClick={() => handleSort('assessment_type')}
                    >
                      <div className="flex items-center gap-1">
                        Type
                        {sortColumn === 'assessment_type' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="table-header px-4 py-3 text-left w-[10%]">
                      Status
                    </th>
                    <th className="table-header px-4 py-3 text-left w-[12%]">
                      Schedule
                    </th>
                    <th className="table-header px-4 py-3 text-left w-[15%]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const rows: JSX.Element[] = []
                    
                    if (groupBy === 'none') {
                      // No grouping - render all rows directly
                      const sorted = [...filteredAssessments].sort((a, b) => {
                        if (sortColumn === 'name') {
                          return sortDirection === 'asc' 
                            ? a.name.localeCompare(b.name)
                            : b.name.localeCompare(a.name)
                        }
                        if (sortColumn === 'assessment_type') {
                          return sortDirection === 'asc'
                            ? a.assessment_type.localeCompare(b.assessment_type)
                            : b.assessment_type.localeCompare(a.assessment_type)
                        }
                        return 0
                      })
                      
                      sorted.forEach((assessment) => {
                        const isSelected = selectedAssessments.has(assessment.id)
                        rows.push(
                          <tr 
                            key={assessment.id} 
                            className={`hover:bg-gray-50 transition-colors cursor-pointer bg-white ${
                              isSelected ? 'bg-indigo-100/50' : ''
                            }`}
                            onClick={() => handleViewClick(assessment)}
                          >
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleSelectAssessment(assessment.id, e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="table-cell-meta font-mono">
                                {assessment.assessment_id || assessment.id.substring(0, 8)}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="table-cell-primary truncate">{assessment.name}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="table-cell-secondary truncate">
                                {assessment.owner?.name || users.find(u => u.id === assessment.owner_id)?.name || 'Unknown'}
                              </div>
                              {assessment.owner?.email && (
                                <div className="table-cell-meta truncate">{assessment.owner.email}</div>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2.5 py-1 badge-text rounded-md border ${getAssessmentTypeColor(assessment.assessment_type)}`}>
                                {getAssessmentTypeLabel(assessment.assessment_type)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-1 badge-text rounded ${
                                assessment.status === 'active' ? 'bg-green-100 text-green-700' :
                                assessment.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                assessment.status === 'scheduled' ? 'bg-blue-100 text-blue-600' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {assessment.schedule_enabled ? (
                                <div className="flex items-center gap-1 table-cell-meta truncate">
                                  <Calendar className="w-3 h-3" />
                                  <span>{assessment.schedule_frequency || 'Not set'}</span>
                                </div>
                              ) : (
                                <span className="table-cell-meta">Not scheduled</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditClick(assessment)
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 badge-text bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                  title="Edit assessment"
                                >
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyAssessment(assessment)
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 badge-text bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                                  title="Copy assessment"
                                  disabled={createMutation.isPending}
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSingleDelete(assessment.id)
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 badge-text bg-red-600 text-white rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                                  title="Delete assessment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    } else {
                      // Grouped view
                      const groupKeys = Object.keys(groupedAssessments).sort()
                      
                      groupKeys.forEach((groupKey) => {
                        const group = groupedAssessments[groupKey]
                        if (!group || group.length === 0) return
                        
                        const groupId = `${groupBy}-${groupKey}`
                        const isExpanded = expandedGroups.has(groupId)
                        
                        // Get group label
                        let groupLabel = groupKey
                        if (groupBy === 'assessment_type') {
                          groupLabel = getAssessmentTypeLabel(groupKey as AssessmentType)
                        } else if (groupBy === 'status') {
                          groupLabel = groupKey.charAt(0).toUpperCase() + groupKey.slice(1)
                        }
                        
                        // Add group header
                        rows.push(
                          <tr key={`group-${groupId}`} className="bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-400">
                            <td colSpan={8} className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setExpandedGroups(prev => {
                                      const next = new Set(prev)
                                      if (next.has(groupId)) {
                                        next.delete(groupId)
                                      } else {
                                        next.add(groupId)
                                      }
                                      return next
                                    })
                                  }}
                                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-300 transition-colors"
                                  title={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                                <span className={`inline-flex items-center px-3 py-1.5 text-subheading font-bold rounded-md border-2 ${
                                  groupBy === 'assessment_type' ? getAssessmentTypeColor(groupKey as AssessmentType) : 'bg-gray-100 text-gray-800 border-gray-400'
                                }`}>
                                  {groupLabel}
                                </span>
                                <span className="text-caption text-gray-600 font-medium">
                                  ({group.length} {group.length === 1 ? 'assessment' : 'assessments'})
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                        
                        // Add rows for this group (only if expanded)
                        if (isExpanded) {
                          const sorted = [...group].sort((a, b) => {
                            if (sortColumn === 'name') {
                              return sortDirection === 'asc' 
                                ? a.name.localeCompare(b.name)
                                : b.name.localeCompare(a.name)
                            }
                            if (sortColumn === 'assessment_type') {
                              return sortDirection === 'asc'
                                ? a.assessment_type.localeCompare(b.assessment_type)
                                : b.assessment_type.localeCompare(a.assessment_type)
                            }
                            return 0
                          })
                          
                          sorted.forEach((assessment) => {
                            const isSelected = selectedAssessments.has(assessment.id)
                            rows.push(
                              <tr 
                                key={assessment.id} 
                                className={`hover:bg-primary-50/30 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-blue-50' : 'bg-white'
                                }`}
                                onClick={() => handleViewClick(assessment)}
                              >
                                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => handleSelectAssessment(assessment.id, e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '120px' }}>
                                  <div className="table-cell-meta font-mono">
                                    {assessment.assessment_id || assessment.id.substring(0, 8)}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '200px' }}>
                                  <div className="table-cell-primary">{assessment.name}</div>
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '150px' }}>
                                  <div className="table-cell-secondary">
                                    {assessment.owner?.name || users.find(u => u.id === assessment.owner_id)?.name || 'Unknown'}
                                  </div>
                                  {assessment.owner?.email && (
                                    <div className="table-cell-meta">{assessment.owner.email}</div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '180px' }}>
                                  <span className={`inline-flex items-center px-2.5 py-1 badge-text rounded-md border ${getAssessmentTypeColor(assessment.assessment_type)}`}>
                                    {getAssessmentTypeLabel(assessment.assessment_type)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '120px' }}>
                                  <span className={`inline-flex items-center px-2 py-1 badge-text rounded ${
                                    assessment.status === 'active' ? 'bg-green-100 text-green-700' :
                                    assessment.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                    assessment.status === 'scheduled' ? 'bg-blue-100 text-blue-600' :
                                    'bg-orange-100 text-orange-700'
                                  }`}>
                                    {assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '150px' }}>
                                  {assessment.schedule_enabled ? (
                                    <div className="flex items-center gap-1 table-cell-meta">
                                      <Calendar className="w-3 h-3" />
                                      <span>{assessment.schedule_frequency || 'Not set'}</span>
                                    </div>
                                  ) : (
                                    <span className="table-cell-meta">Not scheduled</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5" style={{ width: '180px', minWidth: '180px' }} onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditClick(assessment)
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 badge-text bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                  title="Edit assessment"
                                >
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyAssessment(assessment)
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 badge-text bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                                  title="Copy assessment"
                                  disabled={createMutation.isPending}
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSingleDelete(assessment.id)
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 badge-text bg-red-600 text-white rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                                  title="Delete assessment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        }
                      })
                    }
                    
                    return rows
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}

        {/* Templates Selection Modal */}
        {showTemplatesModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-4xl w-full max-h-[90vh] overflow-y-auto border-none flex flex-col">
              <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-medium text-gray-900">Create Assessment</h2>
                  <p className="text-sm text-gray-500 mt-1">Choose a pre-bundled template or create a custom assessment</p>
                </div>
                <MaterialButton variant="text" size="small" onClick={() => { setShowTemplatesModal(false); setSelectedTemplate(null); }} className="!p-2 text-gray-600">
                  <X className="w-6 h-6" />
                </MaterialButton>
              </div>
              <div className="p-6 space-y-6 bg-background">
                {templates.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 tracking-tight mb-4">Pre-bundled Templates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((template) => (
                        <MaterialCard
                          key={template.id}
                          elevation={0}
                          className="border border-gray-100 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer p-5 bg-surface-variant/5"
                          onClick={() => handleCreateFromTemplate(template)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            <MaterialChip
                              label={getAssessmentTypeLabel(template.assessment_type)}
                              color="primary"
                              size="small"
                              variant="outlined"
                              className="text-xs h-6"
                            />
                          </div>
                          {template.description && (
                            <p className="text-xs text-gray-600 mb-4 leading-relaxed">{template.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <FileQuestion className="w-3.5 h-3.5" />
                              <span>{template.questions?.length || 0} questions</span>
                            </div>
                            {template.applicable_industries && template.applicable_industries.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{template.applicable_industries.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </MaterialCard>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-t pt-6">
                  <MaterialButton
                    onClick={handleCreateCustom}
                    variant="outlined"
                    fullWidth
                    size="large"
                    className="h-10 border-dashed border-2 text-blue-600 hover:bg-primary-50"
                    startIcon={<Plus className="w-5 h-5" />}
                  >
                    Create Custom Assessment
                  </MaterialButton>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <MaterialCard elevation={24} className="max-w-3xl w-full max-h-[90vh] overflow-y-auto border-none flex flex-col">
              <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between">
                <h2 className="unified-page-title">{selectedAssessment ? 'Edit Assessment' : 'Create Assessment'}</h2>
                <MaterialButton variant="text" size="small" onClick={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedAssessment(null); }} className="!p-2 text-gray-600">
                  <X className="w-6 h-6" />
                </MaterialButton>
              </div>
              <div className="p-6 space-y-5 bg-background">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MaterialInput
                    label="Assessment Name *"
                    type="text"
                    required
                    value={assessmentFormData.name}
                    onChange={(e) => setAssessmentFormData({ ...assessmentFormData, name: e.target.value })}
                    placeholder="Enter assessment name"
                  />
                  <MaterialInput
                    label="Assessment Type *"
                    type="select"
                    required
                    value={assessmentFormData.assessment_type}
                    onChange={(e) => setAssessmentFormData({ ...assessmentFormData, assessment_type: e.target.value as AssessmentType })}
                    options={ASSESSMENT_TYPES}
                  />
                </div>
                
                <MaterialInput
                  label="Description"
                  type="textarea"
                  rows={3}
                  value={assessmentFormData.description}
                  onChange={(e) => setAssessmentFormData({ ...assessmentFormData, description: e.target.value })}
                  placeholder="Enter assessment description"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MaterialInput
                    label="Status *"
                    type="select"
                    required
                    value={assessmentFormData.status}
                    onChange={(e) => setAssessmentFormData({ ...assessmentFormData, status: e.target.value as AssessmentStatus })}
                    options={[
                      { value: 'draft', label: 'Draft' },
                      { value: 'active', label: 'Active' },
                      { value: 'scheduled', label: 'Scheduled' },
                      { value: 'archived', label: 'Archived' }
                    ]}
                  />
                  <MaterialInput
                    label="Owner *"
                    type="select"
                    required
                    value={assessmentFormData.owner_id}
                    onChange={(e) => setAssessmentFormData({ ...assessmentFormData, owner_id: e.target.value })}
                    options={[
                      { value: '', label: 'Select owner' },
                      ...(users?.map(u => ({ value: u.id, label: `${u.name} (${u.email})` })) || [])
                    ]}
                  />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="schedule_enabled"
                        checked={assessmentFormData.schedule_enabled}
                        onChange={(e) => setAssessmentFormData({ ...assessmentFormData, schedule_enabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="schedule_enabled" className="text-sm font-medium text-gray-700">
                        Enable Scheduling
                      </label>
                    </div>
                    {selectedAssessment && (
                      <button
                        onClick={() => {
                          setShowScheduleModal(true)
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <Calendar className="w-4 h-4" />
                        Manage Schedules
                      </button>
                    )}
                  </div>
                  {assessmentFormData.schedule_enabled && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
                        <select
                          value={assessmentFormData.schedule_frequency}
                          onChange={(e) => setAssessmentFormData({ ...assessmentFormData, schedule_frequency: e.target.value as typeof assessmentFormData.schedule_frequency })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                          <option value="monthly">Monthly</option>
                          <option value="bi_annual">Bi-Annual</option>
                          <option value="one_time">One Time</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      {assessmentFormData.schedule_frequency === 'custom' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Interval (months)</label>
                          <input
                            type="number"
                            value={assessmentFormData.schedule_interval_months}
                            onChange={(e) => setAssessmentFormData({ ...assessmentFormData, schedule_interval_months: parseInt(e.target.value) || 3 })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            min={1}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700">Assignment Rules</label>
                    <button
                      onClick={() => {
                        if (selectedAssessment?.assignment_rules) {
                          setAssignmentRulesData({
                            apply_to: selectedAssessment.assignment_rules.apply_to || [],
                            vendor_attributes: selectedAssessment.assignment_rules.vendor_attributes || {},
                            agent_attributes: selectedAssessment.assignment_rules.agent_attributes || {},
                            master_data_tags: selectedAssessment.assignment_rules.master_data_tags || {},
                          })
                        }
                        setShowAssignmentRulesModal(true)
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <Settings className="w-4 h-4" />
                      Configure Rules
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                    {selectedAssessment?.assignment_rules ? (
                      <div>
                        <div>Apply to: {selectedAssessment.assignment_rules.apply_to?.join(', ') || 'Not configured'}</div>
                        {Object.keys(selectedAssessment.assignment_rules.vendor_attributes || {}).length > 0 && (
                          <div className="mt-1">Vendor attributes configured</div>
                        )}
                        {Object.keys(selectedAssessment.assignment_rules.agent_attributes || {}).length > 0 && (
                          <div className="mt-1">Agent attributes configured</div>
                        )}
                      </div>
                    ) : (
                      'No assignment rules configured. Click "Configure Rules" to set up automatic assignment.'
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setShowEditModal(false)
                      setSelectedAssessment(null)
                    }}
                    className="compact-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAssessment}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="compact-button-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Assessment'}
                  </button>
                </div>
              </div>
            </MaterialCard>
          </div>
        )}

        {/* Questions Management Modal */}
        {showQuestionsModal && selectedAssessment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="compact-card bg-white max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-medium">Manage Questions: {selectedAssessment.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">Add, edit, or reorder questions for this assessment</p>
                </div>
                <button
                  onClick={() => {
                    setShowQuestionsModal(false)
                    setSelectedAssessment(null)
                    setShowQuestionForm(false)
                    setEditingQuestion(null)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={handleAddQuestion}
                    className="compact-button-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header px-4 py-3 text-left" style={{ width: '50px' }}>Order</th>
                        <th className="table-header px-4 py-3 text-left">Question</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight" style={{ width: '150px' }}>Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight" style={{ width: '100px' }}>Required</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight" style={{ width: '200px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assessmentQuestions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                            No questions added yet. Click "Add Question" to get started.
                          </td>
                        </tr>
                      ) : (
                        assessmentQuestions.map((question, index) => (
                          <tr key={question.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveQuestion(question.id, 'up')}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Move up"
                                >
                                  <MoveUp className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-medium text-gray-600">{index + 1}</span>
                                <button
                                  onClick={() => handleMoveQuestion(question.id, 'down')}
                                  disabled={index === assessmentQuestions.length - 1}
                                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Move down"
                                >
                                  <MoveDown className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-sm">
                                {question.question_type === 'requirement_reference' ? (
                                  <div className="flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4 text-indigo-600" />
                                    <span className="font-medium text-indigo-600">
                                      {requirements.find(r => r.id === question.requirement_id)?.label || 'Requirement Reference'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-900">{question.question_text || 'No text'}</span>
                                )}
                                {question.section && (
                                  <div className="text-xs text-gray-500 mt-1">Section: {question.section}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {question.question_type === 'requirement_reference' ? 'Reference' : question.field_type || 'text'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {question.is_required ? (
                                <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Required</span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Optional</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditQuestion(question)}
                                  className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Question Form Modal */}
        {showQuestionForm && selectedAssessment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="compact-card bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-medium">{editingQuestion ? 'Edit Question' : 'Add Question'}</h2>
                <button
                  onClick={() => {
                    setShowQuestionForm(false)
                    setEditingQuestion(null)
                    setQuestionFormData({
                      question_type: 'new_question',
                      question_text: '',
                      field_type: 'text',
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Question Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={questionFormData.question_type}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_type: e.target.value as QuestionType, requirement_id: '', question_text: '' })}
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
                    <select
                      value={questionFormData.requirement_id}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, requirement_id: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select requirement</option>
                      {requirements.map(req => (
                        <option key={req.id} value={req.id}>
                          {req.catalog_id ? `${req.catalog_id}: ` : ''}{req.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
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
                                className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                <X className="w-4 h-4" />
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
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowQuestionForm(false)
                      setEditingQuestion(null)
                      setQuestionFormData({
                        question_type: 'new_question',
                        question_text: '',
                        field_type: 'text',
                        is_required: false,
                        options: [],
                        requirement_id: '',
                        section: '',
                      })
                    }}
                    className="compact-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveQuestion}
                    disabled={addQuestionMutation.isPending || updateQuestionMutation.isPending}
                    className="compact-button-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {addQuestionMutation.isPending || updateQuestionMutation.isPending ? 'Saving...' : 'Save Question'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Management Modal */}
        {showScheduleModal && selectedAssessment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="compact-card bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-medium">Manage Schedules: {selectedAssessment.name}</h2>
                <button
                  onClick={() => {
                    setShowScheduleModal(false)
                    setScheduleFormData({
                      scheduled_date: '',
                      due_date: '',
                      frequency: 'quarterly',
                      selected_vendor_ids: [],
                    })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const now = new Date()
                      const nextQuarter = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
                      setScheduleFormData({
                        scheduled_date: now.toISOString().split('T')[0],
                        due_date: nextQuarter.toISOString().split('T')[0],
                        frequency: 'quarterly',
                        selected_vendor_ids: [],
                      })
                    }}
                    className="compact-button-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Schedule
                  </button>
                </div>
                {scheduleFormData.scheduled_date && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-sm font-medium mb-3">New Schedule</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Scheduled Date</label>
                        <input
                          type="date"
                          value={scheduleFormData.scheduled_date}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduled_date: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                        <input
                          type="date"
                          value={scheduleFormData.due_date}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, due_date: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
                        <select
                          value={scheduleFormData.frequency}
                          onChange={(e) => setScheduleFormData({ ...scheduleFormData, frequency: e.target.value as ScheduleFrequency })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                          <option value="monthly">Monthly</option>
                          <option value="bi_annual">Bi-Annual</option>
                          <option value="one_time">One Time</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Vendors</label>
                        <select
                          multiple
                          value={scheduleFormData.selected_vendor_ids}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, option => option.value)
                            setScheduleFormData({ ...scheduleFormData, selected_vendor_ids: selected })
                          }}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          size={5}
                        >
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple vendors</p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-4">
                      <button
                        onClick={() => setScheduleFormData({
                          scheduled_date: '',
                          due_date: '',
                          frequency: 'quarterly',
                          selected_vendor_ids: [],
                        })}
                        className="compact-button-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await assessmentsApi.createSchedule(selectedAssessment.id, {
                              scheduled_date: scheduleFormData.scheduled_date,
                              due_date: scheduleFormData.due_date || undefined,
                              frequency: scheduleFormData.frequency,
                              selected_vendor_ids: scheduleFormData.selected_vendor_ids,
                            })
                            refetchSchedules()
                            setScheduleFormData({
                              scheduled_date: '',
                              due_date: '',
                              frequency: 'quarterly',
                              selected_vendor_ids: [],
                            })
                          } catch (error) {
                            console.error('Error creating schedule:', error)
                            alert('Failed to create schedule. Please try again.')
                          }
                        }}
                        className="compact-button-primary"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Save Schedule
                      </button>
                    </div>
                  </div>
                )}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header px-4 py-3 text-left">Scheduled Date</th>
                        <th className="table-header px-4 py-3 text-left">Due Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">Frequency</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">Vendors</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 tracking-tight">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {schedules.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                            No schedules created yet.
                          </td>
                        </tr>
                      ) : (
                        schedules.map((schedule) => (
                          <tr key={schedule.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">{new Date(schedule.scheduled_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm">{schedule.due_date ? new Date(schedule.due_date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 text-sm">{schedule.frequency}</td>
                            <td className="px-4 py-3 text-sm">{schedule.selected_vendor_ids?.length || 0} vendor(s)</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs rounded ${
                                schedule.status === 'completed' ? 'bg-green-100 text-green-700' :
                                schedule.status === 'triggered' ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {schedule.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assignment Rules Modal */}
        {showAssignmentRulesModal && selectedAssessment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="compact-card bg-white max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-medium">Configure Assignment Rules: {selectedAssessment.name}</h2>
                <button
                  onClick={() => {
                    setShowAssignmentRulesModal(false)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Apply To</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={assignmentRulesData.apply_to.includes('vendor_onboarding')}
                        onChange={(e) => {
                          const newApplyTo = e.target.checked
                            ? [...assignmentRulesData.apply_to, 'vendor_onboarding']
                            : assignmentRulesData.apply_to.filter(a => a !== 'vendor_onboarding')
                          setAssignmentRulesData({ ...assignmentRulesData, apply_to: newApplyTo })
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm">Vendor Onboarding</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={assignmentRulesData.apply_to.includes('agent_onboarding')}
                        onChange={(e) => {
                          const newApplyTo = e.target.checked
                            ? [...assignmentRulesData.apply_to, 'agent_onboarding']
                            : assignmentRulesData.apply_to.filter(a => a !== 'agent_onboarding')
                          setAssignmentRulesData({ ...assignmentRulesData, apply_to: newApplyTo })
                        }}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm">Agent Onboarding</span>
                    </label>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Vendor Attributes</h3>
                  <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                    Vendor attribute matching will be configured based on vendor category, type, risk level, etc.
                    This feature will be expanded in future releases.
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Agent Attributes</h3>
                  <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                    Agent attribute matching will be configured based on agent category, type, department, BU, etc.
                    This feature will be expanded in future releases.
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Master Data Tags</h3>
                  <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                    Master data tag matching (department, BU, etc.) will be configured here.
                    This feature will be expanded in future releases.
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => setShowAssignmentRulesModal(false)}
                    className="compact-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await assessmentsApi.update(selectedAssessment.id, {
                          assignment_rules: assignmentRulesData,
                        })
                        queryClient.invalidateQueries({ queryKey: ['assessments'] })
                        setShowAssignmentRulesModal(false)
                      } catch (error) {
                        console.error('Error updating assignment rules:', error)
                        alert('Failed to update assignment rules. Please try again.')
                      }
                    }}
                    className="compact-button-primary"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save Rules
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guided Delete Confirmation */}
                <DeleteConfirmation
                  isOpen={showDeleteConfirm}
                  onClose={() => {
                    setShowDeleteConfirm(false)
                    setDeleteTarget(null)
                  }}
                  onConfirm={confirmDelete}
                  title={deleteTarget?.type === 'bulk' ? 'Delete Multiple Assessments' : 'Delete Assessment'}
                  message={deleteTarget?.type === 'bulk' 
                    ? `Are you sure you want to delete ${deleteTarget.count} assessment${deleteTarget.count !== 1 ? 's' : ''}?`
                    : 'Are you sure you want to delete this assessment?'
                  }
                  itemName={deleteTarget?.type === 'single' && deleteTarget.id
                    ? assessments.find(a => a.id === deleteTarget.id)?.name
                    : undefined
                  }
                  isDeleting={deleteMutation.isPending}
                  type={deleteTarget?.type || 'single'}
                  count={deleteTarget?.count || 1}
                />
      </div>
    </Layout>
  )
}
