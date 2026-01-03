import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Maximize2, Minimize2, X, Filter, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardWidgetProps {
  id: string
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultMinimized?: boolean
  defaultHidden?: boolean
  onMinimize?: (id: string, minimized: boolean) => void
  onMaximize?: (id: string, maximized: boolean) => void
  onRemove?: (id: string) => void
  onToggleFilter?: (id: string) => void
  className?: string
  actions?: ReactNode
  collapsible?: boolean
  removable?: boolean
  filterable?: boolean
  showFilter?: boolean
}

export default function DashboardWidget({
  id,
  title,
  icon,
  children,
  defaultMinimized = false,
  defaultHidden = false,
  onMinimize,
  onMaximize,
  onRemove,
  onToggleFilter,
  className,
  actions,
  collapsible = true,
  removable = false,
  filterable = false,
  showFilter = false
}: DashboardWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isHidden, setIsHidden] = useState(defaultHidden)

  const handleMinimize = () => {
    const newState = !isMinimized
    setIsMinimized(newState)
    if (onMinimize) {
      onMinimize(id, newState)
    }
  }

  const handleMaximize = () => {
    const newState = !isMaximized
    setIsMaximized(newState)
    if (onMaximize) {
      onMaximize(id, newState)
    }
  }

  const handleRemove = () => {
    if (onRemove) {
      onRemove(id)
    }
  }

  const handleToggleFilter = () => {
    if (onToggleFilter) {
      onToggleFilter(id)
    }
  }

  const handleToggleVisibility = () => {
    setIsHidden(!isHidden)
  }

  if (isHidden) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <h3 className="text-base font-semibold text-gray-600">{title}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleVisibility}
            className="h-8 w-8 p-0"
            title="Show widget"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-all duration-200",
        isMaximized && "fixed inset-4 z-50 shadow-2xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              {icon}
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          {actions}
          {filterable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFilter}
              className={cn(
                "h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                showFilter && "text-blue-600 bg-blue-50"
              )}
              title="Filter options"
            >
              <Filter className="w-4 h-4" />
            </Button>
          )}
          {collapsible && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMaximize}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMinimize}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleVisibility}
            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            title="Hide widget"
          >
            <EyeOff className="w-4 h-4" />
          </Button>
          {removable && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-8 w-8 p-0 text-gray-600 hover:text-red-600 hover:bg-red-50"
              title="Remove widget"
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
      {isMinimized && (
        <div className="px-6 py-3 text-sm text-gray-500 text-center border-t border-gray-100">
          Click maximize to expand
        </div>
      )}
    </div>
  )
}

