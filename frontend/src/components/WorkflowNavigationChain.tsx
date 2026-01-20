import { useNavigate } from 'react-router-dom'
import { MaterialButton } from './material'
import { Layers, Settings, FileText, Workflow } from 'lucide-react'

interface WorkflowNavigationChainProps {
  currentStep?: 'request-types' | 'workflows' | 'form-library' | 'stage-config'
  className?: string
}

export default function WorkflowNavigationChain({ 
  currentStep = 'request-types',
  className = ''
}: WorkflowNavigationChainProps) {
  const navigate = useNavigate()

  const steps = [
    {
      id: 'request-types',
      title: 'Request Types',
      icon: Layers,
      path: '/admin/workflows',
      description: 'Create request types mapped to entities'
    },
    {
      id: 'workflows',
      title: 'Workflows',
      icon: Workflow,
      path: '/admin/workflows',
      description: 'Configure workflow processes for request types'
    },
    {
      id: 'forms',
      title: 'Forms',
      icon: FileText,
      path: '/admin/form-library',
      description: 'Assign forms to workflow stages'
    }
  ]

  const getCurrentIndex = () => {
    return steps.findIndex(step => step.id === currentStep)
  }

  const handleNavigate = (path: string, stepId: string) => {
    // Don't navigate if trying to go to stage config without form ID
    if (stepId === 'stage-config' && path.includes(':id')) {
      // Show info message or disable the button
      return
    }
    navigate(path)
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Navigation Chain</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => {
          const currentIndex = getCurrentIndex()
          const isCurrent = step.id === currentStep
          const isCompleted = index < currentIndex
          const isDisabled = index > currentIndex + 1
          
          return (
            <div 
              key={step.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                isCurrent 
                  ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' 
                  : isCompleted
                    ? 'border-green-200 bg-green-50'
                    : isDisabled
                      ? 'border-gray-100 bg-gray-50 opacity-60'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {/* Step indicator */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isCurrent 
                  ? 'bg-blue-600 text-white' 
                  : isCompleted
                    ? 'bg-green-600 text-white'
                    : isDisabled
                      ? 'bg-gray-300 text-gray-500'
                      : 'bg-gray-200 text-gray-600'
              }`}>
                <step.icon className="w-5 h-5" />
              </div>
              
              {/* Step content */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium ${
                  isCurrent 
                    ? 'text-blue-900' 
                    : isCompleted
                      ? 'text-green-900'
                      : isDisabled
                        ? 'text-gray-500'
                        : 'text-gray-900'
                }`}>
                  {step.title}
                </h4>
                <p className={`text-sm mt-1 ${
                  isCurrent 
                    ? 'text-blue-700' 
                    : isCompleted
                      ? 'text-green-700'
                      : isDisabled
                        ? 'text-gray-500'
                        : 'text-gray-600'
                }`}>
                  {step.description}
                </p>
              </div>
              
              {/* Navigation button */}
              {!isCurrent && (
                <MaterialButton
                  variant={isCompleted ? "outlined" : "contained"}
                  size="small"
                  onClick={() => handleNavigate(step.path, step.id)}
                  disabled={isDisabled}
                  className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {isCompleted ? 'Review' : 'Go to'}
                </MaterialButton>
              )}
              
              {isCurrent && (
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  Current
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <strong>Complete Workflow:</strong> Create entity-mapped request types → 
          Configure workflows → Assign forms to stages
        </div>
      </div>
    </div>
  )
}