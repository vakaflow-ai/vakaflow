import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agentsApi, Agent } from '../lib/agents'
import { vendorsApi, VendorWithDetails } from '../lib/vendors'
import AgentSelector from './AgentSelector'
import VendorSelector from './VendorSelector'

interface SkillInputFormProps {
  skill: string
  agentType?: string
  value: Record<string, any>
  onChange: (value: Record<string, any>) => void
}

// Define field configurations for each skill
const skillFieldConfigs: Record<string, Array<{
  name: string
  label: string
  type: 'select' | 'text' | 'number' | 'boolean' | 'dynamic' | 'agent_selector' | 'vendor_selector'
  required: boolean
  options?: Array<{ value: string; label: string }>
  dataSource?: 'agents' | 'vendors' | 'assessment_types' | 'trigger_data'
  placeholder?: string
  helpText?: string
  allowMultiple?: boolean
}>> = {
  assessment: [
    {
      name: 'assessment_type',
      label: 'Assessment Type',
      type: 'select',
      required: false,
      options: [
        { value: 'tprm', label: 'TPRM - Third-Party Risk Management' },
        { value: 'vendor_qualification', label: 'Vendor Qualification' },
        { value: 'risk_assessment', label: 'Risk Assessment' },
        { value: 'ai_vendor_qualification', label: 'AI Vendor Qualification' },
        { value: 'security_assessment', label: 'Security Assessment' },
        { value: 'compliance_assessment', label: 'Compliance Assessment' },
        { value: 'custom', label: 'Custom Assessment' },
        { value: 'general', label: 'General Assessment' }
      ],
      helpText: 'Select the type of assessment to perform'
    },
    {
      name: 'agent_selection',
      label: 'Agent Selection',
      type: 'agent_selector',
      required: false,
      helpText: 'Select agents by individual, category, vendor, or all agents'
    },
    {
      name: 'vendor_id',
      label: 'Vendor',
      type: 'select',
      required: false,
      dataSource: 'vendors',
      helpText: 'Select a vendor (optional)'
    }
  ],
  vendor_qualification: [
    {
      name: 'vendor_id',
      label: 'Vendor *',
      type: 'select',
      required: true,
      dataSource: 'vendors',
      helpText: 'Select the vendor to qualify'
    }
  ],
  marketplace_reviews: [
    {
      name: 'vendor_id',
      label: 'Vendor *',
      type: 'select',
      required: true,
      dataSource: 'vendors',
      helpText: 'Select the vendor to review'
    },
    {
      name: 'agent_selection',
      label: 'Agent Selection',
      type: 'agent_selector',
      required: false,
      helpText: 'Select agents by individual, category, vendor, or all agents (optional)'
    }
  ],
  tprm: [
    {
      name: 'vendor_id',
      label: 'Select Vendor(s)',
      type: 'vendor_selector',
      required: true,
      allowMultiple: true,
      helpText: 'Select one or more vendors for TPRM analysis. Use filters to find vendors by category, agent type, or search by name.'
    },
    {
      name: 'send_questionnaire',
      label: 'Send Questionnaire to Vendor',
      type: 'boolean',
      required: false,
      helpText: 'If enabled, creates and sends TPRM questionnaire to the vendor. Requires an active TPRM assessment.'
    }
  ],
  realtime_risk_analysis: [
    {
      name: 'agent_selection',
      label: 'Agent Selection *',
      type: 'agent_selector',
      required: true,
      helpText: 'Select agents by individual, category, vendor, or all agents'
    }
  ],
  ai_agent_onboarding: [
    {
      name: 'agent_selection',
      label: 'Agent Selection *',
      type: 'agent_selector',
      required: true,
      helpText: 'Select agents by individual, category, vendor, or all agents'
    }
  ],
  compliance_review: [
    {
      name: 'agent_selection',
      label: 'Agent Selection *',
      type: 'agent_selector',
      required: true,
      helpText: 'Select agents by individual, category, vendor, or all agents'
    },
    {
      name: 'review_type',
      label: 'Review Type',
      type: 'select',
      required: false,
      options: [
        { value: 'security', label: 'Security Review' },
        { value: 'compliance', label: 'Compliance Review' },
        { value: 'data_privacy', label: 'Data Privacy Review' },
        { value: 'full', label: 'Full Review' }
      ],
      helpText: 'Select the type of compliance review'
    }
  ]
}

export default function SkillInputForm({ skill, agentType, value, onChange }: SkillInputFormProps) {
  // Initialize formData with TPRM defaults if needed
  const getInitialData = () => {
    const data = value || {}
    // Set default values for TPRM skill (hardcoded logic)
    if (skill === 'tprm' && data.send_questionnaire === undefined) {
      return { ...data, send_questionnaire: true }
    }
    return data
  }
  
  const [formData, setFormData] = useState<Record<string, any>>(getInitialData())
  const [useTriggerData, setUseTriggerData] = useState<Record<string, boolean>>({})

  // Get field configuration for this skill
  const fields = skillFieldConfigs[skill] || []

  // Fetch agents if needed (for agent selector or vendor selector filters)
  const { data: agentsData } = useQuery({
    queryKey: ['agents-for-skill-input'],
    queryFn: () => agentsApi.list(1, 100),
    enabled: fields.some(f => f.dataSource === 'agents' || f.type === 'agent_selector' || f.type === 'vendor_selector')
  })

  // Fetch vendors if needed
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-for-skill-input'],
    queryFn: () => vendorsApi.list(true),
    enabled: fields.some(f => f.dataSource === 'vendors' || f.type === 'vendor_selector')
  })

  useEffect(() => {
    const initialData = getInitialData()
    setFormData(initialData)
    // Notify parent if defaults were applied (only if value doesn't already have it)
    if (skill === 'tprm' && initialData.send_questionnaire === true && value?.send_questionnaire === undefined) {
      onChange(initialData)
    }
  }, [value, skill]) // Removed onChange from dependencies to avoid infinite loop

  const handleFieldChange = (fieldName: string, fieldValue: any, useTrigger: boolean = false) => {
    const newData = { ...formData }
    
    if (useTrigger) {
      newData[fieldName] = `\${trigger_data.${fieldName}}`
      setUseTriggerData({ ...useTriggerData, [fieldName]: true })
    } else {
      newData[fieldName] = fieldValue
      setUseTriggerData({ ...useTriggerData, [fieldName]: false })
    }
    
    setFormData(newData)
    onChange(newData)
  }

  const getFieldOptions = (field: typeof fields[0]) => {
    if (field.options) {
      return field.options
    }
    
    if (field.dataSource === 'agents') {
      return agentsData?.agents.map(agent => ({
        value: agent.id,
        label: `${agent.name} (${agent.type})`
      })) || []
    }
    
    if (field.dataSource === 'vendors') {
      return vendorsData?.map(vendor => ({
        value: vendor.id,
        label: `${vendor.name} (${vendor.agents_count || 0} agents)`
      })) || []
    }
    
    return []
  }

  if (fields.length === 0) {
    // Fallback to JSON editor for unknown skills
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Input Data (JSON)
        </label>
        <textarea
          value={JSON.stringify(formData, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              setFormData(parsed)
              onChange(parsed)
            } catch {
              // Invalid JSON, ignore
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
          rows={6}
          placeholder='{"field": "value"}'
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter JSON input data for the skill. Use $&#123;trigger_data.field&#125; for dynamic values.
        </p>
      </div>
    )
  }

  // Get skill-specific description
  const getSkillDescription = (skill: string): string => {
    switch (skill) {
      case 'tprm':
        return 'TPRM analysis requires vendor selection. Select one or more vendors to perform Third-Party Risk Management assessment.'
      case 'realtime_risk_analysis':
        return 'Real-time risk analysis requires agent selection. Select agents to analyze for risk.'
      case 'compliance_review':
        return 'Compliance review requires agent selection. Select agents to review for compliance.'
      case 'ai_agent_onboarding':
        return 'AI agent onboarding requires agent selection. Select agents to onboard.'
      case 'vendor_qualification':
        return 'Vendor qualification requires vendor selection. Select a vendor to qualify.'
      case 'marketplace_reviews':
        return 'Marketplace reviews require vendor selection. Optionally select specific agents to review.'
      default:
        return ''
    }
  }

  const skillDescription = getSkillDescription(skill)

  return (
    <div className="space-y-4">
      {skillDescription && (
        <div className="p-3 bg-blue-50 border border-blue-400 rounded-md">
          <p className="text-sm text-blue-900">{skillDescription}</p>
        </div>
      )}
      {fields.map((field) => {
        const fieldValue = formData[field.name] || ''
        const isUsingTrigger = useTriggerData[field.name] || fieldValue.toString().startsWith('${trigger_data.')
        
        return (
          <div key={field.name}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {(field.type === 'select' || field.type === 'text' || field.type === 'number') && (
                <label className="flex items-center text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={isUsingTrigger}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleFieldChange(field.name, '', true)
                      } else {
                        handleFieldChange(field.name, '')
                      }
                    }}
                    className="mr-1 h-3 w-3"
                  />
                  Use trigger data
                </label>
              )}
            </div>

            {isUsingTrigger ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={fieldValue}
                  onChange={(e) => handleFieldChange(field.name, e.target.value, true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder={`\${trigger_data.${field.name}}`}
                />
                <p className="text-xs text-gray-500">
                  This will use dynamic data from flow execution context
                </p>
              </div>
            ) : field.type === 'agent_selector' ? (
              <AgentSelector
                value={fieldValue}
                onChange={(value) => handleFieldChange(field.name, value)}
                required={field.required}
                helpText={field.helpText}
                allowMultiple={true}
              />
            ) : field.type === 'vendor_selector' ? (
              <VendorSelector
                value={fieldValue}
                onChange={(value) => handleFieldChange(field.name, value)}
                required={field.required}
                helpText={field.helpText}
                allowMultiple={field.allowMultiple || false}
              />
            ) : field.type === 'select' ? (
              <select
                value={fieldValue}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={field.required}
              >
                <option value="">Select {field.label.toLowerCase()}...</option>
                {getFieldOptions(field).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'text' ? (
              <input
                type="text"
                value={fieldValue}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={field.placeholder}
                required={field.required}
              />
            ) : field.type === 'number' ? (
              <input
                type="number"
                value={fieldValue}
                onChange={(e) => handleFieldChange(field.name, parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={field.required}
              />
            ) : field.type === 'boolean' ? (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={fieldValue || false}
                  onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <span className="text-sm text-gray-700">Enable {field.label.toLowerCase()}</span>
              </label>
            ) : null}

            {field.helpText && (
              <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>
            )}
          </div>
        )
      })}

      {/* Show generated JSON for reference */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
        <p className="text-xs font-medium text-gray-700 mb-1">Generated Input Data:</p>
        <pre className="text-xs text-gray-600 overflow-x-auto">
          {JSON.stringify(formData, null, 2)}
        </pre>
      </div>
    </div>
  )
}
