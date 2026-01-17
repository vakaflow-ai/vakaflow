import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  spacing?: 'none' | 'sm' | 'md' | 'lg'
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full'
}

const paddingClasses = {
  none: '',
  sm: 'px-4 py-4',
  md: 'px-4 sm:px-6 lg:px-8 py-6',
  lg: 'px-6 sm:px-8 lg:px-10 py-8'
}

export default function PageContainer({ 
  children, 
  className,
  maxWidth = '7xl',
  padding = 'md',
  spacing = 'md'
}: PageContainerProps) {
  return (
    <div className={cn(
      maxWidthClasses[maxWidth],
      'mx-auto',
      paddingClasses[padding],
      containerSpacingClasses[spacing],
      className
    )}>
      {children}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  backButton?: boolean
  backUrl?: string
}

export function PageHeader({ title, subtitle, actions, className, backButton = false, backUrl }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className={cn('mb-6', className)}>
      {backButton && (
        <button
          onClick={() => backUrl ? navigate(backUrl) : navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

interface PageSectionProps {
  children: React.ReactNode
  title?: string
  className?: string
  spacing?: 'none' | 'sm' | 'md' | 'lg'
}

const spacingClasses = {
  none: '',
  sm: 'space-y-4',
  md: 'space-y-6',
  lg: 'space-y-8'
}

const containerSpacingClasses = {
  none: '',
  sm: 'space-y-4',
  md: 'space-y-6',
  lg: 'space-y-10'
}

export function PageSection({ children, title, className, spacing = 'md' }: PageSectionProps) {
  return (
    <div className={cn(spacingClasses[spacing], className)}>
      {title && (
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
      )}
      {children}
    </div>
  )
}
