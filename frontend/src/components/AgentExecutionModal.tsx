import { useState, useEffect } from 'react'
import { StudioAgent } from '../lib/studio'
import SkillInputForm from './SkillInputForm'
import BusinessRulesIndicator from './BusinessRulesIndicator'

interface AgentExecutionModalProps {
  agent: StudioAgent
  onExecute: (skill: string, inputData: Record<string, any>) => Promise<void>
  onCancel: () => void
}

export default function AgentExecutionModal({ agent, onExecute, onCancel }: AgentExecutionModalProps) {
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [inputData, setInputData] = useState<Record<string, any>>({})
  const [isExecuting, setIsExecuting] = useState(false)

  const handleExecute = async () => {
    if (!selectedSkill) {
      alert('Please select a skill')
      return
    }

    // Validate required fields based on skill
    if (selectedSkill === 'tprm') {
      const vendorId = inputData.vendor_id
      if (!vendorId || (Array.isArray(vendorId) && vendorId.length === 0)) {
        alert('Please select at least one vendor for TPRM analysis')
        return
      }
    }

    setIsExecuting(true)
    try {
      await onExecute(selectedSkill, inputData)
    } catch (error: any) {
      alert(`Execution failed: ${error.message}`)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col my-auto mx-auto overflow-hidden">
        {/* Header - Fixed */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            Execute Agent: {agent.name}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-800 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-6 space-y-6">
            {/* Select Skill */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Skill <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSkill}
                onChange={(e) => {
                  const newSkill = e.target.value
                  setSelectedSkill(newSkill)
                  // Reset input data when skill changes, but set TPRM defaults
                  if (newSkill === 'tprm') {
                    setInputData({ send_questionnaire: true }) // Default to true for TPRM
                  } else {
                    setInputData({}) // Reset for other skills
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select a skill...</option>
                {agent.skills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            {/* Configure Input Data */}
            {selectedSkill && (
              <div className="w-full space-y-6">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Configure Input Data <span className="text-red-500">*</span>
                  </label>
                  <div className="w-full">
                    <SkillInputForm
                      skill={selectedSkill}
                      agentType={agent.agent_type}
                      value={inputData}
                      onChange={(data) => setInputData(data)}
                    />
                  </div>
                </div>
                
                {/* Business Rules Indicator */}
                <div className="w-full">
                  <BusinessRulesIndicator
                    context={{
                      agent: {
                        id: agent.id,
                        name: agent.name,
                        type: agent.agent_type,
                        category: agent.category,
                        source: agent.source
                      },
                      skill: selectedSkill,
                      input_data: inputData
                    }}
                    entityType="agent"
                    screen="agent_execution"
                    ruleType="validation"
                    showDetails={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0 bg-white">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isExecuting}
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || !selectedSkill}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  )
}
