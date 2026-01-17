import React from 'react'
import { Info, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { MaterialCard } from './material'

interface Step {
  number: number
  title: string
  description: string
}

interface OnboardingWorkflowPanelProps {
  currentStep: number
  totalSteps: number
  steps: Step[]
  entityType: 'product' | 'service' | 'agent' | 'vendor'
  tips?: string[]
}

export default function OnboardingWorkflowPanel({
  currentStep,
  totalSteps,
  steps,
  entityType,
  tips
}: OnboardingWorkflowPanelProps) {
  const currentStepData = steps.find(s => s.number === currentStep)
  const progress = (currentStep / totalSteps) * 100

  const defaultTips: Record<string, string[]> = {
    product: [
      'Ensure product name is clear and descriptive',
      'Select the appropriate vendor from your organization',
      'Provide accurate version information',
      'Include detailed description for better assessment'
    ],
    service: [
      'Specify service type accurately',
      'Provide clear service description',
      'Include support contact information',
      'Select appropriate business unit and department'
    ],
    agent: [
      'Provide comprehensive agent capabilities',
      'Include all required integrations',
      'Specify data types and regions',
      'Complete all compliance requirements'
    ],
    vendor: [
      'Ensure vendor contact email is correct',
      'Provide complete vendor information',
      'Include registration details if available',
      'Verify vendor coordinator email for notifications'
    ]
  }

  const stepTips = tips || defaultTips[entityType] || []

  return (
    <div className="w-80 flex-shrink-0">
      <div className="sticky top-4 space-y-4">
        {/* Progress Card */}
        <MaterialCard className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Progress</h3>
              <p className="text-xs text-gray-500">Step {currentStep} of {totalSteps}</p>
            </div>
          </div>
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            {steps.map((step) => {
              const isCompleted = currentStep > step.number
              const isCurrent = currentStep === step.number
              const isPending = currentStep < step.number

              return (
                <div
                  key={step.number}
                  className={`flex items-start gap-3 p-2 rounded-lg ${
                    isCurrent ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : isCurrent ? (
                      <Clock className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      isCurrent ? 'text-blue-900' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.number}. {step.title}
                    </div>
                    {isCurrent && (
                      <div className="text-xs text-blue-700 mt-1">{step.description}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </MaterialCard>

        {/* Current Step Info */}
        {currentStepData && (
          <MaterialCard className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Info className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Current Step</h3>
                <p className="text-xs text-gray-500">{currentStepData.title}</p>
              </div>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed">
              {currentStepData.description}
            </div>
          </MaterialCard>
        )}

        {/* Tips */}
        {stepTips.length > 0 && (
          <MaterialCard className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Tips</h3>
                <p className="text-xs text-gray-500">Helpful information</p>
              </div>
            </div>
            <ul className="space-y-2">
              {stepTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </MaterialCard>
        )}
      </div>
    </div>
  )
}
