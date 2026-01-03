import { ReactNode, FormHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import MaterialButton from './MaterialButton'

interface MaterialFormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode
  title?: string
  description?: string
  submitLabel?: string
  submitVariant?: 'contained' | 'outlined' | 'text'
  submitColor?: 'primary' | 'neutral' | 'error'
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  disclaimer?: ReactNode
  className?: string
  loading?: boolean
}

export default function MaterialForm({
  children,
  title,
  description,
  submitLabel = 'Submit',
  submitVariant = 'contained',
  submitColor = 'primary',
  onSubmit,
  disclaimer,
  className,
  loading = false,
  ...props
}: MaterialFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("w-full", className)}
      {...props}
    >
      {(title || description) && (
        <div className="space-y-2 mb-6">
          {title && (
            <h2 className="text-2xl font-semibold text-slate-800">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-base text-slate-600 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      
      <div className="space-y-4 mb-5">
        {children}
      </div>

      <div className="space-y-4">
        <MaterialButton
          type="submit"
          variant={submitVariant}
          color={submitColor}
          fullWidth
          disabled={loading}
          size="medium"
        >
          {loading ? 'Processing...' : submitLabel}
        </MaterialButton>
        
        {disclaimer && (
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            {disclaimer}
          </p>
        )}
      </div>
    </form>
  )
}
