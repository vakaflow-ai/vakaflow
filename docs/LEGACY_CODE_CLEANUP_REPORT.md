# Legacy Code Cleanup Report

## Files Still Using Legacy Patterns

### Material Components (25+ files)
These files import and use Material components that should be replaced with standardized components:

1. **AgentDetailsView.tsx** - Uses MaterialCard, MaterialButton, MaterialChip, MaterialInput
2. **AgenticNodeConfig.tsx** - Uses MaterialButton  
3. **AssessmentResponseGrid.tsx** - Uses MaterialCard, MaterialChip, MaterialButton
4. **CommentDialog.tsx** - Uses MaterialButton, MaterialInput, MaterialCard
5. **DashboardMetricCard.tsx** - Uses MaterialCard
6. **DashboardSection.tsx** - Uses MaterialCard
7. **DiagramFieldInput.tsx** - Uses MaterialButton
8. **FilterBar.tsx** - Uses MaterialButton, MaterialCard
9. **JsonFieldInput.tsx** - Uses MaterialButton
10. **JsonFieldTableInput.tsx** - Uses MaterialButton
11. **OnboardingSidebar.tsx** - Uses MaterialCard
12. **OnboardingWorkflowPanel.tsx** - Uses MaterialCard
13. **PageHeader.tsx** - Uses MaterialButton
14. **PromptDialog.tsx** - Uses MaterialButton, MaterialInput
15. **StageSettingsModal.tsx** - Uses MaterialSelect
16. **SummaryCards.tsx** - Uses MaterialCard
17. **TrustCenterLayout.tsx** - Uses MaterialCard, MaterialButton
18. **VendorBrandingSelector.tsx** - Uses MaterialCard, MaterialButton
19. **WorkflowFlowchart.tsx** - Uses MaterialCard, MaterialButton, MaterialInput
20. **WorkflowStatusCard.tsx** - Uses MaterialCard, MaterialButton
21. **AdminDashboard.tsx** - Uses MaterialCard, MaterialButton
22. **AgentCatalog.tsx** - Uses MaterialCard, MaterialButton, MaterialChip, MaterialInput
23. **AgentDetail.tsx** - Uses MaterialCard, MaterialButton, MaterialChip
24. **AgentSubmission.tsx** - Uses SearchableSelect
25. **ApplicationLogs.tsx** - Uses MaterialCard, MaterialButton, MaterialInput, MaterialChip

### Legacy CSS Classes (100+ instances)
These files use legacy CSS patterns that should be replaced with unified classes:

**Compact Classes:**
- `compact-card` - Should use `unified-card`
- `compact-button-primary/secondary` - Should use `unified-btn-primary/secondary`
- `compact-input` - Should use `unified-input`

**Enterprise Classes:**
- `enterprise-input` - Should use `unified-input`
- `enterprise-label` - Should use `unified-label`

**Manual Styling:**
- `bg-white rounded-lg border` - Should use `unified-card`
- `px-4 py-2 bg-blue-600 text-white rounded-md` - Should use `unified-btn-primary`

## Migration Priority

### High Priority (Core Pages)
1. **WorkflowManagement.tsx** - Main workflow configuration page
2. **UserManagement.tsx** - Critical admin functionality
3. **AgentCatalog.tsx** - Core business functionality
4. **AssessmentsManagement.tsx** - Core assessment functionality

### Medium Priority (Secondary Pages)
1. **AdminDashboard.tsx** - Admin overview
2. **AgentDetail.tsx** - Agent details view
3. **ApplicationLogs.tsx** - System monitoring
4. **IntegrationManagement.tsx** - Integration setup

### Low Priority (Supporting Pages)
1. **CommentsSection.tsx** - Comments component
2. **ConnectionDiagram.tsx** - Visualization component
3. **DynamicForm.tsx** - Form rendering
4. **FileUpload.tsx** - File upload component

## Migration Strategy

### Phase 1: Core Pages (1-2 weeks)
- Migrate `/workflows` page (completed)
- Migrate User Management page
- Migrate Agent Catalog page
- Migrate Assessment Management page

### Phase 2: Admin Pages (2-3 weeks)
- Migrate dashboard pages
- Migrate configuration pages
- Migrate reporting pages

### Phase 3: Supporting Components (3-4 weeks)
- Migrate reusable components
- Migrate form components
- Migrate visualization components

## Cleanup Actions

### Immediate Actions
✅ Updated `/workflows` route to use standardized page
✅ Created standardized workflows page
✅ Added unified CSS import to main stylesheet

### Next Steps
1. Remove unused material component imports
2. Create migration script for batch conversion
3. Update component library documentation
4. Remove legacy CSS classes from unified.css

### Files to Remove
- Legacy material component files that are no longer imported
- Duplicate styling implementations
- Deprecated utility functions

## Success Metrics
- Reduce legacy component usage by 80%
- Eliminate 90% of custom CSS classes
- Achieve 100% standardized page coverage for core functionality
- Reduce overall bundle size by 15-20%

This cleanup will significantly improve maintainability and ensure consistent user experience across the entire platform.