# UI Consistency Guide

## Standardized Components

### PageContainer
All pages should use the `PageContainer` component for consistent spacing and layout:

```tsx
import PageContainer, { PageHeader } from '../components/PageContainer'

<Layout user={user}>
  <PageContainer maxWidth="7xl" padding="md">
    <PageHeader 
      title="Page Title"
      subtitle="Page description"
      actions={<Button>Action</Button>}
    />
    {/* Page content */}
  </PageContainer>
</Layout>
```

### Standard Spacing
- **Container padding**: `px-4 sm:px-6 lg:px-8 py-6` (default via PageContainer)
- **Section spacing**: `space-y-6` (default)
- **Card gaps**: `gap-6`
- **Header margin**: `mb-6`

### Standard Max Widths
- **Full width pages**: `max-w-full` (e.g., Ecosystem Map fullscreen)
- **Standard pages**: `max-w-7xl` (default)
- **Form pages**: `max-w-5xl` (e.g., Agent Submission)
- **Narrow pages**: `max-w-4xl` (e.g., Settings)

### PageHeader Component
Standardized header with consistent typography:
- Title: `text-3xl font-bold text-gray-900 mb-2`
- Subtitle: `text-sm text-gray-500`
- Actions: Right-aligned button group

## Updated Pages
The following pages have been updated to use the standardized components:
- ✅ MyActions.tsx
- ✅ EcosystemMapV2.tsx
- ✅ AgentSubmission.tsx
- ✅ Marketplace.tsx
- ✅ Dashboard.tsx

## Remaining Pages to Update
Pages that still need standardization:
- Products.tsx
- Services.tsx
- IncidentReports.tsx
- WorkflowTemplates.tsx
- WorkflowAnalytics.tsx
- IncidentConfigs.tsx
- And others...
