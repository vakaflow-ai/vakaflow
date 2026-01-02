import { useState } from 'react'
import { Requirement, RequirementResponse } from '../lib/frameworks'

interface RequirementTreeProps {
  requirements: Requirement[]
  responses: Record<string, RequirementResponse>
  onResponseChange: (ruleId: string, response: RequirementResponse) => void
  frameworkName: string
}

export default function RequirementTree({
  requirements,
  responses,
  onResponseChange,
  frameworkName,
}: RequirementTreeProps) {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-foreground">{frameworkName}</h3>
        <p className="text-sm text-muted-foreground">Please respond to each requirement below</p>
      </div>
      
      <div className="space-y-2">
        {requirements.map((req) => (
          <RequirementNode
            key={req.id}
            requirement={req}
            responses={responses}
            onResponseChange={onResponseChange}
            level={0}
          />
        ))}
      </div>
    </div>
  )
}

interface RequirementNodeProps {
  requirement: Requirement
  responses: Record<string, RequirementResponse>
  onResponseChange: (ruleId: string, response: RequirementResponse) => void
  level: number
}

function RequirementNode({
  requirement,
  responses,
  onResponseChange,
  level,
}: RequirementNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels
  const hasChildren = requirement.children && requirement.children.length > 0
  const response = responses[requirement.id] || { rule_id: requirement.id }
  
  const handleResponseChange = (field: keyof RequirementResponse, value: any) => {
    onResponseChange(requirement.id, {
      ...response,
      [field]: value,
    })
  }

  return (
    <div className={`border rounded-lg ${level > 0 ? 'ml-6' : ''}`}>
      <div
        className={`p-4 ${hasChildren ? 'cursor-pointer hover:bg-muted/50' : ''}`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(!isExpanded)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              <h4 className="font-medium text-foreground">
                {requirement.name}
                {requirement.requirement_code && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({requirement.requirement_code})
                  </span>
                )}
              </h4>
            </div>
            
            {requirement.description && (
              <p className="text-sm text-muted-foreground mb-2">{requirement.description}</p>
            )}
            
            <div className="bg-muted/30 rounded p-3 mb-3">
              <p className="text-sm font-medium text-foreground mb-1">Requirement:</p>
              <p className="text-sm text-foreground">{requirement.requirement_text}</p>
            </div>
          </div>
        </div>

        {/* Response Form */}
        <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">
              Your Response
            </label>
            <textarea
              className="w-full compact-input min-h-[100px]"
              placeholder="Describe how your agent meets this requirement..."
              value={response.response_text || ''}
              onChange={(e) => handleResponseChange('response_text', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">
              Compliance Status
            </label>
            <select
              className="compact-input"
              value={response.compliance_status || ''}
              onChange={(e) => handleResponseChange('compliance_status', e.target.value)}
            >
              <option value="">Select status...</option>
              <option value="compliant">Compliant</option>
              <option value="non_compliant">Non-Compliant</option>
              <option value="partial">Partially Compliant</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">
              Evidence / Documentation
            </label>
            <textarea
              className="w-full compact-input min-h-[80px]"
              placeholder="Provide links to documentation, file paths, or other evidence..."
              value={response.evidence ? JSON.stringify(response.evidence, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {}
                  handleResponseChange('evidence', parsed)
                } catch {
                  // Invalid JSON, store as text
                  handleResponseChange('evidence', { note: e.target.value })
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter JSON format or plain text (will be stored as evidence)
            </p>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-t pt-2">
          {requirement.children.map((child) => (
            <RequirementNode
              key={child.id}
              requirement={child}
              responses={responses}
              onResponseChange={onResponseChange}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

