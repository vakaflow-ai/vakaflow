import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowConfigApi, WorkflowConfig, WorkflowConfigCreate, WorkflowStep, OnboardingRequest, ApproverGroup, TriggerRules } from '../lib/workflowConfig'
import { integrationsApi } from '../lib/integrations'
import { authApi } from '../lib/auth'
import { agentsApi } from '../lib/agents'
import { auditApi } from '../lib/audit'
import { messagesApi } from '../lib/messages'
import { workflowActionsApi } from '../lib/workflowActions'
import { usersApi } from '../lib/users'
import Layout from '../components/Layout'
import WorkflowBuilder from '../components/WorkflowBuilder'
import WorkflowFlowchart from '../components/WorkflowFlowchart'
import StageSettingsModal from '../components/StageSettingsModal'
import MermaidDiagram from '../components/MermaidDiagram'
import { MaterialCard, MaterialButton, MaterialChip } from '../components/material'
import { Edit2, Trash2, GitBranch, ChevronDown, ChevronRight, Copy, CheckSquare, Square } from 'lucide-react'
import { formLayoutsApi } from '../lib/formLayouts'
import { useDialogContext } from '../contexts/DialogContext'
import { showToast } from '../utils/toast'

export default function WorkflowManagement() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const queryClient = useQueryClient()
  const dialog = useDialogContext()
  const [user, setUser] = useState<any>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<WorkflowConfig | null>(null)
  const [activeTab, setActiveTab] = useState<'workflows' | 'requests'>('workflows')
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [showStepDetails, setShowStepDetails] = useState(false)
  const [showStageSettings, setShowStageSettings] = useState(false)
  const [stepForSettings, setStepForSettings] = useState<WorkflowStep | null>(null)
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null)
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null)
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [formData, setFormData] = useState<WorkflowConfigCreate>({
    name: '',
    description: '',
    workflow_engine: 'internal',
    integration_id: undefined,
    workflow_steps: [],
    assignment_rules: {
      approver_selection: 'role_based',
      reviewer_auto_assign: true
    },
    conditions: {
      priority: 1
    },
    trigger_rules: {
      match_all: false
    },
    is_default: false,
    status: 'draft'
  })
  const [newStep, setNewStep] = useState<Partial<WorkflowStep>>({
    step_type: 'approval',
    step_name: '',
    assigned_role: '',
    required: true,
    can_skip: false,
    auto_assign: true
  })

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  const { data: workflows, isLoading, refetch: refetchWorkflows } = useQuery({
    queryKey: ['workflow-configs'],
    queryFn: () => workflowConfigApi.list(),
    enabled: !!user && (user.role === 'tenant_admin' || user.role === 'platform_admin')
  })

  // Auto-select workflow if ID is provided in URL
  useEffect(() => {
    if (id && workflows && workflows.length > 0 && !selectedConfig) {
      const workflow = workflows.find(w => w.id === id)
      if (workflow) {
        setSelectedConfig(workflow)
        setFormData({
          name: workflow.name,
          description: workflow.description || '',
          workflow_engine: workflow.workflow_engine,
          integration_id: workflow.integration_id,
          workflow_steps: workflow.workflow_steps,
          assignment_rules: workflow.assignment_rules,
          conditions: workflow.conditions,
          trigger_rules: workflow.trigger_rules,
          is_default: workflow.is_default,
          status: workflow.status
        })
        setShowCreateForm(true)
        // Update URL to /workflows to avoid confusion
        navigate('/workflows', { replace: true })
      }
    }
  }, [id, workflows, selectedConfig, navigate])

  // Debug logging for workflows
  useEffect(() => {
    console.log('📋 Workflows query state:', {
      workflows: workflows,
      workflowsCount: workflows?.length,
      isLoading,
      userRole: user?.role
    })
  }, [workflows, isLoading, user])

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list(),
    enabled: !!user && (user.role === 'tenant_admin' || user.role === 'platform_admin')
  })

  // Onboarding requests removed - all workflow items now appear in My Actions
  const { data: onboardingRequests } = useQuery({
    queryKey: ['onboarding-requests'],
    queryFn: () => workflowConfigApi.listOnboardingRequests(),
    enabled: false, // Disabled - all workflow items now appear in My Actions
    refetchInterval: 30000
  })

  const { data: approverGroups } = useQuery({
    queryKey: ['approver-groups'],
    queryFn: () => workflowConfigApi.listApproverGroups(),
    enabled: !!user && (user.role === 'tenant_admin' || user.role === 'platform_admin')
  })

  // Fetch workflow types and layout groups to map workflows to types and entities
  const { data: workflowTypes } = useQuery({
    queryKey: ['workflow-types'],
    queryFn: () => formLayoutsApi.getWorkflowTypes(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const { data: layoutGroups } = useQuery({
    queryKey: ['workflow-layout-groups'],
    queryFn: () => formLayoutsApi.listGroups(undefined, true),
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: (data: WorkflowConfigCreate) => workflowConfigApi.create(data),
    onSuccess: (data) => {
      console.log('✅ Workflow created successfully:', data)
      // Invalidate and explicitly refetch workflows list
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      refetchWorkflows().then(() => {
        console.log('✅ Workflows list refetched after creation')
      })
      setShowCreateForm(false)
      resetForm()
      showToast.success('Workflow created successfully')
    },
    onError: (error: any) => {
      console.error('❌ Failed to create workflow:', error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to create workflow'
      showToast.error(errorMessage)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkflowConfigCreate> }) =>
      workflowConfigApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      setShowCreateForm(false)
      setSelectedConfig(null)
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowConfigApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      setSelectedWorkflows(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      showToast.success('Workflow deleted successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to delete workflow')
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => workflowConfigApi.delete(id)))
      return ids.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      setSelectedWorkflows(new Set())
      setSelectAll(false)
      showToast.success(`${count} workflow(s) deleted successfully`)
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to delete workflows')
    }
  })

  const cloneMutation = useMutation({
    mutationFn: async (workflow: WorkflowConfig) => {
      const cloneData: WorkflowConfigCreate = {
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        workflow_engine: workflow.workflow_engine,
        integration_id: workflow.integration_id,
        workflow_steps: workflow.workflow_steps ? JSON.parse(JSON.stringify(workflow.workflow_steps)) : [],
        assignment_rules: workflow.assignment_rules ? JSON.parse(JSON.stringify(workflow.assignment_rules)) : undefined,
        conditions: workflow.conditions ? JSON.parse(JSON.stringify(workflow.conditions)) : undefined,
        trigger_rules: workflow.trigger_rules ? JSON.parse(JSON.stringify(workflow.trigger_rules)) : undefined,
        is_default: false
      }
      return workflowConfigApi.create(cloneData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      showToast.success('Workflow cloned successfully')
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to clone workflow')
    }
  })

  // Helper functions for workflow type and entities
  const getWorkflowType = (workflow: WorkflowConfig): string => {
    // Try to find matching layout group by trigger rules or conditions
    if (layoutGroups && workflow.trigger_rules) {
      // Match by agent_types, application_categories, etc.
      const matchingGroup = layoutGroups.find((group: any) => {
        // Simple matching logic - can be enhanced
        return group.request_type && group.is_active
      })
      if (matchingGroup) {
        const typeLabel = workflowTypes?.find((t: any) => t.value === matchingGroup.request_type)?.label
        return typeLabel || matchingGroup.request_type || '-'
      }
    }
    return '-'
  }

  const getWorkflowEntities = (workflow: WorkflowConfig): string[] => {
    // Get entities from matching layout group
    if (layoutGroups) {
      const matchingGroup = layoutGroups.find((group: any) => {
        // Match by request_type or other criteria
        return group.is_active
      })
      if (matchingGroup && matchingGroup.covered_entities) {
        return matchingGroup.covered_entities
      }
    }
    // Fallback: infer from trigger_rules
    const entities: string[] = []
    if (workflow.trigger_rules?.agent_types && workflow.trigger_rules.agent_types.length > 0) {
      entities.push('agent')
    }
    if (workflow.trigger_rules?.departments && workflow.trigger_rules.departments.length > 0) {
      entities.push('users')
    }
    return entities.length > 0 ? entities : ['-']
  }

  // Selection handlers
  const handleSelectWorkflow = (workflowId: string) => {
    setSelectedWorkflows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(workflowId)) {
        newSet.delete(workflowId)
      } else {
        newSet.add(workflowId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWorkflows(new Set())
      setSelectAll(false)
    } else {
      const allIds = new Set(workflows?.map(w => w.id) || [])
      setSelectedWorkflows(allIds)
      setSelectAll(true)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedWorkflows.size === 0) return
    const confirmed = await dialog.confirm({
      title: 'Delete Workflows',
      message: `Are you sure you want to delete ${selectedWorkflows.size} selected workflow(s)? This action cannot be undone.`,
      variant: 'destructive'
    })
    if (confirmed) {
      bulkDeleteMutation.mutate(Array.from(selectedWorkflows))
    }
  }

  const handleClone = (workflow: WorkflowConfig) => {
    cloneMutation.mutate(workflow)
  }

  // Update select all state when selection changes
  useEffect(() => {
    if (workflows && workflows.length > 0) {
      const allSelected = workflows.every(w => selectedWorkflows.has(w.id))
      setSelectAll(allSelected && selectedWorkflows.size > 0)
    }
  }, [selectedWorkflows, workflows])

  const setFirstStepMutation = useMutation({
    mutationFn: ({ id, stepNumber }: { id: string; stepNumber: number }) =>
      workflowConfigApi.setFirstStep(id, stepNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
    }
  })

  const reorderStepsMutation = useMutation({
    mutationFn: ({ id, stepOrder }: { id: string; stepOrder: number[] }) =>
      workflowConfigApi.reorderSteps(id, stepOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
    }
  })

  const approveRequestMutation = useMutation({
    mutationFn: ({ requestId, notes }: { requestId: string; notes?: string }) =>
      workflowConfigApi.approveOnboardingRequest(requestId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-requests'] })
      // Invalidate trust center queries to refresh customer logos
      queryClient.invalidateQueries({ queryKey: ['my-trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['actions', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['actions-inbox'] })
    }
  })

  const rejectRequestMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      workflowConfigApi.rejectOnboardingRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-requests'] })
      // Invalidate trust center queries to refresh customer logos
      queryClient.invalidateQueries({ queryKey: ['my-trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['trust-center'] })
      queryClient.invalidateQueries({ queryKey: ['actions', 'inbox'] })
      queryClient.invalidateQueries({ queryKey: ['actions-inbox'] })
    }
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      workflow_engine: 'internal',
      integration_id: undefined,
      workflow_steps: [],
      assignment_rules: {
        approver_selection: 'role_based',
        reviewer_auto_assign: true
      },
      conditions: {
        priority: 1
      },
      trigger_rules: {
        match_all: false
      },
      is_default: false,
      status: 'draft'
    })
    setNewStep({
      step_type: 'approval',
      step_name: '',
      assigned_role: '',
      required: true,
      can_skip: false,
      auto_assign: true
    })
  }

  const addStep = () => {
    if (!newStep.step_name || !newStep.assigned_role) {
      showToast.warning('Please fill in step name and assigned role')
      return
    }

    const stepNumber = (formData.workflow_steps?.length || 0) + 1
    const step: WorkflowStep = {
      step_number: stepNumber,
      step_type: newStep.step_type || 'approval',
      step_name: newStep.step_name,
      assigned_role: newStep.assigned_role,
      required: newStep.required ?? true,
      can_skip: newStep.can_skip ?? false,
      auto_assign: newStep.auto_assign ?? true,
      is_first_step: stepNumber === 1 // First step is first by default
    }

    setFormData({
      ...formData,
      workflow_steps: [...(formData.workflow_steps || []), step]
    })

    setNewStep({
      step_type: 'approval',
      step_name: '',
      assigned_role: '',
      required: true,
      can_skip: false,
      auto_assign: true
    })
  }

  const removeStep = (stepNumber: number) => {
    const updatedSteps = (formData.workflow_steps || [])
      .filter(s => s.step_number !== stepNumber)
      .map((s, idx) => ({ ...s, step_number: idx + 1 }))
    
    // Ensure first step is marked
    if (updatedSteps.length > 0) {
      updatedSteps[0].is_first_step = true
      updatedSteps.slice(1).forEach(s => { s.is_first_step = false })
    }

    setFormData({ ...formData, workflow_steps: updatedSteps })
  }

  const handleSetFirstStep = async (configId: string, stepNumber: number) => {
    const confirmed = await dialog.confirm({
      title: 'Set First Step',
      message: 'Set this step as the first step in the workflow?',
      variant: 'default'
    })
    if (confirmed) {
      setFirstStepMutation.mutate({ id: configId, stepNumber })
    }
  }

  const handleReorderSteps = (configId: string, stepOrder: number[]) => {
    reorderStepsMutation.mutate({ id: configId, stepOrder }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      }
    })
  }

  const handleStepReorder = (stepOrder: number[]) => {
    // Reorder steps in formData based on the new order
    const reorderedSteps = stepOrder
      .map((stepNum) => formData.workflow_steps?.find((s) => s.step_number === stepNum))
      .filter((s): s is WorkflowStep => s !== undefined)
      .map((step, index) => ({
        ...step,
        step_number: index + 1,
        is_first_step: index === 0
      }))
    
    setFormData({
      ...formData,
      workflow_steps: reorderedSteps
    })
  }

  const handleSubmit = () => {
    if (!formData.name) {
      showToast.warning('Please enter a workflow name')
      return
    }

    if (!formData.workflow_steps || formData.workflow_steps.length === 0) {
      showToast.warning('Please add at least one workflow step')
      return
    }

    if (selectedConfig) {
      // Update existing workflow
      updateMutation.mutate(
        { id: selectedConfig.id, data: formData },
        {
          onSuccess: () => {
            setShowCreateForm(false)
            setSelectedConfig(null)
            resetForm()
          }
        }
      )
    } else {
      // Create new workflow
      createMutation.mutate(formData)
    }
  }

  if (!user || !['tenant_admin', 'platform_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied. Tenant admin required.</div>
        </div>
      </Layout>
    )
  }

  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'platform_admin'
  const isApprover = user?.role === 'approver' || user?.role === 'tenant_admin' || user?.role === 'platform_admin'

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1>Workflow Management</h1>
            <p className="text-body text-gray-600 mt-2">
              Configure workflows for agent onboarding and approval processes
            </p>
          </div>
          {isAdmin && activeTab === 'workflows' && !showCreateForm && (
            <button
              onClick={() => {
                setSelectedConfig(null)
                resetForm()
                setShowCreateForm(true)
              }}
              className="compact-button-primary"
            >
              Create Workflow
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('workflows')}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                activeTab === 'workflows'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Workflows
            </button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && activeTab === 'workflows' && (
          <div className="compact-card">
            <h2 className="mb-4">
              {selectedConfig ? 'Edit Workflow Configuration' : 'Create Workflow Configuration'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="enterprise-label">Workflow Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="compact-input w-full"
                  placeholder="e.g., Standard Onboarding Workflow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="compact-input w-full min-h-[80px]"
                  placeholder="Workflow description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Workflow Engine</label>
                <select
                  value={formData.workflow_engine}
                  onChange={(e) => setFormData({ ...formData, workflow_engine: e.target.value as any })}
                  className="compact-input w-full"
                >
                  <option value="internal">Internal (Platform)</option>
                  <option value="servicenow">ServiceNow</option>
                  <option value="jira">Jira</option>
                  <option value="custom">Custom (API)</option>
                </select>
              </div>

              {formData.workflow_engine !== 'internal' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Integration</label>
                  <select
                    value={formData.integration_id || ''}
                    onChange={(e) => setFormData({ ...formData, integration_id: e.target.value || undefined })}
                    className="compact-input w-full"
                  >
                    <option value="">Select Integration</option>
                    {integrations?.filter(i => 
                      i.integration_type === formData.workflow_engine
                    ).map(integration => (
                      <option key={integration.id} value={integration.id}>
                        {integration.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="mb-3">Workflow Steps</h3>
                
                {/* Simple Flowchart for New/Edit Workflow */}
                <div className="bg-gray-50 rounded-lg p-6 overflow-hidden">
                  <WorkflowFlowchart
                    steps={formData.workflow_steps || []}
                    onStepUpdate={(updatedStep) => {
                      const updatedSteps = (formData.workflow_steps || []).map(s =>
                        s.step_number === updatedStep.step_number ? updatedStep : s
                      )
                      setFormData({ ...formData, workflow_steps: updatedSteps })
                    }}
                    onStepAdd={() => {
                      const maxStepNumber = formData.workflow_steps?.length || 0
                      const newStep: WorkflowStep = {
                        step_number: maxStepNumber + 1,
                        step_type: 'approval',
                        step_name: `Step ${maxStepNumber + 1}`,
                        assigned_role: '',
                        required: true,
                        can_skip: false,
                        auto_assign: true
                      }
                      setFormData({
                        ...formData,
                        workflow_steps: [...(formData.workflow_steps || []), newStep]
                      })
                    }}
                    onStepReorder={handleStepReorder}
                    onStageSettings={(step) => {
                      setStepForSettings(step)
                      setShowStageSettings(true)
                    }}
                    onSave={handleSubmit}
                    approverGroups={approverGroups}
                    canEdit={true}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status || 'draft'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'draft' })}
                    className="compact-input w-full"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Active workflows can be used for new requests. Draft workflows are saved but not used.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">Set as default workflow</label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="compact-button-primary"
                  disabled={selectedConfig ? updateMutation.isPending : createMutation.isPending}
                >
                  {selectedConfig 
                    ? (updateMutation.isPending ? 'Updating...' : 'Update Workflow')
                    : (createMutation.isPending ? 'Creating...' : 'Create Workflow')
                  }
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setSelectedConfig(null)
                    resetForm()
                  }}
                  className="compact-button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workflows Table */}
        {activeTab === 'workflows' && !showCreateForm && (
          <MaterialCard elevation={2} className="overflow-hidden border-none">
            {/* Bulk Actions Bar */}
            {isAdmin && selectedWorkflows.size > 0 && (
              <div className="px-6 py-3 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedWorkflows.size} workflow(s) selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MaterialButton
                    variant="text"
                    color="error"
                    size="small"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    startIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete Selected
                  </MaterialButton>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : workflows && workflows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-variant/30 border-b border-gray-100">
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight w-12">
                        {isAdmin && (
                          <button
                            onClick={handleSelectAll}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Select all"
                          >
                            {selectAll ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight">Workflow Name</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight">Workflow Type</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight">Status</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight">Engine</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight">Steps</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight">Description</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-700 tracking-tight text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {workflows.map((workflow) => {
                      const isExpanded = expandedWorkflowId === workflow.id
                      const isSelected = selectedWorkflows.has(workflow.id)
                      const workflowType = getWorkflowType(workflow)
                      return (
                        <React.Fragment key={workflow.id}>
                          <tr className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                            <td className="px-6 py-4">
                              {isAdmin && (
                                <button
                                  onClick={() => handleSelectWorkflow(workflow.id)}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                  title={isSelected ? 'Deselect' : 'Select'}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Square className="w-5 h-5" />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setExpandedWorkflowId(isExpanded ? null : workflow.id)}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="text-sm font-medium text-gray-900">{workflow.name}</span>
                                {workflow.is_default && (
                                  <MaterialChip 
                                    label="Default" 
                                    color="primary" 
                                    size="small" 
                                    variant="filled"
                                    className="text-xs"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">{workflowType}</span>
                            </td>
                            <td className="px-6 py-4">
                              <MaterialChip
                                label={workflow.status}
                                color={
                                  workflow.status === 'active' ? 'success' :
                                  workflow.status === 'draft' ? 'default' :
                                  'error'
                                }
                                size="small"
                                variant="filled"
                                className="text-xs"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">{workflow.workflow_engine}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">{workflow.workflow_steps?.length || 0}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600 line-clamp-1">
                                {workflow.description || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {isAdmin && (
                                  <>
                                    <MaterialButton
                                      variant="text"
                                      size="small"
                                      onClick={() => handleClone(workflow)}
                                      disabled={cloneMutation.isPending}
                                      startIcon={<Copy className="w-4 h-4" />}
                                      title="Clone workflow"
                                    >
                                      Clone
                                    </MaterialButton>
                                    <MaterialButton
                                      variant="text"
                                      size="small"
                                      onClick={() => {
                                        setSelectedConfig(workflow)
                                        setFormData({
                                          name: workflow.name,
                                          description: workflow.description || '',
                                          workflow_engine: workflow.workflow_engine,
                                          integration_id: workflow.integration_id,
                                          workflow_steps: workflow.workflow_steps,
                                          assignment_rules: workflow.assignment_rules,
                                          conditions: workflow.conditions,
                                          trigger_rules: workflow.trigger_rules,
                                          is_default: workflow.is_default,
                                          status: workflow.status || 'draft'
                                        })
                                        setShowCreateForm(true)
                                      }}
                                      startIcon={<Edit2 className="w-4 h-4" />}
                                    >
                                      Edit
                                    </MaterialButton>
                                    <MaterialButton
                                      variant="text"
                                      color="error"
                                      size="small"
                                      onClick={async () => {
                                        const confirmed = await dialog.confirm({
                                          title: 'Delete Workflow',
                                          message: 'Are you sure you want to delete this workflow? This action cannot be undone.',
                                          variant: 'destructive'
                                        })
                                        if (confirmed) {
                                          deleteMutation.mutate(workflow.id)
                                        }
                                      }}
                                      startIcon={<Trash2 className="w-4 h-4" />}
                                    >
                                      Delete
                                    </MaterialButton>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Expanded Row - Workflow Diagram */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="px-6 py-6 bg-gray-50">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 mb-4">
                                    <GitBranch className="w-5 h-5 text-gray-600" />
                                    <h4 className="text-sm font-medium text-gray-900">Workflow Diagram</h4>
                                  </div>
                                  {workflow.workflow_steps && workflow.workflow_steps.length > 0 ? (
                                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                                      <WorkflowFlowchart
                                        steps={workflow.workflow_steps}
                                        onStepUpdate={(updatedStep) => {
                                          const updatedSteps = workflow.workflow_steps!.map(s =>
                                            s.step_number === updatedStep.step_number ? updatedStep : s
                                          )
                                          updateMutation.mutate({
                                            id: workflow.id,
                                            data: { workflow_steps: updatedSteps }
                                          })
                                        }}
                                        onStepDelete={(stepNumber) => {
                                          const updatedSteps = (workflow.workflow_steps || [])
                                            .filter(s => s.step_number !== stepNumber)
                                            .map((s, index) => ({ ...s, step_number: index + 1 }))
                                          
                                          if (updatedSteps.length > 0 && !updatedSteps.some(s => s.is_first_step)) {
                                            updatedSteps[0].is_first_step = true
                                          }
                                          
                                          updateMutation.mutate({
                                            id: workflow.id,
                                            data: { workflow_steps: updatedSteps }
                                          })
                                        }}
                                        onStepReorder={(stepNumbers) => {
                                          reorderStepsMutation.mutate({
                                            id: workflow.id,
                                            stepOrder: stepNumbers
                                          })
                                        }}
                                        onStageSettings={(step) => {
                                          setStepForSettings(step)
                                          setShowStageSettings(true)
                                        }}
                                        onSave={() => {
                                          updateMutation.mutate({
                                            id: workflow.id,
                                            data: { workflow_steps: workflow.workflow_steps }
                                          })
                                        }}
                                        approverGroups={approverGroups}
                                        canEdit={isAdmin}
                                      />
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-sm text-gray-500">
                                      No workflow steps configured
                                    </div>
                                  )}
                                  
                                  {/* Trigger Rules */}
                                  {workflow.trigger_rules && (
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                      <h5 className="text-sm font-medium text-gray-900 mb-2">Trigger Rules</h5>
                                      <div className="text-xs text-gray-700 space-y-1">
                                        {workflow.trigger_rules.sso_groups && workflow.trigger_rules.sso_groups.length > 0 && (
                                          <div>SSO Groups: {workflow.trigger_rules.sso_groups.join(', ')}</div>
                                        )}
                                        {workflow.trigger_rules.departments && workflow.trigger_rules.departments.length > 0 && (
                                          <div>Departments: {workflow.trigger_rules.departments.join(', ')}</div>
                                        )}
                                        {workflow.trigger_rules.application_categories && workflow.trigger_rules.application_categories.length > 0 && (
                                          <div>Categories: {workflow.trigger_rules.application_categories.join(', ')}</div>
                                        )}
                                        <div className="text-gray-600 mt-1">
                                          Match: {workflow.trigger_rules.match_all ? 'All Conditions' : 'Any Condition'}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No workflows configured. Create one to get started.
              </div>
            )}
          </MaterialCard>
        )}

        {/* Stage Settings Modal - Shared for both create form and existing workflows */}
        <StageSettingsModal
          step={stepForSettings}
          isOpen={showStageSettings}
          onClose={() => {
            setShowStageSettings(false)
            setStepForSettings(null)
          }}
          onSave={(updatedStep) => {
            // Check if we're in create/edit form mode
            if (showCreateForm) {
              // Update formData for workflow being created or edited
              const updatedSteps = (formData.workflow_steps || []).map(s =>
                s.step_number === updatedStep.step_number ? updatedStep : s
              )
              setFormData({ ...formData, workflow_steps: updatedSteps })
            } else {
              // Update existing workflow in the list
              const workflow = workflows?.find(w => 
                w.workflow_steps?.some(s => s.step_number === updatedStep.step_number)
              )
              if (workflow) {
                const updatedSteps = (workflow.workflow_steps || []).map(s =>
                  s.step_number === updatedStep.step_number ? updatedStep : s
                )
                updateMutation.mutate({
                  id: workflow.id,
                  data: { workflow_steps: updatedSteps }
                })
              }
            }
            setShowStageSettings(false)
            setStepForSettings(null)
          }}
          requestType={(() => {
            if (!stepForSettings) return 'agent_onboarding_workflow'
            
            // Find the workflow that contains this step
            const workflow = workflows?.find(w => 
              w.workflow_steps?.some(s => s.step_number === stepForSettings.step_number)
            )
            
            if (!workflow) {
              console.log('StageSettingsModal - No workflow found for step:', stepForSettings.step_number)
              return 'agent_onboarding_workflow'
            }
            
            // Find the workflow layout group for this workflow
            // Handle both string and UUID comparison
            const layoutGroup = layoutGroups?.find(g => {
              const groupWorkflowId = g.workflow_config_id
              const workflowId = workflow.id
              // Compare as strings to handle UUID/string differences
              return groupWorkflowId && workflowId && String(groupWorkflowId) === String(workflowId)
            })
            
            console.log('StageSettingsModal - RequestType calculation:', {
              workflowId: workflow.id,
              workflowIdType: typeof workflow.id,
              workflowName: workflow.name,
              layoutGroupsCount: layoutGroups?.length || 0,
              layoutGroupFound: !!layoutGroup,
              layoutGroupRequestType: layoutGroup?.request_type,
              layoutGroupName: layoutGroup?.name,
              allLayoutGroupWorkflowIds: layoutGroups?.map(g => ({
                id: g.id,
                name: g.name,
                workflow_config_id: g.workflow_config_id,
                request_type: g.request_type
              })) || []
            })
            
            // Use request_type from layout group if available
            if (layoutGroup?.request_type) {
              console.log('StageSettingsModal - Using requestType from layout group:', layoutGroup.request_type)
              return layoutGroup.request_type
            }
            
            // Fallback 1: Try to find layout group by workflow name pattern (for template workflows)
            // Template workflows have names like "SOC 2 Compliance Workflow", "ISO 27001 Compliance Workflow", etc.
            const workflowNameLower = workflow.name.toLowerCase()
            let templateRequestType: string | null = null
            
            if (workflowNameLower.includes('soc 2') || workflowNameLower.includes('soc2')) {
              templateRequestType = 'soc2_compliance_workflow'
            } else if (workflowNameLower.includes('iso 27001') || workflowNameLower.includes('iso27001')) {
              templateRequestType = 'iso27001_compliance_workflow'
            } else if (workflowNameLower.includes('gdpr')) {
              templateRequestType = 'gdpr_compliance_workflow'
            } else if (workflowNameLower.includes('vendor onboarding') || workflowNameLower.includes('vendor_onboarding')) {
              templateRequestType = 'vendor_onboarding_workflow'
            } else if (workflowNameLower.includes('risk assessment') || workflowNameLower.includes('risk_assessment')) {
              templateRequestType = 'risk_assessment_workflow'
            }
            
            if (templateRequestType) {
              // Try to find a layout group with this request_type
              const templateLayoutGroup = layoutGroups?.find(g => 
                g.request_type === templateRequestType && g.is_default === true
              )
              if (templateLayoutGroup) {
                console.log('StageSettingsModal - Found template layout group by request_type:', templateRequestType)
                return templateRequestType
              }
            }
            
            // Fallback 2: use step type to determine request type (legacy behavior)
            const step = workflow.workflow_steps?.find(s => s.step_number === stepForSettings.step_number)
            const fallbackType = step?.step_type === 'approval' ? 'vendor_submission_workflow' : 'agent_onboarding_workflow'
            console.log('StageSettingsModal - Using fallback requestType:', fallbackType)
            return fallbackType
          })()}
        />


        {/* Onboarding Requests */}
        {activeTab === 'requests' && (isApprover || isAdmin) && (
          <div className="space-y-4">
            {onboardingRequests && onboardingRequests.length > 0 ? (
              onboardingRequests.map((request) => {
                const isExpanded = expandedRequestId === request.id
                return (
                <div key={request.id} className="compact-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-subheading font-medium">Onboarding Request</h3>
                        <span className={`badge-text px-2 py-1 rounded ${
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          request.status === 'in_review' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-body text-gray-600 mb-2">
                          Request ID: <span className="font-medium">{request.request_number || request.id}</span> | Agent ID: {request.agent_id} | Request Type: {request.request_type}
                        {request.assigned_to && (
                          <span className="ml-2 text-caption text-blue-600">
                              (Assigned to: {request.assigned_to_email || request.assigned_to})
                          </span>
                        )}
                        {isAdmin && request.assigned_to && (
                          <span className="ml-2 text-caption text-orange-600 font-medium">
                            (Admin can act on behalf)
                          </span>
                        )}
                      </div>
                      {request.rejection_reason && (
                        <div className="text-body text-red-600 mb-2">
                          Rejection Reason: {request.rejection_reason}
                        </div>
                      )}
                      {request.approval_notes && (
                        <div className="text-sm text-green-600 mb-2">
                          Approval Notes: {request.approval_notes}
                        </div>
                      )}
                    </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedRequestId(null)
                              setSelectedRequest(null)
                            } else {
                              setExpandedRequestId(request.id)
                              setSelectedRequest(request)
                            }
                          }}
                          className="compact-button-secondary text-sm"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                        {(request.status === 'pending' || request.status === 'in_review') && (isAdmin || !request.assigned_to || request.assigned_to === user?.id) ? (
                          <>
                        <button
                          onClick={async () => {
                            const notes = await dialog.prompt({
                              title: 'Approve Request',
                              message: 'Enter approval notes (optional)',
                              label: 'Approval Notes',
                              placeholder: 'Enter approval notes...',
                              required: false,
                              type: 'textarea'
                            })
                            if (notes !== null) {
                              approveRequestMutation.mutate({ requestId: request.id, notes: notes || undefined })
                            }
                          }}
                          className="compact-button-primary text-sm"
                          disabled={approveRequestMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            const reason = await dialog.prompt({
                              title: 'Reject Request',
                              message: 'Enter rejection reason',
                              label: 'Rejection Reason',
                              placeholder: 'Enter rejection reason...',
                              required: true,
                              type: 'textarea'
                            })
                            if (reason) {
                              rejectRequestMutation.mutate({ requestId: request.id, reason })
                            }
                          }}
                          className="compact-button-secondary text-sm text-red-600"
                          disabled={rejectRequestMutation.isPending}
                        >
                          Reject
                        </button>
                          </>
                    ) : null}
                  </div>
                </div>
                    
                    {/* Expanded Details View */}
                    {isExpanded && (
                      <RequestDetailsView 
                        request={request} 
                        user={user}
                        isAdmin={isAdmin}
                        approveRequestMutation={approveRequestMutation}
                        rejectRequestMutation={rejectRequestMutation}
                        dialog={dialog}
                      />
                    )}
                  </div>
                )
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No pending onboarding requests.
              </div>
            )}
          </div>
        )}

        {/* Step Details Modal */}
        {showStepDetails && selectedStep && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowStepDetails(false)}>
            <div className="bg-white rounded-lg max-w-2xl w-full h-[90vh] flex flex-col my-auto mx-auto overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header - Fixed */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-2xl font-medium">Step Details</h2>
                <button
                  onClick={() => setShowStepDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-scroll overflow-x-hidden" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Step Number</label>
                  <div className="text-lg font-medium">{selectedStep.step_number}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
                  <div className="text-lg">{selectedStep.step_name || `Step ${selectedStep.step_number}`}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Step Type</label>
                  <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {selectedStep.step_type || 'review'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Role</label>
                  <div className="text-base">{selectedStep.assigned_role?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not assigned'}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Required</label>
                    <div className="text-base">{selectedStep.required ? 'Yes' : 'No'}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Can Skip</label>
                    <div className="text-base">{selectedStep.can_skip ? 'Yes' : 'No'}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auto Assign</label>
                    <div className="text-base">{selectedStep.auto_assign ? 'Yes' : 'No'}</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Step</label>
                    <div className="text-base">{selectedStep.is_first_step ? 'Yes' : 'No'}</div>
                  </div>
                </div>
                
                {selectedStep.conditions && Object.keys(selectedStep.conditions).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Conditions</label>
                    <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedStep.conditions, null, 2)}
                    </pre>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

// Request Details View Component
function RequestDetailsView({ 
  request, 
  user, 
  isAdmin,
  approveRequestMutation,
  rejectRequestMutation,
  dialog
}: { 
  request: OnboardingRequest
  user: any
  isAdmin: boolean
  approveRequestMutation: any
  rejectRequestMutation: any
  dialog: ReturnType<typeof useDialogContext>
}) {
  const [activeTab, setActiveTab] = useState<string>('overview')
  const queryClient = useQueryClient()

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', request.agent_id],
    queryFn: () => agentsApi.get(request.agent_id),
    enabled: !!request.agent_id
  })

  const { data: workflowConfig } = useQuery({
    queryKey: ['workflow-config', request.workflow_config_id],
    queryFn: () => workflowConfigApi.get(request.workflow_config_id!),
    enabled: !!request.workflow_config_id
  })

  // Fetch user information for requested_by and assigned_to (shared across tabs)
  const { data: requestedByUser } = useQuery({
    queryKey: ['user', request.requested_by],
    queryFn: () => usersApi.get(request.requested_by),
    enabled: !!request.requested_by,
    retry: false
  })

  const { data: assignedToUser } = useQuery({
    queryKey: ['user', request.assigned_to],
    queryFn: () => usersApi.get(request.assigned_to!),
    enabled: !!request.assigned_to,
    retry: false
  })

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  // Determine available tabs based on current workflow step
  const getAvailableTabs = () => {
    const currentStep = workflowConfig?.workflow_steps?.find(
      step => step.step_number === request.current_step
    )
    
    const tabs: Array<{ id: string; label: string; visible: boolean }> = [
      { id: 'overview', label: 'Overview', visible: true },
      { id: 'compliance', label: 'Compliance', visible: true },
      { id: 'technical', label: 'Technical', visible: true },
      { id: 'business', label: 'Business', visible: true },
      { id: 'security', label: 'Security & Privacy', visible: true },
      { id: 'workflow', label: 'Workflow', visible: true },
      { id: 'audit', label: 'Audit', visible: true },
      { id: 'comments', label: 'Comments', visible: true }
    ]

    // If current step has assigned_role, show relevant tabs
    if (currentStep?.assigned_role) {
      const role = currentStep.assigned_role.toLowerCase()
      if (role.includes('compliance')) {
        // Compliance approver - focus on compliance tab
        tabs.forEach(tab => {
          tab.visible = tab.id === 'compliance' || tab.id === 'overview' || tab.id === 'workflow'
        })
      } else if (role.includes('security') || role.includes('privacy')) {
        // Security/Privacy approver - focus on security tab
        tabs.forEach(tab => {
          tab.visible = tab.id === 'security' || tab.id === 'overview' || tab.id === 'workflow'
        })
      } else if (role.includes('technical') || role.includes('it')) {
        // Technical approver - focus on technical tab
        tabs.forEach(tab => {
          tab.visible = tab.id === 'technical' || tab.id === 'overview' || tab.id === 'workflow'
        })
      } else if (role.includes('business') || role.includes('manager')) {
        // Business approver - see all tabs
        // All tabs visible by default
      }
    }

    // Set initial active tab based on current step
    if (currentStep?.assigned_role) {
      const role = currentStep.assigned_role.toLowerCase()
      if (role.includes('compliance')) {
        setActiveTab('compliance')
      } else if (role.includes('security') || role.includes('privacy')) {
        setActiveTab('security')
      } else if (role.includes('technical') || role.includes('it')) {
        setActiveTab('technical')
      } else if (role.includes('business') || role.includes('manager')) {
        setActiveTab('overview')
      }
    }

    return tabs.filter(tab => tab.visible)
  }

  const availableTabs = getAvailableTabs()

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab request={request} agent={agent} agentLoading={agentLoading} formatDate={formatDate} requestedByUser={requestedByUser} assignedToUser={assignedToUser} />
      case 'compliance':
        return <ComplianceTab request={request} agent={agent} agentLoading={agentLoading} formatDate={formatDate} />
      case 'technical':
        return <TechnicalTab request={request} agent={agent} agentLoading={agentLoading} formatDate={formatDate} queryClient={queryClient} />
      case 'business':
        return <BusinessTab request={request} agent={agent} agentLoading={agentLoading} formatDate={formatDate} requestedByUser={requestedByUser} assignedToUser={assignedToUser} />
      case 'security':
        return <SecurityTab request={request} agent={agent} agentLoading={agentLoading} formatDate={formatDate} />
      case 'workflow':
        return <WorkflowTab request={request} workflowConfig={workflowConfig} formatDate={formatDate} />
      case 'audit':
        return <AuditTab request={request} agent={agent} formatDate={formatDate} />
      case 'comments':
        return <CommentsTab request={request} agent={agent} user={user} formatDate={formatDate} />
      default:
        return <OverviewTab request={request} agent={agent} agentLoading={agentLoading} formatDate={formatDate} />
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {renderTabContent()}
      </div>


      {/* Action Buttons in Details View */}
      {(request.status === 'pending' || request.status === 'in_review') && (isAdmin || !request.assigned_to || request.assigned_to === user?.id) && (
        <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={async () => {
              const notes = await dialog.prompt({
                title: 'Approve Request',
                message: 'Enter approval notes (optional)',
                label: 'Approval Notes',
                placeholder: 'Enter approval notes...',
                required: false,
                type: 'textarea'
              })
              if (notes !== null) {
                approveRequestMutation.mutate({ requestId: request.id, notes: notes || undefined })
              }
            }}
            className="compact-button-primary"
            disabled={approveRequestMutation.isPending}
          >
            {approveRequestMutation.isPending ? 'Approving...' : 'Approve Request'}
          </button>
          <button
            onClick={async () => {
              const reason = await dialog.prompt({
                title: 'Reject Request',
                message: 'Enter rejection reason',
                label: 'Rejection Reason',
                placeholder: 'Enter rejection reason...',
                required: true,
                type: 'textarea'
              })
              if (reason) {
                rejectRequestMutation.mutate({ requestId: request.id, reason })
              }
            }}
            className="compact-button-secondary text-red-600 border-red-300 hover:bg-red-50"
            disabled={rejectRequestMutation.isPending}
          >
            {rejectRequestMutation.isPending ? 'Rejecting...' : 'Reject Request'}
          </button>
        </div>
      )}
    </div>
  )
}

// Tab Components
function OverviewTab({ request, agent, agentLoading, formatDate, requestedByUser, assignedToUser }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Request Information */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium mb-3 text-gray-800">Request Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Request Number:</span>
              <span className="font-medium">{request.request_number || request.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Request Type:</span>
              <span className="font-medium capitalize">{request.request_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-medium ${
                request.status === 'approved' ? 'text-green-600' :
                request.status === 'rejected' ? 'text-red-600' :
                request.status === 'in_review' ? 'text-blue-600' :
                'text-gray-600'
              }`}>
                {request.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Step:</span>
              <span className="font-medium">{request.current_step}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Workflow Engine:</span>
              <span className="font-medium">{request.workflow_engine}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created At:</span>
              <span className="font-medium">{formatDate(request.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated At:</span>
              <span className="font-medium">{formatDate(request.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Assignment & Review */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium mb-3 text-gray-800">Assignment & Review</h4>
          <div className="space-y-2 text-sm">
            {request.assigned_to && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To:</span>
                <span className="font-medium">{request.assigned_to_email || request.assigned_to}</span>
              </div>
            )}
            {request.reviewed_by && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reviewed By:</span>
                  <span className="font-medium">{request.reviewed_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reviewed At:</span>
                  <span className="font-medium">{formatDate(request.reviewed_at)}</span>
                </div>
                {request.review_notes && (
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <span className="text-muted-foreground text-xs">Review Notes:</span>
                    <p className="text-sm mt-1">{request.review_notes}</p>
                  </div>
                )}
              </>
            )}
            {request.approved_by && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved By:</span>
                  <span className="font-medium">{request.approved_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved At:</span>
                  <span className="font-medium">{formatDate(request.approved_at)}</span>
                </div>
                {request.approval_notes && (
                  <div className="mt-2 p-2 bg-green-50 rounded">
                    <span className="text-muted-foreground text-xs">Approval Notes:</span>
                    <p className="text-sm mt-1">{request.approval_notes}</p>
                  </div>
                )}
              </>
            )}
            {request.rejected_by && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rejected By:</span>
                  <span className="font-medium">{request.rejected_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rejected At:</span>
                  <span className="font-medium">{formatDate(request.rejected_at)}</span>
                </div>
                {request.rejection_reason && (
                  <div className="mt-2 p-2 bg-red-50 rounded">
                    <span className="text-muted-foreground text-xs">Rejection Reason:</span>
                    <p className="text-sm mt-1">{request.rejection_reason}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* User & Contact Information */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">User & Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Requested By User */}
          {request.requested_by && (
            <div>
              <h5 className="font-medium mb-2 text-gray-700">Agent Owner / Requested By</h5>
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{requestedByUser?.name || request.requested_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{requestedByUser?.email || 'N/A'}</span>
                </div>
                {requestedByUser?.department && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{requestedByUser.department}</span>
                  </div>
                )}
                {requestedByUser?.organization && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{requestedByUser.organization}</span>
                  </div>
                )}
                {requestedByUser?.role && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium capitalize">{requestedByUser.role.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assigned To User (Internal Point of Contact) */}
          {request.assigned_to && (
            <div>
              <h5 className="font-medium mb-2 text-gray-700">Internal Point of Contact / Assigned To</h5>
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{assignedToUser?.name || request.assigned_to_email || request.assigned_to}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{assignedToUser?.email || request.assigned_to_email || 'N/A'}</span>
                </div>
                {assignedToUser?.department && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{assignedToUser.department}</span>
                  </div>
                )}
                {assignedToUser?.organization && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{assignedToUser.organization}</span>
                  </div>
                )}
                {assignedToUser?.role && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium capitalize">{assignedToUser.role.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Overview */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Agent Overview</h4>
        {agentLoading ? (
          <div className="text-sm text-muted-foreground">Loading agent details...</div>
        ) : agent ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-medium">{agent.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <p className="font-medium">{agent.type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>
              <p className="font-medium">{agent.category || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium">{agent.status}</p>
            </div>
            {agent.vendor_name && (
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p className="font-medium">{agent.vendor_name}</p>
              </div>
            )}
            {agent.version && (
              <div>
                <span className="text-muted-foreground">Version:</span>
                <p className="font-medium">{agent.version}</p>
              </div>
            )}
            {agent.compliance_score !== undefined && (
              <div>
                <span className="text-muted-foreground">Compliance Score:</span>
                <p className="font-medium">{agent.compliance_score}%</p>
              </div>
            )}
            {agent.risk_score !== undefined && (
              <div>
                <span className="text-muted-foreground">Risk Score:</span>
                <p className="font-medium">{agent.risk_score}</p>
              </div>
            )}
            {agent.description && (
              <div className="md:col-span-4">
                <span className="text-muted-foreground">Description:</span>
                <p className="font-medium mt-1">{agent.description}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Agent information not available</div>
        )}
      </div>
    </div>
  )
}

function ComplianceTab({ request, agent, agentLoading, formatDate }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Compliance Information</h4>
        {agentLoading ? (
          <div className="text-sm text-muted-foreground">Loading compliance details...</div>
        ) : agent ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Compliance Score:</span>
                <p className="font-medium text-lg">{agent.compliance_score !== undefined ? `${agent.compliance_score}%` : 'Not Calculated'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Risk Score:</span>
                <p className="font-medium text-lg">{agent.risk_score !== undefined ? agent.risk_score : 'Not Calculated'}</p>
              </div>
            </div>
            {agent.category && (
              <div>
                <span className="text-muted-foreground">Category:</span>
                <p className="font-medium">{agent.category}</p>
              </div>
            )}
            {agent.subcategory && (
              <div>
                <span className="text-muted-foreground">Subcategory:</span>
                <p className="font-medium">{agent.subcategory}</p>
              </div>
            )}
            {agent.submission_date && (
              <div>
                <span className="text-muted-foreground">Submission Date:</span>
                <p className="font-medium">{formatDate(agent.submission_date)}</p>
              </div>
            )}
            {agent.created_at && (
              <div>
                <span className="text-muted-foreground">Created At:</span>
                <p className="font-medium">{formatDate(agent.created_at)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Compliance information not available</div>
        )}
      </div>
    </div>
  )
}

function TechnicalTab({ request, agent, agentLoading, formatDate, queryClient }: any) {
  const [isEditingDiagram, setIsEditingDiagram] = useState(false)
  const [diagramText, setDiagramText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (agent?.architecture_info?.connection_diagram) {
      setDiagramText(agent.architecture_info.connection_diagram)
    }
  }, [agent])

  const handleSaveDiagram = async () => {
    if (!agent) return
    
    setIsSaving(true)
    try {
      await agentsApi.updateConnectionDiagram(agent.id, diagramText)
      setIsEditingDiagram(false)
      // Invalidate queries to refresh agent data
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-requests'] })
      showToast.success('Connection diagram updated successfully. All changes have been audited.')
    } catch (error: any) {
      console.error('Failed to update connection diagram:', error)
      const errorMessage = error?.response?.data?.detail || error.message || 'Failed to update connection diagram'
      showToast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Technical Information</h4>
        {agentLoading ? (
          <div className="text-sm text-muted-foreground">Loading technical details...</div>
        ) : agent ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Agent Type:</span>
                <p className="font-medium">{agent.type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>
                <p className="font-medium">{agent.version}</p>
              </div>
              {agent.llm_vendor && (
                <div>
                  <span className="text-muted-foreground">LLM Vendor:</span>
                  <p className="font-medium">{agent.llm_vendor}</p>
                </div>
              )}
              {agent.llm_model && (
                <div>
                  <span className="text-muted-foreground">LLM Model:</span>
                  <p className="font-medium">{agent.llm_model}</p>
                </div>
              )}
              {agent.deployment_type && (
                <div>
                  <span className="text-muted-foreground">Deployment Type:</span>
                  <p className="font-medium">{agent.deployment_type}</p>
                </div>
              )}
            </div>
            {agent.version_info && (
              <div className="mt-4">
                <h5 className="font-medium mb-2">Version Information</h5>
                <div className="space-y-2">
                  {agent.version_info.release_notes && (
                    <div>
                      <span className="text-muted-foreground">Release Notes:</span>
                      <p className="font-medium mt-1">{agent.version_info.release_notes}</p>
                    </div>
                  )}
                  {agent.version_info.changelog && (
                    <div>
                      <span className="text-muted-foreground">Changelog:</span>
                      <p className="font-medium mt-1">{agent.version_info.changelog}</p>
                    </div>
                  )}
                  {agent.version_info.compatibility && (
                    <div>
                      <span className="text-muted-foreground">Compatibility:</span>
                      <p className="font-medium mt-1">{agent.version_info.compatibility}</p>
                    </div>
                  )}
                  {agent.version_info.known_issues && (
                    <div>
                      <span className="text-muted-foreground">Known Issues:</span>
                      <p className="font-medium mt-1">{agent.version_info.known_issues}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Connection Diagram Section */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium">Connection Diagram</h5>
                {!isEditingDiagram && agent.architecture_info?.connection_diagram && (
                  <button
                    onClick={() => setIsEditingDiagram(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Edit Diagram
                  </button>
                )}
              </div>
              
              {isEditingDiagram ? (
                <div className="space-y-3">
                  <textarea
                    value={diagramText}
                    onChange={(e) => setDiagramText(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-xs"
                    placeholder="Enter Mermaid diagram syntax..."
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setIsEditingDiagram(false)
                        setDiagramText(agent?.architecture_info?.connection_diagram || '')
                      }}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveDiagram}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Diagram'}
                    </button>
                  </div>
                  {diagramText && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                      <MermaidDiagram diagram={diagramText} id={`diagram-preview-${agent.id}`} />
                    </div>
                  )}
                </div>
              ) : agent.architecture_info?.connection_diagram ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <MermaidDiagram 
                    diagram={agent.architecture_info.connection_diagram} 
                    id={`connection-diagram-${agent.id}`}
                  />
                  {agent.architecture_info.diagram_updated_by && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Last updated: {agent.architecture_info.diagram_updated_at 
                        ? formatDate(agent.architecture_info.diagram_updated_at)
                        : 'Unknown'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <p className="text-xs text-muted-foreground mb-2">No connection diagram available</p>
                  <button
                    onClick={() => setIsEditingDiagram(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Add Diagram
                  </button>
                </div>
              )}
            </div>

            {agent.features && agent.features.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium mb-2">Features</h5>
                <ul className="list-disc list-inside space-y-1">
                  {agent.features.map((feature: string, idx: number) => (
                    <li key={idx} className="text-sm">{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Technical information not available</div>
        )}
      </div>
    </div>
  )
}

function BusinessTab({ request, agent, agentLoading, formatDate, requestedByUser, assignedToUser }: any) {

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Business Information</h4>
        {agentLoading ? (
          <div className="text-sm text-muted-foreground">Loading business details...</div>
        ) : agent ? (
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-muted-foreground">Agent Name:</span>
              <p className="font-medium text-lg">{agent.name}</p>
            </div>
            {agent.description && (
              <div>
                <span className="text-muted-foreground">Description:</span>
                <p className="font-medium mt-1">{agent.description}</p>
              </div>
            )}
            {agent.vendor_name && (
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p className="font-medium">{agent.vendor_name}</p>
              </div>
            )}
            {agent.use_cases && agent.use_cases.length > 0 && (
              <div>
                <h5 className="font-medium mb-2">Use Cases</h5>
                <ul className="list-disc list-inside space-y-1">
                  {agent.use_cases.map((useCase: string, idx: number) => (
                    <li key={idx} className="text-sm">{useCase}</li>
                  ))}
                </ul>
              </div>
            )}
            {agent.personas && agent.personas.length > 0 && (
              <div>
                <h5 className="font-medium mb-2">Target Personas</h5>
                <div className="space-y-2">
                  {agent.personas.map((persona: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded">
                      <p className="font-medium">{persona.name}</p>
                      {persona.description && (
                        <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {agent.data_usage_purpose && (
              <div>
                <span className="text-muted-foreground">Data Usage Purpose:</span>
                <p className="font-medium mt-1">{agent.data_usage_purpose}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Business information not available</div>
        )}
      </div>

      {/* User-Related Information */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">User & Contact Information</h4>
        <div className="space-y-4 text-sm">
          {/* Requested By User */}
          {request.requested_by && (
            <div>
              <h5 className="font-medium mb-2 text-gray-700">Agent Owner / Requested By</h5>
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{requestedByUser?.name || request.requested_by}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{requestedByUser?.email || 'N/A'}</span>
                </div>
                {requestedByUser?.department && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{requestedByUser.department}</span>
                  </div>
                )}
                {requestedByUser?.organization && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{requestedByUser.organization}</span>
                  </div>
                )}
                {requestedByUser?.role && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium capitalize">{requestedByUser.role.replace('_', ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assigned To User (Internal Point of Contact) */}
          {request.assigned_to && (
            <div>
              <h5 className="font-medium mb-2 text-gray-700">Internal Point of Contact / Assigned To</h5>
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{assignedToUser?.name || request.assigned_to_email || request.assigned_to}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{assignedToUser?.email || request.assigned_to_email || 'N/A'}</span>
                </div>
                {assignedToUser?.department && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{assignedToUser.department}</span>
                  </div>
                )}
                {assignedToUser?.organization && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{assignedToUser.organization}</span>
                  </div>
                )}
                {assignedToUser?.role && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium capitalize">{assignedToUser.role.replace('_', ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SecurityTab({ request, agent, agentLoading, formatDate }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Security & Privacy Information</h4>
        {agentLoading ? (
          <div className="text-sm text-muted-foreground">Loading security details...</div>
        ) : agent ? (
          <div className="space-y-4 text-sm">
            {agent.data_sharing_scope && (
              <div>
                <h5 className="font-medium mb-2">Data Sharing Scope</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Shares PII:</span>
                    <p className="font-medium">{agent.data_sharing_scope.shares_pii ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Shares PHI:</span>
                    <p className="font-medium">{agent.data_sharing_scope.shares_phi ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Shares Financial Data:</span>
                    <p className="font-medium">{agent.data_sharing_scope.shares_financial_data ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Shares Biometric Data:</span>
                    <p className="font-medium">{agent.data_sharing_scope.shares_biometric_data ? 'Yes' : 'No'}</p>
                  </div>
                  {agent.data_sharing_scope.data_retention_period && (
                    <div>
                      <span className="text-muted-foreground">Data Retention Period:</span>
                      <p className="font-medium">{agent.data_sharing_scope.data_retention_period}</p>
                    </div>
                  )}
                  {agent.data_sharing_scope.data_processing_location && (
                    <div>
                      <span className="text-muted-foreground">Data Processing Location:</span>
                      <p className="font-medium">{agent.data_sharing_scope.data_processing_location}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {agent.risk_score !== undefined && (
              <div>
                <span className="text-muted-foreground">Risk Score:</span>
                <p className="font-medium text-lg">{agent.risk_score}</p>
              </div>
            )}
            {agent.compliance_score !== undefined && (
              <div>
                <span className="text-muted-foreground">Compliance Score:</span>
                <p className="font-medium text-lg">{agent.compliance_score}%</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Security information not available</div>
        )}
      </div>
    </div>
  )
}

function WorkflowTab({ request, workflowConfig, formatDate }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Workflow Configuration</h4>
        {workflowConfig ? (
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-muted-foreground">Workflow Name:</span>
              <p className="font-medium">{workflowConfig.name}</p>
            </div>
            {workflowConfig.description && (
              <div>
                <span className="text-muted-foreground">Description:</span>
                <p className="font-medium mt-1">{workflowConfig.description}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Workflow Engine:</span>
              <p className="font-medium">{workflowConfig.workflow_engine}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium capitalize">{workflowConfig.status}</p>
            </div>
            {workflowConfig.workflow_steps && workflowConfig.workflow_steps.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium mb-2">Workflow Steps</h5>
                <div className="space-y-2">
                  {workflowConfig.workflow_steps.map((step: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded border ${
                        step.step_number === request.current_step
                          ? 'bg-blue-50 border-blue-300'
                          : step.step_number < request.current_step
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Step {step.step_number}: {step.step_name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({step.step_type})</span>
                        </div>
                        {step.step_number === request.current_step && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Current Step</span>
                        )}
                        {step.step_number < request.current_step && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Completed</span>
                        )}
                      </div>
                      {step.assigned_role && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Assigned Role: {step.assigned_role}
                        </div>
                      )}
                      {step.required !== undefined && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Required: {step.required ? 'Yes' : 'No'} | Can Skip: {step.can_skip ? 'Yes' : 'No'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Workflow configuration not available</div>
        )}
      </div>
    </div>
  )
}

// Helper function to format change details in a readable way
function formatChangeDetails(details: any): string {
  if (!details || typeof details !== 'object') {
    return 'No details available'
  }
  
  // If it's a simple object with key-value pairs, format nicely
  const entries = Object.entries(details)
  if (entries.length === 0) {
    return 'No changes'
  }
  
  // Format common change patterns
  const formatted: string[] = []
  for (const [key, value] of entries) {
    if (value === null || value === undefined) {
      formatted.push(`${key}: (removed)`)
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      formatted.push(`${key}: ${JSON.stringify(value)}`)
    } else {
      formatted.push(`${key}: ${String(value)}`)
    }
  }
  
  return formatted.join(', ')
}

// Helper function to get user initials for avatar
function getUserInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  if (email) {
    return email.substring(0, 2).toUpperCase()
  }
  return '??'
}

// Helper function to format relative time
function formatRelativeTime(date: string, formatDateFn: (date: string) => string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  // For older dates, use the formatDate function
  return formatDateFn(date)
}

function AuditTab({ request, agent, formatDate }: any) {
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs', request.id, agent?.id],
    queryFn: async () => {
      // Fetch audit logs for both the request and the agent
      const [requestLogs, agentLogs] = await Promise.all([
        auditApi.getLogs(
          undefined,
          undefined,
          'onboarding_request',
          request.id,
          undefined,
          undefined,
          undefined,
          100,
          0
        ).catch(() => ({ logs: [], total: 0 })),
        agent ? auditApi.getLogs(
          undefined,
          undefined,
          'agent',
          agent.id,
          undefined,
          undefined,
          undefined,
          100,
          0
        ).catch(() => ({ logs: [], total: 0 })) : Promise.resolve({ logs: [], total: 0 })
      ])
      
      // Combine and sort by date
      const allLogs = [...requestLogs.logs, ...agentLogs.logs]
      return allLogs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    enabled: !!request.id
  })

  const { data: workflowAuditTrail } = useQuery({
    queryKey: ['workflow-audit-trail', request.id],
    queryFn: () => workflowActionsApi.getAuditTrail(request.id),
    enabled: !!request.id
  })

  // Fetch user information for all unique user IDs in audit logs
  const userIds = auditLogs ? [...new Set(auditLogs.map((log: any) => log.user_id).filter(Boolean))] : []
  const userQueries = userIds.map((userId: string) => 
    useQuery({
      queryKey: ['user', userId],
      queryFn: () => usersApi.get(userId),
      enabled: !!userId,
      retry: false
    })
  )
  
  // Create a map of user_id -> user data
  const usersMap = new Map()
  userQueries.forEach((query, index) => {
    if (query.data) {
      usersMap.set(userIds[index], query.data)
    }
  })

  return (
    <div className="space-y-6">
      {/* Workflow Audit Trail */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Workflow Audit Trail</h4>
        {workflowAuditTrail && workflowAuditTrail.length > 0 ? (
          <div className="space-y-4">
            {workflowAuditTrail.map((entry: any, idx: number) => {
              // Try to get user info from performed_by (could be email or ID)
              const performedBy = entry.performed_by || entry.performed_by_email || 'System'
              const userInitials = getUserInitials(performedBy, performedBy)
              
              return (
                <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-400 hover:bg-blue-100 transition-colors">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-sm">
                      {userInitials}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* User and Action */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">{performedBy}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-sm text-gray-700 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                          {entry.step_name && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-blue-600">({entry.step_name})</span>
                            </>
                          )}
                        </div>
                        
                        {/* Comments */}
                        {entry.comments && (
                          <div className="text-sm text-gray-700 mt-2 p-2 bg-white rounded border border-gray-200">
                            {entry.comments}
                          </div>
                        )}
                        
                        {/* Status Change */}
                        {entry.previous_status && entry.new_status && (
                          <div className="text-xs text-gray-600 mt-2">
                            Status changed: <span className="line-through text-red-600">{entry.previous_status}</span> → <span className="font-medium text-green-600">{entry.new_status}</span>
                          </div>
                        )}
                        
                        {/* Action Details */}
                        {entry.action_details && Object.keys(entry.action_details).length > 0 && (
                          <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border border-gray-200">
                            <div className="font-medium text-gray-500 mb-1">Details:</div>
                            <div>{formatChangeDetails(entry.action_details)}</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(entry.created_at || entry.performed_at, formatDate)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDate(entry.created_at || entry.performed_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No workflow audit trail available</div>
        )}
      </div>

      {/* General Audit Logs */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Change History</h4>
        {auditLoading ? (
          <div className="text-sm text-muted-foreground">Loading audit logs...</div>
        ) : auditLogs && auditLogs.length > 0 ? (
          <div className="space-y-4">
            {auditLogs.map((log: any, idx: number) => {
              const user = log.user_id ? usersMap.get(log.user_id) : null
              const userName = user?.name || user?.email || 'Unknown User'
              const userEmail = user?.email || 'N/A'
              const userInitials = getUserInitials(userName, userEmail)
              
              return (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-medium text-sm">
                      {userInitials}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* User and Action */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">{userName}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-sm text-gray-700 capitalize">{log.action.replace(/_/g, ' ')}</span>
                        </div>
                        
                        {/* Change Info */}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="text-sm text-gray-600 mt-2 p-2 bg-white rounded border border-gray-200">
                            <div className="font-medium text-xs text-gray-500 mb-1">Changes:</div>
                            <div className="text-xs">{formatChangeDetails(log.details)}</div>
                          </div>
                        )}
                        
                        {/* Resource Info */}
                        <div className="text-xs text-muted-foreground mt-2">
                          {log.resource_type} {log.resource_id ? `(${log.resource_id.substring(0, 8)}...)` : ''}
                        </div>
                      </div>
                      
                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(log.created_at, formatDate)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDate(log.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No audit logs available</div>
        )}
      </div>
    </div>
  )
}

function CommentsTab({ request, agent, user, formatDate }: any) {
  const [newComment, setNewComment] = useState('')
  const queryClient = useQueryClient()

  const { data: messages, isLoading: messagesLoading, refetch } = useQuery({
    queryKey: ['messages', 'agent', agent?.id],
    queryFn: () => messagesApi.list('agent', agent?.id),
    enabled: !!agent?.id
  })

  const { data: workflowComments } = useQuery({
    queryKey: ['workflow-comments', request.id],
    queryFn: () => workflowActionsApi.getActions(request.id),
    enabled: !!request.id
  })

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => messagesApi.create({
      resource_type: 'agent',
      resource_id: agent.id,
      content,
      message_type: 'comment'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'agent', agent?.id] })
      setNewComment('')
    }
  })

  const addWorkflowCommentMutation = useMutation({
    mutationFn: (comments: string) => workflowActionsApi.addComment(request.id, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-comments', request.id] })
      queryClient.invalidateQueries({ queryKey: ['workflow-audit-trail', request.id] })
      setNewComment('')
    }
  })

  const handleAddComment = () => {
    if (!newComment.trim()) return
    
    // Add comment to both messages and workflow actions
    createCommentMutation.mutate(newComment)
    addWorkflowCommentMutation.mutate(newComment)
  }

  return (
    <div className="space-y-6">
      {/* Add Comment Form */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Add Comment</h4>
        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Enter your comment or message..."
            className="w-full h-24 p-3 border border-gray-300 rounded-md text-sm"
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim() || createCommentMutation.isPending || addWorkflowCommentMutation.isPending}
            className="compact-button-primary text-sm"
          >
            {createCommentMutation.isPending || addWorkflowCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Workflow Comments */}
      {workflowComments && workflowComments.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium mb-3 text-gray-800">Workflow Comments</h4>
          <div className="space-y-3">
            {workflowComments
              .filter((action: any) => action.action_type === 'comment' && action.comments)
              .map((action: any, idx: number) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{action.comments}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        By: {action.performed_by} • {formatDate(action.performed_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Agent Messages/Comments */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3 text-gray-800">Messages & Responses</h4>
        {messagesLoading ? (
          <div className="text-sm text-muted-foreground">Loading messages...</div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((message: any) => (
              <div key={message.id} className="border-l-4 border-gray-400 pl-4 py-2 bg-gray-50 rounded-r">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{message.sender_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">({message.message_type})</span>
                    </div>
                    <p className="text-sm text-gray-700">{message.content}</p>
                    {message.replies && message.replies.length > 0 && (
                      <div className="mt-2 ml-4 space-y-2">
                        {message.replies.map((reply: any) => (
                          <div key={reply.id} className="border-l-2 border-gray-300 pl-3 py-1 bg-white rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-xs">{reply.sender_name}</span>
                              <span className="text-xs text-muted-foreground">replied</span>
                            </div>
                            <p className="text-xs text-gray-700">{reply.content}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(reply.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    {formatDate(message.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No messages or comments yet</div>
        )}
      </div>
    </div>
  )
}

