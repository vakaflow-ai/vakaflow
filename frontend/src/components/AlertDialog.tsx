import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { MaterialButton } from './material'

interface AlertDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
  buttonLabel?: string
}

export default function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  buttonLabel = 'OK'
}: AlertDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Info className="w-5 h-5 text-blue-600" />
    }
  }

  const getIconBg = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-100'
      case 'warning':
        return 'bg-amber-100'
      case 'error':
        return 'bg-red-100'
      default:
        return 'bg-blue-100'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getIconBg()}`}>
              {getIcon()}
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 whitespace-pre-line">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <MaterialButton
            variant="contained"
            color="primary"
            onClick={onClose}
          >
            {buttonLabel}
          </MaterialButton>
        </DialogFooter>
        <DialogClose onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}
