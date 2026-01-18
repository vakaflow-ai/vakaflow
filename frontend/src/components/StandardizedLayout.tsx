import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Edit, Search, Filter } from 'lucide-react'
import { cn } from '../lib/utils'

// Enhanced PageContainer with better defaults and consistency
interface StandardPageContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  spacing?: 'none' | 'sm' | 'md' | 'lg'
  showDivider?: boolean
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

const containerSpacingClasses = {
  none: '',
  sm: 'space-y-4',
  md: 'space-y-6',
  lg: 'space-y-8'
}

export function StandardPageContainer({ 
  children, 
  className,
  maxWidth = '7xl',
  padding = 'md',
  spacing = 'md',
  showDivider = false
}: StandardPageContainerProps) {
  return (
    <div className={cn(
      maxWidthClasses[maxWidth],
      'mx-auto',
      paddingClasses[padding],
      containerSpacingClasses[spacing],
      className
    )}>
      {showDivider && <hr className="border-gray-200 mb-6" />}
      {children}
    </div>
  )
}

// Enhanced Page Header with standardized actions
interface StandardPageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  backButton?: boolean
  backUrl?: string
  showDivider?: boolean
}

export function StandardPageHeader({ 
  title, 
  subtitle, 
  actions, 
  className, 
  backButton = false, 
  backUrl,
  showDivider = true
}: StandardPageHeaderProps) {
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
      {showDivider && <hr className="border-gray-200 mt-4" />}
    </div>
  )
}

// Standard Action Buttons
interface StandardActionButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function StandardActionButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  onClick,
  disabled = false,
  className
}: StandardActionButtonProps) {
  const baseClasses = "inline-flex items-center justify-center rounded-lg font-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400"
  }

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  }

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  )
}

// Standard Card Component
interface StandardCardProps {
  children: React.ReactNode
  className?: string
  title?: string
  actions?: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const cardPaddingClasses = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
}

export function StandardCard({ 
  children, 
  className, 
  title, 
  actions,
  padding = 'md'
}: StandardCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-lg border border-gray-200 shadow-sm",
      className
    )}>
      {(title || actions) && (
        <div className={cn(
          "border-b border-gray-200 flex items-center justify-between",
          cardPaddingClasses[padding]
        )}>
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(
        title || actions ? '' : cardPaddingClasses[padding],
        !title && !actions ? cardPaddingClasses[padding] : 'p-0'
      )}>
        {children}
      </div>
    </div>
  )
}

// Standard Table Component
interface StandardTableProps {
  headers: { key: string; label: string; className?: string }[]
  data: any[]
  renderRow: (item: any, index: number) => React.ReactNode
  className?: string
  emptyMessage?: string
}

export function StandardTable({ 
  headers, 
  data, 
  renderRow, 
  className,
  emptyMessage = "No data available"
}: StandardTableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {headers.map((header) => (
              <th 
                key={header.key}
                className={cn(
                  "h-12 px-6 text-left align-middle font-semibold text-sm text-gray-700",
                  header.className
                )}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={headers.length} 
                className="h-32 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => renderRow(item, index))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Standard Search and Filter Bar
interface StandardSearchFilterProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
  className?: string
}

export function StandardSearchFilter({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  className
}: StandardSearchFilterProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-4", className)}>
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      {filters && (
        <div className="flex gap-2 flex-wrap">
          {filters}
        </div>
      )}
    </div>
  )
}

// Standard Delete Handler Hook
export function useStandardDelete() {
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  const handleDelete = async (
    deleteFunction: () => Promise<void>,
    itemName: string,
    itemType: string = "item"
  ) => {
    if (!window.confirm(`Are you sure you want to delete this ${itemType}?`)) {
      return false
    }
    
    setIsDeleting(true)
    try {
      await deleteFunction()
      return true
    } catch (error) {
      console.error('Delete failed:', error)
      alert(`Failed to delete ${itemName}`)
      return false
    } finally {
      setIsDeleting(false)
    }
  }
  
  return { handleDelete, isDeleting }
}

// Export everything as a single module
export {
  StandardPageContainer as PageContainer,
  StandardPageHeader as PageHeader,
  StandardActionButton as ActionButton,
  StandardCard as Card,
  StandardTable as Table,
  StandardSearchFilter as SearchFilter,
  useStandardDelete as useDelete
}