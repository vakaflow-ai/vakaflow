import { useState, useEffect } from 'react'
import api from '../lib/api'

interface IntegrationHelpGuide {
  provider: string
  name: string
  description: string
  steps: Array<{
    title: string
    description: string
    details: string[]
  }>
  prerequisites: string[]
  configuration_fields: Array<{
    field: string
    label: string
    required: boolean
    help: string
  }>
  troubleshooting: Array<{
    issue: string
    solution: string
  }>
}

interface IntegrationHelpModalProps {
  provider: string
  isOpen: boolean
  onClose: () => void
}

export default function IntegrationHelpModal({ provider, isOpen, onClose }: IntegrationHelpModalProps) {
  const [guide, setGuide] = useState<IntegrationHelpGuide | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && provider) {
      setLoading(true)
      setError(null)
      api.get(`/integration-help/${provider}`)
        .then((response) => {
          setGuide(response.data)
          setLoading(false)
        })
        .catch((err) => {
          setError(err.response?.data?.detail || 'Failed to load help guide')
          setLoading(false)
        })
    }
  }, [isOpen, provider])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-medium">
            {guide?.name || 'Integration Help'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-muted-foreground">Loading help guide...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 mb-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {guide && !loading && (
            <div className="space-y-6">
              <div>
                <p className="text-muted-foreground">{guide.description}</p>
              </div>

              {guide.prerequisites.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Prerequisites</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {guide.prerequisites.map((prereq, idx) => (
                      <li key={idx}>{prereq}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-lg font-medium mb-4">Configuration Steps</h3>
                <div className="space-y-6">
                  {guide.steps.map((step, idx) => (
                    <div key={idx} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-medium text-lg mb-1">
                        {idx + 1}. {step.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {step.details.map((detail, detailIdx) => (
                          <li key={detailIdx} className="text-gray-700 dark:text-gray-500">
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {guide.configuration_fields.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Configuration Fields</h3>
                  <div className="space-y-2">
                    {guide.configuration_fields.map((field, idx) => (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{field.label}</span>
                          {field.required && (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{field.help}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guide.troubleshooting.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Troubleshooting</h3>
                  <div className="space-y-3">
                    {guide.troubleshooting.map((item, idx) => (
                      <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                        <p className="font-medium text-sm mb-1">
                          <strong>Issue:</strong> {item.issue}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Solution:</strong> {item.solution}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <button
            onClick={onClose}
            className="compact-button-primary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

