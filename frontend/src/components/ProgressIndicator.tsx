import { Agent } from '../lib/agents'

interface ProgressIndicatorProps {
  agent: Agent
}

const STAGES = [
  { key: 'pre_review', label: 'Pre-Review', order: 0 },
  { key: 'security', label: 'Security', order: 1 },
  { key: 'compliance', label: 'Compliance', order: 2 },
  { key: 'technical', label: 'Technical', order: 3 },
  { key: 'business', label: 'Business', order: 4 },
]

export default function ProgressIndicator({ agent }: ProgressIndicatorProps) {
  const getStageStatus = (stage: string) => {
    if (agent.status === 'draft') return 'pending'
    if (agent.status === 'submitted' && stage === 'pre_review') return 'in_progress'
    if (agent.status === 'in_review') {
      // Determine which stage is active based on reviews
      return 'in_progress'
    }
    if (agent.status === 'approved') return 'completed'
    if (agent.status === 'rejected') return 'failed'
    return 'pending'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓'
      case 'in_progress':
        return '⟳'
      case 'failed':
        return '✗'
      default:
        return '○'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'in_progress':
        return 'text-blue-600 bg-blue-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="compact-card">
      <h3 className="text-sm font-medium mb-4">Review Progress</h3>
      <div className="space-y-3">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(stage.key)
          const isLast = index === STAGES.length - 1
          
          return (
            <div key={stage.key} className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-medium ${getStatusColor(status)}`}>
                {getStatusIcon(status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${status === 'completed' ? 'text-green-700' : status === 'in_progress' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {stage.label} Review
                  </span>
                  <span className={`text-xs px-2 py-1 rounded capitalize ${getStatusColor(status)}`}>
                    {status.replace('_', ' ')}
                  </span>
                </div>
                {!isLast && (
                  <div className={`ml-4 h-6 w-0.5 ${status === 'completed' ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

