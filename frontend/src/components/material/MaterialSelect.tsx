import { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MaterialSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface MaterialSelectProps {
  value?: string | number | null
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: MaterialSelectOption[]
  placeholder?: string
  label?: string
  error?: boolean
  errorText?: string
  disabled?: boolean
  required?: boolean
  className?: string
  fullWidth?: boolean
  startAdornment?: ReactNode
  children?: ReactNode // Allow custom option elements
}

export default function MaterialSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  label,
  error = false,
  errorText,
  disabled = false,
  required = false,
  className,
  fullWidth = true,
  startAdornment,
  children,
}: MaterialSelectProps) {
  const hasError = error || !!errorText

  // If children are provided, use them (for custom option elements)
  // Otherwise, generate options from the options prop
  const selectContent = children || (
    <>
      <option value="" disabled={required}>
        {placeholder}
      </option>
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </>
  )

  return (
    <div className={cn('space-y-2', fullWidth ? 'w-full' : 'inline-block w-auto', className)}>
      {label && (
        <label className={cn(
          'text-sm font-medium leading-none block text-slate-700',
          hasError && 'text-destructive'
        )}>
          {label}
          {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
        </label>
      )}
      
      <div className="relative">
        {startAdornment && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none z-10">
            {startAdornment}
          </span>
        )}
        <select
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={cn(
            'w-full h-10 rounded-md border bg-white',
            'px-3 py-2 text-sm',
            'appearance-none cursor-pointer',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            startAdornment && 'pl-10',
            'pr-10', // Space for chevron
            disabled
              ? 'cursor-not-allowed opacity-50 bg-muted/50 border-slate-300'
              : '',
            hasError
              ? 'border-destructive focus:ring-destructive/20 focus:border-destructive'
              : 'border-slate-300 hover:border-slate-400 focus:ring-primary/20 focus:border-primary'
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.25em 1.25em',
          }}
        >
          {selectContent}
        </select>
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none',
            'text-slate-400 transition-transform duration-200',
            disabled && 'opacity-50'
          )}
        />
      </div>

      {errorText && (
        <p className="text-sm text-destructive mt-1">
          {errorText}
        </p>
      )}
    </div>
  )
}

