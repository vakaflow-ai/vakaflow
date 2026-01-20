import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requestTypeConfigApi, RequestTypeConfigCreate, RequestTypeConfig, VisibilityScope } from '../lib/requestTypeConfig'
import { workflowConfigApi, WorkflowConfig, WorkflowConfigCreate } from '../lib/workflowConfig'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { MaterialCard, MaterialButton, MaterialSelect, MaterialInput } from './material'
import StandardModal from './StandardModal'
import { 
  ArrowRight, 
  Plus, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  Layers,
  Workflow,
  FileText,
  Eye,
  Play,
  Save
} from 'lucide-react'
import toast from 'react-hot-toast'

interface UnifiedConfigurationWizardProps {
  onClose: () => void
  onSave?: (config: any) => void
}

interface EntityMapping {
  entityType: string
  requestTypeId?: string
  displayName: string
  description?: string
}

interface WorkflowMapping {
  workflowId?: string
  requestTypeId: string
  formMappings: Array<{
    stage: string
    formLayoutId: string
    isPrimary: boolean
  }>
}

export default function UnifiedConfigurationWizard({ onClose, onSave }: UnifiedConfigurationWizardProps) {
  const queryClient = useQueryClient()
  const [activeStep, setActiveStep] = useState(1)
  
  // Force refresh request types when component mounts
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['request-types'] });
  }, [queryClient]);
  const [entityMappings, setEntityMappings] = useState<EntityMapping[]>([
    { entityType: 'product', displayName: 'Product Onboarding' },
    { entityType: 'service', displayName: 'Service Onboarding' },
    { entityType: 'agent', displayName: 'Agent Onboarding' },
    { entityType: 'vendor', displayName: 'Vendor Submission' },
    { entityType: 'user', displayName: 'User Registration' },
    { entityType: 'assessment', displayName: 'Assessment Workflow' }
  ])
  const [workflowMappings, setWorkflowMappings] = useState<WorkflowMapping[]>([])
  const [selectedEntity, setSelectedEntity] = useState<EntityMapping | null>(null)
  const [selectedRequestType, setSelectedRequestType] = useState<RequestTypeConfig | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null)
  const [availableForms, setAvailableForms] = useState<FormLayout[]>([])
  const [configurationName, setConfigurationName] = useState('')
  const [configurationDescription, setConfigurationDescription] = useState('')

  // Fetch existing request types
  const { data: requestTypes = [], isLoading: requestTypesLoading } = useQuery<RequestTypeConfig[]>({
    queryKey: ['request-types'],
    queryFn: () => requestTypeConfigApi.getAll(),
  })

  // Fetch workflows
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<WorkflowConfig[]>({
    queryKey: ['workflows'],
    queryFn: () => workflowConfigApi.list(),
  })

  // Fetch form library
  const { data: formLibrary = [], isLoading: formsLoading } = useQuery<FormLayout[]>({
    queryKey: ['form-library'],
    queryFn: () => formLayoutsApi.getLibrary(),
  })

  // Sync entity mappings with request types when they load
  useEffect(() => {
    if (requestTypes && requestTypes.length > 0) {
      setEntityMappings(prev => 
        prev.map(em => {
          const matchingRequestType = requestTypes.find(rt => 
            rt.request_type === `${em.entityType}_onboarding_workflow`
          );
          return matchingRequestType 
            ? { ...em, requestTypeId: matchingRequestType.id }
            : em;
        })
      );
    }
  }, [requestTypes]);

  // Create request type mutation
  const createRequestTypeMutation = useMutation({
    mutationFn: (data: RequestTypeConfigCreate) => requestTypeConfigApi.create(data),
    onSuccess: (data) => {
      console.log('Request type created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      toast.success('Request type created successfully')
      // Update the entity mapping with the created request type ID
      setEntityMappings(prev => 
        prev.map(em => 
          em.entityType === data.request_type.replace('_onboarding_workflow', '')
            ? { ...em, requestTypeId: data.id }
            : em
        )
      )
      setSelectedRequestType(data)
    },
    onError: (error: any) => {
      console.error('Failed to create request type:', error);
      toast.error(error.response?.data?.detail || 'Failed to create request type')
    }
  })

  // Create workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: (data: WorkflowConfigCreate) => workflowConfigApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Workflow created successfully')
      setSelectedWorkflow(data)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create workflow')
    }
  })

  // Validate configuration
  const validateConfiguration = () => {
    const errors = []
    
    if (!configurationName.trim()) {
      errors.push('Configuration name is required')
    }
    
    const unmappedEntities = entityMappings.filter(em => !em.requestTypeId)
    if (unmappedEntities.length > 0) {
      errors.push(`${unmappedEntities.length} entities are not mapped to request types`)
    }
    
    const unmappedWorkflows = workflowMappings.filter(wm => !wm.workflowId)
    if (unmappedWorkflows.length > 0) {
      errors.push(`${unmappedWorkflows.length} request types are not mapped to workflows`)
    }
    
    return errors
  }

  const handleCreateRequestType = (entityMapping: EntityMapping) => {
    console.log('Creating request type for:', entityMapping);
    const requestData: RequestTypeConfigCreate = {
      request_type: `${entityMapping.entityType}_onboarding_workflow`,
      display_name: entityMapping.displayName,
      visibility_scope: VisibilityScope.BOTH,
      is_active: true
    }
    
    createRequestTypeMutation.mutate(requestData)
  }

  const handleCreateWorkflow = (requestTypeId: string) => {
    const workflowData: WorkflowConfigCreate = {
      name: `Standard ${selectedEntity?.displayName} Workflow`,
      description: `Default workflow for ${selectedEntity?.displayName?.toLowerCase()}`,
      workflow_engine: 'internal',
      workflow_steps: [
        {
          step_number: 1,
          step_type: 'approval',
          step_name: 'Initial Review',
          assigned_role: 'reviewer',
          required: true,
          can_skip: false,
          auto_assign: true
        },
        {
          step_number: 2,
          step_type: 'approval',
          step_name: 'Final Approval',
          assigned_role: 'approver',
          required: true,
          can_skip: false,
          auto_assign: true
        }
      ],
      status: 'active'
    }
    
    createWorkflowMutation.mutate(workflowData)
  }

  const handleMapWorkflow = (requestTypeId: string, workflowId: string) => {
    setWorkflowMappings(prev => {
      const existing = prev.find(wm => wm.requestTypeId === requestTypeId)
      if (existing) {
        return prev.map(wm => 
          wm.requestTypeId === requestTypeId 
            ? { ...wm, workflowId }
            : wm
        )
      } else {
        return [...prev, { 
          requestTypeId, 
          workflowId,
          formMappings: []
        }]
      }
    })
  }

  const handleMapForm = (requestTypeId: string, stage: string, formLayoutId: string) => {
    setWorkflowMappings(prev => {
      return prev.map(wm => {
        if (wm.requestTypeId === requestTypeId) {
          const existingStage = wm.formMappings.find(fm => fm.stage === stage)
          if (existingStage) {
            return {
              ...wm,
              formMappings: wm.formMappings.map(fm => 
                fm.stage === stage ? { ...fm, formLayoutId } : fm
              )
            }
          } else {
            return {
              ...wm,
              formMappings: [...wm.formMappings, { stage, formLayoutId, isPrimary: true }]
            }
          }
        }
        return wm
      })
    })
  }

  const handleSaveConfiguration = () => {
    const errors = validateConfiguration()
    if (errors.length > 0) {
      toast.error(`Validation errors: ${errors.join(', ')}`)
      return
    }

    const config = {
      name: configurationName,
      description: configurationDescription,
      entityMappings,
      workflowMappings,
      createdAt: new Date().toISOString()
    }

    if (onSave) {
      onSave(config)
    }
    
    toast.success('Configuration saved successfully!')
    onClose()
  }

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'product': return '📦'
      case 'service': return '💼'
      case 'agent': return '🤖'
      case 'vendor': return '🏢'
      case 'user': return '👤'
      case 'assessment': return '📋'
      default: return '📄'
    }
  }

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType) {
      case 'product': return 'bg-blue-100 text-blue-800'
      case 'service': return 'bg-purple-100 text-purple-800'
      case 'agent': return 'bg-green-100 text-green-800'
      case 'vendor': return 'bg-orange-100 text-orange-800'
      case 'user': return 'bg-indigo-100 text-indigo-800'
      case 'assessment': return 'bg-teal-100 text-teal-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <StandardModal
      isOpen={true}
      onClose={onClose}
      title="Unified Configuration Wizard"
      subtitle="Configure end-to-end onboarding workflows for all entity types"
      size="xl"
      isSaving={false}
      onSave={activeStep === 3 ? handleSaveConfiguration : undefined}
      saveButtonText="Save Configuration"
      disableSave={activeStep !== 3 || validateConfiguration().length > 0}
    >

      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-gray-200 -mx-6 -mt-6 mb-6 bg-gray-50">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                activeStep >= step 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              {step < 4 && (
                <div className={`w-16 h-1 mx-2 ${
                  activeStep > step ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between max-w-2xl mx-auto mt-2 text-xs text-gray-600">
          <span>Request Types</span>
          <span>Workflows</span>
          <span>Forms</span>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {activeStep > 1 && (
            <MaterialButton
              variant="outlined"
              onClick={() => setActiveStep(prev => prev - 1)}
              size="small"
            >
              Previous
            </MaterialButton>
          )}
        </div>
        <div>
          {activeStep < 3 && (
            <MaterialButton
              variant="contained"
              onClick={() => {
                console.log('Next button clicked');
                console.log('Active step:', activeStep);
                console.log('Configured entities:', entityMappings.filter(em => em.requestTypeId).length);
                console.log('Entity mappings:', entityMappings);
                setActiveStep(prev => prev + 1);
              }}
              disabled={activeStep === 1 && entityMappings.filter(em => em.requestTypeId).length === 0}
              size="small"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </MaterialButton>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-h-[50vh] overflow-y-auto pr-2">
        {activeStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Entity Type Configuration</h3>
              <p className="text-gray-600 mb-4">
                Select and configure the entity types that will be available in your onboarding hub
              </p>
              <div className="mb-4">
                <MaterialButton
                  variant="outlined"
                  size="small"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['request-types'] })}
                  disabled={requestTypesLoading}
                >
                  {requestTypesLoading ? 'Loading...' : 'Refresh Data'}
                </MaterialButton>
              </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entityMappings.map((entity) => {
                  const requestType = requestTypes.find(rt => rt.request_type === `${entity.entityType}_onboarding_workflow`)
                  return (
                    <MaterialCard key={entity.entityType} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getEntityTypeIcon(entity.entityType)}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">{entity.displayName}</h4>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getEntityTypeColor(entity.entityType)}`}>
                              {entity.entityType}
                            </span>
                          </div>
                        </div>
                        {requestType ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>

                      <div className="space-y-3">
                        <MaterialInput
                          label="Display Name"
                          value={entity.displayName}
                          onChange={(e) => {
                            setEntityMappings(prev => 
                              prev.map(em => 
                                em.entityType === entity.entityType 
                                  ? { ...em, displayName: e.target.value }
                                  : em
                              )
                            )
                          }}
                        />

                        <MaterialInput
                          label="Description"
                          value={entity.description || ''}
                          onChange={(e) => {
                            setEntityMappings(prev => 
                              prev.map(em => 
                                em.entityType === entity.entityType 
                                  ? { ...em, description: e.target.value }
                                  : em
                              )
                            )
                          }}
                        />

                        {!requestType ? (
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            onClick={() => handleCreateRequestType(entity)}
                            loading={createRequestTypeMutation.isPending}
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Request Type
                          </MaterialButton>
                        ) : (
                          <div className="p-2 bg-green-50 rounded text-xs text-green-700">
                            Request type created: {requestType.display_name}
                          </div>
                        )}
                      </div>
                    </MaterialCard>
                  )
                })}
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Request Type to Workflow Mapping</h3>
                <p className="text-gray-600 mb-4">
                  Map each request type to an appropriate workflow template
                </p>
              </div>

              <div className="space-y-4">
                {entityMappings
                  .filter(em => em.requestTypeId)
                  .map((entity) => {
                    const requestType = requestTypes.find(rt => rt.id === entity.requestTypeId)
                    const workflowMapping = workflowMappings.find(wm => wm.requestTypeId === entity.requestTypeId)
                    const workflow = workflows.find(w => w.id === workflowMapping?.workflowId)

                    return (
                      <MaterialCard key={entity.entityType} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getEntityTypeIcon(entity.entityType)}</span>
                            <div>
                              <h4 className="font-medium text-gray-900">{entity.displayName}</h4>
                              <p className="text-sm text-gray-600">{requestType?.display_name}</p>
                            </div>
                          </div>
                          
                          {workflow ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="w-5 h-5" />
                              <span className="text-sm">{workflow.name}</span>
                            </div>
                          ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select Workflow
                            </label>
                            <MaterialSelect
                              value={workflowMapping?.workflowId || ''}
                              onChange={(e) => handleMapWorkflow(entity.requestTypeId!, e.target.value)}
                              options={[
                                { value: '', label: 'Select a workflow...' },
                                ...workflows.map(w => ({ value: w.id, label: w.name })),
                                { value: 'create-new', label: '+ Create New Workflow' }
                              ]}
                            />
                          </div>

                          {!workflow && (
                            <div className="flex items-end">
                              <MaterialButton
                                variant="outlined"
                                size="small"
                                onClick={() => handleCreateWorkflow(entity.requestTypeId!)}
                                loading={createWorkflowMutation.isPending}
                                className="w-full"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Default Workflow
                              </MaterialButton>
                            </div>
                          )}
                        </div>
                      </MaterialCard>
                    )
                  })}
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Form Library & Stage Mapping</h3>
                <p className="text-gray-600 mb-4">
                  Assign forms to workflow stages for each request type
                </p>
              </div>

              <div className="space-y-6">
                {workflowMappings
                  .filter(wm => wm.workflowId)
                  .map((mapping) => {
                    const entity = entityMappings.find(em => em.requestTypeId === mapping.requestTypeId)
                    const requestType = requestTypes.find(rt => rt.id === mapping.requestTypeId)
                    const workflow = workflows.find(w => w.id === mapping.workflowId)

                    return (
                      <MaterialCard key={mapping.requestTypeId} className="p-4">
                        <div className="mb-4">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">{entity ? getEntityTypeIcon(entity.entityType) : '📄'}</span>
                            <div>
                              <h4 className="font-medium text-gray-900">{entity?.displayName}</h4>
                              <p className="text-sm text-gray-600">
                                {requestType?.display_name} → {workflow?.name}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Submission Stage */}
                          <div className="border rounded-lg p-3">
                            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Submission Stage
                            </h5>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Submission Form
                              </label>
                              <MaterialSelect
                                value={mapping.formMappings.find(fm => fm.stage === 'submission')?.formLayoutId || ''}
                                onChange={(e) => handleMapForm(mapping.requestTypeId, 'submission', e.target.value)}
                                options={[
                                  { value: '', label: 'Select form...' },
                                  ...formLibrary
                                    .filter(f => f.layout_type === 'submission')
                                    .map(f => ({ value: f.id, label: f.name }))
                                ]}
                              />
                            </div>
                          </div>

                          {/* Approval Stage */}
                          <div className="border rounded-lg p-3">
                            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Approval Stage
                            </h5>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Approval Form
                              </label>
                              <MaterialSelect
                                value={mapping.formMappings.find(fm => fm.stage === 'approval')?.formLayoutId || ''}
                                onChange={(e) => handleMapForm(mapping.requestTypeId, 'approval', e.target.value)}
                                options={[
                                  { value: '', label: 'Select form...' },
                                  ...formLibrary
                                    .filter(f => f.layout_type === 'approver')
                                    .map(f => ({ value: f.id, label: f.name }))
                                ]}
                              />
                            </div>
                          </div>
                        </div>
                      </MaterialCard>
                    )
                  })}
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration Summary</h3>
                <p className="text-gray-600 mb-4">
                  Review and save your complete onboarding configuration
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <MaterialCard className="p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Layers className="w-5 h-5" />
                      Configuration Details
                    </h4>
                    
                    <div className="space-y-3">
                      <MaterialInput
                        label="Configuration Name *"
                        value={configurationName}
                        onChange={(e) => setConfigurationName(e.target.value)}
                        placeholder="e.g., Enterprise Onboarding Suite"
                      />
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={configurationDescription}
                          onChange={(e) => setConfigurationDescription(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          placeholder="Describe this configuration..."
                        />
                      </div>
                    </div>
                  </MaterialCard>

                  <MaterialCard className="p-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Configuration Status
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Entities Configured:</span>
                        <span className="font-medium">
                          {entityMappings.filter(em => em.requestTypeId).length}/{entityMappings.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Workflows Mapped:</span>
                        <span className="font-medium">
                          {workflowMappings.filter(wm => wm.workflowId).length}/{workflowMappings.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Forms Assigned:</span>
                        <span className="font-medium">
                          {workflowMappings.reduce((acc, wm) => acc + wm.formMappings.length, 0)} forms
                        </span>
                      </div>
                    </div>
                  </MaterialCard>
                </div>

                <div>
                  <MaterialCard className="p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Workflow className="w-5 h-5" />
                      Workflow Overview
                    </h4>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {entityMappings
                        .filter(em => em.requestTypeId)
                        .map((entity) => {
                          const requestType = requestTypes.find(rt => rt.id === entity.requestTypeId)
                          const workflowMapping = workflowMappings.find(wm => wm.requestTypeId === entity.requestTypeId)
                          const workflow = workflows.find(w => w.id === workflowMapping?.workflowId)
                          
                          return (
                            <div key={entity.entityType} className="p-3 bg-gray-50 rounded border">
                              <div className="flex items-center gap-2 mb-2">
                                <span>{getEntityTypeIcon(entity.entityType)}</span>
                                <span className="font-medium text-sm">{entity.displayName}</span>
                              </div>
                              
                              <div className="text-xs text-gray-600 space-y-1">
                                <div>Request Type: {requestType?.display_name}</div>
                                <div>Workflow: {workflow?.name || 'Not mapped'}</div>
                                {workflowMapping && (
                                  <div>
                                    Forms: {workflowMapping.formMappings.length} assigned
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </MaterialCard>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Validation Errors */}
      {validateConfiguration().length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm font-medium text-red-800 mb-2">Please fix the following issues:</p>
          <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
            {validateConfiguration().map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </StandardModal>
  )
}