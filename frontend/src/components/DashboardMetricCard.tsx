import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MaterialCard } from './material'

interface DashboardMetricCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  iconColor?: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'gray'
  subtitle?: string
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  onClick?: () => void
  className?: string
}

const iconColorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  red: 'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-orange-600',
  gray: 'bg-gray-50 text-gray-600',
}

const valueColorClasses = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  red: 'text-red-600',
  orange: 'text-orange-600',
  gray: 'text-gray-900',
}

export default function DashboardMetricCard({
  label,
  value,
  icon,
  iconColor = 'blue',
  subtitle,
  trend,
  onClick,
  className
}: DashboardMetricCardProps) {
  return (
    <MaterialCard
      elevation={1}
      hover={!!onClick}
      className={cn(
        "p-6 transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            {label}
          </h3>
          <div className="flex items-baseline gap-2">
            <p className={cn("text-3xl font-semibold tabular-nums", valueColorClasses[iconColor])}>
              {value}
            </p>
            {trend && (
              <span className={cn(
                "text-xs font-medium",
                trend.positive ? "text-green-600" : "text-red-600"
              )}>
                {trend.positive ? '+' : ''}{trend.value}% {trend.label}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-2">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
            iconColorClasses[iconColor]
          )}>
            {icon}
          </div>
        )}
      </div>
    </MaterialCard>
  )
}

