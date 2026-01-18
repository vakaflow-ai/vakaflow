import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './shared/Dialog'
import { Button } from './shared/Button'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

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
  const variantStyles = {
    success: { 
      icon: <CheckCircle className="w-5 h-5 text-green-600" />, 
      bg: 'bg-green-100' 
    },
    warning: { 
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, 
      bg: 'bg-amber-100' 
    },
    error: { 
      icon: <AlertCircle className="w-5 h-5 text-red-600" />, 
      bg: 'bg-red-100' 
    },
    info: { 
      icon: <Info className="w-5 h-5 text-blue-600" />, 
      bg: 'bg-blue-100' 
    }
  }

  const { icon, bg } = variantStyles[variant]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bg}`}>
              {icon}
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 whitespace-pre-line">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>
            {buttonLabel}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
