import { useState, useCallback, useRef, useEffect } from 'react'

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  email?: boolean
  url?: boolean
  custom?: (value: any) => string | null
  message?: string
}

export interface ValidationRules {
  [key: string]: ValidationRule
}

export interface FormErrors {
  [key: string]: string
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const firstErrorRef = useRef<string | null>(null)

  const validateField = useCallback(
    (name: string, value: any): string | null => {
      const rule = rules[name]
      if (!rule) return null

      // Required validation
      if (rule.required) {
        // For boolean values (checkboxes), required means the value must be true
        if (typeof value === 'boolean') {
          if (value !== true) {
            return rule.message || `${name} is required`
          }
        }
        // For arrays (multi-select), check if at least one is selected
        else if (Array.isArray(value)) {
          if (value.length === 0) {
            return rule.message || `${name} is required`
          }
        }
        // For other types, check for null/undefined/empty
        else if (!value || (typeof value === 'string' && value.trim() === '')) {
          return rule.message || `${name} is required`
        }
      }

      if (!value && !rule.required) return null

      // Min length validation
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        return rule.message || `${name} must be at least ${rule.minLength} characters`
      }

      // Max length validation
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        return rule.message || `${name} must be no more than ${rule.maxLength} characters`
      }

      // Email validation
      if (rule.email && typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          return rule.message || 'Please enter a valid email address'
        }
      }

      // URL validation
      if (rule.url && typeof value === 'string') {
        try {
          new URL(value)
        } catch {
          return rule.message || 'Please enter a valid URL'
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        return rule.message || `${name} format is invalid`
      }

      // Custom validation
      if (rule.custom) {
        const customError = rule.custom(value)
        if (customError) return customError
      }

      return null
    },
    [rules]
  )

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    let isValid = true
    firstErrorRef.current = null

    Object.keys(rules).forEach((name) => {
      const error = validateField(name, values[name])
      if (error) {
        newErrors[name] = error
        isValid = false
        if (!firstErrorRef.current) {
          firstErrorRef.current = name
        }
      }
    })

    setErrors(newErrors)
    return isValid
  }, [values, rules, validateField])

  const handleChange = useCallback(
    (name: string, value: any) => {
      setValues((prev) => ({ ...prev, [name]: value }))
      
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[name]
          return newErrors
        })
      }

      // Validate on change if field has been touched
      if (touched[name]) {
        const error = validateField(name, value)
        if (error) {
          setErrors((prev) => ({ ...prev, [name]: error }))
        }
      }
    },
    [errors, touched, validateField]
  )

  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }))
      const error = validateField(name, values[name])
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }))
      }
    },
    [values, validateField]
  )

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) => {
      return async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Mark all fields as touched
        const allTouched: Record<string, boolean> = {}
        Object.keys(rules).forEach((key) => {
          allTouched[key] = true
        })
        setTouched(allTouched)

        // Validate form
        if (validateForm()) {
          await onSubmit(values)
        } else {
          // Focus on first error field
          if (firstErrorRef.current) {
            const errorField = document.getElementById(`field-${firstErrorRef.current}`)
            if (errorField) {
              errorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
              errorField.focus()
            }
          }
        }
      }
    },
    [values, validateForm, rules]
  )

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
    firstErrorRef.current = null
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    validateForm,
    reset,
    setValues,
    setErrors
  }
}

