import { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkflowStep, ApproverGroup } from '../lib/workflowConfig'

interface WorkflowBuilderProps {
  steps: WorkflowStep[]
  onStepsChange: (steps: WorkflowStep[]) => void
  onSetFirstStep: (stepNumber: number) => void
  onStepClick?: (step: WorkflowStep) => void
  approverGroups?: ApproverGroup[]
  canEdit?: boolean
}

interface SortableStepProps {
  step: WorkflowStep
  isFirst: boolean
  onSetFirst: () => void
  onStepClick?: (step: WorkflowStep) => void
  onStepUpdate?: (step: WorkflowStep) => void
  approverGroups?: ApproverGroup[]
  canEdit?: boolean
}

function SortableStep({ step, isFirst, onSetFirst, onStepClick, onStepUpdate, approverGroups, canEdit }: SortableStepProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedStep, setEditedStep] = useState<WorkflowStep>(step)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.step_number })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const stepTypeColors: Record<string, string> = {
    review: 'bg-blue-100 border-blue-300 text-blue-800',
    approval: 'bg-green-100 border-green-300 text-green-800',
    notification: 'bg-purple-100 border-purple-300 text-purple-800',
  }

  const roleColors: Record<string, string> = {
    security_reviewer: 'bg-red-50 border-red-200',
    compliance_reviewer: 'bg-yellow-50 border-yellow-200',
    technical_reviewer: 'bg-blue-50 border-blue-400',
    business_reviewer: 'bg-purple-50 border-purple-200',
    approver: 'bg-green-50 border-green-200',
  }

  const stepType = step.step_type || 'review'
  const role = step.assigned_role || ''
  const assignmentType = step.assignment_rule?.type || (step.assigned_role ? 'role' : step.approver_group_id ? 'group' : 'role')

  const handleSave = () => {
    if (onStepUpdate) {
      onStepUpdate(editedStep)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedStep(step)
    setIsEditing(false)
  }

  const getAssignmentDisplay = () => {
    if (step.assignment_rule?.type === 'group' && step.approver_group_id) {
      const group = approverGroups?.find(g => g.id === step.approver_group_id)
      return group ? `Group: ${group.name}` : 'Group Assignment'
    } else if (step.assignment_rule?.type === 'user' && step.assigned_user_id) {
      return 'Specific User'
    } else if (step.assigned_role) {
      return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
    return 'Not Assigned'
  }

  if (isEditing && canEdit) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative p-4 rounded-lg border-2 border-blue-400 bg-blue-50"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 bg-white border-gray-400 text-gray-700">
              {step.step_number}
            </div>
            <h3 className="font-medium text-gray-900">Edit Step</h3>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Step Name *</label>
            <input
              type="text"
              value={editedStep.step_name}
              onChange={(e) => setEditedStep({ ...editedStep, step_name: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Step Type</label>
            <select
              value={editedStep.step_type}
              onChange={(e) => setEditedStep({ ...editedStep, step_type: e.target.value as any })}
              className="w-full px-2 py-1 text-sm border rounded"
            >
              <option value="review">Review</option>
              <option value="approval">Approval</option>
              <option value="notification">Notification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Assignment Type</label>
            <select
              value={assignmentType}
              onChange={(e) => {
                const newType = e.target.value as 'role' | 'user' | 'group' | 'round_robin'
                setEditedStep({
                  ...editedStep,
                  assignment_rule: { type: newType },
                  assigned_role: newType === 'role' ? editedStep.assigned_role : undefined,
                  assigned_user_id: newType === 'user' ? editedStep.assigned_user_id : undefined,
                  approver_group_id: newType === 'group' ? editedStep.approver_group_id : undefined,
                })
              }}
              className="w-full px-2 py-1 text-sm border rounded"
            >
              <option value="role">Role Based</option>
              <option value="user">Specific User</option>
              <option value="group">Approver Group</option>
              <option value="round_robin">Round Robin</option>
            </select>
          </div>

          {assignmentType === 'role' && (
            <div>
              <label className="block text-xs font-medium mb-1">Assigned Role *</label>
              <select
                value={editedStep.assigned_role || ''}
                onChange={(e) => setEditedStep({ 
                  ...editedStep, 
                  assigned_role: e.target.value,
                  assignment_rule: { type: 'role', value: e.target.value }
                })}
                className="w-full px-2 py-1 text-sm border rounded"
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
          )}

          {assignmentType === 'group' && approverGroups && approverGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1">Approver Group *</label>
              <select
                value={editedStep.approver_group_id || ''}
                onChange={(e) => setEditedStep({ 
                  ...editedStep, 
                  approver_group_id: e.target.value,
                  assignment_rule: { type: 'group', value: e.target.value }
                })}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                <option value="">Select Group</option>
                {approverGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedStep.required}
                onChange={(e) => setEditedStep({ ...editedStep, required: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedStep.can_skip}
                onChange={(e) => setEditedStep({ ...editedStep, can_skip: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-xs">Can Skip</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer ${
        stepTypeColors[stepType] || 'bg-gray-100 border-gray-300'
      } ${isDragging ? 'shadow-lg' : 'shadow-sm hover:shadow-md'}`}
      onClick={() => {
        if (!isDragging && onStepClick) {
          onStepClick(step)
        }
      }}
    >
      {/* Step Number Circle */}
      <div
        className={`flex-shrink-0 w-12 h-9 rounded-full flex items-center justify-center font-semibold text-lg border-2 ${
          isFirst
            ? 'bg-yellow-400 border-yellow-600 text-yellow-900'
            : 'bg-white border-gray-400 text-gray-700'
        }`}
      >
        {step.step_number}
      </div>

      {/* Step Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-gray-900">{step.step_name || `Step ${step.step_number}`}</h3>
          {isFirst && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded-full">
              START
            </span>
          )}
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
            {stepType}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Assignment:</span>
          <span className={`px-2 py-0.5 rounded ${roleColors[role] || 'bg-gray-100'} text-gray-700`}>
            {getAssignmentDisplay()}
          </span>
        </div>
      </div>

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing p-2 text-gray-600 hover:text-gray-600"
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      {/* Edit Button */}
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
          }}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
        >
          Edit
        </button>
      )}

      {/* Set First Button */}
      {!isFirst && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSetFirst()
          }}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors"
        >
          Set Start
        </button>
      )}
    </div>
  )
}

export default function WorkflowBuilder({ steps, onStepsChange, onSetFirstStep, onStepClick, approverGroups, canEdit = false }: WorkflowBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => s.step_number === active.id)
      const newIndex = steps.findIndex((s) => s.step_number === over.id)

      const newSteps = arrayMove(steps, oldIndex, newIndex)
      // Update step numbers to match new order
      const renumberedSteps = newSteps.map((step, index) => ({
        ...step,
        step_number: index + 1,
      }))

      onStepsChange(renumberedSteps)
    }
  }

  const handleStepUpdate = (updatedStep: WorkflowStep) => {
    const updatedSteps = steps.map(s => 
      s.step_number === updatedStep.step_number ? updatedStep : s
    )
    onStepsChange(updatedSteps)
  }

  const firstStepNumber = steps.find((s) => s.is_first_step)?.step_number || steps[0]?.step_number || 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Workflow Steps</h3>
          <p className="text-sm text-gray-500">Drag steps to reorder them</p>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">Total Steps:</span> {steps.length}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={steps.map((s) => s.step_number)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {steps.map((step) => (
              <SortableStep
                key={step.step_number}
                step={step}
                isFirst={step.step_number === firstStepNumber}
                onSetFirst={() => onSetFirstStep(step.step_number)}
                onStepClick={onStepClick}
                onStepUpdate={canEdit ? handleStepUpdate : undefined}
                approverGroups={approverGroups}
                canEdit={canEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {steps.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">No workflow steps configured</p>
          <p className="text-sm text-gray-600 mt-1">Add steps to create a workflow</p>
        </div>
      )}
    </div>
  )
}

