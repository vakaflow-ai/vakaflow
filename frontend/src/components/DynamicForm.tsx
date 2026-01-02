import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formLayoutsApi, FieldAccessForRole } from '../lib/formLayouts'
import { submissionRequirementsApi, SubmissionRequirement } from '../lib/submissionRequirements'
import { FormField } from './FormField'
import { authApi } from '../lib/auth'
import AssessmentResponseGrid from './AssessmentResponseGrid'

interface DynamicFormProps {
  requestType: 'admin' | 'approver' | 'end_user' | 'vendor'
  agentType?: string
  agentCategory?: string
  formData: Record<string, any>
  onChange: (fieldName: string, value: any) => void
  onSubmit?: (data: Record<string, any>) => void
  readOnly?: boolean
  showValidation?: boolean
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void
}

export default function DynamicForm({
  requestType,
  agentType,
  agentCategory,
  formData,
  onChange,
  onSubmit,
  readOnly = false,
  showValidation = true,
  onValidationChange,
  assignmentId,
}: DynamicFormProps) {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    authApi.getCurrentUser().then((u) => {
      setUser(u)
      setUserRole(u?.role || '')
    }).catch(() => {})
  }, [])

  // Fetch active layout for this request type
  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ['form-layout', requestType, agentType, agentCategory],
    queryFn: () => formLayoutsApi.getActiveForScreen(requestType, 'new', agentType, agentCategory),
    enabled: !!user,
  })

  // Fetch field access for current role
  const { data: fieldAccess, isLoading: accessLoading } = useQuery({
    queryKey: ['field-access', requestType, userRole, agentType, 'new'],
    queryFn: () => formLayoutsApi.getFieldsWithAccessForRole(requestType, userRole, agentType, 'new').catch((error) => {
      // Handle 400 and 422 errors gracefully
      if (error?.response?.status === 400 || error?.response?.status === 422) {
        console.warn(`Field access query returned ${error?.response?.status}, returning empty array`)
        return []
      }
      throw error
    }),
    enabled: !!user && !!userRole,
  })

  // Fetch all submission requirements to get field definitions
  const { data: requirements } = useQuery({
    queryKey: ['submission-requirements'],
    queryFn: () => submissionRequirementsApi.list(undefined, undefined, undefined, true),
    enabled: !!user,
  })

  // Create field access map
  const fieldAccessMap = new Map<string, FieldAccessForRole>()
  fieldAccess?.forEach((access) => {
    fieldAccessMap.set(access.field_name, access)
  })

  // Create requirements map
  const requirementsMap = new Map<string, SubmissionRequirement>()
  requirements?.forEach((req) => {
    requirementsMap.set(req.field_name, req)
  })

  if (layoutLoading || accessLoading) {
    return <div className="text-center p-8">Loading form...</div>
  }

  if (!layout) {
    return <div className="text-center p-8 text-gray-500">No form layout configured for this screen</div>
  }

  // Validate field value
  const validateField = (fieldName: string, value: any, requirement?: SubmissionRequirement): string | null => {
    if (!requirement) return null

    // Required validation
    if (requirement.is_required) {
      // For checkboxes, required means the value must be true
      if (requirement.field_type === 'checkbox') {
        if (value !== true) {
          return `${requirement.label} is required`
        }
      }
      // For multi-select (checkboxes), check if at least one is selected
      else if (requirement.field_type === 'multi_select') {
        if (!Array.isArray(value) || value.length === 0) {
          return `${requirement.label} is required`
        }
      }
      // For other field types, check for null/undefined/empty
      else {
        if (value === null || value === undefined || value === '') {
          return `${requirement.label} is required`
        }
        if (Array.isArray(value) && value.length === 0) {
          return `${requirement.label} is required`
        }
      }
    }

    // Length validation
    if (typeof value === 'string') {
      if (requirement.min_length && value.length < requirement.min_length) {
        return `${requirement.label} must be at least ${requirement.min_length} characters`
      }
      if (requirement.max_length && value.length > requirement.max_length) {
        return `${requirement.label} must be no more than ${requirement.max_length} characters`
      }
      if (requirement.pattern) {
        const regex = new RegExp(requirement.pattern)
        if (!regex.test(value)) {
          return `${requirement.label} format is invalid`
        }
      }
    }

    // Number validation
    if (typeof value === 'number') {
      if (requirement.min_value !== null && requirement.min_value !== undefined && value < requirement.min_value) {
        return `${requirement.label} must be at least ${requirement.min_value}`
      }
      if (requirement.max_value !== null && requirement.max_value !== undefined && value > requirement.max_value) {
        return `${requirement.label} must be no more than ${requirement.max_value}`
      }
    }

    return null
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    const access = fieldAccessMap.get(fieldName)
    if (access && access.can_edit && !readOnly) {
      onChange(fieldName, value)

      // Validate field
      if (showValidation) {
        const requirement = requirementsMap.get(fieldName)
        const error = validateField(fieldName, value, requirement)
        const newErrors = { ...fieldErrors }
        if (error) {
          newErrors[fieldName] = error
        } else {
          delete newErrors[fieldName]
        }
        setFieldErrors(newErrors)

        // Notify parent of validation state
        if (onValidationChange) {
          const isValid = Object.keys(newErrors).length === 0
          onValidationChange(isValid, newErrors)
        }
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields before submit
    if (showValidation && layout) {
      const errors: Record<string, string> = {}
      layout.sections.forEach((section) => {
        section.fields.forEach((fieldName) => {
          const requirement = requirementsMap.get(fieldName)
          const value = formData[fieldName]
          const error = validateField(fieldName, value, requirement)
          if (error) {
            errors[fieldName] = error
          }
        })
      })

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        if (onValidationChange) {
          onValidationChange(false, errors)
        }
        return
      }
    }

    if (onSubmit) {
      onSubmit(formData)
    }
  }

  // Check if field should be visible based on dependencies
  const isFieldVisible = (fieldName: string): boolean => {
    const access = fieldAccessMap.get(fieldName)
    if (!access || !access.can_view) {
      return false
    }

    // Check field dependencies
    if (layout.field_dependencies && layout.field_dependencies[fieldName]) {
      const dependency = layout.field_dependencies[fieldName]
      const dependsOnValue = formData[dependency.depends_on]

      switch (dependency.condition) {
        case 'equals':
          return dependsOnValue === dependency.value
        case 'not_equals':
          return dependsOnValue !== dependency.value
        case 'contains':
          if (Array.isArray(dependsOnValue)) {
            return dependsOnValue.includes(dependency.value)
          }
          return String(dependsOnValue || '').includes(String(dependency.value || ''))
        case 'not_contains':
          if (Array.isArray(dependsOnValue)) {
            return !dependsOnValue.includes(dependency.value)
          }
          return !String(dependsOnValue || '').includes(String(dependency.value || ''))
        case 'greater_than':
          return Number(dependsOnValue) > Number(dependency.value)
        case 'less_than':
          return Number(dependsOnValue) < Number(dependency.value)
        case 'is_empty':
          return !dependsOnValue || dependsOnValue === '' || (Array.isArray(dependsOnValue) && dependsOnValue.length === 0)
        case 'is_not_empty':
          return !!dependsOnValue && dependsOnValue !== '' && (!Array.isArray(dependsOnValue) || dependsOnValue.length > 0)
        default:
          return true
      }
    }

    return true
  }

  // Render field based on requirement definition
  const renderField = (fieldName: string, sectionFields: string[], sectionId: string) => {
    const access = fieldAccessMap.get(fieldName)
    const requirement = requirementsMap.get(fieldName)

    // Check if user has view access
    if (!access || !access.can_view) {
      return null // Don't render field if user can't view it
    }

    // Check field dependencies
    if (!isFieldVisible(fieldName)) {
      return null // Don't render field if dependency condition is not met
    }

    if (!requirement) {
      // Field not found in requirements, render as simple text input
      return (
        <FormField
          key={`${sectionId}-${fieldName}`}
          label={fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          name={fieldName}
          type="text"
          value={formData[fieldName] || ''}
          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          disabled={readOnly || !access.can_edit}
          required={false}
        />
      )
    }

    const isReadOnly = readOnly || !access.can_edit
    const value = formData[fieldName] || ''

    switch (requirement.field_type) {
      case 'textarea':
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            as="textarea"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled={isReadOnly}
            required={requirement.is_required}
            placeholder={requirement.placeholder}
            rows={4}
            maxLength={requirement.max_length}
            error={fieldErrors[fieldName]}
          />
        )

      case 'select':
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            as="select"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled={isReadOnly}
            required={requirement.is_required}
            error={fieldErrors[fieldName]}
          >
            <option value="">Select...</option>
            {requirement.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </option>
            ))}
          </FormField>
        )

      case 'multi_select':
        // Multi-select as checkboxes
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {requirement.options?.map((opt: any) => {
                const optValue = opt.value || opt
                const optLabel = opt.label || opt
                const isChecked = Array.isArray(value) ? value.includes(optValue) : false
                return (
                  <label key={optValue} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const currentValues = Array.isArray(value) ? value : []
                        const newValues = e.target.checked
                          ? [...currentValues, optValue]
                          : currentValues.filter((v) => v !== optValue)
                        handleFieldChange(fieldName, newValues)
                      }}
                      disabled={isReadOnly}
                      className="mr-2"
                    />
                    {optLabel}
                  </label>
                )
              })}
            </div>
          </div>
        )

      case 'checkbox':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                disabled={isReadOnly}
                className="mr-2"
              />
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
          </div>
        )

      case 'number':
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
            disabled={isReadOnly}
            required={requirement.is_required}
            placeholder={requirement.placeholder}
            min={requirement.min_value}
            max={requirement.max_value}
            error={fieldErrors[fieldName]}
          />
        )

      case 'date':
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled={isReadOnly}
            required={requirement.is_required}
          />
        )

      case 'email':
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled={isReadOnly}
            required={requirement.is_required}
            placeholder={requirement.placeholder}
            maxLength={requirement.max_length}
            error={fieldErrors[fieldName]}
          />
        )

      case 'url':
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled={isReadOnly}
            required={requirement.is_required}
            placeholder={requirement.placeholder}
            maxLength={requirement.max_length}
          />
        )

      case 'file':
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label">
              {requirement.label}
              {requirement.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleFieldChange(fieldName, file)
                }
              }}
              disabled={isReadOnly}
              className="enterprise-input"
            />
          </div>
        )

      case 'assessment_response_grid':
        // Special field type for displaying assessment responses in a grid
        return (
          <div key={`${sectionId}-${fieldName}`} className="enterprise-form-field">
            <label className="enterprise-label mb-3">
              {requirement.label || 'Assessment Responses'}
            </label>
            <AssessmentResponseGrid
              assignmentId={assignmentId || formData.assignment_id}
              questions={formData.questions} // Pass questions if available in formData
              responses={formData.responses} // Pass responses if available in formData
              questionReviews={formData.questionReviews} // Pass question reviews if available
              readOnly={isReadOnly}
              showReviewStatus={requestType === 'approver'}
            />
          </div>
        )

      default:
        // Default to text input
        return (
          <FormField
            key={`${sectionId}-${fieldName}`}
            label={requirement.label}
            name={fieldName}
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled={isReadOnly}
            required={requirement.is_required}
            placeholder={requirement.placeholder}
            maxLength={requirement.max_length}
            pattern={requirement.pattern}
            error={fieldErrors[fieldName]}
          />
        )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {layout.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          const sectionFields = section.fields.filter((fieldName) => {
            return isFieldVisible(fieldName)
          })

          if (sectionFields.length === 0) {
            return null // Skip empty sections
          }

          return (
            <div key={section.id} className="border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">{section.title}</h3>
              {section.description && (
                <p className="text-sm text-gray-600 mb-4">{section.description}</p>
              )}
              <div className="space-y-4">
                {sectionFields.map((fieldName) => renderField(fieldName, sectionFields, section.id))}
              </div>
            </div>
          )
        })}

      {onSubmit && !readOnly && (
        <div className="flex justify-end gap-2">
          {showValidation && Object.keys(fieldErrors).length > 0 && (
            <div className="text-sm text-red-600 self-center">
              Please fix {Object.keys(fieldErrors).length} error(s) before submitting
            </div>
          )}
          <button
            type="submit"
            disabled={showValidation && Object.keys(fieldErrors).length > 0}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>
      )}
    </form>
  )
}
