import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

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
  showPasswordToggle?: boolean // For password fields
  requirements?: string[] // For password requirements list
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { multiline?: false }
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true }

type MaterialInputProps = InputProps | TextareaProps

export default function MaterialInput(props: MaterialInputProps) {
  const {
    label,
    helperText,
    error = false,
    errorText,
    startAdornment,
    endAdornment,
    icon, // Support icon as alias for startAdornment
    fullWidth = true,
    multiline = false,
    showPasswordToggle = false,
    requirements,
    className,
    id,
    ...restProps
  } = props
  
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const hasError = error || !!errorText
  const displayText = errorText || helperText
  const effectiveStartAdornment = startAdornment || icon
  const [showPassword, setShowPassword] = useState(false)
  
  // Type guard to check if it's an input (not textarea)
  const isInput = !multiline
  const inputType = isInput ? (restProps as InputHTMLAttributes<HTMLInputElement>).type : undefined
  const isPassword = inputType === 'password' && showPasswordToggle

  const inputClasses = cn(
    "w-full rounded-md border bg-white",
    "px-3 py-2 text-sm",
    "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-muted-foreground/50",
    "transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
    hasError 
      ? "border-destructive focus:ring-destructive/20 focus:border-destructive" 
      : "border-slate-300 hover:border-slate-400",
    !fullWidth && "w-auto",
    multiline && "min-h-[100px] py-2 resize-y",
    effectiveStartAdornment && "pl-10",
    (endAdornment || isPassword) && "pr-10",
    className
  )

  return (
    <div className={cn("space-y-2", fullWidth ? "w-full" : "inline-block w-auto")}>
      {label && (
        <label 
          htmlFor={inputId} 
          className={cn(
            "text-sm font-medium leading-none block text-slate-700",
            hasError && "text-destructive"
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {effectiveStartAdornment && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
            {effectiveStartAdornment}
          </span>
        )}
        {multiline ? (
          <textarea
            id={inputId}
            className={inputClasses}
            {...(restProps as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            type={isPassword && showPassword ? 'text' : inputType}
            className={cn(inputClasses, "h-10")}
            {...(restProps as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 flex items-center gap-1.5 text-xs font-medium transition-colors z-10"
          >
            {showPassword ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span>Show</span>
              </>
            )}
          </button>
        )}
        {endAdornment && !isPassword && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
            {endAdornment}
          </span>
        )}
        {hasError && !isPassword && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive flex items-center pointer-events-none">
            <AlertCircle className="h-4 w-4" />
          </span>
        )}
      </div>
      {requirements && requirements.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>{req}</span>
            </div>
          ))}
        </div>
      )}
      {displayText && !requirements && (
        <p className={cn(
          "text-sm leading-relaxed",
          hasError ? "text-destructive" : "text-slate-600"
        )}>
          {displayText}
        </p>
      )}
    </div>
  )
}
