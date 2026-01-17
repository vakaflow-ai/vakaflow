import { useState, useCallback } from 'react'
import ConfirmationDialog from '../components/ConfirmationDialog'
import AlertDialog from '../components/AlertDialog'
import PromptDialog from '../components/PromptDialog'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

interface AlertOptions {
  title?: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
  buttonLabel?: string
}

interface PromptOptions {
  title: string
  message?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  type?: 'text' | 'textarea'
  submitLabel?: string
  cancelLabel?: string
}

export function useDialog() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    variant: 'default' | 'destructive'
    resolve: ((value: boolean) => void) | null
  }>({
    isOpen: false,
    title: 'Confirm',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'default',
    resolve: null
  })

  const [alertState, setAlertState] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'info' | 'success' | 'warning' | 'error'
    buttonLabel: string
    resolve: (() => void) | null
  }>({
    isOpen: false,
    title: 'Alert',
    message: '',
    variant: 'info',
    buttonLabel: 'OK',
    resolve: null
  })

  const [promptState, setPromptState] = useState<{
    isOpen: boolean
    title: string
    message: string | undefined
    label: string
    placeholder: string
    defaultValue: string
    required: boolean
    type: 'text' | 'textarea'
    submitLabel: string
    cancelLabel: string
    resolve: ((value: string | null) => void) | null
  }>({
    isOpen: false,
    title: 'Prompt',
    message: undefined,
    label: 'Value',
    placeholder: 'Enter value...',
    defaultValue: '',
    required: false,
    type: 'text',
    submitLabel: 'Submit',
    cancelLabel: 'Cancel',
    resolve: null
  })

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' 
        ? { message: options }
        : options

      setConfirmState({
        isOpen: true,
        title: opts.title || 'Confirm',
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        variant: opts.variant || 'default',
        resolve
      })
    })
  }, [])

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string'
        ? { message: options }
        : options

      setAlertState({
        isOpen: true,
        title: opts.title || 'Alert',
        message: opts.message,
        variant: opts.variant || 'info',
        buttonLabel: opts.buttonLabel || 'OK',
        resolve
      })
    })
  }, [])

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        title: options.title,
        message: options.message,
        label: options.label || 'Value',
        placeholder: options.placeholder || 'Enter value...',
        defaultValue: options.defaultValue || '',
        required: options.required || false,
        type: options.type || 'text',
        submitLabel: options.submitLabel || 'Submit',
        cancelLabel: options.cancelLabel || 'Cancel',
        resolve
      })
    })
  }, [])

  const handleConfirmClose = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(false)
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [confirmState.resolve])

  const handleConfirmConfirm = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(true)
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [confirmState.resolve])

  const handleAlertClose = useCallback(() => {
    if (alertState.resolve) {
      alertState.resolve()
    }
    setAlertState(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [alertState.resolve])

  const handlePromptClose = useCallback(() => {
    if (promptState.resolve) {
      promptState.resolve(null)
    }
    setPromptState(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [promptState.resolve])

  const handlePromptSubmit = useCallback((value: string) => {
    if (promptState.resolve) {
      promptState.resolve(value)
    }
    setPromptState(prev => ({ ...prev, isOpen: false, resolve: null }))
  }, [promptState.resolve])

  return {
    confirm,
    alert,
    prompt,
    dialogs: (
      <>
        <ConfirmationDialog
          isOpen={confirmState.isOpen}
          onClose={handleConfirmClose}
          onConfirm={handleConfirmConfirm}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
        />
        <AlertDialog
          isOpen={alertState.isOpen}
          onClose={handleAlertClose}
          title={alertState.title}
          message={alertState.message}
          variant={alertState.variant}
          buttonLabel={alertState.buttonLabel}
        />
        <PromptDialog
          isOpen={promptState.isOpen}
          onClose={handlePromptClose}
          onSubmit={handlePromptSubmit}
          title={promptState.title}
          message={promptState.message}
          label={promptState.label}
          placeholder={promptState.placeholder}
          defaultValue={promptState.defaultValue}
          required={promptState.required}
          type={promptState.type}
          submitLabel={promptState.submitLabel}
          cancelLabel={promptState.cancelLabel}
        />
      </>
    )
  }
}
