import { useState, useCallback } from 'react'
import { businessRulesApi } from '../lib/compliance'
import api from '../lib/api'

export interface RuleEvaluationContext {
  [key: string]: any
}

export interface RuleEvaluationResult {
  rule_id: string
  rule_name: string
  rule_type: string
  action_type?: string
  action: {
    type: string
    value: any
    original_expression: string
  }
  action_config?: Record<string, any>
  priority: number
  is_automatic: boolean
}

export interface RuleEvaluationResponse {
  matched_rules: number
  rule_results: RuleEvaluationResult[]
  action_results: {
    executed: Array<{
      rule_id: string
      rule_name: string
      action: any
      result?: any
      error?: string
    }>
    suggested: Array<{
      rule_id: string
      rule_name: string
      action: any
      action_type?: string
    }>
  }
}

export function useBusinessRules() {
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const evaluateRules = useCallback(async (
    context: RuleEvaluationContext,
    entityType: string,
    screen?: string,
    ruleType?: string,
    autoExecute: boolean = true
  ): Promise<RuleEvaluationResponse | null> => {
    setEvaluating(true)
    setError(null)

    try {
      const response = await api.post('/business-rules/evaluate', {
        context,
        entity_type: entityType,
        screen,
        rule_type: ruleType,
        auto_execute: autoExecute
      })
      return response.data
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to evaluate rules'
      setError(errorMessage)
      console.error('Error evaluating business rules:', err)
      return null
    } finally {
      setEvaluating(false)
    }
  }, [])

  const getApplicableRules = useCallback(async (
    entityType: string,
    screen?: string,
    ruleType?: string
  ): Promise<RuleEvaluationResult[]> => {
    try {
      // Evaluate rules without executing actions to get applicable rules
      const result = await evaluateRules({}, entityType, screen, ruleType, false)
      return result?.rule_results || []
    } catch (err) {
      console.error('Error getting applicable rules:', err)
      return []
    }
  }, [evaluateRules])

  return {
    evaluateRules,
    getApplicableRules,
    evaluating,
    error
  }
}

