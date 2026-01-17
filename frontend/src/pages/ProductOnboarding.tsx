import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/auth'
import { productsApi, ProductCreate } from '../lib/products'
import { vendorsApi } from '../lib/vendors'
import { usersApi } from '../lib/users'
import { masterDataListsApi } from '../lib/masterDataLists'
import Layout from '../components/Layout'
import PageContainer, { PageHeader } from '../components/PageContainer'
import OnboardingSidebar from '../components/OnboardingSidebar'
import OnboardingWorkflowPanel from '../components/OnboardingWorkflowPanel'
import { MaterialCard, MaterialButton } from '../components/material'
import { ArrowLeft, ArrowRight, Check, Package } from 'lucide-react'
import toast from 'react-hot-toast'

const PRODUCT_TYPES = [
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'saas', label: 'SaaS' },
  { value: 'platform', label: 'Platform' },
  { value: 'tool', label: 'Tool' },
  { value: 'other', label: 'Other' }
]

const CATEGORIES = [
  { value: 'security', label: 'Security' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'automation', label: 'Automation' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'communication', label: 'Communication' },
  { value: 'other', label: 'Other' }
]

const PRICING_MODELS = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'one-time', label: 'One-time' },
  { value: 'usage-based', label: 'Usage-based' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'other', label: 'Other' }
]

export default function ProductOnboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<ProductCreate>>({
    status: 'draft'
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Fetch vendors - different endpoints for different user roles
  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', user?.role],
    queryFn: async () => {
      // Vendor users get their own vendor via /vendors/me
      if (user?.role === 'vendor_user' || user?.role === 'vendor_coordinator') {
        try {
          const myVendor = await vendorsApi.getMyVendor()
          return [myVendor] // Return as array for consistency
        } catch (error) {
          console.error('Error fetching my vendor:', error)
          return []
        }
      } else {
        // Tenant admins get all vendors via /vendors/list
        return await vendorsApi.list()
      }
    },
    enabled: !!user
  })

  // Auto-select vendor for vendor users
  useEffect(() => {
    if (vendors && vendors.length > 0 && !formData.vendor_id) {
      // For vendor users, auto-select their vendor
      if (user?.role === 'vendor_user' || user?.role === 'vendor_coordinator') {
        setFormData(prev => ({ ...prev, vendor_id: vendors[0].id }))
      }
    }
  }, [vendors, user])

  // Fetch users for owner dropdown (must be before early return)
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: !!user
  })

  // Fetch departments and business units from master data (must be before early return)
  const { data: departmentValues } = useQuery({
    queryKey: ['master-data-departments'],
    queryFn: () => masterDataListsApi.getValuesByType('department').catch(() => []),
    enabled: !!user
  })

  const { data: businessUnitValues } = useQuery({
    queryKey: ['master-data-business-unit'],
    queryFn: () => masterDataListsApi.getValuesByType('business_unit').catch(() => []),
    enabled: !!user
  })

  // Get departments list
  const departments = departmentValues && departmentValues.length > 0
    ? departmentValues.filter((v: any) => v.is_active !== false).map((v: any) => v.value || v.label)
    : (users ? [...new Set(users.map(u => u.department).filter(Boolean))] : [])

  // Get business units list
  const businessUnits = businessUnitValues && businessUnitValues.length > 0
    ? businessUnitValues.filter((v: any) => v.is_active !== false).map((v: any) => v.value || v.label)
    : []

  const createMutation = useMutation({
    mutationFn: (data: ProductCreate) => productsApi.create(data),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created successfully')
      navigate(`/products/${product.id}`)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to create product')
    }
  })

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.product_type || !formData.vendor_id) {
        toast.error('Please fill in all required fields')
        return
      }
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.product_type || !formData.vendor_id) {
      toast.error('Please fill in all required fields')
      return
    }
    // Map metadata to extra_metadata for backend
    const submitData: ProductCreate = {
      ...formData,
      extra_metadata: formData.metadata || {}
    } as any
    createMutation.mutate(submitData)
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      navigate('/onboarding')
    }
  }

  const updateField = (field: keyof ProductCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Product name and type' },
    { number: 2, title: 'Business Information', description: 'Owner, department, and business details' },
    { number: 3, title: 'Additional Details', description: 'Product details and support info' },
    { number: 4, title: 'Review', description: 'Review and submit' }
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
      <PageContainer maxWidth="full">
        <PageHeader
          title="Onboard New Product"
          subtitle="Add a new product for qualification and assessment"
          backButton={true}
          backUrl="/onboarding"
        />

        {/* Three-column layout: Left Sidebar | Main Content | Right Panel */}
        <div className="flex gap-6">
          {/* Left Sidebar - User & Metadata Info */}
          <OnboardingSidebar
            user={user}
            formData={formData}
            entityType="product"
            vendors={vendors}
            users={users}
          />

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Progress Steps - Simplified horizontal */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                          currentStep >= step.number
                            ? 'bg-blue-600 text-white'
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
                        <div className={`text-sm font-medium ${
                          currentStep >= step.number ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{step.description}</div>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 transition-colors ${
                          currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Content */}
            <MaterialCard className="p-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor <span className="text-red-500">*</span>
                </label>
                {vendorsLoading ? (
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-500">Loading vendors...</p>
                  </div>
                ) : vendors && vendors.length > 0 ? (
                  <select
                    value={formData.vendor_id || ''}
                    onChange={(e) => updateField('vendor_id', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={user?.role === 'vendor_user' || user?.role === 'vendor_coordinator'}
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-500">No vendors available. Please create a vendor first.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.product_type || ''}
                  onChange={(e) => updateField('product_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select product type</option>
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter product description"
                />
              </div>
            </div>
          )}

          {/* Step 2: Business Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Owner
                </label>
                <select
                  value={(formData.metadata as any)?.owner_id || ''}
                  onChange={(e) => {
                    const metadata = formData.metadata || {}
                    updateField('metadata', { ...metadata, owner_id: e.target.value || null })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select owner</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    value={(formData.metadata as any)?.department || ''}
                    onChange={(e) => {
                      const metadata = formData.metadata || {}
                      updateField('metadata', { ...metadata, department: e.target.value })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Unit
                  </label>
                  <select
                    value={(formData.metadata as any)?.business_unit || ''}
                    onChange={(e) => {
                      const metadata = formData.metadata || {}
                      updateField('metadata', { ...metadata, business_unit: e.target.value })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select business unit</option>
                    {businessUnits.map((bu) => (
                      <option key={bu} value={bu}>
                        {bu}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Contact Email
                </label>
                <input
                  type="email"
                  value={(formData.metadata as any)?.support_email || ''}
                  onChange={(e) => {
                    const metadata = formData.metadata || {}
                    updateField('metadata', { ...metadata, support_email: e.target.value })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="support@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Contact Phone
                </label>
                <input
                  type="tel"
                  value={(formData.metadata as any)?.support_phone || ''}
                  onChange={(e) => {
                    const metadata = formData.metadata || {}
                    updateField('metadata', { ...metadata, support_phone: e.target.value })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1-555-123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Documentation URL
                </label>
                <input
                  type="url"
                  value={(formData.metadata as any)?.support_docs_url || ''}
                  onChange={(e) => {
                    const metadata = formData.metadata || {}
                    updateField('metadata', { ...metadata, support_docs_url: e.target.value })
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://docs.example.com"
                />
              </div>
            </div>
          )}

          {/* Step 3: Additional Details */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Version
                  </label>
                  <input
                    type="text"
                    value={formData.version || ''}
                    onChange={(e) => updateField('version', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 1.0.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => updateField('sku', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Product SKU"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing Model
                </label>
                <select
                  value={formData.pricing_model || ''}
                  onChange={(e) => updateField('pricing_model', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select pricing model</option>
                  {PRICING_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => updateField('website', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory
                </label>
                <input
                  type="text"
                  value={formData.subcategory || ''}
                  onChange={(e) => updateField('subcategory', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Product subcategory"
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Review your product information. After submission, a qualification workflow will be automatically triggered if a matching workflow is found.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Product Name</label>
                    <p className="text-gray-900 font-medium">{formData.name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Product Type</label>
                    <p className="text-gray-900">{formData.product_type || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <p className="text-gray-900">{formData.category || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Version</label>
                    <p className="text-gray-900">{formData.version || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Pricing Model</label>
                    <p className="text-gray-900">{formData.pricing_model || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">SKU</label>
                    <p className="text-gray-900">{formData.sku || '-'}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Business Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Owner</label>
                      <p className="text-gray-900">
                        {(() => {
                          const ownerId = (formData.metadata as any)?.owner_id
                          const owner = users?.find(u => u.id === ownerId)
                          return owner ? `${owner.name} (${owner.email})` : '-'
                        })()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Department</label>
                      <p className="text-gray-900">{(formData.metadata as any)?.department || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Business Unit</label>
                      <p className="text-gray-900">{(formData.metadata as any)?.business_unit || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Support Email</label>
                      <p className="text-gray-900">{(formData.metadata as any)?.support_email || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Support Phone</label>
                      <p className="text-gray-900">{(formData.metadata as any)?.support_phone || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Support Docs URL</label>
                      <p className="text-gray-900">
                        {(formData.metadata as any)?.support_docs_url ? (
                          <a href={(formData.metadata as any).support_docs_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {(formData.metadata as any).support_docs_url}
                          </a>
                        ) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
                {formData.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-gray-900">{formData.description}</p>
                  </div>
                )}
                {formData.website && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Website</label>
                    <p className="text-gray-900">
                      <a href={formData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {formData.website}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <MaterialButton
                  variant="outlined"
                  onClick={handleBack}
                >
                  {currentStep === 1 ? 'Cancel' : 'Back'}
                </MaterialButton>
                <MaterialButton
                  variant="contained"
                  onClick={handleNext}
                  disabled={createMutation.isPending}
                >
                  {currentStep === 4 ? (
                    createMutation.isPending ? 'Creating...' : 'Create Product'
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </MaterialButton>
              </div>
            </MaterialCard>
          </div>

          {/* Right Panel - Workflow/Step Info */}
          <OnboardingWorkflowPanel
            currentStep={currentStep}
            totalSteps={steps.length}
            steps={steps}
            entityType="product"
          />
        </div>
      </PageContainer>
    </Layout>
  )
}
