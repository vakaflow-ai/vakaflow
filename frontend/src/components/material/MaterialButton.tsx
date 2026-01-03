import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MaterialButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'contained' | 'outlined' | 'text'
  color?: 'primary' | 'neutral' | 'error' | 'secondary'
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  startIcon?: ReactNode
  endIcon?: ReactNode
  children: ReactNode
}

export default function MaterialButton({
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  fullWidth = false,
  startIcon,
  endIcon,
  className,
  children,
  disabled,
  ...props
}: MaterialButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"

  const variantClasses = {
    contained: {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow-md",
      neutral: "bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-500 shadow-sm hover:shadow-md",
      error: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm hover:shadow-md",
      secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400 shadow-sm hover:shadow-md",
    },
    outlined: {
      primary: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500",
      neutral: "border-2 border-slate-600 text-slate-600 hover:bg-slate-50 focus:ring-slate-500",
      error: "border-2 border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500",
      secondary: "border-2 border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400",
    },
    text: {
      primary: "text-blue-600 hover:bg-blue-50 focus:ring-blue-500",
      neutral: "text-slate-600 hover:bg-slate-50 focus:ring-slate-500",
      error: "text-red-600 hover:bg-red-50 focus:ring-red-500",
      secondary: "text-slate-600 hover:bg-slate-50 focus:ring-slate-400",
    },
  }

  const sizeClasses = {
    small: "h-8 px-3 text-sm",
    medium: "h-10 px-4 text-sm",
    large: "h-12 px-6 text-base",
  }

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant][color],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {startIcon && (
        <span className={cn("flex-shrink-0", size === 'small' ? "mr-2" : "mr-2.5")}>
          {startIcon}
        </span>
      )}
      <span>{children}</span>
      {endIcon && (
        <span className={cn("flex-shrink-0", size === 'small' ? "ml-2" : "ml-2.5")}>
          {endIcon}
        </span>
      )}
    </button>
  )
}
