import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { vendorsApi, VendorCreate } from '../lib/vendors'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialInput } from '../components/material'
import { ArrowLeft, ArrowRight, Check, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VendorOnboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<VendorCreate>>({})

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const createMutation = useMutation({
    mutationFn: (data: VendorCreate) => vendorsApi.create(data),
    onSuccess: (vendor) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor created successfully. Notification sent to vendor coordinator.')
      navigate(`/vendors/${vendor.id}`)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create vendor')
    }
  })

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.contact_email) {
        toast.error('Please fill in all required fields')
        return
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.contact_email)) {
        toast.error('Please enter a valid email address')
        return
      }
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.contact_email) {
      toast.error('Please fill in all required fields')
      return
    }
    const submitData: VendorCreate = {
      name: formData.name!,
      contact_email: formData.contact_email!,
      contact_phone: formData.contact_phone,
      address: formData.address,
      website: formData.website,
      description: formData.description,
      registration_number: formData.registration_number
    }
    createMutation.mutate(submitData)
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      navigate('/onboarding')
    }
  }

  const updateField = (field: keyof VendorCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Vendor name and contact details' },
    { number: 2, title: 'Additional Details', description: 'Website, address, and registration info' },
    { number: 3, title: 'Review', description: 'Review and submit' }
  ]

  if (!user) {
    return (
      <Layout user={null}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <MaterialButton
            variant="text"
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </MaterialButton>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Onboard New Vendor</h1>
          </div>
          <p className="text-gray-600">Add a new vendor to start product and service onboarding workflows</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      currentStep >= step.number
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-medium text-gray-900">{step.title}</div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step.number ? 'bg-orange-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <MaterialCard className="p-6 mb-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
              <MaterialInput
                label="Vendor Name *"
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter vendor company name"
              />
              <MaterialInput
                label="Vendor Coordinator Email *"
                type="email"
                required
                value={formData.contact_email || ''}
                onChange={(e) => updateField('contact_email', e.target.value)}
                placeholder="vendor@example.com"
                helperText="The vendor coordinator will receive a notification email to complete the vendor profile"
              />
              <MaterialInput
                label="Contact Phone"
                type="tel"
                value={formData.contact_phone || ''}
                onChange={(e) => updateField('contact_phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Additional Details</h2>
              <MaterialInput
                label="Website"
                type="url"
                value={formData.website || ''}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://www.example.com"
              />
              <MaterialInput
                label="Address"
                type="text"
                value={formData.address || ''}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street address, City, State, ZIP"
                multiline
                rows={3}
              />
              <MaterialInput
                label="Registration Number"
                type="text"
                value={formData.registration_number || ''}
                onChange={(e) => updateField('registration_number', e.target.value)}
                placeholder="Business registration or tax ID"
              />
              <MaterialInput
                label="Description"
                type="text"
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description of the vendor"
                multiline
                rows={4}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review</h2>
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Vendor Name</div>
                  <div className="text-base text-gray-900">{formData.name || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Contact Email</div>
                  <div className="text-base text-gray-900">{formData.contact_email || 'Not provided'}</div>
                </div>
                {formData.contact_phone && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Contact Phone</div>
                    <div className="text-base text-gray-900">{formData.contact_phone}</div>
                  </div>
                )}
                {formData.website && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Website</div>
                    <div className="text-base text-gray-900">
                      <a href={formData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {formData.website}
                      </a>
                    </div>
                  </div>
                )}
                {formData.address && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Address</div>
                    <div className="text-base text-gray-900">{formData.address}</div>
                  </div>
                )}
                {formData.registration_number && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Registration Number</div>
                    <div className="text-base text-gray-900">{formData.registration_number}</div>
                  </div>
                )}
                {formData.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Description</div>
                    <div className="text-base text-gray-900">{formData.description}</div>
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> After submission, a notification email will be sent to the vendor coordinator. 
                  The vendor profile can be completed by the coordinator, and product onboarding workflows can begin.
                </p>
              </div>
            </div>
          )}
        </MaterialCard>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <MaterialButton
            variant="outlined"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </MaterialButton>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Step {currentStep} of {steps.length}
            </span>
            {currentStep < steps.length ? (
              <MaterialButton
                variant="contained"
                onClick={handleNext}
                disabled={createMutation.isPending}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </MaterialButton>
            ) : (
              <MaterialButton
                variant="contained"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Vendor'}
              </MaterialButton>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
