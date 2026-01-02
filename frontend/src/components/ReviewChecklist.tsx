import { useState } from 'react'

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  required: boolean
}

interface ReviewChecklistProps {
  stage: string
  onChecklistChange?: (items: ChecklistItem[]) => void
}

const CHECKLISTS: Record<string, ChecklistItem[]> = {
  security: [
    { id: 'api_security', label: 'API Security Review', checked: false, required: true },
    { id: 'authentication', label: 'Authentication Mechanism', checked: false, required: true },
    { id: 'mfa', label: 'MFA Implementation', checked: false, required: true },
    { id: 'encryption', label: 'Data Encryption', checked: false, required: true },
    { id: 'access_controls', label: 'Access Controls', checked: false, required: true },
    { id: 'audit_logging', label: 'Audit Logging', checked: false, required: true },
    { id: 'vulnerability', label: 'Vulnerability Assessment', checked: false, required: true },
  ],
  compliance: [
    { id: 'gdpr', label: 'GDPR Compliance', checked: false, required: true },
    { id: 'data_privacy', label: 'Data Privacy Requirements', checked: false, required: true },
    { id: 'regulatory', label: 'Regulatory Alignment', checked: false, required: true },
    { id: 'policy_adherence', label: 'Policy Adherence', checked: false, required: true },
  ],
  technical: [
    { id: 'architecture', label: 'Architecture Assessment', checked: false, required: true },
    { id: 'integration', label: 'Integration Feasibility', checked: false, required: true },
    { id: 'performance', label: 'Performance Evaluation', checked: false, required: true },
    { id: 'scalability', label: 'Scalability Assessment', checked: false, required: true },
  ],
  business: [
    { id: 'use_case', label: 'Use Case Validation', checked: false, required: true },
    { id: 'roi', label: 'ROI Assessment', checked: false, required: true },
    { id: 'strategic', label: 'Strategic Alignment', checked: false, required: true },
    { id: 'business_value', label: 'Business Value', checked: false, required: true },
  ],
}

export default function ReviewChecklist({ stage, onChecklistChange }: ReviewChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>(
    CHECKLISTS[stage] || CHECKLISTS.security
  )

  const toggleItem = (id: string) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    )
    setItems(updated)
    onChecklistChange?.(updated)
  }

  const completed = items.filter(i => i.checked).length
  const total = items.length
  const progress = (completed / total) * 100

  return (
    <div className="compact-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Review Checklist</h3>
        <span className="text-xs text-muted-foreground">
          {completed}/{total} completed
        </span>
      </div>
      
      <div className="w-full progress-bar mb-4">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <label
            key={item.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleItem(item.id)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
              {item.label}
            </span>
            {item.required && (
              <span className="text-xs text-red-500">*</span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

