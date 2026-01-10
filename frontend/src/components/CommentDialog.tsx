import React, { useState, useEffect } from 'react'
import { MaterialButton, MaterialInput, MaterialCard } from './material'
import { X } from 'lucide-react'

interface CommentDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (comment: string) => void
  title?: string
  label?: string
  placeholder?: string
  required?: boolean
  actionLabel?: string
  initialValue?: string
  onValueChange?: (value: string) => void
}

export default function CommentDialog({
  isOpen,
  onClose,
  onSubmit,
  title = 'Enter Comment',
  label = 'Comment',
  placeholder = 'Enter your comment...',
  required = false,
  actionLabel = 'Submit',
  initialValue = '',
  onValueChange
}: CommentDialogProps) {
  const [comment, setComment] = useState(initialValue)
  const [error, setError] = useState('')

  const handleCommentChange = (value: string) => {
    setComment(value)
    if (error) setError('')
    if (onValueChange) {
      onValueChange(value)
    }
  }

  const handleSubmit = () => {
    if (required && !comment.trim()) {
      setError('Comment is required')
      return
    }
    onSubmit(comment.trim())
    setComment('')
    setError('')
  }

  const handleClose = () => {
    setComment('')
    setError('')
    onClose()
  }

  useEffect(() => {
    if (isOpen) {
      setComment(initialValue || '')
      setError('')
    }
  }, [isOpen, initialValue])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!required || comment.trim()) {
          handleSubmit()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, comment, required, onClose, onSubmit])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <MaterialCard elevation={24} className="max-w-md w-full h-[90vh] border-none overflow-hidden flex flex-col my-auto mx-auto" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div className="p-6 border-b bg-surface-variant/10 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-medium text-gray-900">{title}</h2>
          <MaterialButton
            variant="text"
            size="small"
            onClick={handleClose}
            className="!p-2 text-gray-600 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </MaterialButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-scroll overflow-x-hidden bg-background" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="p-6 space-y-4">
          <div>
            <MaterialInput
              label={label}
              multiline={true}
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder={placeholder}
              error={!!error}
              helperText={error || (required ? 'This field is required' : 'Optional')}
              style={{ minHeight: '100px' }}
            />
          </div>
          </div>
        </div>

        {/* Actions - Fixed */}
        <div className="flex gap-3 justify-end p-6 border-t border-gray-200 flex-shrink-0 bg-white">
          <MaterialButton
            variant="outlined"
            onClick={handleClose}
          >
            Cancel
          </MaterialButton>
          <MaterialButton
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={required && !comment.trim()}
          >
            {actionLabel}
          </MaterialButton>
        </div>
      </MaterialCard>
    </div>
  )
}

