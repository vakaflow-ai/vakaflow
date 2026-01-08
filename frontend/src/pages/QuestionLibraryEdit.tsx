import { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { authApi } from '../lib/auth'
import { questionLibraryApi, QuestionLibrary as QuestionLibraryType, AssessmentType } from '../lib/assessments'
import { masterDataListsApi, MasterDataValue } from '../lib/masterDataLists'
import Layout from '../components/Layout'
import { ArrowLeft, Save, Plus, X, Search, ChevronDown, Check } from 'lucide-react'
import { showToast } from '../utils/toast'

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

export default function QuestionLibraryEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
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
    type_of_control: 'multi_select', // New field: Type of Control
  })
  const [assessmentTypeSearchOpen, setAssessmentTypeSearchOpen] = useState(false)
  const [assessmentTypeSearchTerm, setAssessmentTypeSearchTerm] = useState('')
  const assessmentTypeDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assessmentTypeDropdownRef.current && !assessmentTypeDropdownRef.current.contains(event.target as Node)) {
        setAssessmentTypeSearchOpen(false)
        setAssessmentTypeSearchTerm('')
      }
    }

    if (assessmentTypeSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [assessmentTypeSearchOpen])

  useEffect(() => {
    authApi.getCurrentUser()
      .then((user) => setUser(user as any))
      .catch(() => setUser(null))
  }, [])

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

  // Fetch the question to edit
  const { data: question, isLoading: questionLoading } = useQuery({
    queryKey: ['question-library', id],
    queryFn: async () => {
      if (!id) throw new Error('Question ID is required')
      const questions = await questionLibraryApi.list({})
      const found = questions.find(q => q.id === id)
      if (!found) throw new Error('Question not found')
      return found
    },
    enabled: !!id && !!user?.tenant_id,
  })

  // Populate form when question is loaded
  useEffect(() => {
    if (question) {
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
        type_of_control: (question as any).type_of_control || 'multi_select',
      })
    }
  }, [question])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<QuestionLibraryType> }) => {
      console.log('Updating question with data:', data)
      return questionLibraryApi.update(id, data as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-library'] })
      showToast.success('Question updated successfully')
      navigate('/admin/question-library')
    },
    onError: (error: any) => {
      console.error('Error updating question:', error)
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error.message || 'Unknown error'
      showToast.error(`Failed to update question: ${errorMessage}`)
    },
  })

  const handleUpdate = () => {
    if (!id) return
    
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
      type_of_control: formData.type_of_control,
    }
    
    // Remove undefined values to avoid sending them
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })
    
    updateMutation.mutate({ id, data: updateData })
  }

  if (!user) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    )
  }

  if (questionLoading) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading question...</div>
        </div>
      </Layout>
    )
  }

  if (!question) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-red-500 font-medium mb-2">Question not found</div>
          <button
            onClick={() => navigate('/admin/question-library')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Return to Question Library
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <style>{`
        .assessment-types-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .assessment-types-scroll::-webkit-scrollbar-track {
          background: #F3F4F6;
          border-radius: 5px;
        }
        .assessment-types-scroll::-webkit-scrollbar-thumb {
          background: #9CA3AF;
          border-radius: 5px;
        }
        .assessment-types-scroll::-webkit-scrollbar-thumb:hover {
          background: #6B7280;
        }
        .assessment-types-scroll {
          scrollbar-width: thin;
          scrollbar-color: #9CA3AF #F3F4F6;
        }
      `}</style>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/question-library')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Question Library</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Question</h1>
          <p className="text-sm text-gray-600 mt-1">Update question details and settings</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Question Text *</label>
              <textarea
                value={formData.question_text}
                onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                rows={2}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Type of Control</label>
                <select
                  value={formData.type_of_control}
                  onChange={(e) => setFormData({ ...formData, type_of_control: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="single_select">Single Select</option>
                  <option value="multi_select">Multi Select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="radio">Radio</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Controls how assessment types are displayed/selected</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Field Type *</label>
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
              {/* Response Type only for text-based fields */}
              {['text', 'textarea', 'email', 'url', 'number'].includes(formData.field_type) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Response Type *</label>
                  <select
                    value={formData.response_type}
                    onChange={(e) => setFormData({ ...formData, response_type: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {RESPONSE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              )}
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
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-gray-900">Required</span>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 justify-end p-6 pt-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => navigate('/admin/question-library')}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={
                !formData.title || 
                !formData.question_text || 
                formData.assessment_type.length === 0 || 
                (['select', 'multi_select', 'radio', 'checkbox'].includes(formData.field_type) && formData.options.length === 0) ||
                (['select', 'multi_select', 'radio', 'checkbox'].includes(formData.field_type) && formData.options.some(opt => !opt.value || !opt.label)) ||
                updateMutation.isPending
              }
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Question
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
