import { useEffect, useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { questionLibraryApi, QuestionLibrary as QuestionLibraryType, AssessmentType } from '../lib/assessments'
import { masterDataListsApi, MasterDataValue } from '../lib/masterDataLists'
import Layout from '../components/Layout'
import { Plus, Edit, Trash2, Search, Filter, X, Save, ToggleLeft, ToggleRight, CheckSquare, Square, Download, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'

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
  const [user, setUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionLibraryType | null>(null)
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
  })

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
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<QuestionLibraryType> }) => {
      console.log('Updating question with data:', data)
      return questionLibraryApi.update(id, data as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
      setShowEditModal(false)
      setSelectedQuestion(null)
    },
    onError: (error: any) => {
      console.error('Error updating question:', error)
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error.message || 'Unknown error'
      console.error('Full error response:', error?.response?.data)
      alert(`Failed to update question: ${errorMessage}`)
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

  const handleCreate = () => {
    createMutation.mutate(formData)
  }

  const handleEdit = (question: QuestionLibraryType) => {
    setSelectedQuestion(question)
    // Handle assessment_type - convert to array if it's a string (backward compatibility)
    const assessmentTypes = Array.isArray(question.assessment_type) 
      ? question.assessment_type 
      : question.assessment_type 
        ? [question.assessment_type] 
        : ['tprm']
    
    setFormData({
      title: question.title,
      question_text: question.question_text,
      description: question.description || '',
      assessment_type: assessmentTypes as AssessmentType[],
      category: question.category || '',
      field_type: question.field_type,
      response_type: question.response_type,
      is_required: question.is_required,
      options: question.options || [],
    })
    setShowEditModal(true)
  }

  const handleUpdate = () => {
    if (selectedQuestion) {
      // Prepare update data - only include fields that have changed or are required
      const updateData: Partial<QuestionLibraryType> = {
        title: formData.title,
        question_text: formData.question_text,
        description: formData.description || undefined,
        assessment_type: formData.assessment_type, // Ensure it's an array
        category: formData.category || undefined,
        field_type: formData.field_type,
        response_type: formData.response_type,
        is_required: formData.is_required,
        options: formData.options && formData.options.length > 0 ? formData.options : undefined,
      }
      
      // Remove undefined values to avoid sending them
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData]
        }
      })
      
      console.log('Updating question with data:', updateData)
      updateMutation.mutate({ id: selectedQuestion.id, data: updateData })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleBulkDelete = () => {
    const count = selectedQuestions.size
    if (count === 0) return
    
    if (confirm(`Are you sure you want to delete ${count} question${count > 1 ? 's' : ''}?`)) {
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
                    filteredQuestions.map((question) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium">Add Question</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    placeholder="Question title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Question Text *</label>
                  <textarea
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    rows={3}
                    placeholder="Enter question text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Assessment Type(s) *</label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      <div className="space-y-2">
                        {ASSESSMENT_TYPES.map(type => (
                          <label
                            key={type.value}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={formData.assessment_type.includes(type.value)}
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
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {formData.assessment_type.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">At least one assessment type is required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    >
                      <option value="">Select Category</option>
                      {questionCategories.map((cat: MasterDataValue) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Field Type *</label>
                    <select
                      value={formData.field_type}
                      onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                      className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Response Type *</label>
                    <select
                      value={formData.response_type}
                      onChange={(e) => setFormData({ ...formData, response_type: e.target.value })}
                      className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    >
                      {RESPONSE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Required</span>
                  </label>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!formData.title || !formData.question_text || formData.assessment_type.length === 0 || createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Question'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedQuestion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium">Edit Question</h2>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Question Text *</label>
                  <textarea
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Assessment Type(s) *</label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      <div className="space-y-2">
                        {ASSESSMENT_TYPES.map(type => (
                          <label
                            key={type.value}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={formData.assessment_type.includes(type.value)}
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
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {formData.assessment_type.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">At least one assessment type is required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    >
                      <option value="">Select Category</option>
                      {questionCategories.map((cat: MasterDataValue) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Field Type *</label>
                    <select
                      value={formData.field_type}
                      onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                      className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Response Type *</label>
                    <select
                      value={formData.response_type}
                      onChange={(e) => setFormData({ ...formData, response_type: e.target.value })}
                      className="w-full px-3 py-2 text-body rounded-lg border border-gray-300"
                    >
                      {RESPONSE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Required</span>
                  </label>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={!formData.title || !formData.question_text || formData.assessment_type.length === 0 || updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update Question'}
                  </button>
                </div>
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
                        alert('Please select a file')
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
                            alert('Excel file must have at least a header row and one data row')
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
                            alert('CSV file must have at least a header row and one data row')
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
                          alert('Unsupported file format. Please use Excel (.xlsx), CSV (.csv), or JSON (.json)')
                          return
                        }
                        
                        if (questions.length === 0) {
                          alert('No valid questions found in the file')
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
                          alert('No questions to export')
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
                          alert('No questions to export')
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
                          alert('No questions to export')
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
