# Request Type Management - REMOVED

**⚠️ NOTE: This feature has been deprecated and removed from the application.**

Previously, this provided a streamlined list page for viewing and managing request types with:
- **Search and Filtering**: Filter by name, type, visibility, and status
- **Visual Statistics**: Cards showing total counts, active request types, workflows, and forms
- **Detailed List View**: Each request type displays with badges for visibility and status
- **Basic Actions**: Edit and delete functionality (simplified for baseline)
- **Responsive Design**: Works well on all device sizes

## Features Included (Baseline)

### Request Type Management
- ✅ View all request types in a clean list format
- ✅ Search and filter capabilities
- ✅ Visual status indicators (Active/Inactive)
- ✅ Visibility scope badges (Internal/External/Both)
- ✅ Basic statistics dashboard
- ✅ Delete functionality

### Integration Points
- ✅ Displays associated workflow counts
- ✅ Shows form library connections
- ✅ Links to existing admin workflows

### Entity Support
Supports the following entity types:
- 📦 Product
- 💼 Service  
- 🤖 Agent
- 🏢 Vendor
- 👤 User
- 📋 Assessment

## Access Instructions (REMOVED)

### Via Navigation Menu
~~As an admin user, navigate to:
**Administration** → **Workflow Management** → **Request Types List**~~

### Direct URL Access
~~Visit: `/admin/request-types-list`~~

**This feature is no longer available.**

## Technical Implementation (REMOVED)

### Files Previously Used

1. **Removed Files:**
   - `frontend/src/pages/RequestTypeListPage.tsx` - Main list page component (DELETED)
   - `frontend/src/pages/UnifiedRequestTypeDashboard.tsx` - Unified dashboard component (DELETED)
   - `frontend/src/pages/ConfigurationBackbone.tsx` - Configuration backbone component (DELETED)

2. **Modified Files:**
   - `frontend/src/App.tsx` - Removed routes for the request types features
   - `frontend/src/components/Layout.tsx` - Removed navigation menu items and permission mappings

### API Integration
Uses existing request type configuration API endpoints:
- `GET /api/v1/request-type-config` - List all request types
- `POST /api/v1/request-type-config` - Create new request type
- `PATCH /api/v1/request-type-config/{id}` - Update request type
- `DELETE /api/v1/request-type-config/{id}` - Delete request type

### Dependencies
- React Query for data fetching and caching
- Material UI components for consistent styling
- TanStack Table for potential future enhancements
- Lucide React icons for UI elements

## Usage Guide (REMOVED)

### Previously Available Features
~~### Viewing Request Types
- Navigate to Administration → Workflow Management → Request Types List
- Use search bar to find specific request types
- Apply filters for visibility and status
- View detailed information including associated workflows and forms~~

~~### Managing Request Types
- Click "Edit" to modify existing request types using the guided wizard
- Click "Delete" to remove request types (with confirmation)
- Both create and edit operations use the same 4-step guided flow~~

~~### Viewing Details
Each request type card showed:
- Display name and internal type
- Visibility scope badge (Internal/External/Both)
- Status badge (Active/Inactive)
- Associated workflow count
- Associated form count
- Creation date~~

**These features are no longer available in the application.**

## Enhanced Features

### Guided Workflow for Both Create and Edit
Both creating new request types and editing existing ones now use the same intuitive 4-step guided workflow:

1. **Basic Information** - Name, entity type, description, visibility settings
2. **Custom Attributes** - Define dynamic fields with validation rules
3. **Workflow Configuration** - Select existing workflow or create new one
4. **Form Assignment** - Assign submission and approval forms

This provides a consistent user experience for all request type management operations.

## Future Enhancements

Potential improvements that could be added:
- Bulk operations (enable/disable multiple request types)
- Export functionality (CSV/PDF reports)
- Advanced filtering options
- Request type templates
- Import functionality
- Audit trail/history
- Permission-based access control per request type