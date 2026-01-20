import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MaterialButton, MaterialInput, MaterialSelect, MaterialCard } from './material'
import { X, FileText, AlertCircle } from 'lucide-react'
import { showToast } from '../utils/toast'
import { formLayoutsApi } from '../lib/formLayouts'

interface EditFormModalProps {
  isOpen: boolean
  form: any
  onClose: () => void
  onUpdate: (updatedForm: any) => void
}

export default function EditFormModal({ isOpen, form, onClose, onUpdate }: EditFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const formTypes = [
    { value: 'agent_onboarding_workflow', label: 'Agent Onboarding' },
    { value: 'vendor_submission_workflow', label: 'Vendor Submission' },
    { value: 'product_submission_workflow', label: 'Product Submission' },
    { value: 'service_submission_workflow', label: 'Service Submission' }
  ]

  useEffect(() => {
    if (form && isOpen) {
      setFormData({
        name: form.name || '',
        description: form.description || '',
        type: form.request_type || ''
      })
      setErrors({})
    }
  }, [form, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Form name is required'
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Form name must be at least 3 characters'
    }
    
    if (!formData.type) {
      newErrors.type = 'Form type is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    try {
      // Update form using the API
      const updatedForm = await formLayoutsApi.update(form.id, {
        name: formData.name.trim(),
        description: formData.description.trim()
        // Note: request_type cannot be updated after creation per FormLayoutUpdate interface
      })
      
      queryClient.invalidateQueries({ queryKey: ['form-library'] })
      onUpdate(updatedForm)
      showToast.success('Form updated successfully')
      handleClose()
    } catch (error: any) {
      console.error('Failed to update form:', error)
      showToast.error('Failed to update form: ' + (error.message || 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      type: ''
    })
    setErrors({})
    onClose()
  }

  if (!isOpen || !form) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <MaterialCard className="w-full max-w-md">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit Form</h2>
                <p className="text-sm text-gray-600">Modify form details</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form Name */}
            <div>
              <label htmlFor="edit-form-name" className="block text-sm font-medium text-gray-700 mb-2">
                Form Name *
              </label>
              <MaterialInput
                id="edit-form-name"
                placeholder="Enter form name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!errors.name}
                errorText={errors.name}
                autoFocus
              />
            </div>

            {/* Form Type */}
            <div>
              <label htmlFor="edit-form-type" className="block text-sm font-medium text-gray-700 mb-2">
                Form Type *
              </label>
              <MaterialSelect
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={formTypes}
                error={!!errors.type}
                errorText={errors.type}
              />
              <p className="text-xs text-gray-500 mt-1">
                Form type cannot be changed after creation
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="edit-form-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <MaterialInput
                id="edit-form-description"
                placeholder="Briefly describe what this form is for..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </div>

            {/* Form ID (readonly) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form ID
              </label>
              <MaterialInput
                value={form.id}
                readOnly
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                This ID is used for form identification and cannot be changed
              </p>
            </div>

            {/* Warning Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Note</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    To modify form structure, fields, and design, use the "Edit in Designer" option after saving these changes.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <MaterialButton
                variant="outlined"
                onClick={handleClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </MaterialButton>
              <MaterialButton
                variant="contained"
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </MaterialButton>
            </div>
          </form>
        </div>
      </MaterialCard>
    </div>
  )
}