import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface MaterialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'contained' | 'outlined' | 'text'
  color?: 'primary' | 'secondary' | 'error' | 'neutral'
  size?: 'small' | 'medium' | 'large'
  startIcon?: ReactNode
  endIcon?: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

export default function MaterialButton({
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  startIcon,
  endIcon,
  fullWidth = false,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: MaterialButtonProps) {
  const baseClasses = cn(
    "inline-flex items-center justify-center font-medium",
    "transition-all duration-200 ease-in-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "active:scale-[0.98]"
  )
  
  const variantClasses = {
    contained: {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md",
      error: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md",
      neutral: "bg-muted text-muted-foreground hover:bg-muted/80 shadow-sm hover:shadow-md"
    },
    outlined: {
      primary: "border-2 border-primary text-primary bg-transparent hover:bg-primary/5 active:bg-primary/10",
      secondary: "border-2 border-secondary text-secondary bg-transparent hover:bg-secondary/5 active:bg-secondary/10",
      error: "border-2 border-destructive text-destructive bg-transparent hover:bg-destructive/5 active:bg-destructive/10",
      neutral: "border-2 border-border text-foreground bg-transparent hover:bg-muted/50 active:bg-muted"
    },
    text: {
      primary: "text-primary hover:bg-primary/10 active:bg-primary/15",
      secondary: "text-secondary hover:bg-secondary/10 active:bg-secondary/15",
      error: "text-destructive hover:bg-destructive/10 active:bg-destructive/15",
      neutral: "text-foreground hover:bg-muted/50 active:bg-muted"
    }
  }
  
  const sizeClasses = {
    small: "h-9 px-4 text-sm rounded-md gap-1.5",
    medium: "h-11 px-5 text-base rounded-lg gap-2",
    large: "h-12 px-6 text-lg rounded-lg gap-2.5"
  }
  
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        baseClasses,
        variantClasses[variant][color],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
          {children}
          {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
        </>
      )}
    </button>
  )
}
