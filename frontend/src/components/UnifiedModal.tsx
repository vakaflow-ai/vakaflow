import React, { useState, createContext, useContext, ReactNode } from 'react'
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

// Modal Context for global modal management
interface ModalContextType {
  showModal: (modal: ModalConfig) => void
  hideModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

interface ModalProviderProps {
  children: ReactNode
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null)

  const showModal = (config: ModalConfig) => {
    setModalConfig(config)
  }

  const hideModal = () => {
    setModalConfig(null)
  }

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      {modalConfig && <UnifiedModal config={modalConfig} onClose={hideModal} />}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return context
}

// Modal Configuration Types
interface BaseModalConfig {
  title: string
  onClose?: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  preventClose?: boolean
}

interface ConfirmModalConfig extends BaseModalConfig {
  type: 'confirm'
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  confirmVariant?: 'primary' | 'danger'
}

interface AlertModalConfig extends BaseModalConfig {
  type: 'alert'
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
  buttonText?: string
}

interface FormModalConfig extends BaseModalConfig {
  type: 'form'
  children: ReactNode
  onSubmit?: () => void | Promise<void>
  submitText?: string
  cancelText?: string
}

interface CustomModalConfig extends BaseModalConfig {
  type: 'custom'
  children: ReactNode
  onSubmit?: () => void | Promise<void>
}

type ModalConfig = ConfirmModalConfig | AlertModalConfig | FormModalConfig | CustomModalConfig

// Size Classes
const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4'
}

// Variant Icons and Styles
const variantStyles = {
  info: { icon: <Info className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100' },
  success: { icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: 'bg-green-100' },
  warning: { icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-100' },
  error: { icon: <AlertCircle className="w-5 h-5 text-red-600" />, bg: 'bg-red-100' }
}

// Main Modal Component
interface UnifiedModalProps {
  config: ModalConfig
  onClose: () => void
}

function UnifiedModal({ config, onClose }: UnifiedModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    if (!config.preventClose) {
      onClose()
      config.onClose?.()
    }
  }

  const handleSubmit = async () => {
    if (config.type === 'form' || config.type === 'confirm') {
      setIsSubmitting(true)
      try {
        if (config.type === 'confirm' && config.onConfirm) {
          await config.onConfirm()
        } else if (config.type === 'form' && config.onSubmit) {
          await config.onSubmit()
        }
        handleClose()
      } catch (error) {
        console.error('Modal action failed:', error)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  // Handle Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !config.preventClose) {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [config.preventClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal Container */}
      <div className={cn(
        "relative z-50 w-full bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200",
        sizeClasses[config.size || 'md']
      )}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{config.title}</h2>
          {!config.preventClose && (
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {config.type === 'confirm' && (
            <ConfirmModalContent 
              message={config.message}
              variant={config.confirmVariant}
            />
          )}

          {config.type === 'alert' && (
            <AlertModalContent 
              message={config.message}
              variant={config.variant}
            />
          )}

          {(config.type === 'form' || config.type === 'custom') && (
            <div className="max-h-[70vh] overflow-y-auto">
              {config.children}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          {config.type === 'confirm' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                {config.cancelText || 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
                  config.confirmVariant === 'danger' 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isSubmitting ? 'Processing...' : (config.confirmText || 'Confirm')}
              </button>
            </>
          )}

          {config.type === 'alert' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {config.buttonText || 'OK'}
            </button>
          )}

          {config.type === 'form' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                {config.cancelText || 'Cancel'}
              </button>
              {config.onSubmit && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : (config.submitText || 'Save')}
                </button>
              )}
            </>
          )}

          {config.type === 'custom' && 'onSubmit' in config && config.onSubmit && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Specific Modal Content Components
function ConfirmModalContent({ message, variant = 'primary' }: { 
  message: string; 
  variant?: 'primary' | 'danger' 
}) {
  return (
    <div className="flex items-start gap-3">
      {variant === 'danger' && (
        <div className="p-2 bg-red-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
      )}
      <div className="flex-1">
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  )
}

function AlertModalContent({ message, variant = 'info' }: { 
  message: string; 
  variant?: 'info' | 'success' | 'warning' | 'error' 
}) {
  const { icon, bg } = variantStyles[variant]
  
  return (
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${bg}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  )
}

// Hook for easy modal usage
export function useStandardModals() {
  const { showModal, hideModal } = useModal()

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      confirmText?: string
      cancelText?: string
      confirmVariant?: 'primary' | 'danger'
      preventClose?: boolean
    }
  ) => {
    showModal({
      type: 'confirm',
      title,
      message,
      onConfirm,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      confirmVariant: options?.confirmVariant,
      preventClose: options?.preventClose
    })
  }

  const showAlert = (
    title: string,
    message: string,
    options?: {
      variant?: 'info' | 'success' | 'warning' | 'error'
      buttonText?: string
    }
  ) => {
    showModal({
      type: 'alert',
      title,
      message,
      variant: options?.variant,
      buttonText: options?.buttonText
    })
  }

  const showForm = (
    title: string,
    children: ReactNode,
    options?: {
      onSubmit?: () => void | Promise<void>
      submitText?: string
      cancelText?: string
      size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
      preventClose?: boolean
    }
  ) => {
    showModal({
      type: 'form',
      title,
      children,
      onSubmit: options?.onSubmit,
      submitText: options?.submitText,
      cancelText: options?.cancelText,
      size: options?.size,
      preventClose: options?.preventClose
    })
  }

  const showCustom = (
    title: string,
    children: ReactNode,
    options?: {
      onSubmit?: () => void | Promise<void>
      size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
      preventClose?: boolean
    }
  ) => {
    showModal({
      type: 'custom',
      title,
      children,
      onSubmit: options?.onSubmit,
      size: options?.size,
      preventClose: options?.preventClose
    })
  }

  return {
    showConfirm,
    showAlert,
    showForm,
    showCustom,
    hideModal
  }
}