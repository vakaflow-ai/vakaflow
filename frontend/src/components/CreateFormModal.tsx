import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialButton, MaterialInput, MaterialSelect, MaterialCard } from './material'
import { X, FileText, AlertCircle } from 'lucide-react'
import { showToast } from '../utils/toast'

interface CreateFormModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (formData: { name: string; description: string; type: string }) => void
}

export default function CreateFormModal({ isOpen, onClose, onCreate }: CreateFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'agent_onboarding_workflow'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formTypes = [
    { value: 'agent_onboarding_workflow', label: 'Agent Onboarding' },
    { value: 'vendor_submission_workflow', label: 'Vendor Submission' },
    { value: 'product_submission_workflow', label: 'Product Submission' },
    { value: 'service_submission_workflow', label: 'Service Submission' }
  ]

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
      await onCreate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type
      })
    } catch (error) {
      showToast.error('Failed to create form')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // Reset form when closing
    setFormData({
      name: '',
      description: '',
      type: 'agent_onboarding_workflow'
    })
    setErrors({})
    onClose()
  }

  if (!isOpen) return null

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
                <h2 className="text-xl font-semibold text-gray-900">Create New Form</h2>
                <p className="text-sm text-gray-600">Define your form details before starting the design</p>
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
              <label htmlFor="form-name" className="block text-sm font-medium text-gray-700 mb-2">
                Form Name *
              </label>
              <MaterialInput
                id="form-name"
                placeholder="Enter form name (e.g., Vendor Registration Form)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!errors.name}
                errorText={errors.name}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be used for searching and identifying your form
              </p>
            </div>

            {/* Form Type */}
            <div>
              <label htmlFor="form-type" className="block text-sm font-medium text-gray-700 mb-2">
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
                Determines which workflows this form can be used with
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="form-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <MaterialInput
                id="form-description"
                placeholder="Briefly describe what this form is for..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Help others understand the purpose of this form
              </p>
            </div>

            {/* Warning Note */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    You'll be redirected to the form designer after submitting. Make sure to save your work regularly.
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
                {isSubmitting ? 'Creating...' : 'Create Form'}
              </MaterialButton>
            </div>
          </form>
        </div>
      </MaterialCard>
    </div>
  )
}