import React, { ReactNode } from 'react'

interface StandardModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  isSaving?: boolean
  onSave?: () => void
  saveButtonText?: string
  cancelButtonText?: string
  disableSave?: boolean
}

export default function StandardModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  isSaving = false,
  onSave,
  saveButtonText = 'Save Changes',
  cancelButtonText = 'Cancel',
  disableSave = false
}: StandardModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-3xl',
    lg: 'max-w-5xl',
    xl: 'max-w-7xl',
    full: 'max-w-full mx-4'
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} h-[90vh] flex flex-col my-auto mx-auto overflow-hidden`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-medium text-gray-900">{title}</h2>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0 bg-white">
          {footer || (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={isSaving}
              >
                {cancelButtonText}
              </button>
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={isSaving || disableSave}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : saveButtonText}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}