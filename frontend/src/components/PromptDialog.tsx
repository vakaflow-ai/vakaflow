import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog'
import { MaterialButton, MaterialInput } from './material'

interface PromptDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (value: string) => void
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

export default function PromptDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  label = 'Value',
  placeholder = 'Enter value...',
  defaultValue = '',
  required = false,
  type = 'text',
  submitLabel = 'Submit',
  cancelLabel = 'Cancel'
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      setError('')
    }
  }, [isOpen, defaultValue])

  const handleSubmit = () => {
    if (required && !value.trim()) {
      setError('This field is required')
      return
    }
    onSubmit(value.trim())
    setValue('')
    setError('')
  }

  const handleClose = () => {
    setValue('')
    setError('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && (
            <DialogDescription className="pt-2">
              {message}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="px-6 py-4">
          <MaterialInput
            label={label}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError('')
            }}
            placeholder={placeholder}
            error={!!error}
            helperText={error || (required ? 'This field is required' : 'Optional')}
            multiline={type === 'textarea'}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && type !== 'textarea') {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
        </div>
        <DialogFooter>
          <MaterialButton
            variant="outlined"
            onClick={handleClose}
          >
            {cancelLabel}
          </MaterialButton>
          <MaterialButton
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={required && !value.trim()}
          >
            {submitLabel}
          </MaterialButton>
        </DialogFooter>
        <DialogClose onClose={handleClose} />
      </DialogContent>
    </Dialog>
  )
}
