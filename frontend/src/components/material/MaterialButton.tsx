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
  const baseClasses = "inline-flex items-center justify-center font-normal rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"

  const variantClasses = {
    contained: {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      neutral: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
      error: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
      secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500",
    },
    outlined: {
      primary: "border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500",
      neutral: "border border-gray-600 text-gray-600 hover:bg-gray-50 focus:ring-gray-500",
      error: "border border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500",
      secondary: "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500",
    },
    text: {
      primary: "text-blue-600 hover:bg-blue-50 focus:ring-blue-500",
      neutral: "text-gray-600 hover:bg-gray-50 focus:ring-gray-500",
      error: "text-red-600 hover:bg-red-50 focus:ring-red-500",
      secondary: "text-gray-600 hover:bg-gray-50 focus:ring-blue-500",
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
