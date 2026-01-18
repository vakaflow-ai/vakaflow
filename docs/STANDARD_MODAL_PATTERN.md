# Standard Modal Pattern Implementation Guide

## Overview
This document demonstrates how to implement the standardized modal pattern across the application using the `StandardModal` component.

## Key Benefits
- **Consistent UI/UX**: All modals share the same design language
- **Reduced Code Duplication**: Eliminates repetitive modal boilerplate
- **Better Maintainability**: Single source of truth for modal styling and behavior
- **Improved Accessibility**: Consistent keyboard navigation and focus management

## StandardModal Component Features

### Props Interface
```typescript
interface StandardModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  isSaving?: boolean
  onSave?: () => void
  saveButtonText?: string
  cancelButtonText?: string
  disableSave?: boolean
}
```

### Key Features
- **Responsive sizing** with predefined width options
- **Automatic scrolling** for long content
- **Fixed header and footer** that stay in place
- **Backdrop click handling** to close modal
- **Loading states** with disabled buttons
- **Customizable footer** or default action buttons

## Migration Examples

### Before (Legacy Pattern)
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] flex flex-col my-auto mx-auto overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
      <div className="flex-1 min-w-0 pr-4">
        <h2 className="text-xl font-medium text-gray-900">Modal Title</h2>
        <p className="text-sm text-gray-500 mt-1">Subtitle</p>
      </div>
      <button onClick={onClose}>×</button>
    </div>
    <div className="flex-1 overflow-y-scroll overflow-x-hidden">
      <div className="p-6">
        {/* Content */}
      </div>
    </div>
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
      <button onClick={onClose}>Cancel</button>
      <button onClick={handleSave}>Save</button>
    </div>
  </div>
</div>
```

### After (StandardModal Pattern)
```tsx
import StandardModal from './StandardModal'

<StandardModal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  subtitle="Subtitle"
  isSaving={isSaving}
  onSave={handleSave}
>
  {/* Content */}
</StandardModal>
```

## Implementation Steps

### 1. Identify Target Modals
Look for modals with similar patterns:
- Fixed overlay with backdrop
- Card-style container with header/content/footer
- Close functionality (X button + backdrop click)
- Save/Cancel actions

### 2. Apply the Pattern
Replace the modal wrapper with StandardModal component:
```tsx
// Import the component
import StandardModal from './StandardModal'

// Replace the outer modal structure
<StandardModal
  isOpen={modalState.isOpen}
  onClose={handleClose}
  title="Configuration Settings"
  subtitle="Manage your application parameters"
  isSaving={isSubmitting}
  onSave={handleSubmit}
  size="lg" // Optional: sm, md, lg, xl, full
>
  {/* Your existing form content goes here */}
  <div className="space-y-4">
    <input type="text" placeholder="Setting name" />
    <textarea placeholder="Description" />
  </div>
</StandardModal>
```

## Recommended Targets for Migration

### High Priority (Similar Structure)
1. **EntityFieldEditModal.tsx** - Already has complex form structure, would benefit greatly
2. **BusinessFlowBuilder.tsx** - Large modal with multiple sections
3. **PlatformConfiguration create form** - In PlatformConfiguration.tsx

### Medium Priority (Simple Modals)
1. **CommentDialog.tsx** (if it exists)
2. **Confirmation dialogs** throughout the application
3. **Settings panels** in various components

## Best Practices

### 1. Preserve Existing Logic
- Keep all form state management unchanged
- Maintain existing validation logic
- Preserve API call implementations

### 2. Handle Complex Footers
For modals with custom footer requirements:
```tsx
<StandardModal
  isOpen={isOpen}
  onClose={onClose}
  title="Custom Actions"
  footer={
    <div className="flex items-center justify-between w-full">
      <button onClick={handleReset}>Reset</button>
      <div className="flex gap-2">
        <button onClick={onClose}>Cancel</button>
        <button onClick={handleSave}>Apply</button>
      </div>
    </div>
  }
>
  {/* Content */}
</StandardModal>
```

### 3. Size Selection Guidelines
- `sm`: Simple forms, confirmation dialogs
- `md`: Standard configuration panels (default)
- `lg`: Complex forms with multiple sections
- `xl`: Data-heavy modals with tables/lists
- `full`: Full-screen experiences

## Migration Checklist

- [ ] Create StandardModal component
- [ ] Identify candidate modals for migration
- [ ] Test each migrated modal individually
- [ ] Verify responsive behavior
- [ ] Check accessibility (keyboard nav, screen readers)
- [ ] Validate form submission flows
- [ ] Test error handling and loading states
- [ ] Update documentation/examples

## Success Metrics

After implementation, you should see:
- Reduced bundle size from eliminated duplicate code
- Consistent user experience across all modals
- Faster development time for new modal features
- Easier maintenance and bug fixes
- Improved code readability and organization