import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkflowStep {
  id: string
  step_number: number
  step_type: string
  step_name: string | null
  status: string
  assigned_to: string | null
  assigned_to_user: { id: string; name: string; email: string } | null
  assigned_role: string | null
  completed_by: string | null
  completed_by_user: { id: string; name: string; email: string } | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface WorkflowProgressProps {
  steps: WorkflowStep[]
  current_step: number | null
  total_steps: number
  completed_steps: number
  progress_percent: number
  status: string | null
  started_at: string | null
  completed_at: string | null
}

export default function WorkflowProgress({
  steps,
  current_step,
  total_steps,
  completed_steps,
  progress_percent,
  status,
  started_at,
  completed_at
}: WorkflowProgressProps) {
  if (total_steps === 0) {
    return null
  }

  const getStepStatus = (step: WorkflowStep) => {
    if (step.status === 'completed') return 'completed'
    if (step.step_number === current_step) return 'current'
    if (step.step_number < (current_step || 0)) return 'completed'
    return 'pending'
  }

  const getStepIcon = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'current':
        return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStepColor = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'current':
        return 'text-blue-700 bg-blue-50 border-blue-300'
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Workflow Progress</CardTitle>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{progress_percent}%</div>
            <div className="text-xs text-muted-foreground">
              {completed_steps} of {total_steps} steps completed
            </div>
          </div>
        </div>
        <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress_percent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const stepStatus = getStepStatus(step)
            const isLast = index === steps.length - 1

            return (
              <div key={step.id} className="relative">
                <div className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 transition-all",
                  getStepColor(stepStatus)
                )}>
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(stepStatus)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="font-semibold text-sm">
                          Step {step.step_number}: {step.step_name || `Step ${step.step_number}`}
                        </div>
                        {step.assigned_role && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Role: {step.assigned_role}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium capitalize",
                          stepStatus === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : stepStatus === 'current'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                          {stepStatus === 'current' ? 'In Progress' : stepStatus}
                        </span>
                      </div>
                    </div>
                    
                    {step.assigned_to_user && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Assigned to: {step.assigned_to_user.name} ({step.assigned_to_user.email})
                      </div>
                    )}
                    
                    {step.completed_by_user && step.completed_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Completed by: {step.completed_by_user.name} on {formatDate(step.completed_at)}
                      </div>
                    )}
                    
                    {step.notes && (
                      <div className="text-xs text-muted-foreground mt-2 p-2 bg-white/50 rounded">
                        <strong>Notes:</strong> {step.notes}
                      </div>
                    )}
                  </div>
                </div>
                
                {!isLast && (
                  <div className={cn(
                    "ml-6 h-6 w-0.5 transition-colors",
                    stepStatus === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                  )} />
                )}
              </div>
            )
          })}
        </div>
        
        {(started_at || completed_at) && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-1">
            {started_at && (
              <div>Started: {formatDate(started_at)}</div>
            )}
            {completed_at && (
              <div>Completed: {formatDate(completed_at)}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
