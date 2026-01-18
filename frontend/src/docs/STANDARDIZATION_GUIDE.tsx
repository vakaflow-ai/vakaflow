// Standardization Implementation Guide
//
// This file demonstrates the standardized patterns for the VAKA platform
// All new pages should follow these conventions

import React from 'react'
import { 
  StandardPageContainer,
  StandardPageHeader,
  StandardActionButton,
  StandardCard,
  StandardTable,
  StandardSearchFilter
} from '../components/StandardizedLayout'

// 1. PAGE STRUCTURE PATTERN
export default function StandardizedPageTemplate() {
  return (
    <StandardPageContainer>
      {/* Standard Page Header */}
      <StandardPageHeader
        title="Page Title"
        subtitle="Page description goes here"
        actions={
          <>
            <StandardActionButton variant="outline">
              Secondary Action
            </StandardActionButton>
            <StandardActionButton>
              Primary Action
            </StandardActionButton>
          </>
        }
      />

      {/* Search/Filter Section */}
      <StandardCard>
        <StandardSearchFilter
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder="Search items..."
        />
      </StandardCard>

      {/* Main Content */}
      <StandardCard>
        <StandardTable
          headers={[
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions', className: 'text-right' }
          ]}
          data={[]}
          renderRow={(item, index) => (
            <tr key={item.id} className="unified-table-row">
              <td className="unified-table-cell-primary">{item.name}</td>
              <td className="unified-table-cell">
                <span className="unified-badge-success">Active</span>
              </td>
              <td className="unified-table-cell">
                <div className="flex gap-1 justify-end">
                  <StandardActionButton variant="outline" size="sm">
                    Edit
                  </StandardActionButton>
                  <StandardActionButton variant="danger" size="sm">
                    Delete
                  </StandardActionButton>
                </div>
              </td>
            </tr>
          )}
        />
      </StandardCard>
    </StandardPageContainer>
  )
}

// 2. CSS CLASS STANDARDIZATION
/*
Use these unified CSS classes instead of custom styling:

TYPOGRAPHY:
- unified-page-title       → Main page headings
- unified-page-subtitle    → Page descriptions
- unified-section-title    → Section headings
- unified-label           → Form labels
- unified-body            → Body text
- unified-caption         → Small text/captions

BUTTONS:
- unified-btn             → Base button class
- unified-btn-primary     → Primary action buttons
- unified-btn-secondary   → Secondary buttons
- unified-btn-danger      → Delete/danger buttons
- unified-btn-outline     → Outline buttons
- unified-btn-sm/md/lg    → Button sizes

INPUTS:
- unified-input           → Standard input fields
- unified-search          → Search inputs (with icon)
- unified-select          → Select dropdowns
- unified-textarea        → Text areas

CARDS:
- unified-card            → Card containers
- unified-card-header     → Card headers
- unified-card-body       → Card content
- unified-card-footer     → Card footers

TABLES:
- unified-table-container → Table wrapper
- unified-table           → Table element
- unified-table-header    → Table headers
- unified-table-row       → Table rows
- unified-table-cell      → Table cells
- unified-table-cell-primary → Primary table cells

LAYOUT:
- unified-page-container  → Main page wrapper
- unified-divider         → Horizontal dividers
- unified-space-y-*       → Vertical spacing
- unified-flex-*          → Flexbox helpers

STATUS BADGES:
- unified-badge-success   → Green badges
- unified-badge-warning   → Amber badges
- unified-badge-error     → Red badges
- unified-badge-info      → Blue badges
*/

// 3. DELETE FUNCTIONALITY PATTERN
/*
Implement consistent delete with confirmation:

const handleDelete = async (itemId, itemName) => {
  if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
    return
  }
  
  try {
    // Perform delete operation
    await deleteApi(itemId)
    // Show success message
    showToast.success(`${itemName} deleted successfully`)
  } catch (error) {
    // Show error message
    showToast.error(`Failed to delete ${itemName}`)
  }
}
*/

// 4. MODAL PATTERNS
/*
Use the unified modal system:

// Confirmation Modal
showConfirm(
  'Delete Item',
  'Are you sure you want to delete this item?',
  () => performDelete(),
  { confirmVariant: 'danger' }
)

// Form Modal
showForm(
  'Edit Item',
  <FormComponent />,
  { onSubmit: handleSubmit }
)

// Alert Modal
showAlert(
  'Success',
  'Operation completed successfully'
)
*/

// 5. COMPONENT REPLACEMENT GUIDE
/*
Replace legacy components with standardized versions:

OLD → NEW
<div className="space-y-6"> → <StandardPageContainer>
<h1>Title</h1> → <StandardPageHeader title="Title" />
<button className="..."> → <StandardActionButton>
<div className="bg-white rounded-lg border"> → <StandardCard>
<table> → <StandardTable>
<div className="flex gap-4"> + search input → <StandardSearchFilter>
*/

// 6. DRY PRINCIPLES IMPLEMENTED
/*
- Single source of truth for layout components
- Reusable CSS utility classes
- Standardized prop interfaces
- Consistent design patterns
- Centralized modal management
- Unified styling system
*/