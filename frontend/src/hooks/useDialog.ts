import { useState, useCallback } from 'react';

interface UseDialogReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDialog: () => void;
  closeDialog: () => void;
  toggleDialog: () => void;
}

export function useDialog(initialOpen = false): UseDialogReturn {
  const [open, setOpen] = useState(initialOpen);

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);
  const toggleDialog = useCallback(() => setOpen(prev => !prev), []);

  return {
    open,
    setOpen,
    openDialog,
    closeDialog,
    toggleDialog,
  };
}