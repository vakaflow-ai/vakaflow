import { ReactNode } from 'react'
import { MaterialButton } from './material'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backButton?: boolean
  backUrl?: string
  actions?: ReactNode
  icon?: ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  backButton = false,
  backUrl,
  actions,
  icon
}: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-8">
      {backButton && (
        <button
          onClick={() => backUrl ? navigate(backUrl) : navigate(-1)}
          className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}
      
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

