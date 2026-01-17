import React, { ReactNode } from 'react';
import { XIcon } from '../Icons';

interface MaterialDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export const MaterialDialog: React.FC<MaterialDialogProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-2xl',
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog Container */}
      <div className={`${maxWidth} w-full flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in duration-200`} style={{ maxHeight: 'calc(100vh - 40px)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between flex-none">
          <h2 className="text-xl font-semibold text-gray-900 truncate mr-4">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body - Forced to be scrollable if content overflows constrained parent */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 justify-end items-center flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
