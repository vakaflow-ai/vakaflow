import { useState } from 'react'
import { WorkflowStep, ApproverGroup } from '../lib/workflowConfig'
import { MaterialCard, MaterialButton, MaterialInput } from './material'
import { CheckIcon, XIcon, PlusIcon } from './Icons'

interface WorkflowFlowchartProps {
  steps: WorkflowStep[]
  onStepUpdate: (step: WorkflowStep) => void
  onStepDelete?: (stepNumber: number) => void
  onStepAdd?: () => void
  onStageSettings?: (step: WorkflowStep) => void
  onStepReorder?: (stepNumbers: number[]) => void
  onSave?: () => void
  approverGroups?: ApproverGroup[]
  canEdit?: boolean
}

export default function WorkflowFlowchart({
  steps,
  onStepUpdate,
  onStepDelete,
  onStepAdd,
  onStageSettings,
  onStepReorder,
  onSave,
  approverGroups,
  canEdit = false
}: WorkflowFlowchartProps) {
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [showAddStep, setShowAddStep] = useState(false)

  // Sort steps by step_number
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number)
  const firstStepNumber = steps.find((s) => s.is_first_step)?.step_number || sortedSteps[0]?.step_number || 1

  const getStepTypeColor = (stepType: string) => {
    switch (stepType) {
      case 'review':
        return 'bg-blue-500'
      case 'approval':
        return 'bg-green-500'
      case 'notification':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getRoleDisplay = (step: WorkflowStep) => {
    if (step.assignment_rule?.type === 'group' && step.approver_group_id) {
      const group = approverGroups?.find(g => g.id === step.approver_group_id)
      return group ? group.name : 'Group'
    }
    if (step.assigned_role) {
      return step.assigned_role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    return 'Not Assigned'
  }

  const handleStepClick = (step: WorkflowStep) => {
    if (canEdit) {
      setEditingStep(step)
    }
  }

  const handleSave = () => {
    if (editingStep) {
      onStepUpdate(editingStep)
      setEditingStep(null)
    }
  }

  const handleCancel = () => {
    setEditingStep(null)
  }

  return (
    <div className="w-full">
      {/* Edit Modal */}
      {editingStep && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <MaterialCard elevation={24} className="max-w-md w-full mx-4 border-none overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between">
              <h2 className="text-xl font-medium text-gray-900">Edit Step: {editingStep.step_name}</h2>
              <MaterialButton variant="text" size="small" onClick={handleCancel} className="!p-2 text-gray-600">
                <XIcon className="w-6 h-6" />
              </MaterialButton>
            </div>
            
            <div className="p-6 space-y-5 bg-background">
              <MaterialInput
                label="Step Name *"
                type="text"
                value={editingStep.step_name}
                onChange={(e) => setEditingStep({ ...editingStep, step_name: e.target.value })}
              />

              <div className="relative w-full">
                <label className="block text-sm font-medium mb-1.5 text-gray-700">
                  Step Type
                </label>
                <select
                  value={editingStep.step_type}
                  onChange={(e) => setEditingStep({ ...editingStep, step_type: e.target.value as any })}
                  className="w-full px-3 py-1.5 h-9 text-sm border border-gray-200 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-primary-500/50 transition-all duration-200"
                >
                  <option value="review">Review</option>
                  <option value="approval">Approval</option>
                  <option value="notification">Notification</option>
                </select>
              </div>

              <div className="relative w-full">
                <label className="block text-sm font-medium mb-1.5 text-gray-700">
                  Assigned Role
                </label>
                <select
                  value={editingStep.assigned_role || ''}
                  onChange={(e) => setEditingStep({ 
                    ...editingStep, 
                    assigned_role: e.target.value || undefined
                  })}
                  className="w-full px-3 py-1.5 h-9 text-sm border border-gray-200 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-blue-500 focus:ring-primary-500/50 transition-all duration-200"
                >
                  <option value="">Select Role</option>
                  <option value="security_reviewer">Security Reviewer</option>
                  <option value="compliance_reviewer">Compliance Reviewer</option>
                  <option value="technical_reviewer">Technical Reviewer</option>
                  <option value="business_reviewer">Business Reviewer</option>
                  <option value="approver">Approver</option>
                  <option value="tenant_admin">Tenant Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-6 p-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editingStep.required}
                    onChange={(e) => setEditingStep({ ...editingStep, required: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editingStep.can_skip}
                    onChange={(e) => setEditingStep({ ...editingStep, can_skip: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Can Skip</span>
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t bg-surface-variant/5 -mx-6 -mb-6 p-6 mt-6">
                <MaterialButton
                  variant="text"
                  onClick={handleCancel}
                  className="text-gray-600"
                >
                  Cancel
                </MaterialButton>
                <MaterialButton
                  onClick={handleSave}
                  className="shadow-md-elevation-4"
                >
                  Save Changes
                </MaterialButton>
              </div>
            </div>
          </MaterialCard>
        </div>
      )}

      {/* Flowchart */}
      <div className="relative py-8 overflow-x-auto overflow-y-visible">
        <div className="flex items-center justify-center gap-4 min-w-max px-12" style={{ maxWidth: '100%' }}>
          {sortedSteps.length === 0 ? (
            <div className="text-center py-16 bg-surface-variant/5 rounded-lg border-2 border-dashed border-gray-200 w-full max-w-lg mx-auto">
              <div className="mb-4">
                <svg className="w-16 h-12 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-2">No workflow steps configured</p>
              <p className="text-sm text-gray-600 mb-6">Create the sequential path for agent onboarding</p>
              {canEdit && onStepAdd && (
                <MaterialButton
                  onClick={() => onStepAdd()}
                  startIcon={<PlusIcon className="w-4 h-4" />}
                  className="shadow-md-elevation-2"
                >
                  Add First Step
                </MaterialButton>
              )}
            </div>
          ) : (
            <>
              {sortedSteps.map((step, index) => {
                const isFirst = index === 0  // First step in the sorted array
                const isLast = index === sortedSteps.length - 1
                
                return (
                  <div key={step.step_number} className="flex items-center gap-4 relative">
                    {/* Step Node */}
                    <div
                      onClick={() => canEdit && handleStepClick(step)}
                      className={`relative flex flex-col items-center ${
                        canEdit ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                      }`}
                    >
                      {/* Step Circle */}
                      <div className="relative">
                        <div
                          className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg border-4 transition-all ${
                            isFirst
                              ? 'bg-yellow-400 border-yellow-600 text-yellow-900'
                              : isLast
                              ? 'bg-green-500 border-white text-white'
                              : getStepTypeColor(step.step_type) + ' border-white text-white'
                          } ${canEdit ? 'hover:scale-110' : ''}`}
                        >
                          {isFirst && (
                            <div className="absolute -top-1 -right-1 bg-yellow-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              START
                            </div>
                          )}
                          <div className={`text-xl font-bold ${isFirst ? 'text-yellow-900' : 'text-white'}`}>
                            {step.step_number}
                          </div>
                          <div className={`text-xs font-medium mt-0.5 ${isFirst ? 'text-yellow-900' : 'text-white'}`}>
                            {step.step_type}
                          </div>
                        </div>
                      </div>


                      {/* Step Label */}
                      <div className="mt-2 text-center max-w-[140px]">
                        <div className="font-medium text-sm text-gray-900 leading-tight">
                          {step.step_name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {getRoleDisplay(step)}
                        </div>
                        {canEdit && (
                          <div className="mt-1.5 flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStepClick(step)
                              }}
                              className="text-xs text-blue-600 font-medium hover:underline"
                            >
                              Edit
                            </button>
                            {onStageSettings && (
                              <>
                                <span className="text-gray-500">|</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onStageSettings(step)
                                  }}
                                  className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1"
                                  title="Stage Settings"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Settings
                                </button>
                              </>
                            )}
                            {onStepDelete && sortedSteps.length > 1 && (
                              <>
                                <span className="text-gray-500">|</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`Are you sure you want to delete "${step.step_name}"?`)) {
                                  onStepDelete(step.step_number)
                                }
                              }}
                              className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1"
                              title="Delete Step"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow with Reorder Controls */}
                    {!isLast && (
                      <div className="flex-shrink-0 flex items-center relative">
                        {/* Reorder Controls - Left/Right swap buttons between stages */}
                        {canEdit && onStepReorder && sortedSteps.length > 1 && (
                          <div className="absolute left-1/2 -translate-x-1/2 -top-8 flex gap-1 z-10">
                            {/* Left arrow - moves right step to the left */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Swap: move the right step (index + 1) to the left
                                const newOrder = [...sortedSteps]
                                const temp = newOrder[index + 1]
                                newOrder[index + 1] = newOrder[index]
                                newOrder[index] = temp
                                // Pass original step numbers in the new order (backend will renumber them)
                                const reorderedStepNumbers = newOrder.map(s => s.step_number)
                                onStepReorder(reorderedStepNumbers)
                              }}
                              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-400 shadow-sm transition-colors"
                              title="Move Right Step Left"
                            >
                              <svg className="w-4 h-4 text-gray-600 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            {/* Right arrow - moves left step to the right */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Swap: move the left step (index) to the right
                                const newOrder = [...sortedSteps]
                                const temp = newOrder[index]
                                newOrder[index] = newOrder[index + 1]
                                newOrder[index + 1] = temp
                                // Pass original step numbers in the new order (backend will renumber them)
                                const reorderedStepNumbers = newOrder.map(s => s.step_number)
                                onStepReorder(reorderedStepNumbers)
                              }}
                              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-400 shadow-sm transition-colors"
                              title="Move Left Step Right"
                            >
                              <svg className="w-4 h-4 text-gray-600 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        )}
                        <svg
                          width="40"
                          height="20"
                          viewBox="0 0 40 20"
                          className="text-gray-600"
                        >
                          <line
                            x1="0"
                            y1="10"
                            x2="30"
                            y2="10"
                            stroke="currentColor"
                            strokeWidth="1"
                            markerEnd="url(#arrowhead)"
                          />
                          <defs>
                            <marker
                              id="arrowhead"
                              markerWidth="8"
                              markerHeight="8"
                              refX="7"
                              refY="4"
                              orient="auto"
                            >
                              <polygon
                                points="0 0, 8 4, 0 8"
                                fill="currentColor"
                              />
                            </marker>
                          </defs>
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add Step Button */}
              {canEdit && onStepAdd && (
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 flex items-center">
                    <svg
                      width="40"
                      height="20"
                      viewBox="0 0 40 20"
                      className="text-gray-500"
                    >
                      <line
                        x1="0"
                        y1="10"
                        x2="30"
                        y2="10"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                    </svg>
                  </div>
                  <button
                    onClick={() => onStepAdd()}
                    className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-600 hover:border-blue-400 hover:text-blue-400 transition-all hover:scale-110"
                    title="Add Step"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs mt-1 font-medium">Add</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Button */}
      {canEdit && onSave && (
        <div className="mt-12 pt-8 border-t border-gray-100 flex justify-center">
          <MaterialButton
            onClick={onSave}
            size="large"
            className="px-12 py-2 text-base shadow-md-elevation-4"
            startIcon={<CheckIcon className="w-5 h-5" />}
          >
            Save Workflow Definition
          </MaterialButton>
        </div>
      )}
    </div>
  )
}

