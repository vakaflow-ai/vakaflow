# Platform Standardization Migration Guide

## Overview
This guide provides step-by-step instructions for migrating existing pages to use the new standardized components and CSS system.

## Migration Steps

### 1. Update Root Files
First, ensure the unified styles are imported in your main CSS file:

**File: `/frontend/src/index.css`**
```css
/* Add this at the top */
@import "./styles/unified.css";
```

### 2. Wrap Your App with Modal Provider
**File: `/frontend/src/App.tsx` or main entry point**
```tsx
import { ModalProvider } from './components/UnifiedModal'

function App() {
  return (
    <ModalProvider>
      {/* Your existing app content */}
    </ModalProvider>
  )
}
```

### 3. Page Migration Template

#### Before (Legacy Pattern):
```tsx
export default function OldPage() {
  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Title</h1>
            <p className="text-sm text-gray-500">Description</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-200 rounded-lg">Action</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">Primary</button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex gap-4 mb-4">
            <input 
              type="text" 
              placeholder="Search..." 
              className="px-4 py-2 border rounded-lg"
            />
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Item Name</td>
                <td>
                  <button className="text-red-600">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
```

#### After (Standardized Pattern):
```tsx
import { 
  StandardPageContainer,
  StandardPageHeader,
  StandardActionButton,
  StandardCard,
  StandardTable,
  StandardSearchFilter
} from '../components/StandardizedLayout'

export default function NewPage() {
  return (
    <Layout user={user}>
      <StandardPageContainer>
        <StandardPageHeader
          title="Page Title"
          subtitle="Description"
          actions={
            <>
              <StandardActionButton variant="outline">
                Action
              </StandardActionButton>
              <StandardActionButton>
                Primary
              </StandardActionButton>
            </>
          }
        />
        
        <StandardCard>
          <StandardSearchFilter
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search items..."
          />
        </StandardCard>
        
        <StandardCard>
          <StandardTable
            headers={[
              { key: 'name', label: 'Name' },
              { key: 'actions', label: 'Actions', className: 'text-right' }
            ]}
            data={items}
            renderRow={(item) => (
              <tr key={item.id} className="unified-table-row">
                <td className="unified-table-cell-primary">{item.name}</td>
                <td className="unified-table-cell">
                  <StandardActionButton 
                    variant="danger" 
                    size="sm"
                    onClick={() => handleDelete(item.id, item.name)}
                  >
                    Delete
                  </StandardActionButton>
                </td>
              </tr>
            )}
          />
        </StandardCard>
      </StandardPageContainer>
    </Layout>
  )
}
```

## CSS Class Migration Reference

| Legacy Class | Unified Class |
|--------------|---------------|
| `text-3xl font-bold text-gray-900 mb-2` | `unified-page-title` |
| `text-sm text-gray-500` | `unified-page-subtitle` |
| `px-4 py-2 bg-blue-600 text-white rounded-lg` | `unified-btn unified-btn-primary` |
| `px-4 py-2 bg-gray-200 rounded-lg` | `unified-btn unified-btn-secondary` |
| `px-4 py-2 border rounded-lg` | `unified-input` |
| `bg-white rounded-lg border p-6` | `unified-card` |
| `w-full border-b` | Use `StandardTable` component |

## Delete Functionality Implementation

### Before:
```tsx
const handleDelete = (id) => {
  if (window.confirm('Are you sure?')) {
    deleteItem(id)
  }
}
```

### After:
```tsx
const handleDelete = async (itemId, itemName) => {
  if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
    return
  }
  
  try {
    await deleteApi(itemId)
    showToast.success(`${itemName} deleted successfully`)
  } catch (error) {
    showToast.error(`Failed to delete ${itemName}`)
  }
}
```

## Modal Migration

### Before (Multiple Modal Systems):
```tsx
// Various custom modal implementations scattered throughout
```

### After (Unified System):
```tsx
import { useStandardModals } from '../components/UnifiedModal'

const { showConfirm, showForm, showAlert } = useStandardModals()

// Confirmation modal
showConfirm(
  'Delete Item',
  'Are you sure you want to delete this item?',
  () => performDelete(),
  { confirmVariant: 'danger' }
)

// Form modal
showForm(
  'Edit Item',
  <YourFormComponent />,
  { onSubmit: handleSubmit }
)
```

## Quick Migration Checklist

- [ ] Add unified CSS import to `index.css`
- [ ] Wrap app with `ModalProvider`
- [ ] Replace page containers with `StandardPageContainer`
- [ ] Replace headers with `StandardPageHeader`
- [ ] Replace buttons with `StandardActionButton`
- [ ] Replace cards with `StandardCard`
- [ ] Replace tables with `StandardTable`
- [ ] Replace search/filter sections with `StandardSearchFilter`
- [ ] Implement standardized delete patterns
- [ ] Migrate modals to unified system
- [ ] Replace custom CSS classes with unified classes

## Benefits of Migration

1. **Consistency**: All pages follow the same design patterns
2. **Maintainability**: Single source of truth for components and styles
3. **Developer Experience**: Reduced cognitive load with standardized APIs
4. **Performance**: Shared components reduce bundle size
5. **Accessibility**: Standardized components include proper accessibility features
6. **Future-proof**: Easier to update design system globally

## Common Migration Issues

### Issue: TypeScript errors with new components
**Solution**: Ensure all required props are provided and types match

### Issue: Styling conflicts
**Solution**: Remove custom CSS that duplicates unified classes

### Issue: Missing functionality in standardized components
**Solution**: Extend components or create specialized variants

## Timeline Recommendation

1. **Phase 1** (1-2 weeks): Migrate 2-3 high-traffic pages as proof of concept
2. **Phase 2** (2-3 weeks): Migrate remaining critical pages
3. **Phase 3** (Ongoing): Migrate supporting pages as time permits

Start with pages that have the most similar structure to minimize migration effort.