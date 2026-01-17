import { useQuery } from '@tanstack/react-query'
import { MaterialCard, MaterialButton } from './material'
import { Workflow, Clock, CheckCircle, XCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface WorkflowStatusCardProps {
  entityType: 'product' | 'service' | 'agent' | 'vendor'
  entityId: string
  entityName?: string
}

interface WorkflowStatus {
  has_workflow: boolean
  workflow_id?: string
  workflow_name?: string
  current_stage?: string
  current_stage_label?: string
  progress_percentage?: number
  stages?: Array<{
    stage: string
    label: string
    status: 'completed' | 'current' | 'pending'
    completed_at?: string
    assigned_to?: string
  }>
  status?: 'draft' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'needs_revision'
}

export default function WorkflowStatusCard({ entityType, entityId, entityName }: WorkflowStatusCardProps) {
  const navigate = useNavigate()

  const { data: workflowStatus, isLoading } = useQuery<WorkflowStatus>({
    queryKey: ['workflow-status', entityType, entityId],
    queryFn: async () => {
      const response = await api.get(`/workflow-orchestration/status/${entityType}/${entityId}`, {
        timeout: 10000 // 10 second timeout instead of default 120s
      })
      return response.data
    },
    enabled: !!entityId,
    retry: false,
    staleTime: 30000 // Cache for 30 seconds
  })

  if (isLoading) {
    return (
      <MaterialCard className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </MaterialCard>
    )
  }

  if (!workflowStatus || !workflowStatus.has_workflow) {
    return (
      <MaterialCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Workflow className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">No Active Workflow</h3>
              <p className="text-xs text-gray-500 mt-1">No qualification workflow has been started</p>
            </div>
          </div>
          <MaterialButton
            variant="outlined"
            size="small"
            onClick={() => navigate(`/workflows?entity_type=${entityType}&entity_id=${entityId}`)}
          >
            Start Workflow
          </MaterialButton>
        </div>
      </MaterialCard>
    )
  }

  const getStatusIcon = () => {
    switch (workflowStatus.status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'pending_review':
      case 'in_progress':
        return <Clock className="w-5 h-5 text-yellow-600" />
      case 'needs_revision':
        return <AlertCircle className="w-5 h-5 text-orange-600" />
      default:
        return <Workflow className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (workflowStatus.status) {
      case 'approved':
        return 'bg-green-50 border-green-200'
      case 'rejected':
        return 'bg-red-50 border-red-200'
      case 'pending_review':
      case 'in_progress':
        return 'bg-yellow-50 border-yellow-200'
      case 'needs_revision':
        return 'bg-orange-50 border-orange-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusLabel = () => {
    switch (workflowStatus.status) {
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'pending_review':
        return 'Pending Review'
      case 'in_progress':
        return 'In Progress'
      case 'needs_revision':
        return 'Needs Revision'
      case 'draft':
        return 'Draft'
      default:
        return workflowStatus.current_stage_label || 'Unknown'
    }
  }

  return (
    <MaterialCard className={`p-6 border-2 ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Qualification Workflow</h3>
            <p className="text-xs text-gray-600 mt-1">
              {workflowStatus.workflow_name || 'Workflow in progress'}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
          workflowStatus.status === 'approved' ? 'bg-green-100 text-green-800' :
          workflowStatus.status === 'rejected' ? 'bg-red-100 text-red-800' :
          workflowStatus.status === 'pending_review' || workflowStatus.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
          workflowStatus.status === 'needs_revision' ? 'bg-orange-100 text-orange-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {getStatusLabel()}
        </span>
      </div>

      {/* Progress Bar */}
      {workflowStatus.progress_percentage !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Progress</span>
            <span className="text-xs text-gray-500">{workflowStatus.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                workflowStatus.status === 'approved' ? 'bg-green-600' :
                workflowStatus.status === 'rejected' ? 'bg-red-600' :
                'bg-blue-600'
              }`}
              style={{ width: `${workflowStatus.progress_percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Current Stage */}
      {workflowStatus.current_stage_label && (
        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-1">Current Stage</p>
          <p className="text-sm font-medium text-gray-900">{workflowStatus.current_stage_label}</p>
        </div>
      )}

      {/* Workflow Stages */}
      {workflowStatus.stages && workflowStatus.stages.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-600 mb-2">Workflow Stages</p>
          <div className="space-y-2">
            {workflowStatus.stages.map((stage, index) => (
              <div key={index} className="flex items-center gap-2">
                {stage.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : stage.status === 'current' ? (
                  <Clock className="w-4 h-4 text-blue-600" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={`text-xs ${
                  stage.status === 'completed' ? 'text-gray-600 line-through' :
                  stage.status === 'current' ? 'text-gray-900 font-medium' :
                  'text-gray-400'
                }`}>
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <MaterialButton
        variant="outlined"
        className="w-full"
        onClick={() => {
          if (workflowStatus.workflow_id) {
            navigate(`/workflow-configs/${workflowStatus.workflow_id}?entity_type=${entityType}&entity_id=${entityId}`)
          } else {
            navigate(`/workflows?entity_type=${entityType}&entity_id=${entityId}`)
          }
        }}
      >
        View Full Workflow
        <ArrowRight className="w-4 h-4 ml-2" />
      </MaterialButton>
    </MaterialCard>
  )
}
