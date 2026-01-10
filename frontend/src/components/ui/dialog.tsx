import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

export interface DialogHeaderProps {
  children: React.ReactNode
  className?: string
}

export interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

export interface DialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

export interface DialogFooterProps {
  children: React.ReactNode
  className?: string
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-50 w-full max-w-2xl max-h-[90vh] my-auto"
      >
        {children}
      </div>
    </div>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-lg shadow-2xl border border-gray-200",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        "flex flex-col max-h-[90vh] overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
DialogContent.displayName = "DialogContent"

const DialogHeader = ({ className, children, ...props }: DialogHeaderProps) => (
  <div
    className={cn("px-6 pt-6 pb-4", className)}
    {...props}
  >
    {children}
  </div>
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold text-gray-900", className)}
      {...props}
    >
      {children}
    </h2>
  )
)
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-gray-500 mt-1", className)}
      {...props}
    >
      {children}
    </p>
  )
)
DialogDescription.displayName = "DialogDescription"

const DialogFooter = ({ className, children, ...props }: DialogFooterProps) => (
  <div
    className={cn("px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2", className)}
    {...props}
  >
    {children}
  </div>
)
DialogFooter.displayName = "DialogFooter"

const DialogClose = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
  >
    <X className="h-4 w-4 text-gray-500" />
    <span className="sr-only">Close</span>
  </button>
)

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
}
