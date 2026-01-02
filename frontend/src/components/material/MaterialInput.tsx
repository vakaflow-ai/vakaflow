import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

type BaseProps = {
  label?: string
  helperText?: string
  error?: boolean
  errorText?: string
  startAdornment?: ReactNode
  endAdornment?: ReactNode
  icon?: ReactNode // Alias for startAdornment for compatibility
  fullWidth?: boolean
  multiline?: boolean
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { multiline?: false }
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true }

type MaterialInputProps = InputProps | TextareaProps

export default function MaterialInput({
  label,
  helperText,
  error = false,
  errorText,
  startAdornment,
  endAdornment,
  icon, // Support icon as alias for startAdornment
  fullWidth = true,
  multiline = false,
  className,
  id,
  ...props
}: MaterialInputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const hasError = error || !!errorText
  const displayText = errorText || helperText
  const effectiveStartAdornment = startAdornment || icon

  const inputClasses = cn(
    "flex w-full rounded-lg border bg-background",
    "px-4 py-3 text-base",
    "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-muted-foreground/60",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "focus-visible:border-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    hasError 
      ? "border-destructive focus-visible:ring-destructive focus-visible:border-destructive" 
      : "border-input hover:border-ring/50",
    !fullWidth && "w-auto",
    multiline && "min-h-[120px] py-3 resize-y",
    effectiveStartAdornment && "pl-11",
    endAdornment && "pr-11",
    className
  )

  return (
    <div className={cn("space-y-2", !fullWidth && "inline-block w-auto")}>
      {label && (
        <label 
          htmlFor={inputId} 
          className={cn(
            "text-sm font-medium leading-none block",
            hasError ? "text-destructive" : "text-foreground"
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {effectiveStartAdornment && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center pointer-events-none">
            {effectiveStartAdornment}
          </span>
        )}
        {multiline ? (
          <textarea
            id={inputId}
            className={inputClasses}
            {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            className={cn(inputClasses, "h-11")}
            {...(props as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {endAdornment && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center pointer-events-none">
            {endAdornment}
          </span>
        )}
        {hasError && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-destructive flex items-center pointer-events-none">
            <AlertCircle className="h-4 w-4" />
          </span>
        )}
      </div>
      {displayText && (
        <p className={cn(
          "text-sm leading-relaxed",
          hasError ? "text-destructive" : "text-muted-foreground"
        )}>
          {displayText}
        </p>
      )}
    </div>
  )
}
