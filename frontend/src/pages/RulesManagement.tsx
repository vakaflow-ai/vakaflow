import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { businessRulesApi, BusinessRule } from '../lib/compliance'
import { authApi } from '../lib/auth'
import Layout from '../components/Layout'
import { MaterialCard, MaterialButton, MaterialChip, MaterialInput } from '../components/material'
import { ShieldCheckIcon } from '../components/Icons'

// Condition Value Input Component
interface ConditionValueInputProps {
  condition: {
    id: string
    entity: string
    attribute: string
    operator: string
    value: string | string[]  // Support both single and multiple values
  }
  ruleEntities: Record<string, any>
  onValueChange: (value: string | string[]) => void
  supportsMultiple?: boolean  // Whether this input supports multiple values
}

function ConditionValueInput({ condition, ruleEntities, onValueChange, supportsMultiple = true }: ConditionValueInputProps) {
  const [attributeValues, setAttributeValues] = useState<string[]>([])
  const [loadingValues, setLoadingValues] = useState(false)
  const [showValuesDropdown, setShowValuesDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const entityData = condition.entity ? ruleEntities[condition.entity] : null
  const attributeData = condition.entity && condition.attribute ? entityData?.attributes[condition.attribute] : null
  const attributeType = attributeData?.type || 'string'
  const predefinedValues = attributeData?.values || []

  // Determine if we should use multiple values based on operator and supportsMultiple flag
  const useMultiple = supportsMultiple && (condition.operator === 'in' || condition.operator === '=' || condition.operator === 'contains')
  const currentValues = useMultiple 
    ? (Array.isArray(condition.value) ? condition.value : (condition.value ? [condition.value] : []))
    : (Array.isArray(condition.value) ? condition.value[0] || '' : condition.value || '')

  // Fetch attribute values when entity and attribute are selected
  useEffect(() => {
    if (condition.entity && condition.attribute && (attributeType === 'enum' || attributeData?.values_source === 'dynamic')) {
      setLoadingValues(true)
      businessRulesApi.getAttributeValues(condition.entity, condition.attribute)
        .then(values => {
          setAttributeValues(values)
        })
        .catch(error => {
          console.error('Error fetching attribute values:', error)
          setAttributeValues([])
        })
        .finally(() => {
          setLoadingValues(false)
        })
    } else {
      setAttributeValues([])
    }
  }, [condition.entity, condition.attribute, attributeType, attributeData?.values_source])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showValuesDropdown && !target.closest('.condition-value-dropdown')) {
        setShowValuesDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showValuesDropdown])

  // Calculate position for fixed dropdown to escape overflow containers
  const updateDropdownPosition = () => {
    if (showValuesDropdown && containerRef.current && dropdownRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const dropdown = dropdownRef.current
      dropdown.style.top = `${rect.bottom + 4}px`
      dropdown.style.left = `${rect.left}px`
      dropdown.style.width = `${rect.width}px`
    }
  }
  
  // Update dropdown position when shown or window resizes/scrolls
  useEffect(() => {
    if (showValuesDropdown && useMultiple) {
      updateDropdownPosition()
      window.addEventListener('scroll', updateDropdownPosition, true)
      window.addEventListener('resize', updateDropdownPosition)
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true)
        window.removeEventListener('resize', updateDropdownPosition)
      }
    }
  }, [showValuesDropdown, useMultiple])

  // Use predefined values if available, otherwise use fetched values
  const availableValues = predefinedValues.length > 0 ? predefinedValues : attributeValues

  // Multi-select dropdown for multiple values
  if (useMultiple && availableValues.length > 0) {
    const selectedValues = Array.isArray(currentValues) ? currentValues : []
    
    return (
      <div className="relative w-full condition-value-dropdown">
        <div 
          ref={containerRef}
          className="shadow-sm rounded-lg border border-gray-200 text-sm w-full min-h-[42px] flex items-center gap-1.5 flex-wrap p-2 cursor-pointer bg-white hover:border-primary-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all"
          onClick={() => setShowValuesDropdown(!showValuesDropdown)}
        >
          {selectedValues.length > 0 ? (
            selectedValues.map((val, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
              >
                {val}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    const newValues = selectedValues.filter((_, i) => i !== idx)
                    onValueChange(newValues.length > 0 ? newValues : '')
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="text-gray-600 text-sm">Select value(s)...</span>
          )}
        </div>
        {showValuesDropdown && (
          <div 
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-auto"
            style={{ position: 'fixed' }}
          >
            {availableValues.map((val: string) => {
              const isSelected = selectedValues.includes(val)
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      const newValues = selectedValues.filter(v => v !== val)
                      onValueChange(newValues.length > 0 ? newValues : '')
                    } else {
                      onValueChange([...selectedValues, val])
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    isSelected ? 'bg-blue-50 font-medium' : ''
                  }`}
                >
                  <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </span>
                  {val}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Single select dropdown for boolean or enum types
  if (attributeType === 'boolean' || (attributeType === 'enum' && availableValues.length > 0)) {
    return (
      <select
        value={Array.isArray(currentValues) ? currentValues[0] || '' : currentValues}
        onChange={(e) => onValueChange(e.target.value)}
        className="shadow-sm rounded-lg border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none text-gray-700"
        disabled={!condition.attribute || loadingValues}
      >
        <option value="">Select value...</option>
        {availableValues.map((val: string) => (
          <option key={val} value={val}>{val}</option>
        ))}
      </select>
    )
  }

  // Default: text input
  return (
    <input
      type={attributeType === 'number' ? 'number' : 'text'}
      value={Array.isArray(currentValues) ? currentValues.join(', ') : currentValues}
      onChange={(e) => {
        if (useMultiple) {
          // Parse comma-separated values
          const values = e.target.value.split(',').map(v => v.trim()).filter(v => v)
          onValueChange(values.length > 0 ? values : '')
        } else {
          onValueChange(e.target.value)
        }
      }}
      className="shadow-sm rounded-lg border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none text-gray-700"
      placeholder={attributeType === 'number' ? 'Enter number...' : useMultiple ? 'Enter values (comma-separated)...' : condition.operator === 'like' ? 'e.g., abc*' : 'Enter value...'}
      disabled={!condition.attribute}
    />
  )
}

interface ConditionGroup {
  id: string
  conditions: Array<{
    id: string
    entity: string
    attribute: string
    operator: string
    value: string | string[]
    not?: boolean
    logicalOperator?: 'AND' | 'OR'
  }>
  operator: 'AND' | 'OR'
  not?: boolean
}

export default function RulesManagement() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<any>(null)
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [selectedRule, setSelectedRule] = useState<BusinessRule | null>(null)
  const [ruleWizardStep, setRuleWizardStep] = useState<1 | 2>(1)
  const [ruleBuilderMode, setRuleBuilderMode] = useState<'gui' | 'jql'>('gui')
  const [jqlQuery, setJqlQuery] = useState('')
  const [jqlSuggestions, setJqlSuggestions] = useState<string[]>([])
  const [jqlSuggestionIndex, setJqlSuggestionIndex] = useState(-1)
  const [showJqlSuggestions, setShowJqlSuggestions] = useState(false)
  const [jqlValidationError, setJqlValidationError] = useState<string | null>(null)
  const [jqlCursorPosition, setJqlCursorPosition] = useState(0)
  const [ruleFormData, setRuleFormData] = useState({
    rule_id: '',
    name: '',
    description: '',
    condition_expression: '',
    action_expression: 'no_action',
    rule_type: 'conditional',
    applicable_entities: [] as string[],
    priority: 100,
    is_active: true,
    is_automatic: true
  })
  
  // GUI Builder state
  const [guiConditions, setGuiConditions] = useState<ConditionGroup[]>([
    {
      id: 'group-1',
      operator: 'AND',
      conditions: [{
        id: 'cond-1',
        entity: '',
        attribute: '',
        operator: '=',
        value: ''
      }]
    }
  ])

  // Rule entities and attributes
  const [ruleEntities, setRuleEntities] = useState<Record<string, any>>({})
  const [loadingEntities, setLoadingEntities] = useState(false)
  
  // Fetch rule entities and attributes
  useEffect(() => {
    const fetchEntities = async () => {
      setLoadingEntities(true)
      try {
        const data = await businessRulesApi.getRuleEntitiesAttributes()
        setRuleEntities(data.entities || {})
      } catch (error) {
        console.error('Error fetching rule entities:', error)
      } finally {
        setLoadingEntities(false)
      }
    }
    fetchEntities()
  }, [])

  // Multi-select dropdown state
  const [showEntitiesDropdown, setShowEntitiesDropdown] = useState(false)

  // Available options
  const availableEntities = [
    { value: 'agent', label: 'Agent' },
    { value: 'assessment', label: 'Assessment' },
    { value: 'workflow', label: 'Workflow' },
    { value: 'user', label: 'User' }
  ]


  useEffect(() => {
    authApi.getCurrentUser().then(setUser).catch(() => {
      navigate('/login')
    })
  }, [navigate])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.multi-select-dropdown')) {
        setShowEntitiesDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Auto-sync GUI conditions to JQL
  useEffect(() => {
    if (guiConditions && guiConditions.length > 0) {
      const expression = generateExpressionFromGUI(guiConditions)
      if (expression) {
        const jql = expressionToJQL(expression)
        setJqlQuery(jql)
      } else {
        setJqlQuery('')
      }
    }
  }, [guiConditions])

  // JQL Syntax Validation
  const validateJQLSyntax = (query: string): string | null => {
    if (!query || !query.trim()) return null
    
    try {
      const trimmed = query.trim()
      
      // Check for balanced parentheses
      let parenCount = 0
      for (const char of trimmed) {
        if (char === '(') parenCount++
        if (char === ')') parenCount--
        if (parenCount < 0) return 'Unmatched closing parenthesis'
      }
      if (parenCount !== 0) return 'Unmatched opening parenthesis'
      
      // Check for valid entity names
      const entityPattern = /\b(Agent|User|Assessment|Vendor|AssessmentAssignment)\b/gi
      const entities = trimmed.match(entityPattern)
      if (!entities || entities.length === 0) {
        return 'No valid entity found. Use: Agent, User, Assessment, Vendor, or AssessmentAssignment'
      }
      
      // Check for valid operators
      const operatorPattern = /(=|!=|>|<|>=|<=|LIKE|CONTAINS|IN)\s+/gi
      const operators = trimmed.match(operatorPattern)
      if (!operators || operators.length === 0) {
        return 'No valid operator found. Use: =, !=, >, <, >=, <=, LIKE, CONTAINS, or IN'
      }
      
      // Basic structure check: Entity.Attribute Operator Value
      const conditionPattern = /(Agent|User|Assessment|Vendor|AssessmentAssignment)\.\w+\s+(=|!=|>|<|>=|<=|LIKE|CONTAINS|IN)\s+/
      if (!conditionPattern.test(trimmed)) {
        return 'Invalid condition format. Expected: Entity.Attribute Operator Value'
      }
      
      return null // Valid
    } catch (error) {
      return 'Syntax validation error: ' + (error as Error).message
    }
  }

  // Generate auto-complete suggestions for JQL
  const getJQLSuggestions = (query: string, cursorPos: number): string[] => {
    const suggestions: string[] = []
    const textBeforeCursor = query.substring(0, cursorPos)
    const lastWord = textBeforeCursor.split(/[\s.]+/).pop() || ''
    const trimmedBefore = textBeforeCursor.trim()
    
    // If at start or after logical operator, suggest entities
    if (trimmedBefore.length === 0 || /^(AND|OR|NOT)\s*$/i.test(trimmedBefore)) {
      Object.keys(ruleEntities).forEach(entity => {
        const entityLabel = ruleEntities[entity].label
        if (entityLabel.toLowerCase().startsWith(lastWord.toLowerCase()) || lastWord === '') {
          suggestions.push(entityLabel)
        }
      })
    }
    // If after entity name with dot, suggest attributes
    else if (/^(Agent|User|Assessment|Vendor|AssessmentAssignment)\./i.test(trimmedBefore)) {
      const entityMatch = trimmedBefore.match(/\b(Agent|User|Assessment|Vendor|AssessmentAssignment)\./i)
      if (entityMatch) {
        const entityKey = entityMatch[1].toLowerCase()
        if (ruleEntities[entityKey]) {
          const afterDot = trimmedBefore.substring(entityMatch[0].length).trim()
          const partialAttr = afterDot.split(/\s+/)[0]
          
          Object.keys(ruleEntities[entityKey].attributes || {}).forEach(attr => {
            const attrData = ruleEntities[entityKey].attributes[attr]
            const attrLabel = attrData.label
            if (partialAttr === '' || attrLabel.toLowerCase().startsWith(partialAttr.toLowerCase())) {
              suggestions.push(attrLabel)
            }
          })
        }
      }
    }
    // If after entity.attribute, suggest operators
    else if (/^(Agent|User|Assessment|Vendor|AssessmentAssignment)\.\w+\s*$/i.test(trimmedBefore)) {
      const operators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'CONTAINS', 'IN']
      operators.forEach(op => {
        if (op.toLowerCase().startsWith(lastWord.toLowerCase()) || lastWord === '') {
          suggestions.push(op)
        }
      })
    }
    // If after operator, suggest value patterns
    else {
      const entityAttrMatch = trimmedBefore.match(/\b(Agent|User|Assessment|Vendor|AssessmentAssignment)\.(\w+)\s+(=|!=|>|<|>=|<=|LIKE|CONTAINS|IN)\s*$/i)
      if (entityAttrMatch) {
        const entityKey = entityAttrMatch[1].toLowerCase()
        const attrKey = entityAttrMatch[2].toLowerCase()
        if (ruleEntities[entityKey]?.attributes[attrKey]) {
          const attrData = ruleEntities[entityKey].attributes[attrKey]
          if (attrData.type === 'boolean') {
            suggestions.push('yes', 'no', 'true', 'false')
          } else if (attrData.values && attrData.values.length > 0) {
            attrData.values.forEach((val: string) => {
              if (val.toLowerCase().includes(lastWord.toLowerCase()) || lastWord === '') {
                suggestions.push(`"${val}"`)
              }
            })
          } else {
            suggestions.push('"value"')
          }
        }
      }
    }
    
    return suggestions.slice(0, 10)
  }

  // JQL-like Query Parser
  const parseJQLQuery = (query: string): string => {
    if (!query || !query.trim()) return ''
    
    try {
      let expression = query.trim()
      
      // Handle entity.attribute patterns (case-insensitive)
      expression = expression.replace(/\b(Agent|User|Assessment|Vendor|AssessmentAssignment)\./gi, (match) => {
        return match.toLowerCase()
      })
      
      // Normalize whitespace around operators
      expression = expression.replace(/\s+/g, ' ')
      expression = expression.replace(/\s+IN\s+/gi, ' IN ')
      expression = expression.replace(/\s+LIKE\s+/gi, ' LIKE ')
      expression = expression.replace(/\s+CONTAINS\s+/gi, ' CONTAINS ')
      expression = expression.replace(/\s+=\s+/g, ' = ')
      expression = expression.replace(/\s+!=\s+/g, ' != ')
      expression = expression.replace(/\s+>\s+/g, ' > ')
      expression = expression.replace(/\s+<\s+/g, ' < ')
      expression = expression.replace(/\s+>=\s+/g, ' >= ')
      expression = expression.replace(/\s+<=\s+/g, ' <= ')
      expression = expression.replace(/\s+AND\s+/gi, ' AND ')
      expression = expression.replace(/\s+OR\s+/gi, ' OR ')
      expression = expression.replace(/\s+NOT\s+/gi, ' NOT ')
      
      // Handle LIKE patterns with wildcards
      expression = expression.replace(/LIKE\s+"([^"]*)\*([^"]*)"/gi, 'LIKE "$1%$2"')
      expression = expression.replace(/LIKE\s+'([^']*)\*([^']*)'/gi, "LIKE '$1%$2'")
      expression = expression.replace(/LIKE\s+([^\s"']+)\*/gi, 'LIKE "$1%"')
      
      // Handle CONTAINS operator
      expression = expression.replace(/CONTAINS\s+"([^"]+)"/gi, 'LIKE "%$1%"')
      expression = expression.replace(/CONTAINS\s+'([^']+)'/gi, "LIKE '%$1%'")
      expression = expression.replace(/CONTAINS\s+([^\s"']+)/gi, 'LIKE "%$1%"')
      
      // Handle IN clauses
      expression = expression.replace(/IN\s*\(([^)]+)\)/gi, (match, values) => {
        const valueList = values.split(',').map((v: string) => {
          v = v.trim().replace(/^["']|["']$/g, '')
          return `"${v}"`
        }).join(', ')
        return `IN (${valueList})`
      })
      
      // Quote unquoted string values
      expression = expression.replace(/([=!<>]+|LIKE|CONTAINS)\s+([^"'\s.()]+(?:\.[^"'\s()]+)?)/g, (match, op, value) => {
        if (value.includes('.') && !value.match(/^["']/)) {
          return match
        }
        if (value.match(/^["']/)) {
          return match
        }
        if (value.match(/^-?\d+(\.\d+)?$/)) {
          return match
        }
        if (value.match(/^(true|false|yes|no)$/i)) {
          return `${op} "${value}"`
        }
        return `${op} "${value}"`
      })
      
      expression = expression.replace(/""/g, '"')
      
      return expression.trim()
    } catch (error) {
      console.error('Error parsing JQL query:', error)
      return query
    }
  }

  // Convert expression to JQL-like format
  const expressionToJQL = (expression: string): string => {
    if (!expression || !expression.trim()) return ''
    
    try {
      let jql = expression.trim()
      jql = jql.replace(/\bagent\./g, 'Agent.')
      jql = jql.replace(/\buser\./g, 'User.')
      jql = jql.replace(/\bassessment\./g, 'Assessment.')
      jql = jql.replace(/\bassessment_assignment\./g, 'AssessmentAssignment.')
      jql = jql.replace(/\bvendor\./g, 'Vendor.')
      jql = jql.replace(/LIKE\s+"([^"]*)%([^"]*)"/gi, 'LIKE "$1*$2"')
      jql = jql.replace(/LIKE\s+"([^"]*)%"/gi, 'LIKE "$1*"')
      jql = jql.replace(/LIKE\s+"%([^"]*)%"/gi, 'CONTAINS "$1"')
      return jql
    } catch (error) {
      console.error('Error converting expression to JQL:', error)
      return expression
    }
  }

  // Helper function to parse expression back to GUI conditions
  const parseExpressionToGUI = (expression: string): ConditionGroup[] => {
    if (!expression || !expression.trim()) {
      return [{
        id: 'group-1',
        operator: 'AND',
        conditions: [{
          id: 'cond-1',
          entity: '',
          attribute: '',
          operator: '=',
          value: ''
        }]
      }]
    }
    
    try {
      // Parse the expression into GUI conditions
      // Expression format: entity.attribute operator value
      // Can have AND/OR/NOT operators and parentheses
      
      const groups: ConditionGroup[] = []
      let currentGroupId = 1
      let currentConditionId = 1
      
      // Simple parser for basic expressions
      // Handle NOT at the beginning
      let expr = expression.trim()
      let groupNot = false
      if (expr.toUpperCase().startsWith('NOT ')) {
        groupNot = true
        expr = expr.substring(4).trim()
        // Remove outer parentheses if present
        if (expr.startsWith('(') && expr.endsWith(')')) {
          expr = expr.slice(1, -1).trim()
        }
      }
      
      // Split by AND/OR to get individual conditions
      const parts = expr.split(/\s+(AND|OR)\s+/i)
      const operators: string[] = []
      const conditions: string[] = []
      
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          conditions.push(parts[i])
        } else {
          operators.push(parts[i].toUpperCase())
        }
      }
      
      // If no AND/OR found, treat entire expression as one condition
      if (conditions.length === 0) {
        conditions.push(expr)
      }
      
      const parsedConditions: any[] = []
      let groupOperator: 'AND' | 'OR' = 'AND'
      
      // Determine group operator from the first operator found
      if (operators.length > 0) {
        groupOperator = operators[0] as 'AND' | 'OR'
      }
      
      // Parse each condition
      for (const conditionStr of conditions) {
        let condStr = conditionStr.trim()
        let conditionNot = false
        
        // Handle NOT for individual condition
        if (condStr.toUpperCase().startsWith('NOT ')) {
          conditionNot = true
          condStr = condStr.substring(4).trim()
          if (condStr.startsWith('(') && condStr.endsWith(')')) {
            condStr = condStr.slice(1, -1).trim()
          }
        }
        
        // Remove outer parentheses
        while (condStr.startsWith('(') && condStr.endsWith(')')) {
          condStr = condStr.slice(1, -1).trim()
        }
        
        // Parse entity.attribute operator value
        // Pattern: entity.attribute operator "value" or entity.attribute IN ("value1", "value2")
        const entityAttrMatch = condStr.match(/^([a-z_]+)\.([a-z_]+)\s+/i)
        if (!entityAttrMatch) continue
        
        const entity = entityAttrMatch[1].toLowerCase()
        const attribute = entityAttrMatch[2].toLowerCase()
        const rest = condStr.substring(entityAttrMatch[0].length).trim()
        
        // Determine operator and value
        let operator = '='
        let value: string | string[] = ''
        
        // Check for IN operator
        const inMatch = rest.match(/^IN\s*\(([^)]+)\)/i)
        if (inMatch) {
          operator = 'in'
          const valuesStr = inMatch[1]
          value = valuesStr.split(',').map(v => {
            v = v.trim().replace(/^["']|["']$/g, '')
            return v
          }).filter(v => v)
        } else {
          // Check for other operators
          const operatorMatch = rest.match(/^(=|!=|>|<|>=|<=|LIKE|CONTAINS)\s+(.+)/i)
          if (operatorMatch) {
            const op = operatorMatch[1].toLowerCase()
            if (op === 'like') {
              operator = 'like'
              let val = operatorMatch[2].trim().replace(/^["']|["']$/g, '')
              // Convert LIKE "%value%" to contains
              if (val.startsWith('%') && val.endsWith('%')) {
                operator = 'contains'
                value = val.slice(1, -1)
              } else if (val.endsWith('%')) {
                operator = 'like'
                value = val.slice(0, -1) + '*'
              } else {
                value = val
              }
            } else if (op === 'contains') {
              operator = 'contains'
              value = operatorMatch[2].trim().replace(/^["']|["']$/g, '')
            } else {
              operator = op
              value = operatorMatch[2].trim().replace(/^["']|["']$/g, '')
            }
          }
        }
        
        parsedConditions.push({
          id: `cond-${currentConditionId++}`,
          entity,
          attribute,
          operator,
          value,
          not: conditionNot
        })
      }
      
      if (parsedConditions.length > 0) {
        groups.push({
          id: `group-${currentGroupId}`,
          operator: groupOperator,
          conditions: parsedConditions,
          not: groupNot
        })
      } else {
        // Fallback: empty condition
        groups.push({
          id: `group-${currentGroupId}`,
          operator: 'AND',
          conditions: [{
            id: `cond-${currentConditionId}`,
            entity: '',
            attribute: '',
            operator: '=',
            value: ''
          }]
        })
      }
      
      return groups
    } catch (error) {
      console.error('Error parsing expression to GUI:', error)
      // Return default empty condition on error
      return [{
        id: 'group-1',
        operator: 'AND',
        conditions: [{
          id: 'cond-1',
          entity: '',
          attribute: '',
          operator: '=',
          value: ''
        }]
      }]
    }
  }

  // Helper function to generate expression from GUI builder
  const generateExpressionFromGUI = (conditions: ConditionGroup[]): string => {
    if (!conditions || conditions.length === 0) return ''
    
    const groupExpressions = conditions.map(group => {
      if (!group.conditions || group.conditions.length === 0) return ''
      
      const conditionExpressions = group.conditions
        .filter(c => c.entity && c.attribute && c.value && (Array.isArray(c.value) ? c.value.length > 0 : true))
        .map(c => {
          const leftSide = `${c.entity}.${c.attribute}`
          const operator = c.operator
          const values = Array.isArray(c.value) ? c.value : [c.value]
          const hasMultipleValues = values.length > 1
          
          if (hasMultipleValues && (operator === '=' || operator === 'contains')) {
            const quotedValues = values.map(v => `"${v}"`).join(', ')
            const rightSide = `IN (${quotedValues})`
            let expr = `${leftSide} ${rightSide}`
            if (c.not) {
              expr = `NOT (${expr})`
            }
            return expr
          }
          
          const singleValue = values[0]
          let rightSide: string
          
          if (operator === 'like') {
            const likeValue = String(singleValue).replace(/\*/g, '%')
            rightSide = `LIKE "${likeValue}"`
          } else if (operator === 'contains') {
            rightSide = `LIKE "%${singleValue}%"`
          } else if (operator === 'in') {
            const inValues = Array.isArray(c.value) ? c.value : String(singleValue).split(',').map(v => v.trim()).filter(v => v)
            rightSide = `IN (${inValues.map(v => `"${v}"`).join(', ')})`
          } else {
            const valStr = String(singleValue)
            rightSide = valStr.includes('.') ? valStr : `"${valStr}"`
            rightSide = `${operator} ${rightSide}`
          }
          
          let expr = `${leftSide} ${rightSide}`
          if (c.not) {
            expr = `NOT (${expr})`
          }
          return expr
        })
      
      if (conditionExpressions.length === 0) return ''
      if (conditionExpressions.length === 1) {
        let result = conditionExpressions[0]
        if (group.not) {
          result = `NOT (${result})`
        }
        return result
      }
      let result = `(${conditionExpressions.join(` ${group.operator} `)})`
      if (group.not) {
        result = `NOT ${result}`
      }
      return result
    })
    
    const validGroups = groupExpressions.filter(g => g)
    if (validGroups.length === 0) return ''
    if (validGroups.length === 1) return validGroups[0]
    
    return validGroups.join(' AND ')
  }

  // Business Rules queries
  const { data: businessRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['business-rules'],
    queryFn: () => businessRulesApi.listRules(),
    enabled: !!user && ['tenant_admin', 'platform_admin', 'policy_admin'].includes(user?.role)
  })

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      let finalFormData = { ...ruleFormData }
      
      if (jqlQuery && jqlQuery.trim()) {
        const validationError = validateJQLSyntax(jqlQuery)
        if (validationError) {
          setJqlValidationError(validationError)
          alert(`Invalid JQL query: ${validationError}`)
          return
        }
        setJqlValidationError(null)
        const expression = parseJQLQuery(jqlQuery)
        if (!expression) {
          alert('Invalid JQL query. Please check your syntax.')
          return
        }
        finalFormData.condition_expression = expression
      } else {
        const expression = generateExpressionFromGUI(guiConditions)
        if (!expression) {
          alert('Please define at least one condition or enter a JQL query')
          return
        }
        finalFormData.condition_expression = expression
        const jql = expressionToJQL(expression)
        setJqlQuery(jql)
      }
      
      if (!finalFormData.condition_expression) {
        alert('Please provide a rule condition')
        return
      }
      
      if (selectedRule) {
        await businessRulesApi.updateRule(selectedRule.id, finalFormData)
      } else {
        // Don't send rule_id when creating - backend will auto-generate it
        const { rule_id, ...createData } = finalFormData
        // Ensure action_expression is provided (required by backend)
        if (!createData.action_expression || createData.action_expression.trim() === '') {
          createData.action_expression = 'no_action'
        }
        // Ensure condition_expression is provided (required by backend)
        if (!createData.condition_expression || createData.condition_expression.trim() === '') {
          alert('Please provide a valid rule condition')
          return
        }
        console.log('Creating rule with data:', createData)
        await businessRulesApi.createRule(createData)
      }
      queryClient.invalidateQueries({ queryKey: ['business-rules'] })
      setShowCreateRule(false)
      setSelectedRule(null)
      setRuleWizardStep(1)
      setJqlQuery('')
      setRuleFormData({
        rule_id: '',
        name: '',
        description: '',
        condition_expression: '',
        action_expression: 'no_action',
        rule_type: 'conditional',
        applicable_entities: [],
        priority: 100,
        is_active: true,
        is_automatic: true
      })
      setGuiConditions([{
        id: 'group-1',
        operator: 'AND',
        conditions: [{
          id: 'cond-1',
          entity: 'user',
          attribute: 'department',
          operator: '=',
          value: ''
        }]
      }])
    } catch (error: any) {
      alert(`Failed to ${selectedRule ? 'update' : 'create'} rule: ` + (error.response?.data?.detail || error.message))
    }
  }

  if (!user || !['tenant_admin', 'platform_admin', 'policy_admin'].includes(user.role)) {
    return (
      <Layout user={user}>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Access denied</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium mb-2 text-gray-900">Business Rules</h1>
            <p className="text-sm text-gray-600">
              Manage business rules and conditional logic to automate workflows and validate data.
            </p>
          </div>
        <div className="flex gap-3">
          <MaterialButton
            onClick={() => {
              setShowCreateRule(true)
              setRuleWizardStep(1)
              setRuleBuilderMode('gui')
              setRuleFormData({
                rule_id: '',
                name: '',
                description: '',
                condition_expression: '',
                action_expression: 'no_action',
                rule_type: 'conditional',
                applicable_entities: [],
                priority: 100,
                is_active: true,
                is_automatic: true
              })
              setGuiConditions([{
                id: 'group-1',
                operator: 'AND',
                conditions: [{
                  id: 'cond-1',
                  entity: 'user',
                  attribute: 'department',
                  operator: '=',
                  value: ''
                }]
              }])
            }}
          >
            Create Rule
          </MaterialButton>
        </div>
        </div>

        {/* Create/Edit Rule Form - Two Step Wizard - Material Design */}
        {showCreateRule && (
          <MaterialCard elevation={1} className="p-8 border-none overflow-visible">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline/10">
              <h2 className="text-xl font-medium text-gray-900">
                {selectedRule ? 'Edit Business Rule' : 'New Business Rule'}
              </h2>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    ruleWizardStep === 1 
                      ? 'bg-blue-600 text-white shadow-md-elevation-2' 
                      : 'bg-primary-100 text-primary-700'
                  }`}>
                    {ruleWizardStep > 1 ? '✓' : '1'}
                  </div>
                  <span className={`text-sm font-medium ${ruleWizardStep === 1 ? 'text-gray-900' : 'text-gray-500'}`}>Business Info</span>
                </div>
                <div className="w-10 h-px bg-gray-200"></div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    ruleWizardStep === 2 
                      ? 'bg-blue-600 text-white shadow-md-elevation-2' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    2
                  </div>
                  <span className={`text-sm font-medium ${ruleWizardStep === 2 ? 'text-gray-900' : 'text-gray-500'}`}>Rule Definition</span>
                </div>
              </div>
            </div>

            {/* Step 1: Business Info */}
            {ruleWizardStep === 1 && (
              <div className="space-y-6 max-w-2xl">
                <MaterialInput
                  label="Rule Name"
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  placeholder="e.g., Department Match Rule"
                  helperText="Rule ID will be auto-generated from the name"
                  required
                />

                <MaterialInput
                  label="Description"
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  placeholder="Describe what this rule does..."
                  multiline
                  rows={3}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MaterialInput
                    label="Priority"
                    type="number"
                    value={ruleFormData.priority}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, priority: parseInt(e.target.value) || 100 })}
                    min="1"
                    helperText="Lower number = higher priority"
                  />
                  
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-medium text-gray-600 tracking-tight">Applicable Entities</label>
                    <div className="relative multi-select-dropdown">
                      <button
                        type="button"
                        onClick={() => setShowEntitiesDropdown(!showEntitiesDropdown)}
                        className="w-full shadow-sm rounded-lg border border-gray-200 text-sm h-[42px] px-3 bg-white hover:border-primary-300 flex items-center justify-between transition-all outline-none font-medium text-gray-700"
                      >
                        <span className="truncate">
                          {ruleFormData.applicable_entities.length > 0
                            ? `${ruleFormData.applicable_entities.length} selected`
                            : 'Select entities...'}
                        </span>
                        <svg className={`w-4 h-4 text-gray-600 transition-transform ${showEntitiesDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showEntitiesDropdown && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-outline/10 rounded-md shadow-md-elevation-8 max-h-60 overflow-auto p-2">
                          {availableEntities.map((entity) => (
                            <label
                              key={entity.value}
                              className="flex items-center px-3 py-2 hover:bg-surface-variant/20 rounded-lg cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={ruleFormData.applicable_entities.includes(entity.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRuleFormData({
                                      ...ruleFormData,
                                      applicable_entities: [...ruleFormData.applicable_entities, entity.value]
                                    })
                                  } else {
                                    setRuleFormData({
                                      ...ruleFormData,
                                      applicable_entities: ruleFormData.applicable_entities.filter(e => e !== entity.value)
                                    })
                                  }
                                }}
                                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-primary-500"
                              />
                              <span className="text-sm font-medium text-gray-700">{entity.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 p-4 bg-surface-variant/10 rounded-md border border-outline/10">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                      ruleFormData.is_active ? 'bg-blue-600 border-primary-600' : 'bg-white border-gray-300 group-hover:border-blue-500'
                    }`}>
                      {ruleFormData.is_active && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <input
                      type="checkbox"
                      checked={ruleFormData.is_active}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, is_active: e.target.checked })}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-700">Rule Active</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                      ruleFormData.is_automatic ? 'bg-blue-600 border-primary-600' : 'bg-white border-gray-300 group-hover:border-blue-500'
                    }`}>
                      {ruleFormData.is_automatic && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <input
                      type="checkbox"
                      checked={ruleFormData.is_automatic}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, is_automatic: e.target.checked })}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-gray-700">Auto-Apply when condition matches</span>
                  </label>
                </div>

                <div className="flex gap-3 justify-end pt-6 border-t border-outline/10 mt-8">
                  <MaterialButton
                    variant="text"
                    color="gray"
                    onClick={() => {
                      setShowCreateRule(false)
                      setSelectedRule(null)
                      setRuleWizardStep(1)
                    }}
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    onClick={() => {
                      if (!ruleFormData.name) {
                        alert('Please fill in Rule Name')
                        return
                      }
                      setRuleWizardStep(2)
                    }}
                  >
                    Next: Define Rule
                  </MaterialButton>
                </div>
              </div>
            )}

            {/* Step 2: Rule Definition */}
            {ruleWizardStep === 2 && (
              <form onSubmit={handleRuleSubmit} className="space-y-8">
                <div className="max-w-xs">
                  <label className="text-xs font-medium text-gray-600 tracking-tight mb-1.5 block">Rule Type</label>
                  <select
                    value={ruleFormData.rule_type}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, rule_type: e.target.value })}
                    className="shadow-sm rounded-lg border border-gray-200 text-sm w-full h-[42px] px-3 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                    required
                  >
                    <option value="conditional">Conditional</option>
                    <option value="assignment">Assignment</option>
                    <option value="workflow">Workflow</option>
                    <option value="validation">Validation</option>
                  </select>
                </div>

                {/* GUI Builder - Refactored for Material Design */}
                <MaterialCard elevation={1} className="p-0 border-none bg-surface-variant/5 overflow-hidden">
                  <div className="p-4 bg-surface-variant/10 border-b border-outline/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        Visual Condition Builder
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Build complex logic with nested groups and AND/OR operators.</p>
                    </div>
                    {loadingEntities && <MaterialChip label="Loading attributes..." size="small" variant="outlined" color="primary" className="animate-pulse" />}
                  </div>
                  
                  <div className="p-6">
                    {guiConditions.map((group, groupIdx) => (
                      <div key={group.id} className="relative mb-8 last:mb-0">
                        {groupIdx > 0 && (
                          <div className="flex items-center gap-4 mb-6">
                            <div className="flex-1 h-px bg-gray-200"></div>
                            <div className="relative group">
                              <select
                                value={guiConditions[groupIdx - 1]?.operator || 'AND'}
                                onChange={(e) => {
                                  const updated = [...guiConditions]
                                  updated[groupIdx - 1].operator = e.target.value as 'AND' | 'OR'
                                  setGuiConditions(updated)
                                }}
                                className="appearance-none bg-white border-2 border-primary-200 text-primary-700 text-xs font-bold rounded-lg px-6 py-2 focus:border-blue-500 focus:outline-none shadow-md-elevation-1 cursor-pointer transition-all"
                              >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                              </select>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-3 h-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </div>
                            </div>
                            <div className="flex-1 h-px bg-gray-200"></div>
                          </div>
                        )}
                        
                        <div className="bg-white rounded-lg border border-outline/10 shadow-md-elevation-1 p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                                group.not ? 'bg-error-500 border-error-500' : 'bg-white border-gray-300 group-hover:border-error-400'
                              }`}>
                                {group.not && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                              </div>
                              <input
                                type="checkbox"
                                checked={group.not || false}
                                onChange={(e) => {
                                  const updated = [...guiConditions]
                                  updated[groupIdx].not = e.target.checked
                                  setGuiConditions(updated)
                                }}
                                className="sr-only"
                              />
                              <span className={`text-xs font-bold tracking-tight ${group.not ? 'text-red-600' : 'text-gray-500'}`}>
                                Negate Group (NOT)
                              </span>
                            </label>
                            
                            {guiConditions.length > 1 && (
                              <MaterialButton
                                variant="text"
                                color="error"
                                size="small"
                                onClick={() => {
                                  const updated = guiConditions.filter((g, idx) => idx !== groupIdx)
                                  setGuiConditions(updated.length > 0 ? updated : [{
                                    id: 'group-1',
                                    operator: 'AND',
                                    conditions: [{
                                      id: 'cond-1',
                                      entity: '',
                                      attribute: '',
                                      operator: '=',
                                      value: ''
                                    }]
                                  }])
                                }}
                                className="!p-1.5 hover:bg-error-50"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </MaterialButton>
                            )}
                          </div>
                          
                          <div className="overflow-x-auto -mx-5 px-5">
                            <table className="w-full min-w-[800px]">
                              <thead>
                                <tr className="text-left text-xs font-medium text-gray-500 tracking-tight">
                                  <th className="pb-3 pl-2">NOT</th>
                                  <th className="pb-3 pl-2">Entity</th>
                                  <th className="pb-3 pl-2">Attribute</th>
                                  <th className="pb-3 pl-2">Operator</th>
                                  <th className="pb-3 pl-2">Value</th>
                                  <th className="pb-3 pl-2">Logic</th>
                                  <th className="pb-3 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {group.conditions.map((condition, condIdx) => (
                                  <tr key={condition.id} className="group/row">
                                    <td className="py-3 px-2">
                                      <label className="flex items-center justify-center cursor-pointer">
                                        <div className={`w-3.5 h-3.5 rounded border transition-all ${
                                          condition.not ? 'bg-error-500 border-error-500' : 'bg-white border-gray-300'
                                        }`} />
                                        <input
                                          type="checkbox"
                                          checked={condition.not || false}
                                          onChange={(e) => {
                                            const updated = [...guiConditions]
                                            updated[groupIdx].conditions[condIdx].not = e.target.checked
                                            setGuiConditions(updated)
                                          }}
                                          className="sr-only"
                                        />
                                      </label>
                                    </td>
                                    <td className="py-3 px-2">
                                      <select
                                        value={condition.entity}
                                        onChange={(e) => {
                                          const updated = [...guiConditions]
                                          updated[groupIdx].conditions[condIdx].entity = e.target.value
                                          updated[groupIdx].conditions[condIdx].attribute = ''
                                          updated[groupIdx].conditions[condIdx].value = ''
                                          setGuiConditions(updated)
                                        }}
                                        className="w-full shadow-sm rounded-lg border border-gray-200 text-xs w-full h-[36px] px-2 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                                      >
                                        <option value="">Entity...</option>
                                        {Object.entries(ruleEntities).map(([key, entity]: [string, any]) => (
                                          <option key={key} value={key}>{entity.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-3 px-2">
                                      <select
                                        value={condition.attribute}
                                        onChange={(e) => {
                                          const updated = [...guiConditions]
                                          updated[groupIdx].conditions[condIdx].attribute = e.target.value
                                          updated[groupIdx].conditions[condIdx].value = ''
                                          if (condition.entity && ruleEntities[condition.entity]) {
                                            const attr = ruleEntities[condition.entity].attributes[e.target.value]
                                            if (attr && attr.operators && attr.operators.length > 0) {
                                              updated[groupIdx].conditions[condIdx].operator = attr.operators[0]
                                            }
                                          }
                                          setGuiConditions(updated)
                                        }}
                                        className="w-full shadow-sm rounded-lg border border-gray-200 text-xs w-full h-[36px] px-2 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                                        disabled={!condition.entity}
                                      >
                                        <option value="">Attribute...</option>
                                        {condition.entity && ruleEntities[condition.entity] && Object.entries(ruleEntities[condition.entity].attributes || {}).map(([key, attr]: [string, any]) => (
                                          <option key={key} value={key}>{attr.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-3 px-2">
                                      <select
                                        value={condition.operator}
                                        onChange={(e) => {
                                          const updated = [...guiConditions]
                                          updated[groupIdx].conditions[condIdx].operator = e.target.value
                                          setGuiConditions(updated)
                                        }}
                                        className="w-full shadow-sm rounded-lg border border-gray-200 text-xs w-full h-[36px] px-2 bg-white hover:border-primary-300 focus:border-blue-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none font-medium text-gray-700"
                                        disabled={!condition.attribute}
                                      >
                                        {condition.entity && condition.attribute && ruleEntities[condition.entity]?.attributes[condition.attribute]?.operators?.map((op: string) => (
                                          <option key={op} value={op}>
                                            {op === '=' ? 'is' : op === '!=' ? 'is not' : op === '>' ? 'greater than' : op === '<' ? 'less than' : op === '>=' ? 'greater or equal' : op === '<=' ? 'less or equal' : op === 'contains' ? 'Contains' : op === 'like' ? 'like' : op === 'in' ? 'in' : op}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-3 px-2">
                                      <div className="w-full">
                                        <ConditionValueInput
                                          condition={condition}
                                          ruleEntities={ruleEntities}
                                          onValueChange={(value) => {
                                            const updated = [...guiConditions]
                                            updated[groupIdx].conditions[condIdx].value = value
                                            setGuiConditions(updated)
                                          }}
                                          supportsMultiple={true}
                                        />
                                      </div>
                                    </td>
                                    <td className="py-3 px-2">
                                      {condIdx < group.conditions.length - 1 && (
                                        <div className="flex items-center gap-2">
                                          <select
                                            value={condition.logicalOperator || 'AND'}
                                            onChange={(e) => {
                                              const updated = [...guiConditions]
                                              updated[groupIdx].conditions[condIdx].logicalOperator = e.target.value as 'AND' | 'OR'
                                              setGuiConditions(updated)
                                            }}
                                            className="appearance-none bg-primary-50 text-primary-700 text-xs font-bold rounded-md px-3 py-1.5 border border-primary-100 hover:border-primary-300 focus:outline-none transition-all cursor-pointer"
                                          >
                                            <option value="AND">AND</option>
                                            <option value="OR">OR</option>
                                          </select>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-2 text-center">
                                      <MaterialButton
                                        variant="text"
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                          const updated = [...guiConditions]
                                          updated[groupIdx].conditions = updated[groupIdx].conditions.filter((_, idx) => idx !== condIdx)
                                          if (updated[groupIdx].conditions.length === 0) {
                                            const finalUpdated = guiConditions.filter((_, idx) => idx !== groupIdx)
                                            setGuiConditions(finalUpdated.length > 0 ? finalUpdated : [{
                                              id: `group-${Date.now()}`,
                                              operator: 'AND',
                                              conditions: [{
                                                id: `cond-${Date.now()}`,
                                                entity: '',
                                                attribute: '',
                                                operator: '=',
                                                value: ''
                                              }]
                                            }])
                                          } else {
                                            setGuiConditions(updated)
                                          }
                                        }}
                                        className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </MaterialButton>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="pt-2 flex items-center gap-3">
                            <MaterialButton
                              variant="text"
                              size="small"
                              onClick={() => {
                                const updated = [...guiConditions]
                                updated[groupIdx].conditions.push({
                                  id: `cond-${Date.now()}`,
                                  entity: '',
                                  attribute: '',
                                  operator: '=',
                                  value: '',
                                  logicalOperator: 'AND'
                                })
                                setGuiConditions(updated)
                              }}
                              startIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                              className="text-blue-600 font-bold tracking-tight text-xs"
                            >
                              Add Condition
                            </MaterialButton>
                            
                            <MaterialButton
                              variant="text"
                              size="small"
                              onClick={() => {
                                const newGroup: ConditionGroup = {
                                  id: `group-${Date.now()}`,
                                  operator: 'AND',
                                  conditions: [{
                                    id: `cond-${Date.now()}`,
                                    entity: '',
                                    attribute: '',
                                    operator: '=',
                                    value: '',
                                    logicalOperator: 'AND'
                                  }]
                                }
                                setGuiConditions([...guiConditions, newGroup])
                              }}
                              startIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                              className="text-blue-600 font-bold tracking-tight text-xs"
                            >
                              Add Group
                            </MaterialButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </MaterialCard>

                {/* JQL Editor */}
                <MaterialCard elevation={1} className="p-6 border-none bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs font-medium text-gray-600 tracking-tight block">Condition Expression (JQL)</label>
                    <div className="flex items-center gap-2">
                      <MaterialChip 
                        label={jqlValidationError ? 'Invalid Syntax' : 'Syntax OK'} 
                        color={jqlValidationError ? 'error' : 'success'} 
                        size="small"
                        variant="filled"
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      value={jqlQuery}
                      onChange={(e) => {
                        const newValue = e.target.value
                        setJqlQuery(newValue)
                        setJqlCursorPosition(e.target.selectionStart || 0)
                        
                        const suggestions = getJQLSuggestions(newValue, e.target.selectionStart || 0)
                        setJqlSuggestions(suggestions)
                        setShowJqlSuggestions(suggestions.length > 0)
                        
                        if (newValue.trim()) {
                          const validationError = validateJQLSyntax(newValue)
                          setJqlValidationError(validationError)
                          
                          if (!validationError) {
                            const expression = parseJQLQuery(newValue)
                            setRuleFormData({ ...ruleFormData, condition_expression: expression })
                          }
                        } else {
                          setJqlValidationError(null)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (showJqlSuggestions && jqlSuggestions.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setJqlSuggestionIndex(prev => 
                              prev < jqlSuggestions.length - 1 ? prev + 1 : prev
                            )
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setJqlSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
                          } else if (e.key === 'Enter' && jqlSuggestionIndex >= 0) {
                            e.preventDefault()
                            const suggestion = jqlSuggestions[jqlSuggestionIndex]
                            const textBeforeCursor = jqlQuery.substring(0, jqlCursorPosition)
                            const lastWord = textBeforeCursor.split(/[\s.]+/).pop() || ''
                            const newQuery = textBeforeCursor.replace(new RegExp(`${lastWord}$`), suggestion) + jqlQuery.substring(jqlCursorPosition)
                            setJqlQuery(newQuery)
                            setJqlCursorPosition(textBeforeCursor.length - lastWord.length + suggestion.length)
                            setShowJqlSuggestions(false)
                            setJqlSuggestionIndex(-1)
                          } else if (e.key === 'Escape') {
                            setShowJqlSuggestions(false)
                            setJqlSuggestionIndex(-1)
                          }
                        }
                      }}
                      onFocus={(e) => {
                        const suggestions = getJQLSuggestions(jqlQuery, e.target.selectionStart || 0)
                        setJqlSuggestions(suggestions)
                        setShowJqlSuggestions(suggestions.length > 0)
                        setJqlCursorPosition(e.target.selectionStart || 0)
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowJqlSuggestions(false), 200)
                      }}
                      onClick={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        setJqlCursorPosition(target.selectionStart || 0)
                        const suggestions = getJQLSuggestions(jqlQuery, target.selectionStart || 0)
                        setJqlSuggestions(suggestions)
                        setShowJqlSuggestions(suggestions.length > 0)
                      }}
                      className={`w-full p-4 border-2 rounded-md focus:outline-none font-mono text-sm min-h-[120px] transition-all ${
                        jqlValidationError 
                          ? 'border-error-200 focus:border-error-500 bg-error-50/30' 
                          : 'border-gray-200 focus:border-blue-500 bg-white shadow-sm'
                      }`}
                      placeholder="e.g., Agent.category = Finance OR User.department = Engineering"
                      required
                    />
                    {showJqlSuggestions && jqlSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-outline/10 rounded-md shadow-md-elevation-16 max-h-60 overflow-auto p-2">
                        {jqlSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const textBeforeCursor = jqlQuery.substring(0, jqlCursorPosition)
                              const lastWord = textBeforeCursor.split(/[\s.]+/).pop() || ''
                              const newQuery = textBeforeCursor.replace(new RegExp(`${lastWord}$`), suggestion) + jqlQuery.substring(jqlCursorPosition)
                              setJqlQuery(newQuery)
                              setJqlCursorPosition(textBeforeCursor.length - lastWord.length + suggestion.length)
                              setShowJqlSuggestions(false)
                              setJqlSuggestionIndex(-1)
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm rounded-lg transition-colors ${
                              idx === jqlSuggestionIndex ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700 hover:bg-surface-variant/20'
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {jqlValidationError && (
                    <div className="mt-3 flex items-start gap-2 text-red-600 bg-error-50 p-3 rounded-lg border border-error-100">
                      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs font-medium leading-relaxed">{jqlValidationError}</span>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-primary-50/50 rounded-md border border-primary-100/50">
                    <p className="text-sm font-bold text-primary-800 tracking-tight mb-2">JQL Syntax Help</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                      <div className="flex items-center gap-2 text-xs text-primary-700">
                        <span className="font-bold">Entities:</span> Agent, User, Assessment, Vendor
                      </div>
                      <div className="flex items-center gap-2 text-xs text-primary-700">
                        <span className="font-bold">Operators:</span> =, !=, &gt;, &lt;, IN, LIKE, CONTAINS
                      </div>
                    </div>
                  </div>
                </MaterialCard>

                <div className="flex gap-3 justify-end pt-8 border-t border-outline/10">
                  <MaterialButton
                    variant="outlined"
                    color="gray"
                    onClick={() => setRuleWizardStep(1)}
                    startIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>}
                  >
                    Back
                  </MaterialButton>
                  <MaterialButton
                    variant="text"
                    color="gray"
                    onClick={() => {
                      setShowCreateRule(false)
                      setSelectedRule(null)
                      setRuleWizardStep(1)
                    }}
                  >
                    Cancel
                  </MaterialButton>
                  <MaterialButton
                    type="submit"
                  >
                    {selectedRule ? 'Update Rule' : 'Save Rule'}
                  </MaterialButton>
                </div>
              </form>
            )}
          </MaterialCard>
        )}

        {/* Rules List - Material Design */}
        <MaterialCard elevation={2} className="overflow-hidden border-none">
          <div className="p-6 border-b bg-surface-variant/10">
            <h2 className="text-lg font-medium text-gray-900">Active Business Rules</h2>
          </div>
          {rulesLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
              <div className="text-muted-foreground">Loading rules...</div>
            </div>
          ) : businessRules?.length === 0 ? (
            <div className="text-center py-16 bg-surface-variant/5">
              <ShieldCheckIcon className="w-16 h-12 text-gray-500 mx-auto mb-4" />
              <div className="text-lg font-medium text-gray-500">No rules found</div>
              <div className="text-sm text-gray-600 mt-1">Create your first rule to get started</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-surface-variant/30">
                  <tr>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Name</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Condition</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Type</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight text-center">Priority</th>
                    <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 tracking-tight">Status</th>
                    <th className="px-6 py-2 text-right text-xs font-medium text-gray-500 tracking-tight">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {businessRules?.map((rule: BusinessRule) => (
                    <tr key={rule.id} className="hover:bg-primary-50/20 transition-all duration-150">
                      <td className="px-6 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{rule.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-2">
                        <div className="text-xs font-mono text-primary-700 bg-primary-50 p-2 rounded-lg border border-primary-100 max-w-xs truncate" title={rule.condition_expression}>
                          {rule.condition_expression}
                        </div>
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip 
                          label={rule.rule_type} 
                          color="primary"
                          size="small" 
                          variant="outlined" 
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-center text-sm font-medium text-gray-600">
                        {rule.priority}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap">
                        <MaterialChip 
                          label={rule.is_active ? 'Active' : 'Inactive'} 
                          color={rule.is_active ? 'success' : 'default'}
                          size="small" 
                          variant="filled" 
                        />
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end">
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            color={rule.is_active ? 'gray' : 'success'}
                            onClick={async () => {
                              try {
                                await businessRulesApi.updateRule(rule.id, {
                                  is_active: !rule.is_active
                                })
                                queryClient.invalidateQueries({ queryKey: ['business-rules'] })
                              } catch (error: any) {
                                alert('Failed to update rule: ' + (error.response?.data?.detail || error.message))
                              }
                            }}
                          >
                            {rule.is_active ? 'Disable' : 'Enable'}
                          </MaterialButton>
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => {
                              setSelectedRule(rule)
                              setRuleWizardStep(1)
                              setRuleBuilderMode('gui')
                              
                              if (rule.condition_expression) {
                                const parsedConditions = parseExpressionToGUI(rule.condition_expression)
                                setGuiConditions(parsedConditions)
                                const jql = expressionToJQL(rule.condition_expression)
                                setJqlQuery(jql)
                              } else {
                                setJqlQuery('')
                                setGuiConditions([{
                                  id: 'group-1',
                                  operator: 'AND',
                                  conditions: [{
                                    id: 'cond-1',
                                    entity: '',
                                    attribute: '',
                                    operator: '=',
                                    value: ''
                                  }]
                                }])
                              }
                              
                              setRuleFormData({
                                rule_id: rule.rule_id,
                                name: rule.name,
                                description: rule.description || '',
                                condition_expression: rule.condition_expression,
                                action_expression: rule.action_expression || 'no_action',
                                rule_type: rule.rule_type,
                                applicable_entities: rule.applicable_entities || [],
                                priority: rule.priority,
                                is_active: rule.is_active,
                                is_automatic: rule.is_automatic
                              })
                              setShowCreateRule(true)
                            }}
                          >
                            Edit
                          </MaterialButton>
                          <MaterialButton
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={async () => {
                              if (confirm(`Delete rule "${rule.name}"?`)) {
                                try {
                                  await businessRulesApi.deleteRule(rule.id)
                                  queryClient.invalidateQueries({ queryKey: ['business-rules'] })
                                } catch (error: any) {
                                  alert('Failed to delete rule: ' + (error.response?.data?.detail || error.message))
                                }
                              }
                            }}
                          >
                            Delete
                          </MaterialButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MaterialCard>
      </div>
    </Layout>
  )
}

