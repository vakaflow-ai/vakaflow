import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MaterialCard } from './material'
import { LucideIcon } from 'lucide-react'

interface DashboardSectionProps {
  title: string
  icon?: LucideIcon
  children: ReactNode
  actions?: ReactNode
  className?: string
  emptyMessage?: string
  isEmpty?: boolean
}

export default function DashboardSection({
  title,
  icon: Icon,
  children,
  actions,
  className,
  emptyMessage = "No data available",
  isEmpty = false
}: DashboardSectionProps) {
  return (
    <MaterialCard elevation={1} className={cn("p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {title}
          </h2>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {isEmpty ? (
        <div className="text-center py-12 text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </MaterialCard>
  )
}

