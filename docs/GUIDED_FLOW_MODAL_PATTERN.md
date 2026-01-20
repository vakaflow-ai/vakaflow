# Guided Flow Modal Pattern - Workspace Rule

## Overview
This document establishes the standard pattern for implementing guided flow modals (multi-step wizards) in the VAKA platform. This pattern should be used whenever creating multi-step configuration workflows.

## Core Principle
**Always use `StandardModal` component for guided flows instead of custom modal implementations.** The StandardModal component has been battle-tested and handles all complex layout, scrolling, and overflow issues automatically.

## When to Use This Pattern
- Multi-step wizards (2+ steps)
- Configuration workflows
- Guided setup processes
- Any modal with progressive disclosure

## Implementation Pattern

### Basic Structure
```tsx
import StandardModal from '../components/StandardModal'
import { useState } from 'react'

export default function GuidedFlowComponent({ onClose, initialData }: Props) {
  const [step, setStep] = useState(1)
  
  const nextStep = () => setStep(prev => prev + 1)
  const prevStep = () => setStep(prev => prev - 1)
  
  const renderStepContent = () => {
    switch(step) {
      case 1: return <Step1Content />
      case 2: return <Step2Content />
      // ... more steps
      default: return null
    }
  }
  
  return (
    <StandardModal
      isOpen={true}
      onClose={onClose}
      title="Workflow Title"
      subtitle="Brief description of what this does"
      size="xl" // or lg for simpler flows
      isSaving={isSubmitting}
      onSave={step === totalSteps ? handleSubmit : undefined}
      saveButtonText={step === totalSteps ? "Complete Setup" : undefined}
      disableSave={!isStepValid(step) || step < totalSteps}
      footer={
        <div className="flex items-center justify-between w-full">
          <MaterialButton
            variant="outlined"
            onClick={prevStep}
            disabled={step === 1}
          >
            Previous
          </MaterialButton>
          
          {step < totalSteps ? (
            <MaterialButton
              variant="contained"
              onClick={nextStep}
              disabled={!isStepValid(step)}
            >
              Next
            </MaterialButton>
          ) : (
            <MaterialButton
              variant="contained"
              onClick={handleSubmit}
              disabled={!isStepValid(step) || isSubmitting}
            >
              Complete Setup
            </MaterialButton>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          {renderStepIndicator()}
        </div>
        
        {/* Current step content */}
        {renderStepContent()}
      </div>
    </StandardModal>
  )
}
```

## Key Components

### 1. Progress Indicator
```tsx
const renderStepIndicator = () => (
  <div className="flex items-center justify-center">
    {[1, 2, 3, 4].map((num) => (
      <div key={num} className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          step >= num 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-500'
        }`}>
          {step > num ? <CheckCircle className="w-4 h-4" /> : num}
        </div>
        {num < totalSteps && (
          <div className={`w-16 h-1 mx-2 ${
            step > num ? 'bg-blue-600' : 'bg-gray-200'
          }`} />
        )}
      </div>
    ))}
  </div>
)
```

### 2. Step Validation
```tsx
const isStepValid = (currentStep: number) => {
  switch(currentStep) {
    case 1:
      return formData.name.trim() && formData.entityId
    case 2:
      return true // or specific validation
    case 3:
      return formData.workflowId || formData.createNewWorkflow
    default:
      return true
  }
}
```

## Benefits of This Pattern

1. **No Overflow Issues** - StandardModal handles all scrolling and layout automatically
2. **Consistent UX** - Same behavior as other modals in the application
3. **Responsive Design** - Works on all screen sizes
4. **Accessibility** - Proper keyboard navigation and focus management
5. **Maintainability** - Less custom CSS, easier to modify
6. **Performance** - Proven, optimized component

## Anti-Patterns to Avoid

❌ **Don't use custom flex layouts for modals:**
```tsx
// BAD - Causes overflow issues
<div className="fixed inset-0 flex items-center justify-center">
  <div className="flex flex-col max-h-[90vh]">
    {/* Custom scrolling logic that breaks */}
  </div>
</div>
```

❌ **Don't calculate heights manually:**
```tsx
// BAD - Brittle and error-prone
<div style={{ maxHeight: 'calc(90vh - 250px)' }}>
  {/* Magic numbers that break easily */}
</div>
```

✅ **Do use StandardModal:**
```tsx
// GOOD - Handles everything automatically
<StandardModal size="xl">
  {/* Content flows naturally */}
</StandardModal>
```

## Real-World Example
See `/frontend/src/components/GuidedRequestTypeCreator.tsx` for a complete working implementation of this pattern.

## Migration Checklist
When converting existing custom modals:

- [ ] Replace custom modal wrapper with `<StandardModal>`
- [ ] Move header content to `title` and `subtitle` props
- [ ] Move footer buttons to `footer` prop
- [ ] Keep step logic and content rendering unchanged
- [ ] Test all steps and navigation
- [ ] Verify responsive behavior
- [ ] Check accessibility

## Troubleshooting

**Issue**: Buttons disappear on long forms
**Solution**: Use StandardModal - it handles scrolling automatically

**Issue**: Content overlaps footer
**Solution**: Use StandardModal's built-in scrolling container

**Issue**: Modal doesn't resize properly
**Solution**: Use appropriate `size` prop (sm, md, lg, xl, full)

This pattern has been tested and proven to work reliably across the platform.