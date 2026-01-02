import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface MaterialChipProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  color?: 'primary' | 'neutral' | 'error' | 'success' | 'warning' | 'default' | 'secondary' | 'gray'
  variant?: 'filled' | 'outlined'
  size?: 'small' | 'medium'
  onDelete?: () => void
  avatar?: ReactNode
  icon?: ReactNode
}

export default function MaterialChip({
  label,
  color = 'neutral',
  variant = 'filled',
  size = 'medium',
  onDelete,
  avatar,
  icon,
  className,
  ...props
}: MaterialChipProps) {
  const baseClasses = "inline-flex items-center gap-1.5 font-medium transition-all duration-200"
  
  const colorClasses = {
    filled: {
      primary: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15",
      neutral: "bg-muted text-muted-foreground border border-border hover:bg-muted/80",
      error: "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15",
      success: "bg-green-500/10 text-green-700 border border-green-500/20 hover:bg-green-500/15 dark:text-green-400",
      warning: "bg-yellow-500/10 text-yellow-700 border border-yellow-500/20 hover:bg-yellow-500/15 dark:text-yellow-400",
      default: "bg-muted text-muted-foreground border border-border hover:bg-muted/80",
      secondary: "bg-secondary/10 text-secondary-foreground border border-secondary/20 hover:bg-secondary/15",
      gray: "bg-gray-500/10 text-gray-700 border border-gray-500/20 hover:bg-gray-500/15 dark:text-gray-300"
    },
    outlined: {
      primary: "border-2 border-primary text-primary bg-transparent hover:bg-primary/5",
      neutral: "border-2 border-border text-foreground bg-transparent hover:bg-muted/30",
      error: "border-2 border-destructive text-destructive bg-transparent hover:bg-destructive/5",
      success: "border-2 border-green-500 text-green-700 bg-transparent hover:bg-green-500/5 dark:text-green-400",
      warning: "border-2 border-yellow-500 text-yellow-700 bg-transparent hover:bg-yellow-500/5 dark:text-yellow-400",
      default: "border-2 border-border text-foreground bg-transparent hover:bg-muted/30",
      secondary: "border-2 border-secondary text-secondary bg-transparent hover:bg-secondary/5",
      gray: "border-2 border-gray-500 text-gray-700 bg-transparent hover:bg-gray-500/5 dark:text-gray-300"
    }
  }
  
  const sizeClasses = {
    small: "h-7 px-2.5 text-xs rounded-full",
    medium: "h-8 px-3.5 text-sm rounded-full"
  }
  
  return (
    <div
      className={cn(
        baseClasses,
        colorClasses[variant][color || 'neutral'],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {avatar && <span className="flex-shrink-0 w-5 h-5 rounded-full overflow-hidden">{avatar}</span>}
      {icon && <span className="flex-shrink-0 w-4 h-4">{icon}</span>}
      <span className="whitespace-nowrap">{label}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Delete"
          className="ml-1 -mr-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
