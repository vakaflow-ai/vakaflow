import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  filters?: ReactNode
  className?: string
}

export default function DashboardHeader({
  title,
  subtitle,
  actions,
  filters,
  className
}: DashboardHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-base text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 ml-6">
            {actions}
          </div>
        )}
      </div>
      {filters && (
        <div className="flex items-center gap-4 flex-wrap">
          {filters}
        </div>
      )}
    </div>
  )
}

