import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowConfigApi, WorkflowConfig, WorkflowConfigCreate, WorkflowStep } from '../../lib/workflowConfig'
import { studioApi, AgenticFlowCreate } from '../../lib/studio'
import { formLayoutsApi } from '../../lib/formLayouts'
import { authApi } from '../../lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card'
import { Button } from '@/components/shared/Button'
import { Input } from '@/components/shared/Input'
import WorkflowBuilder from '../WorkflowBuilder'
import FlowBuilder from '../FlowBuilder'
import BusinessFlowBuilder from '../BusinessFlowBuilder'
import StageSettingsModal from '../StageSettingsModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Plus, Settings, Play, Eye, Save, ArrowLeft } from 'lucide-react'
import { showToast } from '../../utils/toast'

interface UnifiedWorkflowDesignerProps {
  workflowId?: string
  onClose?: () => void
  onSave?: (workflow: any) => void
}

export default function UnifiedWorkflowDesigner({ 
  workflowId, 
  onClose, 
  onSave 
}: UnifiedWorkflowDesignerProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'builder' | 'flow' | 'business' | 'stages'>('builder')
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null)
  const [formData, setFormData] = useState<WorkflowConfigCreate>({
    name: '',
    description: '',
    workflow_engine: 'internal',
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
  const [agents, setAgents] = useState<any[]>([])
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  
  // Available fields from agent submission form
  const availableFields = [
    'name',
    'type',
    'category',
    'subcategory',
    'description',
    'version',
    'llm_vendor',
    'llm_model',
    'deployment_type',
    'data_sharing_scope',
    'data_usage_purpose',
    'capabilities',
    'data_types',
    'regions',
    'use_cases',
    'features',
    'personas',
    'version_info',
    'connections',
    'compliance_requirements',
    'requirements'
  ]

  // Load user
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Load existing workflow if editing
  const { data: existingWorkflow } = useQuery({
    queryKey: ['workflow-config', workflowId],
    queryFn: () => workflowId ? workflowConfigApi.get(workflowId) : null,
    enabled: !!workflowId && !!user,
  })

  // Load agents for flow builder
  const { data: studioAgents } = useQuery({
    queryKey: ['studio-agents'],
    queryFn: () => studioApi.getAgents(),
    enabled: !!user,
  })

  useEffect(() => {
    if (existingWorkflow) {
      setWorkflowConfig(existingWorkflow)
      setFormData({
        name: existingWorkflow.name,
        description: existingWorkflow.description || '',
        workflow_engine: existingWorkflow.workflow_engine,
        integration_id: existingWorkflow.integration_id,
        workflow_steps: existingWorkflow.workflow_steps,
        assignment_rules: existingWorkflow.assignment_rules,
        conditions: existingWorkflow.conditions,
        trigger_rules: existingWorkflow.trigger_rules,
        is_default: existingWorkflow.is_default,
        status: existingWorkflow.status
      })
    }
  }, [existingWorkflow])

  useEffect(() => {
    if (studioAgents) {
      setAgents(studioAgents)
    }
  }, [studioAgents])

  // Mutations
  const createWorkflowMutation = useMutation({
    mutationFn: (data: WorkflowConfigCreate) => workflowConfigApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      showToast.success('Workflow created successfully')
      if (onSave) onSave(data)
      if (onClose) onClose()
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to create workflow')
    }
  })

  const updateWorkflowMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkflowConfigCreate> }) =>
      workflowConfigApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-configs'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-config', workflowId] })
      showToast.success('Workflow updated successfully')
      if (onSave) onSave(data)
    },
    onError: (error: any) => {
      showToast.error(error?.response?.data?.detail || 'Failed to update workflow')
    }
  })

  const createFlowMutation = useMutation({
    mutationFn: (flowData: AgenticFlowCreate) => studioApi.createFlow(flowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-flows'] })
      showToast.success('AI Flow created successfully')
    },
    onError: (error: any) => {
      showToast.error(`Failed to create flow: ${error.message || 'Unknown error'}`)
    }
  })

  const handleSaveWorkflow = async () => {
    if (!formData.name.trim()) {
      showToast.error('Please enter a workflow name')
      return
    }

    try {
      if (workflowId) {
        await updateWorkflowMutation.mutateAsync({ id: workflowId, data: formData })
      } else {
        await createWorkflowMutation.mutateAsync(formData)
      }
    } catch (error) {
      // Error handled by mutation onError
    }
  }

  const handleStepsChange = (steps: WorkflowStep[]) => {
    setFormData(prev => ({ ...prev, workflow_steps: steps }))
  }

  const handleSetFirstStep = (stepNumber: number) => {
    const updatedSteps = (formData.workflow_steps || []).map(step => ({
      ...step,
      is_first_step: step.step_number === stepNumber
    }))
    setFormData(prev => ({ ...prev, workflow_steps: updatedSteps }))
  }

  const handleStepClick = (step: WorkflowStep) => {
    setSelectedStep(step)
  }

  const handleAddStep = () => {
    const currentSteps = formData.workflow_steps || []
    const newStepNumber = Math.max(0, ...currentSteps.map(s => s.step_number)) + 1
    const newStep: WorkflowStep = {
      step_number: newStepNumber,
      step_type: 'approval',
      step_name: `Step ${newStepNumber}`,
      assigned_role: 'approver',
      required: true,
      can_skip: false,
      auto_assign: true,
      is_first_step: currentSteps.length === 0
    }
    
    setFormData(prev => ({
      ...prev,
      workflow_steps: [...(prev.workflow_steps || []), newStep]
    }))
  }

  const handleSaveFlow = async (flow: AgenticFlowCreate) => {
    await createFlowMutation.mutateAsync(flow)
  }

  const handleClose = () => {
    if (onClose) onClose()
    else navigate('/workflows')
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {workflowId ? 'Edit Workflow' : 'Create New Workflow'}
              </h1>
              <p className="text-muted-foreground">
                Design workflow processes with integrated AI capabilities
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSaveWorkflow}>
              <Save className="h-4 w-4 mr-2" />
              Save Workflow
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-80 border-r bg-card p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Workflow Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Workflow Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter workflow name"
                  required
                />
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    rows={3}
                    placeholder="Describe what this workflow does..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Workflow Steps Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Workflow Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {(formData.workflow_steps || []).map((step) => (
                    <div 
                      key={step.step_number}
                      className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                    >
                      <span className="font-medium">Step {step.step_number}</span>
                      <span className="text-muted-foreground capitalize">{step.step_type}</span>
                    </div>
                  ))}
                  {(formData.workflow_steps || []).length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No steps added yet
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={handleAddStep}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Center Panel - Designer */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
            <div className="border-b bg-card px-6">
              <TabsList>
                <TabsTrigger value="builder">Workflow Builder</TabsTrigger>
                <TabsTrigger value="flow">AI Flow Designer</TabsTrigger>
                <TabsTrigger value="business">Business Process</TabsTrigger>
                <TabsTrigger value="stages">Stage Settings</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <TabsContent value="builder" className="h-full m-0">
                <div className="h-full p-6 overflow-auto">
                  <WorkflowBuilder
                    steps={formData.workflow_steps || []}
                    onStepsChange={handleStepsChange}
                    onSetFirstStep={handleSetFirstStep}
                    onStepClick={handleStepClick}
                    canEdit={true}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="flow" className="h-full m-0">
                <div className="h-full p-6 overflow-auto">
                  <FlowBuilder
                    agents={agents}
                    onSave={handleSaveFlow}
                    onCancel={() => setActiveTab('builder')}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="business" className="h-full m-0">
                <div className="h-full p-6 overflow-auto">
                  <BusinessFlowBuilder
                    onSave={handleSaveFlow}
                    onCancel={() => setActiveTab('builder')}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="stages" className="h-full m-0">
                <div className="h-full p-6 overflow-auto">
                  <div className="max-w-4xl mx-auto">
                    <Card>
                      <CardHeader>
                        <CardTitle>Workflow Stages Configuration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Configure form layouts, permissions, and business rules for each workflow stage.
                        </p>
                        <div className="space-y-4">
                          {(formData.workflow_steps || []).map((step) => (
                            <div key={step.step_number} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-medium">Step {step.step_number}: {step.step_name}</h3>
                                  <p className="text-sm text-muted-foreground capitalize">{step.step_type}</p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStep(step)
                                  }}
                                >
                                  <Settings className="h-4 w-4 mr-2" />
                                  Configure
                                </Button>
                              </div>
                            </div>
                          ))}
                          {(formData.workflow_steps || []).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              Add workflow steps first to configure stage settings
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Stage Settings Modal */}
      <StageSettingsModal
        step={selectedStep}
        isOpen={!!selectedStep}
        onClose={() => setSelectedStep(null)}
        onSave={(updatedStep) => {
          // Update the step in formData
          const updatedSteps = (formData.workflow_steps || []).map(step => 
            step.step_number === updatedStep.step_number ? updatedStep : step
          );
          setFormData(prev => ({ ...prev, workflow_steps: updatedSteps }));
          setSelectedStep(null);
          showToast.success('Stage settings saved successfully');
        }}
        requestType="agent_onboarding_workflow"
      />
    </div>
  )
}