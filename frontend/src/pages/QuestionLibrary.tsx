import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/auth'
import { questionLibraryApi, QuestionLibrary as QuestionLibraryType, AssessmentType } from '../lib/assessments'
import { masterDataListsApi, MasterDataValue } from '../lib/masterDataLists'
import { frameworksApi, ComplianceFramework } from '../lib/frameworks'
import Layout from '../components/Layout'
import { Plus, Edit, Trash2, Search, Filter, X, Save, ToggleLeft, ToggleRight, CheckSquare, Square, Download, Upload, ChevronDown, Check } from 'lucide-react'
import * as XLSX from 'xlsx'
import { showToast } from '../utils/toast'
import { useDialogContext } from '../contexts/DialogContext'

// Assessment types are now fetched from master data lists
// Fallback constant for backward compatibility
const ASSESSMENT_TYPES_FALLBACK: { value: AssessmentType; label: string }[] = [
  { value: 'tprm', label: 'TPRM' },
  { value: 'vendor_qualification', label: 'Vendor Qualification' },
  { value: 'risk_assessment', label: 'Risk Assessment' },
  { value: 'security_assessment', label: 'Security Assessment' },
  { value: 'compliance_assessment', label: 'Compliance Assessment' },
  { value: 'ai_vendor_qualification', label: 'AI Vendor Qualification' },
  { value: 'custom', label: 'Custom' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File Upload' },
]

const RESPONSE_TYPES = [
  { value: 'Text', label: 'Text' },
  { value: 'File', label: 'File' },
  { value: 'Number', label: 'Number' },
  { value: 'Date', label: 'Date' },
  { value: 'URL', label: 'URL' },
]

interface User {
  id: string
  role: string
  tenant_id?: string
}

export default function QuestionLibrary() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const dialog = useDialogContext()
  const [user, setUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterAssessmentType, setFilterAssessmentType] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    question_text: '',
    description: '',
    assessment_type: ['tprm'] as AssessmentType[],
    category: '',
    field_type: 'text',
    response_type: 'Text',
    is_required: false,
    options: [] as Array<{ value: string; label: string }>,
    compliance_framework_ids: [] as string[],
    risk_framework_ids: [] as string[],
  })
  const [assessmentTypeSearchOpen, setAssessmentTypeSearchOpen] = useState(false)
  const [assessmentTypeSearchTerm, setAssessmentTypeSearchTerm] = useState('')
  const assessmentTypeDropdownRef = useRef<HTMLDivElement>(null)
  const [complianceFrameworkSearchOpen, setComplianceFrameworkSearchOpen] = useState(false)
  const [complianceFrameworkSearchTerm, setComplianceFrameworkSearchTerm] = useState('')
  const complianceFrameworkDropdownRef = useRef<HTMLDivElement>(null)
  const [riskFrameworkSearchOpen, setRiskFrameworkSearchOpen] = useState(false)
  const [riskFrameworkSearchTerm, setRiskFrameworkSearchTerm] = useState('')
  const riskFrameworkDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assessmentTypeDropdownRef.current && !assessmentTypeDropdownRef.current.contains(event.target as Node)) {
        setAssessmentTypeSearchOpen(false)
        setAssessmentTypeSearchTerm('')
      }
      if (complianceFrameworkDropdownRef.current && !complianceFrameworkDropdownRef.current.contains(event.target as Node)) {
        setComplianceFrameworkSearchOpen(false)
        setComplianceFrameworkSearchTerm('')
      }
      if (riskFrameworkDropdownRef.current && !riskFrameworkDropdownRef.current.contains(event.target as Node)) {
        setRiskFrameworkSearchOpen(false)
        setRiskFrameworkSearchTerm('')
      }
    }

    if (assessmentTypeSearchOpen || complianceFrameworkSearchOpen || riskFrameworkSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [assessmentTypeSearchOpen, complianceFrameworkSearchOpen, riskFrameworkSearchOpen])

  useEffect(() => {
    authApi.getCurrentUser()
      .then((user) => setUser(user as any))
      .catch(() => setUser(null))
  }, [])

  const { data: questions = [], isLoading, error } = useQuery({
    queryKey: ['question-library', filterAssessmentType, filterCategory],
    queryFn: async () => {
      console.log('Fetching questions with filters:', { assessment_type: filterAssessmentType, category: filterCategory })
      const result = await questionLibraryApi.list({
        assessment_type: filterAssessmentType || undefined,  // Filter still works with single type
        category: filterCategory || undefined,
        is_active: true,
      })
      console.log(`Received ${result.length} questions from API`)
      return result
    },
    enabled: !!user?.tenant_id,
  })
  
  // Debug: Log when questions change
  useEffect(() => {
    console.log('Questions updated:', questions.length, 'questions', { filterAssessmentType, filterCategory })
  }, [questions, filterAssessmentType, filterCategory])

  // Fetch question categories from master data
  const { data: questionCategories = [] } = useQuery({
    queryKey: ['question-categories'],
    queryFn: () => masterDataListsApi.getValuesByType('question_category'),
    enabled: !!user?.tenant_id,
  })

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

  // Fetch compliance and risk frameworks
  const { data: frameworks = [] } = useQuery({
    queryKey: ['compliance-frameworks'],
    queryFn: () => frameworksApi.list(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<QuestionLibraryType>) => questionLibraryApi.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
      setShowCreateModal(false)
      setFormData({
        title: '',
        question_text: '',
        description: '',
        assessment_type: ['tprm'],
        category: '',
        field_type: 'text',
        response_type: 'Text',
        is_required: false,
        options: [],
        compliance_framework_ids: [],
        risk_framework_ids: [],
      })
    },
  })


  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionLibraryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
      setSelectedQuestions(new Set())
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete questions one by one (backend doesn't have bulk delete endpoint)
      await Promise.all(ids.map(id => questionLibraryApi.delete(id)))
    },
    onSuccess: (_, deletedIds) => {
      // Optimistically remove the deleted questions from cache
      const deletedIdsSet = new Set(deletedIds)
      queryClient.setQueriesData<QuestionLibraryType[]>(
        { queryKey: ['question-library'] },
        (oldData) => {
          if (!oldData) return oldData
          return oldData.filter(question => !deletedIdsSet.has(question.id!))
        }
      )
      
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
      setSelectedQuestions(new Set())
    },
  })

  const importMutation = useMutation({
    mutationFn: async (questions: any[]) => {
      const results = []
      for (const question of questions) {
        try {
          // Handle assessment_type - convert string to array if needed
          const assessmentTypes = Array.isArray(question.assessment_type)
            ? question.assessment_type
            : question.assessment_type
              ? question.assessment_type.split(',').map((t: string) => t.trim()).filter(Boolean)
              : ['tprm']
          
          // Handle options - convert string to array if needed
          let options = question.options
          if (options && typeof options === 'string') {
            try {
              options = JSON.parse(options)
            } catch {
              // If not JSON, treat as comma-separated values
              options = options.split(',').map((opt: string) => {
                const trimmed = opt.trim()
                return { value: trimmed, label: trimmed }
              })
            }
          }
          
          const questionData = {
            ...question,
            assessment_type: assessmentTypes,
            options: options,
            is_required: question.is_required === true || question.is_required === 'true' || question.is_required === 'TRUE' || question.is_required === '1' || question.is_required === 1,
          }
          
          const result = await questionLibraryApi.create(questionData)
          results.push({ success: true, data: result })
        } catch (error: any) {
          results.push({ success: false, error: error.message, data: question })
        }
      }
      return results
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      alert(`Import completed: ${successCount} succeeded, ${failCount} failed`)
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
      setShowImportModal(false)
      setImportFile(null)
    },
    onError: (error: any) => {
      alert(`Import failed: ${error.message}`)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => questionLibraryApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
    },
  })

  const filteredQuestions = questions.filter(q => {
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !q.question_text.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  // Group questions by category
  const questionsByCategory = useMemo(() => {
    const grouped: Record<string, QuestionLibraryType[]> = {}
    
    filteredQuestions.forEach(question => {
      const category = question.category || 'Uncategorized'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(question)
    })
    
    // Sort categories alphabetically, with "Uncategorized" at the end
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    
    return { grouped, sortedCategories }
  }, [filteredQuestions])

  const handleCreate = () => {
    // Ensure response_type is set (required field)
    const responseType = formData.response_type || (formData.field_type === 'file' ? 'File' : formData.field_type === 'number' ? 'Number' : formData.field_type === 'date' ? 'Date' : 'Text')
    createMutation.mutate({ 
      ...formData, 
      response_type: responseType,
      compliance_framework_ids: formData.compliance_framework_ids.length > 0 ? formData.compliance_framework_ids : undefined,
      risk_framework_ids: formData.risk_framework_ids.length > 0 ? formData.risk_framework_ids : undefined,
    })
  }

  const handleEdit = (question: QuestionLibraryType) => {
    navigate(`/admin/question-library/${question.id}/edit`)
  }



  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete Question',
      message: 'Are you sure you want to delete this question? This action cannot be undone.',
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(id)
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedQuestions.size
    if (count === 0) return
    
    const confirmed = await dialog.confirm({
      title: 'Delete Questions',
      message: `Are you sure you want to delete ${count} question${count > 1 ? 's' : ''}? This action cannot be undone.`,
      variant: 'destructive'
    })
    if (confirmed) {
      bulkDeleteMutation.mutate(Array.from(selectedQuestions))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)))
    } else {
      setSelectedQuestions(new Set())
    }
  }

  const handleSelectQuestion = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedQuestions)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedQuestions(newSelected)
  }

  const isAllSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestions.has(q.id))
  const isSomeSelected = selectedQuestions.size > 0 && selectedQuestions.size < filteredQuestions.length
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  // Update indeterminate state of select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeSelected
    }
  }, [isSomeSelected])

  if (!user || !['tenant_admin', 'platform_admin', 'security_reviewer', 'compliance_reviewer'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Question library management access required.</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1">
            <h2>Question Library</h2>
            <p className="text-body text-gray-600 mt-2">
              Manage reusable questions for assessments. Questions can be used across multiple assessments.
            </p>
          </div>
          <div className="flex gap-2">
            {selectedQuestions.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-body font-medium disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedQuestions.size})
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-body font-medium ${
                showFilters ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 border border-slate-300 text-body font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 border border-slate-300 text-body font-medium"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-body font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white border rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-label mb-1.5">Assessment Type</label>
                <select
                  value={filterAssessmentType}
                  onChange={(e) => {
                    console.log('Assessment type filter changed:', e.target.value)
                    setFilterAssessmentType(e.target.value)
                  }}
                  className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                >
                  <option value="">All Types</option>
                  {ASSESSMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-label mb-1.5">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    console.log('Category filter changed:', e.target.value)
                    setFilterCategory(e.target.value)
                  }}
                  className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                >
                  <option value="">All Categories</option>
                  {questionCategories.map((cat: MasterDataValue) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-label mb-1.5">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setFilterAssessmentType('')
                  setFilterCategory('')
                  setSearchQuery('')
                }}
                className="px-3 py-1.5 text-caption font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-300"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">Loading questions...</div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-2">Error loading questions. Please try again.</div>
            <div className="text-caption text-gray-500">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="overflow-hidden">
              <table className="w-full table-fixed">
                <thead>
                  <tr>
                    <th className="table-header px-4 py-3 text-left w-[4%]">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          ref={selectAllCheckboxRef}
                          checked={isAllSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </label>
                    </th>
                    <th className="table-header px-4 py-3 text-left w-[18%]">Title</th>
                    <th className="table-header px-4 py-3 text-left w-[25%]">Question</th>
                    <th className="table-header px-4 py-3 text-left w-[15%]">Assessment Type</th>
                    <th className="table-header px-4 py-3 text-left w-[10%]">Category</th>
                    <th className="table-header px-4 py-3 text-left w-[8%]">Field Type</th>
                    <th className="table-header px-4 py-3 text-left w-[5%]">Usage</th>
                    <th className="table-header px-4 py-3 text-left w-[5%]">Status</th>
                    <th className="table-header px-4 py-3 text-left w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-body text-gray-500">
                        No questions found. Create your first question to get started.
                      </td>
                    </tr>
                  ) : (
                    questionsByCategory.sortedCategories.map((category) => {
                      const categoryQuestions = questionsByCategory.grouped[category]
                      return (
                        <React.Fragment key={category}>
                          {/* Category Header */}
                          <tr className="bg-gray-100 border-t-2 border-gray-300">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-900 uppercase">
                                  {category} ({categoryQuestions.length} {categoryQuestions.length === 1 ? 'question' : 'questions'})
                                </span>
                              </div>
                            </td>
                          </tr>
                          {/* Questions in this category */}
                          {categoryQuestions.map((question) => (
                            <tr key={question.id} className={`hover:bg-gray-50 ${selectedQuestions.has(question.id) ? 'bg-blue-50' : 'bg-white'}`}>
                              <td className="px-4 py-2.5">
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedQuestions.has(question.id)}
                                    onChange={(e) => handleSelectQuestion(question.id, e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                  />
                                </label>
                              </td>
                              <td className="table-cell-primary px-4 py-3">{question.title}</td>
                              <td className="table-cell-secondary px-4 py-3">{question.question_text.substring(0, 100)}...</td>
                              <td className="table-cell-secondary px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(Array.isArray(question.assessment_type) ? question.assessment_type : [question.assessment_type]).map((atype, idx) => (
                                    <span key={idx} className="px-2 py-1 badge-text bg-blue-100 text-blue-600 rounded">
                                      {ASSESSMENT_TYPES.find(t => t.value === atype)?.label || atype}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="table-cell-secondary px-4 py-3">{question.category || '-'}</td>
                              <td className="table-cell-secondary px-4 py-3">{question.field_type}</td>
                              <td className="table-cell-secondary px-4 py-3">{question.usage_count || 0}</td>
                              <td className="px-4 py-2.5" style={{ width: '80px' }}>
                                <label 
                                  className="flex items-center gap-1.5 cursor-pointer group"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleMutation.mutate(question.id)
                                  }}
                                  title={question.is_active ? 'Click to disable' : 'Click to enable'}
                                >
                                  {question.is_active ? (
                                    <ToggleRight className="w-5 h-5 text-green-600 group-hover:text-green-700" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-600" />
                                  )}
                                </label>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEdit(question)}
                                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                  >
                                    <Edit className="w-3 h-3 inline" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(question.id)}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                  >
                                    <Trash2 className="w-3 h-3 inline" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-900">Add Question</h2>
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Question title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Question Text *</label>
                  <textarea
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                    rows={3}
                    placeholder="Enter question text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Assessment Type(s) *</label>
                    <div className="relative" ref={assessmentTypeDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setAssessmentTypeSearchOpen(!assessmentTypeSearchOpen)}
                        className="w-full px-4 py-2.5 text-sm text-left rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex items-center justify-between"
                      >
                        <span className="text-gray-700">
                          {formData.assessment_type.length === 0
                            ? 'Select assessment types...'
                            : `${formData.assessment_type.length} selected`}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${assessmentTypeSearchOpen ? 'transform rotate-180' : ''}`} />
                      </button>
                      
                      {assessmentTypeSearchOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                          <div className="p-2 border-b border-gray-200">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={assessmentTypeSearchTerm}
                                onChange={(e) => setAssessmentTypeSearchTerm(e.target.value)}
                                placeholder="Search assessment types..."
                                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {ASSESSMENT_TYPES
                              .filter(type => 
                                type.label.toLowerCase().includes(assessmentTypeSearchTerm.toLowerCase())
                              )
                              .map(type => {
                                const isSelected = formData.assessment_type.includes(type.value)
                                return (
                          <label
                            key={type.value}
                                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                                      checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    assessment_type: [...formData.assessment_type, type.value]
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    assessment_type: formData.assessment_type.filter(t => t !== type.value)
                                  })
                                }
                              }}
                                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                            />
                                    <span className="text-sm text-gray-700 flex-1">{type.label}</span>
                                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                          </label>
                                )
                              })}
                            {ASSESSMENT_TYPES.filter(type => 
                              type.label.toLowerCase().includes(assessmentTypeSearchTerm.toLowerCase())
                            ).length === 0 && (
                              <div className="px-4 py-8 text-center text-sm text-gray-500">
                                No assessment types found
                      </div>
                            )}
                          </div>
                          {formData.assessment_type.length > 0 && (
                            <div className="p-2 border-t border-gray-200 bg-gray-50">
                              <div className="flex flex-wrap gap-1">
                                {formData.assessment_type.map(typeValue => {
                                  const type = ASSESSMENT_TYPES.find(t => t.value === typeValue)
                                  return type ? (
                                    <span
                                      key={typeValue}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded"
                                    >
                                      {type.label}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setFormData({
                                            ...formData,
                                            assessment_type: formData.assessment_type.filter(t => t !== typeValue)
                                          })
                                        }}
                                        className="hover:text-indigo-900"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ) : null
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {formData.assessment_type.length === 0 && (
                      <p className="text-xs text-red-600 mt-2">At least one assessment type is required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select Category</option>
                      {questionCategories.map((cat: MasterDataValue) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Input Configuration Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Input Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Input Control * 
                      <span className="text-xs font-normal text-gray-500 ml-2">(What UI element users see: text box, radio buttons, file upload, etc.)</span>
                    </label>
                    <select
                      value={formData.field_type}
                      onChange={(e) => {
                        const newFieldType = e.target.value
                        // Reset options if switching away from option-based field types
                        if (!['select', 'multi_select', 'radio', 'checkbox'].includes(newFieldType)) {
                          setFormData({ ...formData, field_type: newFieldType, options: [] })
                        } else {
                          setFormData({ ...formData, field_type: newFieldType })
                        }
                      }}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data Type * 
                      <span className="text-xs font-normal text-gray-500 ml-2">(How the answer is stored: Text, File, Number, Date, URL)</span>
                    </label>
                    <select
                      value={formData.response_type}
                      onChange={(e) => setFormData({ ...formData, response_type: e.target.value })}
                      disabled={['file', 'number', 'date'].includes(formData.field_type)}
                      className={`w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        ['file', 'number', 'date'].includes(formData.field_type) ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    >
                      {RESPONSE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    {['file', 'number', 'date'].includes(formData.field_type) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Data type is automatically set based on input control
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.field_type === 'text' && 'Single-line text input'}
                      {formData.field_type === 'textarea' && 'Multi-line text input'}
                      {formData.field_type === 'number' && 'Numeric input'}
                      {formData.field_type === 'email' && 'Email address input'}
                      {formData.field_type === 'url' && 'URL input'}
                      {formData.field_type === 'select' && 'Dropdown selection (single choice)'}
                      {formData.field_type === 'multi_select' && 'Multi-select dropdown (multiple choices)'}
                      {formData.field_type === 'radio' && 'Radio buttons (single choice, e.g., Yes/No)'}
                      {formData.field_type === 'checkbox' && 'Checkboxes (multiple choices)'}
                      {formData.field_type === 'date' && 'Date picker'}
                      {formData.field_type === 'file' && 'File upload'}
                    </p>
                  </div>
                  </div>
                </div>
                
                {/* Options section for select, multi_select, radio, checkbox */}
                {['select', 'multi_select', 'radio', 'checkbox'].includes(formData.field_type) && (
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Options *
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        (Add options for {formData.field_type === 'checkbox' ? 'checkboxes' : formData.field_type === 'radio' ? 'radio buttons' : formData.field_type === 'multi_select' ? 'multi-select' : 'dropdown'})
                      </span>
                    </label>
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="space-y-3">
                        {formData.options.map((option, index) => (
                          <div key={index} className="flex gap-2 items-center">
                    <input
                              type="text"
                              value={option.value}
                              onChange={(e) => {
                                const newOptions = [...formData.options]
                                newOptions[index].value = e.target.value
                                setFormData({ ...formData, options: newOptions })
                              }}
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Value (e.g., yes, no, maybe)"
                            />
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => {
                                const newOptions = [...formData.options]
                                newOptions[index].label = e.target.value
                                setFormData({ ...formData, options: newOptions })
                              }}
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Label (e.g., Yes, No, Maybe)"
                            />
                <button
                              type="button"
                              onClick={() => {
                                const newOptions = formData.options.filter((_, i) => i !== index)
                                setFormData({ ...formData, options: newOptions })
                              }}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Remove option"
                            >
                              <X className="w-4 h-4" />
                </button>
              </div>
                        ))}
                <button 
                          type="button"
                          onClick={() => {
                                  setFormData({
                                    ...formData,
                              options: [...formData.options, { value: '', label: '' }]
                                  })
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Option
                        </button>
                        {formData.options.length === 0 && (
                          <p className="text-xs text-red-600 mt-2">At least one option is required for {formData.field_type}</p>
                    )}
                  </div>
                  </div>
                </div>
                )}
                
                {/* Compliance & Risk Frameworks Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Compliance & Risk Frameworks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Compliance Frameworks */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Compliance Frameworks
                        <span className="text-xs font-normal text-gray-500 ml-2">(Which compliance frameworks this question addresses)</span>
                      </label>
                      <div className="relative" ref={complianceFrameworkDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setComplianceFrameworkSearchOpen(!complianceFrameworkSearchOpen)}
                          className="w-full px-4 py-2.5 text-sm text-left rounded-lg border border-gray-300 bg-white hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex items-center justify-between"
                        >
                          <span className="text-gray-700">
                            {formData.compliance_framework_ids.length > 0
                              ? `${formData.compliance_framework_ids.length} selected`
                              : 'Select frameworks...'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${complianceFrameworkSearchOpen ? 'transform rotate-180' : ''}`} />
                        </button>
                        {complianceFrameworkSearchOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                            <div className="p-2 border-b border-gray-200">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={complianceFrameworkSearchTerm}
                                  onChange={(e) => setComplianceFrameworkSearchTerm(e.target.value)}
                                  placeholder="Search frameworks..."
                                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {frameworks
                                .filter(fw => fw.name.toLowerCase().includes(complianceFrameworkSearchTerm.toLowerCase()))
                                .map(framework => {
                                  const isSelected = formData.compliance_framework_ids.includes(framework.id)
                                  return (
                                    <label
                                      key={framework.id}
                                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({
                                              ...formData,
                                              compliance_framework_ids: [...formData.compliance_framework_ids, framework.id]
                                            })
                                          } else {
                                            setFormData({
                                              ...formData,
                                              compliance_framework_ids: formData.compliance_framework_ids.filter(id => id !== framework.id)
                                            })
                                          }
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="text-sm text-gray-700 flex-1">{framework.name}</span>
                                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                                    </label>
                                  )
                                })}
                              {frameworks.filter(fw => fw.name.toLowerCase().includes(complianceFrameworkSearchTerm.toLowerCase())).length === 0 && (
                                <div className="px-4 py-8 text-center text-sm text-gray-500">
                                  No frameworks found
                                </div>
                              )}
                            </div>
                            {formData.compliance_framework_ids.length > 0 && (
                              <div className="p-2 border-t border-gray-200 bg-gray-50">
                                <div className="flex flex-wrap gap-1">
                                  {formData.compliance_framework_ids.map(fwId => {
                                    const framework = frameworks.find(fw => fw.id === fwId)
                                    return framework ? (
                                      <span
                                        key={fwId}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded"
                                      >
                                        {framework.name}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setFormData({
                                              ...formData,
                                              compliance_framework_ids: formData.compliance_framework_ids.filter(id => id !== fwId)
                                            })
                                          }}
                                          className="hover:text-indigo-900"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Risk Frameworks */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Risk Frameworks
                        <span className="text-xs font-normal text-gray-500 ml-2">(Which risk frameworks this question addresses)</span>
                      </label>
                      <div className="relative" ref={riskFrameworkDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setRiskFrameworkSearchOpen(!riskFrameworkSearchOpen)}
                          className="w-full px-4 py-2.5 text-sm text-left rounded-lg border border-gray-300 bg-white hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex items-center justify-between"
                        >
                          <span className="text-gray-700">
                            {formData.risk_framework_ids.length > 0
                              ? `${formData.risk_framework_ids.length} selected`
                              : 'Select frameworks...'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${riskFrameworkSearchOpen ? 'transform rotate-180' : ''}`} />
                        </button>
                        {riskFrameworkSearchOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                            <div className="p-2 border-b border-gray-200">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={riskFrameworkSearchTerm}
                                  onChange={(e) => setRiskFrameworkSearchTerm(e.target.value)}
                                  placeholder="Search frameworks..."
                                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {frameworks
                                .filter(fw => fw.name.toLowerCase().includes(riskFrameworkSearchTerm.toLowerCase()))
                                .map(framework => {
                                  const isSelected = formData.risk_framework_ids.includes(framework.id)
                                  return (
                                    <label
                                      key={framework.id}
                                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setFormData({
                                              ...formData,
                                              risk_framework_ids: [...formData.risk_framework_ids, framework.id]
                                            })
                                          } else {
                                            setFormData({
                                              ...formData,
                                              risk_framework_ids: formData.risk_framework_ids.filter(id => id !== framework.id)
                                            })
                                          }
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <span className="text-sm text-gray-700 flex-1">{framework.name}</span>
                                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                                    </label>
                                  )
                                })}
                              {frameworks.filter(fw => fw.name.toLowerCase().includes(riskFrameworkSearchTerm.toLowerCase())).length === 0 && (
                                <div className="px-4 py-8 text-center text-sm text-gray-500">
                                  No frameworks found
                                </div>
                              )}
                            </div>
                            {formData.risk_framework_ids.length > 0 && (
                              <div className="p-2 border-t border-gray-200 bg-gray-50">
                                <div className="flex flex-wrap gap-1">
                                  {formData.risk_framework_ids.map(fwId => {
                                    const framework = frameworks.find(fw => fw.id === fwId)
                                    return framework ? (
                                      <span
                                        key={fwId}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded"
                                      >
                                        {framework.name}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setFormData({
                                              ...formData,
                                              risk_framework_ids: formData.risk_framework_ids.filter(id => id !== fwId)
                                            })
                                          }}
                                          className="hover:text-orange-900"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Required Field */}
                <div className="border-t border-gray-200 pt-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-semibold text-gray-900">Required Question</span>
                    <span className="text-xs text-gray-500">(Vendor must answer this question)</span>
                  </label>
                </div>
              </div>
              </div>
              <div className="flex gap-3 justify-end p-6 pt-4 border-t border-gray-200 flex-shrink-0 bg-white">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={
                    !formData.title || 
                    !formData.question_text || 
                    formData.assessment_type.length === 0 || 
                    (['select', 'multi_select', 'radio', 'checkbox'].includes(formData.field_type) && formData.options.length === 0) ||
                    (['select', 'multi_select', 'radio', 'checkbox'].includes(formData.field_type) && formData.options.some(opt => !opt.value || !opt.label)) ||
                    createMutation.isPending
                  }
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Question'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="mb-4">
                <h2 className="text-base font-medium mb-2">Import Questions</h2>
                <p className="text-sm text-gray-600">
                  Import questions from an Excel, CSV, or JSON file. Download the template first to see the required format.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select File</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Download Excel template
                      const headers = ['title', 'question_text', 'description', 'assessment_type', 'category', 'field_type', 'response_type', 'is_required', 'options']
                      const exampleRow = [
                        'Example Question',
                        'What is your security policy?',
                        'Example description',
                        'tprm,vendor_qualification', // Comma-separated for multiple types
                        'security',
                        'textarea',
                        'Text',
                        true,
                        '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]' // JSON string for options
                      ]
                      
                      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
                      const wb = XLSX.utils.book_new()
                      XLSX.utils.book_append_sheet(wb, ws, 'Questions')
                      
                      // Auto-size columns
                      const colWidths = headers.map((_, colIndex) => {
                        const maxLength = Math.max(
                          headers[colIndex].length,
                          String(exampleRow[colIndex] || '').length
                        )
                        return { wch: Math.min(maxLength + 2, 50) }
                      })
                      ws['!cols'] = colWidths
                      
                      XLSX.writeFile(wb, 'questions_template.xlsx')
                    }}
                    className="flex items-center gap-2 flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!importFile) {
                        showToast.error('Please select a file')
                        return
                      }
                      try {
                        const fileExtension = importFile.name.split('.').pop()?.toLowerCase()
                        let questions: any[] = []
                        
                        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                          // Read Excel file
                          const arrayBuffer = await importFile.arrayBuffer()
                          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
                          const sheetName = workbook.SheetNames[0]
                          const worksheet = workbook.Sheets[sheetName]
                          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
                          
                          if (jsonData.length < 2) {
                            showToast.error('Excel file must have at least a header row and one data row')
                            return
                          }
                          
                          const headers = jsonData[0] as string[]
                          questions = (jsonData.slice(1) as any[]).map(row => {
                            const question: any = {}
                            headers.forEach((header, index) => {
                              const value = row[index]
                              if (value !== undefined && value !== null && value !== '') {
                                question[header] = value
                              }
                            })
                            return question
                          }).filter(q => q.title && q.question_text) // Filter out empty rows
                        } else if (fileExtension === 'csv') {
                          // Read CSV file
                          const text = await importFile.text()
                          const lines = text.split('\n').filter(line => line.trim())
                          if (lines.length < 2) {
                            showToast.error('CSV file must have at least a header row and one data row')
                            return
                          }
                          
                          const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
                          questions = lines.slice(1).map(line => {
                            const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
                            const question: any = {}
                            headers.forEach((header, index) => {
                              const value = values[index]
                              if (value !== undefined && value !== null && value !== '') {
                                question[header] = value
                              }
                            })
                            return question
                          }).filter(q => q.title && q.question_text)
                        } else if (fileExtension === 'json') {
                          // Read JSON file
                          const text = await importFile.text()
                          const parsed = JSON.parse(text)
                          questions = Array.isArray(parsed) ? parsed : [parsed]
                        } else {
                          showToast.error('Unsupported file format. Please use Excel (.xlsx), CSV (.csv), or JSON (.json)')
                          return
                        }
                        
                        if (questions.length === 0) {
                          showToast.error('No valid questions found in the file')
                          return
                        }
                        
                        // Import questions via API
                        importMutation.mutate(questions)
                      } catch (error: any) {
                        alert(`Import failed: ${error.message}`)
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    disabled={importMutation.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    {importMutation.isPending ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="mb-4">
                <h2 className="text-base font-medium mb-2">Export Questions</h2>
                <p className="text-sm text-gray-600">
                  Export questions to Excel, CSV, or JSON format
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Export Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        if (!filteredQuestions || filteredQuestions.length === 0) {
                          showToast.warning('No questions to export')
                          return
                        }
                        // Export as Excel
                        const headers = ['title', 'question_text', 'description', 'assessment_type', 'category', 'field_type', 'response_type', 'is_required', 'options']
                        const data = filteredQuestions.map(q => [
                          q.title || '',
                          q.question_text || '',
                          q.description || '',
                          Array.isArray(q.assessment_type) ? q.assessment_type.join(',') : q.assessment_type || '',
                          q.category || '',
                          q.field_type || '',
                          q.response_type || '',
                          q.is_required || false,
                          q.options ? JSON.stringify(q.options) : ''
                        ])
                        
                        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
                        const wb = XLSX.utils.book_new()
                        XLSX.utils.book_append_sheet(wb, ws, 'Questions')
                        
                        // Auto-size columns
                        const colWidths = headers.map((_, colIndex) => {
                          const maxLength = Math.max(
                            headers[colIndex].length,
                            ...data.map(row => String(row[colIndex] || '').length)
                          )
                          return { wch: Math.min(maxLength + 2, 50) }
                        })
                        ws['!cols'] = colWidths
                        
                        XLSX.writeFile(wb, `questions_export_${new Date().toISOString().split('T')[0]}.xlsx`)
                        setShowExportModal(false)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={() => {
                        if (!filteredQuestions || filteredQuestions.length === 0) {
                          showToast.warning('No questions to export')
                          return
                        }
                        // Export as CSV
                        const headers = ['title', 'question_text', 'description', 'assessment_type', 'category', 'field_type', 'response_type', 'is_required']
                        const csvRows = [
                          headers.join(','),
                          ...filteredQuestions.map(q => [
                            `"${q.title || ''}"`,
                            `"${q.question_text || ''}"`,
                            `"${q.description || ''}"`,
                            Array.isArray(q.assessment_type) ? q.assessment_type.join(',') : q.assessment_type || '',
                            q.category || '',
                            q.field_type || '',
                            q.response_type || '',
                            q.is_required || false
                          ].join(','))
                        ]
                        const csv = csvRows.join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `questions_export_${new Date().toISOString().split('T')[0]}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowExportModal(false)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => {
                        if (!filteredQuestions || filteredQuestions.length === 0) {
                          showToast.warning('No questions to export')
                          return
                        }
                        // Export as JSON
                        const json = JSON.stringify(filteredQuestions, null, 2)
                        const blob = new Blob([json], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `questions_export_${new Date().toISOString().split('T')[0]}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowExportModal(false)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowExportModal(false)}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
