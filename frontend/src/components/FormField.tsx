import { forwardRef, useEffect, useRef } from 'react'

interface FormFieldProps {
  label: string
  name: string
  type?: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  error?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  autoFocus?: boolean
  rows?: number
  min?: number
  max?: number
  maxLength?: number
  pattern?: string
  as?: 'input' | 'textarea' | 'select'
  children?: React.ReactNode
}

export const FormField = forwardRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FormFieldProps>(
  (
    {
      label,
      name,
      type = 'text',
      value,
      onChange,
      onBlur,
      error,
      required = false,
      placeholder,
      disabled = false,
      className = '',
      autoFocus = false,
      rows,
      min,
      max,
      maxLength,
      pattern,
      as = 'input',
      children,
      ...props
    },
    ref
  ) => {
    const fieldId = `field-${name}`
    const errorId = `error-${name}`
    const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

    // Focus on error field
    useEffect(() => {
      if (error && fieldRef.current) {
        fieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        fieldRef.current.focus()
      }
    }, [error])

    const inputRef = ref || fieldRef

    const baseInputClasses = `enterprise-input ${error ? 'enterprise-input-error' : ''} ${className}`
    
    const commonProps = {
      id: fieldId,
      name,
      value: value ?? '',
      onChange,
      onBlur,
      disabled,
      required,
      placeholder,
      autoFocus,
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': error ? errorId : undefined,
      className: baseInputClasses,
      ref: inputRef as any,
      ...props
    }

    return (
      <div className="enterprise-form-field">
        <label htmlFor={fieldId} className="enterprise-label">
          {label}
          {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
        </label>
        {as === 'textarea' ? (
          <textarea
            {...(commonProps as any)}
            rows={rows || 4}
            maxLength={maxLength}
          />
        ) : as === 'select' ? (
          <select {...(commonProps as any)}>
            {children}
          </select>
        ) : (
          <input
            {...(commonProps as any)}
            type={type}
            min={min}
            max={max}
            maxLength={maxLength}
            pattern={pattern}
          />
        )}
        {error && (
          <div id={errorId} className="enterprise-error-message" role="alert">
            {error}
          </div>
        )}
      </div>
    )
  }
)

FormField.displayName = 'FormField'

