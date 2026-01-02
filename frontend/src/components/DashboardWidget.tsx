import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MaterialCard } from './material'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardWidgetProps {
  id: string
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultMinimized?: boolean
  onMinimize?: (id: string) => void
  onMaximize?: (id: string) => void
  onRemove?: (id: string) => void
  className?: string
  actions?: ReactNode
  collapsible?: boolean
  removable?: boolean
}

export default function DashboardWidget({
  id,
  title,
  icon,
  children,
  defaultMinimized = false,
  onMinimize,
  onMaximize,
  onRemove,
  className,
  actions,
  collapsible = true,
  removable = false
}: DashboardWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized)
  const [isMaximized, setIsMaximized] = useState(false)

  const handleMinimize = () => {
    const newState = !isMinimized
    setIsMinimized(newState)
    if (newState && onMinimize) {
      onMinimize(id)
    } else if (!newState && onMaximize) {
      onMaximize(id)
    }
  }

  const handleRemove = () => {
    if (onRemove) {
      onRemove(id)
    }
  }

  return (
    <MaterialCard
      elevation={1}
      className={cn(
        "relative transition-all duration-200",
        isMaximized && "fixed inset-4 z-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border widget-drag-handle">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <h3 className="text-base font-semibold text-foreground truncate">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {actions}
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMinimize}
              className="h-8 w-8 p-0"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </Button>
          )}
          {removable && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-6">
          {children}
        </div>
      )}
    </MaterialCard>
  )
}

