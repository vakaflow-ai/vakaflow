import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { entityFieldsApi, EntityTree } from '../lib/entityFields'
import { masterDataListsApi, MasterDataList } from '../lib/masterDataLists'
import { workflowConfigApi, WorkflowConfig } from '../lib/workflowConfig'
import { assessmentsApi, Assessment } from '../lib/assessments'
import { formLayoutsApi, FormLayout } from '../lib/formLayouts'
import { businessRulesApi, BusinessRule } from '../lib/businessRules'
import Layout from '../components/Layout'
import { authApi } from '../lib/auth'
import { showToast } from '../utils/toast'
import {
  Plus, X, Edit, Trash2, Settings, GitBranch, Link as LinkIcon, Workflow as WorkflowIcon,
  FileText, Calendar, Database, CheckCircle, XCircle, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react'
import { MaterialCard, MaterialButton } from '../components/material'

interface ProcessStepBranch {
  id: string
  condition_label: string
  condition_value?: string | boolean
  next_step_id?: string | null
  next_step_number?: number
}

interface ProcessStep {
  id: string
  step_number: number
  name: string
  description?: string
  step_type: 'start' | 'end' | 'entity' | 'form' | 'assessment' | 'workflow' | 'action' | 'decision' | 'custom'
  entity_name?: string | null
  entity_label?: string | null
  mapped_resource_id?: string | null
  mapped_resource_name?: string | null
  mapped_resource_type?: 'form' | 'assessment' | 'workflow' | 'rule' | null
  rule_id?: string | null
  rule_name?: string | null
  branches?: ProcessStepBranch[]
  schedule_config?: {
    frequency?: string
    enabled?: boolean
  }
  step_config?: Record<string, any>
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  connections?: string[]
}

interface BusinessProcess {
  id: string
  name: string
  description?: string
  process_type?: string
  entity_type?: string
  department?: string
  business_unit?: string
  location?: string
  steps: ProcessStep[]
  additional_attributes?: Record<string, any>
  created_at?: string
  updated_at?: string
}

function getStepIcon(stepType: string) {
  switch (stepType) {
    case 'start':
      return CheckCircle
    case 'end':
      return XCircle
    case 'entity':
      return Database
    case 'form':
      return FileText
    case 'assessment':
      return Calendar
    case 'workflow':
      return WorkflowIcon
    case 'decision':
      return GitBranch
    case 'action':
      return Settings
    default:
      return Settings
  }
}

function getEntityIcon(entityName?: string | null) {
  if (!entityName) return null
  return Database
}

interface ProcessEditorPageProps {
  process: BusinessProcess
  setProcess: (process: BusinessProcess) => void
  onBack: () => void
  onSave: () => void
  workflows: WorkflowConfig[]
  assessments: Assessment[]
  formLayouts: FormLayout[]
  businessRules: BusinessRule[]
  entities: Array<{ entity_name: string; entity_label: string; category: string }>
  departments: Array<{ value: string; label: string }>
  masterDataLists: MasterDataList[]
}

function ProcessEditorPage({
  process,
  setProcess,
  onBack,
  onSave,
  workflows,
  assessments,
  formLayouts,
  businessRules,
  entities,
  departments,
  masterDataLists,
}: ProcessEditorPageProps) {
  const [currentStep, setCurrentStep] = useState<'config' | 'flow'>('config')
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [draggedStep, setDraggedStep] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [connectingFromBranch, setConnectingFromBranch] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [mappingStep, setMappingStep] = useState<string | null>(null)
  const [mappingType, setMappingType] = useState<'form' | 'assessment' | 'workflow' | 'rule' | 'entity' | null>(null)
  const [toolboxExpanded, setToolboxExpanded] = useState(true)
  const [configPanelExpanded, setConfigPanelExpanded] = useState(true)
  const [resizingStep, setResizingStep] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [hoveredConnection, setHoveredConnection] = useState<{ from: string; to: string } | null>(null)

  const onUpdateStep = (stepId: string, updates: Partial<ProcessStep>) => {
    setProcess({
      ...process,
      steps: process.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    })
  }

  const onRemoveStep = (stepId: string) => {
    setProcess({
      ...process,
      steps: process.steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, step_number: idx + 1 })),
    })
    if (selectedStep === stepId) setSelectedStep(null)
  }

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const handleAddBranch = (stepId: string) => {
    const step = process.steps.find(s => s.id === stepId)
    if (!step) return
    const newBranch: ProcessStepBranch = {
      id: `branch-${Date.now()}`,
      condition_label: 'New Branch',
      condition_value: true,
      next_step_id: null,
    }
    onUpdateStep(stepId, {
      branches: [...(step.branches || []), newBranch],
    })
  }

  const handleUpdateBranch = (stepId: string, branchId: string, updates: Partial<ProcessStepBranch>) => {
    const step = process.steps.find(s => s.id === stepId)
    if (!step || !step.branches) return
    onUpdateStep(stepId, {
      branches: step.branches.map(b => b.id === branchId ? { ...b, ...updates } : b),
    })
  }

  const handleRemoveBranch = (stepId: string, branchId: string) => {
    const step = process.steps.find(s => s.id === stepId)
    if (!step || !step.branches) return
    onUpdateStep(stepId, {
      branches: step.branches.filter(b => b.id !== branchId),
    })
  }

  const handleMapBranchToStep = (stepId: string, branchId: string, nextStepId: string | null) => {
    handleUpdateBranch(stepId, branchId, { next_step_id: nextStepId })
  }

  const onMapResource = (stepId: string, resourceType: 'form' | 'assessment' | 'workflow' | 'rule', resourceId: string) => {
    let resourceName = ''
    if (resourceType === 'form') {
      const resource = formLayouts.find(f => f.id === resourceId)
      resourceName = resource?.name || ''
    } else if (resourceType === 'assessment') {
      const resource = assessments.find(a => a.id === resourceId)
      resourceName = resource?.name || ''
    } else if (resourceType === 'workflow') {
      const resource = workflows.find(w => w.id === resourceId)
      resourceName = resource?.name || ''
    } else if (resourceType === 'rule') {
      const resource = businessRules.find(r => r.id === resourceId)
      resourceName = resource?.name || ''
      onUpdateStep(stepId, {
        rule_id: resourceId,
        rule_name: resourceName,
        mapped_resource_type: 'rule',
      })
      return
    }
    onUpdateStep(stepId, {
      mapped_resource_id: resourceId,
      mapped_resource_name: resourceName,
      mapped_resource_type: resourceType,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                title="Back to processes"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {process.id.startsWith('process-') ? 'Create' : 'Edit'} Business Process
                </h1>
                <p className="text-sm text-gray-600 mt-1">Configure process using entities, forms, assessments, and workflows from catalog</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MaterialButton onClick={onBack} variant="outlined">
                Cancel
              </MaterialButton>
              <MaterialButton onClick={onSave} variant="contained">
                Save Process
              </MaterialButton>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-6 py-6 overflow-hidden">
        {/* Step Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setCurrentStep('config')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                currentStep === 'config' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                <span>Process Configuration</span>
              </div>
            </button>
            <button
              onClick={() => setCurrentStep('flow')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                currentStep === 'flow' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <span>Flow Designer</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-hidden">
          {currentStep === 'config' ? (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Process Name</label>
                  <input
                    type="text"
                    value={process.name}
                    onChange={(e) => setProcess({ ...process, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={process.department || ''}
                    onChange={(e) => setProcess({ ...process, department: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.value} value={dept.value}>{dept.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={process.description || ''}
                  onChange={(e) => setProcess({ ...process, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-0 h-full overflow-hidden">
              {/* Left Toolbox */}
              <div className={`relative flex-shrink-0 border-r border-gray-200 transition-all duration-300 ${toolboxExpanded ? 'w-64' : 'w-12'} overflow-visible`}>
                <div className={`h-full ${toolboxExpanded ? 'px-4' : 'px-2'}`}>
                  <div className="flex items-center justify-between mb-3 h-8 relative">
                    {toolboxExpanded && <h5 className="font-semibold text-gray-900">Toolbox</h5>}
                    <button
                      onClick={() => setToolboxExpanded(!toolboxExpanded)}
                      className={`absolute ${toolboxExpanded ? '-right-3' : 'right-2'} top-0 z-10 w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors`}
                      title={toolboxExpanded ? 'Collapse Toolbox' : 'Expand Toolbox'}
                    >
                      {toolboxExpanded ? (
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                  {toolboxExpanded && (
                  <div className="space-y-2">
                  <button
                    onClick={() => {
                      const hasStart = process.steps.some(s => s.step_type === 'start')
                      if (!hasStart) {
                        const newStep: ProcessStep = {
                          id: `step-${Date.now()}`,
                          step_number: process.steps.length + 1,
                          name: 'Start',
                          step_type: 'start',
                          position: { x: 100, y: 100 },
                          size: { width: 96, height: 96 },
                          connections: [],
                        }
                        setProcess({ ...process, steps: [...process.steps, newStep] })
                      } else {
                        showToast.error('Flow can only have one Start node')
                      }
                    }}
                    className="w-full px-3 py-2 bg-green-50 border-2 border-green-300 rounded-lg text-green-700 hover:bg-green-100 transition-colors text-left flex items-center gap-2"
                  >
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="font-medium">Start</span>
                  </button>
                  <button
                    onClick={() => {
                        const newStep: ProcessStep = {
                          id: `step-${Date.now()}`,
                          step_number: process.steps.length + 1,
                          name: `Step ${process.steps.length + 1}`,
                          step_type: 'action',
                          position: { x: 200 + (process.steps.length % 3) * 250, y: 150 + Math.floor(process.steps.length / 3) * 150 },
                          size: { width: 192, height: 96 },
                          connections: [],
                        }
                      setProcess({ ...process, steps: [...process.steps, newStep] })
                    }}
                    className="w-full px-3 py-2 bg-blue-50 border-2 border-blue-300 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors text-left flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="font-medium">Step</span>
                  </button>
                  <button
                    onClick={() => {
                        const newStep: ProcessStep = {
                          id: `step-${Date.now()}`,
                          step_number: process.steps.length + 1,
                          name: 'Decision',
                          step_type: 'decision',
                          position: { x: 200 + (process.steps.length % 3) * 250, y: 150 + Math.floor(process.steps.length / 3) * 150 },
                          size: { width: 128, height: 128 },
                          connections: [],
                          branches: [
                            { id: `branch-${Date.now()}-1`, condition_label: 'Yes', condition_value: true, next_step_id: null },
                            { id: `branch-${Date.now()}-2`, condition_label: 'No', condition_value: false, next_step_id: null },
                          ],
                        }
                      setProcess({ ...process, steps: [...process.steps, newStep] })
                    }}
                    className="w-full px-3 py-2 bg-purple-50 border-2 border-purple-300 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors text-left flex items-center gap-2"
                  >
                    <GitBranch className="w-4 h-4" />
                    <span className="font-medium">Decision</span>
                  </button>
                  <button
                    onClick={() => {
                      const hasEnd = process.steps.some(s => s.step_type === 'end')
                      if (!hasEnd) {
                        const newStep: ProcessStep = {
                          id: `step-${Date.now()}`,
                          step_number: process.steps.length + 1,
                          name: 'End',
                          step_type: 'end',
                          position: { x: 200 + (process.steps.length % 3) * 250, y: 150 + Math.floor(process.steps.length / 3) * 150 },
                          size: { width: 96, height: 96 },
                          connections: [],
                        }
                        setProcess({ ...process, steps: [...process.steps, newStep] })
                      } else {
                        showToast.error('Flow can only have one End node')
                      }
                    }}
                    className="w-full px-3 py-2 bg-red-50 border-2 border-red-300 rounded-lg text-red-700 hover:bg-red-100 transition-colors text-left flex items-center gap-2"
                  >
                    <div className="w-3 h-3 rounded-full bg-red-600"></div>
                    <span className="font-medium">End</span>
                  </button>
                  </div>
                  )}
                </div>
              </div>

              {/* Flow Designer */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex items-center justify-between mb-4 px-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">Process Flow Diagram</h4>
                    <p className="text-sm text-gray-600 mt-1">Drag steps to reposition, click to connect, right-click to configure</p>
                  </div>
                </div>

                {/* Flowchart Canvas */}
                <div 
                  className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex-1 overflow-auto mx-4"
                  style={{ minHeight: '600px' }}
                  onMouseMove={(e) => {
                    if (connectingFrom) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                    }
                    if (draggedStep && dragOffset && !resizingStep) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const newX = e.clientX - rect.left - dragOffset.x
                      const newY = e.clientY - rect.top - dragOffset.y
                      const step = process.steps.find(s => s.id === draggedStep)
                      if (step) {
                        onUpdateStep(draggedStep, { position: { x: Math.max(0, newX), y: Math.max(0, newY) } })
                      }
                    }
                    if (resizingStep && resizeStart) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const deltaX = e.clientX - resizeStart.x
                      const deltaY = e.clientY - resizeStart.y
                      const newWidth = Math.max(120, resizeStart.width + deltaX)
                      const newHeight = Math.max(60, resizeStart.height + deltaY)
                      onUpdateStep(resizingStep, { size: { width: newWidth, height: newHeight } })
                    }
                  }}
                  onMouseUp={(e) => {
                    if (connectingFrom && selectedStep && selectedStep !== connectingFrom) {
                      const fromStep = process.steps.find(s => s.id === connectingFrom)
                      if (fromStep) {
                        // If connecting from a branch, map to that branch
                        if (connectingFromBranch) {
                          const branch = fromStep.branches?.find(b => b.id === connectingFromBranch)
                          if (branch) {
                            // Check if branch already has a connection
                            if (branch.next_step_id === selectedStep) {
                              showToast.error('This branch is already connected to this step')
                            } else {
                              handleMapBranchToStep(connectingFrom, connectingFromBranch, selectedStep)
                            }
                          }
                        } else {
                          // Regular connection (non-branch)
                          const existingConnections = fromStep.connections || []
                          if (existingConnections.includes(selectedStep)) {
                            showToast.error('Connection already exists')
                          } else {
                            // For non-decision steps, only allow one connection
                            if (fromStep.step_type !== 'decision' && existingConnections.length > 0) {
                              showToast.error('Only decision steps can have multiple connections. Use branches for decision steps.')
                              setConnectingFrom(null)
                              setConnectingFromBranch(null)
                              setMousePos(null)
                              setDraggedStep(null)
                              setDragOffset(null)
                              return
                            }
                            const updatedConnections = [...existingConnections, selectedStep]
                            onUpdateStep(connectingFrom, { connections: updatedConnections })
                          }
                        }
                      }
                    }
                    setConnectingFrom(null)
                    setConnectingFromBranch(null)
                    setMousePos(null)
                    setDraggedStep(null)
                    setDragOffset(null)
                    setResizingStep(null)
                    setResizeStart(null)
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedStep(null)
                    }
                  }}
                >
                  <div className="relative" style={{ width: '100%', minHeight: '800px', padding: '40px' }}>
                    {/* Grid Background */}
                    <div 
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: 'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                      }}
                    />

                    {/* Flowchart Steps */}
                    {process.steps.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <WorkflowIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-600 font-medium">No steps yet</p>
                          <p className="text-sm text-gray-500 mt-1">Use the toolbox to add steps to your flow</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Connection Lines */}
                        {process.steps.map((step) => {
                          const connections: Array<{ targetId: string; branchId?: string; branchLabel?: string }> = []
                          
                          // For decision steps, use branches; for others, use connections array
                          if (step.step_type === 'decision' && step.branches) {
                            // Decision steps: show connections from branches
                            step.branches.forEach(branch => {
                              if (branch.next_step_id) {
                                connections.push({ 
                                  targetId: branch.next_step_id, 
                                  branchId: branch.id,
                                  branchLabel: branch.condition_label 
                                })
                              }
                            })
                          } else {
                            // Regular steps: use connections array
                            if (step.connections && step.connections.length > 0) {
                              step.connections.forEach(targetId => {
                                connections.push({ targetId })
                              })
                            }
                          }
                          
                          if (connections.length === 0) return null
                          
                          return connections.map((conn, idx) => {
                            const targetStep = process.steps.find(s => s.id === conn.targetId)
                            if (!targetStep || !step.position || !targetStep.position) return null
                            
                            const fromSize = step.size || (step.step_type === 'decision' ? { width: 128, height: 128 } : step.step_type === 'start' || step.step_type === 'end' ? { width: 96, height: 96 } : { width: 192, height: 96 })
                            const toSize = targetStep.size || (targetStep.step_type === 'decision' ? { width: 128, height: 128 } : targetStep.step_type === 'start' || targetStep.step_type === 'end' ? { width: 96, height: 96 } : { width: 192, height: 96 })
                            
                            // Calculate connection points
                            let startX: number, startY: number, endX: number, endY: number
                            
                            if (step.step_type === 'decision' && conn.branchId) {
                              // For decision branches, connect from branch label position
                              const branch = step.branches?.find(b => b.id === conn.branchId)
                              const branchIndex = step.branches?.findIndex(b => b.id === conn.branchId) ?? 0
                              const totalBranches = step.branches?.length ?? 1
                              const isLeftBranch = branchIndex < totalBranches / 2
                              const branchX = isLeftBranch ? -40 : 40
                              
                              // Start from branch label position (below decision node)
                              startX = step.position.x + fromSize.width / 2 + branchX
                              startY = step.position.y + fromSize.height + 20 + (branchIndex - (totalBranches - 1) / 2) * 20
                              endX = targetStep.position.x + (targetStep.step_type === 'decision' ? toSize.width / 2 : 0)
                              endY = targetStep.position.y + (targetStep.step_type === 'decision' ? toSize.height / 2 : toSize.height / 2)
                            } else {
                              // Regular connections
                              startX = step.position.x + (step.step_type === 'decision' ? fromSize.width / 2 : fromSize.width)
                              startY = step.position.y + (step.step_type === 'decision' ? fromSize.height / 2 : fromSize.height / 2)
                              endX = targetStep.position.x + (targetStep.step_type === 'decision' ? toSize.width / 2 : 0)
                              endY = targetStep.position.y + (targetStep.step_type === 'decision' ? toSize.height / 2 : toSize.height / 2)
                            }
                            
                            const midX = (startX + endX) / 2
                            const midY = (startY + endY) / 2
                            
                            return (
                              <g key={`conn-${step.id}-${conn.targetId}-${conn.branchId || idx}`}>
                                <svg
                                  className="absolute pointer-events-auto cursor-pointer"
                                  style={{
                                    left: `${Math.min(startX, endX) - 5}px`,
                                    top: `${Math.min(startY, endY) - 5}px`,
                                    width: `${Math.abs(endX - startX) + 10}px`,
                                    height: `${Math.abs(endY - startY) + 10}px`,
                                    zIndex: 5,
                                  }}
                                  onMouseEnter={() => setHoveredConnection({ from: step.id, to: conn.targetId })}
                                  onMouseLeave={() => setHoveredConnection(null)}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (conn.branchId) {
                                      // Delete branch connection
                                      if (window.confirm('Delete this branch connection?')) {
                                        handleUpdateBranch(step.id, conn.branchId, { next_step_id: null })
                                      }
                                    } else {
                                      // Delete regular connection
                                      if (window.confirm('Delete this connection?')) {
                                        const updatedConnections = (step.connections || []).filter(id => id !== conn.targetId)
                                        onUpdateStep(step.id, { connections: updatedConnections })
                                      }
                                    }
                                  }}
                                >
                                  <defs>
                                    <marker
                                      id={`arrow-${step.id}-${conn.targetId}-${conn.branchId || ''}`}
                                      markerWidth="10"
                                      markerHeight="10"
                                      refX="9"
                                      refY="3"
                                      orient="auto"
                                    >
                                      <polygon points="0 0, 10 3, 0 6" fill={conn.branchId ? "#8b5cf6" : "#6b7280"} />
                                    </marker>
                                  </defs>
                                  <path
                                    d={`M ${startX - Math.min(startX, endX) + 5} ${startY - Math.min(startY, endY) + 5} L ${endX - Math.min(startX, endX) + 5} ${endY - Math.min(startY, endY) + 5}`}
                                    stroke={hoveredConnection?.from === step.id && hoveredConnection?.to === conn.targetId ? "#ef4444" : conn.branchId ? "#8b5cf6" : "#4b5563"}
                                    strokeWidth={hoveredConnection?.from === step.id && hoveredConnection?.to === conn.targetId ? "4" : conn.branchId ? "3" : "2.5"}
                                    fill="none"
                                    markerEnd={`url(#arrow-${step.id}-${conn.targetId}-${conn.branchId || ''})`}
                                    style={{ filter: hoveredConnection?.from === step.id && hoveredConnection?.to === conn.targetId ? 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.5))' : 'none' }}
                                  />
                                </svg>
                                {/* Branch label on connection */}
                                {conn.branchLabel && (
                                  <div
                                    className="absolute pointer-events-none"
                                    style={{
                                      left: `${midX - 25}px`,
                                      top: `${midY - 12}px`,
                                      zIndex: 6,
                                    }}
                                  >
                                    <div className="px-2.5 py-1 bg-purple-100 border-2 border-purple-400 rounded-md text-[11px] font-bold text-purple-900 shadow-md whitespace-nowrap">
                                      {conn.branchLabel}
                                    </div>
                                  </div>
                                )}
                              </g>
                            )
                          })
                        })}

                        {/* Temporary connection line while dragging */}
                        {connectingFrom && mousePos && (() => {
                          const fromStep = process.steps.find(s => s.id === connectingFrom)
                          if (!fromStep || !fromStep.position) return null
                          
                          const fromSize = fromStep.size || (fromStep.step_type === 'decision' ? { width: 128, height: 128 } : fromStep.step_type === 'start' || fromStep.step_type === 'end' ? { width: 96, height: 96 } : { width: 192, height: 96 })
                          const startX = fromStep.position.x + (fromStep.step_type === 'decision' ? fromSize.width / 2 : fromSize.width)
                          const startY = fromStep.position.y + (fromStep.step_type === 'decision' ? fromSize.height / 2 : fromSize.height / 2)
                          
                          return (
                            <svg
                              className="absolute pointer-events-none"
                              style={{
                                left: `${Math.min(startX, mousePos.x)}px`,
                                top: `${Math.min(startY, mousePos.y)}px`,
                                width: `${Math.abs(mousePos.x - startX)}px`,
                                height: `${Math.abs(mousePos.y - startY)}px`,
                                zIndex: 50,
                              }}
                            >
                              <path
                                d={`M ${startX - Math.min(startX, mousePos.x)} ${startY - Math.min(startY, mousePos.y)} L ${mousePos.x - Math.min(startX, mousePos.x)} ${mousePos.y - Math.min(startY, mousePos.y)}`}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                fill="none"
                              />
                            </svg>
                          )
                        })()}

                        {/* Render Steps as Flowchart Nodes */}
                        {process.steps.map((step) => {
                          const StepIcon = getStepIcon(step.step_type)
                          const EntityIcon = getEntityIcon(step.entity_name)
                          const isDecision = step.step_type === 'decision'
                          const isStart = step.step_type === 'start'
                          const isEnd = step.step_type === 'end'
                          const isSelected = selectedStep === step.id
                          
                          const position = step.position || { x: 200, y: 200 }
                          const x = position.x
                          const y = position.y
                          
                          // Get size from step or use defaults
                          const defaultSize = isDecision 
                            ? { width: 128, height: 128 } 
                            : isStart || isEnd 
                            ? { width: 96, height: 96 } 
                            : { width: 192, height: 96 }
                          const size = step.size || defaultSize

                          return (
                            <div key={step.id}>
                              {/* Step Node */}
                              <div
                                className={`absolute cursor-move group ${isSelected ? 'ring-4 ring-blue-500' : ''}`}
                                style={{
                                  left: `${x}px`,
                                  top: `${y}px`,
                                  width: `${size.width}px`,
                                  height: `${size.height}px`,
                                  zIndex: isSelected ? 15 : 10,
                                }}
                                onMouseDown={(e) => {
                                  // Don't start drag if clicking on resize handle or connection button
                                  if (e.button === 0 && !(e.target as HTMLElement).closest('.resize-handle') && !(e.target as HTMLElement).closest('.connection-button')) {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect()
                                    if (parentRect) {
                                      setDragOffset({
                                        x: e.clientX - rect.left,
                                        y: e.clientY - rect.top,
                                      })
                                      setDraggedStep(step.id)
                                      setSelectedStep(step.id)
                                    }
                                  }
                                }}
                                onMouseUp={(e) => {
                                  if (e.button === 2 || (e.button === 0 && !draggedStep)) {
                                    setSelectedStep(step.id)
                                  }
                                  setDraggedStep(null)
                                  setDragOffset(null)
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  setSelectedStep(step.id)
                                }}
                                onDoubleClick={() => toggleStep(step.id)}
                              >
                                <div
                                  className={`relative h-full rounded-lg shadow-md border-2 transition-all hover:shadow-lg ${
                                    isStart
                                      ? 'bg-green-100 border-green-400 rounded-full'
                                      : isEnd
                                      ? 'bg-red-100 border-red-400 rounded-full'
                                      : isDecision
                                      ? 'bg-purple-100 border-purple-300 transform rotate-45'
                                      : step.step_type === 'entity'
                                      ? 'bg-yellow-100 border-yellow-300'
                                      : 'bg-blue-50 border-blue-200'
                                  }`}
                                >
                                  {!isStart && !isEnd && (
                                    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md z-25">
                                      {step.step_number}
                                    </div>
                                  )}

                                  <div className={`h-full flex flex-col items-center justify-center p-2 ${isDecision ? 'transform -rotate-45' : ''}`}>
                                    {!isStart && !isEnd && (
                                      <div className="flex items-center gap-1 mb-1">
                                        <StepIcon className={`w-4 h-4 ${isDecision ? 'text-purple-700' : 'text-gray-700'}`} />
                                        {step.entity_name && EntityIcon && (
                                          <EntityIcon className="w-3 h-3 text-indigo-600" />
                                        )}
                                      </div>
                                    )}
                                    <div className={`text-xs font-semibold text-center text-gray-900 leading-tight px-1 ${isStart || isEnd ? 'text-sm' : ''}`}>
                                      {step.name}
                                    </div>
                                    {step.mapped_resource_name && !isStart && !isEnd && (
                                      <div className="text-[10px] text-gray-600 mt-0.5 text-center truncate w-full px-1">
                                        {step.mapped_resource_name}
                                      </div>
                                    )}
                                  </div>

                                  {/* Connection Button - only show for non-decision, non-end steps */}
                                  {!isEnd && !isDecision && (
                                    <div 
                                      className={`connection-button absolute top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-40 flex items-center justify-center border-2 border-white shadow-md hover:bg-blue-600 ${isSelected ? 'right-6' : 'right-0 translate-x-1/2'}`}
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        setConnectingFrom(step.id)
                                        setConnectingFromBranch(null)
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // Don't trigger if we're just starting a connection
                                        if (!connectingFrom) {
                                          setConnectingFrom(step.id)
                                          setConnectingFromBranch(null)
                                        }
                                      }}
                                      title="Click to start connection"
                                    >
                                      <div className="w-2 h-2 rounded-full bg-white"></div>
                                    </div>
                                  )}
                                  
                                  {/* Edit/Delete Buttons - positioned top-right */}
                                  <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-40">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleStep(step.id)
                                      }}
                                      className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-md"
                                      title="Edit step"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onRemoveStep(step.id)
                                        if (selectedStep === step.id) setSelectedStep(null)
                                      }}
                                      className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow-md"
                                      title="Delete step"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Resize Handle - positioned bottom-right, only when selected */}
                                  {isSelected && (
                                    <div
                                      className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize bg-blue-500 rounded-tl-lg z-40 hover:bg-blue-600 translate-x-1/2 translate-y-1/2"
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        setResizingStep(step.id)
                                        setResizeStart({
                                          x: e.clientX,
                                          y: e.clientY,
                                          width: size.width,
                                          height: size.height,
                                        })
                                      }}
                                      title="Drag to resize"
                                    >
                                      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-r-2 border-b-2 border-white"></div>
                                    </div>
                                  )}

                                  {isDecision && step.branches && step.branches.length > 0 && (
                                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                                      {step.branches.map((branch, branchIdx) => {
                                        const totalBranches = step.branches?.length ?? 1
                                        const isLeftBranch = branchIdx < totalBranches / 2
                                        const branchX = isLeftBranch ? -40 : 40
                                        
                                        return (
                                          <div
                                            key={branch.id}
                                            className="relative group/branch"
                                            style={{
                                              transform: `translateX(${branchX}px)`,
                                            }}
                                          >
                                            <div className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-[10px] font-medium shadow-sm">
                                              {branch.condition_label}
                                            </div>
                                            {/* Connection button on branch label */}
                                            <div 
                                              className="connection-button absolute top-1/2 -right-4 transform -translate-y-1/2 w-5 h-5 rounded-full bg-purple-500 opacity-0 group-hover/branch:opacity-100 transition-opacity cursor-crosshair z-40 flex items-center justify-center border-2 border-white shadow-md hover:bg-purple-600"
                                              onMouseDown={(e) => {
                                                e.stopPropagation()
                                                setConnectingFrom(step.id)
                                                setConnectingFromBranch(branch.id)
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (!connectingFrom) {
                                                  setConnectingFrom(step.id)
                                                  setConnectingFromBranch(branch.id)
                                                }
                                              }}
                                              title={`Connect from ${branch.condition_label}`}
                                            >
                                              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Configuration Panel */}
              {selectedStep && (() => {
                const step = process.steps.find(s => s.id === selectedStep)
                if (!step) return null
                
                return (
                  <div className={`relative flex-shrink-0 border-l border-gray-200 transition-all duration-300 ${configPanelExpanded ? 'w-80' : 'w-12'} overflow-visible`}>
                    <div className={`h-full ${configPanelExpanded ? 'pl-4 pr-4' : 'pl-2 pr-2'} overflow-y-auto`} style={{ maxHeight: 'calc(100vh - 200px)' }}>
                      <div className="flex items-center justify-between mb-2 h-8 sticky top-0 bg-white z-10 pb-2 relative">
                        {configPanelExpanded && <h5 className="font-semibold text-gray-900">Step Configuration</h5>}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setConfigPanelExpanded(!configPanelExpanded)}
                            className={`w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors ${!configPanelExpanded ? 'absolute -left-3' : ''}`}
                            title={configPanelExpanded ? 'Collapse Panel' : 'Expand Panel'}
                          >
                            {configPanelExpanded ? (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronLeft className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          {configPanelExpanded && (
                            <button
                              onClick={() => setSelectedStep(null)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Close"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {configPanelExpanded && (
                        <StepConfigurationPanel
                          step={step}
                          onUpdate={(updates) => onUpdateStep(step.id, updates)}
                          onMapResource={onMapResource}
                          setMappingStep={setMappingStep}
                          setMappingType={setMappingType}
                          workflows={workflows}
                          assessments={assessments}
                          formLayouts={formLayouts}
                          businessRules={businessRules}
                          entities={entities}
                          process={process}
                          handleAddBranch={handleAddBranch}
                          handleUpdateBranch={handleUpdateBranch}
                          handleRemoveBranch={handleRemoveBranch}
                          handleMapBranchToStep={handleMapBranchToStep}
                        />
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Resource Mapping Modal */}
      {mappingStep && mappingType && mappingType !== 'entity' && (() => {
        const step = process.steps.find(s => s.id === mappingStep)
        if (!step) return null

        const getResources = () => {
          switch (mappingType) {
            case 'form':
              return formLayouts.map(f => ({ id: f.id, name: f.name, description: f.description }))
            case 'assessment':
              return assessments.map(a => ({ id: a.id, name: a.name, description: a.description }))
            case 'workflow':
              return workflows.map(w => ({ id: w.id, name: w.name, description: w.description }))
            case 'rule':
              return businessRules.map(r => ({ id: r.id, name: r.name, description: r.condition_expression }))
            default:
              return []
          }
        }

        const resources = getResources()
        const resourceTypeLabel = mappingType === 'form' ? 'Form' : mappingType === 'assessment' ? 'Assessment' : mappingType === 'workflow' ? 'Workflow' : 'Business Rule'

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
            setMappingStep(null)
            setMappingType(null)
          }}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Select {resourceTypeLabel}</h3>
                <button
                  onClick={() => {
                    setMappingStep(null)
                    setMappingType(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {resources.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No {resourceTypeLabel.toLowerCase()}s available</p>
                    <p className="text-sm text-gray-500 mt-2">Please create a {resourceTypeLabel.toLowerCase()} first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {resources.map((resource) => (
                      <button
                        key={resource.id}
                        onClick={() => {
                          if (mappingType === 'form' || mappingType === 'assessment' || mappingType === 'workflow' || mappingType === 'rule') {
                            onMapResource(mappingStep, mappingType, resource.id)
                            setMappingStep(null)
                            setMappingType(null)
                          }
                        }}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{resource.name}</div>
                        {resource.description && (
                          <div className="text-sm text-gray-600 mt-1">{resource.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default function Entities() {
  const [user, setUser] = useState<any>(null)
  const [processes, setProcesses] = useState<BusinessProcess[]>([])
  const [editingProcess, setEditingProcess] = useState<BusinessProcess | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  // Load processes from backend
  const { data: workflowGroups } = useQuery({
    queryKey: ['workflow-layout-groups'],
    queryFn: () => formLayoutsApi.listGroups(),
    enabled: !!user,
  })

  // Convert WorkflowLayoutGroup to BusinessProcess
  useEffect(() => {
    if (workflowGroups) {
      const loadedProcesses: BusinessProcess[] = workflowGroups.map((group) => {
        // Extract process definition from stage_mappings._process_definition if it exists
        const processDefinition = (group.stage_mappings as any)?._process_definition
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          steps: processDefinition?.steps || [],
          additional_attributes: processDefinition?.additional_attributes || {},
          created_at: group.created_at,
          updated_at: group.updated_at,
        }
      })
      setProcesses(loadedProcesses)
    }
  }, [workflowGroups])

  const { data: entityTree } = useQuery({
    queryKey: ['entity-tree'],
    queryFn: () => entityFieldsApi.getTree(),
    enabled: !!user,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => masterDataListsApi.get('department'),
    enabled: !!user,
  })

  const { data: masterDataLists } = useQuery({
    queryKey: ['master-data-lists'],
    queryFn: () => masterDataListsApi.list(undefined, true),
    enabled: !!user,
  })

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowConfigApi.list(),
    enabled: !!user,
  })

  const { data: assessments } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => assessmentsApi.list(),
    enabled: !!user,
  })

  const { data: formLayouts } = useQuery({
    queryKey: ['form-layouts'],
    queryFn: () => formLayoutsApi.list(),
    enabled: !!user,
  })

  const { data: businessRules } = useQuery({
    queryKey: ['business-rules'],
    queryFn: () => businessRulesApi.list(),
    enabled: !!user,
  })

  const entities = useMemo(() => {
    if (!entityTree) return []
    return entityTree.flatMap(category => 
      category.entities.map(e => ({
        entity_name: e.entity_name,
        entity_label: e.entity_label,
        category: category.category,
      }))
    )
  }, [entityTree])

  const handleCreateProcess = () => {
    const newProcess: BusinessProcess = {
      id: `process-${Date.now()}`,
      name: 'New Business Process',
      description: '',
      steps: [],
      additional_attributes: {},
    }
    setEditingProcess(newProcess)
  }

  const handleSaveProcess = async () => {
    if (!editingProcess) return
    
    try {
      // Prepare the process definition to store
      const processDefinition = {
        steps: editingProcess.steps,
        additional_attributes: editingProcess.additional_attributes || {},
      }

      // Check if this is a new process (ID starts with 'process-') or existing
      const isNew = editingProcess.id.startsWith('process-')
      
      if (isNew) {
        // Create new workflow layout group
        const groupData: any = {
          name: editingProcess.name,
          request_type: editingProcess.process_type || 'agent_onboarding_workflow',
          description: editingProcess.description || '',
          covered_entities: editingProcess.additional_attributes?.covered_entities || [],
          stage_mappings: {
            _process_definition: processDefinition,
            // Add default stage mappings if needed
            submission: { layout_id: '', name: 'Submission' },
            approval: { layout_id: '', name: 'Approval' },
            rejection: { layout_id: '', name: 'Rejection' },
            completion: { layout_id: '', name: 'Completion' },
          },
        }
        
        const createdGroup = await formLayoutsApi.createGroup(groupData)
        
        // Update local state with the created process
        const newProcess: BusinessProcess = {
          ...editingProcess,
          id: createdGroup.id,
          created_at: createdGroup.created_at,
          updated_at: createdGroup.updated_at,
        }
        setProcesses([...processes, newProcess])
        setEditingProcess(null)
        queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
        showToast.success('Process created successfully')
      } else {
        // Update existing workflow layout group
        const existingGroup = workflowGroups?.find(g => g.id === editingProcess.id)
        const existingStageMappings = existingGroup?.stage_mappings || {}
        // Remove old _process_definition if it exists and add new one
        const { _process_definition, ...otherMappings } = existingStageMappings as any
        
        const groupData: any = {
          name: editingProcess.name,
          description: editingProcess.description || '',
          covered_entities: editingProcess.additional_attributes?.covered_entities || [],
          stage_mappings: {
            ...otherMappings,
            _process_definition: processDefinition,
          },
        }
        
        await formLayoutsApi.updateGroup(editingProcess.id, groupData)
        
        // Update local state
        setProcesses(processes.map(p => p.id === editingProcess.id ? editingProcess : p))
        setEditingProcess(null)
        queryClient.invalidateQueries({ queryKey: ['workflow-layout-groups'] })
        showToast.success('Process updated successfully')
      }
    } catch (error: any) {
      console.error('Error saving process:', error)
      showToast.error(error?.response?.data?.detail || 'Failed to save process')
    }
  }

  // If editing a process, show full-page editor
  if (editingProcess) {
    return (
      <Layout user={user}>
        <ProcessEditorPage
          process={editingProcess}
          setProcess={setEditingProcess}
          onBack={() => setEditingProcess(null)}
          onSave={handleSaveProcess}
          workflows={workflows || []}
          assessments={assessments || []}
          formLayouts={formLayouts || []}
          businessRules={businessRules || []}
          entities={entities}
          departments={departments?.values || []}
          masterDataLists={masterDataLists || []}
        />
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Process Designer</h1>
            <p className="text-sm text-gray-600 mt-1">Configure processes using entities, forms, assessments, and workflows from catalog</p>
          </div>
          <MaterialButton onClick={handleCreateProcess} variant="contained" className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Process
          </MaterialButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {processes.map((process) => (
            <MaterialCard key={process.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{process.name}</h3>
                <button
                  onClick={() => setEditingProcess(process)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              {process.description && (
                <p className="text-sm text-gray-600 mb-2">{process.description}</p>
              )}
              <div className="text-xs text-gray-500">
                {process.steps.length} step{process.steps.length !== 1 ? 's' : ''}
              </div>
            </MaterialCard>
          ))}
        </div>
      </div>
    </Layout>
  )
}

// Add this component before the closing of ProcessEditorModal
interface StepConfigurationPanelProps {
  step: ProcessStep
  onUpdate: (updates: Partial<ProcessStep>) => void
  onMapResource: (stepId: string, resourceType: 'form' | 'assessment' | 'workflow' | 'rule', resourceId: string) => void
  setMappingStep: (stepId: string | null) => void
  setMappingType: (type: 'form' | 'assessment' | 'workflow' | 'rule' | 'entity' | null) => void
  workflows: WorkflowConfig[]
  assessments: Assessment[]
  formLayouts: FormLayout[]
  businessRules: BusinessRule[]
  entities: Array<{ entity_name: string; entity_label: string; category: string }>
  process: BusinessProcess
  handleAddBranch: (stepId: string) => void
  handleUpdateBranch: (stepId: string, branchId: string, updates: Partial<ProcessStepBranch>) => void
  handleRemoveBranch: (stepId: string, branchId: string) => void
  handleMapBranchToStep: (stepId: string, branchId: string, nextStepId: string | null) => void
}

function StepConfigurationPanel({
  step,
  onUpdate,
  onMapResource,
  setMappingStep,
  setMappingType,
  workflows,
  assessments,
  formLayouts,
  businessRules,
  entities,
  process,
  handleAddBranch,
  handleUpdateBranch,
  handleRemoveBranch,
  handleMapBranchToStep,
}: StepConfigurationPanelProps) {
  const StepIcon = getStepIcon(step.step_type)
  const EntityIcon = getEntityIcon(step.entity_name)
  
  if (step.step_type === 'start' || step.step_type === 'end') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
          <input
            type="text"
            value={step.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={step.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">Step {step.step_number}: {step.name}</div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
        <input
          type="text"
          value={step.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Step Type</label>
        <select
          value={step.step_type}
          onChange={(e) => {
            const newType = e.target.value as any
            if (newType === 'decision' && !step.branches) {
              onUpdate({
                step_type: newType,
                branches: [
                  { id: `branch-${Date.now()}-1`, condition_label: 'Yes', condition_value: true, next_step_id: null },
                  { id: `branch-${Date.now()}-2`, condition_label: 'No', condition_value: false, next_step_id: null },
                ],
              })
            } else {
              onUpdate({ step_type: newType })
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="action">Action</option>
          <option value="entity">Entity Operation</option>
          <option value="form">Form</option>
          <option value="assessment">Assessment</option>
          <option value="workflow">Workflow</option>
          <option value="decision">Decision (Rule-based)</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {step.step_type === 'entity' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          <select
            value={step.entity_name || ''}
            onChange={(e) => {
              const selectedEntity = entities.find(entity => entity.entity_name === e.target.value)
              onUpdate({
                entity_name: e.target.value || null,
                entity_label: selectedEntity?.entity_label || null,
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Entity</option>
            {entities.map(entity => (
              <option key={entity.entity_name} value={entity.entity_name}>
                {entity.entity_label} ({entity.category})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={step.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
      </div>

      {(step.step_type === 'form' || step.step_type === 'assessment' || step.step_type === 'workflow') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {step.step_type === 'form' && 'Map Form (Form Designer)'}
            {step.step_type === 'assessment' && 'Map Assessment'}
            {step.step_type === 'workflow' && 'Map Workflow (Workflows)'}
          </label>
          {step.mapped_resource_id ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">{step.mapped_resource_name}</span>
              <button
                onClick={() => onUpdate({ mapped_resource_id: null, mapped_resource_name: null, mapped_resource_type: null })}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setMappingStep(step.id)
                setMappingType(step.step_type as 'form' | 'assessment' | 'workflow')
              }}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              Map {step.step_type === 'form' ? 'Form' : step.step_type === 'assessment' ? 'Assessment' : 'Workflow'}
            </button>
          )}
        </div>
      )}

      {step.step_type === 'decision' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Map Business Rule (Rule Decision)
            </label>
            {step.rule_id ? (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div>
                  <span className="text-sm font-medium text-purple-900">{step.rule_name}</span>
                  {step.rule_id && (
                    <div className="text-xs text-purple-700 mt-1">
                      Condition: {businessRules.find(r => r.id === step.rule_id)?.condition_expression || 'N/A'}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onUpdate({ rule_id: null, rule_name: null, mapped_resource_type: null, branches: [] })}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMappingStep(step.id)
                  setMappingType('rule')
                }}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                Map Business Rule
              </button>
            )}
          </div>

          {step.rule_id && step.branches && step.branches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Conditional Branches</label>
                <button
                  onClick={() => handleAddBranch(step.id)}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  + Add Branch
                </button>
              </div>
              <div className="space-y-2">
                {step.branches.map((branch) => (
                  <div key={branch.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Branch Label</label>
                          <input
                            type="text"
                            value={branch.condition_label}
                            onChange={(e) => handleUpdateBranch(step.id, branch.id, { condition_label: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Yes, No, High Risk"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Next Step</label>
                          <select
                            value={branch.next_step_id || ''}
                            onChange={(e) => handleMapBranchToStep(step.id, branch.id, e.target.value || null)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select Next Step</option>
                            {process.steps
                              .filter(s => s.step_number > step.step_number)
                              .map(nextStep => (
                                <option key={nextStep.id} value={nextStep.id}>
                                  Step {nextStep.step_number}: {nextStep.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      {step.branches && step.branches.length > 1 && (
                        <button
                          onClick={() => handleRemoveBranch(step.id, branch.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove branch"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step.step_type === 'assessment' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={step.schedule_config?.enabled || false}
              onChange={(e) => onUpdate({
                schedule_config: { ...step.schedule_config, enabled: e.target.checked }
              })}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Enable Automated Schedule (Map Schedule &gt;&gt;)</span>
          </label>
          {step.schedule_config?.enabled && (
            <select
              value={step.schedule_config?.frequency || ''}
              onChange={(e) => onUpdate({
                schedule_config: { ...step.schedule_config, frequency: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Select Frequency</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
              <option value="bi_annual">Bi-Annual</option>
              <option value="one_time">One-Time</option>
            </select>
          )}
        </div>
      )}
    </div>
  )
}
