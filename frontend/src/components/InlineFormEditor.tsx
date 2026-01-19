import React, { useState, useEffect } from 'react'
import { FormLayout, formLayoutsApi, FormLayoutCreate, FormLayoutUpdate } from '../lib/formLayouts'
import { 
  XIcon,
  SaveIcon,
  EyeIcon,
  PlusIcon
} from './Icons'
import MaterialButton from './material/MaterialButton'
import MaterialInput from './material/MaterialInput'
import MaterialSelect from './material/MaterialSelect'

interface InlineFormEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (formData: FormLayoutCreate | FormLayoutUpdate) => void
  formId?: string
  initialData?: Partial<FormLayout>
}

export default function InlineFormEditor({
  isOpen,
  onClose,
  onSave,
  formId,
  initialData
}: InlineFormEditorProps) {
  const [formData, setFormData] = useState<Partial<FormLayoutCreate>>({
    name: '',
    description: '',
    request_type: 'agent_onboarding_workflow',
    layout_type: 'submission',
    sections: [],
    is_default: false,
    is_template: false,
    ...initialData
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen && formId) {
      // Load existing form data - simplified approach
      setLoading(true)
      // In a real implementation, you'd fetch the form data here
      setTimeout(() => {
        setFormData({
          name: 'Loaded Form',
          description: 'Description loaded from API',
          request_type: 'agent_onboarding_workflow',
          layout_type: 'submission',
          sections: []
        })
        setLoading(false)
      }, 500)
    } else if (isOpen) {
      // Reset for new form
      setFormData({
        name: '',
        description: '',
        request_type: 'agent_onboarding_workflow',
        layout_type: 'submission',
        sections: [],
        is_default: false,
        is_template: false,
        ...initialData
      })
      setErrors({})
    }
  }, [isOpen, formId, initialData])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Form name is required'
    }
    
    if (formData.name && formData.name.length > 100) {
      newErrors.name = 'Form name must be less than 100 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    try {
      const submitData: FormLayoutCreate | FormLayoutUpdate = {
        name: formData.name!,
        description: formData.description,
        request_type: formData.request_type || 'agent_onboarding_workflow',
        layout_type: formData.layout_type || 'submission',
        sections: formData.sections || [],
        is_default: formData.is_default,
        is_template: formData.is_template
      }
      
      onSave(submitData)
    } catch (error) {
      setErrors({ general: 'Failed to save form' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {formId ? 'Edit Form' : 'Create New Form'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              
              <div>
                <MaterialInput
                  label="Form Name *"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  error={!!errors.name}
                  errorText={errors.name}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe what this form is used for..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <MaterialSelect
                  label="Request Type"
                  value={formData.request_type || 'agent_onboarding_workflow'}
                  onChange={(e) => setFormData(prev => ({ ...prev, request_type: e.target.value as any }))}
                  options={[
                    { value: 'agent_onboarding_workflow', label: 'Agent Onboarding' },
                    { value: 'vendor_submission_workflow', label: 'Vendor Submission' },
                    { value: 'assessment_workflow', label: 'Assessment' }
                  ]}
                />

                <MaterialSelect
                  label="Layout Type"
                  value={formData.layout_type || 'submission'}
                  onChange={(e) => setFormData(prev => ({ ...prev, layout_type: e.target.value as any }))}
                  options={[
                    { value: 'submission', label: 'Submission' },
                    { value: 'approver', label: 'Approver' }
                  ]}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_default || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Default Form</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_template || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_template: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Template</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <MaterialButton
            variant="outlined"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </MaterialButton>
          <MaterialButton
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit as any}
            disabled={loading}
            loading={loading}
          >
            {formId ? 'Update Form' : 'Create Form'}
          </MaterialButton>
        </div>
      </div>
    </div>
  )
}