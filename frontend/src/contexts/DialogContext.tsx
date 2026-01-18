import React, { createContext, useContext, ReactNode, useState } from 'react'
import AlertDialog from '../components/AlertDialog'
import ConfirmationDialog from '../components/ConfirmationDialog'
import PromptDialog from '../components/PromptDialog'

interface DialogOptions {
  id: string
  dialogType: 'alert' | 'confirm' | 'prompt'
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error' | 'default' | 'destructive'
  confirmLabel?: string
  cancelLabel?: string
  buttonLabel?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  inputType?: 'text' | 'textarea'
  submitLabel?: string
  isLoading?: boolean
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

interface DialogContextType {
  confirm: (options: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: 'default' | 'destructive' } | string) => Promise<boolean>
  alert: (options: { title?: string; message: string; variant?: 'info' | 'success' | 'warning' | 'error'; buttonLabel?: string } | string) => Promise<void>
  prompt: (options: { title: string; message?: string; label?: string; placeholder?: string; defaultValue?: string; required?: boolean; type?: 'text' | 'textarea'; submitLabel?: string; cancelLabel?: string }) => Promise<string | null>
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogOptions[]>([])

  const addDialog = (dialog: Omit<DialogOptions, 'id' | 'resolve' | 'reject'>) => {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9)
      const newDialog: DialogOptions = {
        ...dialog,
        id,
        resolve,
        reject
      }
      setDialogs(prev => [...prev, newDialog])
    })
  }

  const removeDialog = (id: string) => {
    setDialogs(prev => prev.filter(d => d.id !== id))
  }

  const handleConfirm = (options: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: 'default' | 'destructive' } | string): Promise<boolean> => {
    const opts = typeof options === 'string' 
      ? { message: options, title: 'Confirm' } 
      : options
    
    return addDialog({
      dialogType: 'confirm',
      title: opts.title || 'Confirm',
      message: opts.message,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      variant: opts.variant || 'default'
    }).then(result => {
      return result as boolean
    })
  }

  const handleAlert = (options: { title?: string; message: string; variant?: 'info' | 'success' | 'warning' | 'error'; buttonLabel?: string } | string): Promise<void> => {
    const opts = typeof options === 'string' 
      ? { message: options, title: 'Alert' } 
      : options
    
    return addDialog({
      dialogType: 'alert',
      title: opts.title || 'Alert',
      message: opts.message,
      variant: opts.variant || 'info',
      buttonLabel: opts.buttonLabel
    }).then(() => undefined)
  }

  const handlePrompt = (options: { title: string; message?: string; label?: string; placeholder?: string; defaultValue?: string; required?: boolean; type?: 'text' | 'textarea'; submitLabel?: string; cancelLabel?: string }): Promise<string | null> => {
    return addDialog({
      dialogType: 'prompt',
      title: options.title,
      message: options.message || '',
      label: options.label,
      placeholder: options.placeholder,
      defaultValue: options.defaultValue,
      required: options.required,
      inputType: options.type,
      submitLabel: options.submitLabel,
      cancelLabel: options.cancelLabel
    }).then(result => {
      return result as string | null
    })
  }

  const contextValue: DialogContextType = {
    confirm: handleConfirm,
    alert: handleAlert,
    prompt: handlePrompt
  }

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {dialogs.map(dialog => {
        if (dialog.dialogType === 'alert') {
          return (
            <AlertDialog
              key={dialog.id}
              isOpen={true}
              onClose={() => {
                dialog.resolve(undefined)
                removeDialog(dialog.id)
              }}
              title={dialog.title}
              message={dialog.message}
              variant={dialog.variant as 'info' | 'success' | 'warning' | 'error'}
              buttonLabel={dialog.buttonLabel}
            />
          )
        }
        
        if (dialog.dialogType === 'confirm') {
          return (
            <ConfirmationDialog
              key={dialog.id}
              isOpen={true}
              onClose={() => {
                dialog.resolve(false)
                removeDialog(dialog.id)
              }}
              onConfirm={() => {
                dialog.resolve(true)
                removeDialog(dialog.id)
              }}
              title={dialog.title}
              message={dialog.message}
              confirmLabel={dialog.confirmLabel}
              cancelLabel={dialog.cancelLabel}
              variant={dialog.variant as 'default' | 'destructive'}
              isLoading={dialog.isLoading}
            />
          )
        }
        
        if (dialog.dialogType === 'prompt') {
          return (
            <PromptDialog
              key={dialog.id}
              isOpen={true}
              onClose={() => {
                dialog.resolve(null)
                removeDialog(dialog.id)
              }}
              onSubmit={(value: string) => {
                dialog.resolve(value)
                removeDialog(dialog.id)
              }}
              title={dialog.title}
              message={dialog.message}
              label={dialog.label}
              placeholder={dialog.placeholder}
              defaultValue={dialog.defaultValue}
              required={dialog.required}
              type={dialog.inputType}
              submitLabel={dialog.submitLabel}
              cancelLabel={dialog.cancelLabel}
            />
          )
        }
        
        return null
      })}
    </DialogContext.Provider>
  )
}

export function useDialogContext() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialogContext must be used within DialogProvider')
  }
  return context
}
