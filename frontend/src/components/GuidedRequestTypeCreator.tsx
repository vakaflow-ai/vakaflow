import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SimpleFormLoader from './SimpleFormLoader'
import { MaterialButton, MaterialCard, MaterialInput, MaterialSelect, MaterialChip } from '../components/material'
import { requestTypeConfigApi, RequestTypeConfigCreate, RequestTypeConfigUpdate, VisibilityScope } from '../lib/requestTypeConfig'
import { workflowConfigApi, WorkflowConfig, WorkflowConfigCreate } from '../lib/workflowConfig'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { showToast } from '../utils/toast'
import { REQUEST_TYPE_CONFIG } from '../config/appConfig'
import StandardModal from './StandardModal'
import { ChevronLeft, ChevronRight, CheckCircle, Plus, X } from 'lucide-react'

interface GuidedRequestTypeCreatorProps {
  onClose: () => void
  initialData?: any
  onSubmit?: (data: any) => void
}

interface FormData {
  // Step 1: Basic Info
  name: string
  description: string
  visibility: VisibilityScope
  entityId: string
  actionType: string  // New: Configurable action type
  customActionTypeName: string  // For custom action types
  
  // Step 2: Attributes
  attributes: any[]
  
  // Step 3: Workflow
  workflowId: string
  createNewWorkflow: boolean
  workflowName: string
  workflowDescription: string
  
  // Step 4: Forms
  submissionFormId: string
  approvalFormId: string
  createNewForms: boolean
}

const ENTITIES = [
  { id: 'product', name: 'Product', icon: '📦' },
  { id: 'service', name: 'Service', icon: '💼' },
  { id: 'agent', name: 'Agent', icon: '🤖' },
  { id: 'vendor', name: 'Vendor', icon: '🏢' },
  { id: 'user', name: 'User', icon: '👤' },
  { id: 'assessment', name: 'Assessment', icon: '📋' }
]

const ATTRIBUTE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' }
]

export default function GuidedRequestTypeCreator({ onClose, initialData, onSubmit }: GuidedRequestTypeCreatorProps) {
  console.log('[GuidedRequestTypeCreator] Component rendered with initialData:', initialData);
  const queryClient = useQueryClient()
  
  // Force invalidate forms cache on mount
  useEffect(() => {
    console.log('[GuidedRequestTypeCreator] Invalidating forms cache');
    queryClient.invalidateQueries({ queryKey: ['form-layouts'] });
  }, [queryClient]);
  
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    // Initialize with initialData if editing
    name: initialData?.display_name || '',
    description: initialData?.description || '',
    visibility: initialData?.visibility_scope || VisibilityScope.BOTH,
    entityId: initialData ? initialData.request_type.replace('_onboarding_workflow', '') : '',
    actionType: REQUEST_TYPE_CONFIG.defaultActionType,
    customActionTypeName: '',
    attributes: [],
    workflowId: initialData?.workflow_id || '',
    createNewWorkflow: false,
    workflowName: '',
    workflowDescription: '',
    submissionFormId: '',
    approvalFormId: '',
    createNewForms: false
  })

  // Fetch existing workflows and forms
  const { data: workflows = [] } = useQuery<WorkflowConfig[]>({
    queryKey: ['workflows'],
    queryFn: () => workflowConfigApi.list(),
    staleTime: 5 * 60 * 1000
  })

  const { data: forms = [], isLoading: formsLoading, error: formsError } = useQuery<FormLayout[]>({
    queryKey: ['form-layouts-library'], // Simplified key
    queryFn: () => formLayoutsApi.getLibrary(),
    staleTime: 0,
    gcTime: 0
  })
  
  // Debug logging
  console.log('[GuidedRequestTypeCreator] Forms state:', { 
    forms: Array.isArray(forms) ? forms.length : 'not array', 
    loading: formsLoading, 
    error: formsError 
  });

  // Load existing form associations when editing
  const { data: formAssociations = [] } = useQuery({
    queryKey: ['request-type-forms', initialData?.id],
    queryFn: async () => {
      if (!initialData?.id) return [];
      
      try {
        // Use the authenticated API client instead of raw fetch
        const response = await requestTypeConfigApi.getAssociatedForms(initialData.id);
        return response;
      } catch (error) {
        console.error('Error fetching form associations:', error);
        return [];
      }
    },
    enabled: !!initialData?.id
  });

  // Update formData when form associations are loaded
  useEffect(() => {
    if (Array.isArray(formAssociations) && formAssociations.length > 0 && initialData?.id && Array.isArray(forms) && forms.length > 0) {
      const submissionAssoc = formAssociations.find((assoc: any) => assoc.form_variation_type === 'submission');
      const approvalAssoc = formAssociations.find((assoc: any) => assoc.form_variation_type === 'approval');
      
      // Match forms by name instead of ID (due to bridge solution creating new IDs)
      const submissionForm = forms.find((form: any) => form.name === submissionAssoc?.form_name);
      const approvalForm = forms.find((form: any) => form.name === approvalAssoc?.form_name);
      
      const newSubmissionId = submissionForm?.id || submissionAssoc?.form_layout_id || '';
      const newApprovalId = approvalForm?.id || approvalAssoc?.form_layout_id || '';
      
      setFormData(prev => ({
        ...prev,
        submissionFormId: newSubmissionId,
        approvalFormId: newApprovalId
      }));
    }
  }, [formAssociations, forms]); // Simplified dependencies

  // Mutations
  const createRequestTypeMutation = useMutation({
    mutationFn: (data: RequestTypeConfigCreate) => requestTypeConfigApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      showToast.success('Request type created successfully')
      if (onSubmit) onSubmit(data)
      onClose()
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to create request type')
    }
  })

  const updateRequestTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RequestTypeConfigUpdate }) => 
      requestTypeConfigApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      showToast.success('Request type updated successfully')
      if (onSubmit) onSubmit(data)
      onClose()
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to update request type')
    }
  })

  const createWorkflowMutation = useMutation({
    mutationFn: (data: WorkflowConfigCreate) => workflowConfigApi.create(data),
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      showToast.success('Workflow created successfully')
      setFormData(prev => ({ ...prev, workflowId: workflow.id }))
    },
    onError: (error: any) => {
      showToast.error(error.response?.data?.detail || 'Failed to create workflow')
    }
  })

  // Navigation handlers
  const nextStep = () => {
    if (step < 4) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = () => {
    // Create workflow if needed
    if (formData.createNewWorkflow && formData.workflowName) {
      createWorkflowMutation.mutate({
        name: formData.workflowName,
        description: formData.workflowDescription
        // Note: Steps will need to be configured separately
      })
    }
    
    // Check if we're editing or creating
    const isEditing = !!initialData?.id;
    
    if (isEditing) {
      // Update existing request type
      const updateData: RequestTypeConfigUpdate = {
        display_name: formData.name,
        visibility_scope: formData.visibility,
        is_active: true
      }
      
      // Only include workflow_id if it's been set
      if (formData.workflowId) {
        updateData.workflow_id = formData.workflowId
      }
      
      // Include form associations for updates too
      const formAssociations = [];
      if (formData.submissionFormId) {
        formAssociations.push({
          form_layout_id: formData.submissionFormId,
          display_order: 0,
          is_primary: true,
          form_variation_type: 'submission'
        });
      }
      if (formData.approvalFormId) {
        formAssociations.push({
          form_layout_id: formData.approvalFormId,
          display_order: 1,
          is_primary: false,
          form_variation_type: 'approval'
        });
      }
      
      // Add form associations to update data
      if (formAssociations.length > 0) {
        (updateData as any).form_associations = formAssociations;
      }
      
      updateRequestTypeMutation.mutate({
        id: initialData.id,
        data: updateData
      })
    } else {
      // Validate required fields for creation
      if (!formData.entityId) {
        showToast.error('Entity type is required for new request types')
        return
      }
      
      if (!formData.actionType) {
        showToast.error('Action type is required for new request types')
        return
      }
      
      // Generate request_type using configuration-driven approach
      let requestTypeSuffix = formData.actionType;
      if (formData.actionType === 'custom' && formData.customActionTypeName) {
        requestTypeSuffix = formData.customActionTypeName.toLowerCase().replace(/\s+/g, '_');
      }
      
      const requestType = `${formData.entityId}_${requestTypeSuffix}`;
      
      // Validate the generated request type
      const validation = REQUEST_TYPE_CONFIG.validation;
      if (requestType.length < validation.minLength || requestType.length > validation.maxLength) {
        showToast.error(`Request type must be between ${validation.minLength} and ${validation.maxLength} characters`)
        return
      }
      
      if (!validation.allowedCharacters.test(requestType)) {
        showToast.error('Request type can only contain letters, numbers, hyphens, and underscores')
        return
      }
      
      if (validation.reservedWords.includes(requestType.toLowerCase())) {
        showToast.error('Request type uses a reserved word')
        return
      }
      
      // Create new request type
      const requestData: any = {
        request_type: requestType,
        display_name: formData.name,
        visibility_scope: formData.visibility,
        description: formData.description || undefined,
        is_active: true
      }
      
      // Only include workflow_id if it's been set
      if (formData.workflowId) {
        requestData.workflow_id = formData.workflowId
      }
      
      // Include form associations if forms are selected
      const formAssociations = [];
      if (formData.submissionFormId) {
        formAssociations.push({
          form_layout_id: formData.submissionFormId,
          display_order: 0,
          is_primary: true,
          form_variation_type: 'submission'
        });
      }
      if (formData.approvalFormId) {
        formAssociations.push({
          form_layout_id: formData.approvalFormId,
          display_order: 1,
          is_primary: false,
          form_variation_type: 'approval'
        });
      }
      
      // Add form associations to request data
      if (formAssociations.length > 0) {
        requestData.form_associations = formAssociations;
      }
      
      createRequestTypeMutation.mutate(requestData)
    }
  }

  const addAttribute = () => {
    setFormData(prev => ({
      ...prev,
      attributes: [...prev.attributes, {
        id: Date.now().toString(),
        name: '',
        type: 'text',
        required: false,
        description: ''
      }]
    }))
  }

  const removeAttribute = (id: string) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.filter(attr => attr.id !== id)
    }))
  }

  const updateAttribute = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.map(attr =>
        attr.id === id ? { ...attr, [field]: value } : attr
      )
    }))
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((num) => (
        <div key={num} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= num 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            {step > num ? <CheckCircle className="w-4 h-4" /> : num}
          </div>
          {num < 4 && (
            <div className={`w-16 h-1 mx-2 ${
              step > num ? 'bg-blue-600' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  )

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
            <p className="text-gray-600">Start by defining the basic details of your request type.</p>
            
            <MaterialInput
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Product Onboarding"
            />
            
            <MaterialSelect
              label="Entity Type *"
              value={formData.entityId}
              onChange={(e) => setFormData({...formData, entityId: e.target.value})}
              options={[
                { value: '', label: 'Select entity type...' },
                ...ENTITIES.map(entity => ({
                  value: entity.id,
                  label: `${entity.icon} ${entity.name}`
                }))
              ]}
              disabled={!!initialData?.id}
            />
            {initialData?.id && (
              <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
            )}
            
            <MaterialSelect
              label="Action Type *"
              value={formData.actionType}
              onChange={(e) => setFormData({...formData, actionType: e.target.value, customActionTypeName: ''})}
              options={[
                { value: '', label: 'Select action type...' },
                ...REQUEST_TYPE_CONFIG.actionTypes.map(action => ({
                  value: action.id,
                  label: `${action.name} - ${action.description}`
                })),
                { value: 'custom', label: 'Custom Action Type...' }
              ]}
              disabled={!!initialData?.id}
            />
            
            {formData.actionType === 'custom' && (
              <MaterialInput
                label="Custom Action Type Name *"
                value={formData.customActionTypeName}
                onChange={(e) => setFormData({...formData, customActionTypeName: e.target.value})}
                placeholder="e.g., renewal, audit, maintenance"
                helperText="Enter a custom action type name"
              />
            )}

            <MaterialInput
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Brief description of this request type"
              multiline
              rows={3}
            />

            <MaterialSelect
              label="Visibility Scope"
              value={formData.visibility}
              onChange={(e) => setFormData({...formData, visibility: e.target.value as VisibilityScope})}
              options={[
                { value: VisibilityScope.BOTH, label: 'Both Portals' },
                { value: VisibilityScope.INTERNAL, label: 'Internal Only' },
                { value: VisibilityScope.EXTERNAL, label: 'External Only' }
              ]}
            />
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Custom Attributes</h2>
            <p className="text-gray-600">Define custom fields that will be collected for this request type.</p>
            
            <div className="space-y-4">
              {formData.attributes.map((attr) => (
                <MaterialCard key={attr.id} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MaterialInput
                      label="Field Name *"
                      value={attr.name}
                      onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                      placeholder="e.g., priority"
                    />
                    
                    <MaterialSelect
                      label="Type *"
                      value={attr.type}
                      onChange={(e) => updateAttribute(attr.id, 'type', e.target.value)}
                      options={ATTRIBUTE_TYPES}
                    />
                    
                    <MaterialInput
                      label="Description"
                      value={attr.description}
                      onChange={(e) => updateAttribute(attr.id, 'description', e.target.value)}
                      placeholder="Field description"
                    />
                    
                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={attr.required}
                          onChange={(e) => updateAttribute(attr.id, 'required', e.target.checked)}
                          className="mr-2"
                        />
                        Required Field
                      </label>
                      <button
                        onClick={() => removeAttribute(attr.id)}
                        className="ml-auto text-red-500 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </MaterialCard>
              ))}
              
              <button
                onClick={addAttribute}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Attribute
              </button>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Workflow Configuration</h2>
            <p className="text-gray-600">Select or create a workflow to process requests of this type.</p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="radio"
                  id="existing-workflow"
                  name="workflow-option"
                  checked={!formData.createNewWorkflow}
                  onChange={() => setFormData({...formData, createNewWorkflow: false})}
                  className="w-4 h-4"
                />
                <label htmlFor="existing-workflow" className="text-gray-700">
                  Use existing workflow
                </label>
              </div>
              
              {!formData.createNewWorkflow && (
                <MaterialSelect
                  label="Select Workflow"
                  value={formData.workflowId}
                  onChange={(e) => setFormData({...formData, workflowId: e.target.value})}
                  options={[
                    { value: '', label: 'Select a workflow...' },
                    ...workflows.map(workflow => ({
                      value: workflow.id,
                      label: workflow.name
                    }))
                  ]}
                />
              )}
              
              <div className="border-t pt-4">
                <div className="flex items-center gap-4">
                  <input
                    type="radio"
                    id="new-workflow"
                    name="workflow-option"
                    checked={formData.createNewWorkflow}
                    onChange={() => setFormData({...formData, createNewWorkflow: true})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="new-workflow" className="text-gray-700">
                    Create new workflow
                  </label>
                </div>
              </div>
              
              {formData.createNewWorkflow && (
                <div className="space-y-4 pl-8">
                  <MaterialInput
                    label="Workflow Name *"
                    value={formData.workflowName}
                    onChange={(e) => setFormData({...formData, workflowName: e.target.value})}
                    placeholder="e.g., Standard Approval Process"
                  />
                  
                  <MaterialInput
                    label="Description"
                    value={formData.workflowDescription}
                    onChange={(e) => setFormData({...formData, workflowDescription: e.target.value})}
                    placeholder="Describe the workflow process"
                    multiline
                    rows={2}
                  />
                </div>
              )}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Form Assignment</h2>
            <p className="text-gray-600">Assign forms to different stages of the workflow.</p>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Submission Form</h3>
                <MaterialSelect
                  label="Select Form for New Submissions"
                  value={formData.submissionFormId}
                  onChange={(e) => setFormData({...formData, submissionFormId: e.target.value})}
                  options={[
                    { value: '', label: 'Select submission form...' },
                    ...forms.map(form => ({
                      value: form.id,
                      label: form.name
                    }))
                  ]}
                />
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Approval Form</h3>
                <MaterialSelect
                  label="Select Form for Approvals"
                  value={formData.approvalFormId}
                  onChange={(e) => setFormData({...formData, approvalFormId: e.target.value})}
                  options={[
                    { value: '', label: 'Select approval form...' },
                    ...forms.map(form => ({
                      value: form.id,
                      label: form.name
                    }))
                  ]}
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <StandardModal
      isOpen={true}
      onClose={onClose}
      title={initialData?.id ? 'Edit Request Type' : 'Create Request Type'}
      subtitle="Follow the guided steps to configure your request type"
      size="xl"
      isSaving={createRequestTypeMutation.isPending || updateRequestTypeMutation.isPending}
      onSave={step === 4 ? handleSubmit : undefined}
      saveButtonText={
        initialData?.id 
          ? (updateRequestTypeMutation.isPending ? 'Updating...' : 'Update Request Type')
          : (createRequestTypeMutation.isPending ? 'Creating...' : 'Complete Setup')
      }
      disableSave={
        !formData.name.trim() || 
        (!initialData?.id && (!formData.entityId || !formData.actionType || 
                             (formData.actionType === 'custom' && !formData.customActionTypeName.trim()))) ||
        (step === 3 && formData.createNewWorkflow && !formData.workflowName.trim()) ||
        (step < 4)
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <MaterialButton
            variant="outlined"
            onClick={prevStep}
            disabled={step === 1}
            startIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </MaterialButton>
          
          {step < 4 ? (
            <MaterialButton
              variant="contained"
              onClick={nextStep}
              disabled={
                step === 1 && (!formData.name.trim() || !formData.entityId || !formData.actionType || 
                             (formData.actionType === 'custom' && !formData.customActionTypeName.trim())) ||
                step === 3 && formData.createNewWorkflow && !formData.workflowName.trim()
              }
              endIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </MaterialButton>
          ) : (
            <MaterialButton
              variant="contained"
              onClick={handleSubmit}
              disabled={
                !formData.name.trim() || 
                (!initialData?.id && !formData.entityId) ||
                (initialData?.id ? updateRequestTypeMutation.isPending : createRequestTypeMutation.isPending)
              }
              startIcon={<CheckCircle className="w-4 h-4" />}
            >
              {initialData?.id 
                ? (updateRequestTypeMutation.isPending ? 'Updating...' : 'Update Request Type')
                : (createRequestTypeMutation.isPending ? 'Creating...' : 'Complete Setup')
              }
            </MaterialButton>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          {renderStepIndicator()}
        </div>
        
        {/* Current Step Content */}
        {renderStepContent()}
      </div>
    </StandardModal>
  )
}