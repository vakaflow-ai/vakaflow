import { useState, useEffect } from 'react'
import { useBusinessRules, RuleEvaluationContext, RuleEvaluationResult } from '../hooks/useBusinessRules'

interface BusinessRulesIndicatorProps {
  context: RuleEvaluationContext
  entityType: 'agent' | 'assessment' | 'workflow' | 'user'
  screen?: string
  ruleType?: 'conditional' | 'assignment' | 'workflow' | 'validation'
  showDetails?: boolean
  onRulesMatched?: (rules: RuleEvaluationResult[]) => void
}

export default function BusinessRulesIndicator({
  context,
  entityType,
  screen,
  ruleType,
  showDetails = false,
  onRulesMatched
}: BusinessRulesIndicatorProps) {
  const { evaluateRules, evaluating, error } = useBusinessRules()
  const [matchedRules, setMatchedRules] = useState<RuleEvaluationResult[]>([])
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    if (Object.keys(context).length > 0) {
      evaluateRules(context, entityType, screen, ruleType, false)
        .then(result => {
          if (result && result.rule_results) {
            setMatchedRules(result.rule_results)
            if (onRulesMatched) {
              onRulesMatched(result.rule_results)
            }
          }
        })
        .catch(err => {
          console.error('Error evaluating rules:', err)
        })
    }
  }, [context, entityType, screen, ruleType, evaluateRules, onRulesMatched])

  if (evaluating) {
    return (
      <div className="business-rules-indicator">
        <span className="text-sm text-gray-500">Evaluating rules...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="business-rules-indicator">
        <span className="text-sm text-red-500">Error: {error}</span>
      </div>
    )
  }

  if (matchedRules.length === 0) {
    return null
  }

  const automaticRules = matchedRules.filter(r => r.is_automatic)
  const suggestedRules = matchedRules.filter(r => !r.is_automatic)

  return (
    <div className="business-rules-indicator">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowRules(!showRules)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {matchedRules.length} {matchedRules.length === 1 ? 'rule' : 'rules'} applicable
            {automaticRules.length > 0 && ` (${automaticRules.length} auto)`}
          </span>
        </button>
      </div>

      {showRules && showDetails && (
        <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
          <div className="space-y-2">
            {automaticRules.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1">Automatic Rules</h4>
                <ul className="space-y-1">
                  {automaticRules.map(rule => (
                    <li key={rule.rule_id} className="text-xs text-gray-600">
                      <span className="font-medium">{rule.rule_name}</span>
                      {rule.action && (
                        <span className="ml-2 text-gray-500">
                          → {rule.action.type}: {String(rule.action.value)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {suggestedRules.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1">Suggested Rules</h4>
                <ul className="space-y-1">
                  {suggestedRules.map(rule => (
                    <li key={rule.rule_id} className="text-xs text-gray-600">
                      <span className="font-medium">{rule.rule_name}</span>
                      {rule.action && (
                        <span className="ml-2 text-gray-500">
                          → {rule.action.type}: {String(rule.action.value)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

