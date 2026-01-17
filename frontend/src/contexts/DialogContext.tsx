import React, { createContext, useContext, ReactNode } from 'react'
import { useDialog } from '../hooks/useDialog'

interface DialogContextType {
  confirm: (options: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: 'default' | 'destructive' } | string) => Promise<boolean>
  alert: (options: { title?: string; message: string; variant?: 'info' | 'success' | 'warning' | 'error'; buttonLabel?: string } | string) => Promise<void>
  prompt: (options: { title: string; message?: string; label?: string; placeholder?: string; defaultValue?: string; required?: boolean; type?: 'text' | 'textarea'; submitLabel?: string; cancelLabel?: string }) => Promise<string | null>
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

export function DialogProvider({ children }: { children: ReactNode }) {
  const dialog = useDialog()

  return (
    <DialogContext.Provider value={dialog}>
      {children}
      {dialog.dialogs}
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
