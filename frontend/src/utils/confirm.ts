// Confirmation utility that uses application dialogs
// This will use the DialogContext if available, otherwise fall back to browser confirm
// Note: For best results, use useDialogContext hook directly in components
export const confirmAction = async (message: string): Promise<boolean> => {
  // Try to use application dialog if DialogContext is available
  // Otherwise fall back to browser confirm (for backwards compatibility)
  if (typeof window !== 'undefined' && (window as any).__dialogContext) {
    const dialog = (window as any).__dialogContext
    return await dialog.confirm(message)
  }
  
  // Fallback to browser confirm
  return window.confirm(message)
}








